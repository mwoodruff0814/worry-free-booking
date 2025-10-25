const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
dotenv.config();

// Import modules
const { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent, initGoogleAuth } = require('./services/googleCalendar');
// const { createICloudCalendarEvent } = require('./services/icloudCalendar'); // Disabled - using email calendar buttons instead
const { sendConfirmationEmail } = require('./services/emailService');
const { generateBookingId } = require('./utils/helpers');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS, images, etc.)
app.use(express.static(__dirname));

// Appointments storage files - separate for each company
const WORRYFREE_APPOINTMENTS_FILE = path.join(__dirname, 'data', 'appointments.json');
const QUALITY_APPOINTMENTS_FILE = path.join(__dirname, 'data', 'quality-appointments.json');
const APPOINTMENTS_FILE = WORRYFREE_APPOINTMENTS_FILE; // Keep for backward compatibility

// Helper function to format calendar event descriptions with action links
function formatCalendarDescription(appointment) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    const {
        bookingId,
        company,
        firstName,
        lastName,
        phone,
        email,
        serviceType,
        pickupAddress,
        dropoffAddress,
        estimatedHours,
        numMovers,
        priority,
        crewAssignment,
        notes,
        estimateDetails,
        estimatedTotal,
        date,
        time
    } = appointment;

    const isQualityMoving = company === 'Quality Moving';

    // Base appointment details (same for both companies)
    let description = `
${date} ${time} EST
Calendar: ${company || 'Worry Free Moving'}
Name: ${firstName} ${lastName}
Phone: ${phone}
Email: ${email}

${pickupAddress ? `Location\n============\n${pickupAddress}\n\n` : ''}
${serviceType || 'Moving Service'}
============
${dropoffAddress ? `Destination: ${dropoffAddress}\n` : ''}
${estimatedHours ? `Estimated Hours: ${estimatedHours}` : ''}
${numMovers ? `Number of Movers: ${numMovers}` : ''}
${priority && priority !== 'normal' ? `PRIORITY: ${priority.toUpperCase()}` : ''}
${crewAssignment ? `Crew Assignment: ${crewAssignment}` : ''}

${notes ? `Additional Notes\n============\n${notes}\n\n` : ''}
${estimateDetails ? `Estimate: $${estimateDetails.total}` : estimatedTotal ? `Estimate: $${estimatedTotal}` : ''}
    `.trim();

    // Different management sections based on company
    if (isQualityMoving) {
        description += `

============================================
MANAGE APPOINTMENT
============================================

To change or reschedule this appointment:
Please contact MovingHelp.com or UHaul.com where you originally booked.

Cancel Appointment:
${baseUrl}/admin.html?cancel=${bookingId}

Booking ID: ${bookingId}`;
    } else {
        description += `

============================================
MANAGE APPOINTMENT
============================================

View Details:
${baseUrl}/admin.html?view=${bookingId}

Change Appointment:
${baseUrl}/admin.html?edit=${bookingId}

Cancel Appointment:
${baseUrl}/admin.html?cancel=${bookingId}

Booking ID: ${bookingId}`;
    }

    return description;
}

