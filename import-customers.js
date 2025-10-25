const fs = require('fs').promises;
const path = require('path');

// CSV parser (simple implementation)
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Simple CSV parsing (handles quoted fields)
        const values = [];
        let currentValue = '';
        let insideQuotes = false;

        for (let char of lines[i]) {
            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim()); // Push the last value

        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            data.push(row);
        }
    }

    return data;
}

// Generate booking ID
function generateBookingId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `WFM-${timestamp}-${random}`;
}

// Clean phone number
function cleanPhone(phone) {
    if (!phone) return '';
    // Remove special characters and formatting
    return phone.replace(/[^0-9]/g, '').replace(/^\+1/, '').slice(0, 10);
}

// Format phone for display
function formatPhone(phone) {
    const cleaned = cleanPhone(phone);
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

async function importCustomers() {
    try {
        console.log('📂 Reading CSV file...');
        const csvPath = 'C:\\Users\\caspe\\Downloads\\list.csv';
        const csvText = await fs.readFile(csvPath, 'utf8');

        console.log('📊 Parsing CSV data...');
        const customers = parseCSV(csvText);
        console.log(`✅ Found ${customers.length} customers`);

        console.log('📖 Reading existing appointments...');
        const appointmentsPath = path.join(__dirname, 'data', 'appointments.json');
        let existingAppointments = [];
        try {
            const data = await fs.readFile(appointmentsPath, 'utf8');
            existingAppointments = JSON.parse(data);
        } catch (err) {
            console.log('No existing appointments found, starting fresh');
        }

        // Get existing emails to avoid duplicates
        const existingEmails = new Set(existingAppointments.map(apt => apt.email?.toLowerCase()));

        console.log('💾 Creating appointment records...');
        let imported = 0;
        let skipped = 0;

        for (const customer of customers) {
            // Skip if no email or banned
            if (!customer.Email || customer.Banned === 'Y') {
                skipped++;
                continue;
            }

            // Skip if email already exists
            if (existingEmails.has(customer.Email.toLowerCase())) {
                skipped++;
                continue;
            }

            // Calculate appointment date based on "Days Since Last Appointment"
            const daysAgo = parseInt(customer['Days Since Last Appointment']) || 0;
            const appointmentDate = new Date();
            appointmentDate.setDate(appointmentDate.getDate() - daysAgo);

            const appointment = {
                bookingId: generateBookingId(),
                firstName: customer['First Name'] || '',
                lastName: customer['Last Name'] || '',
                email: customer.Email,
                phone: formatPhone(customer.Phone),
                date: appointmentDate.toISOString().split('T')[0],
                time: '10:00', // Default time
                serviceType: 'Moving Service', // Default service
                pickupAddress: '',
                dropoffAddress: '',
                notes: customer.Notes || 'Imported from customer list',
                status: 'completed', // Mark as completed since these are past customers
                createdAt: appointmentDate.toISOString(),
                updatedAt: appointmentDate.toISOString(),
                imported: true,
                originalDaysSinceLastAppointment: customer['Days Since Last Appointment']
            };

            existingAppointments.push(appointment);
            existingEmails.add(customer.Email.toLowerCase());
            imported++;
        }

        console.log('💾 Saving appointments...');
        await fs.writeFile(
            appointmentsPath,
            JSON.stringify(existingAppointments, null, 2)
        );

        console.log('\n' + '='.repeat(60));
        console.log('✅ IMPORT COMPLETE!');
        console.log('='.repeat(60));
        console.log(`📊 Total customers in CSV: ${customers.length}`);
        console.log(`✅ Successfully imported: ${imported}`);
        console.log(`⏭️  Skipped (duplicates/banned/no email): ${skipped}`);
        console.log(`📁 Total appointments now: ${existingAppointments.length}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error importing customers:', error);
    }
}

// Run the import
importCustomers();
