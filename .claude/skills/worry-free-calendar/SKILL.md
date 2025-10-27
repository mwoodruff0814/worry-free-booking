---
name: worry-free-calendar
description: Check availability and create bookings with Google Calendar integration. Manages morning/afternoon slots and prevents double-booking. Use for scheduling moves.
---

# Worry Free Moving - Calendar & Scheduling

Calendar availability checking, booking creation, and schedule management with Google Calendar + MongoDB integration.

## Calendar Configuration

**Primary Calendar**: Matt's Google Calendar (Worry Free Moving)
**Time Zone**: America/New_York (EST/EDT)
**Business Hours**: 8:00 AM - 6:00 PM
**Booking Window**: Today + 90 days

## Time Slots

### Morning Slot
- Start: 8:00 AM
- End: 9:00 AM
- Calendar Time: 08:00 (24-hour)

### Afternoon Slot
- Start: 1:00 PM
- End: 2:00 PM
- Calendar Time: 13:00 (24-hour)

**Only 2 time slots per day** to prevent overbooking

## Availability Checking

```javascript
async function checkCalendarAvailability(date) {
    // date format: "2024-12-01" (YYYY-MM-DD)

    const events = await calendar.events.list({
        calendarId: 'primary',
        timeMin: `${date}T00:00:00Z`,
        timeMax: `${date}T23:59:59Z`,
        singleEvents: true
    });

    const morningBooked = events.data.items.some(event =>
        event.start.dateTime >= `${date}T08:00:00` &&
        event.start.dateTime < `${date}T09:00:00`
    );

    const afternoonBooked = events.data.items.some(event =>
        event.start.dateTime >= `${date}T13:00:00` &&
        event.start.dateTime < `${date}T14:00:00`
    );

    return {
        date: date,
        morning: !morningBooked,
        afternoon: !afternoonBooked,
        fullyBooked: morningBooked && afternoonBooked
    };
}
```

## Voice AI Calendar Flow

### Both Slots Available
```
AI: "Good news! We have availability that day.
     Would you prefer morning between 8 and 9 AM,
     or afternoon between 1 and 2 PM?"

Customer: [Presses 1 for morning, 2 for afternoon]
```

### Only One Slot Available
```
AI: "Great! We have one slot available that day -
     [morning/afternoon] between [time]. Does that work for you?"

Customer: [Presses 1 for yes, 9 to transfer]
```

### Fully Booked
```
AI: "I'm sorry, we're fully booked that day.
     Let me connect you with someone who can help
     you find an alternative date."

[Transfer to agent]
```

## Date Parsing with Claude

Natural language support:
- "tomorrow" → Next day
- "next friday" → Next occurrence of Friday
- "the 20th" → 20th of current/next month
- "december 15th" → Specific date
- "two weeks from now" → +14 days
- "christmas" → December 25th

```javascript
const result = await claude.extractData(speech, 'date', {
    context: `Today is ${new Date().toISOString().split('T')[0]}`
});
// Input: "next friday"
// Output: { date: "2024-12-08", dayOfWeek: "Friday" }
```

## Creating Bookings

### Google Calendar Event
```javascript
const event = {
    summary: `Move - ${customerName}`,
    description: `
Moving Service Booking
Customer: ${firstName} ${lastName}
Email: ${email}
Phone: ${phone}
Service: ${serviceType}
Route: ${pickupAddress} → ${dropoffAddress}
Distance: ${distance} miles
Estimated Total: $${estimatedTotal}
Booking ID: ${bookingId}
Source: Twilio Voice AI
    `.trim(),
    location: pickupAddress,
    start: {
        dateTime: `${date}T${timeSlot === 'morning' ? '08:00:00' : '13:00:00'}`,
        timeZone: 'America/New_York'
    },
    end: {
        dateTime: `${date}T${timeSlot === 'morning' ? '08:00:00' : '13:00:00'}`,
        timeZone: 'America/New_York'
    },
    colorId: '9', // Blue for moves
    reminders: {
        useDefault: false,
        overrides: [
            { method: 'email', minutes: 24 * 60 },  // 1 day before
            { method: 'popup', minutes: 60 }         // 1 hour before
        ]
    }
};
```

### MongoDB Booking Document
```javascript
const booking = {
    bookingId: `WF-${Date.now()}-${generateRandomString(6)}`,
    company: "Worry Free Moving",

    // Customer
    firstName: "John",
    lastName: "Smith",
    email: "john@gmail.com",
    phone: "+13305551234",

    // Scheduling
    date: "2024-12-01",
    time: "08:00",           // or "13:00"
    timeSlot: "morning",     // or "afternoon"

    // Service
    serviceType: "2-Person Crew Moving",
    numMovers: 2,
    pickupAddress: "123 Main Street, Canton, OH",
    dropoffAddress: "456 Oak Avenue, Akron, OH",

    // Pricing
    estimatedTotal: 625,
    estimatedHours: 4,
    distance: 25.3,
    hourlyRate: 211.25,

    // Status
    status: "confirmed",
    source: "twilio-voice-ai",

    // Call Info
    callSid: "CA...",
    recordingSid: "RE...",
    recordingUrl: "https://api.twilio.com/...",

    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),

    notes: `Booked via AI phone - Quote: $${estimatedTotal} - ${timeSlot} slot - Distance: ${distance} miles`
};
```

