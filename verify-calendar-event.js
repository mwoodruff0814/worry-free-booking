const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

async function verifyEvent() {
    try {
        const credentialsPath = path.join(__dirname, 'credentials.json');
        const credentialsContent = await fs.readFile(credentialsPath, 'utf8');
        const credentials = JSON.parse(credentialsContent);

        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

        // Check Matt's calendar events for today and upcoming
        console.log('\n📅 MATT\'S UPCOMING EVENTS:\n');
        try {
            const tokenPath = path.join(__dirname, 'token.json');
            const token = await fs.readFile(tokenPath, 'utf8');
            const mattOAuth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            mattOAuth.setCredentials(JSON.parse(token));
            const mattCalendar = google.calendar({ version: 'v3', auth: mattOAuth });

            // List all upcoming events on Matt's primary calendar
            const mattEvents = await mattCalendar.events.list({
                calendarId: 'matt@worryfreemovers.com',
                timeMin: new Date().toISOString(),
                maxResults: 20,
                singleEvents: true,
                orderBy: 'startTime'
            });

            console.log(`Found ${mattEvents.data.items.length} upcoming events on matt@worryfreemovers.com:\n`);
            mattEvents.data.items.forEach(event => {
                const start = event.start.dateTime || event.start.date;
                console.log(`  - ${start}: ${event.summary}`);
            });

        } catch (error) {
            console.error('❌ Matt calendar error:', error.message);
        }

        // Check Zach's calendar events
        console.log('\n📅 ZACH\'S UPCOMING EVENTS:\n');
        try {
            const zachTokenPath = path.join(__dirname, 'token-zach.json');
            const zachToken = await fs.readFile(zachTokenPath, 'utf8');
            const zachOAuth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            zachOAuth.setCredentials(JSON.parse(zachToken));
            const zachCalendar = google.calendar({ version: 'v3', auth: zachOAuth });

            // List all upcoming events on Zach's primary calendar
            const zachEvents = await zachCalendar.events.list({
                calendarId: 'zlarimer24@gmail.com',
                timeMin: new Date().toISOString(),
                maxResults: 20,
                singleEvents: true,
                orderBy: 'startTime'
            });

            console.log(`Found ${zachEvents.data.items.length} upcoming events on zlarimer24@gmail.com:\n`);
            zachEvents.data.items.forEach(event => {
                const start = event.start.dateTime || event.start.date;
                console.log(`  - ${start}: ${event.summary}`);
            });

        } catch (error) {
            console.error('❌ Zach calendar error:', error.message);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

verifyEvent();
