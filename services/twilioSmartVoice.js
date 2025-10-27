/**
 * Twilio Smart Voice AI - V2
 * Matches chatbot flow exactly, uses real pricing API, smarter booking
 */

const twilio = require('twilio');
const axios = require('axios');

// Conversation state storage
const conversations = new Map();

// Base URL for API calls
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

/**
 * Handle incoming call - intelligent greeting
 */
function handleIncomingCall(req, res) {
    const { CallSid, From } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Initialize conversation
    conversations.set(CallSid, {
        stage: 'greeting',
        data: {},
        customerPhone: From,
        attempts: { transfer: 0 },
        startTime: new Date()
    });

    response.say({
        voice: 'Polly.Joanna'
    }, "Hi! Thanks for calling Worry Free Moving. This is Sarah, your AI assistant.");

    response.pause({ length: 1 });

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/main-menu',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 8
    });

    gather.say("I can help you get a moving quote and schedule your move. Press 1 or say quote to get started. Or, if you've already received a quote and want to book, press 2.");

    response.redirect('/api/twilio/voice');

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Main menu handler
 */
function handleMainMenu(req, res) {
    const { Digits, SpeechResult, CallSid } = req.body;
    const choice = Digits || (SpeechResult ? parseMenuChoice(SpeechResult) : null);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    switch (choice) {
        case '1': // Get quote
            response.redirect('/api/twilio/quote-service-type');
            break;

        case '2': // Already have quote, want to book
            response.say("Great! Let me help you schedule your move.");
            response.redirect('/api/twilio/booking-start');
            break;

        case '9': // Hidden transfer option (not advertised)
            if (conv && conv.attempts.transfer >= 1) {
                response.say("Let me connect you with our team.");
                response.dial(process.env.TRANSFER_NUMBER || '+13307542648');
            } else {
                conv.attempts.transfer++;
                conversations.set(CallSid, conv);
                response.say("I'd love to help you first. Let me get you a quick quote - it only takes a minute.");
                response.redirect('/api/twilio/quote-service-type');
            }
            break;

        default:
            response.say("I didn't catch that.");
            response.redirect('/api/twilio/voice');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Start quote - ask service type
 */
function handleQuoteServiceType(req, res) {
    const { CallSid } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.stage = 'quote-service-type';
    conversations.set(CallSid, conv);

    response.say("Perfect! First, what type of service do you need?");
    response.pause({ length: 1 });

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-crew-size',
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
 * Get crew size
 */
function handleQuoteCrewSize(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // Parse service type
    const serviceChoice = Digits || (SpeechResult ? parseServiceType(SpeechResult) : null);

    if (serviceChoice === '1') {
        conv.data.serviceCategory = 'moving';
        conv.stage = 'quote-crew-size';

        const gather = response.gather({
            input: 'dtmf speech',
            action: '/api/twilio/quote-pickup-address',
            method: 'POST',
            numDigits: 1,
            speechTimeout: 'auto',
            timeout: 10
        });

        gather.say("Got it, movers and truck. How many movers do you need? Press 2 for two movers, press 3 for three movers, or press 4 for four movers.");

    } else if (serviceChoice === '2') {
        conv.data.serviceCategory = 'labor';
        conv.stage = 'quote-crew-size';

        const gather = response.gather({
            input: 'dtmf speech',
            action: '/api/twilio/quote-hours',
            method: 'POST',
            numDigits: 1,
            speechTimeout: 'auto',
            timeout: 10
        });

        gather.say("Perfect, labor only. How many helpers do you need? Press 2 for two people, or press 3 for three people.");

    } else {
        response.say("I didn't catch that.");
        response.redirect('/api/twilio/quote-service-type');
        res.type('text/xml');
        return res.send(response.toString());
    }

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Get hours for labor only
 */
function handleQuoteHours(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.data.crewSize = parseInt(Digits) || 2;

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/quote-hours-parse',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("How many hours do you think you'll need? You can say a number between 2 and 8 hours.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Parse hours and move to address
 */
function handleQuoteHoursParse(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.data.estimatedHours = parseHours(SpeechResult);

    response.say(`Okay, ${conv.data.estimatedHours} hours with ${conv.data.crewSize} people.`);
    response.redirect('/api/twilio/quote-pickup-address');

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Get pickup address
 */
function handleQuotePickupAddress(req, res) {
    const { CallSid, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);

    // If coming from crew size selection
    if (Digits && conv.data.serviceCategory === 'moving') {
        conv.data.crewSize = parseInt(Digits);
        conv.data.serviceType = `${Digits}-person-crew`;
    }

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/quote-delivery-address',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("What's the pickup address? Please say the street address and city.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Get delivery address
 */
function handleQuoteDeliveryAddress(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.data.pickupAddress = SpeechResult;

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/quote-calculate',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("Perfect. And where are you moving to? Please say the full delivery address.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Calculate quote using real API
 */
async function handleQuoteCalculate(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.data.deliveryAddress = SpeechResult;

    response.say("Let me calculate that for you.");
    response.pause({ length: 2 });

    try {
        // Calculate distance using Google Maps or estimation
        const distance = await calculateDistance(conv.data.pickupAddress, conv.data.deliveryAddress);
        const driveTime = Math.round(distance * 2); // Rough estimate: 2 min per mile

        // Prepare quote request
        const quoteRequest = {
            serviceType: conv.data.serviceCategory === 'moving'
                ? `${conv.data.crewSize}-person-crew`
                : 'Labor Only',
            distance: distance,
            driveTime: driveTime,
            estimatedHours: conv.data.estimatedHours || null,
            laborCrewSize: conv.data.serviceCategory === 'labor' ? conv.data.crewSize : null,
            pickupDetails: { homeType: 'house', stairs: 0 },
            dropoffDetails: { homeType: 'house', stairs: 0 }
        };

        // Call real pricing API
        const quoteResponse = await axios.post(`${BASE_URL}/api/calculate-estimate`, quoteRequest);
        const quote = quoteResponse.data;

        // Save quote
        conv.data.quote = quote;
        conv.data.distance = distance;
        conversations.set(CallSid, conv);

        // Present quote
        const total = Math.round(quote.total);

        if (conv.data.serviceCategory === 'moving') {
            response.say(`Great news! Your estimated total is $${total} for ${conv.data.crewSize} movers with a truck.`);
            response.pause({ length: 1 });
            response.say(`This includes approximately ${Math.round(quote.estimatedTime)} hours of service. The final cost depends on actual time needed.`);
        } else {
            response.say(`Your estimated total for labor only is $${total}.`);
            response.pause({ length: 1 });
            response.say(`This includes ${conv.data.estimatedHours} hours with ${conv.data.crewSize} helpers, plus a travel fee.`);
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

        gather.say("Would you like to schedule this move now? Press 1 or say yes to book. Press 2 or say no if you just need the quote for now. Or press 9 to speak with someone.");

    } catch (error) {
        console.error('Quote calculation error:', error);
        response.say("I'm having trouble calculating your quote. Let me connect you with someone who can help.");
        response.dial(process.env.TRANSFER_NUMBER || '+13307542648');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Handle booking decision
 */
function handleQuoteDecision(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const choice = Digits || (SpeechResult ? parseYesNo(SpeechResult) : null);

    if (choice === '1' || choice === 'yes') {
        response.redirect('/api/twilio/booking-start');
    } else if (choice === '9') {
        response.say("Let me transfer you now.");
        response.dial(process.env.TRANSFER_NUMBER || '+13307542648');
    } else {
        response.say("No problem! I'll text you the quote details shortly. Thanks for calling Worry Free Moving!");
        // TODO: Send SMS with quote
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

    response.say("Excellent! Let me get some information to complete your booking.");

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
 * Collect email
 */
function handleBookingEmail(req, res) {
    const { CallSid, SpeechResult, From } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    const nameParts = (SpeechResult || '').split(' ');
    conv.data.firstName = nameParts[0] || 'Customer';
    conv.data.lastName = nameParts.slice(1).join(' ') || '';
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
 * Collect move date
 */
function handleBookingDate(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.data.email = parseEmail(SpeechResult);

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/booking-create',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("Great! When would you like to move? Please say the date, like December 20th.");

    conversations.set(CallSid, conv);
    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Create booking via API
 */
async function handleBookingCreate(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    const moveDate = parseDateFromSpeech(SpeechResult);

    try {
        const { createAppointment } = require('./database');
        const { sendConfirmationEmail } = require('./emailService');

        const bookingId = `WF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create appointment using existing system
        const appointment = {
            bookingId,
            company: 'Worry Free Moving',
            firstName: conv.data.firstName,
            lastName: conv.data.lastName,
            email: conv.data.email,
            phone: conv.data.phone,
            date: moveDate,
            time: '09:00',
            serviceType: conv.data.serviceCategory === 'moving'
                ? `${conv.data.crewSize}-Person Crew Moving`
                : 'Labor Only',
            pickupAddress: conv.data.pickupAddress,
            dropoffAddress: conv.data.deliveryAddress,
            estimatedTotal: conv.data.quote?.total,
            estimatedHours: conv.data.quote?.estimatedTime || conv.data.estimatedHours,
            numMovers: conv.data.crewSize,
            status: 'confirmed',
            source: 'twilio-voice-ai',
            callSid: CallSid,
            createdAt: new Date().toISOString(),
            notes: `Booked via AI phone - Quote: $${Math.round(conv.data.quote?.total || 0)}`
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
                time: '09:00',
                serviceType: appointment.serviceType,
                pickupAddress: conv.data.pickupAddress,
                dropoffAddress: conv.data.deliveryAddress,
                estimatedTotal: conv.data.quote?.total
            });
        } catch (emailError) {
            console.error('Email send failed:', emailError);
        }

        response.say(`Perfect! Your move is confirmed for ${moveDate}. Your booking I D is ${bookingId}.`);
        response.pause({ length: 1 });
        response.say(`We've sent a confirmation email to ${conv.data.email} with all the details. We'll see you on ${moveDate}!`);
        response.pause({ length: 1 });
        response.say("Thanks for choosing Worry Free Moving!");

    } catch (error) {
        console.error('Booking error:', error);
        response.say("I'm having trouble completing your booking. Let me transfer you to someone who can help.");
        response.dial(process.env.TRANSFER_NUMBER || '+13307542648');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Calculate distance between addresses
 * TODO: Replace with Google Maps API for production
 */
async function calculateDistance(pickup, delivery) {
    // Simplified for now - returns estimated miles
    // In production, use Google Maps Distance Matrix API

    // Extract cities if possible
    const pickupLower = pickup.toLowerCase();
    const deliveryLower = delivery.toLowerCase();

    // Same city = 5 miles
    if (pickupLower.includes('canton') && deliveryLower.includes('canton')) return 5;
    if (pickupLower.includes('akron') && deliveryLower.includes('akron')) return 5;

    // Nearby cities = 10-15 miles
    if ((pickupLower.includes('canton') && deliveryLower.includes('massillon')) ||
        (pickupLower.includes('massillon') && deliveryLower.includes('canton'))) return 10;

    if ((pickupLower.includes('canton') && deliveryLower.includes('akron')) ||
        (pickupLower.includes('akron') && deliveryLower.includes('canton'))) return 25;

    // Default assumption
    return 15;
}

/**
 * Helper functions
 */
function parseMenuChoice(speech) {
    const lower = speech.toLowerCase();
    if (lower.includes('quote') || lower.includes('price') || lower.includes('estimate')) return '1';
    if (lower.includes('book') || lower.includes('schedule') || lower.includes('already')) return '2';
    if (lower.includes('speak') || lower.includes('person') || lower.includes('agent')) return '9';
    return null;
}

function parseServiceType(speech) {
    const lower = speech.toLowerCase();
    if (lower.includes('truck') || lower.includes('mover')) return '1';
    if (lower.includes('labor') || lower.includes('help') || lower.includes('load')) return '2';
    return null;
}

function parseYesNo(speech) {
    const lower = speech.toLowerCase();
    if (lower.includes('yes') || lower.includes('yeah') || lower.includes('sure')) return 'yes';
    if (lower.includes('no') || lower.includes('not')) return 'no';
    return null;
}

function parseHours(speech) {
    const numbers = speech.match(/\d+/);
    if (numbers) {
        const hours = parseInt(numbers[0]);
        return Math.min(Math.max(hours, 2), 8); // Clamp between 2-8
    }
    return 3; // Default
}

function parseEmail(speech) {
    // Simple email parsing from speech
    const lower = speech.toLowerCase()
        .replace(/ at /g, '@')
        .replace(/ dot /g, '.')
        .replace(/\s+/g, '');
    return lower;
}

function parseDateFromSpeech(speech) {
    // Simplified date parsing
    const today = new Date();
    const futureDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return futureDate.toISOString().split('T')[0];
}

module.exports = {
    handleIncomingCall,
    handleMainMenu,
    handleQuoteServiceType,
    handleQuoteCrewSize,
    handleQuoteHours,
    handleQuoteHoursParse,
    handleQuotePickupAddress,
    handleQuoteDeliveryAddress,
    handleQuoteCalculate,
    handleQuoteDecision,
    handleBookingStart,
    handleBookingEmail,
    handleBookingDate,
    handleBookingCreate,
    conversations
};
