const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Your authorization code
const AUTH_CODE = '4/0Ab32j93FgxVAw7QSyB-70w51lLKePybh0kNkj2AUQS-JTJGTww5A9hKbWCqO05otRKYR1Q';

async function completeAuth() {
    try {
        console.log('\n🔄 Processing Google Calendar authorization...\n');

        // Read credentials
        const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
        const credentials = JSON.parse(credentialsContent);

        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0]
        );

        console.log('📥 Exchanging authorization code for tokens...');

        // Exchange code for tokens
        const { tokens } = await oAuth2Client.getToken(AUTH_CODE);
        oAuth2Client.setCredentials(tokens);

        // Save token to file
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));

        console.log('\n✅ Success! Google Calendar is now authorized!');
        console.log('📁 Token saved to:', TOKEN_PATH);
        console.log('\n🎉 Google Calendar integration is complete!');
        console.log('\nYou can now start the server with: npm start');
        console.log('Bookings will automatically sync to matt@worryfreemovers.com\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\nThis usually means:');
        console.error('1. The authorization code has expired (they only last a few minutes)');
        console.error('2. The code was already used');
        console.error('\nTo fix: Run "node setup-google-auth.js" again and get a fresh code.\n');
        process.exit(1);
    }
}

completeAuth();
