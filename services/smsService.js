/**
 * SMS Service using RingCentral API
 * Sends text confirmations for bookings, reschedules, and cancellations
 * Supports multi-company messaging (Worry Free Moving & Quality Moving)
 */

const https = require('https');
const { formatTimeWindow } = require('../utils/helpers');
const { getCompany, getCompanyInfo, determineCompany } = require('../utils/companyConfig');

// Token cache to avoid repeated auth requests
let tokenCache = {
    accessToken: null,
    expiresAt: null
};

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
 * Uses token caching to avoid repeated auth requests
 */
async function getRingCentralToken() {
    // Check if we have a valid cached token (with 5 minute buffer before expiry)
    const now = Date.now();
    if (tokenCache.accessToken && tokenCache.expiresAt && tokenCache.expiresAt > now + (5 * 60 * 1000)) {
        console.log('✅ Using cached RingCentral token (expires in', Math.round((tokenCache.expiresAt - now) / 60000), 'minutes)');
        return tokenCache.accessToken;
    }

    console.log('🔄 Requesting new RingCentral access token...');

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

                    // Cache the token with expiration (typically 3600 seconds = 1 hour)
                    const expiresIn = response.expires_in || 3600; // Default to 1 hour
                    tokenCache.accessToken = response.access_token;
                    tokenCache.expiresAt = Date.now() + (expiresIn * 1000);

                    console.log('✅ RingCentral auth successful (token valid for', Math.round(expiresIn / 60), 'minutes)');
                    resolve(response.access_token);
                } else {
                    // Parse error response for detailed logging
                    let errorDetails = data;
                    try {
                        const errorJson = JSON.parse(data);
                        errorDetails = JSON.stringify(errorJson, null, 2);
                    } catch (e) {
                        // data is not JSON, use as-is
                    }

                    console.error('❌ RingCentral Auth Error:', {
                        statusCode: res.statusCode,
                        error: errorDetails,
                        hint: res.statusCode === 400 ? 'JWT token may be expired. Regenerate at https://developers.ringcentral.com/my-account.html' : ''
                    });
                    reject(new Error(`Auth failed: ${res.statusCode} - ${errorDetails}`));
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
        const timeWindow = time ? formatTimeWindow(time) : 'All day';

        // Generate Google Calendar link (only for appointments with specific times)
        let calendarUrl = '';
        if (time && time.trim() !== '') {
            const calendarEventDetails = {
                summary: `${serviceType || 'Appointment'} - ${companyDisplayName}`,
                location: pickupAddress || '',
                start: `${date}T${time}:00`,
                end: `${date}T${time}:00`
            };
            calendarUrl = generateGoogleCalendarUrl(calendarEventDetails);
        }

        switch (type) {
            case 'booking':
                if (calendarUrl) {
                    message = `Hi ${customerName}! Your appointment with ${companyDisplayName} is confirmed for ${formattedDate}. Arrival window: ${timeWindow}. Add to calendar: ${calendarUrl} We'll call 24hrs before. Questions? Call ${companyPhone}`;
                } else {
                    message = `Hi ${customerName}! Your request with ${companyDisplayName} for ${formattedDate} has been received and is pending approval. You'll receive confirmation soon. Questions? Call ${companyPhone}`;
                }
                break;

            case 'reschedule':
                if (calendarUrl) {
                    message = `Hi ${customerName}! Your appointment has been rescheduled to ${formattedDate}. Arrival window: ${timeWindow}. Add to calendar: ${calendarUrl} We'll call 24hrs before. Call ${companyPhone} for questions.`;
                } else {
                    message = `Hi ${customerName}! Your request has been rescheduled to ${formattedDate}. Call ${companyPhone} for questions.`;
                }
                break;

            case 'cancellation':
                if (time) {
                    message = `Hi ${customerName}, your appointment scheduled for ${formattedDate} (${timeWindow}) has been cancelled. Need to reschedule? Call ${companyPhone}`;
                } else {
                    message = `Hi ${customerName}, your request for ${formattedDate} has been cancelled. Need to reschedule? Call ${companyPhone}`;
                }
                break;

            case 'reminder':
                if (calendarUrl) {
                    message = `Reminder: Your ${companyDisplayName} appointment is tomorrow ${formattedDate}. Arrival window: ${timeWindow}. Add to calendar: ${calendarUrl} Please be ready 15 mins early. Call ${companyPhone} if you have questions.`;
                } else {
                    message = `Reminder: Your ${companyDisplayName} request for ${formattedDate} is being processed. Call ${companyPhone} if you have questions.`;
                }
                break;

            case '2hour-reminder':
                message = `REMINDER: Your ${companyDisplayName} appointment is TODAY! Arrival window: ${timeWindow}. Please ensure everything is ready. We're on our way! Questions? Call ${companyPhone}`;
                break;

            case 'timeoff-response':
                // For time off approval/denial responses
                // serviceType contains the status emoji and text
                // pickupAddress contains the details
                message = `Hi ${customerName}! ${serviceType}. ${pickupAddress}. Questions? Call ${companyPhone}`;
                break;

            default:
                if (calendarUrl) {
                    message = `Hi ${customerName}! Appointment update for ${formattedDate}. Arrival window: ${timeWindow}. Call ${companyPhone} for details.`;
                } else {
                    message = `Hi ${customerName}! Request update for ${formattedDate}. Call ${companyPhone} for details.`;
                }
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
