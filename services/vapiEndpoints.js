/**
 * Vapi AI Phone Receptionist API Endpoints
 * These endpoints handle function calls from the Vapi AI assistant
 */

const { calculateQuote, formatQuoteForVoice, saveCallData, syncToOneDrive } = require('./vapiService');
const { checkAvailability } = require('./calendarManager');
const {
    createAppointment,
    createCustomer: createMongoCustomer,
    getCustomerByEmail
} = require('./database');
const { createGoogleCalendarEvent } = require('./googleCalendar');

/**
 * Main Vapi webhook handler
 * Receives all events from Vapi AI assistant
 */
async function handleVapiWebhook(req, res) {
    try {
        const { type, call, message } = req.body;

        console.log(`📞 Vapi Event: ${type}`);

        switch (type) {
            case 'function-call':
                return await handleFunctionCall(req, res);

            case 'call-started':
                console.log(`📞 Call started: ${call.id} from ${call.customer?.number}`);
                return res.json({ success: true });

            case 'call-ended':
                console.log(`📞 Call ended: ${call.id} - Duration: ${call.duration}s`);
                await handleCallEnded(call);
                return res.json({ success: true });

            case 'transcript':
                console.log(`💬 Transcript: ${message.content}`);
                return res.json({ success: true });

            case 'hang':
                console.log(`📞 Call hang detected: ${call.id}`);
                return res.json({ success: true });

            default:
                console.log(`⚠️ Unknown Vapi event type: ${type}`);
                return res.json({ success: true });
        }
    } catch (error) {
        console.error('Error handling Vapi webhook:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Handle function calls from Vapi AI
 */
async function handleFunctionCall(req, res) {
    try {
        const { functionCall, call } = req.body;
        const { name, parameters } = functionCall;

        console.log(`🔧 Function called: ${name}`, parameters);

        switch (name) {
            case 'calculateQuote':
                return await handleCalculateQuote(parameters, res);

            case 'checkAvailability':
                return await handleCheckAvailability(parameters, res);

            case 'bookAppointment':
                return await handleBookAppointment(parameters, call, res);

            case 'sendPaymentLink':
                return await handleSendPaymentLink(parameters, res);

            case 'transferToHuman':
                return await handleTransferToHuman(parameters, call, res);

            case 'createCustomer':
                return await handleCreateCustomer(parameters, res);

            default:
                return res.json({
                    success: false,
                    error: `Unknown function: ${name}`
                });
        }
    } catch (error) {
        console.error('Error handling function call:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Calculate moving quote
 */
async function handleCalculateQuote(parameters, res) {
    try {
        const quoteResult = calculateQuote(parameters);
        const voiceResponse = formatQuoteForVoice(quoteResult);

        return res.json({
            success: true,
            result: quoteResult.quote,
            message: voiceResponse
        });
    } catch (error) {
        console.error('Error calculating quote:', error);
        return res.json({
            success: false,
            error: 'I apologize, I had trouble calculating that quote. Let me transfer you to someone who can help.',
            shouldTransfer: true
        });
    }
}

/**
 * Check availability for a date/time
 */
async function handleCheckAvailability(parameters, res) {
    try {
        const { date, time, serviceType } = parameters;
        const availability = await checkAvailability(date, time, serviceType || 'Moving Service');

        if (availability.available) {
            return res.json({
                success: true,
                available: true,
                message: `Great news! ${date} at ${time} is available. Would you like to book this time slot?`
            });
        } else {
            return res.json({
                success: true,
                available: false,
                message: `I'm sorry, that time slot is already booked. ${availability.reason || 'Would you like to try a different time?'}`,
                alternativeTimes: availability.alternatives || []
            });
        }
    } catch (error) {
        console.error('Error checking availability:', error);
        return res.json({
            success: true,
            available: true, // Default to available if check fails
            message: `Let me book that for you. If there's a conflict, we'll call you right back.`
        });
    }
}

/**
 * Book an appointment
 */
async function handleBookAppointment(parameters, call, res) {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            date,
            time,
            pickupAddress,
            deliveryAddress,
            serviceType,
            estimatedTotal,
            estimatedHours,
            notes
        } = parameters;

        // Generate booking ID
        const bookingId = `WF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create customer record first (if doesn't exist)
        let customer = null;
        try {
            customer = await getCustomerByEmail(email);
        } catch (error) {
            // Customer doesn't exist, create new one
            customer = await createMongoCustomer({
                firstName,
                lastName,
                email,
                phone,
                addresses: [
                    { type: 'pickup', address: pickupAddress },
                    { type: 'delivery', address: deliveryAddress }
                ],
                source: 'ai-phone',
                createdAt: new Date().toISOString()
            });
            console.log(`✅ New customer created: ${customer._id}`);
        }

        // Create appointment
        const appointment = {
            bookingId,
            company: 'Worry Free Moving',
            firstName,
            lastName,
            email,
            phone,
            date,
            time,
            serviceType: serviceType || 'Moving Service',
            pickupAddress,
            dropoffAddress: deliveryAddress,
            notes: notes || 'Booked via AI phone receptionist',
            estimatedHours: estimatedHours || null,
            estimatedTotal: estimatedTotal || null,
            priority: 'normal',
            paymentMethod: 'pending',
            paymentStatus: 'pending',
            status: 'confirmed',
            createdAt: new Date().toISOString(),
            source: 'ai-phone',
            callId: call?.id || null
        };

        const savedAppointment = await createAppointment(appointment);
        console.log(`📅 Appointment created: ${bookingId}`);

        // Create Google Calendar event
        try {
            const calculateEndTime = (startDate, startTime) => {
                const [hours, minutes] = startTime.split(':');
                const endHours = (parseInt(hours) + 2).toString().padStart(2, '0');
                return `${startDate}T${endHours}:${minutes}:00`;
            };

            const eventDetails = {
                summary: `[WF] ${serviceType || 'Moving Service'} - ${firstName} ${lastName}`,
                description: `Booked via AI Phone\n\nBooking ID: ${bookingId}\nPhone: ${phone}\nEmail: ${email}\nPickup: ${pickupAddress}\nDelivery: ${deliveryAddress}\n${notes ? `Notes: ${notes}\n` : ''}${estimatedTotal ? `Estimate: $${estimatedTotal}` : ''}`,
                location: pickupAddress,
                start: `${date}T${time}:00`,
                end: calculateEndTime(date, time),
                attendees: ['zlarimer24@gmail.com']
            };

            await createGoogleCalendarEvent(eventDetails);
            console.log('✅ Synced to Google Calendar');
        } catch (error) {
            console.error('❌ Failed to sync to Google Calendar:', error);
        }

        // Send confirmation email
        try {
            const { sendConfirmationEmail } = require('./emailService');
            await sendConfirmationEmail({
                to: email,
                customerName: `${firstName} ${lastName}`,
                bookingId,
                company: 'Worry Free Moving',
                date,
                time,
                serviceType: serviceType || 'Moving Service',
                pickupAddress,
                dropoffAddress: deliveryAddress,
                estimatedTotal
            });
            console.log('📧 Confirmation email sent');
        } catch (error) {
            console.error('Failed to send confirmation email:', error);
        }

        return res.json({
            success: true,
            bookingId,
            message: `Perfect! Your move is confirmed for ${date} at ${time}. Your booking ID is ${bookingId}. I've sent a confirmation email to ${email} with all the details. Is there anything else I can help you with?`
        });
    } catch (error) {
        console.error('Error booking appointment:', error);
        return res.json({
            success: false,
            error: 'I apologize, I had trouble creating that booking. Let me transfer you to someone who can complete this for you.',
            shouldTransfer: true
        });
    }
}

/**
 * Send Square payment link
 */
async function handleSendPaymentLink(parameters, res) {
    try {
        const { phone, amount, description } = parameters;

        // TODO: Integrate with Square API to generate payment link
        // For now, return a placeholder response

        const paymentLink = `https://square.link/u/EXAMPLE`; // Replace with actual Square link

        // Send SMS with payment link
        try {
            const { sendSMS } = require('./smsService');
            await sendSMS(
                phone,
                `Worry Free Moving Payment\n\n${description}\nAmount: $${amount}\n\nPay securely here: ${paymentLink}\n\nQuestions? Call 330-435-8686`
            );

            return res.json({
                success: true,
                message: `Perfect! I've sent a secure payment link to ${phone}. You can complete the payment whenever you're ready. You'll receive a receipt via email once payment is processed.`
            });
        } catch (error) {
            console.error('Error sending payment link:', error);
            return res.json({
                success: false,
                error: 'I had trouble sending the payment link. I can have someone call you right back to collect payment over the phone, or you can pay when the movers arrive. Which would you prefer?'
            });
        }
    } catch (error) {
        console.error('Error handling payment link:', error);
        return res.json({
            success: false,
            error: 'Payment link error',
            shouldTransfer: true
        });
    }
}

/**
 * Transfer call to human
 */
async function handleTransferToHuman(parameters, call, res) {
    try {
        const { reason, notes } = parameters;

        console.log(`📞 Transferring call to human - Reason: ${reason}`);
        console.log(`📝 Transfer notes: ${notes || 'None'}`);

        // Save transfer info for reporting
        if (call?.id) {
            await saveCallData({
                callId: call.id,
                type: 'transfer',
                reason,
                notes,
                timestamp: new Date().toISOString()
            });
        }

        return res.json({
            success: true,
            transfer: true,
            number: process.env.TRANSFER_NUMBER || '+13304358686', // RingCentral number
            message: `I understand. Let me connect you with one of our moving specialists who can better assist you. Please hold for just a moment.`
        });
    } catch (error) {
        console.error('Error transferring call:', error);
        return res.json({
            success: false,
            error: 'Transfer failed'
        });
    }
}

/**
 * Create customer in CRM
 */
async function handleCreateCustomer(parameters, res) {
    try {
        const customer = await createMongoCustomer({
            ...parameters,
            source: 'ai-phone',
            createdAt: new Date().toISOString()
        });

        return res.json({
            success: true,
            customerId: customer._id,
            message: `I've saved your information. We'll be able to serve you better in the future!`
        });
    } catch (error) {
        console.error('Error creating customer:', error);
        return res.json({
            success: true, // Don't fail the call over this
            message: 'Thank you for that information!'
        });
    }
}

/**
 * Handle call ended event
 */
async function handleCallEnded(call) {
    try {
        // Save full call data
        const callData = {
            callId: call.id,
            type: 'call-ended',
            duration: call.duration,
            customerNumber: call.customer?.number,
            timestamp: new Date().toISOString(),
            transcript: call.transcript || null,
            summary: call.summary || null,
            recordingUrl: call.recordingUrl || null,
            cost: call.cost || null
        };

        await saveCallData(callData);

        // Sync to OneDrive
        await syncToOneDrive();

        console.log(`✅ Call ${call.id} data saved and synced`);
    } catch (error) {
        console.error('Error handling call ended:', error);
    }
}

module.exports = {
    handleVapiWebhook,
    handleFunctionCall,
    handleCallEnded
};
