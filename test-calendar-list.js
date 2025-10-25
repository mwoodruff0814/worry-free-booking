const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

async function listCalendars() {
    try {
        // Read credentials
        const credentialsPath = path.join(__dirname, 'credentials.json');
        const credentialsContent = await fs.readFile(credentialsPath, 'utf8');
        const credentials = JSON.parse(credentialsContent);

        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

        // Test Matt's calendars
        console.log('\n📅 MATT\'S CALENDARS:\n');
        try {
            const tokenPath = path.join(__dirname, 'token.json');
            const token = await fs.readFile(tokenPath, 'utf8');
            const mattOAuth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            mattOAuth.setCredentials(JSON.parse(token));
            const mattCalendar = google.calendar({ version: 'v3', auth: mattOAuth });

            const mattList = await mattCalendar.calendarList.list();
            mattList.data.items.forEach(cal => {
                console.log(`  - ${cal.summary} (${cal.id}) ${cal.primary ? '[PRIMARY]' : ''}`);
            });

            // Check if our test event exists
            console.log('\n🔍 Checking for test event on Matt\'s calendars...\n');
            const eventId = '1nbk4u63ebm4v72fr1o15k3mnk';

            for (const cal of mattList.data.items) {
                try {
                    const event = await mattCalendar.events.get({
                        calendarId: cal.id,
                        eventId: eventId
                    });
                    console.log(`  ✅ Event found on: ${cal.summary} (${cal.id})`);
                    console.log(`     Title: ${event.data.summary}`);
                    console.log(`     Start: ${event.data.start.dateTime}`);
                } catch (err) {
                    // Event not on this calendar
                }
            }

        } catch (error) {
            console.error('❌ Matt\'s calendar error:', error.message);
        }

        // Test Zach's calendars
        console.log('\n📅 ZACH\'S CALENDARS:\n');
        try {
            const zachTokenPath = path.join(__dirname, 'token-zach.json');
            const zachToken = await fs.readFile(zachTokenPath, 'utf8');
            const zachOAuth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            zachOAuth.setCredentials(JSON.parse(zachToken));
            const zachCalendar = google.calendar({ version: 'v3', auth: zachOAuth });

            const zachList = await zachCalendar.calendarList.list();
            zachList.data.items.forEach(cal => {
                console.log(`  - ${cal.summary} (${cal.id}) ${cal.primary ? '[PRIMARY]' : ''}`);
            });

            // Check if our test event exists
            console.log('\n🔍 Checking for test event on Zach\'s calendars...\n');
            const eventId = 'vscea64cg2h81nqlji16f2j9qc';

            for (const cal of zachList.data.items) {
                try {
                    const event = await zachCalendar.events.get({
                        calendarId: cal.id,
                        eventId: eventId
                    });
                    console.log(`  ✅ Event found on: ${cal.summary} (${cal.id})`);
                    console.log(`     Title: ${event.data.summary}`);
                    console.log(`     Start: ${event.data.start.dateTime}`);
                } catch (err) {
                    // Event not on this calendar
                }
            }

        } catch (error) {
            console.error('❌ Zach\'s calendar error:', error.message);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

listCalendars();