// Ensure data directory exists
async function ensureDataDirectory() {
    const dataDir = path.join(__dirname, 'data');
    try {
        await fs.mkdir(dataDir, { recursive: true });

        // Ensure Worry Free appointments file exists
        try {
            await fs.access(WORRYFREE_APPOINTMENTS_FILE);
        } catch {
            await fs.writeFile(WORRYFREE_APPOINTMENTS_FILE, JSON.stringify([], null, 2));
        }

        // Ensure Quality Moving appointments file exists
        try {
            await fs.access(QUALITY_APPOINTMENTS_FILE);
        } catch {
            await fs.writeFile(QUALITY_APPOINTMENTS_FILE, JSON.stringify([], null, 2));
        }
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// Get appointments for a specific company
async function getAppointmentsByCompany(company) {
    try {
        const file = company === 'Quality Moving' ? QUALITY_APPOINTMENTS_FILE : WORRYFREE_APPOINTMENTS_FILE;
        const data = await fs.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${company} appointments:`, error);
        return [];
    }
}

// Save appointments for a specific company
async function saveAppointmentsByCompany(company, appointments) {
    try {
        const file = company === 'Quality Moving' ? QUALITY_APPOINTMENTS_FILE : WORRYFREE_APPOINTMENTS_FILE;
        await fs.writeFile(file, JSON.stringify(appointments, null, 2));
        return true;
    } catch (error) {
        console.error(`Error saving ${company} appointments:`, error);
        return false;
    }
}

// Get all appointments (from both companies) - used for availability checking
async function getAllAppointments() {
    try {
        const worryFree = await getAppointmentsByCompany('Worry Free Moving');
        const quality = await getAppointmentsByCompany('Quality Moving');
        return [...worryFree, ...quality];
    } catch (error) {
        console.error('Error reading all appointments:', error);
        return [];
    }
}

// Legacy functions for backward compatibility
async function getAppointments() {
    return await getAppointmentsByCompany('Worry Free Moving');
}

async function saveAppointments(appointments) {
    return await saveAppointmentsByCompany('Worry Free Moving', appointments);
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Booking system is running' });
});

// Get available time slots
app.get('/api/available-slots', async (req, res) => {
    try {
        const { date } = req.query;

        // Use multi-calendar system to check availability across ALL calendars
        const { getAvailableSlots } = require('./services/calendarManager');
        const slots = await getAvailableSlots(date);

        res.json({ success: true, slots });
    } catch (error) {
        console.error('Error fetching available slots:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch available slots' });
    }
});

// Create a new booking
app.post('/api/book-appointment', async (req, res) => {
    try {
        const {
            company,
            firstName,
            lastName,
            email,
            phone,
            date,
            time,
            serviceType,
            pickupAddress,
            dropoffAddress,
            notes,
            estimateDetails,
            estimatedHours,
            numMovers,
            estimatedTotal,
            priority,
            crewAssignment,
            jobTag,
            paymentMethod,
            paymentStatus,
            sendConfirmation
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !phone || !date || !time) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Determine company - default to Worry Free if not specified
        const bookingCompany = company || 'Worry Free Moving';

        // Generate booking ID with company prefix
        const prefix = bookingCompany === 'Quality Moving' ? 'QM' : 'WF';
        const bookingId = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Calculate end time (2 hours after start)
        const calculateEndTime = (startDate, startTime) => {
            const [hours, minutes] = startTime.split(':');
            const endHours = (parseInt(hours) + 2).toString().padStart(2, '0');
            return `${startDate}T${endHours}:${minutes}:00`;
        };

        // Create appointment object first (without googleEventId)
        const appointment = {
            bookingId,
            company: bookingCompany,
            firstName,
            lastName,
            email,
            phone,
            date,
            time,
            serviceType: serviceType || 'Moving Service',
            pickupAddress: pickupAddress || '',
            dropoffAddress: dropoffAddress || '',
            notes: notes || '',
            estimateDetails: estimateDetails || null,
            estimatedHours: estimatedHours || null,
            numMovers: numMovers || null,
            estimatedTotal: estimatedTotal || null,
            priority: priority || 'normal',
            crewAssignment: crewAssignment || null,
            jobTag: jobTag || 'standard',
            paymentMethod: paymentMethod || 'pending',
            paymentStatus: paymentStatus || 'pending',
            status: 'confirmed',
            googleEventId: null,
            createdAt: new Date().toISOString()
        };

        // Create calendar event details using formatted description
        const eventDetails = {
            summary: `[${bookingCompany === 'Quality Moving' ? 'QM' : 'WF'}] ${serviceType || 'Moving Service'} - ${firstName} ${lastName}`,
            description: formatCalendarDescription(appointment),
            location: pickupAddress || '',
            start: `${date}T${time}:00`,
            end: calculateEndTime(date, time),
            attendees: ['zlarimer24@gmail.com']
        };

        // Add to Google Calendar (both Matt's and Zach's calendars)
        try {
            const googleEventIds = await createGoogleCalendarEvent(eventDetails);
            appointment.googleEventId = googleEventIds; // { matt: id, zach: id }
            console.log('✅ Google Calendar events created:', googleEventIds);
        } catch (error) {
            console.error('❌ Failed to create Google Calendar event:', error);
            // Continue even if Google Calendar fails
        }

        // Save to company-specific storage
        const appointments = await getAppointmentsByCompany(bookingCompany);
        appointments.push(appointment);
        await saveAppointmentsByCompany(bookingCompany, appointments);

        console.log(`📋 ${bookingCompany} booking created: ${bookingId}`);

        // iCloud Calendar disabled - customers can add via email calendar buttons instead
        // try {
        //     await createICloudCalendarEvent(eventDetails);
        //     console.log('iCloud Calendar event created');
        // } catch (error) {
        //     console.error('Failed to create iCloud Calendar event:', error);
        //     // Continue even if iCloud Calendar fails
        // }

        // Send emails and SMS only if sendConfirmation is not explicitly false
        const shouldSendNotifications = sendConfirmation !== false;

        if (shouldSendNotifications) {
            // Send confirmation email to customer
            try {
                await sendConfirmationEmail({
                    to: email,
                    customerName: `${firstName} ${lastName}`,
                    bookingId,
                    company: bookingCompany,
                    date,
                    time,
                    serviceType: serviceType || 'Moving Service',
                    pickupAddress,
                    dropoffAddress,
                    estimateDetails,
                    estimatedTotal
                });
                console.log(`📧 Confirmation email sent to customer (${bookingCompany})`);
            } catch (error) {
                console.error('Failed to send confirmation email:', error);
            }

            // Send notification email to company
            const { sendCompanyNotification } = require('./services/emailService');
            try {
                await sendCompanyNotification({
                    customerName: `${firstName} ${lastName}`,
                    bookingId,
                    company: bookingCompany,
                    date,
                    time,
                    serviceType: serviceType || 'Moving Service',
                    pickupAddress,
                    dropoffAddress,
                    phone,
                    email,
                    estimateDetails,
                    estimatedTotal,
                    estimatedHours,
                    numMovers,
                    priority,
                    crewAssignment,
                    jobTag
                });
                console.log(`📧 Company notification sent (${bookingCompany})`);
            } catch (error) {
                console.error('Failed to send company notification:', error);
            }

            // Send SMS confirmation
            const { sendSMSConfirmation } = require('./services/smsService');
            try {
                await sendSMSConfirmation({
                    phone,
                    customerName: firstName,
                    companyName: bookingCompany,
                    serviceType,
                    pickupAddress,
                    date,
                    time,
                    type: 'booking'
                });
                console.log(`📱 SMS confirmation sent (${bookingCompany})`);
            } catch (error) {
                console.error('Failed to send SMS:', error);
            }
        } else {
            console.log('⚠️ Email/SMS notifications skipped (Admin disabled)');
        }

        res.json({
            success: true,
            bookingId,
            appointment,
            message: 'Appointment booked successfully!'
        });

    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to book appointment'
        });
    }
});

// Get appointment by booking ID
app.get('/api/appointment/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const appointments = await getAppointments();
        const appointment = appointments.find(apt => apt.bookingId === bookingId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        res.json({ success: true, appointment });
    } catch (error) {
        console.error('Error fetching appointment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch appointment'
        });
    }
});

// Reschedule appointment
app.post('/api/reschedule-appointment', async (req, res) => {
    try {
        const { bookingId, newDate, newTime } = req.body;
        const appointments = await getAppointments();
        const appointment = appointments.find(apt => apt.bookingId === bookingId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        const oldDate = appointment.date;
        const oldTime = appointment.time;

        appointment.date = newDate;
        appointment.time = newTime;
        appointment.rescheduledAt = new Date().toISOString();
        appointment.previousDate = oldDate;
        appointment.previousTime = oldTime;

        await saveAppointments(appointments);

        // Send reschedule confirmation email
        const { sendRescheduleEmail } = require('./services/emailService');
        try {
            await sendRescheduleEmail({
                to: appointment.email,
                customerName: `${appointment.firstName} ${appointment.lastName}`,
                bookingId,
                oldDate,
                oldTime,
                newDate,
                newTime,
                serviceType: appointment.serviceType,
                company: appointment.company || 'Worry Free Moving'
            });
        } catch (error) {
            console.error('Failed to send reschedule email:', error);
        }

        // Send SMS confirmation if enabled
        const { sendSMSConfirmation } = require('./services/smsService');
        try {
            await sendSMSConfirmation({
                phone: appointment.phone,
                customerName: appointment.firstName,
                date: newDate,
                time: newTime,
                type: 'reschedule'
            });
        } catch (error) {
            console.error('Failed to send SMS:', error);
        }

        res.json({
            success: true,
            appointment,
            message: 'Appointment rescheduled successfully'
        });
    } catch (error) {
        console.error('Error rescheduling appointment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reschedule appointment'
        });
    }
});

// Edit/Update appointment
app.post('/api/update-appointment', async (req, res) => {
    try {
        const { bookingId, updates } = req.body;
        const appointments = await getAppointments();
        const appointment = appointments.find(apt => apt.bookingId === bookingId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        // Allow updating specific fields
        const allowedFields = ['notes', 'pickupAddress', 'dropoffAddress', 'phone', 'email'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                appointment[field] = updates[field];
            }
        });

        appointment.updatedAt = new Date().toISOString();
        await saveAppointments(appointments);

        res.json({
            success: true,
            appointment,
            message: 'Appointment updated successfully'
        });
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update appointment'
        });
    }
});

// Cancel appointment
// Booking lookup endpoint (for customers to view their booking)
app.post('/api/booking-lookup', async (req, res) => {
    try {
        const { bookingId, email } = req.body;

        if (!bookingId || !email) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID and email are required'
            });
        }

        const appointments = await getAppointments();
        const appointment = appointments.find(apt =>
            apt.bookingId === bookingId &&
            apt.email.toLowerCase() === email.toLowerCase()
        );

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found. Please check your booking ID and email address.'
            });
        }

        // Return booking information (excluding sensitive data)
        res.json({
            success: true,
            booking: {
                bookingId: appointment.bookingId,
                status: appointment.status,
                serviceType: appointment.serviceType,
                date: appointment.date,
                time: appointment.time,
                firstName: appointment.firstName,
                lastName: appointment.lastName,
                email: appointment.email,
                phone: appointment.phone,
                pickupAddress: appointment.pickupAddress,
                dropoffAddress: appointment.dropoffAddress,
                createdAt: appointment.createdAt
            }
        });
    } catch (error) {
        console.error('Error looking up booking:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while retrieving your booking'
        });
    }
});

app.post('/api/cancel-appointment', async (req, res) => {
    try {
        const { bookingId } = req.body;
        const appointments = await getAppointments();
        const appointment = appointments.find(apt => apt.bookingId === bookingId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        // Delete from Google Calendar if event ID exists (both calendars)
        if (appointment.googleEventId) {
            try {
                await deleteGoogleCalendarEvent(appointment.googleEventId);
                console.log('✅ Google Calendar events deleted from both calendars');
            } catch (error) {
                console.error('❌ Failed to delete Google Calendar event:', error);
                // Continue even if calendar deletion fails
            }
        }

        appointment.status = 'cancelled';
        appointment.cancelledAt = new Date().toISOString();
        await saveAppointments(appointments);

        // Send cancellation email
        const { sendCancellationEmail } = require('./services/emailService');
        try {
            await sendCancellationEmail({
                to: appointment.email,
                customerName: `${appointment.firstName} ${appointment.lastName}`,
                bookingId,
                date: appointment.date,
                time: appointment.time,
                company: appointment.company || 'Worry Free Moving'
            });
        } catch (error) {
            console.error('Failed to send cancellation email:', error);
        }

        // Send SMS notification
        const { sendSMSConfirmation } = require('./services/smsService');
        try {
            await sendSMSConfirmation({
                phone: appointment.phone,
                customerName: appointment.firstName,
                companyName: appointment.company || 'Worry Free Moving',
                serviceType: appointment.serviceType,
                date: appointment.date,
                time: appointment.time,
                type: 'cancellation'
            });
        } catch (error) {
            console.error('Failed to send SMS:', error);
        }

        res.json({
            success: true,
            message: 'Appointment cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel appointment'
        });
    }
});

// Generate Bill of Lading (BOL)
app.post('/api/generate-bol', async (req, res) => {
    try {
        const { bookingId, inventoryItems, specialInstructions } = req.body;
        const appointments = await getAppointments();
        const appointment = appointments.find(apt => apt.bookingId === bookingId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        // Determine which company based on service type
        const company = appointment.serviceType.toLowerCase().includes('labor')
            ? 'Quality Moving'
            : 'Worry Free Moving';

        const { generateBOL } = require('./services/bolService');
        const bolPDF = await generateBOL({
            appointment,
            company,
            inventoryItems: inventoryItems || [],
            specialInstructions: specialInstructions || ''
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="BOL-${bookingId}.pdf"`);
        res.send(bolPDF);

    } catch (error) {
        console.error('Error generating BOL:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate BOL'
        });
    }
});

