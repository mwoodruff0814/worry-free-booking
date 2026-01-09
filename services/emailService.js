const nodemailer = require('nodemailer');
const { generateICSFile } = require('./icloudCalendar');
const { formatTimeWindow } = require('../utils/helpers');
const fs = require('fs').promises;
const path = require('path');

/**
 * Parse date string as Eastern timezone to prevent timezone shifting
 * For date strings like "2025-11-01", treat as local date (not UTC)
 * This prevents "2025-11-01" from showing as "10/31/2025" in Eastern timezone
 */
function parseLocalDate(dateString) {
    if (!dateString) return new Date();

    // If it's a date-only string (YYYY-MM-DD), parse as local date
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
    }

    // Otherwise parse normally (for timestamps)
    return new Date(dateString);
}

/**
 * Format date in Eastern timezone
 */
function formatDateET(dateString, options = {}) {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        ...options
    });
}

/**
 * Format datetime in Eastern timezone
 */
function formatDateTimeET(dateString) {
    const date = parseLocalDate(dateString);
    return date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Helper function to load company-specific settings
async function loadCompanySettings(companyName) {
    try {
        const settingsPath = path.join(__dirname, '../data/communication-settings.json');
        const data = await fs.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(data);

        // Determine which company settings to use
        if (companyName === 'Quality Moving' && settings.qualityMoving) {
            return {
                companyName: settings.qualityMoving.companyName || 'Quality Moving',
                companyEmail: settings.qualityMoving.companyEmail || 'qualitymovingsolution@gmail.com',
                companyPhone: settings.qualityMoving.companyPhone || '330-720-3529',
                companyWebsite: null, // Quality Moving: no website, only movinghelp.com
                ccEmails: settings.qualityMoving.ccEmails || [],
                signature: settings.qualityMoving.email?.signature || `Best regards,\nQuality Moving Team\n330-720-3529\nqualitymovingsolution@gmail.com`
            };
        } else {
            // Default to Worry Free Moving
            return {
                companyName: 'Worry Free Moving',
                companyEmail: process.env.EMAIL_FROM || 'support@worryfreemovers.com',
                companyPhone: '330-435-8686',
                companyWebsite: 'worryfreemovers.com',
                ccEmails: getCCList() ? getCCList().split(',').map(e => e.trim()) : [],
                signature: `Best regards,\nWorry Free Moving Team\n330-435-8686\nsupport@worryfreemovers.com`
            };
        }
    } catch (error) {
        console.error('Error loading company settings:', error);
        // Fallback to Worry Free Moving defaults
        return {
            companyName: 'Worry Free Moving',
            companyEmail: process.env.EMAIL_FROM || 'support@worryfreemovers.com',
            companyPhone: '330-435-8686',
            companyWebsite: 'worryfreemovers.com',
            ccEmails: getCCList() ? getCCList().split(',').map(e => e.trim()) : [],
            signature: `Best regards,\nWorry Free Moving Team\n330-435-8686\nsupport@worryfreemovers.com`
        };
    }
}

// Helper function to get CC list from environment variable
function getCCList() {
    // You can easily add/remove emails in .env file: EMAIL_CC_LIST=support@worryfreemovers.com,zlarimer24@gmail.com
    const ccList = process.env.EMAIL_CC_LIST || '';
    return ccList.trim() || null; // Return null if empty to avoid sending to empty CC
}

// Helper function to generate Google Calendar URL
function generateGoogleCalendarUrl(eventDetails) {
    const { summary, description, location, start, end } = eventDetails;

    // Convert ISO dates to Google Calendar format (YYYYMMDDTHHmmss)
    const formatDateForGoogle = (dateStr) => {
        return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startFormatted = formatDateForGoogle(start);
    const endFormatted = formatDateForGoogle(end);

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: summary,
        dates: `${startFormatted}/${endFormatted}`,
        details: description || '',
        location: location || ''
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Create email transporter (company-specific)
let transporters = {};

function initializeTransporter(companyName = 'Worry Free Moving') {
    // Check if we already have a transporter for this company
    if (transporters[companyName]) return transporters[companyName];

    let transporter = null;

    // Configure based on company
    if (process.env.EMAIL_SERVICE === 'gmail') {
        // Gmail configuration - use company-specific credentials
        if (companyName === 'Quality Moving') {
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.QUALITY_EMAIL_USER || 'qualitymovingsolution@gmail.com',
                    pass: process.env.QUALITY_EMAIL_PASSWORD
                }
            });
        } else {
            // Worry Free Moving (default)
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                }
            });
        }
    } else if (process.env.EMAIL_SERVICE === 'smtp') {
        // Generic SMTP configuration
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });
    } else {
        // Development mode - use Ethereal (fake SMTP)
        console.warn('No email service configured. Using test mode.');
        console.warn('Configure EMAIL_SERVICE in .env file (gmail or smtp)');
        return null;
    }

    // Cache the transporter
    transporters[companyName] = transporter;
    return transporter;
}

/**
 * Send appointment confirmation email
 */
