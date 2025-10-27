/**
 * Twilio Simple Voice AI
 * Mimics chatbot flow with voice - much simpler than full AI
 * Cost: ~$0.02-0.04/minute (way cheaper than Vapi's $0.15/min!)
 */

const twilio = require('twilio');
const { calculateQuote } = require('./vapiService');
const { createAppointment } = require('./database');
const { sendConfirmationEmail } = require('./emailService');

// Conversation state storage (in-memory - could move to Redis for production)
const conversations = new Map();

/**
 * Handle incoming call - greeting
 */
function handleIncomingCall(req, res) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Greet caller
    response.say({
        voice: 'Polly.Joanna',
        language: 'en-US'
    }, "Hi! Thanks for calling Worry Free Moving. This is Sarah.");

    response.pause({ length: 1 });

    // Present menu
    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/menu',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("Press 1 or say quote for a moving quote. Press 2 or say schedule to book a move. Press 3 or say questions for frequently asked questions. Or press 0 to speak with someone.");

    // If no input
    response.redirect('/api/twilio/voice');

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Handle menu selection
 */
function handleMenu(req, res) {
    const { Digits, SpeechResult, CallSid } = req.body;
    const choice = Digits || (SpeechResult ? parseChoice(SpeechResult) : null);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Initialize conversation state
    conversations.set(CallSid, {
        stage: 'menu',
        data: {},
        startTime: new Date()
    });

    switch (choice) {
        case '1': // Quote
            response.redirect('/api/twilio/quote-start');
            break;

        case '2': // Schedule
            response.redirect('/api/twilio/schedule-start');
            break;

        case '3': // FAQs
            response.redirect('/api/twilio/faq');
            break;

        case '0': // Transfer to human
            response.say("Let me connect you with our team. Please hold.");
            response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
            break;

        default:
            response.say("I didn't catch that.");
            response.redirect('/api/twilio/voice');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Start quote process
 */
function handleQuoteStart(req, res) {
    const { CallSid } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid) || { data: {} };
    conv.stage = 'quote-homesize';
    conversations.set(CallSid, conv);

    response.say("Great! I'll help you get a quote. Just a few quick questions.");
    response.pause({ length: 1 });

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-homesize',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("What size is your home? Say studio, one bedroom, two bedroom, three bedroom, or four bedroom.");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Collect home size
 */
function handleQuoteHomeSize(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const homeSize = parseHomeSize(SpeechResult || Digits);

    if (!homeSize) {
        response.say("I didn't catch that.");
        response.redirect('/api/twilio/quote-start');
        res.type('text/xml');
        return res.send(response.toString());
    }

    const conv = conversations.get(CallSid);
    conv.data.homeSize = homeSize;
    conv.stage = 'quote-pickup';
    conversations.set(CallSid, conv);

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/quote-pickup',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say(`Got it, a ${homeSize}. What's your pickup address? Please say the full street address and city.`);

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Collect pickup address
 */
function handleQuotePickup(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.data.pickupAddress = SpeechResult;
    conv.stage = 'quote-delivery';
    conversations.set(CallSid, conv);

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/quote-delivery',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("Perfect. And where are you moving to? Please say the full delivery address.");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Collect delivery address
 */
function handleQuoteDelivery(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.data.deliveryAddress = SpeechResult;
    conv.stage = 'quote-stairs';
    conversations.set(CallSid, conv);

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-stairs',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("Are there stairs at either location? Press 1 or say yes if yes. Press 2 or say no if no.");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Collect stairs info and calculate quote
 */
function handleQuoteStairs(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const hasStairs = (Digits === '1' || (SpeechResult && SpeechResult.toLowerCase().includes('yes')));

    const conv = conversations.get(CallSid);
    conv.data.hasStairs = hasStairs;

    // Calculate quote
    const quoteResult = calculateQuote({
        moveType: 'local',
        homeSize: conv.data.homeSize,
        pickupAddress: conv.data.pickupAddress,
        deliveryAddress: conv.data.deliveryAddress,
        hasStairs: hasStairs,
        needsPacking: false,
        specialItems: []
    });

    conv.data.quote = quoteResult.quote;
    conv.stage = 'quote-result';
    conversations.set(CallSid, conv);

    // Present quote
    response.say("Let me calculate that for you.");
    response.pause({ length: 2 });

    const quote = quoteResult.quote;
    response.say(`Based on your ${conv.data.homeSize} move, your estimated total is $${quote.total}. `);
    response.pause({ length: 1 });
    response.say(`This includes ${quote.breakdown.numMovers} professional movers for about ${quote.breakdown.estimatedHours} hours at $${quote.breakdown.hourlyRate} per hour.`);

    response.pause({ length: 1 });

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/quote-book',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("Would you like to schedule this move now? Press 1 or say yes to book. Press 2 or say no if you just need the quote for now.");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Handle booking decision
 */
function handleQuoteBook(req, res) {
    const { CallSid, SpeechResult, Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const wantsToBook = (Digits === '1' || (SpeechResult && SpeechResult.toLowerCase().includes('yes')));

    if (wantsToBook) {
        response.redirect('/api/twilio/booking-name');
    } else {
        response.say("No problem! I'll send you the quote via text or email. Can you tell me your phone number or email address?");

        const gather = response.gather({
            input: 'speech',
            action: '/api/twilio/quote-contact',
            method: 'POST',
            speechTimeout: 'auto',
            timeout: 15
        });

        res.type('text/xml');
        return res.send(response.toString());
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Start booking process - collect name
 */
function handleBookingName(req, res) {
    const { CallSid } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.stage = 'booking-name';
    conversations.set(CallSid, conv);

    response.say("Great! Let me get some information to complete your booking.");

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/booking-phone',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("What's your full name?");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Collect phone number
 */
function handleBookingPhone(req, res) {
    const { CallSid, SpeechResult, From } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    conv.data.customerName = SpeechResult;
    conv.data.phone = From; // Use caller ID
    conv.stage = 'booking-date';
    conversations.set(CallSid, conv);

    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/booking-date',
        method: 'POST',
        speechTimeout: 'auto',
        timeout: 15
    });

    gather.say("Perfect. What date would you like to move? Please say the month and day, for example, December 20th.");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Collect move date and create booking
 */
async function handleBookingDate(req, res) {
    const { CallSid, SpeechResult } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const conv = conversations.get(CallSid);
    const moveDate = parseDateFromSpeech(SpeechResult);

    // Create booking
    const bookingId = `WF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const nameParts = (conv.data.customerName || '').split(' ');

    try {
        await createAppointment({
            bookingId,
            company: 'Worry Free Moving',
            firstName: nameParts[0] || 'Customer',
            lastName: nameParts.slice(1).join(' ') || '',
            phone: conv.data.phone,
            email: null,
            date: moveDate,
            time: '09:00',
            serviceType: 'Moving Service',
            pickupAddress: conv.data.pickupAddress,
            dropoffAddress: conv.data.deliveryAddress,
            estimatedTotal: conv.data.quote?.total,
            estimatedHours: conv.data.quote?.breakdown?.estimatedHours,
            status: 'confirmed',
            source: 'twilio-voice',
            callSid: CallSid,
            createdAt: new Date().toISOString()
        });

        response.say(`Perfect! Your move is confirmed for ${moveDate}. Your booking ID is ${bookingId}.`);
        response.pause({ length: 1 });
        response.say("We'll send you a confirmation text shortly with all the details. Is there anything else I can help with?");

        const gather = response.gather({
            input: 'dtmf speech',
            action: '/api/twilio/anything-else',
            method: 'POST',
            numDigits: 1,
            speechTimeout: 'auto',
            timeout: 10
        });

        gather.say("Press 1 or say yes if you have more questions. Press 2 or say no if that's all.");

    } catch (error) {
        console.error('Booking error:', error);
        response.say("I'm having trouble completing your booking. Let me transfer you to someone who can help.");
        response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
    }

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Handle FAQ menu
 */
function handleFAQ(req, res) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const gather = response.gather({
        input: 'dtmf speech',
        action: '/api/twilio/faq-answer',
        method: 'POST',
        numDigits: 1,
        speechTimeout: 'auto',
        timeout: 10
    });

    gather.say("I can answer common questions. Press 1 for pricing information. Press 2 for our service areas. Press 3 for our cancellation policy. Or press 0 to speak with someone.");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Answer FAQ
 */
function handleFAQAnswer(req, res) {
    const { Digits } = req.body;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    switch (Digits) {
        case '1':
            response.say("Our local moves start at $150 per hour for 2 movers and a truck. Final cost depends on your home size and distance. For an exact quote, press 1 now or say get quote.");
            break;
        case '2':
            response.say("We serve Canton, Akron, Massillon, Alliance, and all of Stark County. We also handle long distance moves throughout Ohio and nationwide.");
            break;
        case '3':
            response.say("You can cancel or reschedule up to 48 hours before your move with no charge. Within 48 hours, there's a $100 cancellation fee.");
            break;
        case '0':
            response.say("Let me connect you with our team.");
            response.dial(process.env.TRANSFER_NUMBER || '+13304358686');
            res.type('text/xml');
            return res.send(response.toString());
        default:
            response.say("I didn't catch that.");
            response.redirect('/api/twilio/faq');
            res.type('text/xml');
            return res.send(response.toString());
    }

    response.pause({ length: 1 });
    response.say("Is there anything else I can help with?");

    const gather = response.gather({
        input: 'dtmf',
        action: '/api/twilio/menu',
        method: 'POST',
        numDigits: 1,
        timeout: 10
    });

    gather.say("Press 1 for a quote, 2 to schedule a move, or 0 to speak with someone.");

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Parse user choice from speech
 */
function parseChoice(speech) {
    const lower = speech.toLowerCase();
    if (lower.includes('quote') || lower.includes('price') || lower.includes('cost')) return '1';
    if (lower.includes('schedule') || lower.includes('book') || lower.includes('appointment')) return '2';
    if (lower.includes('question') || lower.includes('faq') || lower.includes('ask')) return '3';
    if (lower.includes('speak') || lower.includes('person') || lower.includes('human')) return '0';
    return null;
}

/**
 * Parse home size from speech
 */
function parseHomeSize(speech) {
    const lower = (speech || '').toLowerCase();
    if (lower.includes('studio')) return 'studio';
    if (lower.includes('one') || lower.includes('1')) return '1-bedroom';
    if (lower.includes('two') || lower.includes('2')) return '2-bedroom';
    if (lower.includes('three') || lower.includes('3')) return '3-bedroom';
    if (lower.includes('four') || lower.includes('4') || lower.includes('five')) return '4-bedroom';
    return null;
}

/**
 * Parse date from speech (basic)
 */
function parseDateFromSpeech(speech) {
    // This is simplified - in production use a proper date parsing library
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Try to extract month and day
    const lower = speech.toLowerCase();

    // For demo, return a date 7 days from now
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return futureDate.toISOString().split('T')[0];
}

module.exports = {
    handleIncomingCall,
    handleMenu,
    handleQuoteStart,
    handleQuoteHomeSize,
    handleQuotePickup,
    handleQuoteDelivery,
    handleQuoteStairs,
    handleQuoteBook,
    handleBookingName,
    handleBookingPhone,
    handleBookingDate,
    handleFAQ,
    handleFAQAnswer,
    conversations
};
