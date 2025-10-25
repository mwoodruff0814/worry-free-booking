const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

/**
 * Complete Zach's calendar authentication with the authorization code
 */

async function completeAuth() {
    try {
        const authCode = '4/0Ab32j922d-DkWvodim4XPR1jkcSe-8qP1pR8Bru5E3tDOCsc7Dy7kJUeANQMMt8fbwL27A';

        console.log('🔐 Completing Zach\'s calendar authentication...\n');

        // Read credentials
        const credentialsPath = path.join(__dirname, 'credentials.json');
        const credentialsContent = await fs.readFile(credentialsPath, 'utf8');
        const credentials = JSON.parse(credentialsContent);

        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        // Exchange code for token
        console.log('📥 Exchanging authorization code for access token...');
        const { tokens } = await oAuth2Client.getToken(authCode);

        // Save token for Zach
        const tokenPath = path.join(__dirname, 'token-zach.json');
        await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2));

        console.log('\n✅ Success! Zach\'s calendar has been authenticated.');
        console.log('📁 Token saved to: token-zach.json');
        console.log('\n🎉 Calendar sync is now ready for both Matt and Zach!');
        console.log('\nℹ️  Events will now be created on both calendars automatically.');

    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        if (error.message.includes('invalid_grant')) {
            console.error('\n💡 The authorization code may have expired or been used already.');
            console.error('   Please run setup-zach-calendar.js again to get a new code.');
        }
    }
}

completeAuth();