async function sendConfirmationEmail(details) {
    try {
        const {
            to,
            customerName,
            bookingId,
            date,
            time,
            serviceType,
            pickupAddress,
            dropoffAddress,
            estimateDetails,
            company
        } = details;

        // Load company-specific settings
        const companySettings = await loadCompanySettings(company);

        const transporter = initializeTransporter(company);

        if (!transporter) {
            console.warn('Email service not configured. Skipping confirmation email.');
            return null;
        }

        // Format date - parse as local time to avoid timezone issues
        const [year, month, day] = date.split('-');
        const localDate = new Date(year, month - 1, day);
        const formattedDate = localDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Format time as 1-hour arrival window
        const formattedTime = formatTimeWindow(time);

        // Generate calendar invite (.ics file)
        const calendarEventDetails = {
            summary: `${serviceType} - ${companySettings.companyName}`,
            description: `Booking ID: ${bookingId}\nService: ${serviceType}`,
            location: pickupAddress || '',
            start: `${date}T${time}:00`,
            end: `${date}T${time}:00`
        };
        const icsContent = generateICSFile(calendarEventDetails);

        // Generate Google Calendar URL
        const googleCalendarUrl = generateGoogleCalendarUrl(calendarEventDetails);

        // Email HTML template
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #004085 0%, #0056b3 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }
        .booking-details {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .detail-row {
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: 600;
            color: #004085;
        }
        .button {
            display: inline-block;
            background: #004085;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 25px;
            margin: 10px 5px;
            font-weight: 600;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Booking Confirmed!</h1>
            <p>Thank you for choosing ${companySettings.companyName}</p>
        </div>
        <div class="content">
            <p>Hi ${customerName},</p>
            <p>Great news! Your appointment has been confirmed. We're looking forward to helping you with your move!</p>

            <div class="booking-details">
                <h2 style="color: #004085; margin-top: 0;">Booking Details</h2>
                <div class="detail-row">
                    <span class="label">Booking ID:</span> ${bookingId}
                </div>
                <div class="detail-row">
                    <span class="label">Service:</span> ${serviceType}
                </div>
                <div class="detail-row">
                    <span class="label">Date:</span> ${formattedDate}
                </div>
                <div class="detail-row">
                    <span class="label">Arrival Window:</span> ${formattedTime}
                </div>
                ${pickupAddress ? `
                <div class="detail-row">
                    <span class="label">Pickup Address:</span> ${pickupAddress}
                </div>
                ` : ''}
                ${dropoffAddress ? `
                <div class="detail-row">
                    <span class="label">Dropoff Address:</span> ${dropoffAddress}
                </div>
                ` : ''}
            </div>

            ${estimateDetails ? `
            <div class="booking-details" style="margin-top: 20px;">
                <h2 style="color: #004085; margin-top: 0;">💰 Estimate Breakdown</h2>
                <div class="detail-row">
                    <span class="label">Service:</span> ${estimateDetails.serviceCategory === 'moving' ? `${estimateDetails.numMovers}-Person Crew + Truck` : `Labor Only (${estimateDetails.numMovers} helpers)`}
                </div>
                <div class="detail-row">
                    <span class="label">Distance:</span> ${Math.round(estimateDetails.distance || 0)} miles
                </div>
                <div class="detail-row">
                    <span class="label">Estimated Time:</span> ${Math.round(estimateDetails.estimatedHours || 0)} hours
                </div>

                <div style="margin: 20px 0; padding: 15px; background: #f1f5f9; border-radius: 8px;">
                    <h3 style="margin-top: 0; color: #004085; font-size: 16px;">Cost Details:</h3>
                    ${estimateDetails.distanceCharge && estimateDetails.distanceCharge > 0 ? `
                    <div style="padding: 5px 0; display: flex; justify-content: space-between;">
                        <span>Distance Charge:</span>
                        <strong>$${estimateDetails.distanceCharge.toFixed(2)}</strong>
                    </div>
                    ` : ''}
                    ${estimateDetails.travelFee && estimateDetails.travelFee > 0 ? `
                    <div style="padding: 5px 0; display: flex; justify-content: space-between;">
                        <span>Travel Fee:</span>
                        <strong>$${estimateDetails.travelFee.toFixed(2)}</strong>
                    </div>
                    ` : ''}
                    ${estimateDetails.stairsFee && estimateDetails.stairsFee > 0 ? `
                    <div style="padding: 5px 0; display: flex; justify-content: space-between;">
                        <span>Stairs Fee (${(estimateDetails.pickupStairs || 0) + (estimateDetails.deliveryStairs || 0)} flights):</span>
                        <strong>$${estimateDetails.stairsFee.toFixed(2)}</strong>
                    </div>
                    ` : ''}
                    ${estimateDetails.heavyItemsFee && estimateDetails.heavyItemsFee > 0 ? `
                    <div style="padding: 5px 0; display: flex; justify-content: space-between;">
                        <span>Heavy Items Fee:</span>
                        <strong>$${estimateDetails.heavyItemsFee.toFixed(2)}</strong>
                    </div>
                    ` : ''}
                    ${estimateDetails.packingFee && estimateDetails.packingFee > 0 ? `
                    <div style="padding: 5px 0; display: flex; justify-content: space-between;">
                        <span>Packing Services:</span>
                        <strong>$${estimateDetails.packingFee.toFixed(2)}</strong>
                    </div>
                    ` : ''}
                    ${estimateDetails.fvpCost && estimateDetails.fvpCost > 0 ? `
                    <div style="padding: 5px 0; display: flex; justify-content: space-between;">
                        <span>Full Value Protection:</span>
                        <strong>$${estimateDetails.fvpCost.toFixed(2)}</strong>
                    </div>
                    ` : ''}
                    ${estimateDetails.subtotal ? `
                    <div style="padding: 10px 0 5px 0; margin-top: 10px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between;">
                        <span>Subtotal:</span>
                        <strong>$${estimateDetails.subtotal.toFixed(2)}</strong>
                    </div>
                    ` : ''}
                    ${estimateDetails.serviceCharge && estimateDetails.serviceCharge > 0 ? `
                    <div style="padding: 5px 0; display: flex; justify-content: space-between;">
                        <span>Service Charge (${estimateDetails.serviceCategory === 'moving' ? '14%' : '8%'}):</span>
                        <strong>$${estimateDetails.serviceCharge.toFixed(2)}</strong>
                    </div>
                    ` : ''}
                    <div style="padding: 10px 0; margin-top: 10px; border-top: 2px solid #004085; display: flex; justify-content: space-between; font-size: 18px;">
                        <span><strong>TOTAL:</strong></span>
                        <strong style="color: #004085;">$${Math.round(estimateDetails.total)}</strong>
                    </div>
                </div>

                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                        <strong>⚠️ Important:</strong> This is an estimate. Final cost is based on actual time needed. 2-hour minimum applies to all jobs.
                    </p>
                </div>
            </div>
            ` : ''}


            <div style="text-align: center; margin: 30px 0;">
                <p><strong>📅 Add to your calendar:</strong></p>
                <div style="margin: 20px 0;">
                    <a href="${googleCalendarUrl}"
                       target="_blank"
                       style="display: inline-block; background: #4285f4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 10px 5px; font-weight: 600;">
                        📅 Add to Google Calendar
                    </a>
                    <a href="data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}"
                       download="appointment.ics"
                       style="display: inline-block; background: #555; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 10px 5px; font-weight: 600;">
                        🍎 Add to Apple Calendar
                    </a>
                </div>
                <p style="font-size: 14px; color: #666; margin-top: 10px;">
                    Calendar invite (.ics file) is also attached to this email
                </p>
            </div>

            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 10px; text-align: center; margin: 30px 0;">
                <h3 style="color: white; margin-top: 0;">📋 Manage Your Booking</h3>
                <p style="color: white; margin-bottom: 20px;">View your booking details or make changes anytime</p>
                <a href="http://localhost:3001/view-booking.html?id=${encodeURIComponent(bookingId)}&email=${encodeURIComponent(to)}"
                   class="button"
                   style="background: white; color: #667eea; padding: 14px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block;">
                    View or Cancel My Booking
                </a>
            </div>

            <h3 style="color: #004085;">What's Next?</h3>
            <ul>
                <li>We'll call you 24 hours before your appointment to confirm</li>
                <li>Make sure to have boxes packed and ready if applicable</li>
                <li>Clear pathways for easy access</li>
                <li>Have any questions? Give us a call!</li>
            </ul>

            <h3 style="color: #004085;">Need to Make Changes?</h3>
            ${company === 'Quality Moving' ? `
            <p>If you need to reschedule or cancel, please contact:</p>
            <p>
                📞 <strong>Phone:</strong> <a href="tel:${companySettings.companyPhone.replace(/[^0-9]/g, '')}">${companySettings.companyPhone}</a><br>
                📧 <strong>Email:</strong> <a href="mailto:${companySettings.companyEmail}">${companySettings.companyEmail}</a><br>
                🌐 <strong>MovingHelp:</strong> <a href="https://www.movinghelp.com" target="_blank">movinghelp.com</a>
            </p>
            ` : `
            <p>If you need to reschedule or cancel, please contact us as soon as possible:</p>
            <p>
                📞 <strong>Phone:</strong> <a href="tel:${companySettings.companyPhone.replace(/[^0-9]/g, '')}">${companySettings.companyPhone}</a><br>
                📧 <strong>Email:</strong> <a href="mailto:${companySettings.companyEmail}">${companySettings.companyEmail}</a><br>
                🌐 <strong>Website:</strong> <a href="https://${companySettings.companyWebsite}" target="_blank">${companySettings.companyWebsite}</a>
            </p>
            `}

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <strong>⚠️ Important:</strong> Please arrive/be ready 15 minutes before your scheduled time.
            </div>
        </div>

        <div class="footer">
            <p><strong>${companySettings.companyName}</strong></p>
            ${company === 'Quality Moving' ? `
            <p>${companySettings.companyPhone} | ${companySettings.companyEmail}</p>
            <p>For changes or cancellations, visit <a href="https://www.movinghelp.com" target="_blank">movinghelp.com</a></p>
            ` : `
            <p>${companySettings.companyPhone} | ${companySettings.companyEmail}</p>
            <p><a href="https://${companySettings.companyWebsite}" target="_blank">${companySettings.companyWebsite}</a></p>
            <p>Serving the community since 2018</p>
            `}
            <p style="font-size: 12px; color: #999; margin-top: 20px;">
                This is an automated confirmation email. Please do not reply to this message.
            </p>
        </div>
    </div>
</body>
</html>
        `;

        // Plain text version
        const textContent = `
Booking Confirmed - ${companySettings.companyName}

Hi ${customerName},

Your appointment has been confirmed!

Booking Details:
----------------
Booking ID: ${bookingId}
Service: ${serviceType}
Date: ${formattedDate}
Arrival Window: ${formattedTime}
${pickupAddress ? `Pickup: ${pickupAddress}` : ''}
${dropoffAddress ? `Dropoff: ${dropoffAddress}` : ''}
${estimateDetails ? `Estimated Total: $${estimateDetails.total}` : ''}

A calendar invite is attached to this email.

Questions? Contact us:
Phone: ${companySettings.companyPhone}
Email: ${companySettings.companyEmail}

Thank you for choosing ${companySettings.companyName}!
        `;

        // Send email
        const info = await transporter.sendMail({
            from: `"${companySettings.companyName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || companySettings.companyEmail}>`,
            to,
            cc: companySettings.ccEmails.length > 0 ? companySettings.ccEmails.join(',') : getCCList(), // CC list from company settings or .env
            bcc: process.env.COMPANY_EMAIL || companySettings.companyEmail, // Copy to company
            subject: `✅ Booking Confirmed - ${formattedDate} at ${formattedTime}`,
            text: textContent,
            html: htmlContent,
            attachments: [
                {
                    filename: 'appointment.ics',
                    content: icsContent,
                    contentType: 'text/calendar'
                }
            ]
        });

        console.log('Confirmation email sent:', info.messageId);
        return info;

    } catch (error) {
        console.error('Error sending confirmation email:', error);
        throw error;
    }
}

