/**
 * Twilio Smart Voice AI - V4 with Full Claude Intelligence
 * Human-like conversation, accurate pricing, calendar-aware booking
 * Powered by Anthropic's Claude 3.5 Sonnet
 */

const twilio = require('twilio');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { getEventsForDate } = require('./googleCalendar');
const nodemailer = require('nodemailer');
const { sendSMS } = require('./smsService'); // RingCentral SMS

// Initialize Claude (Anthropic)
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Initialize Twilio client for voice calls (NOT SMS - using RingCentral for SMS)
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Conversation state storage
const conversations = new Map();

// Base URL for API calls
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Use Claude AI to intelligently extract information from customer speech
 */
async function extractWithAI(speech, context, expectedInfo) {
    try {
        const prompt = `You are a helpful assistant for Worry Free Moving. Extract structured information from customer speech.

Context: ${context}
Expected information: ${expectedInfo}

Customer said: "${speech}"

Extract the relevant information and return ONLY valid JSON. Be lenient with variations and infer reasonable values.`;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 150,
            temperature: 0.3,
            system: 'You are a data extraction assistant. Return only valid JSON with no markdown formatting. Be helpful and infer reasonable values from messy speech input.',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        // Extract JSON from Claude's response
        let jsonText = response.content[0].text.trim();

        // Remove markdown code blocks if present
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const extracted = JSON.parse(jsonText);
        console.log('🧠 Claude extracted:', extracted);
        return extracted;

    } catch (error) {
        console.error('Claude extraction error:', error);
        return null;
    }
}

/**
 * Generate natural, human-like AI response using Claude
 */
async function generateNaturalResponse(context, intent, conversationHistory = []) {
    try {
        const prompt = `You are Sarah, a friendly and professional receptionist for Worry Free Moving.

Context: ${context}
What you need to do: ${intent}
Conversation history: ${JSON.stringify(conversationHistory)}

Generate a natural, warm, and professional response (1-2 sentences max). Sound human, not robotic.`;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 100,
            temperature: 0.8,
            system: 'You are Sarah, a warm and friendly moving company receptionist. Keep responses SHORT (1-2 sentences), conversational, and helpful. Sound like a real person.',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        return response.content[0].text;
    } catch (error) {
        console.error('Claude response generation error:', error);
        return null; // Will use fallback
    }
}

/**
 * Calculate packing materials based on bedroom count (matches chatbot formula)
 */
function calculatePackingMaterials(bedrooms, servicesConfig) {
    const materials = {
        smallBox: { qty: 6 + (bedrooms * 8), price: servicesConfig.packingMaterials.smallBox.price },
        mediumBox: { qty: 6 + (bedrooms * 6), price: servicesConfig.packingMaterials.mediumBox.price },
        largeBox: { qty: 2 + (bedrooms * 4), price: servicesConfig.packingMaterials.largeBox.price },
        wardrobeBox: { qty: bedrooms * 2, price: servicesConfig.packingMaterials.wardrobeBox.price },
        movingBlanket: { qty: 12 + (bedrooms * 6), price: servicesConfig.packingMaterials.movingBlanket.price },
        packingPaper: { qty: Math.ceil(bedrooms * 0.5), price: servicesConfig.packingMaterials.packingPaper.price },
        packingTape: { qty: Math.ceil(bedrooms * 0.50), price: servicesConfig.packingMaterials.packingTape.price },
        furnitureCover: { qty: Math.ceil(bedrooms * 2), price: servicesConfig.packingMaterials.furnitureCover.price },
        dishpack: { qty: Math.ceil(bedrooms * 0.75), price: servicesConfig.packingMaterials.dishpack.price },
        smallBubbleWrap: { qty: Math.ceil(bedrooms * 0.50), price: servicesConfig.packingMaterials.smallBubbleWrap.price },
        largeBubbleWrap: { qty: Math.ceil(bedrooms * 0.50), price: servicesConfig.packingMaterials.largeBubbleWrap.price }
    };

    let totalCost = 0;
    let itemsList = [];

    // Calculate costs
    Object.keys(materials).forEach(key => {
        const item = materials[key];
        const materialConfig = servicesConfig.packingMaterials[key];
        const cost = item.qty * item.price;
        totalCost += cost;

        if (item.qty > 0) {
            itemsList.push({
                name: materialConfig.name,
                qty: item.qty,
                unitPrice: item.price,
                total: cost
            });
        }
    });

    return {
        items: itemsList,
        total: totalCost
    };
}

/**
 * Send itemized packing materials email to customer (CC company)
 */
