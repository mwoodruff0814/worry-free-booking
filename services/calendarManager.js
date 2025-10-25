/**
 * Multi-Calendar Manager
 * Manages separate calendars for:
 * - Worry Free Moving
 * - Quality Moving
 * - Internal (day offs, meetings, etc.)
 */

const fs = require('fs').promises;
const path = require('path');
const { formatTimeWindow } = require('../utils/helpers');

// Calendar types
const CALENDAR_TYPES = {
    WORRY_FREE: 'worry-free-moving',
    QUALITY: 'quality-moving',
    INTERNAL: 'internal'
};

const CALENDARS_DIR = path.join(__dirname, '..', 'data', 'calendars');

/**
 * Ensure calendar directories exist
 */
async function ensureCalendarDirectories() {
    try {
        await fs.mkdir(CALENDARS_DIR, { recursive: true });

        for (const calendar of Object.values(CALENDAR_TYPES)) {
            const calendarFile = path.join(CALENDARS_DIR, `${calendar}.json`);
            try {
                await fs.access(calendarFile);
            } catch {
                await fs.writeFile(calendarFile, JSON.stringify([], null, 2));
            }
        }
    } catch (error) {
        console.error('Error creating calendar directories:', error);
    }
}

/**
 * Get calendar data
 */
async function getCalendar(calendarType) {
    try {
        const calendarFile = path.join(CALENDARS_DIR, `${calendarType}.json`);
        const data = await fs.readFile(calendarFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading calendar ${calendarType}:`, error);
        return [];
    }
}

/**
 * Save calendar data
 */
async function saveCalendar(calendarType, events) {
    try {
        const calendarFile = path.join(CALENDARS_DIR, `${calendarType}.json`);
        await fs.writeFile(calendarFile, JSON.stringify(events, null, 2));
        return true;
    } catch (error) {
        console.error(`Error saving calendar ${calendarType}:`, error);
        return false;
    }
}

/**
 * Determine which calendar to use based on service type
 */
function determineCalendar(serviceType, isInternal = false) {
    if (isInternal) {
        return CALENDAR_TYPES.INTERNAL;
    }

    // Check if it's a labor-only service
    const isLaborOnly = serviceType && serviceType.toLowerCase().includes('labor');

    if (isLaborOnly && process.env.USE_QUALITY_MOVING === 'true') {
        return CALENDAR_TYPES.QUALITY;
    }

    return CALENDAR_TYPES.WORRY_FREE;
}

/**
 * Add event to calendar
 */
async function addCalendarEvent(calendarType, event) {
    try {
        const calendar = await getCalendar(calendarType);
        calendar.push({
            ...event,
            addedAt: new Date().toISOString()
        });
        await saveCalendar(calendarType, calendar);
        return true;
    } catch (error) {
        console.error('Error adding calendar event:', error);
        return false;
    }
}

/**
 * Check availability across ALL calendars for a specific date/time
 * Prevents double-booking across different companies
 */
async function checkAvailability(date, time) {
    try {
        const allCalendars = [
            CALENDAR_TYPES.WORRY_FREE,
            CALENDAR_TYPES.QUALITY,
            CALENDAR_TYPES.INTERNAL
        ];

        for (const calendarType of allCalendars) {
            const calendar = await getCalendar(calendarType);

            // Check if time slot is taken
            const isBooked = calendar.some(event =>
                event.date === date &&
                event.time === time &&
                event.status !== 'cancelled'
            );

            if (isBooked) {
                return {
                    available: false,
                    reason: `Time slot already booked in ${calendarType} calendar`,
                    calendar: calendarType
                };
            }
        }

        return {
            available: true,
            reason: 'Time slot available across all calendars'
        };

    } catch (error) {
        console.error('Error checking availability:', error);
        return {
            available: false,
            reason: 'Error checking availability'
        };
    }
}

/**
 * Get all events for a specific date across all calendars
 */
async function getEventsForDate(date) {
    try {
        const events = {
            worryFree: [],
            quality: [],
            internal: [],
            all: []
        };

        const worryFreeEvents = await getCalendar(CALENDAR_TYPES.WORRY_FREE);
        const qualityEvents = await getCalendar(CALENDAR_TYPES.QUALITY);
        const internalEvents = await getCalendar(CALENDAR_TYPES.INTERNAL);

        events.worryFree = worryFreeEvents.filter(e => e.date === date);
        events.quality = qualityEvents.filter(e => e.date === date);
        events.internal = internalEvents.filter(e => e.date === date);

        events.all = [
            ...events.worryFree.map(e => ({ ...e, calendar: 'Worry Free Moving' })),
            ...events.quality.map(e => ({ ...e, calendar: 'Quality Moving' })),
            ...events.internal.map(e => ({ ...e, calendar: 'Internal' }))
        ].sort((a, b) => a.time.localeCompare(b.time));

        return events;

    } catch (error) {
        console.error('Error getting events for date:', error);
        return { worryFree: [], quality: [], internal: [], all: [] };
    }
}

/**
 * Add internal event (day off, meeting, etc.)
 */
async function addInternalEvent(details) {
    const {
        title,
        type, // 'day-off', 'meeting', 'call-off', 'other'
        date,
        time,
        duration,
        notes,
        affectedCrew
    } = details;

    const event = {
        id: `internal-${Date.now()}`,
        type: type || 'other',
        title,
        date,
        time,
        duration: duration || 60, // default 1 hour
        notes: notes || '',
        affectedCrew: affectedCrew || [],
        status: 'active',
        createdAt: new Date().toISOString()
    };

    return await addCalendarEvent(CALENDAR_TYPES.INTERNAL, event);
}

/**
 * Update event status (cancel, reschedule, etc.)
 */
async function updateEventStatus(calendarType, eventId, newStatus) {
    try {
        const calendar = await getCalendar(calendarType);
        const event = calendar.find(e => e.bookingId === eventId || e.id === eventId);

        if (event) {
            event.status = newStatus;
            event.updatedAt = new Date().toISOString();
            await saveCalendar(calendarType, calendar);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error updating event status:', error);
        return false;
    }
}

/**
 * Get available time slots for a specific date
 * Checks across ALL calendars to prevent double-booking
 */
async function getAvailableSlots(date) {
    try {
        // Business hours: 8 AM to 6 PM (1-hour arrival windows)
        const allSlots = [
            { time: '08:00', label: formatTimeWindow('08:00') },
            { time: '09:00', label: formatTimeWindow('09:00') },
            { time: '10:00', label: formatTimeWindow('10:00') },
            { time: '11:00', label: formatTimeWindow('11:00') },
            { time: '12:00', label: formatTimeWindow('12:00') },
            { time: '13:00', label: formatTimeWindow('13:00') },
            { time: '14:00', label: formatTimeWindow('14:00') },
            { time: '15:00', label: formatTimeWindow('15:00') },
            { time: '16:00', label: formatTimeWindow('16:00') },
            { time: '17:00', label: formatTimeWindow('17:00') },
            { time: '18:00', label: formatTimeWindow('18:00') }
        ];

        const eventsForDate = await getEventsForDate(date);
        const bookedTimes = eventsForDate.all
            .filter(e => e.status !== 'cancelled')
            .map(e => e.time);

        // Mark slots as available or not
        const availableSlots = allSlots.map(slot => ({
            ...slot,
            available: !bookedTimes.includes(slot.time),
            bookedBy: bookedTimes.includes(slot.time)
                ? eventsForDate.all.find(e => e.time === slot.time)?.calendar
                : null
        }));

        return availableSlots;

    } catch (error) {
        console.error('Error getting available slots:', error);
        return [];
    }
}

module.exports = {
    CALENDAR_TYPES,
    ensureCalendarDirectories,
    getCalendar,
    saveCalendar,
    determineCalendar,
    addCalendarEvent,
    checkAvailability,
    getEventsForDate,
    addInternalEvent,
    updateEventStatus,
    getAvailableSlots
};