/**
 * Send cancellation email
 */
async function sendCancellationEmail(details) {
    try {
        const { to, customerName, bookingId, date, time, company } = details;

        // Load company-specific settings
        const companySettings = await loadCompanySettings(company);

        const transporter = initializeTransporter(company);
        if (!transporter) return null;

        // Format date - parse as local time to avoid timezone issues
        const [year, month, day] = date.split('-');
        const localDate = new Date(year, month - 1, day);
        const formattedDate = localDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const info = await transporter.sendMail({
            from: `"${companySettings.companyName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || companySettings.companyEmail}>`,
            to,
            cc: companySettings.ccEmails.length > 0 ? companySettings.ccEmails.join(',') : getCCList(),
            subject: `Appointment Cancelled - Booking #${bookingId}`,
            html: `
                <h2>Appointment Cancelled</h2>
                <p>Hi ${customerName},</p>
                <p>Your appointment scheduled for ${formattedDate} with arrival window ${formatTimeWindow(time)} has been cancelled.</p>
                <p>Booking ID: ${bookingId}</p>
                <p>If you'd like to reschedule, please contact us at ${companySettings.companyPhone}.</p>
                <p>Thank you,<br>${companySettings.companyName}</p>
            `
        });

        console.log('Cancellation email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending cancellation email:', error);
        throw error;
    }
}

/**
 * Helper function to format time
 */
function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Send reschedule confirmation email
 */
async function sendRescheduleEmail(details) {
    try {
        const {
            to,
            customerName,
            bookingId,
            oldDate,
            oldTime,
            newDate,
            newTime,
            serviceType,
            pickupAddress,
            company
        } = details;

        // Load company-specific settings
        const companySettings = await loadCompanySettings(company);

        const transporter = initializeTransporter(company);
        if (!transporter) return null;

        const oldFormattedDate = new Date(oldDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const newFormattedDate = new Date(newDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Generate calendar invite for NEW date
        const calendarEventDetails = {
            summary: `${serviceType} - ${companySettings.companyName}`,
            description: `Booking ID: ${bookingId}\nService: ${serviceType}`,
            location: pickupAddress || '',
            start: `${newDate}T${newTime}:00`,
            end: `${newDate}T${newTime}:00`
        };
        const icsContent = generateICSFile(calendarEventDetails);
        const googleCalendarUrl = generateGoogleCalendarUrl(calendarEventDetails);

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #004085 0%, #0056b3 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .change-box { background: #fff; padding: 20px; border-left: 4px solid #ffc107; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Appointment Rescheduled</h1>
        </div>
        <div class="content">
            <p>Hi ${customerName},</p>
            <p>Your appointment has been successfully rescheduled.</p>
            <div class="change-box">
                <p><strong>Previous:</strong> <span style="text-decoration: line-through">${oldFormattedDate} - ${formatTimeWindow(oldTime)}</span></p>
                <p><strong>New Schedule:</strong> <span style="color: #004085; font-weight: 600">${newFormattedDate}</span></p>
                <p><strong>Arrival Window:</strong> <span style="color: #004085; font-weight: 600">${formatTimeWindow(newTime)}</span></p>
                <p><strong>Booking ID:</strong> ${bookingId}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <p><strong>📅 Add updated appointment to your calendar:</strong></p>
                <div style="margin: 20px 0;">
                    <a href="${googleCalendarUrl}"
                       target="_blank"
                       style="display: inline-block; background: #4285f4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 10px 5px; font-weight: 600;">
                        📅 Add to Google Calendar
                    </a>
                    <a href="data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}"
                       download="appointment.ics"
                       style="display: inline-block; background: #555; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 10px 5px; font-weight: 600;">
                        🍎 Add to Apple Calendar
                    </a>
                </div>
                <p style="font-size: 14px; color: #666; margin-top: 10px;">
                    Calendar invite (.ics file) is also attached to this email
                </p>
            </div>

            <p>We'll call you 24 hours before your appointment.</p>
            ${company === 'Quality Moving' ? `
            <p><strong>Questions?</strong><br>
            📞 <a href="tel:${companySettings.companyPhone.replace(/[^0-9]/g, '')}">${companySettings.companyPhone}</a> |
            📧 <a href="mailto:${companySettings.companyEmail}">${companySettings.companyEmail}</a><br>
            🌐 <a href="https://www.movinghelp.com" target="_blank">movinghelp.com</a></p>
            ` : `
            <p><strong>Questions?</strong><br>
            📞 <a href="tel:${companySettings.companyPhone.replace(/[^0-9]/g, '')}">${companySettings.companyPhone}</a> |
            📧 <a href="mailto:${companySettings.companyEmail}">${companySettings.companyEmail}</a><br>
            🌐 <a href="https://${companySettings.companyWebsite}" target="_blank">${companySettings.companyWebsite}</a></p>
            `}
        </div>

        <div class="footer">
            <p><strong>${companySettings.companyName}</strong></p>
            ${company === 'Quality Moving' ? `
            <p>${companySettings.companyPhone} | ${companySettings.companyEmail}</p>
            <p>For changes or cancellations, visit <a href="https://www.movinghelp.com" target="_blank">movinghelp.com</a></p>
            ` : `
            <p>${companySettings.companyPhone} | ${companySettings.companyEmail}</p>
            <p><a href="https://${companySettings.companyWebsite}" target="_blank">${companySettings.companyWebsite}</a></p>
            `}
        </div>
    </div>
</body>
</html>
        `;

        await transporter.sendMail({
            from: `"${companySettings.companyName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || companySettings.companyEmail}>`,
            to,
            cc: companySettings.ccEmails.length > 0 ? companySettings.ccEmails.join(',') : getCCList(),
            bcc: process.env.COMPANY_EMAIL || companySettings.companyEmail,
            subject: `Appointment Rescheduled - ${newFormattedDate}`,
            html: htmlContent,
            attachments: [
                {
                    filename: 'appointment.ics',
                    content: icsContent,
                    contentType: 'text/calendar'
                }
            ]
        });

        return true;
    } catch (error) {
        console.error('Error sending reschedule email:', error);
        throw error;
    }
}

