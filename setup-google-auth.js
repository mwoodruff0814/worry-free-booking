const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

/**
 * Setup Google Calendar authorization
 * Run this script once to authorize the app and generate token.json
 */
async function setupGoogleAuth() {
    try {
        // Read credentials
        const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
        const credentials = JSON.parse(credentialsContent);

        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0]
        );

        // Generate auth URL
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });

        console.log('\n===========================================');
        console.log('Google Calendar Authorization Setup');
        console.log('===========================================\n');
        console.log('Authorize this app by visiting this URL:');
        console.log('\n' + authUrl + '\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question('Enter the authorization code from the page: ', async (code) => {
            rl.close();

            try {
                const { tokens } = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);

                // Save token to file
                await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));

                console.log('\n✅ Success! Token saved to:', TOKEN_PATH);
                console.log('\nGoogle Calendar integration is now configured.');
                console.log('You can start the server with: npm start\n');

            } catch (error) {
                console.error('\n❌ Error retrieving access token:', error);
                process.exit(1);
            }
        });

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error('\n❌ Error: credentials.json not found!');
            console.error('\nPlease follow these steps:');
            console.error('1. Go to https://console.cloud.google.com');
            console.error('2. Create a project or select existing one');
            console.error('3. Enable Google Calendar API');
            console.error('4. Create OAuth 2.0 credentials (Desktop app)');
            console.error('5. Download credentials.json to this directory');
            console.error('\nThen run this script again.\n');
        } else {
            console.error('\n❌ Error:', error);
        }
        process.exit(1);
    }
}

// Run the setup
setupGoogleAuth();