## Confirmation Email

```javascript
const emailSubject = `Moving Confirmed - ${date} at ${timeSlot === 'morning' ? '8:00 AM' : '1:00 PM'}`;

const emailBody = `
Hi ${firstName},

Your move is confirmed!

📅 Date: ${formatDate(date)}
🕐 Time: ${timeSlot === 'morning' ? '8:00 AM - 9:00 AM' : '1:00 PM - 2:00 PM'}
📍 From: ${pickupAddress}
📍 To: ${dropoffAddress}
👥 Crew: ${numMovers} movers ${serviceType.includes('Moving') ? 'with truck' : '(labor only)'}
💰 Estimated Total: $${Math.round(estimatedTotal)}

Your Booking ID: ${bookingId}

Next Steps:
1. You'll receive a text with a link to save your card on file
2. We'll call 1 day before to confirm timing
3. Our crew will arrive between the scheduled window

Questions? Call (330) 661-9985

Thanks for choosing Worry Free Moving!
`;
```

## SMS Payment Link

```javascript
const smsBody = `Hi ${firstName}! To secure your booking ${bookingId}, please save your card on file (no charge yet): ${BASE_URL}/checkout.html?amount=${estimatedTotal}&booking=${bookingId}&email=${email}&name=${encodeURIComponent(firstName + ' ' + lastName)}

Worry Free Moving
(330) 661-9985`;

await twilioClient.messages.create({
    body: smsBody,
    from: TWILIO_PHONE_NUMBER,
    to: phone
});
```

## Complete Booking Workflow

```javascript
async function createCompleteBooking(bookingData) {
    try {
        // 1. Generate Booking ID
        const bookingId = generateBookingId();

        // 2. Check Availability
        const availability = await checkCalendarAvailability(bookingData.date);

        if (availability.fullyBooked) {
            return { success: false, reason: 'date_unavailable' };
        }

        // 3. Create Google Calendar Event
        const calendarEvent = await createGoogleCalendarEvent({
            ...bookingData,
            bookingId
        });

        // 4. Create MongoDB Document
        const booking = await createMongoDBBooking({
            ...bookingData,
            bookingId,
            calendarEventId: calendarEvent.id
        });

        // 5. Send Confirmation Email
        await sendConfirmationEmail(bookingData);

        // 6. Send Payment Link SMS
        await sendPaymentLinkSMS(bookingData);

        // 7. Log Success
        console.log(`✅ Booking created: ${bookingId}`);

        return {
            success: true,
            bookingId: bookingId,
            calendarEventId: calendarEvent.id
        };

    } catch (error) {
        console.error('Booking creation failed:', error);
        return { success: false, error: error.message };
    }
}
```

## Date Validation

```javascript
function validateMoveDate(dateString) {
    const moveDate = new Date(dateString);
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 90);

    // Must be in future
    if (moveDate < today) {
        return { valid: false, reason: 'date_in_past' };
    }

    // Must be within 90 days
    if (moveDate > maxDate) {
        return { valid: false, reason: 'date_too_far' };
    }

    const isWeekend = moveDate.getDay() === 0 || moveDate.getDay() === 6;

    return {
        valid: true,
        isWeekend: isWeekend,
        daysFromNow: Math.ceil((moveDate - today) / (1000 * 60 * 60 * 24))
    };
}
```

## Rescheduling

```javascript
async function rescheduleBooking(bookingId, newDate, newTimeSlot) {
    // 1. Check availability
    const availability = await checkCalendarAvailability(newDate);

    if (!availability[newTimeSlot]) {
        return { success: false, reason: 'slot_unavailable' };
    }

    // 2. Get existing booking
    const booking = await db.collection('appointments').findOne({ bookingId });

    // 3. Update Google Calendar
    await calendar.events.patch({
        calendarId: 'primary',
        eventId: booking.calendarEventId,
        resource: {
            start: {
                dateTime: `${newDate}T${newTimeSlot === 'morning' ? '08:00:00' : '13:00:00'}`,
                timeZone: 'America/New_York'
            }
        }
    });

    // 4. Update MongoDB
    await db.collection('appointments').updateOne(
        { bookingId },
        { $set: { date: newDate, time: newTimeSlot, updatedAt: new Date() } }
    );

    return { success: true };
}
```

## Error Handling

```javascript
try {
    const event = await createGoogleCalendarEvent(data);
} catch (error) {
    if (error.code === 401) {
        console.error('Calendar authentication failed');
    } else if (error.code === 409) {
        console.error('Calendar conflict - slot may be booked');
    }

    // Fallback: Still create MongoDB booking
    await createMongoDBBooking({ ...data, calendarSynced: false });
}
```

## Environment Variables

```
GOOGLE_CALENDAR_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_CALENDAR_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
MONGODB_URI=mongodb+srv://...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+13306619985
BASE_URL=https://worry-free-booking.onrender.com
```

## Testing

```javascript
// Check availability
const availability = await checkCalendarAvailability('2024-12-15');
console.log('Availability:', availability);

// Create test booking
const testBooking = await createCompleteBooking({
    date: '2024-12-15',
    timeSlot: 'morning',
    // ... other booking data
});
console.log('Booking result:', testBooking);
```

## Implementation

**Files**: `services/twilioSmartVoice.js`, `services/calendar.js`
**Version**: 1.0