// Get company info based on service type
app.get('/api/company-info', async (req, res) => {
    try {
        const { serviceType } = req.query;
        const { getCompanyInfo } = require('./utils/companyConfig');

        const companyInfo = getCompanyInfo(serviceType);

        res.json({
            success: true,
            company: companyInfo
        });
    } catch (error) {
        console.error('Error getting company info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get company info'
        });
    }
});

// ==============================================
// ADMIN PORTAL ENDPOINTS
// ==============================================

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check credentials against environment variables
        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            // Generate a simple session token (in production, use JWT)
            const sessionToken = Buffer.from(`${username}:${Date.now()}`).toString('base64');

            res.json({
                success: true,
                message: 'Login successful',
                token: sessionToken,
                user: {
                    username: username,
                    role: 'admin'
                }
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// Get all appointments (admin only)
app.get('/api/appointments', async (req, res) => {
    try {
        const { company } = req.query;

        let appointments;

        if (company === 'Quality Moving') {
            // Get only Quality Moving appointments
            appointments = await getAppointmentsByCompany('Quality Moving');
        } else if (company === 'Worry Free Moving') {
            // Get only Worry Free appointments
            appointments = await getAppointmentsByCompany('Worry Free Moving');
        } else {
            // Get both companies' appointments
            appointments = await getAllAppointments();
        }

        // Sort by date (newest first)
        appointments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            count: appointments.length,
            appointments: appointments
        });
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch appointments'
        });
    }
});

// Update appointment (admin only)
app.put('/api/appointments/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const updates = req.body;

        const appointments = await getAppointments();
        const index = appointments.findIndex(apt => apt.bookingId === bookingId);

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        const oldAppointment = appointments[index];

        // Update the appointment
        appointments[index] = {
            ...oldAppointment,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        const updatedAppointment = appointments[index];

        // Update Google Calendar event if exists
        if (oldAppointment.googleEventId) {
            try {
                // Calculate end time (2 hours after start)
                const calculateEndTime = (startDate, startTime) => {
                    const [hours, minutes] = startTime.split(':');
                    const endHours = (parseInt(hours) + 2).toString().padStart(2, '0');
                    return `${startDate}T${endHours}:${minutes}:00`;
                };

                const eventUpdates = {
                    summary: `[${updatedAppointment.company === 'Quality Moving' ? 'QM' : 'WF'}] ${updatedAppointment.serviceType || 'Moving Service'} - ${updatedAppointment.firstName} ${updatedAppointment.lastName}`,
                    description: formatCalendarDescription(updatedAppointment),
                    location: updatedAppointment.pickupAddress || '',
                    start: {
                        dateTime: `${updatedAppointment.date}T${updatedAppointment.time}:00`,
                        timeZone: 'America/New_York'
                    },
                    end: {
                        dateTime: calculateEndTime(updatedAppointment.date, updatedAppointment.time),
                        timeZone: 'America/New_York'
                    },
                    attendees: ['zlarimer24@gmail.com']
                };

                await updateGoogleCalendarEvent(oldAppointment.googleEventId, eventUpdates);
                console.log('✅ Google Calendar events updated on both calendars');
            } catch (error) {
                console.error('❌ Failed to update Google Calendar event:', error);
                // Continue even if calendar update fails
            }
        }

        await saveAppointments(appointments);

        res.json({
            success: true,
            message: 'Appointment updated successfully',
            appointment: appointments[index]
        });
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update appointment'
        });
    }
});

// Delete appointment (admin only)
app.delete('/api/appointments/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;

        const appointments = await getAppointments();
        const appointment = appointments.find(apt => apt.bookingId === bookingId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        // Delete from Google Calendar if event ID exists (both calendars)
        if (appointment.googleEventId) {
            try {
                await deleteGoogleCalendarEvent(appointment.googleEventId);
                console.log('✅ Google Calendar events deleted from both calendars');
            } catch (error) {
                console.error('❌ Failed to delete Google Calendar event:', error);
                // Continue even if calendar deletion fails
            }
        }

        const filteredAppointments = appointments.filter(apt => apt.bookingId !== bookingId);
        await saveAppointments(filteredAppointments);

        res.json({
            success: true,
            message: 'Appointment deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete appointment'
        });
    }
});

// Sync existing bookings to Google Calendar
app.post('/api/sync-calendar', async (req, res) => {
    try {
        const allAppointments = await getAllAppointments();
        const { company } = req.body; // Optional: sync specific company only

        let appointmentsToSync = allAppointments;
        if (company) {
            appointmentsToSync = allAppointments.filter(apt => apt.company === company);
        }

        // Calculate end time helper
        const calculateEndTime = (startDate, startTime) => {
            const [hours, minutes] = startTime.split(':');
            const endHours = (parseInt(hours) + 2).toString().padStart(2, '0');
            return `${startDate}T${endHours}:${minutes}:00`;
        };

        let syncedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const appointment of appointmentsToSync) {
            // Skip if already has a Google Calendar event ID
            if (appointment.googleEventId) {
                skippedCount++;
                continue;
            }

            // Skip cancelled appointments
            if (appointment.status === 'cancelled') {
                skippedCount++;
                continue;
            }

            try {
                // Create calendar event
                const eventDetails = {
                    summary: `[${appointment.company === 'Quality Moving' ? 'QM' : 'WF'}] ${appointment.serviceType || 'Moving Service'} - ${appointment.firstName} ${appointment.lastName}`,
                    description: formatCalendarDescription(appointment),
                    location: appointment.pickupAddress || '',
                    start: `${appointment.date}T${appointment.time}:00`,
                    end: calculateEndTime(appointment.date, appointment.time),
                    attendees: ['zlarimer24@gmail.com']
                };

                const googleEvent = await createGoogleCalendarEvent(eventDetails);
                const googleEventId = googleEvent?.id;

                // Update appointment with Google Event ID
                appointment.googleEventId = googleEventId;

                // Save updated appointment
                const companyName = appointment.company || 'Worry Free Moving';
                const companyAppointments = await getAppointmentsByCompany(companyName);
                const index = companyAppointments.findIndex(apt => apt.bookingId === appointment.bookingId);
                if (index !== -1) {
                    companyAppointments[index] = appointment;
                    await saveAppointmentsByCompany(companyName, companyAppointments);
                }

                syncedCount++;
                console.log(`✅ Synced ${appointment.bookingId} to calendar: ${googleEventId}`);
            } catch (error) {
                console.error(`❌ Failed to sync ${appointment.bookingId}:`, error.message);
                errorCount++;
            }
        }

        res.json({
            success: true,
            message: 'Calendar sync completed',
            results: {
                synced: syncedCount,
                skipped: skippedCount,
                errors: errorCount,
                total: appointmentsToSync.length
            }
        });
    } catch (error) {
        console.error('Error syncing calendar:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync calendar',
            message: error.message
        });
    }
});

