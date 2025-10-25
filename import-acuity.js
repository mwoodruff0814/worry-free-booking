const ical = require('node-ical');
const fs = require('fs').promises;
const path = require('path');

const APPOINTMENTS_FILE = path.join(__dirname, 'data', 'appointments.json');
const ICAL_FILE = path.join(__dirname, 'acuity-export.csv');

async function importAcuityData() {
    try {
        console.log('🔍 Reading iCal file...');
        const events = await ical.async.parseFile(ICAL_FILE);

        console.log(`📊 Found ${Object.keys(events).length} total items`);

        // Load existing appointments
        let existingAppointments = [];
        try {
            const data = await fs.readFile(APPOINTMENTS_FILE, 'utf8');
            existingAppointments = JSON.parse(data);
        } catch (error) {
            console.log('📝 No existing appointments file found, will create new one');
        }

        const appointments = [];
        let skipped = 0;
        let imported = 0;

        for (const k in events) {
            if (events.hasOwnProperty(k)) {
                const event = events[k];

                // Only process VEVENT types
                if (event.type !== 'VEVENT') {
                    skipped++;
                    continue;
                }

                try {
                    // Parse description for customer info
                    const description = event.description || '';

                    // Extract name
                    const nameMatch = description.match(/Name:\s*(.+?)(?:\n|$)/);
                    const fullName = nameMatch ? nameMatch[1].trim() : 'Unknown';
                    const [firstName, ...lastNameParts] = fullName.split(' ');
                    const lastName = lastNameParts.join(' ') || firstName;

                    // Extract phone
                    const phoneMatch = description.match(/Phone:\s*(.+?)(?:\n|$)/);
                    const phone = phoneMatch ? phoneMatch[1].trim() : '';

                    // Extract email
                    const emailMatch = description.match(/Email:\s*(.+?)(?:\n|$)/);
                    const email = emailMatch ? emailMatch[1].trim() : '';

                    // Extract location/addresses from description
                    const locationMatch = description.match(/Starting Location:\s*(.+?)(?:\n|$)/);
                    const pickupAddress = locationMatch ? locationMatch[1].trim() : (event.location || '');

                    const location2Match = description.match(/2nd Location:\s*(.+?)(?:\n|$)/);
                    const dropoffAddress = location2Match ? location2Match[1].trim() : '';

                    // Get service type from summary
                    const summary = event.summary || '';
                    let serviceType = 'Moving Service';
                    if (summary.includes('LABOR ONLY')) {
                        serviceType = 'Labor Only Service';
                    } else if (summary.includes('MOVING')) {
                        serviceType = 'Moving Service';
                    } else if (summary.includes('SINGLE ITEM')) {
                        serviceType = 'Single Item Move';
                    }

                    // Parse date and time (convert from UTC)
                    const startDate = new Date(event.start);
                    const date = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
                    const hours = startDate.getHours().toString().padStart(2, '0');
                    const minutes = startDate.getMinutes().toString().padStart(2, '0');
                    const time = `${hours}:${minutes}`;

                    // Generate booking ID
                    const bookingId = `WF-ACU-${event.uid.replace('@scheduling', '')}`;

                    // Check if already imported
                    const alreadyExists = existingAppointments.some(apt => apt.bookingId === bookingId);
                    if (alreadyExists) {
                        skipped++;
                        continue;
                    }

                    // Create appointment object
                    const appointment = {
                        bookingId,
                        company: 'Worry Free Moving',
                        firstName: firstName || 'Unknown',
                        lastName: lastName || 'Customer',
                        email: email || '',
                        phone: phone || '',
                        date,
                        time,
                        serviceType,
                        pickupAddress,
                        dropoffAddress,
                        notes: `Imported from Acuity Scheduling\n\n${description}`,
                        estimateDetails: null,
                        estimatedHours: null,
                        numMovers: null,
                        estimatedTotal: null,
                        priority: 'normal',
                        crewAssignment: null,
                        jobTag: 'acuity-import',
                        paymentMethod: 'pending',
                        paymentStatus: 'pending',
                        status: 'confirmed',
                        googleEventId: null, // Will be synced later
                        createdAt: new Date().toISOString(),
                        importedFrom: 'Acuity Scheduling',
                        acuityEventId: event.uid
                    };

                    appointments.push(appointment);
                    imported++;

                    console.log(`✅ Imported: ${firstName} ${lastName} - ${date} ${time} - ${serviceType}`);
                } catch (error) {
                    console.error(`❌ Error processing event ${event.uid}:`, error.message);
                    skipped++;
                }
            }
        }

        // Merge with existing appointments
        const allAppointments = [...existingAppointments, ...appointments];

        // Save to file
        await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify(allAppointments, null, 2));

        console.log('\n' + '='.repeat(60));
        console.log('📊 IMPORT SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successfully imported: ${imported} appointments`);
        console.log(`⏭️  Skipped (duplicates/errors): ${skipped}`);
        console.log(`📁 Total appointments in system: ${allAppointments.length}`);
        console.log('='.repeat(60));
        console.log('\n💡 Next step: Run the calendar sync to add these to Google Calendar');
        console.log('   curl -X POST http://localhost:3001/api/sync-calendar');

    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    }
}

// Run the import
importAcuityData();
