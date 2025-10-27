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
const { sendConfirmationEmail, sendEstimateEmail, sendEmployeePasswordResetEmail, sendAdminUserWelcomeEmail, sendEmployeeWelcomeEmail } = require('./services/emailService');
const { generateBookingId } = require('./utils/helpers');
const {
    connectDatabase,
    getAppointments: getMongoAppointments,
    getAppointmentByBookingId,
    createAppointment,
    updateAppointment,
    deleteAppointment: deleteMongoAppointment,
    getUserByUsername,
    getAllUsers,
    createUser,
    getAllEmployees,
    updateEmployees: updateMongoEmployees,
    getEmployeeByUsername,
    updateEmployeeLogin,
    updateEmployeePassword,
    getServicesConfig,
    updateServicesConfig,
    getAllTimeOffRequests,
    getTimeOffRequestById,
    createTimeOffRequest,
    updateTimeOffRequestStatus,
    getPendingTimeOffRequests,
    getAllCustomers,
    getCustomerById,
    getCustomerByEmail,
    searchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerBookings
} = require('./services/database');

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

// ========================================
// MONGODB DATABASE FUNCTIONS
// ========================================

// Get appointments for a specific company (MongoDB)
async function getAppointmentsByCompany(company) {
    try {
        return await getMongoAppointments(company);
    } catch (error) {
        console.error(`Error reading ${company} appointments from MongoDB:`, error);
        return [];
    }
}

// Get all appointments (from both companies) - used for availability checking
async function getAllAppointments() {
    try {
        return await getMongoAppointments(); // Gets all without filter
    } catch (error) {
        console.error('Error reading all appointments from MongoDB:', error);
        return [];
    }
}

