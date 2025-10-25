/**
 * Manual test script for 24-hour reminder system
 */

const { send24HourReminders } = require('./services/reminderScheduler');

console.log('🧪 Testing 24-hour reminder system...\n');

send24HourReminders()
    .then(() => {
        console.log('\n✅ Test complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
