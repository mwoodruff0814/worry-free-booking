/**
 * Test Time Off SMS Notification
 * Simulates sending SMS for time off approval/denial
 */

require('dotenv').config();
const { sendSMSConfirmation } = require('./services/smsService');

async function testTimeOffSMS() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  Testing Time Off Request SMS Notification');
    console.log('═══════════════════════════════════════════════════\n');

    // Test data for approval
    const approvalDetails = {
        phone: '3302617687', // Zach's phone number
        customerName: 'Zach Larimer',
        date: '2025-11-01',
        time: '', // No time for time off requests
        type: 'timeoff-response',
        serviceType: 'Time Off Request ✅ APPROVED',
        pickupAddress: 'Your vacation request from Nov 1-2, 2025 (2 days) has been approved. Enjoy your time off!',
        companyName: 'Worry Free Moving'
    };

    console.log('📱 Test 1: Sending APPROVAL SMS...');
    console.log(`To: ${approvalDetails.phone}`);
    console.log(`Message type: ${approvalDetails.type}`);
    console.log(`Status: APPROVED\n`);

    try {
        await sendSMSConfirmation(approvalDetails);
        console.log('✅ APPROVAL SMS sent successfully!\n');
    } catch (error) {
        console.error('❌ APPROVAL SMS failed:', error.message, '\n');
    }

    // Wait 2 seconds before sending denial test
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test data for denial
    const denialDetails = {
        phone: '3302617687', // Zach's phone number
        customerName: 'Zach Larimer',
        date: '2025-11-01',
        time: '', // No time for time off requests
        type: 'timeoff-response',
        serviceType: 'Time Off Request ❌ DENIED',
        pickupAddress: 'Your vacation request from Nov 1-2, 2025 (2 days) has been denied. We are too busy during this period. Please request alternative dates.',
        companyName: 'Worry Free Moving'
    };

    console.log('📱 Test 2: Sending DENIAL SMS...');
    console.log(`To: ${denialDetails.phone}`);
    console.log(`Message type: ${denialDetails.type}`);
    console.log(`Status: DENIED\n`);

    try {
        await sendSMSConfirmation(denialDetails);
        console.log('✅ DENIAL SMS sent successfully!\n');
    } catch (error) {
        console.error('❌ DENIAL SMS failed:', error.message, '\n');
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('  Test Complete!');
    console.log('  Check Zach\'s phone (330-261-7687) for messages.');
    console.log('═══════════════════════════════════════════════════\n');
}

// Run test
testTimeOffSMS().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