// Legacy functions for backward compatibility
async function getAppointments() {
    return await getAppointmentsByCompany('Worry Free Moving');
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

        // Use central admin calendar (single source of truth for availability)
        const { getAvailableSlots } = require('./services/calendarManager');
        const slots = await getAvailableSlots(date);

        console.log(`📅 Available slots for ${date} from central calendar: ${slots.filter(s => s.available).length}/${slots.length} available`);

        res.json({ success: true, slots });
    } catch (error) {
        console.error('Error fetching available slots from central calendar:', error);
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

        // Validate availability before booking (check against central admin calendar)
        try {
            const { checkAvailability } = require('./services/calendarManager');
            const availabilityCheck = await checkAvailability(date, time, serviceType);

            if (!availabilityCheck.available) {
                console.log(`⚠️ Requested time slot ${date} ${time} is not available in central calendar`);
                return res.status(409).json({
                    success: false,
                    error: 'This time slot is no longer available. Please select a different time.',
                    reason: availabilityCheck.reason
                });
            }

            console.log(`✅ Time slot ${date} ${time} is available in central calendar - proceeding with booking`);
        } catch (error) {
            console.error('Error checking central calendar availability:', error);
            // Continue with booking even if availability check fails (to prevent blocking legitimate bookings)
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

        // STEP 1: Save to CENTRAL ADMIN CALENDAR first (single source of truth)
        const { addCalendarEvent, determineCalendar } = require('./services/calendarManager');
        const calendarType = determineCalendar(serviceType || 'Moving Service');

        const centralCalendarEvent = {
            bookingId,
            title: `${firstName} ${lastName}`,
            date,
            time,
            serviceType: serviceType || 'Moving Service',
            company: bookingCompany,
            customer: {
                firstName,
                lastName,
                email,
                phone
            },
            addresses: {
                pickup: pickupAddress || '',
                dropoff: dropoffAddress || ''
            },
            estimateDetails: estimateDetails || null,
            estimatedHours: estimatedHours || null,
            numMovers: numMovers || null,
            estimatedTotal: estimatedTotal || null,
            status: 'confirmed',
            notes: notes || ''
        };

        await addCalendarEvent(calendarType, centralCalendarEvent);
        console.log(`📅 Event added to central ${calendarType} calendar: ${bookingId}`);

        // STEP 2: Save to MongoDB database
        const savedAppointment = await createAppointment(appointment);
        console.log(`📋 ${bookingCompany} booking saved to MongoDB: ${bookingId}`);

        // STEP 3: Sync to Google Calendar (Matt's and Zach's personal calendars)
        const eventDetails = {
            summary: `[${bookingCompany === 'Quality Moving' ? 'QM' : 'WF'}] ${serviceType || 'Moving Service'} - ${firstName} ${lastName}`,
            description: formatCalendarDescription(appointment),
            location: pickupAddress || '',
            start: `${date}T${time}:00`,
            end: calculateEndTime(date, time),
            attendees: ['zlarimer24@gmail.com']
        };

        try {
            const googleEventIds = await createGoogleCalendarEvent(eventDetails);

            // Update appointment in MongoDB with Google Calendar IDs
            await updateAppointment(bookingId, {
                googleEventId: googleEventIds
            });

            console.log('✅ Synced to Google Calendars:', googleEventIds);
        } catch (error) {
            console.error('❌ Failed to sync to Google Calendar:', error);
            // Continue even if Google Calendar sync fails - booking still saved to central calendar
        }

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
        const appointment = await getAppointmentByBookingId(bookingId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        res.json({ success: true, appointment });
    } catch (error) {
        console.error('Error fetching appointment from MongoDB:', error);
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
        const appointment = await getAppointmentByBookingId(bookingId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        const oldDate = appointment.date;
        const oldTime = appointment.time;

        await updateAppointment(bookingId, {
            date: newDate,
            time: newTime,
            rescheduledAt: new Date().toISOString(),
            previousDate: oldDate,
            previousTime: oldTime
        });

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

        // Get updated appointment to return
        const updatedAppointment = await getAppointmentByBookingId(bookingId);

        res.json({
            success: true,
            appointment: updatedAppointment,
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
        const appointment = await getAppointmentByBookingId(bookingId);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        // Allow updating specific fields
        const allowedFields = ['notes', 'pickupAddress', 'dropoffAddress', 'phone', 'email'];
        const filteredUpdates = {};
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        });

        // Update in MongoDB
        await updateAppointment(bookingId, filteredUpdates);

        // Get updated appointment
        const updatedAppointment = await getAppointmentByBookingId(bookingId);

        res.json({
            success: true,
            appointment: updatedAppointment,
            message: 'Appointment updated successfully'
        });
    } catch (error) {
        console.error('Error updating appointment in MongoDB:', error);
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

        const appointment = await getAppointmentByBookingId(bookingId);

        if (!appointment || appointment.email.toLowerCase() !== email.toLowerCase()) {
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
        console.error('Error looking up booking in MongoDB:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while retrieving your booking'
        });
    }
});

app.post('/api/cancel-appointment', async (req, res) => {
    try {
        const { bookingId } = req.body;
        const appointment = await getAppointmentByBookingId(bookingId);

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

        // Update appointment status in MongoDB
        await updateAppointment(bookingId, {
            status: 'cancelled',
            cancelledAt: new Date().toISOString()
        });

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
        console.error('Error cancelling appointment in MongoDB:', error);
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
        const appointment = await getAppointmentByBookingId(bookingId);

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
        console.error('Error generating BOL from MongoDB:', error);
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

        const oldAppointment = await getAppointmentByBookingId(bookingId);

        if (!oldAppointment) {
            return res.status(404).json({
                success: false,
                error: 'Appointment not found'
            });
        }

        // Update appointment in MongoDB
        await updateAppointment(bookingId, updates);

        // Get updated appointment
        const updatedAppointment = await getAppointmentByBookingId(bookingId);

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

        res.json({
            success: true,
            message: 'Appointment updated successfully',
            appointment: updatedAppointment
        });
    } catch (error) {
        console.error('Error updating appointment in MongoDB:', error);
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

        const appointment = await getAppointmentByBookingId(bookingId);

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

        // Delete from MongoDB
        await deleteMongoAppointment(bookingId);

        res.json({
            success: true,
            message: 'Appointment deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting appointment from MongoDB:', error);
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
        const services = await getServicesConfig();

        if (!services) {
            return res.status(404).json({
                success: false,
                error: 'Services configuration not found'
            });
        }

        // Return services directly for easier consumption by chatbot, admin portal, and public booking
        res.json(services);
    } catch (error) {
        console.error('Error loading services from MongoDB:', error);
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
        await updateServicesConfig(services);

        res.json({
            success: true,
            message: 'Services updated successfully'
        });
    } catch (error) {
        console.error('Error saving services to MongoDB:', error);
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

        console.log('📊 Calculate Estimate Request:', JSON.stringify(bookingData, null, 2));

        // Read from MongoDB (same source as admin portal) with fallback to file
        let services = await getServicesConfig();

        // If MongoDB config doesn't exist, fallback to file
        if (!services) {
            console.warn('⚠️ MongoDB config not found, falling back to services.json file');
            const servicesData = await fs.readFile(path.join(__dirname, 'data', 'services.json'), 'utf8');
            services = JSON.parse(servicesData);
        }

        if (!services) {
            throw new Error('No services configuration available');
        }

        console.log('✅ Services config loaded:', {
            hasMovingServices: !!services.movingServices,
            hasLaborOnly: !!services.laborOnly,
            hasFees: !!services.fees
        });

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
            let crewSize = 2;
            if (bookingData.serviceType.includes('3')) crewSize = 3;
            else if (bookingData.serviceType.includes('4')) crewSize = 4;

            if (services.movingServices) {
                // Calculate hourly rate dynamically - MATCHES CHATBOT
                const baseRate = services.movingServices.base || 192.50;
                const distanceAdj = services.movingServices.distanceAdj || 0.75;
                const crewAdd = services.movingServices.crewAdd || 55;
                const serviceChargeRate = services.movingServices.serviceCharge || 0.14;
                const distance = bookingData.distance || 10;
                const driveTime = bookingData.driveTime || 20;

                // Hourly rate = base + (distance × adjustment) + ((crew - 2) × crew add rate)
                const hourlyRate = baseRate + (distance * distanceAdj) + ((crewSize - 2) * crewAdd);

                estimatedTime = 3 + (driveTime / 60); // 3 hours base + drive time
                laborCost = hourlyRate * estimatedTime;
                subtotal = laborCost;

                // Service charge
                serviceCharge = subtotal * serviceChargeRate;
            }
        }

        // Labor Only
        else if (bookingData.serviceType === 'Labor Only' && services.laborOnly) {
            const hours = bookingData.estimatedHours || 2;
            const crew = bookingData.laborCrewSize || 2;
            const baseRate = services.laborOnly.baseRate || 115;
            const distanceAdj = services.laborOnly.distanceAdjustment || 0.50;
            const crewAddRate = services.laborOnly.crewAddRate || 55;
            const travelRate = services.laborOnly.travelRate || 1.60;
            const distance = bookingData.distance || 10;

            // Hourly rate = base + ((crew - 2) × crew add rate) + (distance × adjustment) - MATCHES CHATBOT
            const hourlyRate = baseRate + ((crew - 2) * crewAddRate) + (distance * distanceAdj);
            laborCost = hourlyRate * hours;
            travelFee = distance * 2 * travelRate; // Round trip
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

        const response = {
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
        };

        console.log('💰 Estimate Response:', JSON.stringify(response, null, 2));

        res.json(response);

    } catch (error) {
        console.error('❌ Error calculating estimate:', {
            message: error.message,
            stack: error.stack,
            requestData: req.body
        });
        res.status(500).json({
            success: false,
            error: 'Failed to calculate estimate',
            details: error.message
        });
    }
});

// Send estimate email to customer
app.post('/api/send-estimate', async (req, res) => {
    try {
        const {
            to,
            customerName,
            estimate,
            serviceType,
            pickupAddress,
            dropoffAddress,
            date,
            time,
            distance,
            company
        } = req.body;

        // Validate required fields
        if (!to || !customerName || !estimate) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: to, customerName, estimate'
            });
        }

        // Send the estimate email
        await sendEstimateEmail({
            to,
            customerName,
            estimate,
            serviceType: serviceType || 'Moving Service',
            pickupAddress: pickupAddress || '',
            dropoffAddress: dropoffAddress || '',
            date: date || '',
            time: time || '',
            distance: distance || 0,
            company: company || 'Worry Free Moving'
        });

        console.log(`📧 Estimate email sent to ${to} (${customerName}) - Total: $${estimate.total}`);

        res.json({
            success: true,
            message: 'Estimate email sent successfully'
        });

    } catch (error) {
        console.error('Error sending estimate email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send estimate email',
            details: error.message
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
// CREW TIME-OFF REQUEST ENDPOINT (MongoDB)
// ==============================================
// NOTE: GET endpoint moved to line ~1984 with MongoDB integration
// POST endpoint below saves to MongoDB

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

        // Save to MongoDB
        await createTimeOffRequest(timeOffRequest);

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

        // Get request from MongoDB
        const request = await getTimeOffRequestById(requestId);

        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Time-off request not found'
            });
        }

        // Update request status in MongoDB
        await updateTimeOffRequestStatus(requestId, status, responseNote);

        // Update the local request object for email/SMS
        request.status = status;
        request.responseNote = responseNote || '';
        request.respondedAt = new Date().toISOString();

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
            console.log(`✅ Time-off ${status} email sent to ${request.crewName}`);
        } catch (error) {
            console.error('❌ Failed to send response email:', error);
        }

        // Send SMS notification to crew member
        const { sendSMSConfirmation } = require('./services/smsService');
        try {
            const statusEmoji = status === 'approved' ? '✅' : '❌';
            const statusText = status === 'approved' ? 'APPROVED' : 'DENIED';

            await sendSMSConfirmation({
                phone: request.crewPhone,
                customerName: request.crewName,
                date: request.startDate,
                time: '', // No time for time off requests
                type: 'timeoff-response',
                serviceType: `Time Off Request ${statusEmoji} ${statusText}`,
                companyName: 'Worry Free Moving',
                pickupAddress: `${request.daysCount} day(s) ${request.requestType}: ${request.startDate} to ${request.endDate}${responseNote ? `. Note: ${responseNote}` : ''}`
            });
            console.log(`✅ Time-off ${status} SMS sent to ${request.crewName} at ${request.crewPhone}`);
        } catch (error) {
            console.error('❌ Failed to send SMS notification:', error);
        }

        res.json({
            success: true,
            message: `Time-off request ${status} successfully`,
            request
        });

        console.log(`✅ Time-off request ${requestId} ${status} for ${request.crewName}`);

    } catch (error) {
        console.error('Error responding to time-off request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to respond to time-off request'
        });
    }
});