// ==============================================
// COMMUNICATION SETTINGS ENDPOINTS
// ==============================================

const SETTINGS_FILE = path.join(__dirname, 'data', 'communication-settings.json');

// Get communication settings
app.get('/api/communication-settings', async (req, res) => {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(data);
        res.json({
            success: true,
            settings: settings
        });
    } catch (error) {
        // If file doesn't exist or error reading, return default empty settings
        res.json({
            success: true,
            settings: {}
        });
    }
});

// Save communication settings
app.post('/api/communication-settings', async (req, res) => {
    try {
        const settings = req.body;
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));

        res.json({
            success: true,
            message: 'Settings saved successfully'
        });
    } catch (error) {
        console.error('Error saving communication settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save settings'
        });
    }
});

// ==============================================
// CALENDAR AND AVAILABILITY ENDPOINTS
// ==============================================

const BLOCKED_DATES_FILE = path.join(__dirname, 'data', 'blocked-dates.json');
const AVAILABILITY_SETTINGS_FILE = path.join(__dirname, 'data', 'availability-settings.json');
const SERVICES_FILE = path.join(__dirname, 'data', 'services.json');

// Get blocked dates
app.get('/api/blocked-dates', async (req, res) => {
    try {
        const data = await fs.readFile(BLOCKED_DATES_FILE, 'utf8');
        const dates = JSON.parse(data);
        res.json({
            success: true,
            dates: dates
        });
    } catch (error) {
        // If file doesn't exist, return empty array
        res.json({
            success: true,
            dates: []
        });
    }
});

// Block or unblock a date
app.post('/api/blocked-dates', async (req, res) => {
    try {
        const { date, action } = req.body;

        // Read existing blocked dates
        let blockedDates = [];
        try {
            const data = await fs.readFile(BLOCKED_DATES_FILE, 'utf8');
            blockedDates = JSON.parse(data);
        } catch (err) {
            // File doesn't exist yet
        }

        if (action === 'block') {
            if (!blockedDates.includes(date)) {
                blockedDates.push(date);
            }
        } else if (action === 'unblock') {
            blockedDates = blockedDates.filter(d => d !== date);
        }

        // Save updated list
        await fs.writeFile(BLOCKED_DATES_FILE, JSON.stringify(blockedDates, null, 2));

        res.json({
            success: true,
            message: `Date ${action}ed successfully`,
            dates: blockedDates
        });
    } catch (error) {
        console.error('Error updating blocked dates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update blocked dates'
        });
    }
});

// Get availability settings
app.get('/api/availability-settings', async (req, res) => {
    try {
        const data = await fs.readFile(AVAILABILITY_SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(data);
        res.json({
            success: true,
            settings: settings
        });
    } catch (error) {
        // Return default settings if file doesn't exist
        res.json({
            success: true,
            settings: {
                workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
                businessHours: {
                    start: '08:00',
                    end: '18:00'
                },
                maxAppointments: 5,
                appointmentDuration: 60,
                bufferTime: 0,
                timezone: 'America/New_York'
            }
        });
    }
});

// Save availability settings
app.post('/api/availability-settings', async (req, res) => {
    try {
        const settings = req.body;
        await fs.writeFile(AVAILABILITY_SETTINGS_FILE, JSON.stringify(settings, null, 2));

        res.json({
            success: true,
            message: 'Availability settings saved successfully'
        });
    } catch (error) {
        console.error('Error saving availability settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save availability settings'
        });
    }
});

// ==============================================
// ==============================================
// SERVICES MANAGEMENT ENDPOINTS
// ==============================================
//
// IMPORTANT: CENTRALIZED PRICING CONFIGURATION
//
// This endpoint serves as the SINGLE SOURCE OF TRUTH for all pricing
// across the entire system.
//
// Consumers of this API:
// 1. Admin Portal - for managing/displaying service pricing
// 2. Sarah AI v3 Chatbot - MUST use this endpoint for all pricing calculations
// 3. Customer Booking Pages - for displaying service options and pricing
// 4. Mobile Apps (future) - for pricing consistency across platforms
//
// Integration Guidelines:
// - DO NOT hardcode prices anywhere in the system
// - Always fetch fresh data from this endpoint when calculating quotes
// - Cache pricing data for max 5 minutes to ensure freshness
// - Maintain backward compatibility when adding new services
//
// Data Source: data/services.json
// ==============================================

// Get all services configuration
app.get('/api/services', async (req, res) => {
    try {
        const data = await fs.readFile(SERVICES_FILE, 'utf8');
        const services = JSON.parse(data);
        res.json({
            success: true,
            services: services
        });
    } catch (error) {
        console.error('Error loading services:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load services'
        });
    }
});

// Update services configuration
// Only accessible by admin portal
app.post('/api/services', async (req, res) => {
    try {
        const services = req.body;
        await fs.writeFile(SERVICES_FILE, JSON.stringify(services, null, 2));

        res.json({
            success: true,
            message: 'Services updated successfully'
        });
    } catch (error) {
        console.error('Error saving services:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save services'
        });
    }
});

