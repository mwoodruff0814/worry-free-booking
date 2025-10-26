const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

let mattCalendar = null;
let zachCalendar = null;
let mattAuth = null;
let zachAuth = null;

/**
 * Initialize Google Calendar authentication for both Matt and Zach
 */
async function initGoogleAuth() {
    try {
        const credentialsPath = path.join(__dirname, '..', 'credentials.json');

        let credentials;
        try {
            const credentialsContent = await fs.readFile(credentialsPath, 'utf8');
            credentials = JSON.parse(credentialsContent);
        } catch (error) {
            console.warn('Google Calendar credentials.json not found. Skipping Google Calendar integration.');
            return null;
        }

        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

        // Initialize Matt's calendar
        try {
            const tokenPath = path.join(__dirname, '..', 'token.json');
            const token = await fs.readFile(tokenPath, 'utf8');
            const mattOAuth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            mattOAuth.setCredentials(JSON.parse(token));
            mattAuth = mattOAuth;
            mattCalendar = google.calendar({ version: 'v3', auth: mattOAuth });
            console.log('✅ Matt\'s calendar initialized');
        } catch (error) {
            console.warn('❌ Matt\'s calendar token not found');
        }

        // Initialize Zach's calendar
        try {
            const zachTokenPath = path.join(__dirname, '..', 'token-zach.json');
            const zachToken = await fs.readFile(zachTokenPath, 'utf8');
            const zachOAuth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            zachOAuth.setCredentials(JSON.parse(zachToken));
            zachAuth = zachOAuth;
            zachCalendar = google.calendar({ version: 'v3', auth: zachOAuth });
            console.log('✅ Zach\'s calendar initialized');
        } catch (error) {
            console.warn('❌ Zach\'s calendar token not found');
        }

        if (!mattCalendar && !zachCalendar) {
            console.warn('No calendars initialized');
            return null;
        }

        return { mattCalendar, zachCalendar };
    } catch (error) {
        console.error('Error initializing Google Calendar:', error);
        return null;
    }
}

/**
 * Create a Google Calendar event on both calendars
 * Returns { matt: eventId, zach: eventId }
 */
async function createGoogleCalendarEvent(eventDetails) {
    const { summary, description, location, start, end, attendees } = eventDetails;

    const event = {
        summary,
        description,
        location,
        start: {
            dateTime: start,
            timeZone: 'America/New_York',
        },
        end: {
            dateTime: end,
            timeZone: 'America/New_York',
        },
        attendees: attendees ? attendees.map(email => ({ email })) : [],
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 }, // 1 day before
                { method: 'popup', minutes: 60 }, // 1 hour before
            ],
        },
    };

    const result = { matt: null, zach: null };

    // Create on Matt's calendar
    if (mattCalendar) {
        try {
            const response = await mattCalendar.events.insert({
                calendarId: 'matt@worryfreemovers.com',
                resource: event,
                sendUpdates: 'none' // Don't send duplicate invites
            });
            result.matt = response.data.id;
            console.log('✅ Event created on Matt\'s calendar:', result.matt);
        } catch (error) {
            console.error('❌ Failed to create event on Matt\'s calendar:', error.message);
        }
    }

    // Create on Zach's calendar
    if (zachCalendar) {
        try {
            const response = await zachCalendar.events.insert({
                calendarId: 'zlarimer24@gmail.com',
                resource: event,
                sendUpdates: 'none' // Don't send duplicate invites
            });
            result.zach = response.data.id;
            console.log('✅ Event created on Zach\'s calendar:', result.zach);
        } catch (error) {
            console.error('❌ Failed to create event on Zach\'s calendar:', error.message);
        }
    }

    return result;
}

/**
 * Update a Google Calendar event on both calendars
 * eventIds should be { matt: eventId, zach: eventId }
 */
async function updateGoogleCalendarEvent(eventIds, updates) {
    // Handle attendees if provided
    if (updates.attendees) {
        updates.attendees = updates.attendees.map(email =>
            typeof email === 'string' ? { email } : email
        );
    }

    const result = { matt: null, zach: null };

    // Update Matt's calendar
    if (mattCalendar && eventIds.matt) {
        try {
            const response = await mattCalendar.events.patch({
                calendarId: 'matt@worryfreemovers.com',
                eventId: eventIds.matt,
                resource: updates,
                sendUpdates: 'none'
            });
            result.matt = response.data;
            console.log('✅ Event updated on Matt\'s calendar');
        } catch (error) {
            console.error('❌ Failed to update event on Matt\'s calendar:', error.message);
        }
    }

    // Update Zach's calendar
    if (zachCalendar && eventIds.zach) {
        try {
            const response = await zachCalendar.events.patch({
                calendarId: 'zlarimer24@gmail.com',
                eventId: eventIds.zach,
                resource: updates,
                sendUpdates: 'none'
            });
            result.zach = response.data;
            console.log('✅ Event updated on Zach\'s calendar');
        } catch (error) {
            console.error('❌ Failed to update event on Zach\'s calendar:', error.message);
        }
    }

    return result;
}

/**
 * Delete a Google Calendar event from both calendars
 * eventIds should be { matt: eventId, zach: eventId }
 */
async function deleteGoogleCalendarEvent(eventIds) {
    const result = { matt: false, zach: false };

    // Delete from Matt's calendar
    if (mattCalendar && eventIds.matt) {
        try {
            await mattCalendar.events.delete({
                calendarId: 'matt@worryfreemovers.com',
                eventId: eventIds.matt,
            });
            result.matt = true;
            console.log('✅ Event deleted from Matt\'s calendar');
        } catch (error) {
            console.error('❌ Failed to delete event from Matt\'s calendar:', error.message);
        }
    }

    // Delete from Zach's calendar
    if (zachCalendar && eventIds.zach) {
        try {
            await zachCalendar.events.delete({
                calendarId: 'zlarimer24@gmail.com',
                eventId: eventIds.zach,
            });
            result.zach = true;
            console.log('✅ Event deleted from Zach\'s calendar');
        } catch (error) {
            console.error('❌ Failed to delete event from Zach\'s calendar:', error.message);
        }
    }

    return result;
}

/**
 * Get all events from Matt's Google Calendar for a specific date
 * Used for availability checking
 */
async function getEventsForDate(date) {
    try {
        if (!mattCalendar) {
            console.warn('Matt\'s calendar not initialized');
            return [];
        }

        // Parse the date and create time range for the full day
        const startOfDay = new Date(date + 'T00:00:00');
        const endOfDay = new Date(date + 'T23:59:59');

        const response = await mattCalendar.events.list({
            calendarId: 'matt@worryfreemovers.com',
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items || [];

        // Transform to simpler format
        return events.map(event => ({
            id: event.id,
            summary: event.summary,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            status: event.status
        }));

    } catch (error) {
        console.error('❌ Failed to fetch events from Google Calendar:', error.message);
        return [];
    }
}

module.exports = {
    initGoogleAuth,
    createGoogleCalendarEvent,
    updateGoogleCalendarEvent,
    deleteGoogleCalendarEvent,
    getEventsForDate
};