// Get all time off requests (admin only)
app.get('/api/crew-timeoff', async (req, res) => {
    try {
        const requests = await getAllTimeOffRequests();

        res.json({
            success: true,
            requests,
            count: requests.length
        });

        console.log(`✅ Fetched ${requests.length} time-off requests`);

    } catch (error) {
        console.error('Error fetching time-off requests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch time-off requests',
            requests: []
        });
    }
});

// ==============================================
// CUSTOMER MANAGEMENT ENDPOINTS
// ==============================================

// Get all customers
app.get('/api/customers', async (req, res) => {
    try {
        const customers = await getAllCustomers();

        res.json({
            success: true,
            customers,
            count: customers.length
        });

        console.log(`✅ Fetched ${customers.length} customers`);

    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customers',
            customers: []
        });
    }
});

// Search customers
app.get('/api/customers/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Search term must be at least 2 characters',
                customers: []
            });
        }

        const customers = await searchCustomers(q.trim());

        res.json({
            success: true,
            customers,
            count: customers.length
        });

        console.log(`✅ Found ${customers.length} customers matching "${q}"`);

    } catch (error) {
        console.error('Error searching customers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search customers',
            customers: []
        });
    }
});

// Get single customer by ID
app.get('/api/customers/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        const customer = await getCustomerById(customerId);

        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        // Also get their booking history
        const bookings = await getCustomerBookings(customerId);

        res.json({
            success: true,
            customer,
            bookings,
            bookingCount: bookings.length
        });

        console.log(`✅ Fetched customer ${customerId}`);

    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customer'
        });
    }
});

