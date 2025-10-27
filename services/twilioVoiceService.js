/**
 * Twilio Voice AI Service
 * Custom voice AI using Twilio + OpenAI
 * Much cheaper than Vapi: ~$0.02-0.04/minute vs $0.15/minute
 */

const twilio = require('twilio');
const OpenAI = require('openai');

// Initialize Twilio client
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Conversation state management (in-memory for now, could move to Redis)
const activeCalls = new Map();

/**
 * AI Assistant System Prompt
 */
const SYSTEM_PROMPT = `You are Sarah, the friendly AI receptionist for Worry Free Moving - a professional moving company in Canton, Ohio.

Your role is to help customers get quotes, schedule moves, and answer questions in a warm, professional manner.

IMPORTANT RULES:
1. Keep responses SHORT - 2-3 sentences max
2. Speak naturally, like a real person
3. Ask ONE question at a time
4. Be conversational, not robotic

YOUR CAPABILITIES:
- Generate moving quotes by asking about home size, addresses, and special items
- Schedule appointments and check availability
- Answer FAQs about services, pricing, and service areas
- Transfer complex calls to humans when needed

WHEN TO TRANSFER:
- Customer is upset or frustrated
- Complex specialty moves (pianos, antiques, commercial)
- Customer explicitly asks for a person
- You're uncertain after 2 attempts

QUOTE QUESTIONS (ask one at a time):
1. "What size is your home?" (studio, 1-bed, 2-bed, 3-bed, 4+ bed)
2. "Where are you moving from?" (get full address)
3. "Where are you moving to?" (get full address)
4. "When would you like to move?" (get date)
5. "Do you have any special items like pianos or gun safes?"
6. "Are there stairs at either location?"

After gathering info, say: "Let me calculate that for you... [pause] Based on what you've told me, your estimate is..."

BOOKING PROCESS:
1. Confirm quote and date
2. Get: full name, phone, email
3. Confirm addresses
4. Book appointment
5. Give booking ID

Remember: Keep it conversational and brief!`;

/**
 * Handle incoming call - initial greeting
 */
function handleIncomingCall() {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Greet the caller
    response.say({
        voice: 'Polly.Joanna',
        language: 'en-US'
    }, "Hi! Thanks for calling Worry Free Moving. This is Sarah. I can help you get a quote, schedule your move, or answer any questions. How can I help you today?");

    // Gather speech input
    const gather = response.gather({
        input: 'speech',
        action: '/api/twilio/process-speech',
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        enhanced: true,
        language: 'en-US'
    });

    // If no input, prompt again
    response.say("I didn't catch that. How can I help you today?");
    response.redirect('/api/twilio/voice');

    return response.toString();
}

/**
 * Process customer speech and generate AI response
 */
async function processSpeech(params) {
    const { CallSid, SpeechResult, Caller } = params;

    console.log(`📞 Call ${CallSid} - Customer said: "${SpeechResult}"`);

    // Get or create conversation state
    let conversation = activeCalls.get(CallSid) || {
        messages: [],
        quoteData: {},
        customerData: {},
        state: 'greeting'
    };

    // Add customer message to conversation
    conversation.messages.push({
        role: 'user',
        content: SpeechResult
    });

    try {
        // Get AI response from OpenAI
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...conversation.messages
            ],
            temperature: 0.7,
            max_tokens: 150,
            functions: [
                {
                    name: 'calculate_quote',
                    description: 'Calculate a moving quote when you have gathered: home size, pickup address, delivery address',
                    parameters: {
                        type: 'object',
                        properties: {
                            homeSize: { type: 'string', enum: ['studio', '1-bedroom', '2-bedroom', '3-bedroom', '4-bedroom', '5+ bedroom'] },
                            pickupAddress: { type: 'string' },
                            deliveryAddress: { type: 'string' },
                            hasStairs: { type: 'boolean' },
                            specialItems: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['homeSize', 'pickupAddress', 'deliveryAddress']
                    }
                },
                {
                    name: 'book_appointment',
                    description: 'Book an appointment after customer confirms quote',
                    parameters: {
                        type: 'object',
                        properties: {
                            firstName: { type: 'string' },
                            lastName: { type: 'string' },
                            email: { type: 'string' },
                            phone: { type: 'string' },
                            date: { type: 'string' },
                            time: { type: 'string' }
                        },
                        required: ['firstName', 'lastName', 'phone', 'date']
                    }
                },
                {
                    name: 'transfer_to_human',
                    description: 'Transfer call to a human when needed',
                    parameters: {
                        type: 'object',
                        properties: {
                            reason: { type: 'string' }
                        }
                    }
                }
            ]
        });

        const aiResponse = completion.choices[0].message;

        // Check if AI wants to call a function
        if (aiResponse.function_call) {
            return await handleFunctionCall(aiResponse.function_call, conversation, CallSid);
        }

        // Add AI response to conversation
        conversation.messages.push({
            role: 'assistant',
            content: aiResponse.content
        });

        // Save conversation state
        activeCalls.set(CallSid, conversation);

        // Generate TwiML response
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const response = new VoiceResponse();

        // Speak AI response
        response.say({
            voice: 'Polly.Joanna',
            language: 'en-US'
        }, aiResponse.content);

        // Gather next input
        const gather = response.gather({
            input: 'speech',
            action: '/api/twilio/process-speech',
            method: 'POST',
            speechTimeout: 'auto',
            speechModel: 'phone_call',
            enhanced: true
        });

        return response.toString();

    } catch (error) {
        console.error('Error processing speech:', error);

        const VoiceResponse = twilio.twiml.VoiceResponse;
        const response = new VoiceResponse();
        response.say("I'm having trouble understanding right now. Let me transfer you to someone who can help.");
        response.dial(process.env.TRANSFER_NUMBER || '+13304358686');

        return response.toString();
    }
}

