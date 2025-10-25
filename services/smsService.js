/**
 * SMS Service using RingCentral API
 * Sends text confirmations for bookings, reschedules, and cancellations
 * Supports multi-company messaging (Worry Free Moving & Quality Moving)
 */

const https = require('https');
const { formatTimeWindow } = require('../utils/helpers');
const { getCompany, getCompanyInfo, determineCompany } = require('../utils/companyConfig');

/**
 * Send SMS via RingCentral API
 * @param {string} to - Phone number to send to
 * @param {string} message - Message text
 */
async function sendSMS(to, message) {
    // Check if RingCentral is configured
    if (!process.env.RINGCENTRAL_CLIENT_ID ||
        !process.env.RINGCENTRAL_CLIENT_SECRET ||
        !process.env.RINGCENTRAL_FROM_NUMBER) {
        console.warn('RingCentral not configured. Skipping SMS.');
        return null;
    }

    try {
        // Get access token
        const accessToken = await getRingCentralToken();

        // Format phone number (remove non-digits)
        const formattedPhone = formatPhoneForSMS(to);

        // Prepare SMS data
        const smsData = JSON.stringify({
            from: { phoneNumber: process.env.RINGCENTRAL_FROM_NUMBER },
            to: [{ phoneNumber: formattedPhone }],
            text: message
        });

        // Make API request
        // Strip https:// from server URL if present
        const serverUrl = (process.env.RINGCENTRAL_SERVER || 'platform.ringcentral.com').replace(/^https?:\/\//, '');

        const options = {
            hostname: serverUrl,
            path: '/restapi/v1.0/account/~/extension/~/sms',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Content-Length': Buffer.byteLength(smsData)
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        console.log('SMS sent successfully to', formattedPhone);
                        resolve(JSON.parse(data));
                    } else {
                        console.error('Failed to send SMS:', res.statusCode, data);
                        reject(new Error(`SMS failed: ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Error sending SMS:', error);
                reject(error);
            });

            req.write(smsData);
            req.end();
        });

    } catch (error) {
        console.error('SMS Service Error:', error);
        throw error;
    }
}

/**
 * Get RingCentral access token using Personal JWT Flow
 * As per RingCentral docs: https://developers.ringcentral.com/api-reference/Get-Token
 */
async function getRingCentralToken() {
    return new Promise((resolve, reject) => {
        // Personal JWT Flow - use Basic auth with client credentials
        const authString = Buffer.from(
            `${process.env.RINGCENTRAL_CLIENT_ID}:${process.env.RINGCENTRAL_CLIENT_SECRET}`
        ).toString('base64');

        // Personal JWT Flow parameters (Example 3 from RingCentral docs)
        const postData = new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: process.env.RINGCENTRAL_JWT
        }).toString();

        // Strip https:// from server URL if present
        const serverUrl = (process.env.RINGCENTRAL_SERVER || 'platform.ringcentral.com').replace(/^https?:\/\//, '');

        const options = {
            hostname: serverUrl,
            path: '/restapi/oauth/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${authString}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    console.log('RingCentral auth successful');
                    resolve(response.access_token);
                } else {
                    console.error('RingCentral Auth Error:', res.statusCode, data);
                    reject(new Error(`Auth failed: ${res.statusCode}`));
                }
            });
        });

        req.on('error', (error) => {
            console.error('RingCentral Auth Request Error:', error);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Format phone number for SMS (ensure it has country code)
 */
function formatPhoneForSMS(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // If it's 10 digits, add +1 for US
    if (cleaned.length === 10) {
        cleaned = '+1' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }

    return cleaned;
}

/**
 * Format time for display in SMS
 */
function formatTimeForSMS(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Generate Google Calendar URL for SMS
 */
function generateGoogleCalendarUrl(eventDetails) {
    const { summary, location, start, end } = eventDetails;

    const formatDateForGoogle = (dateStr) => {
        return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startFormatted = formatDateForGoogle(start);
    const endFormatted = formatDateForGoogle(end);

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: summary,
        dates: `${startFormatted}/${endFormatted}`,
        location: location || ''
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Send booking confirmation SMS
 * Now supports company-specific messaging for Worry Free Moving vs Quality Moving
 */
async function sendSMSConfirmation(details) {
    try {
        const { phone, customerName, date, time, type, serviceType, companyName, pickupAddress } = details;

        // Determine which company this booking is for
        const company = companyName ?
            getCompany(companyName) :
            getCompanyInfo(serviceType);

        const companyDisplayName = company.name;
        const companyPhone = company.phone;

        let message = '';
        // Format date - parse as local time to avoid timezone issues
        const [year, month, day] = date.split('-');
        const localDate = new Date(year, month - 1, day);
        const formattedDate = localDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const timeWindow = formatTimeWindow(time);

        // Generate Google Calendar link
        const calendarEventDetails = {
            summary: `${serviceType || 'Appointment'} - ${companyDisplayName}`,
            location: pickupAddress || '',
            start: `${date}T${time}:00`,
            end: `${date}T${time}:00`
        };
        const calendarUrl = generateGoogleCalendarUrl(calendarEventDetails);

        switch (type) {
            case 'booking':
                message = `Hi ${customerName}! Your appointment with ${companyDisplayName} is confirmed for ${formattedDate}. Arrival window: ${timeWindow}. Add to calendar: ${calendarUrl} We'll call 24hrs before. Questions? Call ${companyPhone}`;
                break;

            case 'reschedule':
                message = `Hi ${customerName}! Your appointment has been rescheduled to ${formattedDate}. Arrival window: ${timeWindow}. Add to calendar: ${calendarUrl} We'll call 24hrs before. Call ${companyPhone} for questions.`;
                break;

            case 'cancellation':
                message = `Hi ${customerName}, your appointment scheduled for ${formattedDate} (${timeWindow}) has been cancelled. Need to reschedule? Call ${companyPhone}`;
                break;

            case 'reminder':
                message = `Reminder: Your ${companyDisplayName} appointment is tomorrow ${formattedDate}. Arrival window: ${timeWindow}. Add to calendar: ${calendarUrl} Please be ready 15 mins early. Call ${companyPhone} if you have questions.`;
                break;

            case '2hour-reminder':
                message = `REMINDER: Your ${companyDisplayName} appointment is TODAY! Arrival window: ${timeWindow}. Please ensure everything is ready. We're on our way! Questions? Call ${companyPhone}`;
                break;

            default:
                message = `Hi ${customerName}! Appointment update for ${formattedDate}. Arrival window: ${timeWindow}. Call ${companyPhone} for details.`;
        }

        // Send to customer
        const customerResult = await sendSMS(phone, message);

        // Also send notification to business owner (Matt's direct number)
        const businessNotification = `[${companyDisplayName}] ${type.toUpperCase()}: ${customerName} (${phone}) - ${formattedDate} ${timeWindow}. ${pickupAddress || 'No address'}`;
        try {
            await sendSMS('3309842122', businessNotification);
            console.log('📱 Business notification sent to 330-984-2122');
        } catch (error) {
            console.error('Failed to send business SMS notification:', error);
        }

        return customerResult;

    } catch (error) {
        console.error('Error sending SMS confirmation:', error);
        // Don't throw - SMS is optional
        return null;
    }
}

/**
 * Send custom SMS message
 */
async function sendCustomSMS(phone, message) {
    try {
        return await sendSMS(phone, message);
    } catch (error) {
        console.error('Error sending custom SMS:', error);
        return null;
    }
}

module.exports = {
    sendSMS,
    sendSMSConfirmation,
    sendCustomSMS
};