// Create new customer
app.post('/api/customers', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, address, city, state, zip, notes } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !phone) {
            return res.status(400).json({
                success: false,
                error: 'First name, last name, email, and phone are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Check if customer with this email already exists
        const existing = await getCustomerByEmail(email);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Customer with this email already exists',
                existingCustomer: existing
            });
        }

        // Create customer object
        const customerData = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            address: address?.trim() || '',
            city: city?.trim() || '',
            state: state?.trim() || '',
            zip: zip?.trim() || '',
            notes: notes?.trim() || ''
        };

        // Save to MongoDB
        const customer = await createCustomer(customerData);

        res.json({
            success: true,
            message: 'Customer created successfully',
            customer
        });

        console.log(`✅ Created customer: ${customer.firstName} ${customer.lastName} (${customer.customerId})`);

    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create customer'
        });
    }
});

// Update customer
app.put('/api/customers/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        const { firstName, lastName, email, phone, address, city, state, zip, notes } = req.body;

        // Check if customer exists
        const existing = await getCustomerById(customerId);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid email format'
                });
            }

            // Check if email is being changed to one that already exists
            if (email.toLowerCase() !== existing.email.toLowerCase()) {
                const emailExists = await getCustomerByEmail(email);
                if (emailExists) {
                    return res.status(409).json({
                        success: false,
                        error: 'Another customer with this email already exists'
                    });
                }
            }
        }

        // Build updates object (only include provided fields)
        const updates = {};
        if (firstName !== undefined) updates.firstName = firstName.trim();
        if (lastName !== undefined) updates.lastName = lastName.trim();
        if (email !== undefined) updates.email = email.trim().toLowerCase();
        if (phone !== undefined) updates.phone = phone.trim();
        if (address !== undefined) updates.address = address.trim();
        if (city !== undefined) updates.city = city.trim();
        if (state !== undefined) updates.state = state.trim();
        if (zip !== undefined) updates.zip = zip.trim();
        if (notes !== undefined) updates.notes = notes.trim();

        // Update in MongoDB
        const success = await updateCustomer(customerId, updates);

        if (!success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to update customer'
            });
        }

        // Fetch updated customer
        const updatedCustomer = await getCustomerById(customerId);

        res.json({
            success: true,
            message: 'Customer updated successfully',
            customer: updatedCustomer
        });

        console.log(`✅ Updated customer ${customerId}`);

    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update customer'
        });
    }
});

