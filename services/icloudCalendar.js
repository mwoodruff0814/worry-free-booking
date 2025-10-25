const dav = require('dav');
const ical = require('ical-generator');
const { v4: uuidv4 } = require('uuid');

/**
 * Create an iCloud Calendar event using CalDAV
 *
 * Setup instructions:
 * 1. Generate app-specific password for iCloud:
 *    - Go to appleid.apple.com
 *    - Sign in
 *    - Security > App-Specific Passwords > Generate Password
 * 2. Add to .env file:
 *    ICLOUD_USERNAME=your@email.com
 *    ICLOUD_PASSWORD=xxxx-xxxx-xxxx-xxxx (app-specific password)
 */
async function createICloudCalendarEvent(eventDetails) {
    try {
        const username = process.env.ICLOUD_USERNAME;
        const password = process.env.ICLOUD_PASSWORD;

        if (!username || !password) {
            console.warn('iCloud credentials not configured. Skipping iCloud Calendar event.');
            console.warn('Set ICLOUD_USERNAME and ICLOUD_PASSWORD in .env file');
            return null;
        }

        const { summary, description, location, start, end } = eventDetails;

        // Create CalDAV client
        const xhr = new dav.transport.Basic(
            new dav.Credentials({
                username,
                password
            })
        );

        // iCloud CalDAV server
        const serverUrl = 'https://caldav.icloud.com';

        // Create account and find calendars
        const account = await dav.createAccount({
            server: serverUrl,
            xhr,
            accountType: 'caldav'
        });

        if (!account.calendars || account.calendars.length === 0) {
            console.warn('No iCloud calendars found');
            return null;
        }

        // Use the first available calendar (or specify a particular one)
        const calendar = account.calendars[0];

        // Generate iCalendar event
        const cal = ical({
            prodId: '//Worry Free Moving//Booking System//EN',
            events: [
                {
                    uid: uuidv4(),
                    start: new Date(start),
                    end: new Date(end),
                    summary,
                    description,
                    location,
                    timezone: 'America/New_York'
                }
            ]
        });

        // Create CalDAV object
        const calendarObject = new dav.CalendarObject({
            data: cal.toString(),
            filename: `${uuidv4()}.ics`,
            calendar
        });

        // Sync to iCloud
        await dav.createCalendarObject(calendar, calendarObject, { xhr });

        console.log('iCloud Calendar event created successfully');
        return calendarObject;

    } catch (error) {
        console.error('Error creating iCloud Calendar event:', error);
        // Don't throw error - calendar sync is optional
        return null;
    }
}

/**
 * Alternative method: Generate .ics file for manual import
 * This can be emailed to the user as an attachment
 */
function generateICSFile(eventDetails) {
    const { summary, description, location, start, end } = eventDetails;

    const cal = ical({
        prodId: '//Worry Free Moving//Booking System//EN',
        events: [
            {
                uid: uuidv4(),
                start: new Date(start),
                end: new Date(end),
                summary,
                description,
                location,
                timezone: 'America/New_York',
                organizer: {
                    name: 'Worry Free Moving',
                    email: process.env.COMPANY_EMAIL || 'service@worryfreemovers.com'
                }
            }
        ]
    });

    return cal.toString();
}

module.exports = {
    createICloudCalendarEvent,
    generateICSFile
};
