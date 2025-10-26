/**
 * MongoDB Database Service
 * Replaces JSON file storage with MongoDB Atlas
 */

const { MongoClient } = require('mongodb');

let client = null;
let db = null;

/**
 * Connect to MongoDB Atlas
 */
async function connectDatabase() {
    try {
        if (db) {
            return db; // Already connected
        }

        const uri = process.env.MONGODB_URI;

        if (!uri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        client = new MongoClient(uri);
        await client.connect();

        db = client.db('worryFreeBooking');

        console.log('✅ Connected to MongoDB Atlas');

        // Create indexes for better performance
        await createIndexes();

        return db;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        throw error;
    }
}

/**
 * Create database indexes for better query performance
 */
async function createIndexes() {
    try {
        // Appointments indexes
        await db.collection('appointments').createIndex({ bookingId: 1 }, { unique: true });
        await db.collection('appointments').createIndex({ company: 1 });
        await db.collection('appointments').createIndex({ date: 1, time: 1 });
        await db.collection('appointments').createIndex({ email: 1 });
        await db.collection('appointments').createIndex({ status: 1 });
        await db.collection('appointments').createIndex({ createdAt: -1 });

        // Users index
        await db.collection('users').createIndex({ username: 1 }, { unique: true });

        // Calendar events indexes
        await db.collection('calendarEvents').createIndex({ calendarType: 1, date: 1 });
        await db.collection('calendarEvents').createIndex({ bookingId: 1 });

        console.log('✅ Database indexes created');
    } catch (error) {
        // Indexes might already exist, that's okay
        if (error.code !== 11000) {
            console.warn('Index creation warning:', error.message);
        }
    }
}

/**
 * Get database instance
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not connected. Call connectDatabase() first.');
    }
    return db;
}

/**
 * Close database connection
 */
async function closeDatabase() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log('MongoDB connection closed');
    }
}

// ========================================
// APPOINTMENTS OPERATIONS
// ========================================

/**
 * Get all appointments for a specific company
 */
async function getAppointments(company) {
    const database = getDatabase();
    const query = company ? { company } : {};
    return await database.collection('appointments').find(query).sort({ createdAt: -1 }).toArray();
}

/**
 * Get appointment by booking ID
 */
async function getAppointmentByBookingId(bookingId) {
    const database = getDatabase();
    return await database.collection('appointments').findOne({ bookingId });
}

/**
 * Create new appointment
 */
