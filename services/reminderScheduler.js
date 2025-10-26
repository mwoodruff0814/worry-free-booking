/**
 * Automated Reminder Scheduler
 * Runs every hour and sends 24-hour reminders for upcoming appointments
 */

const cron = require('node-cron');
const { send24HourReminder } = require('./emailService');
const { sendSMSConfirmation } = require('./smsService');
const {
    getAppointments: getMongoAppointments,
    updateAppointment
} = require('./database');

/**
 * Get all appointments from MongoDB
 */
async function getAppointments() {
    try {
        return await getMongoAppointments(); // Gets all appointments without filter
    } catch (error) {
        console.error('Error reading appointments from MongoDB:', error);
        return [];
    }
}

/**
 * Update appointment (mark reminder as sent)
 */
async function updateAppointmentReminderSent(bookingId) {
    try {
        await updateAppointment(bookingId, {
            reminderSent: true,
            reminderSentAt: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Error updating appointment in MongoDB:', error);
        return false;
    }
}

/**
 * Check if appointment is within 24 hours
 */
function isWithin24Hours(appointmentDate, appointmentTime) {
    try {
        const now = new Date();
        const appointment = new Date(`${appointmentDate}T${appointmentTime}:00`);
        const hoursDiff = (appointment - now) / (1000 * 60 * 60);

        // Send reminder if between 23-25 hours away
        return hoursDiff >= 23 && hoursDiff <= 25;
    } catch (error) {
        console.error('Error calculating time difference:', error);
        return false;
    }
}

/**
 * Check if appointment is within 2 hours
 */
function isWithin2Hours(appointmentDate, appointmentTime) {
    try {
        const now = new Date();
        const appointment = new Date(`${appointmentDate}T${appointmentTime}:00`);
        const hoursDiff = (appointment - now) / (1000 * 60 * 60);

        // Send reminder if between 1.5-2.5 hours away
        return hoursDiff >= 1.5 && hoursDiff <= 2.5;
    } catch (error) {
        console.error('Error calculating time difference:', error);
        return false;
    }
}

/**
 * Send reminders for appointments in 24 hours
 */
async function send24HourReminders() {
    try {
        console.log('🔍 Checking for appointments needing 24-hour reminders...');

        const appointments = await getAppointments();
        let remindersSent = 0;

        for (const appointment of appointments) {
            // Skip if already cancelled
            if (appointment.status === 'cancelled') {
                continue;
            }

            // Skip if reminder already sent
            if (appointment.reminderSent) {
                continue;
            }

            // Check if within 24 hours
            if (isWithin24Hours(appointment.date, appointment.time)) {
                try {
                    // Send email reminder
                    await send24HourReminder({
                        to: appointment.email,
                        customerName: appointment.firstName,
                        date: appointment.date,
                        time: appointment.time,
                        serviceType: appointment.serviceType,
                        pickupAddress: appointment.pickupAddress
                    });

                    // Send SMS reminder
                    try {
                        await sendSMSConfirmation({
                            phone: appointment.phone,
                            customerName: appointment.firstName,
                            date: appointment.date,
                            time: appointment.time,
                            serviceType: appointment.serviceType,
                            companyName: appointment.company,
                            pickupAddress: appointment.pickupAddress,
                            type: 'reminder'
                        });
                    } catch (error) {
                        console.error('SMS reminder failed:', error);
                    }

                    // Mark reminder as sent in MongoDB
                    await updateAppointmentReminderSent(appointment.bookingId);

                    remindersSent++;
                    console.log(`✅ Reminder sent for booking ${appointment.bookingId}`);

                } catch (error) {
                    console.error(`❌ Failed to send reminder for ${appointment.bookingId}:`, error);
                }
            }
        }

        // Log results
        if (remindersSent > 0) {
            console.log(`📧 Total reminders sent: ${remindersSent}`);
        } else {
            console.log('📭 No reminders to send at this time.');
        }

    } catch (error) {
        console.error('Error in reminder scheduler:', error);
    }
}

/**
 * Send 2-hour SMS reminders for appointments
 */
async function send2HourReminders() {
    try {
        console.log('🔍 Checking for appointments needing 2-hour SMS reminders...');

        const appointments = await getAppointments();
        let remindersSent = 0;

        for (const appointment of appointments) {
            // Skip if already cancelled
            if (appointment.status === 'cancelled') {
                continue;
            }

            // Skip if 2-hour reminder already sent
            if (appointment.twoHourReminderSent) {
                continue;
            }

            // Check if within 2 hours
            if (isWithin2Hours(appointment.date, appointment.time)) {
                try {
                    // Send SMS reminder only (no email)
                    await sendSMSConfirmation({
                        phone: appointment.phone,
                        customerName: appointment.firstName,
                        date: appointment.date,
                        time: appointment.time,
                        serviceType: appointment.serviceType,
                        companyName: appointment.company,
                        pickupAddress: appointment.pickupAddress,
                        type: '2hour-reminder'
                    });

                    // Mark 2-hour reminder as sent in MongoDB
                    await updateAppointment(appointment.bookingId, {
                        twoHourReminderSent: true,
                        twoHourReminderSentAt: new Date().toISOString()
                    });

                    remindersSent++;
                    console.log(`✅ 2-hour SMS reminder sent for booking ${appointment.bookingId}`);

                } catch (error) {
                    console.error(`❌ Failed to send 2-hour reminder for ${appointment.bookingId}:`, error);
                }
            }
        }

        // Log results
        if (remindersSent > 0) {
            console.log(`📱 Total 2-hour SMS reminders sent: ${remindersSent}`);
        } else {
            console.log('📭 No 2-hour reminders to send at this time.');
        }

    } catch (error) {
        console.error('Error in 2-hour reminder scheduler:', error);
    }
}

/**
 * Initialize the reminder scheduler
 * Runs every hour
 */
function initReminderScheduler() {
    console.log('⏰ Starting reminder scheduler...');

    // Run every hour at the top of the hour
    cron.schedule('0 * * * *', async () => {
        console.log('\n⏰ Running scheduled reminder check...');
        await send24HourReminders();
        await send2HourReminders();
    });

    console.log('✅ Reminder scheduler initialized (runs every hour)');

    // Run once on startup for testing
    setTimeout(async () => {
        console.log('\n🔄 Running initial reminder check...');
        await send24HourReminders();
        await send2HourReminders();
    }, 5000); // Wait 5 seconds after server start
}

/**
 * Manually trigger reminder check (for testing)
 */
async function manualReminderCheck() {
    console.log('🔄 Manual reminder check triggered...');
    await send24HourReminders();
}

module.exports = {
    initReminderScheduler,
    send24HourReminders,
    send2HourReminders,
    manualReminderCheck
};
