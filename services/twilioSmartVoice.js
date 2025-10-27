/**
 * Twilio Smart Voice AI - V4 with Full Claude Intelligence
 * Human-like conversation, accurate pricing, calendar-aware booking
 * Powered by Anthropic's Claude 3.5 Sonnet
 */

const twilio = require('twilio');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { getEventsForDate } = require('./googleCalendar');
const { checkAvailability } = require('./calendarManager');
const nodemailer = require('nodemailer');

// Initialize Claude (Anthropic)
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Initialize Twilio client for SMS
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
 * Check calendar availability for specific time slot
 */
async function checkSlotAvailability(date, timeSlot) {
    try {
        const time = timeSlot === 'morning' ? '08:00' : '13:00';
        const availability = await checkAvailability(date, time);
        return availability.available;
    } catch (error) {
        console.error('Error checking slot availability:', error);
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

        await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });

        console.log(`💳 Payment link sent to ${phone}`);
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
            response.say("Perfect! I'll send you a text right now with a link to our online booking form. It's super easy and only takes a couple minutes.");
            response.redirect('/api/twilio/send-online-booking-link');
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
 * Ask pickup home type - with Claude explanation
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

    // Use Claude to generate natural transition
    const naturalResponse = await generateNaturalResponse(
        `Customer provided pickup address: ${conv.data.pickupAddress}`,
        'Acknowledge the address naturally and explain why you need to know the home type (helps estimate crew size and time)'
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
 * Ask delivery home type
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

    // Move to packing services
    response.redirect('/api/twilio/quote-packing-services');

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Ask about packing services with Claude explanation
 */
async function handleQuotePackingServices(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Use Claude to introduce packing services
    const packingIntro = await generateNaturalResponse(
        'Asking if customer needs help packing before their move',
        'Explain that packing is usually done 1-2 days before the move. Keep it natural and helpful, under 2 sentences.'
    );

    if (packingIntro) {
        response.say(packingIntro);
        response.pause({ length: 1 });
    } else {
        response.say("One last thing. We can help you pack too, usually a day or two before your move.");
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

    gather.say("Would you like help with packing? Press 1 for yes, or press 2 for no.");

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

    // Save packing preference
    const needsPacking = Digits === '1';
    conv.data.needsPacking = needsPacking;

    if (needsPacking) {
        // Use Claude to acknowledge and explain packing timeline
        const packingTimeline = await generateNaturalResponse(
            'Customer wants packing services',
            'Briefly acknowledge and mention packing is typically scheduled 1-2 days before the move date. Keep it under 2 sentences.'
        );

        if (packingTimeline) {
            response.say(packingTimeline);
            response.pause({ length: 1 });
        } else {
            response.say("Great! We'll schedule the packing for a day or two before your move date.");
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

    // Parse crew size
    const crewSize = parseInt(Digits) || 2;
    conv.data.crewSize = crewSize;

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
            // Packing services in the format the API expects
            additionalServices: {
                packing: conv.data.needsPacking || false,
                packingMaterials: {},
                movingBlankets: false,
                fvp: false
            }
        };

        console.log('📊 Requesting quote:', JSON.stringify(quoteRequest, null, 2));

        // Call real pricing API
        let quoteResponse;
        try {
            quoteResponse = await axios.post(`${BASE_URL}/api/calculate-estimate`, quoteRequest);
            console.log('✅ Quote API responded:', quoteResponse.status);
        } catch (apiError) {
            console.error('❌ Quote API Error:', {
                status: apiError.response?.status,
                statusText: apiError.response?.statusText,
                data: apiError.response?.data,
                message: apiError.message
            });
            throw apiError;
        }

        const quote = quoteResponse.data;

        if (!quote || !quote.estimate) {
            console.error('❌ Invalid quote response:', quote);
            throw new Error('Invalid quote response from API');
        }

        console.log('💰 Quote received:', JSON.stringify(quote, null, 2));

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

        if (conv.data.serviceCategory === 'moving') {
            response.say(`Great news! Your estimated total is $${total} for ${crewSize} movers with a truck.`);
            response.pause({ length: 1 });
            response.say(`This includes approximately ${hours} hours of service. The final cost depends on actual time needed.`);
        } else {
            response.say(`Your estimated total is $${total} for ${crewSize} helpers.`);
            response.pause({ length: 1 });
            response.say(`This includes labor and a travel fee for the ${Math.round(conv.data.distance)} mile distance.`);
        }

        // Automatically send quote via SMS
        try {
            const quoteMessage = `Your Worry Free Moving Quote:\n\n` +
                `📦 Service: ${conv.data.serviceCategory === 'moving' ? `${crewSize}-Person Crew + Truck` : 'Labor Only'}\n` +
                `📍 From: ${conv.data.pickupAddress}\n` +
                `📍 To: ${conv.data.deliveryAddress}\n` +
                `📏 Distance: ${Math.round(conv.data.distance)} miles\n` +
                `👥 Crew: ${crewSize} movers\n` +
                `⏱️ Est. Time: ${hours} hours\n` +
                `💰 Estimated Total: $${total}\n\n` +
                `This is an estimate. Final cost based on actual time.\n\n` +
                `Ready to book? Press 1\n` +
                `Worry Free Moving\n(330) 661-9985`;

            await twilioClient.messages.create({
                body: quoteMessage,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: conv.customerPhone
            });

            console.log(`📱 Quote SMS sent to ${conv.customerPhone}`);

            response.pause({ length: 1 });
            response.say("I just texted you a copy of your quote for reference.");
        } catch (smsError) {
            console.error('Error sending quote SMS:', smsError);
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
        console.error('Quote calculation error:', error);
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
 * Send online booking link at beginning (skip phone call)
 */
async function handleSendOnlineBookingLink(req, res) {
    const { CallSid, From } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    try {
        // Simple booking link without quote data (they haven't gotten a quote yet)
        const bookingUrl = `https://worryfreemovers.com/public-booking`;

        // Send SMS with simple booking link
        const message = `Hi! Thanks for calling Worry Free Moving.\n\n` +
            `Get your free quote and book online:\n${bookingUrl}\n\n` +
            `It only takes 2-3 minutes!\n\n` +
            `Questions? Call us: (330) 661-9985\n\n` +
            `Worry Free Moving`;

        await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: From
        });

        console.log(`📱 Online booking link SMS sent to ${From}`);

        response.say("Done! I just sent you the link. You should see it in a few seconds. Have a great day!");

    } catch (error) {
        console.error('Error sending online booking link SMS:', error);
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
 * Collect move date with AI parsing
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

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/booking-time-slot',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("Great! When would you like to move? Please say the date, like December 20th or next Friday.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
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

        gather.say("Would you prefer a morning arrival between 8 and 9 AM? Press 1 or say morning. Or would you prefer afternoon between 1 and 2 PM? Press 2 or say afternoon.");

    } else if (slots.morning) {
        response.say("We have a morning slot available that day, between 8 and 9 AM.");
        conv.data.timeSlot = 'morning';
        conv.data.time = '08:00';
        conversations.set(CallSid, conv);
        response.redirect('/api/twilio/booking-create');

    } else if (slots.afternoon) {
        response.say("We have an afternoon slot available that day, between 1 and 2 PM.");
        conv.data.timeSlot = 'afternoon';
        conv.data.time = '13:00';
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
            conv.data.time = '13:00';
        }
    }

    const moveDate = conv.data.moveDate;

    try {
        const { createAppointment } = require('./database');
        const { sendConfirmationEmail } = require('./emailService');

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

        await createAppointment(appointment);
        console.log(`✅ Booking created via phone: ${bookingId}`);

        // Send confirmation email
        try {
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
                estimatedTotal: conv.data.quote?.total
            });
        } catch (emailError) {
            console.error('Email send failed:', emailError);
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

        const timeSlotText = conv.data.timeSlot === 'afternoon' ? 'afternoon between 1 and 2 PM' : 'morning between 8 and 9 AM';
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
    handleSendOnlineBookingLink,
    handleQuoteServiceType,
    handleQuotePickupAddress,
    handleQuotePickupHomeType,
    handleQuotePickupBedrooms,
    handleQuotePickupStairs,
    handleQuoteDeliveryAddress,
    handleQuoteDeliveryHomeType,
    handleQuoteDeliveryBedrooms,
    handleQuoteDeliveryStairs,
    handleQuoteAppliances,
    handleQuoteAppliancesDetails,
    handleQuoteHeavyItems,
    handleQuoteHeavyItemsDetails,
    handleQuotePackingServices,
    handleQuoteCalculateDistance,
    handleQuoteFinalize,
    handleQuoteDecision,
    handleEmailQuoteSend,
    handleBookingStart,
    handleBookingEmail,
    handleBookingDate,
    handleBookingTimeSlot,
    handleBookingCreate,
    conversations
};