async function sendPackingMaterialsEmail(customerEmail, customerName, materialsBreakdown, bookingInfo) {
    try {
        const { sendEmail } = require('./emailService');

        // Build itemized list HTML
        let itemsHtml = '';
        materialsBreakdown.items.forEach(item => {
            itemsHtml += `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.qty}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;"><strong>$${item.total.toFixed(2)}</strong></td>
            </tr>`;
        });

        const emailSubject = `Packing Materials List - ${customerName}`;
        const emailBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #004085 0%, #0056b3 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; }
        .materials-table { width: 100%; background: white; border-radius: 10px; overflow: hidden; margin: 20px 0; }
        .total-row { background: #004085; color: white; font-size: 18px; }
        .note-box { background: #e7f3ff; border-left: 4px solid #004085; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .customize-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Your Packing Materials List</h1>
            <p>Worry Free Moving</p>
        </div>
        <div class="content">
            <p>Hi ${customerName},</p>
            <p>Thank you for choosing Worry Free Moving! Below is your itemized packing materials list based on your ${bookingInfo.bedrooms}-bedroom move.</p>

            <table class="materials-table" cellspacing="0" cellpadding="0">
                <thead>
                    <tr style="background: #004085; color: white;">
                        <th style="padding: 15px; text-align: left;">Item</th>
                        <th style="padding: 15px; text-align: center;">Quantity</th>
                        <th style="padding: 15px; text-align: right;">Unit Price</th>
                        <th style="padding: 15px; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                    <tr class="total-row">
                        <td colspan="3" style="padding: 15px; text-align: right;"><strong>TOTAL:</strong></td>
                        <td style="padding: 15px; text-align: right;"><strong>$${materialsBreakdown.total.toFixed(2)}</strong></td>
                    </tr>
                </tbody>
            </table>

            <div class="customize-box">
                <h3 style="margin-top: 0; color: #856404;">✏️ Want to Customize This List?</h3>
                <p style="margin-bottom: 0; color: #856404;">
                    <strong>Simply reply to this email</strong> with any changes you'd like to make. You can:
                </p>
                <ul style="color: #856404; margin-top: 10px;">
                    <li>Increase or decrease quantities</li>
                    <li>Add items not listed</li>
                    <li>Remove items you don't need</li>
                </ul>
                <p style="color: #856404; margin-bottom: 0;">We'll update your order and send a revised quote!</p>
            </div>

            <div class="note-box">
                <h3 style="margin-top: 0; color: #004085;">📋 What's Included</h3>
                <ul style="margin-bottom: 0; color: #004085;">
                    <li>This is a recommended materials list based on your home size</li>
                    <li>Materials will be delivered before your move date</li>
                    <li>Professional-grade packing supplies</li>
                    <li>All materials are clean and unused</li>
                </ul>
            </div>

            <p><strong>Move Details:</strong></p>
            <ul>
                <li><strong>From:</strong> ${bookingInfo.pickupAddress}</li>
                <li><strong>To:</strong> ${bookingInfo.deliveryAddress}</li>
                <li><strong>Bedrooms:</strong> ${bookingInfo.bedrooms}</li>
            </ul>

            <p>Questions? Call us at <strong>(330) 661-9985</strong> or reply to this email.</p>

            <p>Thanks for choosing Worry Free Moving!</p>
        </div>
    </div>
</body>
</html>`;

        // Send to customer with company CC'd
        await sendEmail(
            customerEmail,
            emailSubject,
            emailBody,
            process.env.EMAIL_CC_LIST // CC company email(s)
        );

        console.log(`✅ Packing materials email sent to ${customerEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending packing materials email:', error);
        return false;
    }
}

/**
 * Calculate distance between addresses using Google Maps API
 */
async function calculateDistanceWithGoogleMaps(pickupAddress, deliveryAddress) {
    try {
        if (!GOOGLE_MAPS_API_KEY) {
            console.warn('Google Maps API key not configured, using estimate');
            return estimateDistance(pickupAddress, deliveryAddress);
        }

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(pickupAddress)}&destinations=${encodeURIComponent(deliveryAddress)}&key=${GOOGLE_MAPS_API_KEY}`;

        const response = await axios.get(url);

        if (response.data.status === 'OK' && response.data.rows[0].elements[0].status === 'OK') {
            const distanceMeters = response.data.rows[0].elements[0].distance.value;
            const durationSeconds = response.data.rows[0].elements[0].duration.value;

            const miles = (distanceMeters / 1609.34).toFixed(1); // Convert meters to miles
            const minutes = Math.round(durationSeconds / 60); // Convert to minutes

            console.log(`📍 Distance calculated: ${miles} miles, ${minutes} minutes`);

            return {
                distance: parseFloat(miles),
                driveTime: minutes
            };
        } else {
            console.warn('Google Maps API returned no results, using estimate');
            return estimateDistance(pickupAddress, deliveryAddress);
        }

    } catch (error) {
        console.error('Google Maps API error:', error.message);
        return estimateDistance(pickupAddress, deliveryAddress);
    }
}

/**
 * Fallback distance estimation
 */
function estimateDistance(pickup, delivery) {
    const pickupLower = pickup.toLowerCase();
    const deliveryLower = delivery.toLowerCase();

    // Same city
    if (pickupLower.includes('canton') && deliveryLower.includes('canton'))
        return { distance: 5, driveTime: 15 };
    if (pickupLower.includes('akron') && deliveryLower.includes('akron'))
        return { distance: 5, driveTime: 15 };

    // Nearby cities
    if ((pickupLower.includes('canton') && deliveryLower.includes('massillon')) ||
        (pickupLower.includes('massillon') && deliveryLower.includes('canton')))
        return { distance: 10, driveTime: 20 };

    if ((pickupLower.includes('canton') && deliveryLower.includes('akron')) ||
        (pickupLower.includes('akron') && deliveryLower.includes('canton')))
        return { distance: 25, driveTime: 35 };

    // Default
    return { distance: 15, driveTime: 25 };
}

/**
 * Check Google Calendar availability for specific time slot
 */
async function checkSlotAvailability(date, timeSlot) {
    try {
        console.log(`📅 Checking Google Calendar availability for ${date} ${timeSlot}`);

        // Get all events from Google Calendar for this date
        const events = await getEventsForDate(date);

        console.log(`📅 Found ${events.length} events on ${date}`);

        // Define time windows
        const timeWindows = {
            morning: {
                start: `${date}T08:00:00`,
                end: `${date}T10:00:00`
            },
            afternoon: {
                start: `${date}T14:00:00`,
                end: `${date}T16:00:00`
            }
        };

        const window = timeWindows[timeSlot];
        if (!window) {
            console.error(`Invalid time slot: ${timeSlot}`);
            return true;
        }

        // Check if any event overlaps with this time window
        const hasConflict = events.some(event => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            const windowStart = new Date(window.start);
            const windowEnd = new Date(window.end);

            // Check for overlap
            return (eventStart < windowEnd && eventEnd > windowStart);
        });

        if (hasConflict) {
            console.log(`❌ ${timeSlot} slot on ${date} is BOOKED`);
        } else {
            console.log(`✅ ${timeSlot} slot on ${date} is AVAILABLE`);
        }

        return !hasConflict;
    } catch (error) {
        console.error('Error checking Google Calendar availability:', error);
        return true; // Default to available if check fails
    }
}

/**
 * Get available slots for a date (morning/afternoon)
 */
async function getAvailableSlotsForDate(date) {
    try {
        const morningAvailable = await checkSlotAvailability(date, 'morning');
        const afternoonAvailable = await checkSlotAvailability(date, 'afternoon');

        return {
            morning: morningAvailable,
            afternoon: afternoonAvailable,
            anyAvailable: morningAvailable || afternoonAvailable
        };
    } catch (error) {
        console.error('Error getting available slots:', error);
        return { morning: true, afternoon: true, anyAvailable: true };
    }
}

/**
 * Generate Square payment link and send via SMS
 */
async function sendPaymentLinkSMS(phone, customerName, bookingId, amount, email) {
    try {
        const checkoutUrl = `${BASE_URL}/checkout.html?amount=${Math.round(amount)}&booking=${bookingId}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(customerName)}`;

        const message = `Hi ${customerName}! To secure your booking ${bookingId}, please save your card on file (no charge yet): ${checkoutUrl}\n\nWorry Free Moving\n(330) 661-9985`;

        // Use RingCentral SMS instead of Twilio
        await sendSMS(phone, message);

        console.log(`💳 Payment link sent to ${phone} via RingCentral`);
        return true;
    } catch (error) {
        console.error('Error sending payment link SMS:', error);
        return false;
    }
}

/**
 * Send email estimate
 */
async function sendEmailEstimate(email, customerName, quoteData) {
    try {
        // Use existing email service
        const { sendEmail } = require('./emailService');

        const subject = `Your Moving Quote from Worry Free Moving`;
        const body = `Hi ${customerName},

Thank you for your interest in Worry Free Moving!

Your Estimate:
- Service: ${quoteData.serviceType}
- Distance: ${quoteData.distance} miles
- Estimated Time: ${quoteData.estimatedHours} hours
- Estimated Total: $${Math.round(quoteData.total)}

This is an estimate based on the information provided. Final cost may vary based on actual time and materials.

Ready to book? Call us at (330) 661-9985 or visit our website!

Best regards,
Worry Free Moving Team`;

        await sendEmail(email, subject, body);
        console.log(`📧 Email estimate sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending email estimate:', error);
        return false;
    }
}

/**
 * Handle incoming call with call recording
 */
function handleIncomingCall(req, res) {
    const { CallSid, From } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    console.log(`📞 Incoming call from ${From}, CallSid: ${CallSid}`);

    // Initialize conversation
    conversations.set(CallSid, {
        stage: 'greeting',
        data: {},
        customerPhone: From,
        attempts: { transfer: 0 },
        startTime: new Date(),
        conversationHistory: [],
        callSid: CallSid
    });

    // Start call recording with transcription (using REST API, not TwiML)
    // This happens asynchronously and doesn't block the call flow
    twilioClient.calls(CallSid)
        .recordings
        .create({
            recordingStatusCallback: `${BASE_URL}/api/twilio/recording-complete`,
            recordingStatusCallbackMethod: 'POST'
        })
        .then(recording => {
            console.log(`📹 Recording started: ${recording.sid}`);
            const conv = conversations.get(CallSid);
            if (conv) {
                conv.recordingSid = recording.sid;
                conversations.set(CallSid, conv);
            }
        })
        .catch(err => {
            console.error('Error starting recording:', err.message);
        });

    // Greeting
    response.say({
        voice: 'Polly.Joanna'
    }, "Hi! Thanks for calling Worry Free Moving. This is Sarah.");

    response.pause({ length: 1 });

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/main-menu',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 8
    });

    gather.say("I can help you get a free quote and book your move today. Press 1 or say quote to get started over the phone. Or press 2 if you'd prefer me to text you a link to our online booking form, which is much faster.");

    response.redirect('/api/twilio/voice');

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Handle recording completion and request transcription
 */
async function handleRecordingComplete(req, res) {
    const { CallSid, RecordingUrl, RecordingSid, RecordingDuration } = req.body;

    console.log(`📞 Call recording complete:`, {
        callSid: CallSid,
        recordingSid: RecordingSid,
        duration: RecordingDuration,
        url: RecordingUrl
    });

    // Get conversation data
    const conv = conversations.get(CallSid);

    try {
        // Request transcription from Twilio
        await twilioClient
            .recordings(RecordingSid)
            .transcriptions
            .create({
                transcriptionCallback: `${BASE_URL}/api/twilio/transcription-complete`
            });

        console.log(`🎙️ Transcription requested for recording ${RecordingSid}`);

        // Store transcription request in conversation data
        if (conv) {
            conv.recordingUrl = RecordingUrl;
            conv.recordingDuration = RecordingDuration;
            conversations.set(CallSid, conv);
        }

    } catch (error) {
        console.error('Error requesting transcription:', error.message);
    }

    res.sendStatus(200);
}

/**
 * Handle transcription completion and email it
 */
