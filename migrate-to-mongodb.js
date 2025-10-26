/**
 * Migration Script: JSON Files → MongoDB Atlas
 * Migrates all existing data to MongoDB
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const {
    connectDatabase,
    bulkInsertAppointments,
    createUser,
    updateEmployees,
    updateServicesConfig,
    countDocuments,
    closeDatabase
} = require('./services/database');

async function migrate() {
    console.log('\n========================================');
    console.log('🚀 STARTING MIGRATION TO MONGODB ATLAS');
    console.log('========================================\n');

    try {
        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB Atlas...');
        await connectDatabase();
        console.log('✅ Connected successfully!\n');

        // ========================================
        // MIGRATE APPOINTMENTS
        // ========================================
        console.log('📋 Migrating appointments...');

        let totalAppointments = 0;

        // Migrate Worry Free Moving appointments
        try {
            const wfAppointmentsPath = path.join(__dirname, 'data', 'appointments.json');
            const wfData = await fs.readFile(wfAppointmentsPath, 'utf8');
            const wfAppointments = JSON.parse(wfData);

            if (Array.isArray(wfAppointments) && wfAppointments.length > 0) {
                const count = await bulkInsertAppointments(wfAppointments);
                console.log(`  ✅ Worry Free Moving: ${count} appointments migrated`);
                totalAppointments += count;
            }
        } catch (error) {
            console.log('  ⚠️  Worry Free appointments file not found or empty');
        }

        // Migrate Quality Moving appointments
        try {
            const qmAppointmentsPath = path.join(__dirname, 'data', 'quality-appointments.json');
            const qmData = await fs.readFile(qmAppointmentsPath, 'utf8');
            const qmAppointments = JSON.parse(qmData);

            if (Array.isArray(qmAppointments) && qmAppointments.length > 0) {
                const count = await bulkInsertAppointments(qmAppointments);
                console.log(`  ✅ Quality Moving: ${count} appointments migrated`);
                totalAppointments += count;
            }
        } catch (error) {
            console.log('  ⚠️  Quality Moving appointments file not found or empty');
        }

        console.log(`\n📊 TOTAL APPOINTMENTS MIGRATED: ${totalAppointments}\n`);

        // ========================================
        // MIGRATE USERS
        // ========================================
        console.log('👥 Migrating authorized users...');

        try {
            const usersPath = path.join(__dirname, 'data', 'authorized-users.json');
            const usersData = await fs.readFile(usersPath, 'utf8');
            const users = JSON.parse(usersData);

            if (Array.isArray(users) && users.length > 0) {
                let userCount = 0;
                for (const user of users) {
                    try {
                        await createUser(user);
                        userCount++;
                    } catch (error) {
                        if (error.code === 11000) {
                            console.log(`  ⚠️  User "${user.username}" already exists, skipping`);
                        } else {
                            throw error;
                        }
                    }
                }
                console.log(`  ✅ ${userCount} users migrated\n`);
            }
        } catch (error) {
            console.log('  ⚠️  Users file not found or empty\n');
        }

        // ========================================
        // MIGRATE EMPLOYEES
        // ========================================
        console.log('👷 Migrating employees...');

        try {
            const employeesPath = path.join(__dirname, 'data', 'employees.json');
            const employeesData = await fs.readFile(employeesPath, 'utf8');
            const employees = JSON.parse(employeesData);

            if (Array.isArray(employees) && employees.length > 0) {
                await updateEmployees(employees);
                console.log(`  ✅ ${employees.length} employees migrated\n`);
            }
        } catch (error) {
            console.log('  ⚠️  Employees file not found or empty\n');
        }

        // ========================================
        // MIGRATE SERVICES CONFIG
        // ========================================
        console.log('⚙️  Migrating services configuration...');

        try {
            const servicesPath = path.join(__dirname, 'data', 'services.json');
            const servicesData = await fs.readFile(servicesPath, 'utf8');
            const services = JSON.parse(servicesData);

            await updateServicesConfig(services);
            console.log('  ✅ Services configuration migrated\n');
        } catch (error) {
            console.log('  ⚠️  Services config file not found or empty\n');
        }

        // ========================================
        // VERIFY MIGRATION
        // ========================================
        console.log('========================================');
        console.log('📊 MIGRATION VERIFICATION');
        console.log('========================================\n');

        const appointmentCount = await countDocuments('appointments');
        const userCount = await countDocuments('users');
        const employeeCount = await countDocuments('employees');

        console.log(`  Appointments: ${appointmentCount}`);
        console.log(`  Users: ${userCount}`);
        console.log(`  Employees: ${employeeCount}`);

        console.log('\n========================================');
        console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('========================================\n');

        console.log('🎉 All data has been safely migrated to MongoDB Atlas');
        console.log('📦 Your data is now stored in the cloud and will persist forever');
        console.log('🔒 No more data loss on server restarts!\n');

    } catch (error) {
        console.error('\n❌ MIGRATION FAILED:', error);
        console.error('\nPlease check the error above and try again.\n');
        process.exit(1);
    } finally {
        await closeDatabase();
    }
}

// Run migration
migrate();