// Calculate estimate for public booking
app.post('/api/calculate-estimate', async (req, res) => {
    try {
        const bookingData = req.body;
        const servicesData = await fs.readFile(SERVICES_FILE, 'utf8');
        const services = JSON.parse(servicesData);

        let subtotal = 0;
        let laborCost = 0;
        let travelFee = 0;
        let serviceCharge = 0;
        let stairsFee = 0;
        let heavyItemsFee = 0;
        let additionalServicesCost = 0;
        let packingMaterialsCost = 0;
        let fvpCost = 0;
        let estimatedTime = 3; // Default estimated time in hours

        // Moving Service (2/3/4 person crew)
        if (bookingData.serviceType.includes('Person Crew') || bookingData.serviceType.includes('-person-crew')) {
            const crewKey = bookingData.serviceType.toLowerCase().replace(/ /g, '-').replace('person-crew', 'person-crew');
            let serviceConfig;

            // Try to find matching service
            if (services.movingServices && services.movingServices['2-person-crew'] && bookingData.serviceType.includes('2')) {
                serviceConfig = services.movingServices['2-person-crew'];
            } else if (services.movingServices && services.movingServices['3-person-crew'] && bookingData.serviceType.includes('3')) {
                serviceConfig = services.movingServices['3-person-crew'];
            } else if (services.movingServices && services.movingServices['4-person-crew'] && bookingData.serviceType.includes('4')) {
                serviceConfig = services.movingServices['4-person-crew'];
            }

            if (serviceConfig) {
                const baseRate = serviceConfig.baseRate || 0;
                const distanceRate = serviceConfig.distanceAdjustment || 0;
                const driveTime = bookingData.driveTime || 20;
                const distance = bookingData.distance || 10;

                estimatedTime = 3 + (driveTime / 60); // 3 hours base + drive time
                laborCost = baseRate * estimatedTime;
                travelFee = distance * distanceRate;
                subtotal = laborCost + travelFee;

                // Service charge
                serviceCharge = subtotal * (serviceConfig.serviceCharge || 0.14);
            }
        }

        // Labor Only
        else if (bookingData.serviceType === 'Labor Only' && services.laborOnly) {
            const hours = bookingData.estimatedHours || 2;
            const baseRate = services.laborOnly.baseRate || 115;
            const distance = bookingData.distance || 10;
            const distanceRate = services.laborOnly.distanceAdjustment || 0.50;

            laborCost = baseRate * hours;
            travelFee = distance * distanceRate;
            subtotal = laborCost + travelFee;

            // Service charge
            serviceCharge = subtotal * (services.laborOnly.serviceCharge || 0.08);
        }

        // Single Item Move
        else if (bookingData.serviceType === 'Single Item Move' && services.singleItem) {
            const baseRate = services.singleItem.baseRate || 249;
            const distance = bookingData.distance || 10;
            const distanceRate = services.singleItem.distanceRate || 1.50;

            laborCost = baseRate;
            travelFee = distance * distanceRate;
            subtotal = laborCost + travelFee;

            // Service charge
            serviceCharge = subtotal * 0.14; // Default service charge
        }

        // Add stairs fees
        if (services.fees && services.fees.stairs && services.fees.stairs.enabled) {
            const pickupStairs = bookingData.pickupDetails?.stairs || 0;
            const dropoffStairs = bookingData.dropoffDetails?.stairs || 0;
            const pickupType = bookingData.pickupDetails?.homeType || 'house';
            const dropoffType = bookingData.dropoffDetails?.homeType || 'house';

            const pickupRate = pickupType === 'apartment' ? services.fees.stairs.apartment : services.fees.stairs.house;
            const dropoffRate = dropoffType === 'apartment' ? services.fees.stairs.apartment : services.fees.stairs.house;

            stairsFee = (pickupStairs * pickupRate) + (dropoffStairs * dropoffRate);
        }

        // Add heavy/specialty item fees (UNIVERSAL - applies to ALL services)
        if (bookingData.inventory) {
            if (bookingData.inventory.piano) {
                heavyItemsFee += 200; // Piano fee
                estimatedTime += 0.75; // Add 45 minutes
            }
            if (bookingData.inventory.poolTable) {
                heavyItemsFee += 300; // Pool table fee
                estimatedTime += 1.0; // Add 1 hour
            }
            if (bookingData.inventory.hotTub) {
                heavyItemsFee += 250; // Hot tub fee
                estimatedTime += 1.0; // Add 1 hour
            }
            if (bookingData.inventory.safe) {
                heavyItemsFee += 150; // Large safe fee
                estimatedTime += 0.5; // Add 30 minutes
            }
        }

        // Add packing materials
        if (bookingData.additionalServices && bookingData.additionalServices.packingMaterials && services.packingMaterials) {
            const materials = bookingData.additionalServices.packingMaterials;
            for (const [key, quantity] of Object.entries(materials)) {
                if (quantity > 0 && services.packingMaterials[key]) {
                    packingMaterialsCost += services.packingMaterials[key].price * quantity;
                }
            }
        }

        // Add additional services (packing, blankets)
        if (bookingData.additionalServices) {
            if (bookingData.additionalServices.packing) {
                additionalServicesCost += 50; // Example packing fee
            }
            if (bookingData.additionalServices.movingBlankets) {
                const blanketsNeeded = bookingData.additionalServices.blanketsQuantity || 10;
                additionalServicesCost += blanketsNeeded * 2; // $2 per blanket
            }
        }

        // Calculate FVP insurance (if selected)
        if (bookingData.additionalServices && bookingData.additionalServices.fvp) {
            const fvpValue = parseFloat(bookingData.additionalServices.fvpValue) || 0;
            fvpCost = fvpValue * 0.01; // 1% of declared value
        }

        // Calculate total
        const total = subtotal + serviceCharge + stairsFee + heavyItemsFee + additionalServicesCost + packingMaterialsCost + fvpCost;

        res.json({
            success: true,
            estimate: {
                subtotal: Math.round(subtotal * 100) / 100,
                laborCost: Math.round(laborCost * 100) / 100,
                travelFee: Math.round(travelFee * 100) / 100,
                serviceCharge: Math.round(serviceCharge * 100) / 100,
                stairsFee: Math.round(stairsFee * 100) / 100,
                heavyItems: Math.round(heavyItemsFee * 100) / 100,
                additionalServices: Math.round(additionalServicesCost * 100) / 100,
                packingMaterials: Math.round(packingMaterialsCost * 100) / 100,
                fvpInsurance: Math.round(fvpCost * 100) / 100,
                total: Math.round(total * 100) / 100,
                estimatedTime: Math.round(estimatedTime * 10) / 10
            }
        });

    } catch (error) {
        console.error('Error calculating estimate:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate estimate'
        });
    }
});

// ==============================================
// CALENDAR SETTINGS ENDPOINTS
// ==============================================
const CALENDAR_SETTINGS_FILE = path.join(__dirname, 'data', 'calendar-settings.json');

// Get calendar settings
app.get('/api/calendar-settings', async (req, res) => {
    try {
        const data = await fs.readFile(CALENDAR_SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(data);
        res.json({
            success: true,
            settings: settings
        });
    } catch (error) {
        console.error('Error loading calendar settings:', error);
        res.json({
            success: true,
            settings: {}
        });
    }
});

// Save calendar settings
app.post('/api/calendar-settings', async (req, res) => {
    try {
        const settings = req.body;
        await fs.writeFile(CALENDAR_SETTINGS_FILE, JSON.stringify(settings, null, 2));

        res.json({
            success: true,
            message: 'Calendar settings saved successfully'
        });
    } catch (error) {
        console.error('Error saving calendar settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save calendar settings'
        });
    }
});

// Add sync target (crew member or manager)
app.post('/api/calendar-settings/add-sync-target', async (req, res) => {
    try {
        const { name, email, role, permissions, notes } = req.body;

        const data = await fs.readFile(CALENDAR_SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(data);

        const newTarget = {
            id: `${role}-${Date.now()}`,
            name,
            email,
            role,
            permissions,
            enabled: true,
            notes: notes || ''
        };

        settings.syncTargets.push(newTarget);

        await fs.writeFile(CALENDAR_SETTINGS_FILE, JSON.stringify(settings, null, 2));

        res.json({
            success: true,
            message: 'Sync target added successfully',
            target: newTarget
        });
    } catch (error) {
        console.error('Error adding sync target:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add sync target'
        });
    }
});

// Remove sync target
app.delete('/api/calendar-settings/sync-target/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const data = await fs.readFile(CALENDAR_SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(data);

        settings.syncTargets = settings.syncTargets.filter(t => t.id !== id);

        await fs.writeFile(CALENDAR_SETTINGS_FILE, JSON.stringify(settings, null, 2));

        res.json({
            success: true,
            message: 'Sync target removed successfully'
        });
    } catch (error) {
        console.error('Error removing sync target:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove sync target'
        });
    }
});

// ==============================================
// CUSTOMER NOTES ENDPOINT
// ==============================================
const CUSTOMER_NOTES_FILE = path.join(__dirname, 'data', 'customer-notes.json');

// Get customer notes
app.get('/api/customer-notes', async (req, res) => {
    try {
        const data = await fs.readFile(CUSTOMER_NOTES_FILE, 'utf8');
        const notes = JSON.parse(data);
        res.json({
            success: true,
            notes: notes
        });
    } catch (error) {
        // If file doesn't exist, return empty object
        res.json({
            success: true,
            notes: {}
        });
    }
});

// Save customer notes
app.post('/api/customer-notes', async (req, res) => {
    try {
        const { email, privateNotes } = req.body;

        // Load existing notes
        let notes = {};
        try {
            const data = await fs.readFile(CUSTOMER_NOTES_FILE, 'utf8');
            notes = JSON.parse(data);
        } catch (error) {
            // File doesn't exist yet, start with empty object
        }

        // Update notes for this customer
        notes[email.toLowerCase()] = {
            email: email,
            privateNotes: privateNotes,
            updatedAt: new Date().toISOString()
        };

        // Save back to file
        await fs.writeFile(CUSTOMER_NOTES_FILE, JSON.stringify(notes, null, 2));

        res.json({
            success: true,
            message: 'Customer notes saved successfully'
        });
    } catch (error) {
        console.error('Error saving customer notes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save customer notes'
        });
    }
});

