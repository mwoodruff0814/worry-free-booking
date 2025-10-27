/**
 * RingCentral SMS Test Script
 * Run this to verify SMS configuration and generate new JWT token if needed
 */

require('dotenv').config();
const https = require('https');

// Test current JWT token
async function testCurrentToken() {
    console.log('\n🔍 Testing current RingCentral JWT token...\n');

    try {
        const authString = Buffer.from(
            `${process.env.RINGCENTRAL_CLIENT_ID}:${process.env.RINGCENTRAL_CLIENT_SECRET}`
        ).toString('base64');

        const postData = new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: process.env.RINGCENTRAL_JWT
        }).toString();

        const serverUrl = (process.env.RINGCENTRAL_SERVER || 'platform.ringcentral.com').replace(/^https?:\/\//, '');

        const options = {
            hostname: serverUrl,
            path: '/restapi/oauth/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${authString}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    console.log(`Status: ${res.statusCode}`);
                    console.log(`Response: ${data}\n`);

                    if (res.statusCode === 200) {
                        const response = JSON.parse(data);
                        console.log('✅ SUCCESS! JWT token is valid');
                        console.log(`Access token: ${response.access_token.substring(0, 20)}...`);
                        console.log(`Expires in: ${response.expires_in} seconds (${Math.floor(response.expires_in / 3600)} hours)\n`);
                        resolve(response);
                    } else {
                        console.log('❌ FAILED! JWT token is invalid or expired');
                        const errorData = JSON.parse(data);
                        console.log(`Error: ${errorData.error_description || errorData.error || 'Unknown error'}\n`);
                        console.log('📋 Next steps:');
                        console.log('1. Go to https://developers.ringcentral.com/');
                        console.log('2. Log in with your RingCentral account');
                        console.log('3. Go to "My Apps" and select your app');
                        console.log('4. Click on "Credentials" tab');
                        console.log('5. Scroll to "JWT Credentials" section');
                        console.log('6. Click "Issue/Reissue JWT" button');
                        console.log('7. Copy the new JWT token');
                        console.log('8. Replace RINGCENTRAL_JWT in your .env file\n');
                        reject(new Error(`Auth failed: ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ Request error:', error);
                reject(error);
            });

            req.write(postData);
            req.end();
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// Test SMS sending
async function testSMS(accessToken) {
    console.log('\n📱 Testing SMS send...\n');

    try {
        const testPhone = process.env.RINGCENTRAL_FROM_NUMBER; // Send to yourself for testing
        const testMessage = 'TEST: Worry Free Moving SMS is working! This is a test message.';

        const smsData = JSON.stringify({
            from: { phoneNumber: process.env.RINGCENTRAL_FROM_NUMBER },
            to: [{ phoneNumber: testPhone }],
            text: testMessage
        });

        const serverUrl = (process.env.RINGCENTRAL_SERVER || 'platform.ringcentral.com').replace(/^https?:\/\//, '');

        const options = {
            hostname: serverUrl,
            path: '/restapi/v1.0/account/~/extension/~/sms',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Content-Length': Buffer.byteLength(smsData)
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    console.log(`Status: ${res.statusCode}`);
                    console.log(`Response: ${data}\n`);

                    if (res.statusCode === 200 || res.statusCode === 201) {
                        console.log(`✅ SUCCESS! Test SMS sent to ${testPhone}`);
                        console.log('Check your phone for the test message.\n');
                        resolve(JSON.parse(data));
                    } else {
                        console.log('❌ FAILED! Could not send SMS');
                        const errorData = JSON.parse(data);
                        console.log(`Error: ${errorData.message || errorData.error || 'Unknown error'}\n`);
                        reject(new Error(`SMS failed: ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ Request error:', error);
                reject(error);
            });

            req.write(smsData);
            req.end();
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// Main test function
async function runTests() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  RingCentral SMS Configuration Test');
    console.log('═══════════════════════════════════════════════════');

    console.log('\n📋 Current Configuration:');
    console.log(`Client ID: ${process.env.RINGCENTRAL_CLIENT_ID}`);
    console.log(`From Number: ${process.env.RINGCENTRAL_FROM_NUMBER}`);
    console.log(`Server: ${process.env.RINGCENTRAL_SERVER}`);
    console.log(`JWT Token: ${process.env.RINGCENTRAL_JWT ? process.env.RINGCENTRAL_JWT.substring(0, 50) + '...' : 'NOT SET'}`);

    try {
        // Test JWT token authentication
        const authResult = await testCurrentToken();

        // If auth successful, test sending SMS
        await testSMS(authResult.access_token);

        console.log('═══════════════════════════════════════════════════');
        console.log('  ✅ ALL TESTS PASSED!');
        console.log('  SMS is configured correctly and working.');
        console.log('═══════════════════════════════════════════════════\n');

    } catch (error) {
        console.log('═══════════════════════════════════════════════════');
        console.log('  ❌ TESTS FAILED');
        console.log('  Please follow the instructions above to fix.');
        console.log('═══════════════════════════════════════════════════\n');
        process.exit(1);
    }
}

// Run tests
runTests();
