const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

/**
 * Setup script for Zach's Google Calendar OAuth2 authentication
 * This will create a token-zach.json file with Zach's calendar credentials
 */

async function setupZachCalendar() {
    try {
        console.log('🔐 Setting up Google Calendar for Zach (zlarimer24@gmail.com)...\n');

        // Read the credentials file
        const credentialsPath = path.join(__dirname, 'credentials.json');
        const credentialsContent = await fs.readFile(credentialsPath, 'utf8');
        const credentials = JSON.parse(credentialsContent);

        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        // Generate the auth URL
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar'],
        });

        console.log('📋 INSTRUCTIONS:');
        console.log('1. Open this URL in your browser:');
        console.log('\n' + authUrl + '\n');
        console.log('2. Log in with: zlarimer24@gmail.com');
        console.log('3. Grant calendar permissions');
        console.log('4. Copy the authorization code from the URL');
        console.log('5. Paste it below\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question('Enter the authorization code: ', async (code) => {
            rl.close();

            try {
                // Exchange code for token
                const { tokens } = await oAuth2Client.getToken(code);

                // Save token for Zach
                const tokenPath = path.join(__dirname, 'token-zach.json');
                await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2));

                console.log('\n✅ Success! Zach\'s calendar has been authenticated.');
                console.log('📁 Token saved to: token-zach.json');
                console.log('\n🎉 You can now sync appointments to both calendars!');

            } catch (error) {
                console.error('❌ Error exchanging code for token:', error.message);
            }
        });

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        if (error.code === 'ENOENT') {
            console.error('\n💡 Make sure credentials.json exists in the project root.');
        }
    }
}

// Run the setup
setupZachCalendar();