/**
 * Send company notification email
 */
async function sendCompanyNotification(details) {
    try {
        const { customerName, bookingId, date, time, serviceType, pickupAddress, dropoffAddress, phone, email, estimateDetails, company } = details;

        // Load company-specific settings
        const companySettings = await loadCompanySettings(company);

        const transporter = initializeTransporter(company);
        if (!transporter) return null;

        // Format date - parse as local time to avoid timezone issues
        const [year, month, day] = date.split('-');
        const localDate = new Date(year, month - 1, day);
        const formattedDate = localDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const htmlContent = `
<h2>🆕 New Booking Received</h2>
<p><strong>Booking ID:</strong> ${bookingId}</p>
<p><strong>Date:</strong> ${formattedDate}</p>
<p><strong>Arrival Window:</strong> ${formatTimeWindow(time)}</p>
<p><strong>Service:</strong> ${serviceType}</p>
<h3>Customer:</h3>
<p><strong>Name:</strong> ${customerName}<br>
<strong>Phone:</strong> <a href="tel:${phone}">${phone}</a><br>
<strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
${pickupAddress ? `<p><strong>Pickup:</strong> ${pickupAddress}</p>` : ''}
${dropoffAddress ? `<p><strong>Dropoff:</strong> ${dropoffAddress}</p>` : ''}
${estimateDetails ? `<p><strong>Estimate:</strong> $${estimateDetails.total}</p>` : ''}
        `;

        await transporter.sendMail({
            from: `"${companySettings.companyName}" <${process.env.EMAIL_USER || companySettings.companyEmail}>`,
            to: process.env.COMPANY_EMAIL || companySettings.companyEmail,
            cc: companySettings.ccEmails.length > 0 ? companySettings.ccEmails.join(',') : getCCList(),
            subject: `🆕 New Booking: ${serviceType} - ${formattedDate}`,
            html: htmlContent
        });

        return true;
    } catch (error) {
        console.error('Error sending company notification:', error);
        throw error;
    }
}

/**
 * Send 24-hour reminder
 */
async function send24HourReminder(details) {
    try {
        const { to, customerName, date, time, serviceType, pickupAddress, company } = details;

        // Load company-specific settings
        const companySettings = await loadCompanySettings(company);

        const transporter = initializeTransporter(company);
        if (!transporter) return null;

        // Format date - parse as local time to avoid timezone issues
        const [year, month, day] = date.split('-');
        const localDate = new Date(year, month - 1, day);
        const formattedDate = localDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const htmlContent = `
<h2>⏰ Reminder: Tomorrow's Your Move!</h2>
<p>Hi ${customerName},</p>
<p>Your move is scheduled for <strong>tomorrow</strong>!</p>
<p><strong>Date:</strong> ${formattedDate}<br>
<strong>Arrival Window:</strong> ${formatTimeWindow(time)}<br>
<strong>Service:</strong> ${serviceType}</p>
${pickupAddress ? `<p><strong>Pickup:</strong> ${pickupAddress}</p>` : ''}
<h3>Checklist:</h3>
<ul>
<li>Be ready 15 minutes early</li>
<li>Clear pathways for access</li>
<li>Boxes packed and labeled</li>
</ul>
<p>Questions? Call <a href="tel:${companySettings.companyPhone.replace(/[^0-9]/g, '')}">${companySettings.companyPhone}</a></p>
        `;

        await transporter.sendMail({
            from: `"${companySettings.companyName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || companySettings.companyEmail}>`,
            to,
            cc: companySettings.ccEmails.length > 0 ? companySettings.ccEmails.join(',') : getCCList(),
            subject: `⏰ Reminder: Your move is tomorrow - Arrival window ${formatTimeWindow(time)}`,
            html: htmlContent
        });

        return true;
    } catch (error) {
        console.error('Error sending reminder:', error);
        throw error;
    }
}

/**
 * Send crew time-off notification to management
 */
