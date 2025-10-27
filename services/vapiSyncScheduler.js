/**
 * Vapi Call Data Sync Scheduler
 * Automatically syncs call recordings, transcripts, and data to OneDrive
 */

const cron = require('node-cron');
const { syncToOneDrive, generateCallSummary } = require('./vapiService');
const { sendEmail } = require('./emailService');

/**
 * Initialize automatic OneDrive sync scheduler
 * Runs every 6 hours to backup call data
 */
function initVapiSyncScheduler() {
    // Sync every 6 hours (at 00:00, 06:00, 12:00, 18:00)
    cron.schedule('0 */6 * * *', async () => {
        console.log('🔄 Starting scheduled Vapi call data sync to OneDrive...');

        try {
            const result = await syncToOneDrive();

            if (result.success) {
                console.log(`✅ Scheduled sync completed: ${result.syncCount} files backed up to OneDrive`);
            } else {
                console.error(`❌ Scheduled sync failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Error during scheduled Vapi sync:', error);
        }
    }, {
        timezone: 'America/New_York'
    });

    // Generate daily summary report at 11:59 PM
    cron.schedule('59 23 * * *', async () => {
        console.log('📊 Generating daily call summary report...');

        try {
            const today = new Date().toISOString().split('T')[0];
            const summaryResult = await generateCallSummary(today);

            if (summaryResult.success) {
                const { summary } = summaryResult;

                console.log(`\n${'='.repeat(60)}`);
                console.log(`📞 DAILY CALL SUMMARY - ${summary.date}`);
                console.log(`${'='.repeat(60)}`);
                console.log(`Total Calls: ${summary.totalCalls}`);
                console.log(`Quotes Generated: ${summary.quotesGenerated}`);
                console.log(`Bookings Made: ${summary.bookingsMade}`);
                console.log(`Transfers to Human: ${summary.transfersToHuman}`);
                console.log(`Average Call Duration: ${Math.round(summary.averageDuration)}s`);
                console.log(`${'='.repeat(60)}\n`);

                // Send email report to admin
                if (summary.totalCalls > 0) {
                    try {
                        await sendDailySummaryEmail(summary);
                        console.log('✅ Daily summary email sent to admin');
                    } catch (error) {
                        console.error('Failed to send daily summary email:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error generating daily summary:', error);
        }
    }, {
        timezone: 'America/New_York'
    });

    console.log('✅ Vapi sync scheduler initialized');
    console.log('   - OneDrive backup: Every 6 hours');
    console.log('   - Daily summary: 11:59 PM EST');
}

/**
 * Send daily call summary email to admin
 */
async function sendDailySummaryEmail(summary) {
    const htmlContent = `
        <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .stat-box { background: #f3f4f6; border-left: 4px solid #2563eb; padding: 15px; margin: 10px 0; }
                    .stat-label { font-weight: bold; color: #1f2937; }
                    .stat-value { font-size: 24px; color: #2563eb; }
                    .footer { background: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📞 Daily AI Phone Receptionist Report</h1>
                    <p>${summary.date}</p>
                </div>
                <div class="content">
                    <h2>Call Summary</h2>

                    <div class="stat-box">
                        <div class="stat-label">Total Calls</div>
                        <div class="stat-value">${summary.totalCalls}</div>
                    </div>

                    <div class="stat-box">
                        <div class="stat-label">Quotes Generated</div>
                        <div class="stat-value">${summary.quotesGenerated}</div>
                    </div>

                    <div class="stat-box">
                        <div class="stat-label">Bookings Made</div>
                        <div class="stat-value">${summary.bookingsMade}</div>
                    </div>

                    <div class="stat-box">
                        <div class="stat-label">Transfers to Human</div>
                        <div class="stat-value">${summary.transfersToHuman}</div>
                    </div>

                    <div class="stat-box">
                        <div class="stat-label">Average Call Duration</div>
                        <div class="stat-value">${Math.round(summary.averageDuration)} seconds</div>
                    </div>

                    <h3>Performance Metrics</h3>
                    <ul>
                        <li><strong>Conversion Rate:</strong> ${summary.totalCalls > 0 ? Math.round((summary.bookingsMade / summary.totalCalls) * 100) : 0}% (bookings/calls)</li>
                        <li><strong>Self-Service Rate:</strong> ${summary.totalCalls > 0 ? Math.round(((summary.totalCalls - summary.transfersToHuman) / summary.totalCalls) * 100) : 0}% (calls handled without transfer)</li>
                        <li><strong>Quote Success:</strong> ${summary.totalCalls > 0 ? Math.round((summary.quotesGenerated / summary.totalCalls) * 100) : 0}% (quotes/calls)</li>
                    </ul>

                    <p><a href="${process.env.BASE_URL || 'http://localhost:3001'}/api/vapi/summary/${summary.date}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Full Report</a></p>
                </div>
                <div class="footer">
                    <p>Worry Free Moving - AI Phone Receptionist System</p>
                    <p>This is an automated daily report. Call data is automatically backed up to OneDrive every 6 hours.</p>
                </div>
            </body>
        </html>
    `;

    const textContent = `
DAILY AI PHONE RECEPTIONIST REPORT
${summary.date}
${'='.repeat(50)}

CALL SUMMARY
- Total Calls: ${summary.totalCalls}
- Quotes Generated: ${summary.quotesGenerated}
- Bookings Made: ${summary.bookingsMade}
- Transfers to Human: ${summary.transfersToHuman}
- Average Call Duration: ${Math.round(summary.averageDuration)} seconds

PERFORMANCE METRICS
- Conversion Rate: ${summary.totalCalls > 0 ? Math.round((summary.bookingsMade / summary.totalCalls) * 100) : 0}%
- Self-Service Rate: ${summary.totalCalls > 0 ? Math.round(((summary.totalCalls - summary.transfersToHuman) / summary.totalCalls) * 100) : 0}%
- Quote Success: ${summary.totalCalls > 0 ? Math.round((summary.quotesGenerated / summary.totalCalls) * 100) : 0}%

View full report: ${process.env.BASE_URL || 'http://localhost:3001'}/api/vapi/summary/${summary.date}

---
Worry Free Moving - AI Phone Receptionist System
    `;

    // Send to admin email (configure in .env)
    const adminEmail = process.env.ADMIN_EMAIL || 'zlarimer24@gmail.com';

    await sendEmail({
        to: adminEmail,
        subject: `📞 Daily AI Call Report - ${summary.date} (${summary.totalCalls} calls, ${summary.bookingsMade} bookings)`,
        html: htmlContent,
        text: textContent
    });
}

module.exports = {
    initVapiSyncScheduler,
    sendDailySummaryEmail
};