// Delete customer
app.delete('/api/customers/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;

        // Check if customer exists
        const existing = await getCustomerById(customerId);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        // Delete from MongoDB
        const success = await deleteCustomer(customerId);

        if (!success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to delete customer'
            });
        }

        res.json({
            success: true,
            message: 'Customer deleted successfully'
        });

        console.log(`✅ Deleted customer ${customerId} (${existing.firstName} ${existing.lastName})`);

    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete customer'
        });
    }
});

// ==============================================
// TWILIO VOICE AI ENDPOINTS (Cheaper Alternative!)
// ==============================================
const twilioVoice = require('./services/twilioSmartVoice');

// Main voice endpoint - handles incoming calls
app.post('/api/twilio/voice', (req, res) => {
    twilioVoice.handleIncomingCall(req, res);
});

// Main menu
app.post('/api/twilio/main-menu', (req, res) => {
    twilioVoice.handleMainMenu(req, res);
});

// Confirm phone number before sending SMS
app.post('/api/twilio/confirm-phone-for-sms', (req, res) => {
    twilioVoice.handleConfirmPhoneForSMS(req, res);
});

// Send online booking link (skip phone call)
app.post('/api/twilio/send-online-booking-link', (req, res) => {
    twilioVoice.handleSendOnlineBookingLink(req, res);
});