async function handleTranscriptionComplete(req, res) {
    const { TranscriptionText, TranscriptionStatus, RecordingSid, CallSid } = req.body;

    console.log(`📝 Transcription complete for ${RecordingSid}, status: ${TranscriptionStatus}`);

    if (TranscriptionStatus === 'completed' && TranscriptionText) {
        const conv = conversations.get(CallSid);

        // Prepare email content
        const quoteData = conv && conv.data ? conv.data : {};
        const duration = conv && conv.recordingDuration ? `${Math.floor(conv.recordingDuration / 60)}m ${conv.recordingDuration % 60}s` : 'Unknown';

        const emailContent = `
<h2>📞 Voice AI Call Transcript</h2>

<p><strong>Call SID:</strong> ${CallSid}</p>
<p><strong>Duration:</strong> ${duration}</p>
<p><strong>Customer Phone:</strong> ${conv && conv.customerPhone ? conv.customerPhone : 'Unknown'}</p>

${quoteData.estimatedTotal ? `
<h3>Quote Details:</h3>
<p><strong>Service Type:</strong> ${quoteData.serviceType || 'N/A'}</p>
<p><strong>From:</strong> ${quoteData.pickupAddress || 'N/A'}</p>
<p><strong>To:</strong> ${quoteData.dropoffAddress || 'N/A'}</p>
<p><strong>Distance:</strong> ${quoteData.distance || 'N/A'} miles</p>
<p><strong>Crew Size:</strong> ${quoteData.numMovers || 'N/A'} movers</p>
<p><strong>Estimated Total:</strong> $${Math.round(quoteData.estimatedTotal)}</p>
<p><strong>Customer Name:</strong> ${quoteData.customerName || 'N/A'}</p>
<p><strong>Customer Email:</strong> ${quoteData.email || 'N/A'}</p>
` : '<p><em>No quote was completed during this call.</em></p>'}

<h3>Call Transcript:</h3>
<div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-wrap;">
${TranscriptionText}
</div>

${conv && conv.recordingUrl ? `
<p><strong>Recording URL:</strong> <a href="${conv.recordingUrl}">${conv.recordingUrl}</a></p>
` : ''}

<hr>
<p style="color: #666; font-size: 12px;">This transcript was automatically generated by Twilio's transcription service.</p>
        `;

        // Send email
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            await transporter.sendMail({
                from: `"Worry Free Moving Voice AI" <${process.env.EMAIL_USER}>`,
                to: process.env.COMPANY_EMAIL || 'info@worryfreemoving.com',
                subject: `📞 Voice AI Call Transcript ${quoteData.estimatedTotal ? `- Quote: $${Math.round(quoteData.estimatedTotal)}` : '- No Quote'}`,
                html: emailContent
            });

            console.log(`✅ Transcription email sent for call ${CallSid}`);

        } catch (error) {
            console.error('Error sending transcription email:', error.message);
        }

        // Clean up conversation data after email sent
        conversations.delete(CallSid);

    } else {
        console.log(`⚠️ Transcription not available or failed: ${TranscriptionStatus}`);
    }

    res.sendStatus(200);
}

/**
 * Main menu handler
 */