async function sendCrewTimeOffNotification(details) {
    try {
        const {
            requestId,
            crewName,
            crewEmail,
            crewPhone,
            crew,
            requestType,
            startDate,
            endDate,
            daysCount,
            reason
        } = details;

        const transporter = initializeTransporter('Worry Free Moving');
        if (!transporter) return null;

        const formattedStartDate = formatDateET(startDate, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const formattedEndDate = formatDateET(endDate, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Get crew display name
        const crewDisplay = crew === 'crew-a' ? 'Crew A (Darrel\'s Team)' :
                           crew === 'crew-b' ? 'Crew B (Zack\'s Team)' :
                           crew === 'crew-c' ? 'Crew C (Quality Moving)' : crew;

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .request-details { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #c92a2a; }
        .action-buttons { text-align: center; margin: 30px 0; }
        .button { display: inline-block; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 10px 5px; font-weight: 600; }
        .approve-btn { background: #51cf66; color: white; }
        .deny-btn { background: #ff6b6b; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗓️ New Time-Off Request</h1>
            <p>Crew member requesting time off</p>
        </div>
        <div class="content">
            <p><strong>A crew member has submitted a time-off request that requires your approval.</strong></p>

            <div class="request-details">
                <h2 style="color: #c92a2a; margin-top: 0;">Request Details</h2>
                <div class="detail-row">
                    <span class="label">Request ID:</span> ${requestId}
                </div>
                <div class="detail-row">
                    <span class="label">Crew Member:</span> ${crewName}
                </div>
                <div class="detail-row">
                    <span class="label">Email:</span> <a href="mailto:${crewEmail}">${crewEmail}</a>
                </div>
                <div class="detail-row">
                    <span class="label">Phone:</span> <a href="tel:${crewPhone}">${crewPhone}</a>
                </div>
                <div class="detail-row">
                    <span class="label">Team:</span> ${crewDisplay}
                </div>
                <div class="detail-row">
                    <span class="label">Request Type:</span> ${requestType.charAt(0).toUpperCase() + requestType.slice(1)}
                </div>
                <div class="detail-row">
                    <span class="label">Start Date:</span> ${formattedStartDate}
                </div>
                <div class="detail-row">
                    <span class="label">End Date:</span> ${formattedEndDate}
                </div>
                <div class="detail-row">
                    <span class="label">Total Days:</span> ${daysCount} day(s)
                </div>
                ${reason ? `
                <div class="detail-row">
                    <span class="label">Reason:</span><br>
                    <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        ${reason}
                    </div>
                </div>
                ` : ''}
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <strong>⚠️ Action Required:</strong> Please review this request and approve or deny it as soon as possible.
            </div>

            <p style="text-align: center; color: #666;">
                Log in to the admin portal to approve or deny this request.
            </p>
        </div>
    </div>
</body>
</html>
        `;

        await transporter.sendMail({
            from: `"Crew Portal" <${process.env.EMAIL_USER}>`,
            to: process.env.COMPANY_EMAIL || 'service@worryfreemovers.com',
            cc: getCCList(),
            subject: `🗓️ Time-Off Request: ${crewName} - ${formattedStartDate}`,
            html: htmlContent
        });

        return true;
    } catch (error) {
        console.error('Error sending crew time-off notification:', error);
        throw error;
    }
}

/**
 * Send crew time-off confirmation to crew member
 */
async function sendCrewTimeOffConfirmation(details) {
    try {
        const { to, crewName, requestId, crew, requestType, startDate, endDate, daysCount } = details;

        const transporter = initializeTransporter('Worry Free Moving');
        if (!transporter) return null;

        const formattedStartDate = formatDateET(startDate, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const formattedEndDate = formatDateET(endDate, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .summary-box { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Request Received</h1>
        </div>
        <div class="content">
            <p>Hi ${crewName},</p>
            <p>Your time-off request has been successfully submitted and is pending management approval.</p>

            <div class="summary-box">
                <h3 style="margin-top: 0;">Request Summary:</h3>
                <p><strong>Request ID:</strong> ${requestId}</p>
                <p><strong>Type:</strong> ${requestType.charAt(0).toUpperCase() + requestType.slice(1)}</p>
                <p><strong>Start Date:</strong> ${formattedStartDate}</p>
                <p><strong>End Date:</strong> ${formattedEndDate}</p>
                <p><strong>Total Days:</strong> ${daysCount} day(s)</p>
                <p><strong>Status:</strong> <span style="color: #ffc107; font-weight: 600;">Pending Approval</span></p>
            </div>

            <div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0;">
                <strong>📧 What's Next:</strong> You will receive an email notification once your request is approved or denied. This typically takes 24-48 hours.
            </div>

            <p>Questions? Contact your supervisor or call the office at 330-435-8686.</p>

            <p style="margin-top: 30px;">Thank you,<br><strong>Worry Free Moving</strong></p>
        </div>
    </div>
</body>
</html>
        `;

        await transporter.sendMail({
            from: `"Worry Free Moving" <${process.env.EMAIL_USER}>`,
            to,
            subject: `Time-Off Request Received - ${formattedStartDate}`,
            html: htmlContent
        });

        return true;
    } catch (error) {
        console.error('Error sending crew confirmation:', error);
        throw error;
    }
}

/**
 * Send crew time-off response (approval/denial)
 */
async function sendCrewTimeOffResponse(details) {
    try {
        const transporter = initializeTransporter(company);
        if (!transporter) return null;

        const { to, crewName, requestId, status, startDate, endDate, daysCount, responseNote } = details;

        const formattedStartDate = formatDateET(startDate, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const formattedEndDate = formatDateET(endDate, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const isApproved = status === 'approved';
        const statusColor = isApproved ? '#51cf66' : '#ff6b6b';
        const statusIcon = isApproved ? '✅' : '❌';
        const statusText = isApproved ? 'APPROVED' : 'DENIED';

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColor}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .status-box { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid ${statusColor}; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${statusIcon} Request ${statusText}</h1>
        </div>
        <div class="content">
            <p>Hi ${crewName},</p>
            <p>Your time-off request has been <strong style="color: ${statusColor};">${statusText}</strong>.</p>

            <div class="status-box">
                <h3 style="margin-top: 0;">Request Details:</h3>
                <p><strong>Request ID:</strong> ${requestId}</p>
                <p><strong>Start Date:</strong> ${formattedStartDate}</p>
                <p><strong>End Date:</strong> ${formattedEndDate}</p>
                <p><strong>Total Days:</strong> ${daysCount} day(s)</p>
                <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span></p>
            </div>

            ${responseNote ? `
            <div style="background: #e7f5ff; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <strong>📝 Note from Management:</strong><br>
                <p style="margin: 10px 0 0 0;">${responseNote}</p>
            </div>
            ` : ''}

            ${isApproved ? `
            <div style="background: #d4edda; border-left: 4px solid #51cf66; padding: 15px; margin: 20px 0;">
                <strong>✅ Your time-off has been approved!</strong><br>
                Please coordinate with your team to ensure coverage during your absence.
            </div>
            ` : `
            <div style="background: #f8d7da; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0;">
                <strong>❌ Unfortunately, your request could not be approved at this time.</strong><br>
                If you have questions, please speak with your supervisor.
            </div>
            `}

            <p>Questions? Contact your supervisor or call the office at 330-435-8686.</p>

            <p style="margin-top: 30px;">Thank you,<br><strong>Worry Free Moving Management</strong></p>
        </div>
    </div>
</body>
</html>
        `;

        await transporter.sendMail({
            from: `"Worry Free Moving" <${process.env.EMAIL_USER}>`,
            to,
            subject: `Time-Off Request ${statusText} - ${formattedStartDate}`,
            html: htmlContent
        });

        return true;
    } catch (error) {
        console.error('Error sending crew response email:', error);
        throw error;
    }
}

/**
 * Send estimate email to customer
 */
async function sendEstimateEmail(details) {
    try {
        const {
            to,
            customerName,
            estimate,
            serviceType,
            pickupAddress,
            dropoffAddress,
            date,
            time,
            distance,
            company
        } = details;

        // Load company-specific settings
        const companySettings = await loadCompanySettings(company || 'Worry Free Moving');

        const transporter = initializeTransporter(company || 'Worry Free Moving');
        if (!transporter) {
            console.warn('Email service not configured. Skipping estimate email.');
            return null;
        }

        // Format date if provided
        let formattedDate = '';
        if (date) {
            const [year, month, day] = date.split('-');
            const localDate = new Date(year, month - 1, day);
            formattedDate = localDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Format time if provided
        let formattedTime = '';
        if (time) {
            formattedTime = formatTimeWindow(time);
        }

        // Format money
        const formatMoney = (amount) => {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2
            }).format(amount);
        };

        // Email HTML template
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }
        .estimate-box {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .detail-row {
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: 600;
            color: #667eea;
        }
        .total-row {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            margin-top: 15px;
            font-size: 18px;
            font-weight: 700;
            text-align: center;
        }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 14px 30px;
            text-decoration: none;
            border-radius: 25px;
            margin: 10px 5px;
            font-weight: 600;
        }
        .info-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💰 Your Moving Estimate</h1>
            <p>From ${companySettings.companyName}</p>
        </div>
        <div class="content">
            <p>Hi ${customerName},</p>
            <p>Thank you for requesting an estimate! Here's a detailed breakdown of your moving costs:</p>

            <div class="estimate-box">
                <h2 style="color: #667eea; margin-top: 0;">Service Details</h2>
                ${serviceType ? `
                <div class="detail-row">
                    <span class="label">Service Type:</span>
                    <span>${serviceType}</span>
                </div>
                ` : ''}
                ${pickupAddress ? `
                <div class="detail-row">
                    <span class="label">Pickup Location:</span>
                    <span>${pickupAddress}</span>
                </div>
                ` : ''}
                ${dropoffAddress ? `
                <div class="detail-row">
                    <span class="label">Delivery Location:</span>
                    <span>${dropoffAddress}</span>
                </div>
                ` : ''}
                ${distance ? `
                <div class="detail-row">
                    <span class="label">Distance:</span>
                    <span>${distance} miles</span>
                </div>
                ` : ''}
                ${formattedDate ? `
                <div class="detail-row">
                    <span class="label">Preferred Date:</span>
                    <span>${formattedDate}</span>
                </div>
                ` : ''}
                ${formattedTime ? `
                <div class="detail-row">
                    <span class="label">Preferred Time:</span>
                    <span>${formattedTime}</span>
                </div>
                ` : ''}
            </div>

            <div class="estimate-box">
                <h2 style="color: #667eea; margin-top: 0;">Cost Breakdown</h2>
                ${estimate.laborCost > 0 ? `
                <div class="detail-row">
                    <span class="label">Labor:</span>
                    <span>${formatMoney(estimate.laborCost)}</span>
                </div>
                ` : ''}
                ${estimate.travelFee > 0 ? `
                <div class="detail-row">
                    <span class="label">Travel Fee:</span>
                    <span>${formatMoney(estimate.travelFee)}</span>
                </div>
                ` : ''}
                ${estimate.stairsFee > 0 ? `
                <div class="detail-row">
                    <span class="label">Stairs Fee:</span>
                    <span>${formatMoney(estimate.stairsFee)}</span>
                </div>
                ` : ''}
                ${estimate.heavyItems > 0 ? `
                <div class="detail-row">
                    <span class="label">Heavy Items:</span>
                    <span>${formatMoney(estimate.heavyItems)}</span>
                </div>
                ` : ''}
                ${estimate.additionalServices > 0 ? `
                <div class="detail-row">
                    <span class="label">Additional Services:</span>
                    <span>${formatMoney(estimate.additionalServices)}</span>
                </div>
                ` : ''}
                ${estimate.packingMaterials > 0 ? `
                <div class="detail-row">
                    <span class="label">Packing Materials:</span>
                    <span>${formatMoney(estimate.packingMaterials)}</span>
                </div>
                ` : ''}
                ${estimate.fvpInsurance > 0 ? `
                <div class="detail-row">
                    <span class="label">FVP Insurance:</span>
                    <span>${formatMoney(estimate.fvpInsurance)}</span>
                </div>
                ` : ''}
                ${estimate.serviceCharge > 0 ? `
                <div class="detail-row">
                    <span class="label">Service Charge:</span>
                    <span>${formatMoney(estimate.serviceCharge)}</span>
                </div>
                ` : ''}

                <div class="total-row">
                    ESTIMATED TOTAL: ${formatMoney(estimate.total)}
                </div>
            </div>

            <div class="info-box">
                <strong>💡 Important Information:</strong>
                <ul style="margin: 10px 0;">
                    <li>This is an estimate based on the information provided</li>
                    <li>Final cost may vary based on actual time and services needed</li>
                    <li>All estimates are valid for 30 days</li>
                    ${estimate.estimatedTime ? `<li>Estimated time: ${estimate.estimatedTime} hours</li>` : ''}
                </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <p><strong>Ready to book your move?</strong></p>
                <a href="tel:${companySettings.companyPhone.replace(/[^0-9]/g, '')}"
                   class="button"
                   style="background: #51cf66; color: white;">
                    📞 Call ${companySettings.companyPhone}
                </a>
                <a href="https://${companySettings.companyWebsite || 'worryfreemovers.com'}"
                   class="button"
                   target="_blank">
                    🌐 Book Online
                </a>
            </div>

            <h3 style="color: #667eea;">Why Choose ${companySettings.companyName}?</h3>
            <ul>
                <li>✅ Licensed and Insured</li>
                <li>✅ Professional Crew</li>
                <li>✅ Transparent Pricing</li>
                <li>✅ 5-Star Customer Service</li>
                <li>✅ Modern Equipment</li>
            </ul>

            <p><strong>Questions?</strong> Feel free to contact us:</p>
            <p>
                📞 <a href="tel:${companySettings.companyPhone.replace(/[^0-9]/g, '')}">${companySettings.companyPhone}</a><br>
                📧 <a href="mailto:${companySettings.companyEmail}">${companySettings.companyEmail}</a><br>
                ${companySettings.companyWebsite ? `🌐 <a href="https://${companySettings.companyWebsite}" target="_blank">${companySettings.companyWebsite}</a>` : ''}
            </p>
        </div>

        <div class="footer">
            <p><strong>${companySettings.companyName}</strong></p>
            <p>${companySettings.companyPhone} | ${companySettings.companyEmail}</p>
            ${companySettings.companyWebsite ? `<p><a href="https://${companySettings.companyWebsite}" target="_blank">${companySettings.companyWebsite}</a></p>` : ''}
            <p style="font-size: 12px; color: #999; margin-top: 20px;">
                This estimate was generated by our automated quoting system. For the most accurate pricing, please call us directly.
            </p>
        </div>
    </div>
</body>
</html>
        `;

        // Plain text version
        const textContent = `
Your Moving Estimate - ${companySettings.companyName}

Hi ${customerName},

Thank you for requesting an estimate!

Service Details:
${serviceType ? `Service: ${serviceType}` : ''}
${pickupAddress ? `Pickup: ${pickupAddress}` : ''}
${dropoffAddress ? `Delivery: ${dropoffAddress}` : ''}
${distance ? `Distance: ${distance} miles` : ''}

Cost Breakdown:
${estimate.laborCost > 0 ? `Labor: ${formatMoney(estimate.laborCost)}` : ''}
${estimate.travelFee > 0 ? `Travel Fee: ${formatMoney(estimate.travelFee)}` : ''}
${estimate.stairsFee > 0 ? `Stairs Fee: ${formatMoney(estimate.stairsFee)}` : ''}
${estimate.heavyItems > 0 ? `Heavy Items: ${formatMoney(estimate.heavyItems)}` : ''}
${estimate.serviceCharge > 0 ? `Service Charge: ${formatMoney(estimate.serviceCharge)}` : ''}

ESTIMATED TOTAL: ${formatMoney(estimate.total)}

This is an estimate based on the information provided. Final cost may vary.

Ready to book? Call us at ${companySettings.companyPhone}

Thank you,
${companySettings.companyName}
        `;

        // Send email
        const info = await transporter.sendMail({
            from: `"${companySettings.companyName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || companySettings.companyEmail}>`,
            to,
            cc: companySettings.ccEmails.length > 0 ? companySettings.ccEmails.join(',') : getCCList(),
            bcc: process.env.COMPANY_EMAIL || companySettings.companyEmail,
            subject: `Your ${companySettings.companyName} Estimate - ${formatMoney(estimate.total)}`,
            text: textContent,
            html: htmlContent
        });

        console.log('Estimate email sent:', info.messageId);
        return info;

    } catch (error) {
        console.error('Error sending estimate email:', error);
        throw error;
    }
}

/**
 * Send Employee Password Reset Email
 */
async function sendEmployeePasswordResetEmail(details) {
    try {
        const {
            employeeName,
            email,
            temporaryPassword,
            username
        } = details;

        const companySettings = await loadCompanySettings('Worry Free Moving');
        const transporter = initializeTransporter('Worry Free Moving');

        if (!transporter) {
            console.warn('Email service not configured. Skipping password reset email.');
            return null;
        }

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .password-box { background: #f8f9fa; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px; }
                .password { font-size: 24px; font-weight: bold; color: #28a745; font-family: 'Courier New', monospace; letter-spacing: 2px; }
                .info-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
                .button { display: inline-block; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔑 Password Reset</h1>
                    <p>Your temporary password is ready</p>
                </div>
                <div class="content">
                    <h2>Hi ${employeeName},</h2>
                    <p>Your administrator has reset your employee portal password. You can use the temporary password below to login.</p>

                    <div class="password-box">
                        <p style="margin: 0; font-size: 14px; color: #666;">Your Temporary Password:</p>
                        <p class="password">${temporaryPassword}</p>
                    </div>

                    <div class="info-box">
                        <p style="margin: 0;"><strong>⚠️ Important Security Information:</strong></p>
                        <ul style="margin: 10px 0 0 20px;">
                            <li>This is a temporary password</li>
                            <li>Please change it immediately after logging in</li>
                            <li>Go to "Change Password" section in your portal</li>
                            <li>Choose a strong, unique password</li>
                        </ul>
                    </div>

                    <p><strong>Login Instructions:</strong></p>
                    <ol>
                        <li>Go to the employee portal</li>
                        <li>Username: <strong>${username}</strong></li>
                        <li>Password: Use the temporary password above</li>
                        <li>Click "Change Password" after logging in</li>
                    </ol>

                    <center>
                        <a href="${process.env.BASE_URL || 'http://localhost:3001'}/employee-portal.html" class="button">
                            🔐 Go to Employee Portal
                        </a>
                    </center>

                    <p style="margin-top: 30px; color: #666;">If you did not request this password reset, please contact your administrator immediately.</p>
                </div>
                <div class="footer">
                    <p>${companySettings.companyName}</p>
                    <p>${companySettings.companyPhone} | ${companySettings.companyEmail}</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const info = await transporter.sendMail({
            from: `"${companySettings.companyName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || companySettings.companyEmail}>`,
            to: email,
            subject: `Password Reset - ${companySettings.companyName} Employee Portal`,
            html: htmlContent
        });

        console.log(`✅ Employee password reset email sent to: ${email} (${employeeName})`);
        return info;

    } catch (error) {
        console.error('Error sending employee password reset email:', error);
        throw error;
    }
}

/**
 * Send welcome email to new authorized user (admin portal access)
 */
async function sendAdminUserWelcomeEmail({ email, username, password, name }) {
    try {
        // Load company settings
        const companySettings = await loadCompanySettings('Worry Free Moving');

        const transporter = await initializeTransporter();

        const adminPortalUrl = process.env.NODE_ENV === 'production'
            ? 'https://worry-free-booking.onrender.com/admin-portal.html'
            : 'http://localhost:3001/admin-portal.html';

        const mailOptions = {
            from: `"${companySettings.companyName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || companySettings.companyEmail}>`,
            to: email,
            subject: `Welcome to ${companySettings.companyName} Admin Portal`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .credentials-box { background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 5px; }
                        .login-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; color: #856404; }
                        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0;">🎉 Welcome to ${companySettings.companyName}!</h1>
                            <p style="margin: 10px 0 0 0;">Admin Portal Access Created</p>
                        </div>
                        <div class="content">
                            <p>Hi ${name || 'there'},</p>

                            <p>Your administrator account has been created for the ${companySettings.companyName} Admin Portal. You now have access to manage bookings, customers, employees, and system settings.</p>

                            <div class="credentials-box">
                                <h3 style="margin-top: 0; color: #667eea;">📋 Your Login Credentials</h3>
                                <p style="margin: 10px 0;"><strong>Username:</strong> ${username}</p>
                                <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px; font-size: 16px;">${password}</code></p>
                                <p style="margin: 10px 0;"><strong>Portal URL:</strong> <a href="${adminPortalUrl}">${adminPortalUrl}</a></p>
                            </div>

                            <div style="text-align: center;">
                                <a href="${adminPortalUrl}" class="login-button">🔐 Login to Admin Portal</a>
                            </div>

                            <div class="warning">
                                <strong>⚠️ Security Notice:</strong>
                                <ul style="margin: 10px 0;">
                                    <li>This is a temporary password - please change it after your first login</li>
                                    <li>Never share your login credentials with anyone</li>
                                    <li>Keep this email secure or delete it after changing your password</li>
                                </ul>
                            </div>

                            <h3>🚀 Getting Started:</h3>
                            <ol>
                                <li>Click the login button above or visit the portal URL</li>
                                <li>Enter your username and temporary password</li>
                                <li>You'll be prompted to change your password on first login</li>
                                <li>Explore the admin dashboard and familiarize yourself with the features</li>
                            </ol>

                            <p>If you have any questions or need assistance, please contact us:</p>
                            <p>
                                📞 Phone: ${companySettings.companyPhone}<br>
                                📧 Email: ${companySettings.companyEmail}
                            </p>
                        </div>
                        <div class="footer">
                            <p>${companySettings.companyName}<br>
                            ${companySettings.companyAddress || ''}<br>
                            ${companySettings.companyPhone} | ${companySettings.companyEmail}</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Admin user welcome email sent to: ${email} (${username})`);
        return info;

    } catch (error) {
        console.error('Error sending admin user welcome email:', error);
        throw error;
    }
}

/**
 * Send welcome email to new employee (employee portal access)
 */
async function sendEmployeeWelcomeEmail({ email, username, password, firstName, lastName, role }) {
    try {
        // Load company settings
        const companySettings = await loadCompanySettings('Worry Free Moving');

        const transporter = await initializeTransporter();

        const employeePortalUrl = process.env.NODE_ENV === 'production'
            ? 'https://worry-free-booking.onrender.com/employee-portal.html'
            : 'http://localhost:3001/employee-portal.html';

        const fullName = `${firstName} ${lastName}`;

        const mailOptions = {
            from: `"${companySettings.companyName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || companySettings.companyEmail}>`,
            to: email,
            subject: `Welcome to ${companySettings.companyName} - Employee Portal Access`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .credentials-box { background: white; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px; }
                        .login-button { display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; color: #856404; }
                        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin: 0;">👷 Welcome to the Team!</h1>
                            <p style="margin: 10px 0 0 0;">${companySettings.companyName}</p>
                        </div>
                        <div class="content">
                            <p>Hi ${firstName},</p>

                            <p>Welcome to ${companySettings.companyName}! We're excited to have you on the team as our new <strong>${role || 'team member'}</strong>.</p>

                            <p>Your employee portal account has been created. You can use the portal to:</p>
                            <ul>
                                <li>📅 Request time off</li>
                                <li>📋 View your schedule</li>
                                <li>🔑 Update your password</li>
                                <li>📧 Communicate with the team</li>
                            </ul>

                            <div class="credentials-box">
                                <h3 style="margin-top: 0; color: #28a745;">📋 Your Login Credentials</h3>
                                <p style="margin: 10px 0;"><strong>Username:</strong> ${username}</p>
                                <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px; font-size: 16px;">${password}</code></p>
                                <p style="margin: 10px 0;"><strong>Portal URL:</strong> <a href="${employeePortalUrl}">${employeePortalUrl}</a></p>
                            </div>

                            <div style="text-align: center;">
                                <a href="${employeePortalUrl}" class="login-button">🔐 Login to Employee Portal</a>
                            </div>

                            <div class="warning">
                                <strong>⚠️ Security Notice:</strong>
                                <ul style="margin: 10px 0;">
                                    <li>This is a temporary password - please change it after your first login</li>
                                    <li>Never share your login credentials with anyone</li>
                                    <li>Keep this email secure or delete it after changing your password</li>
                                </ul>
                            </div>

                            <h3>🚀 Getting Started:</h3>
                            <ol>
                                <li>Click the login button above or visit the portal URL</li>
                                <li>Enter your username and temporary password</li>
                                <li>Change your password to something secure and memorable</li>
                                <li>Complete your profile if needed</li>
                            </ol>

                            <p>If you have any questions or need assistance, please contact us:</p>
                            <p>
                                📞 Phone: ${companySettings.companyPhone}<br>
                                📧 Email: ${companySettings.companyEmail}
                            </p>

                            <p>We're glad to have you on board!</p>
                        </div>
                        <div class="footer">
                            <p>${companySettings.companyName}<br>
                            ${companySettings.companyAddress || ''}<br>
                            ${companySettings.companyPhone} | ${companySettings.companyEmail}</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Employee welcome email sent to: ${email} (${fullName})`);
        return info;

    } catch (error) {
        console.error('Error sending employee welcome email:', error);
        throw error;
    }
}

/**
 * Send contact form submission email
 */
async function sendContactFormEmail(data) {
    try {
        const { name, email, phone, service, location, movedate, message, urgent } = data;

        const companySettings = await loadCompanySettings('Worry Free Moving');

        const transporter = initializeTransporter('Worry Free Moving');
        if (!transporter) {
            console.error('❌ No email transporter configured for contact form');
            return false;
        }

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
                    ${urgent ? '🔴 URGENT: ' : '📬 '}New Contact Form Submission
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 10px; font-weight: bold; background: #f8fafc; width: 140px;">Name:</td><td style="padding: 10px;">${name}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold; background: #f8fafc;">Email:</td><td style="padding: 10px;"><a href="mailto:${email}">${email}</a></td></tr>
                    <tr><td style="padding: 10px; font-weight: bold; background: #f8fafc;">Phone:</td><td style="padding: 10px;"><a href="tel:${phone}">${phone}</a></td></tr>
                    <tr><td style="padding: 10px; font-weight: bold; background: #f8fafc;">Service:</td><td style="padding: 10px;">${service}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold; background: #f8fafc;">Location:</td><td style="padding: 10px;">${location}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold; background: #f8fafc;">Move Date:</td><td style="padding: 10px;">${movedate}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold; background: #f8fafc;">Urgent:</td><td style="padding: 10px;">${urgent ? '⚠️ YES - Within 7 days' : 'No'}</td></tr>
                </table>
                <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6;">
                    <strong>Message:</strong><br><br>
                    ${message.replace(/\n/g, '<br>')}
                </div>
                <div style="margin-top: 20px; padding: 10px; background: #e8f4e8; border-radius: 8px; font-size: 12px; color: #666;">
                    ✅ This message passed server-side spam verification
                </div>
            </div>
        `;

        const mailOptions = {
            from: `"Worry Free Moving" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: 'service@worryfreemovers.com',
            cc: getCCList() || '',
            replyTo: email,
            subject: `${urgent ? '🔴 URGENT: ' : ''}Contact Form - ${name} - ${service}`,
            html: htmlContent,
            text: `New contact from ${name} (${email}, ${phone})\nService: ${service}\nLocation: ${location}\nMove Date: ${movedate}\nUrgent: ${urgent ? 'Yes' : 'No'}\n\nMessage:\n${message}`
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Contact form email sent to service@worryfreemovers.com for ${name}`);
        return true;

    } catch (error) {
        console.error('❌ Error sending contact form email:', error);
        return false;
    }
}

module.exports = {
    sendConfirmationEmail,
    sendCancellationEmail,
    sendRescheduleEmail,
    sendCompanyNotification,
    send24HourReminder,
    sendEstimateEmail,
    sendCrewTimeOffNotification,
    sendCrewTimeOffConfirmation,
    sendCrewTimeOffResponse,
    sendEmployeePasswordResetEmail,
    sendAdminUserWelcomeEmail,
    sendEmployeeWelcomeEmail,
    sendContactFormEmail
};