// Call recording completion
app.post('/api/twilio/recording-complete', (req, res) => {
    twilioVoice.handleRecordingComplete(req, res);
});

// Transcription completion
app.post('/api/twilio/transcription-complete', (req, res) => {
    twilioVoice.handleTranscriptionComplete(req, res);
});

// Quote flow endpoints (NEW ORDER: service → addresses → distance → crew → quote)
app.post('/api/twilio/quote-service-type', (req, res) => {
    twilioVoice.handleQuoteServiceType(req, res);
});

app.post('/api/twilio/quote-pickup-address', (req, res) => {
    twilioVoice.handleQuotePickupAddress(req, res);
});

app.post('/api/twilio/quote-pickup-home-type', (req, res) => {
    twilioVoice.handleQuotePickupHomeType(req, res);
});

app.post('/api/twilio/quote-pickup-bedrooms', (req, res) => {
    twilioVoice.handleQuotePickupBedrooms(req, res);
});

app.post('/api/twilio/quote-pickup-stairs', (req, res) => {
    twilioVoice.handleQuotePickupStairs(req, res);
});

app.post('/api/twilio/quote-delivery-address', (req, res) => {
    twilioVoice.handleQuoteDeliveryAddress(req, res);
});

app.post('/api/twilio/quote-delivery-home-type', (req, res) => {
    twilioVoice.handleQuoteDeliveryHomeType(req, res);
});

app.post('/api/twilio/quote-delivery-bedrooms', (req, res) => {
    twilioVoice.handleQuoteDeliveryBedrooms(req, res);
});

app.post('/api/twilio/quote-delivery-stairs', (req, res) => {
    twilioVoice.handleQuoteDeliveryStairs(req, res);
});

app.post('/api/twilio/quote-appliances', (req, res) => {
    twilioVoice.handleQuoteAppliances(req, res);
});

app.post('/api/twilio/quote-appliances-details', (req, res) => {
    twilioVoice.handleQuoteAppliancesDetails(req, res);
});

app.post('/api/twilio/quote-heavy-items', (req, res) => {
    twilioVoice.handleQuoteHeavyItems(req, res);
});

app.post('/api/twilio/quote-heavy-items-details', (req, res) => {
    twilioVoice.handleQuoteHeavyItemsDetails(req, res);
});

app.post('/api/twilio/quote-packing-services', (req, res) => {
    twilioVoice.handleQuotePackingServices(req, res);
});

app.post('/api/twilio/quote-insurance', (req, res) => {
    twilioVoice.handleQuoteInsurance(req, res);
});

app.post('/api/twilio/quote-calculate-distance', (req, res) => {
    twilioVoice.handleQuoteCalculateDistance(req, res);
});

app.post('/api/twilio/quote-finalize', (req, res) => {
    twilioVoice.handleQuoteFinalize(req, res);
});

app.post('/api/twilio/quote-decision', (req, res) => {
    twilioVoice.handleQuoteDecision(req, res);
});

// Email quote endpoint
app.post('/api/twilio/email-quote-send', (req, res) => {
    twilioVoice.handleEmailQuoteSend(req, res);
});

// Booking flow endpoints
app.post('/api/twilio/booking-start', (req, res) => {
    twilioVoice.handleBookingStart(req, res);
});

app.post('/api/twilio/booking-email', (req, res) => {
    twilioVoice.handleBookingEmail(req, res);
});

app.post('/api/twilio/booking-date', (req, res) => {
    twilioVoice.handleBookingDate(req, res);
});

app.post('/api/twilio/booking-time-slot', (req, res) => {
    twilioVoice.handleBookingTimeSlot(req, res);
});

app.post('/api/twilio/booking-create', (req, res) => {
    twilioVoice.handleBookingCreate(req, res);
});

// ==============================================
// VAPI AI PHONE RECEPTIONIST ENDPOINTS (Optional - More Expensive)
// ==============================================
const { handleVapiWebhook } = require('./services/vapiEndpoints');
const { syncToOneDrive, generateCallSummary } = require('./services/vapiService');