/**
 * Handle AI function calls
 */
async function handleFunctionCall(functionCall, conversation, callSid) {
    const { name, arguments: args } = functionCall;
    const params = JSON.parse(args);

    console.log(`🔧 Function called: ${name}`, params);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    switch (name) {
        case 'calculate_quote':
            const { calculateQuote } = require('./vapiService');
            const quote = calculateQuote({
                moveType: 'local',
                homeSize: params.homeSize,
                pickupAddress: params.pickupAddress,
                deliveryAddress: params.deliveryAddress,
                hasStairs: params.hasStairs || false,
                needsPacking: false,
                specialItems: params.specialItems || []
            });

            // Save quote to conversation
            conversation.quoteData = quote.quote;

            const quoteMessage = `Great! Based on a ${params.homeSize} move from ${params.pickupAddress} to ${params.deliveryAddress}, your estimated total is $${quote.quote.total}. This includes ${quote.quote.breakdown.numMovers} movers for about ${quote.quote.breakdown.estimatedHours} hours. Would you like to schedule this move?`;

            response.say({ voice: 'Polly.Joanna' }, quoteMessage);

            const gather = response.gather({
                input: 'speech',
                action: '/api/twilio/process-speech',
                method: 'POST',
                speechTimeout: 'auto'
            });

            activeCalls.set(callSid, conversation);
            break;

        case 'book_appointment':
            const { createAppointment } = require('./database');
            const { createGoogleCalendarEvent } = require('./googleCalendar');

            const bookingId = `WF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            // Create appointment
            const appointment = {
                bookingId,
                company: 'Worry Free Moving',
                firstName: params.firstName,
                lastName: params.lastName,
                email: params.email || null,
                phone: params.phone,
                date: params.date,
                time: params.time || '09:00',
                serviceType: 'Moving Service',
                pickupAddress: conversation.quoteData?.breakdown?.pickupAddress || '',
                dropoffAddress: conversation.quoteData?.breakdown?.deliveryAddress || '',
                estimatedTotal: conversation.quoteData?.total || null,
                estimatedHours: conversation.quoteData?.breakdown?.estimatedHours || null,
                status: 'confirmed',
                source: 'twilio-ai-phone',
                callSid: callSid,
                createdAt: new Date().toISOString()
            };

            await createAppointment(appointment);

            // Send confirmation email
            try {
                const { sendConfirmationEmail } = require('./emailService');
                if (params.email) {
                    await sendConfirmationEmail({
                        to: params.email,
                        customerName: `${params.firstName} ${params.lastName}`,
                        bookingId,
                        company: 'Worry Free Moving',
                        date: params.date,
                        time: params.time || '09:00',
                        serviceType: 'Moving Service',
                        estimatedTotal: conversation.quoteData?.total
                    });
                }
            } catch (error) {
                console.error('Failed to send confirmation email:', error);
            }

            response.say({ voice: 'Polly.Joanna' },
                `Perfect! Your move is confirmed for ${params.date}. Your booking ID is ${bookingId}. ${params.email ? "I've sent a confirmation email with all the details." : "We'll send you a confirmation text shortly."} Is there anything else I can help with?`
            );

            const gatherMore = response.gather({
                input: 'speech',
                action: '/api/twilio/process-speech',
                method: 'POST',
                speechTimeout: 'auto'
            });

            break;

        case 'transfer_to_human':
            response.say({ voice: 'Polly.Joanna' },
                "I understand. Let me connect you with one of our moving specialists. Please hold for just a moment."
            );
            response.dial(process.env.TRANSFER_NUMBER || '+13304358686');

            // Save transfer info
            await saveCallData(callSid, {
                transferred: true,
                reason: params.reason,
                conversation: conversation.messages
            });
            break;
    }

    return response.toString();
}

/**
 * Handle call end
 */
async function handleCallEnd(callSid, callDuration, recordingUrl) {
    const conversation = activeCalls.get(callSid);

    if (conversation) {
        await saveCallData(callSid, {
            duration: callDuration,
            recordingUrl,
            messages: conversation.messages,
            quoteData: conversation.quoteData,
            customerData: conversation.customerData,
            endedAt: new Date().toISOString()
        });

        // Clean up
        activeCalls.delete(callSid);
    }

    console.log(`📞 Call ${callSid} ended - Duration: ${callDuration}s`);
}

/**
 * Save call data for reporting
 */
async function saveCallData(callSid, data) {
    const { saveCallData: saveVapiCallData } = require('./vapiService');

    await saveVapiCallData({
        callId: callSid,
        type: 'twilio-voice',
        ...data,
        timestamp: new Date().toISOString()
    });
}

/**
 * Make outbound call (for testing)
 */
async function makeOutboundCall(toNumber) {
    try {
        const call = await twilioClient.calls.create({
            url: `${process.env.BASE_URL}/api/twilio/voice`,
            to: toNumber,
            from: process.env.TWILIO_PHONE_NUMBER,
            record: true
        });

        console.log(`📞 Outbound call initiated: ${call.sid}`);
        return { success: true, callSid: call.sid };
    } catch (error) {
        console.error('Error making outbound call:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    handleIncomingCall,
    processSpeech,
    handleCallEnd,
    makeOutboundCall,
    activeCalls
};