function handleMainMenu(req, res) {
    const { Digits, SpeechResult, CallSid, From } = req.body;
    const choice = Digits || (SpeechResult ? parseMenuChoice(SpeechResult) : null);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    switch (choice) {
        case '1': // Get quote over phone
            response.redirect('/api/twilio/quote-service-type');
            break;

        case '2': // Send online booking link (skip phone call)
            response.say("Perfect! I'll send you a text with a link to our online booking form.");
            response.pause({ length: 1 });
            response.redirect('/api/twilio/confirm-phone-for-sms');
            break;

        case '9': // Hidden transfer option
            if (conv && conv.attempts.transfer >= 1) {
                response.say("Let me connect you with our team.");
                response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
            } else {
                conv.attempts.transfer++;
                conversations.set(CallSid, conv);
                response.say("I'd love to help you first. Let me get you a quick quote - it only takes a minute.");
                response.redirect('/api/twilio/quote-service-type');
            }
            break;

        default:
            response.say("I didn't catch that. Let me repeat the options.");
            response.redirect('/api/twilio/voice');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Ask service type
 */
function handleQuoteServiceType(req, res) {
    const { CallSid } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.stage = 'quote-service-type';
    conversations.set(CallSid, conv);

    response.say("Perfect! What type of service do you need?");
    response.pause({ length: 1 });

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-pickup-address',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("Press 1 or say movers and truck if you need us to bring the truck. Press 2 or say labor only if you have your own truck and just need help loading.");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Get pickup address FIRST (before crew size)
 */
function handleQuotePickupAddress(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Parse service type
    const serviceChoice = Digits || (SpeechResult ? parseServiceType(SpeechResult) : null);

    if (serviceChoice === '1') {
        conv.data.serviceCategory = 'moving';
    } else if (serviceChoice === '2') {
        conv.data.serviceCategory = 'labor';
    } else {
        response.say("I didn't catch that. Let's try again.");
        response.redirect('/api/twilio/quote-service-type');
        conversations.set(CallSid, conv);
        res.type('text/xml');
        return res.send(response.toString());
    }

    conv.stage = 'quote-pickup-address';
    conversations.set(CallSid, conv);

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/quote-pickup-home-type',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("Got it. What's your pickup address? Please say the street address and city.");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Parse and confirm pickup address
 */
async function handleQuotePickupHomeType(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Use Claude to parse pickup address
    const pickupExtracted = await extractWithAI(
        SpeechResult,
        'Customer is providing their pickup address for a move',
        'Extract: street, city, state. Clean up the address formatting. If state not mentioned, assume Ohio (OH).'
    );

    if (pickupExtracted && pickupExtracted.street) {
        conv.data.pickupAddress = `${pickupExtracted.street}, ${pickupExtracted.city || 'Canton'}, ${pickupExtracted.state || 'OH'}`;
        conv.data.pickupCity = pickupExtracted.city || 'Canton';
    } else {
        conv.data.pickupAddress = SpeechResult;
    }

    console.log(`📍 Pickup address collected: ${conv.data.pickupAddress}`);

    // Confirm address back to customer
    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-pickup-address-confirm',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say(`I have your pickup address as ${conv.data.pickupAddress}. Is that correct? Press 1 for yes, or press 2 to say it again.`);

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Handle pickup address confirmation
 */
async function handleQuotePickupAddressConfirm(req, res) {
    const { CallSid, Digits, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    const choice = Digits || (SpeechResult && SpeechResult.toLowerCase().includes('yes') ? '1' : '2');

    if (choice === '1') {
        // Address confirmed, continue to home type
        console.log(`✅ Pickup address confirmed: ${conv.data.pickupAddress}`);

        // Use Claude to generate natural transition
        const naturalResponse = await generateNaturalResponse(
            `Customer confirmed pickup address: ${conv.data.pickupAddress}`,
            'Acknowledge naturally and explain why you need to know the home type (helps estimate crew size and time)'
        );

        if (naturalResponse.success) {
            response.say(naturalResponse.reply);
        } else {
            response.say("Perfect. This helps me figure out the right crew size for you.");
        }

        response.pause({ length: 1 });

        const gather = response.gather({
            input: 'dtmf speech',
            action: '/api/twilio/quote-pickup-bedrooms',
            method: 'POST',
            numDigits: 1,
            speechTimeout: 'auto',
            timeout: 10
        });

        gather.say("What type of place are you moving FROM? Press 1 for a house. Press 2 for an apartment or condo. Or press 3 for a storage unit.");

        conversations.set(CallSid, conv);
        res.type('text/xml');
        res.send(response.toString());
    } else {
        // Address not confirmed, ask again
        console.log(`🔄 Pickup address not confirmed, asking again`);

        const gather = response.gather({
            input: 'speech',
            action: '/api/twilio/quote-pickup-home-type',
            method: 'POST',
            speechTimeout: 'auto',
            timeout: 15
        });

        gather.say("No problem. Please say your pickup address again, including the street address and city.");

        conversations.set(CallSid, conv);
        res.type('text/xml');
        res.send(response.toString());
    }
}

/**
 * Ask pickup bedrooms - Claude suggests crew size
 */
async function handleQuotePickupBedrooms(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Parse home type
    const homeTypeChoice = Digits || parseHomeTypeChoice(SpeechResult);
    if (homeTypeChoice === '1') conv.data.pickupHomeType = 'house';
    else if (homeTypeChoice === '2') conv.data.pickupHomeType = 'apartment';
    else if (homeTypeChoice === '3') conv.data.pickupHomeType = 'storage';
    else conv.data.pickupHomeType = 'house';

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-pickup-stairs',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("How many bedrooms at this location? Press 1 for studio or 1 bedroom. Press 2 for 2 bedrooms. Press 3 for 3 bedrooms. Press 4 for 4 bedrooms. Or press 5 for 5 or more.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Ask pickup stairs - with fee warning from Claude
 */
async function handleQuotePickupStairs(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    const bedrooms = parseInt(Digits) || 2;
    conv.data.pickupBedrooms = bedrooms;

    // Use Claude to provide personalized crew recommendation
    const crewAdvice = await generateNaturalResponse(
        `Customer has ${bedrooms} bedrooms at pickup location, home type: ${conv.data.pickupHomeType}`,
        `Give brief, friendly advice about recommended crew size for a ${bedrooms} bedroom ${conv.data.pickupHomeType}. Keep it under 2 sentences.`
    );

    if (crewAdvice.success && bedrooms >= 3) {
        response.say(crewAdvice.reply);
        response.pause({ length: 1 });
    }

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-delivery-address',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("How many flights of stairs at the pickup location? Press 0 for no stairs or ground floor. Press 1 for one flight. Press 2 for two flights. Or press 3 for three or more flights.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Get delivery address
 */
async function handleQuoteDeliveryAddress(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Save pickup stairs
    const pickupStairs = parseInt(Digits) || 0;
    conv.data.pickupStairs = pickupStairs;

    // Claude gives stair fee warning if applicable
    if (pickupStairs > 0) {
        const stairWarning = await generateNaturalResponse(
            `Customer has ${pickupStairs} flights of stairs at pickup`,
            'Briefly mention there is a stair fee (keep it friendly, under 1 sentence)'
        );
        if (stairWarning.success) {
            response.say(stairWarning.reply);
            response.pause({ length: 1 });
        }
    }

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/quote-delivery-home-type',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("Great. Now, where are you moving TO? Please say the delivery address.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Parse and confirm delivery address
 */
async function handleQuoteDeliveryHomeType(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Use Claude to parse delivery address
    const deliveryExtracted = await extractWithAI(
        SpeechResult,
        'Customer is providing their delivery address for a move',
        'Extract: street, city, state. Clean up the address formatting. If state not mentioned, assume Ohio (OH).'
    );

    if (deliveryExtracted && deliveryExtracted.street) {
        conv.data.deliveryAddress = `${deliveryExtracted.street}, ${deliveryExtracted.city || 'Akron'}, ${deliveryExtracted.state || 'OH'}`;
        conv.data.deliveryCity = deliveryExtracted.city || 'Akron';
    } else {
        conv.data.deliveryAddress = SpeechResult;
    }

    console.log(`📍 Delivery address collected: ${conv.data.deliveryAddress}`);

    // Confirm address back to customer
    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-delivery-address-confirm',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say(`I have your delivery address as ${conv.data.deliveryAddress}. Is that correct? Press 1 for yes, or press 2 to say it again.`);

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Handle delivery address confirmation
 */
async function handleQuoteDeliveryAddressConfirm(req, res) {
    const { CallSid, Digits, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    const choice = Digits || (SpeechResult && SpeechResult.toLowerCase().includes('yes') ? '1' : '2');

    if (choice === '1') {
        // Address confirmed, continue to home type
        console.log(`✅ Delivery address confirmed: ${conv.data.deliveryAddress}`);

        const gather = response.gather({
            input: 'dtmf speech',
            action: '/api/twilio/quote-delivery-bedrooms',
            method: 'POST',
            numDigits: 1,
            speechTimeout: 'auto',
            timeout: 10
        });

        gather.say("Got it. What type of place are you moving TO? Press 1 for a house. Press 2 for an apartment or condo. Or press 3 for a storage unit.");

        conversations.set(CallSid, conv);
        res.type('text/xml');
        res.send(response.toString());
    } else {
        // Address not confirmed, ask again
        console.log(`🔄 Delivery address not confirmed, asking again`);

        const gather = response.gather({
            input: 'speech',
            action: '/api/twilio/quote-delivery-home-type',
            method: 'POST',
            speechTimeout: 'auto',
            timeout: 15
        });

        gather.say("No problem. Please say your delivery address again, including the street address and city.");

        conversations.set(CallSid, conv);
        res.type('text/xml');
        res.send(response.toString());
    }
}

/**
 * Ask delivery bedrooms
 */
function handleQuoteDeliveryBedrooms(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Parse home type
    const homeTypeChoice = Digits || parseHomeTypeChoice(SpeechResult);
    if (homeTypeChoice === '1') conv.data.deliveryHomeType = 'house';
    else if (homeTypeChoice === '2') conv.data.deliveryHomeType = 'apartment';
    else if (homeTypeChoice === '3') conv.data.deliveryHomeType = 'storage';
    else conv.data.deliveryHomeType = 'house';

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-delivery-stairs',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("How many bedrooms at the destination? Press 1 for studio or 1 bedroom. Press 2 for 2 bedrooms. Press 3 for 3 bedrooms. Press 4 for 4 bedrooms. Or press 5 for 5 or more.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Ask delivery stairs - then flow to appliances
 */
async function handleQuoteDeliveryStairs(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.data.deliveryBedrooms = parseInt(Digits) || 2;

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-appliances',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("How many flights of stairs at the delivery location? Press 0 for no stairs. Press 1 for one flight. Press 2 for two flights. Or press 3 for three or more flights.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Ask about appliances - with Claude-powered disconnection warning
 */
async function handleQuoteAppliances(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Save delivery stairs
    const deliveryStairs = parseInt(Digits) || 0;
    conv.data.deliveryStairs = deliveryStairs;

    // Claude gives stair fee warning if applicable
    if (deliveryStairs > 0) {
        const stairWarning = await generateNaturalResponse(
            `Customer has ${deliveryStairs} flights of stairs at delivery`,
            'Briefly mention there is a stair fee (keep it friendly, under 1 sentence)'
        );
        if (stairWarning) {
            response.say(stairWarning);
            response.pause({ length: 1 });
        }
    }

    // Use Claude to naturally transition to appliances question
    const applianceIntro = await generateNaturalResponse(
        'Moving on to discuss what items they are moving',
        'Explain briefly why you are asking about appliances (helps with time estimate and preparation). Keep it natural and under 2 sentences.'
    );

    if (applianceIntro) {
        response.say(applianceIntro);
        response.pause({ length: 1 });
    } else {
        response.say("Now let me ask about what you're moving so we can prepare properly.");
        response.pause({ length: 1 });
    }

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-appliances-details',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("Do you have any large appliances to move? Things like a washer, dryer, refrigerator, stove, or freezer? Press 1 for yes, or press 2 for no.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Appliances details and CRITICAL disconnection warning
 */
async function handleQuoteAppliancesDetails(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    const hasAppliances = Digits === '1';
    conv.data.hasAppliances = hasAppliances;

    if (hasAppliances) {
        // Initialize appliances array if not exists
        conv.data.appliances = [];

        // Use Claude to deliver the critical disconnection warning
        const disconnectionWarning = await generateNaturalResponse(
            'Customer has appliances to move',
            'Give CRITICAL warning: All gas, water, and electrical connections MUST be disconnected BEFORE movers arrive. Movers do NOT disconnect utilities. Be firm but friendly. Ask if they understand this requirement.'
        );

        if (disconnectionWarning) {
            response.say(disconnectionWarning);
        } else {
            // Fallback warning
            response.say("This is very important. All gas lines, water lines, and electrical connections must be completely disconnected before we arrive. We don't disconnect utilities. This is critical for safety and to stay on schedule.");
        }

        response.pause({ length: 1 });

        const gather = response.gather({
            input: 'dtmf speech',
            action: '/api/twilio/quote-heavy-items',
            method: 'POST',
            numDigits: 1,
            speechTimeout: 'auto',
            timeout: 10
        });

        gather.say("Do you understand that all appliances must be disconnected before we arrive? Press 1 for yes.");
    } else {
        // No appliances, move to heavy items
        response.redirect('/api/twilio/quote-heavy-items');
    }

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Ask about heavy/special items with Claude-powered fee warnings
 */
async function handleQuoteHeavyItems(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Customer confirmed they understand appliance disconnection
    if (Digits === '1') {
        conv.data.applianceDisconnectionConfirmed = true;
    }

    // Use Claude to introduce heavy items question
    const heavyItemsIntro = await generateNaturalResponse(
        'Need to ask about special heavy items that require extra care',
        'Naturally transition to asking about heavy items like pianos or pool tables. Explain these need special handling. Keep it brief.'
    );

    if (heavyItemsIntro) {
        response.say(heavyItemsIntro);
        response.pause({ length: 1 });
    }

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-heavy-items-details',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("Do you have any heavy specialty items? Things like a piano, pool table, or gun safe? Press 1 for yes, or press 2 for no.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Heavy items details with fee warnings from Claude
 */
async function handleQuoteHeavyItemsDetails(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    const hasHeavyItems = Digits === '1';
    conv.data.hasHeavyItems = hasHeavyItems;

    if (hasHeavyItems) {
        conv.data.heavyItems = [];

        // Use Claude to warn about heavy item fees naturally
        const heavyItemWarning = await generateNaturalResponse(
            'Customer has heavy specialty items to move',
            'Briefly mention that items like pianos and pool tables have additional fees due to special handling. Keep it friendly and under 2 sentences.'
        );

        if (heavyItemWarning) {
            response.say(heavyItemWarning);
            response.pause({ length: 1 });
        } else {
            response.say("Just so you know, specialty items like pianos and pool tables do have additional fees because they require extra care and equipment.");
            response.pause({ length: 1 });
        }
    }

    // Move to packing materials question (first step of packing flow)
    response.redirect('/api/twilio/quote-packing-materials');

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Ask about packing materials (step 1 of packing flow)
 */
async function handleQuotePackingMaterials(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    response.say("Now let's talk about packing. Would you like us to provide packing materials like boxes, tape, and bubble wrap?");
    response.pause({ length: 1 });

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-packing-materials-confirm',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("Press 1 for yes, I need packing materials. Or press 2 for no, I have my own.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Handle packing materials response and send itemized email (step 2)
 */
async function handleQuotePackingMaterialsConfirm(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    const needsPackingMaterials = Digits === '1';
    conv.data.needsPackingMaterials = needsPackingMaterials;

    if (needsPackingMaterials) {
        // Calculate materials based on bedrooms
        const bedrooms = Math.max(conv.data.pickupBedrooms || 2, conv.data.deliveryBedrooms || 2);
        const { getServicesConfig } = require('../utils/serviceConfigLoader');
        const servicesConfig = await getServicesConfig();

        const materialsBreakdown = calculatePackingMaterials(bedrooms, servicesConfig);
        conv.data.packingMaterialsBreakdown = materialsBreakdown;

        response.say(`Perfect! I've calculated a recommended packing materials list based on your ${bedrooms}-bedroom move. The total for materials is about $${Math.round(materialsBreakdown.total)}.`);
        response.pause({ length: 1 });

        // Email will be sent later when we have customer email (during booking)
        conv.data.shouldEmailPackingMaterials = true;

        response.say("I'll email you an itemized list that you can customize by replying to the email.");
        response.pause({ length: 1 });
    }

    // Move to packing service question
    response.redirect('/api/twilio/quote-packing-services');

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Ask about professional packing services (step 3)
 */
async function handleQuotePackingServices(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Use Claude to introduce packing services
    const packingIntro = await generateNaturalResponse(
        'Asking if customer needs professional packing help',
        'Explain that packing service is done 1-2 days before the move by professionals. Keep it natural and helpful, under 2 sentences.'
    );

    if (packingIntro) {
        response.say(packingIntro);
        response.pause({ length: 1 });
    } else {
        response.say("We also offer professional packing services. Our team can pack everything for you, usually a day or two before your move.");
        response.pause({ length: 1 });
    }

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-insurance',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("Would you like professional packing services? Press 1 for yes, or press 2 for no.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Ask about Full Value Protection insurance
 */
async function handleQuoteInsurance(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Save packing preference
    const needsPacking = Digits === '1';
    conv.data.needsPacking = needsPacking;

    if (needsPacking) {
        const packingTimeline = await generateNaturalResponse(
            'Customer wants packing services',
            'Briefly acknowledge packing will be scheduled 1-2 days before move. Keep it under 2 sentences.'
        );
        if (packingTimeline) {
            response.say(packingTimeline);
            response.pause({ length: 1 });
        }
    }

    // Use Claude to explain FVP insurance naturally
    const fvpIntro = await generateNaturalResponse(
        'Explaining Full Value Protection insurance option',
        'Briefly explain FVP insurance protects the full value of items vs basic coverage. Keep it educational and under 3 sentences.'
    );

    if (fvpIntro) {
        response.say(fvpIntro);
        response.pause({ length: 1 });
    } else {
        response.say("One more thing. We offer Full Value Protection insurance. This covers the full replacement value of your items, unlike our basic coverage which is just 60 cents per pound.");
        response.pause({ length: 1 });
    }

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-calculate-distance',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("Would you like Full Value Protection insurance? Press 1 for yes, or press 2 for basic coverage.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Calculate distance THEN ask crew size
 */
async function handleQuoteCalculateDistance(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Save FVP insurance preference
    const wantsFVP = Digits === '1';
    conv.data.wantsFVP = wantsFVP;

    if (wantsFVP) {
        // Estimate FVP value based on bedroom count (typical household values)
        const totalBedrooms = (conv.data.pickupBedrooms || 2) + (conv.data.deliveryBedrooms || 2);
        const avgBedrooms = Math.ceil(totalBedrooms / 2);

        // Typical values: 1BR=$15k, 2BR=$25k, 3BR=$40k, 4BR=$60k, 5BR=$80k
        const estimatedValues = { 1: 15000, 2: 25000, 3: 40000, 4: 60000, 5: 80000 };
        conv.data.fvpValue = estimatedValues[Math.min(avgBedrooms, 5)] || 25000;

        // Use Claude to acknowledge FVP selection
        const fvpConfirm = await generateNaturalResponse(
            `Customer selected Full Value Protection for estimated ${avgBedrooms}-bedroom home`,
            'Briefly acknowledge their smart choice for full protection. Keep it reassuring and under 2 sentences.'
        );

        if (fvpConfirm) {
            response.say(fvpConfirm);
            response.pause({ length: 1 });
        } else {
            response.say("Great choice! That gives you full peace of mind.");
            response.pause({ length: 1 });
        }
    }

    response.say("Let me calculate the distance for your move.");
    response.pause({ length: 2 });

    try {
        // Calculate distance using Google Maps
        const distanceData = await calculateDistanceWithGoogleMaps(
            conv.data.pickupAddress,
            conv.data.deliveryAddress
        );

        conv.data.distance = distanceData.distance;
        conv.data.driveTime = distanceData.driveTime;

        console.log(`📍 Distance: ${conv.data.distance} miles, Drive time: ${conv.data.driveTime} min`);

        // Now ask for crew size
        const gather = response.gather({
            input: 'dtmf speech',
            action: '/api/twilio/quote-finalize',
            method: 'POST',
            numDigits: 1,
            speechTimeout: 'auto',
            timeout: 10
        });

        if (conv.data.serviceCategory === 'moving') {
            gather.say(`The distance is about ${Math.round(conv.data.distance)} miles. How many movers do you need? Press 2 for two movers, press 3 for three, or press 4 for four.`);
        } else {
            gather.say(`The distance is about ${Math.round(conv.data.distance)} miles. How many people do you need for labor? Press 2 for two people, or press 3 for three.`);
        }

        conversations.set(CallSid, conv);

    } catch (error) {
        console.error('Distance calculation error:', error);
        response.say("I'm having trouble calculating the distance. Let me connect you with someone who can help.");
        response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Finalize quote with exact pricing algorithm
 */
async function handleQuoteFinalize(req, res) {
    const { CallSid, Digits, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    console.log('💰 Starting quote finalization for CallSid:', CallSid);
    console.log('💰 Current conversation data:', JSON.stringify(conv.data, null, 2));

    // Parse crew size
    const crewSize = parseInt(Digits) || 2;
    conv.data.crewSize = crewSize;

    console.log(`👥 Crew size selected: ${crewSize}`);

    response.say("Let me calculate your quote.");
    response.pause({ length: 2 });

    try {
        // Determine estimated hours based on distance and drive time
        const driveHours = (conv.data.driveTime || 20) / 60;
        const estimatedHours = conv.data.serviceCategory === 'moving'
            ? Math.max(3, 3 + driveHours) // Moving: 3 hours base + drive time
            : Math.max(2, 2 + (driveHours / 2)); // Labor: 2 hours base + half drive time

        // Use EXACT pricing API format from server with ALL collected data
        const quoteRequest = {
            serviceType: conv.data.serviceCategory === 'moving'
                ? `${crewSize}-Person Crew Moving`  // Match exact format: "2-Person Crew Moving"
                : 'Labor Only',
            distance: conv.data.distance || 10,
            driveTime: conv.data.driveTime || 20,
            estimatedHours: Math.round(estimatedHours),
            laborCrewSize: conv.data.serviceCategory === 'labor' ? crewSize : null,
            pickupDetails: {
                homeType: conv.data.pickupHomeType || 'house',
                bedrooms: conv.data.pickupBedrooms || 2,
                stairs: conv.data.pickupStairs || 0
            },
            dropoffDetails: {
                homeType: conv.data.deliveryHomeType || 'house',
                bedrooms: conv.data.deliveryBedrooms || 2,
                stairs: conv.data.deliveryStairs || 0
            },
            // Heavy items in the format the API expects
            inventory: conv.data.hasHeavyItems ? {
                piano: true,  // Assume piano if heavy items mentioned (API charges $200 + 45min)
                poolTable: false,
                hotTub: false,
                safe: false
            } : {},
            // Packing and insurance services in the format the API expects
            additionalServices: {
                packing: conv.data.needsPacking || false,
                packingMaterials: {},
                movingBlankets: false,
                fvp: conv.data.wantsFVP || false,
                fvpValue: conv.data.fvpValue || 0
            }
        };

        console.log('📊 Requesting quote from:', `${BASE_URL}/api/calculate-estimate`);
        console.log('📊 Quote request data:', JSON.stringify(quoteRequest, null, 2));

        // Call real pricing API
        let quoteResponse;
        try {
            console.log('🌐 Making API call to pricing endpoint...');
            quoteResponse = await axios.post(`${BASE_URL}/api/calculate-estimate`, quoteRequest);
            console.log('✅ Quote API responded with status:', quoteResponse.status);
            console.log('✅ Quote API response data:', JSON.stringify(quoteResponse.data, null, 2));
        } catch (apiError) {
            console.error('❌ Quote API Error:', {
                status: apiError.response?.status,
                statusText: apiError.response?.statusText,
                data: apiError.response?.data,
                message: apiError.message,
                stack: apiError.stack
            });
            throw apiError;
        }

        const quote = quoteResponse.data;

        if (!quote || !quote.estimate) {
            console.error('❌ Invalid quote response:', quote);
            throw new Error('Invalid quote response from API');
        }

        console.log('💰 Quote parsed successfully:', JSON.stringify(quote, null, 2));

        // Save quote and additional data for emails/bookings
        conv.data.quote = quote.estimate;
        conv.data.estimatedTotal = quote.estimate.total;
        conv.data.estimatedHours = quote.estimate.estimatedTime || estimatedHours;
        conv.data.numMovers = crewSize;
        conv.data.serviceType = quoteRequest.serviceType;
        conversations.set(CallSid, conv);

        // Present quote
        const total = Math.round(quote.estimate.total);
        const hours = Math.round(quote.estimate.estimatedTime || estimatedHours);

        console.log(`💵 Presenting quote to customer: $${total} for ${hours} hours with ${crewSize} movers`);

        if (conv.data.serviceCategory === 'moving') {
            response.say(`Great news! Your estimated total is $${total} for ${crewSize} movers with a truck.`);
            response.pause({ length: 1 });
            response.say(`This includes approximately ${hours} hours of service. The final cost depends on actual time needed.`);
        } else {
            response.say(`Your estimated total is $${total} for ${crewSize} helpers.`);
            response.pause({ length: 1 });
            response.say(`This includes labor and a travel fee for the ${Math.round(conv.data.distance)} mile distance.`);
        }

        console.log('📢 Quote presented verbally to customer');

        // Automatically send detailed quote breakdown via SMS (similar to chatbot)
        try {
            console.log('📱 Building detailed SMS quote breakdown...');

            const estimate = quote.estimate;
            let quoteMessage = `🚚 Worry Free Moving - Quote Breakdown\n\n`;

            // Service type and basic info
            quoteMessage += `📦 Service: ${conv.data.serviceCategory === 'moving' ? `${crewSize}-Person Crew + Truck` : `Labor Only (${crewSize} helpers)`}\n`;
            quoteMessage += `📍 From: ${conv.data.pickupAddress}\n`;
            quoteMessage += `📍 To: ${conv.data.deliveryAddress}\n`;
            quoteMessage += `📏 Distance: ${Math.round(conv.data.distance)} miles\n`;
            quoteMessage += `⏱️ Estimated Time: ${hours} hours\n\n`;

            // Cost breakdown
            quoteMessage += `💰 COST BREAKDOWN:\n`;
            quoteMessage += `━━━━━━━━━━━━━━━━━━━━\n`;

            // Distance charges
            if (estimate.distanceCharge && estimate.distanceCharge > 0) {
                quoteMessage += `Distance Charge: $${estimate.distanceCharge.toFixed(2)}\n`;
            }

            // Travel fees (for labor only)
            if (estimate.travelFee && estimate.travelFee > 0) {
                quoteMessage += `Travel Fee: $${estimate.travelFee.toFixed(2)}\n`;
            }

            // Stairs fees
            if (estimate.stairsFee && estimate.stairsFee > 0) {
                const totalStairs = (conv.data.pickupStairs || 0) + (conv.data.deliveryStairs || 0);
                quoteMessage += `Stairs Fee (${totalStairs} flights): $${estimate.stairsFee.toFixed(2)}\n`;
            }

            // Heavy items
            if (estimate.heavyItemsFee && estimate.heavyItemsFee > 0) {
                quoteMessage += `Heavy Items Fee: $${estimate.heavyItemsFee.toFixed(2)}\n`;
            }

            // Packing services
            if (estimate.packingFee && estimate.packingFee > 0) {
                quoteMessage += `Packing Services: $${estimate.packingFee.toFixed(2)}\n`;
            }

            // FVP Insurance
            if (estimate.fvpCost && estimate.fvpCost > 0) {
                quoteMessage += `Full Value Protection: $${estimate.fvpCost.toFixed(2)}\n`;
            }

            // Subtotal
            if (estimate.subtotal) {
                quoteMessage += `\nSubtotal: $${estimate.subtotal.toFixed(2)}\n`;
            }

            // Service charge
            if (estimate.serviceCharge && estimate.serviceCharge > 0) {
                const serviceChargePercent = conv.data.serviceCategory === 'moving' ? '14%' : '8%';
                quoteMessage += `Service Charge (${serviceChargePercent}): $${estimate.serviceCharge.toFixed(2)}\n`;
            }

            quoteMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
            quoteMessage += `TOTAL: $${total}\n\n`;

            // Important notes
            quoteMessage += `⚠️ Final cost based on actual time.\n`;
            quoteMessage += `⚠️ 2-hour minimum for all jobs.\n\n`;

            quoteMessage += `Questions? Call us:\n`;
            quoteMessage += `📞 (330) 661-9985\n`;
            quoteMessage += `worryfreemovers.com`;

            // Use RingCentral SMS
            await sendSMS(conv.customerPhone, quoteMessage);

            console.log(`📱 Detailed quote SMS sent to ${conv.customerPhone} via RingCentral`);
            console.log(`📱 SMS content:\n${quoteMessage}`);

            response.pause({ length: 1 });
            response.say("I just texted you a detailed breakdown of your quote for reference.");
        } catch (smsError) {
            console.error('Error sending quote SMS:', smsError.message);
            console.error('SMS Error details:', smsError);
            // Don't fail the call if SMS fails, just continue
        }

        response.pause({ length: 1 });

        const gather = response.gather({
            input: 'dtmf speech',
            action: '/api/twilio/quote-decision',
            method: 'POST',
            numDigits: 1,
            speechTimeout: 'auto',
            timeout: 10
        });

        gather.say("Would you like to book this move? Press 1 to schedule now. Press 2 to receive this quote by email. Or press 9 to speak with someone.");

    } catch (error) {
        console.error('❌❌❌ QUOTE CALCULATION FAILED ❌❌❌');
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            conversationData: conv?.data
        });
        response.say("I'm having trouble calculating your quote. Let me connect you with someone who can help.");
        response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Handle booking decision or email quote
 */
async function handleQuoteDecision(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    const choice = Digits || (SpeechResult ? parseDecisionChoice(SpeechResult) : null);

    if (choice === '1') {
        // Book now over phone
        response.say("Excellent! Let me get some information to complete your booking.");
        response.redirect('/api/twilio/booking-start');
    } else if (choice === '2') {
        // Email quote
        const gather = response.gather({
            input: 'speech',
            action: '/api/twilio/email-quote-send',
            method: 'POST',
            speechTimeout: 'auto',
            timeout: 15
        });
        gather.say("Sure! What's your email address? Please say it slowly.");
    } else if (choice === '9') {
        response.say("Let me transfer you now.");
        response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
    } else {
        response.say("I didn't catch that.");
        response.redirect('/api/twilio/quote-finalize');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Send email quote
 */
async function handleEmailQuoteSend(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Parse email with Claude
    const emailExtracted = await extractWithAI(
        SpeechResult,
        'Customer is providing their email address spoken aloud',
        'Extract email address. Common patterns: "at" = @, "dot" = ., "gmail", "yahoo", "hotmail". Return as: { email: "user@domain.com" }'
    );

    let email;
    if (emailExtracted && emailExtracted.email) {
        email = emailExtracted.email;
    } else {
        email = parseEmail(SpeechResult);
    }

    try {
        await sendEmailEstimate(email, 'Customer', {
            serviceType: conv.data.serviceCategory === 'moving' ? `${conv.data.crewSize}-Person Crew Moving` : 'Labor Only',
            distance: conv.data.distance,
            estimatedHours: conv.data.quote.estimatedTime,
            total: conv.data.quote.total
        });

        response.say(`Perfect! I've sent your quote to ${email}. Thanks for calling Worry Free Moving!`);
    } catch (error) {
        response.say("I'm having trouble sending the email. Let me connect you with someone who can help.");
        response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Confirm phone number before sending SMS
 */
function handleConfirmPhoneForSMS(req, res) {
    const { CallSid, From } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Format phone number for speech (e.g., +13306619985 -> "330-661-9985")
    const phoneDigits = From.replace(/^\+1/, ''); // Remove +1
    const areaCode = phoneDigits.substring(0, 3);
    const exchange = phoneDigits.substring(3, 6);
    const number = phoneDigits.substring(6, 10);
    const formattedPhone = `${areaCode} ${exchange} ${number}`;

    response.say(`The number you're calling from is ${formattedPhone}.`);
    response.pause({ length: 1 });

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/send-online-booking-link',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("Is this the number where you'd like to receive the text? Press 1 for yes, or press 9 if you need to speak with someone.");

    response.redirect('/api/twilio/voice');

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Send online booking link at beginning (skip phone call)
 */
async function handleSendOnlineBookingLink(req, res) {
    const { CallSid, From, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Check if customer confirmed
    if (Digits === '9') {
        response.say("Let me connect you with our team.");
        response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
        res.type('text/xml');
        return res.send(response.toString());
    }

    console.log(`📱 Attempting to send booking link SMS to ${From} from ${process.env.TWILIO_PHONE_NUMBER}`);

    try {
        // Simple booking link without quote data (they haven't gotten a quote yet)
        const bookingUrl = `https://worryfreemovers.com/public-booking`;

        // Send SMS with simple booking link
        const message = `Hi! Thanks for calling Worry Free Moving.\n\n` +
            `Get your free quote and book online:\n${bookingUrl}\n\n` +
            `It only takes 2-3 minutes!\n\n` +
            `Questions? Call us: (330) 661-9985\n\n` +
            `Worry Free Moving`;

        console.log(`📱 SMS message length: ${message.length} characters`);

        // Use RingCentral SMS instead of Twilio
        const smsResult = await sendSMS(From, message);

        console.log(`✅ Online booking link SMS sent successfully via RingCentral to ${From}`);

        response.say("Done! I just sent you the link. You should see it in a few seconds. Have a great day!");

    } catch (error) {
        console.error('❌ Error sending online booking link SMS:', {
            error: error.message,
            code: error.code,
            status: error.status,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: From
        });
        response.say("I'm having trouble sending the text. Let me connect you with someone who can help.");
        response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Start booking - collect name
 */
function handleBookingStart(req, res) {
    const { CallSid } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.stage = 'booking-name';
    conversations.set(CallSid, conv);

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/booking-email',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("What's your full name?");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Collect email with AI parsing
 */
async function handleBookingEmail(req, res) {
    const { CallSid, SpeechResult, From } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Use Claude to parse name
    const nameExtracted = await extractWithAI(
        SpeechResult,
        'Customer is providing their full name',
        'Extract firstName and lastName from the name. Handle variations like "John Smith" or "my name is John Smith".'
    );

    if (nameExtracted) {
        conv.data.firstName = nameExtracted.firstName || 'Customer';
        conv.data.lastName = nameExtracted.lastName || '';
    } else {
        const nameParts = (SpeechResult || '').split(' ');
        conv.data.firstName = nameParts[0] || 'Customer';
        conv.data.lastName = nameParts.slice(1).join(' ') || '';
    }

    conv.data.phone = From;

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/booking-date',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("Perfect. What's your email address? Please say it slowly, like john at gmail dot com.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Collect email and confirm it back to customer
 */
async function handleBookingDate(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Use Claude to parse email
    const emailExtracted = await extractWithAI(
        SpeechResult,
        'Customer is providing their email address spoken aloud',
        'Extract email address. Common patterns: "at" = @, "dot" = ., "gmail", "yahoo", "hotmail". Return as: { email: "user@domain.com" }'
    );

    if (emailExtracted && emailExtracted.email) {
        conv.data.email = emailExtracted.email;
    } else {
        conv.data.email = parseEmail(SpeechResult);
    }

    console.log(`📧 Email collected: ${conv.data.email}`);

    // Confirm email back to customer
    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/booking-email-confirm',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    // Format email for speaking (spell out @ and .)
    const emailForSpeaking = conv.data.email.replace('@', ' at ').replace(/\./g, ' dot ');
    gather.say(`I have your email as ${emailForSpeaking}. Is that correct? Press 1 for yes, or press 2 to say it again.`);

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Handle email confirmation
 */
async function handleBookingEmailConfirm(req, res) {
    const { CallSid, Digits, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    const choice = Digits || (SpeechResult && SpeechResult.toLowerCase().includes('yes') ? '1' : '2');

    if (choice === '1') {
        // Email confirmed, ask for date
        console.log(`✅ Email confirmed: ${conv.data.email}`);

        const gather = response.gather({
            input: 'speech',
            action: '/api/twilio/booking-time-slot',
            method: 'POST',
            speechTimeout: 'auto',
            timeout: 15
        });

        gather.say("Perfect! When would you like to move? Please say the date, like December 20th or next Friday.");

        conversations.set(CallSid, conv);
        res.type('text/xml');
        res.send(response.toString());
    } else {
        // Email not confirmed, ask again
        console.log(`🔄 Email not confirmed, asking again`);

        const gather = response.gather({
            input: 'speech',
            action: '/api/twilio/booking-date',
            method: 'POST',
            speechTimeout: 'auto',
            timeout: 15
        });

        gather.say("No problem. Please say your email address again slowly, like john at gmail dot com.");

        conversations.set(CallSid, conv);
        res.type('text/xml');
        res.send(response.toString());
    }
}

/**
 * Check availability and offer time slots
 */
async function handleBookingTimeSlot(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Use Claude to parse date naturally
    const today = new Date().toISOString().split('T')[0];
    const dateExtracted = await extractWithAI(
        SpeechResult,
        `Customer is providing move date. Today is ${today}`,
        'Extract the date in YYYY-MM-DD format. Understand: "next friday", "the 20th", "december 25th", "two weeks from now". Return as: { date: "YYYY-MM-DD" }'
    );

    let moveDate;
    if (dateExtracted && dateExtracted.date) {
        moveDate = dateExtracted.date;
    } else {
        moveDate = parseDateFromSpeech(SpeechResult);
    }

    conv.data.moveDate = moveDate;

    // Check availability for this date
    const slots = await getAvailableSlotsForDate(moveDate);

    if (!slots.anyAvailable) {
        response.say("I'm sorry, we're fully booked that day. Let me connect you with someone who can find the next available date.");
        response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
    } else if (slots.morning && slots.afternoon) {
        response.say("Good news! We have availability that day.");
        response.pause({ length: 1 });

        const gather = response.gather({
            input: 'dtmf speech',
            action: '/api/twilio/booking-create',
            method: 'POST',
            numDigits: 1,
            speechTimeout: 'auto',
            timeout: 10
        });

        gather.say("Would you prefer a morning arrival between 8 and 10 AM? Press 1 or say morning. Or would you prefer afternoon between 2 and 4 PM? Press 2 or say afternoon.");

    } else if (slots.morning) {
        response.say("We have a morning slot available that day, between 8 and 10 AM.");
        conv.data.timeSlot = 'morning';
        conv.data.time = '08:00';
        conversations.set(CallSid, conv);
        response.redirect('/api/twilio/booking-create');

    } else if (slots.afternoon) {
        response.say("We have an afternoon slot available that day, between 2 and 4 PM.");
        conv.data.timeSlot = 'afternoon';
        conv.data.time = '14:00';
        conversations.set(CallSid, conv);
        response.redirect('/api/twilio/booking-create');
    }

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Create booking via API with selected time slot
 */
async function handleBookingCreate(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Parse time slot choice if provided
    if (Digits || SpeechResult) {
        const timeChoice = Digits || parseTimeSlotChoice(SpeechResult);
        if (timeChoice === '1' || timeChoice === 'morning') {
            conv.data.timeSlot = 'morning';
            conv.data.time = '08:00';
        } else if (timeChoice === '2' || timeChoice === 'afternoon') {
            conv.data.timeSlot = 'afternoon';
            conv.data.time = '14:00';
        }
    }

    const moveDate = conv.data.moveDate;

    try {
        const { createAppointment } = require('./database');
        const { sendConfirmationEmail } = require('./emailService');
        const { createGoogleCalendarEvent } = require('./googleCalendar');

        const bookingId = `WF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create appointment using existing system
        const bookingTime = conv.data.time || '09:00';
        const appointment = {
            bookingId,
            company: 'Worry Free Moving',
            firstName: conv.data.firstName,
            lastName: conv.data.lastName,
            email: conv.data.email,
            phone: conv.data.phone,
            date: moveDate,
            time: bookingTime,
            serviceType: conv.data.serviceCategory === 'moving'
                ? `${conv.data.crewSize}-Person Crew Moving`
                : 'Labor Only',
            pickupAddress: conv.data.pickupAddress,
            dropoffAddress: conv.data.deliveryAddress,
            estimatedTotal: conv.data.quote?.total,
            estimatedHours: conv.data.quote?.estimatedTime || 3,
            numMovers: conv.data.crewSize,
            distance: conv.data.distance,
            status: 'confirmed',
            source: 'twilio-voice-ai',
            callSid: CallSid,
            createdAt: new Date().toISOString(),
            notes: `Booked via AI phone - Quote: $${Math.round(conv.data.quote?.total || 0)} - ${conv.data.timeSlot || 'morning'} slot - Distance: ${conv.data.distance} miles`
        };

        // Create in MongoDB
        await createAppointment(appointment);
        console.log(`✅ Booking created in MongoDB: ${bookingId}`);

        // Create in Google Calendar
        try {
            const calendarEvent = await createGoogleCalendarEvent({
                summary: `Move - ${conv.data.firstName} ${conv.data.lastName}`,
                description: `Booking ID: ${bookingId}\nPhone: ${conv.data.phone}\nService: ${appointment.serviceType}\n${conv.data.pickupAddress} → ${conv.data.deliveryAddress}\nEstimated: $${Math.round(conv.data.quote?.total || 0)}`,
                location: conv.data.pickupAddress,
                startTime: `${moveDate}T${bookingTime}:00`,
                endTime: `${moveDate}T${bookingTime}:00`,
                attendees: [conv.data.email]
            });
            console.log(`✅ Booking added to Google Calendar: ${calendarEvent.id}`);
        } catch (calError) {
            console.error('⚠️ Google Calendar creation failed (booking still saved):', calError.message);
        }

        // Send confirmation email with detailed estimate breakdown
        try {
            console.log('📧 Sending confirmation email with detailed estimate...');

            await sendConfirmationEmail({
                to: conv.data.email,
                customerName: `${conv.data.firstName} ${conv.data.lastName}`,
                bookingId,
                company: 'Worry Free Moving',
                date: moveDate,
                time: bookingTime,
                serviceType: appointment.serviceType,
                pickupAddress: conv.data.pickupAddress,
                dropoffAddress: conv.data.deliveryAddress,
                estimateDetails: {
                    total: conv.data.quote?.total,
                    baseRate: conv.data.quote?.baseRate,
                    hourlyRate: conv.data.quote?.hourlyRate,
                    estimatedHours: conv.data.quote?.estimatedTime || conv.data.estimatedHours,
                    distanceCharge: conv.data.quote?.distanceCharge,
                    travelFee: conv.data.quote?.travelFee,
                    stairsFee: conv.data.quote?.stairsFee,
                    heavyItemsFee: conv.data.quote?.heavyItemsFee,
                    packingFee: conv.data.quote?.packingFee,
                    fvpCost: conv.data.quote?.fvpCost,
                    subtotal: conv.data.quote?.subtotal,
                    serviceCharge: conv.data.quote?.serviceCharge,
                    distance: conv.data.distance,
                    numMovers: conv.data.numMovers,
                    serviceCategory: conv.data.serviceCategory,
                    pickupStairs: conv.data.pickupStairs,
                    deliveryStairs: conv.data.deliveryStairs
                }
            });

            console.log('✅ Confirmation email sent with detailed estimate');
        } catch (emailError) {
            console.error('❌ Email send failed:', emailError.message);
            console.error('Email error details:', emailError);
        }

        // Send payment link SMS
        try {
            await sendPaymentLinkSMS(
                conv.data.phone,
                conv.data.firstName,
                bookingId,
                conv.data.quote?.total || 0,
                conv.data.email
            );
        } catch (smsError) {
            console.error('Payment SMS failed:', smsError);
        }

        // Send packing materials email if customer requested materials
        if (conv.data.shouldEmailPackingMaterials && conv.data.packingMaterialsBreakdown) {
            try {
                console.log('📦 Sending packing materials email...');
                await sendPackingMaterialsEmail(
                    conv.data.email,
                    `${conv.data.firstName} ${conv.data.lastName}`,
                    conv.data.packingMaterialsBreakdown,
                    {
                        bedrooms: Math.max(conv.data.pickupBedrooms || 2, conv.data.deliveryBedrooms || 2),
                        pickupAddress: conv.data.pickupAddress,
                        deliveryAddress: conv.data.deliveryAddress
                    }
                );
                console.log('✅ Packing materials email sent');
            } catch (packingEmailError) {
                console.error('❌ Packing materials email failed:', packingEmailError.message);
                // Don't fail the booking if email fails
            }
        }

        const timeSlotText = conv.data.timeSlot === 'afternoon' ? 'afternoon between 2 and 4 PM' : 'morning between 8 and 10 AM';
        response.say(`Perfect! Your move is all set for ${moveDate} in the ${timeSlotText}. Your booking ID is ${bookingId}.`);
        response.pause({ length: 1 });
        response.say(`I've sent a confirmation email to ${conv.data.email}. You'll also receive a text with a link to save your card on file for payment after your move.`);
        response.pause({ length: 1 });
        response.say("Thanks for choosing Worry Free Moving! We'll see you soon!");

    } catch (error) {
        console.error('Booking error:', error);
        response.say("I'm having trouble completing your booking. Let me transfer you to someone who can help.");
        response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Helper functions
 */
function parseMenuChoice(speech) {
    const lower = speech.toLowerCase();
    if (lower.includes('quote') || lower.includes('price') || lower.includes('estimate') || lower.includes('phone')) return '1';
    if (lower.includes('text') || lower.includes('link') || lower.includes('online') || lower.includes('faster')) return '2';
    if (lower.includes('speak') || lower.includes('person') || lower.includes('agent')) return '9';
    return null;
}

function parseServiceType(speech) {
    const lower = speech.toLowerCase();
    if (lower.includes('truck') || lower.includes('mover')) return '1';
    if (lower.includes('labor') || lower.includes('help') || lower.includes('load')) return '2';
    return null;
}

function parseDecisionChoice(speech) {
    const lower = speech.toLowerCase();
    if (lower.includes('book') || lower.includes('schedule') || lower.includes('yes')) return '1';
    if (lower.includes('email') || lower.includes('send')) return '2';
    if (lower.includes('speak') || lower.includes('person') || lower.includes('agent')) return '9';
    return null;
}

function parseEmail(speech) {
    const lower = speech.toLowerCase()
        .replace(/ at /g, '@')
        .replace(/ dot /g, '.')
        .replace(/\s+/g, '');
    return lower;
}

function parseDateFromSpeech(speech) {
    const today = new Date();
    const futureDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return futureDate.toISOString().split('T')[0];
}

function parseTimeSlotChoice(speech) {
    const lower = speech.toLowerCase();
    if (lower.includes('morning') || lower.includes('8') || lower.includes('9 am')) return 'morning';
    if (lower.includes('afternoon') || lower.includes('1') || lower.includes('2 pm')) return 'afternoon';
    return null;
}

function parseHomeTypeChoice(speech) {
    const lower = speech.toLowerCase();
    if (lower.includes('house') || lower.includes('home')) return '1';
    if (lower.includes('apartment') || lower.includes('condo') || lower.includes('flat')) return '2';
    if (lower.includes('storage') || lower.includes('unit')) return '3';
    return null;
}

module.exports = {
    handleIncomingCall,
    handleRecordingComplete,
    handleTranscriptionComplete,
    handleMainMenu,
    handleConfirmPhoneForSMS,
    handleSendOnlineBookingLink,
    handleQuoteServiceType,
    handleQuotePickupAddress,
    handleQuotePickupHomeType,
    handleQuotePickupAddressConfirm,
    handleQuotePickupBedrooms,
    handleQuotePickupStairs,
    handleQuoteDeliveryAddress,
    handleQuoteDeliveryHomeType,
    handleQuoteDeliveryAddressConfirm,
    handleQuoteDeliveryBedrooms,
    handleQuoteDeliveryStairs,
    handleQuoteAppliances,
    handleQuoteAppliancesDetails,
    handleQuoteHeavyItems,
    handleQuoteHeavyItemsDetails,
    handleQuotePackingMaterials,
    handleQuotePackingMaterialsConfirm,
    handleQuotePackingServices,
    handleQuoteInsurance,
    handleQuoteCalculateDistance,
    handleQuoteFinalize,
    handleQuoteDecision,
    handleEmailQuoteSend,
    handleBookingStart,
    handleBookingEmail,
    handleBookingDate,
    handleBookingEmailConfirm,
    handleBookingTimeSlot,
    handleBookingCreate,
    conversations
};