// ==============================================
// SQUARE CUSTOMER LOOKUP ENDPOINT
// ==============================================
// Check if customer exists and has payment method on file
app.get('/api/square-customer/:email', async (req, res) => {
    try {
        const { email } = req.params;

        // Call Vercel backend to check if customer exists
        const response = await fetch(
            `https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app/api/square-customer?email=${encodeURIComponent(email)}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }
        );

        const data = await response.json();

        if (data.success && data.customer) {
            res.json({
                success: true,
                hasCard: true,
                customer: {
                    squareCustomerId: data.customer.id,
                    firstName: data.customer.givenName,
                    lastName: data.customer.familyName,
                    email: data.customer.emailAddress,
                    phone: data.customer.phoneNumber,
                    cardBrand: data.customer.cardBrand,
                    cardLast4: data.customer.cardLast4
                }
            });
        } else {
            res.json({
                success: true,
                hasCard: false,
                customer: null
            });
        }
    } catch (error) {
        console.error('Error checking Square customer:', error);
        res.json({
            success: true,
            hasCard: false,
            customer: null
        });
    }
});

// ==============================================
// CREW TIME-OFF REQUEST ENDPOINT
// ==============================================
const CREW_TIMEOFF_FILE = path.join(__dirname, 'data', 'crew-timeoff-requests.json');

// Get all crew time-off requests (admin only)
app.get('/api/crew-timeoff', async (req, res) => {
    try {
        const data = await fs.readFile(CREW_TIMEOFF_FILE, 'utf8');
        const requests = JSON.parse(data);

        // Sort by submitted date (newest first)
        requests.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));

        res.json({
            success: true,
            count: requests.length,
            requests: requests
        });
    } catch (error) {
        // If file doesn't exist, return empty array
        res.json({
            success: true,
            count: 0,
            requests: []
        });
    }
});

// Submit crew time-off request
app.post('/api/crew-timeoff', async (req, res) => {
    try {
        const {
            crewName,
            crewEmail,
            crewPhone,
            crew,
            requestType,
            startDate,
            endDate,
            daysCount,
            reason,
            submittedDate
        } = req.body;

        // Validate required fields (crew field is now optional)
        if (!crewName || !crewEmail || !crewPhone || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Generate request ID
        const requestId = `TO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create time-off request object
        const timeOffRequest = {
            requestId,
            crewName,
            crewEmail,
            crewPhone,
            crew: crew || 'Not specified',
            requestType: requestType || 'vacation',
            startDate,
            endDate,
            daysCount: parseInt(daysCount) || 1,
            reason: reason || '',
            submittedDate: submittedDate || new Date().toISOString(),
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Load existing requests
        let requests = [];
        try {
            const data = await fs.readFile(CREW_TIMEOFF_FILE, 'utf8');
            requests = JSON.parse(data);
        } catch (error) {
            // File doesn't exist yet, start with empty array
        }

        // Add new request
        requests.push(timeOffRequest);

        // Save to file
        await fs.writeFile(CREW_TIMEOFF_FILE, JSON.stringify(requests, null, 2));

        // Send notification email to management
        const { sendCrewTimeOffNotification } = require('./services/emailService');
        try {
            await sendCrewTimeOffNotification({
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
            });
            console.log('Time-off request notification sent to management');
        } catch (error) {
            console.error('Failed to send time-off notification:', error);
        }

        // Send confirmation email to crew member
        const { sendCrewTimeOffConfirmation } = require('./services/emailService');
        try {
            await sendCrewTimeOffConfirmation({
                to: crewEmail,
                crewName,
                requestId,
                crew,
                requestType,
                startDate,
                endDate,
                daysCount
            });
            console.log('Time-off confirmation sent to crew member');
        } catch (error) {
            console.error('Failed to send crew confirmation:', error);
        }

        // Send SMS notification to manager
        const { sendSMSConfirmation } = require('./services/smsService');
        try {
            await sendSMSConfirmation({
                phone: process.env.MANAGER_PHONE || '+13304358686',
                customerName: 'Manager',
                company: 'Worry Free Moving',
                date: startDate,
                time: '',
                type: 'timeoff',
                additionalInfo: `Time-Off Request from ${crewName}: ${daysCount} day(s) starting ${startDate} (${requestType})`
            });
            console.log('SMS notification sent to manager');
        } catch (error) {
            console.error('Failed to send SMS to manager:', error);
        }

        // Create Google Calendar event for time-off (blocked time)
        try {
            const calendarEventDetails = {
                summary: `🗓️ TIME OFF: ${crewName} - ${requestType}`,
                description: `
Time-Off Request ID: ${requestId}
Crew Member: ${crewName}
Email: ${crewEmail}
Phone: ${crewPhone}
Type: ${requestType}
Days: ${daysCount}
Status: Pending Approval
${reason ? `Reason: ${reason}` : ''}

This time is BLOCKED pending manager approval.
                `.trim(),
                location: '',
                start: `${startDate}T00:00:00`,
                end: `${endDate}T23:59:59`,
                colorId: '11' // Red color for time-off
            };

            await createGoogleCalendarEvent(calendarEventDetails);
            console.log('Calendar event created for time-off request');
        } catch (error) {
            console.error('Failed to create calendar event:', error);
        }

        res.json({
            success: true,
            requestId,
            request: timeOffRequest,
            message: 'Time-off request submitted successfully'
        });

    } catch (error) {
        console.error('Error submitting time-off request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit time-off request'
        });
    }
});

// Approve or deny crew time-off request (admin only)
app.post('/api/crew-timeoff/respond', async (req, res) => {
    try {
        const { requestId, status, responseNote } = req.body;

        if (!requestId || !status || !['approved', 'denied'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request. Status must be "approved" or "denied"'
            });
        }

        // Load existing requests
        const data = await fs.readFile(CREW_TIMEOFF_FILE, 'utf8');
        const requests = JSON.parse(data);

        // Find the request
        const request = requests.find(r => r.requestId === requestId);

        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Time-off request not found'
            });
        }

        // Update request status
        request.status = status;
        request.responseNote = responseNote || '';
        request.respondedAt = new Date().toISOString();

        // Save updated requests
        await fs.writeFile(CREW_TIMEOFF_FILE, JSON.stringify(requests, null, 2));

        // Send response email to crew member
        const { sendCrewTimeOffResponse } = require('./services/emailService');
        try {
            await sendCrewTimeOffResponse({
                to: request.crewEmail,
                crewName: request.crewName,
                requestId,
                status,
                startDate: request.startDate,
                endDate: request.endDate,
                daysCount: request.daysCount,
                responseNote
            });
            console.log(`Time-off ${status} email sent to ${request.crewName}`);
        } catch (error) {
            console.error('Failed to send response email:', error);
        }

        res.json({
            success: true,
            message: `Time-off request ${status} successfully`,
            request
        });

    } catch (error) {
        console.error('Error responding to time-off request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to respond to time-off request'
        });
    }
});

// ==============================================
// EMPLOYEE PORTAL ENDPOINTS
// ==============================================
const EMPLOYEES_FILE = path.join(__dirname, 'data', 'employees.json');
const bcrypt = require('bcrypt');