async function createAppointment(appointment) {
    const database = getDatabase();
    const result = await database.collection('appointments').insertOne({
        ...appointment,
        createdAt: appointment.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    return {
        ...appointment,
        _id: result.insertedId
    };
}

/**
 * Update appointment
 */
async function updateAppointment(bookingId, updates) {
    const database = getDatabase();
    const result = await database.collection('appointments').updateOne(
        { bookingId },
        {
            $set: {
                ...updates,
                updatedAt: new Date().toISOString()
            }
        }
    );

    return result.modifiedCount > 0;
}

/**
 * Delete appointment
 */
async function deleteAppointment(bookingId) {
    const database = getDatabase();
    const result = await database.collection('appointments').deleteOne({ bookingId });
    return result.deletedCount > 0;
}

// ========================================
// CALENDAR EVENTS OPERATIONS
// ========================================

/**
 * Get calendar events for a specific date
 */
async function getCalendarEvents(calendarType, date) {
    const database = getDatabase();
    return await database.collection('calendarEvents').find({
        calendarType,
        date
    }).toArray();
}

/**
 * Create calendar event
 */
async function createCalendarEvent(calendarType, event) {
    const database = getDatabase();
    const result = await database.collection('calendarEvents').insertOne({
        ...event,
        calendarType,
        addedAt: new Date().toISOString()
    });

    return {
        ...event,
        _id: result.insertedId
    };
}

/**
 * Update calendar event status
 */
async function updateCalendarEventStatus(calendarType, eventId, status) {
    const database = getDatabase();
    const result = await database.collection('calendarEvents').updateOne(
        {
            calendarType,
            $or: [
                { bookingId: eventId },
                { id: eventId }
            ]
        },
        {
            $set: {
                status,
                updatedAt: new Date().toISOString()
            }
        }
    );

    return result.modifiedCount > 0;
}

// ========================================
// USERS OPERATIONS
// ========================================

/**
 * Get user by username
 */
async function getUserByUsername(username) {
    const database = getDatabase();
    return await database.collection('users').findOne({ username });
}

/**
 * Get all users
 */
async function getAllUsers() {
    const database = getDatabase();
    return await database.collection('users').find({}).toArray();
}

/**
 * Create new user
 */
async function createUser(user) {
    const database = getDatabase();
    const result = await database.collection('users').insertOne({
        ...user,
        createdAt: new Date().toISOString()
    });

    return {
        ...user,
        _id: result.insertedId
    };
}

// ========================================
// EMPLOYEES OPERATIONS
// ========================================

/**
 * Get all employees
 */
async function getAllEmployees() {
    const database = getDatabase();
    return await database.collection('employees').find({}).toArray();
}

/**
 * Update employees list
 */
async function updateEmployees(employees) {
    const database = getDatabase();

    // Clear existing employees
    await database.collection('employees').deleteMany({});

    // Insert new employees
    if (employees.length > 0) {
        await database.collection('employees').insertMany(
            employees.map(emp => ({
                ...emp,
                updatedAt: new Date().toISOString()
            }))
        );
    }

    return true;
}

/**
 * Get employee by username (for login)
 */
async function getEmployeeByUsername(username) {
    const database = getDatabase();
    return await database.collection('employees').findOne({ username });
}

/**
 * Update employee last login timestamp
 */
async function updateEmployeeLogin(employeeId, lastLogin) {
    const database = getDatabase();
    await database.collection('employees').updateOne(
        { id: employeeId },
        { $set: { lastLogin, updatedAt: new Date().toISOString() } }
    );
    return true;
}

/**
 * Update employee password
 */
async function updateEmployeePassword(employeeId, newPasswordHash, passwordChangedAt) {
    const database = getDatabase();
    await database.collection('employees').updateOne(
        { id: employeeId },
        {
            $set: {
                password: newPasswordHash,
                passwordChangedAt,
                updatedAt: new Date().toISOString()
            }
        }
    );
    return true;
}

// ========================================
// SERVICES OPERATIONS
// ========================================

/**
 * Get services configuration
 */
async function getServicesConfig() {
    const database = getDatabase();
    const config = await database.collection('config').findOne({ type: 'services' });
    return config ? config.data : null;
}

/**
 * Update services configuration
 */
async function updateServicesConfig(servicesData) {
    const database = getDatabase();
    await database.collection('config').updateOne(
        { type: 'services' },
        {
            $set: {
                data: servicesData,
                updatedAt: new Date().toISOString()
            }
        },
        { upsert: true }
    );

    return true;
}

// ========================================
// TIME OFF REQUESTS OPERATIONS
// ========================================

/**
 * Get all time off requests
 */
async function getAllTimeOffRequests() {
    const database = getDatabase();
    return await database.collection('timeOffRequests').find({}).sort({ createdAt: -1 }).toArray();
}

/**
 * Get time off request by ID
 */
async function getTimeOffRequestById(requestId) {
    const database = getDatabase();
    return await database.collection('timeOffRequests').findOne({ requestId });
}

/**
 * Create time off request
 */
async function createTimeOffRequest(request) {
    const database = getDatabase();
    const result = await database.collection('timeOffRequests').insertOne({
        ...request,
        createdAt: request.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    return {
        ...request,
        _id: result.insertedId
    };
}

/**
 * Update time off request status
 */
async function updateTimeOffRequestStatus(requestId, status, responseNote) {
    const database = getDatabase();
    const result = await database.collection('timeOffRequests').updateOne(
        { requestId },
        {
            $set: {
                status,
                responseNote: responseNote || '',
                respondedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }
    );

    return result.modifiedCount > 0;
}

/**
 * Get pending time off requests
 */
async function getPendingTimeOffRequests() {
    const database = getDatabase();
    return await database.collection('timeOffRequests').find({ status: 'pending' }).sort({ createdAt: -1 }).toArray();
}

// ========================================
// CUSTOMERS OPERATIONS
// ========================================

/**
 * Get all customers
 */
async function getAllCustomers() {
    const database = getDatabase();
    return await database.collection('customers').find({}).sort({ createdAt: -1 }).toArray();
}

/**
 * Get customer by ID
 */
async function getCustomerById(customerId) {
    const database = getDatabase();
    return await database.collection('customers').findOne({ customerId });
}

/**
 * Get customer by email
 */
async function getCustomerByEmail(email) {
    const database = getDatabase();
    return await database.collection('customers').findOne({ email: email.toLowerCase() });
}

/**
 * Search customers by name, email, or phone
 */
async function searchCustomers(searchTerm) {
    const database = getDatabase();
    const regex = new RegExp(searchTerm, 'i'); // Case-insensitive search

    return await database.collection('customers').find({
        $or: [
            { firstName: regex },
            { lastName: regex },
            { email: regex },
            { phone: regex }
        ]
    }).sort({ createdAt: -1 }).toArray();
}

/**
 * Create new customer
 */
async function createCustomer(customer) {
    const database = getDatabase();

    // Generate customer ID if not provided
    if (!customer.customerId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        customer.customerId = `CUST-${timestamp}-${random}`;
    }

    // Ensure email is lowercase
    if (customer.email) {
        customer.email = customer.email.toLowerCase();
    }

    const result = await database.collection('customers').insertOne({
        ...customer,
        createdAt: customer.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    return {
        ...customer,
        _id: result.insertedId
    };
}

/**
 * Update customer
 */
async function updateCustomer(customerId, updates) {
    const database = getDatabase();

    // Ensure email is lowercase if being updated
    if (updates.email) {
        updates.email = updates.email.toLowerCase();
    }

    const result = await database.collection('customers').updateOne(
        { customerId },
        {
            $set: {
                ...updates,
                updatedAt: new Date().toISOString()
            }
        }
    );

    return result.modifiedCount > 0;
}

/**
 * Delete customer
 */
async function deleteCustomer(customerId) {
    const database = getDatabase();
    const result = await database.collection('customers').deleteOne({ customerId });
    return result.deletedCount > 0;
}

/**
 * Get customer booking history
 */
async function getCustomerBookings(customerId) {
    const database = getDatabase();
    const customer = await getCustomerById(customerId);

    if (!customer || !customer.email) {
        return [];
    }

    // Find all bookings with this customer's email
    return await database.collection('appointments').find({
        email: customer.email
    }).sort({ date: -1, createdAt: -1 }).toArray();
}

// ========================================
// MIGRATION HELPERS
// ========================================

/**
 * Bulk insert appointments (for migration)
 */
async function bulkInsertAppointments(appointments) {
    const database = getDatabase();

    if (appointments.length === 0) {
        return 0;
    }

    const result = await database.collection('appointments').insertMany(
        appointments.map(apt => ({
            ...apt,
            createdAt: apt.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })),
        { ordered: false } // Continue even if some inserts fail (duplicates)
    );

    return result.insertedCount;
}

/**
 * Count documents in a collection
 */
async function countDocuments(collectionName) {
    const database = getDatabase();
    return await database.collection(collectionName).countDocuments();
}

module.exports = {
    connectDatabase,
    getDatabase,
    closeDatabase,

    // Appointments
    getAppointments,
    getAppointmentByBookingId,
    createAppointment,
    updateAppointment,
    deleteAppointment,

    // Calendar Events
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEventStatus,

    // Users
    getUserByUsername,
    getAllUsers,
    createUser,

    // Employees
    getAllEmployees,
    updateEmployees,
    getEmployeeByUsername,
    updateEmployeeLogin,
    updateEmployeePassword,

    // Services
    getServicesConfig,
    updateServicesConfig,

    // Time Off Requests
    getAllTimeOffRequests,
    getTimeOffRequestById,
    createTimeOffRequest,
    updateTimeOffRequestStatus,
    getPendingTimeOffRequests,

    // Customers
    getAllCustomers,
    getCustomerById,
    getCustomerByEmail,
    searchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerBookings,

    // Migration
    bulkInsertAppointments,
    countDocuments
};