// Main Vapi webhook - receives all events from AI assistant
app.post('/api/vapi/webhook', async (req, res) => {
    try {
        // Verify webhook secret if configured
        const secret = req.headers['x-vapi-secret'];
        if (process.env.VAPI_WEBHOOK_SECRET && secret !== process.env.VAPI_WEBHOOK_SECRET) {
            console.warn('⚠️ Invalid Vapi webhook secret');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await handleVapiWebhook(req, res);
    } catch (error) {
        console.error('Error in Vapi webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Manual sync to OneDrive
app.post('/api/vapi/sync', async (req, res) => {
    try {
        const result = await syncToOneDrive();
        res.json(result);
    } catch (error) {
        console.error('Error syncing to OneDrive:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get call summary for a specific date
app.get('/api/vapi/summary/:date?', async (req, res) => {
    try {
        const { date } = req.params;
        const result = await generateCallSummary(date);
        res.json(result);
    } catch (error) {
        console.error('Error generating call summary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test endpoint to verify Vapi integration
app.get('/api/vapi/test', (req, res) => {
    res.json({
        success: true,
        message: 'Vapi integration is active',
        configured: !!process.env.VAPI_API_KEY,
        webhookUrl: `${process.env.BASE_URL || 'http://localhost:3001'}/api/vapi/webhook`
    });
});

// ==============================================
// EMPLOYEE PORTAL ENDPOINTS
// ==============================================
const EMPLOYEES_FILE = path.join(__dirname, 'data', 'employees.json');
const bcrypt = require('bcrypt');

// Employee login - USES MONGODB
app.post('/api/employee/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Load employee from MongoDB
        const employee = await getEmployeeByUsername(username);

        if (!employee || employee.status !== 'active') {
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        // Verify password with bcrypt
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

        // Update last login in MongoDB
        const lastLogin = new Date().toISOString();
        await updateEmployeeLogin(employee.id, lastLogin);

        // Generate session token (simple for now, use JWT in production)
        const token = Buffer.from(`${employee.id}:${Date.now()}`).toString('base64');

        // Return employee data (without password)
        const { password: pwd, ...employeeData } = employee;
        employeeData.lastLogin = lastLogin; // Include updated lastLogin

        res.json({
            success: true,
            token,
            employee: employeeData,
            message: 'Login successful'
        });

        console.log(`✅ Employee login successful: ${username} (${employee.firstName} ${employee.lastName})`);

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
// Change employee password - USES MONGODB
app.post('/api/employee/change-password', async (req, res) => {
    try {
        const { employeeId, currentPassword, newPassword } = req.body;

        if (!employeeId || !currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Load employees from MongoDB
        const employees = await getAllEmployees();

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

        // Update employee password in MongoDB
        const passwordChangedAt = new Date().toISOString();
        await updateEmployeePassword(employeeId, hashedPassword, passwordChangedAt);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

        console.log(`✅ Password changed for employee: ${employeeId} (${employee.firstName} ${employee.lastName})`);

    } catch (error) {
        console.error('Error changing employee password:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to change password'
        });
    }
});

// Employee password reset (Admin) - USES MONGODB
app.post('/api/employee/reset-password', async (req, res) => {
    try {
        const { employeeId } = req.body;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                error: 'Employee ID required'
            });
        }

        // Load employees from MongoDB
        const employees = await getAllEmployees();

        // Find employee
        const employee = employees.find(emp => emp.id === employeeId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                error: 'Employee not found'
            });
        }

        // Generate temporary password (8 characters: uppercase, lowercase, numbers)
        const generateTempPassword = () => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
            let password = '';
            for (let i = 0; i < 8; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return password;
        };

        const temporaryPassword = generateTempPassword();

        // Hash the temporary password
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        // Update employee password in MongoDB
        const passwordChangedAt = new Date().toISOString();
        await updateEmployeePassword(employeeId, hashedPassword, passwordChangedAt);

        // Send password reset email
        await sendEmployeePasswordResetEmail({
            employeeName: `${employee.firstName} ${employee.lastName}`,
            email: employee.email,
            temporaryPassword: temporaryPassword,
            username: employee.username
        });

        res.json({
            success: true,
            message: 'Password reset email sent successfully',
            temporaryPassword: temporaryPassword
        });

        console.log(`✅ Password reset for employee: ${employeeId} (${employee.firstName} ${employee.lastName})`);
        console.log(`   Temporary password: ${temporaryPassword}`);
        console.log(`   Email sent to: ${employee.email}`);

    } catch (error) {
        console.error('Error resetting employee password:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset password',
            details: error.message
        });
    }
});

// ==============================================
// EMPLOYEE MANAGEMENT ENDPOINTS (Admin)
// ==============================================

// Helper functions for employee management
async function loadEmployees() {
    try {
        return await getAllEmployees();
    } catch (error) {
        console.error('Error loading employees from MongoDB:', error);
        return [];
    }
}

async function saveEmployees(employees) {
    try {
        await updateMongoEmployees(employees);
        return true;
    } catch (error) {
        console.error('Error saving employees to MongoDB:', error);
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

        // Send welcome email to new employee
        try {
            await sendEmployeeWelcomeEmail({
                email,
                username,
                password, // Plain text password (only available now, before hashing)
                firstName,
                lastName,
                role: role || 'crew'
            });
            console.log(`✅ Welcome email sent to new employee: ${firstName} ${lastName} (${email})`);
        } catch (error) {
            console.error('❌ Failed to send welcome email to employee:', error);
            // Don't fail the employee creation if email fails
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

        // Send welcome email to new authorized user
        try {
            await sendAdminUserWelcomeEmail({
                email,
                username,
                password, // Plain text password (only available now, before hashing)
                name: `${firstName} ${lastName}`
            });
            console.log(`✅ Welcome email sent to new authorized user: ${firstName} ${lastName} (${email})`);
        } catch (error) {
            console.error('❌ Failed to send welcome email to authorized user:', error);
            // Don't fail the user creation if email fails
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

    // Connect to MongoDB Atlas
    try {
        await connectDatabase();
        console.log('✅ MongoDB Atlas connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.error('⚠️  Server will continue with limited functionality');
    }

    // Initialize Google Calendar auth (optional, can be done later)
    try {
        await initGoogleAuth();
        console.log('✅ Google Calendar initialized');
    } catch (error) {
        console.error('❌ Google Calendar initialization failed:', error.message);
    }

    // Initialize 24-hour reminder scheduler
    const { initReminderScheduler } = require('./services/reminderScheduler');
    initReminderScheduler();

    // Initialize Vapi call data sync scheduler
    if (process.env.VAPI_API_KEY) {
        const { initVapiSyncScheduler } = require('./services/vapiSyncScheduler');
        initVapiSyncScheduler();
    }

    app.listen(PORT, () => {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🚀 Booking API server running on http://localhost:${PORT}`);
        console.log(`💾 Database: MongoDB Atlas (Cloud Storage)`);
        console.log(`📆 Google Calendar sync: ${process.env.GOOGLE_CALENDAR_ID ? 'ACTIVE' : 'Ready (configure credentials.json)'}`);
        console.log(`⏰ 24-hour reminder system: ACTIVE`);
        console.log(`📧 Email notifications: ${process.env.EMAIL_SERVICE || 'NOT CONFIGURED'}`);
        console.log(`📱 SMS notifications: ${process.env.RINGCENTRAL_CLIENT_ID ? 'ACTIVE' : 'NOT CONFIGURED'}`);
        console.log(`📞 Twilio Voice AI: ${process.env.TWILIO_ACCOUNT_SID ? 'CONFIGURED (~$0.02/min)' : 'NOT CONFIGURED'}`);
        console.log(`📞 Vapi AI Phone: ${process.env.VAPI_API_KEY ? 'CONFIGURED (~$0.15/min)' : 'NOT CONFIGURED'}`);
        console.log(`${'='.repeat(50)}\n`);
    });
}

startServer();