// Employee login
app.post('/api/employee/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Load employees
        const data = await fs.readFile(EMPLOYEES_FILE, 'utf8');
        const employees = JSON.parse(data);

        // Find employee by username
        const employee = employees.find(emp => emp.username === username && emp.status === 'active');

        if (!employee) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        // For now, use simple password check (in production, use bcrypt)
        // Since passwords are placeholder hashes, we'll implement a simple check
        // You can update this when you set real hashed passwords
        let isValidPassword = false;

        try {
            isValidPassword = await bcrypt.compare(password, employee.password);
        } catch (error) {
            // If bcrypt fails (placeholder password), allow simple match for testing
            // In production, remove this fallback
            console.warn('Bcrypt compare failed, using fallback. Set real passwords!');
            isValidPassword = (password === 'password123'); // Temporary default password
        }

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        // Update last login
        employee.lastLogin = new Date().toISOString();
        await fs.writeFile(EMPLOYEES_FILE, JSON.stringify(employees, null, 2));

        // Generate session token (simple for now, use JWT in production)
        const token = Buffer.from(`${employee.id}:${Date.now()}`).toString('base64');

        // Return employee data (without password)
        const { password: pwd, ...employeeData } = employee;

        res.json({
            success: true,
            token,
            employee: employeeData,
            message: 'Login successful'
        });

    } catch (error) {
        console.error('Employee login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// Get employee time-off requests by email
app.get('/api/employee/timeoff-requests', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email parameter required'
            });
        }

        // Load time-off requests
        let requests = [];
        try {
            const data = await fs.readFile(CREW_TIMEOFF_FILE, 'utf8');
            requests = JSON.parse(data);
        } catch (error) {
            // File doesn't exist yet, return empty array
        }

        // Filter requests by employee email
        const employeeRequests = requests.filter(req =>
            req.crewEmail && req.crewEmail.toLowerCase() === email.toLowerCase()
        );

        // Sort by submitted date (newest first)
        employeeRequests.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));

        res.json({
            success: true,
            count: employeeRequests.length,
            requests: employeeRequests
        });

    } catch (error) {
        console.error('Error fetching employee time-off requests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch time-off requests'
        });
    }
});

// Change employee password
app.post('/api/employee/change-password', async (req, res) => {
    try {
        const { employeeId, currentPassword, newPassword } = req.body;

        if (!employeeId || !currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Load employees
        const data = await fs.readFile(EMPLOYEES_FILE, 'utf8');
        const employees = JSON.parse(data);

        // Find employee
        const employee = employees.find(emp => emp.id === employeeId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                error: 'Employee not found'
            });
        }

        // Verify current password
        let isValidPassword = false;
        try {
            isValidPassword = await bcrypt.compare(currentPassword, employee.password);
        } catch (error) {
            // Fallback for testing (remove in production)
            isValidPassword = (currentPassword === 'password123');
        }

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update employee password
        employee.password = hashedPassword;
        employee.passwordChangedAt = new Date().toISOString();

        // Save employees
        await fs.writeFile(EMPLOYEES_FILE, JSON.stringify(employees, null, 2));

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Error changing employee password:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to change password'
        });
    }
});

// ==============================================
// EMPLOYEE MANAGEMENT ENDPOINTS (Admin)
// ==============================================

// Helper functions for employee management
async function loadEmployees() {
    try {
        const data = await fs.readFile(EMPLOYEES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading employees:', error);
        return [];
    }
}

async function saveEmployees(employees) {
    try {
        await fs.writeFile(EMPLOYEES_FILE, JSON.stringify(employees, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving employees:', error);
        return false;
    }
}

// GET all employees
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await loadEmployees();

        // Return employees without passwords
        const employeesWithoutPasswords = employees.map(emp => {
            const { password, ...employeeData } = emp;
            return employeeData;
        });

        res.json({
            success: true,
            count: employeesWithoutPasswords.length,
            employees: employeesWithoutPasswords
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch employees'
        });
    }
});

// GET single employee by ID
app.get('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const employees = await loadEmployees();
        const employee = employees.find(emp => emp.id === id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                error: 'Employee not found'
            });
        }

        // Return employee without password
        const { password, ...employeeData } = employee;

        res.json({
            success: true,
            employee: employeeData
        });
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch employee'
        });
    }
});

// CREATE new employee
app.post('/api/employees', async (req, res) => {
    try {
        const {
            username,
            password,
            firstName,
            lastName,
            email,
            phone,
            role,
            team,
            hireDate,
            status
        } = req.body;

        // Validate required fields
        if (!username || !password || !firstName || !lastName || !email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: username, password, firstName, lastName, email'
            });
        }

        // Load existing employees
        const employees = await loadEmployees();

        // Check if username already exists
        if (employees.find(emp => emp.username === username)) {
            return res.status(400).json({
                success: false,
                error: 'Username already exists'
            });
        }

        // Check if email already exists
        if (employees.find(emp => emp.email.toLowerCase() === email.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate new employee ID
        const employeeId = `emp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create new employee object
        const newEmployee = {
            id: employeeId,
            username,
            password: hashedPassword,
            firstName,
            lastName,
            email,
            phone: phone || '',
            role: role || 'crew',
            team: team || '',
            hireDate: hireDate || new Date().toISOString().split('T')[0],
            status: status || 'active',
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        // Add new employee
        employees.push(newEmployee);

        // Save to file
        const saved = await saveEmployees(employees);

        if (!saved) {
            return res.status(500).json({
                success: false,
                error: 'Failed to save employee'
            });
        }

        // Return success (without password)
        const { password: pwd, ...employeeWithoutPassword } = newEmployee;

        res.json({
            success: true,
            message: 'Employee created successfully',
            employee: employeeWithoutPassword
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create employee'
        });
    }
});

// UPDATE employee
app.put('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            username,
            password,
            firstName,
            lastName,
            email,
            phone,
            role,
            team,
            hireDate,
            status
        } = req.body;

        // Load existing employees
        const employees = await loadEmployees();
        const employeeIndex = employees.findIndex(emp => emp.id === id);

        if (employeeIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Employee not found'
            });
        }

        const existingEmployee = employees[employeeIndex];

        // Check for duplicate username (excluding current employee)
        if (username && username !== existingEmployee.username) {
            if (employees.find(emp => emp.username === username && emp.id !== id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Username already exists'
                });
            }
        }

        // Check for duplicate email (excluding current employee)
        if (email && email.toLowerCase() !== existingEmployee.email.toLowerCase()) {
            if (employees.find(emp => emp.email.toLowerCase() === email.toLowerCase() && emp.id !== id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Email already exists'
                });
            }
        }

        // Update employee fields
        if (username) existingEmployee.username = username;
        if (firstName) existingEmployee.firstName = firstName;
        if (lastName) existingEmployee.lastName = lastName;
        if (email) existingEmployee.email = email;
        if (phone !== undefined) existingEmployee.phone = phone;
        if (role) existingEmployee.role = role;
        if (team !== undefined) existingEmployee.team = team;
        if (hireDate) existingEmployee.hireDate = hireDate;
        if (status) existingEmployee.status = status;

        // Update password if provided
        if (password) {
            existingEmployee.password = await bcrypt.hash(password, 10);
            existingEmployee.passwordChangedAt = new Date().toISOString();
        }

        // Save employees
        const saved = await saveEmployees(employees);

        if (!saved) {
            return res.status(500).json({
                success: false,
                error: 'Failed to save employee'
            });
        }

        // Return success (without password)
        const { password: pwd, ...employeeWithoutPassword } = existingEmployee;

        res.json({
            success: true,
            message: 'Employee updated successfully',
            employee: employeeWithoutPassword
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update employee'
        });
    }
});

// DELETE employee
app.delete('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Load existing employees
        const employees = await loadEmployees();
        const employeeIndex = employees.findIndex(emp => emp.id === id);

        if (employeeIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Employee not found'
            });
        }

        // Remove employee
        employees.splice(employeeIndex, 1);

        // Save employees
        const saved = await saveEmployees(employees);

        if (!saved) {
            return res.status(500).json({
                success: false,
                error: 'Failed to delete employee'
            });
        }

        res.json({
            success: true,
            message: 'Employee deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete employee'
        });
    }
});

// ==============================================
// AUTHORIZED USERS MANAGEMENT ENDPOINTS
// ==============================================
const AUTHORIZED_USERS_FILE = path.join(__dirname, 'data', 'authorized-users.json');

// Helper function to load users
async function loadAuthorizedUsers() {
    try {
        const data = await fs.readFile(AUTHORIZED_USERS_FILE, 'utf8');
        const usersData = JSON.parse(data);
        return usersData.users || [];
    } catch (error) {
        console.error('Error loading authorized users:', error);
        return [];
    }
}

// Helper function to save users
async function saveAuthorizedUsers(users) {
    try {
        await fs.writeFile(AUTHORIZED_USERS_FILE, JSON.stringify({ users }, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving authorized users:', error);
        return false;
    }
}

// Get all authorized users (without password hashes)
app.get('/api/authorized-users', async (req, res) => {
    try {
        const users = await loadAuthorizedUsers();

        // Remove password hashes before sending
        const safeUsers = users.map(user => {
            const { passwordHash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.json({
            success: true,
            users: safeUsers
        });
    } catch (error) {
        console.error('Error fetching authorized users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users'
        });
    }
});

// Get single authorized user by ID
app.get('/api/authorized-users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const users = await loadAuthorizedUsers();
        const user = users.find(u => u.id === id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Remove password hash before sending
        const { passwordHash, ...userWithoutPassword } = user;

        res.json({
            success: true,
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user'
        });
    }
});

// Create new authorized user
app.post('/api/authorized-users', async (req, res) => {
    try {
        const {
            username,
            password,
            firstName,
            lastName,
            email,
            role,
            status,
            permissions
        } = req.body;

        // Validate required fields
        if (!username || !password || !firstName || !lastName || !email || !role) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Load existing users
        const users = await loadAuthorizedUsers();

        // Check if username already exists
        if (users.find(u => u.username === username)) {
            return res.status(400).json({
                success: false,
                error: 'Username already exists'
            });
        }

        // Check if email already exists
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Generate new user ID
        const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create new user object
        const newUser = {
            id: userId,
            username,
            passwordHash,
            firstName,
            lastName,
            email,
            role,
            status: status || 'active',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            permissions: permissions || {
                viewBookings: true,
                createBookings: true,
                editBookings: true,
                deleteBookings: false,
                viewCustomers: true,
                manageUsers: false,
                manageSettings: false,
                viewReports: true
            }
        };

        // Add new user
        users.push(newUser);

        // Save to file
        const saved = await saveAuthorizedUsers(users);

        if (!saved) {
            return res.status(500).json({
                success: false,
                error: 'Failed to save user'
            });
        }

        // Return success (without password hash)
        const { passwordHash: pwd, ...userWithoutPassword } = newUser;

        res.json({
            success: true,
            message: 'User created successfully',
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create user'
        });
    }
});

// Update authorized user
app.put('/api/authorized-users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            username,
            password,
            firstName,
            lastName,
            email,
            role,
            status,
            permissions
        } = req.body;

        // Load existing users
        const users = await loadAuthorizedUsers();
        const userIndex = users.findIndex(u => u.id === id);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const existingUser = users[userIndex];

        // Check if username is being changed and if it already exists
        if (username !== existingUser.username) {
            if (users.find(u => u.username === username && u.id !== id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Username already exists'
                });
            }
        }

        // Check if email is being changed and if it already exists
        if (email.toLowerCase() !== existingUser.email.toLowerCase()) {
            if (users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Email already exists'
                });
            }
        }

        // Update user fields
        users[userIndex] = {
            ...existingUser,
            username: username || existingUser.username,
            firstName: firstName || existingUser.firstName,
            lastName: lastName || existingUser.lastName,
            email: email || existingUser.email,
            role: role || existingUser.role,
            status: status || existingUser.status,
            permissions: permissions || existingUser.permissions,
            updatedAt: new Date().toISOString()
        };

        // Update password if provided
        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            users[userIndex].passwordHash = passwordHash;
            users[userIndex].passwordChangedAt = new Date().toISOString();
        }

        // Save to file
        const saved = await saveAuthorizedUsers(users);

        if (!saved) {
            return res.status(500).json({
                success: false,
                error: 'Failed to update user'
            });
        }

        // Return success (without password hash)
        const { passwordHash: pwd, ...userWithoutPassword } = users[userIndex];

        res.json({
            success: true,
            message: 'User updated successfully',
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user'
        });
    }
});

// Delete authorized user
app.delete('/api/authorized-users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Load existing users
        const users = await loadAuthorizedUsers();
        const userToDelete = users.find(u => u.id === id);

        if (!userToDelete) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Prevent deleting the last admin user
        const adminUsers = users.filter(u => u.role === 'admin');
        if (userToDelete.role === 'admin' && adminUsers.length === 1) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete the last administrator account'
            });
        }

        // Remove user
        const updatedUsers = users.filter(u => u.id !== id);

        // Save to file
        const saved = await saveAuthorizedUsers(updatedUsers);

        if (!saved) {
            return res.status(500).json({
                success: false,
                error: 'Failed to delete user'
            });
        }

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user'
        });
    }
});

// Reset user password
app.post('/api/authorized-users/:id/reset-password', async (req, res) => {
    try {
        const { id } = req.params;

        // Load existing users
        const users = await loadAuthorizedUsers();
        const userIndex = users.findIndex(u => u.id === id);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = users[userIndex];

        // Generate temporary password (8 characters: letters + numbers)
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();

        // Hash temporary password
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        // Update user
        users[userIndex].passwordHash = passwordHash;
        users[userIndex].passwordResetAt = new Date().toISOString();
        users[userIndex].requirePasswordChange = true;

        // Save to file
        const saved = await saveAuthorizedUsers(users);

        if (!saved) {
            return res.status(500).json({
                success: false,
                error: 'Failed to reset password'
            });
        }

        // Send email with temporary password
        try {
            const { sendPasswordResetEmail } = require('./services/emailService');
            await sendPasswordResetEmail({
                to: user.email,
                userName: `${user.firstName} ${user.lastName}`,
                username: user.username,
                tempPassword: tempPassword
            });
            console.log(`Password reset email sent to ${user.email}`);
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            // Continue even if email fails
        }

        res.json({
            success: true,
            message: 'Password reset successfully',
            tempPassword: tempPassword
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset password'
        });
    }
});

// Change password (requires current password)
app.post('/api/authorized-users/:id/change-password', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        // Load existing users
        const users = await loadAuthorizedUsers();
        const userIndex = users.findIndex(u => u.id === id);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = users[userIndex];

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update user
        users[userIndex].passwordHash = passwordHash;
        users[userIndex].passwordChangedAt = new Date().toISOString();
        users[userIndex].requirePasswordChange = false;

        // Save to file
        const saved = await saveAuthorizedUsers(users);

        if (!saved) {
            return res.status(500).json({
                success: false,
                error: 'Failed to change password'
            });
        }

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to change password'
        });
    }
});

// Start server
async function startServer() {
    await ensureDataDirectory();

    // Serve Sarah AI chatbot
    app.get('/sarah', (req, res) => {
        res.sendFile(path.join(__dirname, 'sarah-ai.html'));
    });

    // Serve home page (chatbot)
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'sarah-ai.html'));
    });

    // Initialize Google Calendar auth (optional, can be done later)
    try {
        await initGoogleAuth();
        console.log('Google Calendar initialized');
    } catch (error) {
        console.error('Google Calendar initialization failed:', error.message);
    }

    // Initialize Google Calendar
    await initGoogleAuth();

    // Initialize 24-hour reminder scheduler
    const { initReminderScheduler } = require('./services/reminderScheduler');
    initReminderScheduler();

    app.listen(PORT, () => {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🚀 Booking API server running on http://localhost:${PORT}`);
        console.log(`📅 Appointments storage: ${APPOINTMENTS_FILE}`);
        console.log(`📆 Google Calendar sync: ${process.env.GOOGLE_CALENDAR_ID ? 'ACTIVE' : 'Ready (configure credentials.json)'}`);
        console.log(`⏰ 24-hour reminder system: ACTIVE`);
        console.log(`📧 Email notifications: ${process.env.EMAIL_SERVICE || 'NOT CONFIGURED'}`);
        console.log(`📱 SMS notifications: ${process.env.RINGCENTRAL_CLIENT_ID ? 'ACTIVE' : 'NOT CONFIGURED'}`);
        console.log(`${'='.repeat(50)}\n`);
    });
}

startServer();
