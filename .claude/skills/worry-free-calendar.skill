# Worry Free Moving - Calendar & Scheduling Skill

**Purpose**: Calendar availability checking, booking creation, and schedule management
**Integration**: Google Calendar API + MongoDB database

---

## Calendar Configuration

**Primary Calendar**: Matt's Google Calendar (Worry Free Moving)
**Time Zone**: America/New_York (EST/EDT)
**Business Hours**: 8:00 AM - 6:00 PM
**Booking Window**: Today + 90 days

---

## Time Slots

### Morning Slot
- **Start Time**: 8:00 AM
- **End Time**: 9:00 AM
- **Duration**: Flexible (job duration varies)
- **Calendar Time**: 08:00 (24-hour format)

### Afternoon Slot
- **Start Time**: 1:00 PM
- **End Time**: 2:00 PM
- **Duration**: Flexible (job duration varies)
- **Calendar Time**: 13:00 (24-hour format)

**Note**: Only 2 time slots per day to prevent overbooking

---

## Availability Checking

### Check Single Day:
```javascript
async function checkCalendarAvailability(date) {
    // date format: "2024-12-01" (YYYY-MM-DD)

    const morningStart = `${date}T08:00:00`;
    const morningEnd = `${date}T09:00:00`;
    const afternoonStart = `${date}T13:00:00`;
    const afternoonEnd = `${date}T14:00:00`;

    // Check Google Calendar for existing events
    const events = await calendar.events.list({
        calendarId: 'primary',
        timeMin: `${date}T00:00:00Z`,
        timeMax: `${date}T23:59:59Z`,
        singleEvents: true
    });

    // Check if slots are free
    const morningBooked = events.data.items.some(event =>
        event.start.dateTime >= morningStart && event.start.dateTime < morningEnd
    );

    const afternoonBooked = events.data.items.some(event =>
        event.start.dateTime >= afternoonStart && event.start.dateTime < afternoonEnd
    );

    return {
        date: date,
        morning: !morningBooked,
        afternoon: !afternoonBooked,
        fullyBooked: morningBooked && afternoonBooked
    };
}
```

**Response Format**:
```javascript
{
    date: "2024-12-01",
    morning: true,      // Available
    afternoon: false,   // Booked
    fullyBooked: false  // At least one slot free
}
```

---

## Voice AI Calendar Flow

### Scenario 1: Both Slots Available
```
AI: "Good news! We have availability that day. Would you prefer morning between 8 and 9 AM, or afternoon between 1 and 2 PM?"
Customer: [Presses 1 for morning, 2 for afternoon]
AI: [Books selected slot]
```

### Scenario 2: Only One Slot Available
```
AI: "Great! We have one slot available that day - [morning/afternoon] between [time]. Does that work for you?"
Customer: [Presses 1 for yes, 9 to transfer]
```

### Scenario 3: Fully Booked
```
AI: "I'm sorry, we're fully booked that day. Let me connect you with someone who can help you find an alternative date."
[Transfer to agent]
```

---

## Date Parsing with Claude

### Natural Language Support:
- "tomorrow" → Next day
- "next friday" → Next occurrence of Friday
- "the 20th" → 20th of current/next month
- "december 15th" → Specific date
- "two weeks from now" → +14 days
- "christmas" → December 25th

### Claude Extraction:
```javascript
const result = await claude.extractData(speech, 'date', {
    context: `Today is ${new Date().toISOString().split('T')[0]}`
});

// Input: "next friday"
// Output: { date: "2024-12-08", dayOfWeek: "Friday" }
```

---

## Creating Calendar Events

### Google Calendar Event Structure:
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
        dateTime: `${date}T${timeSlot === 'morning' ? '08:00:00' : '13:00:00'}`, // Same time (flexible duration)
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

const createdEvent = await calendar.events.insert({
    calendarId: 'primary',
    resource: event
});
```

**Returns**: Event ID, link to event

---

## MongoDB Booking Creation

### Booking Document Structure:
```javascript
const booking = {
    // Unique Identifier
    bookingId: `WF-${Date.now()}-${generateRandomString(6)}`,

    // Company Info
    company: "Worry Free Moving",

    // Customer Details
    firstName: "John",
    lastName: "Smith",
    email: "john@gmail.com",
    phone: "+13305551234",

    // Scheduling
    date: "2024-12-01",
    time: "08:00",           // or "13:00"
    timeSlot: "morning",     // or "afternoon"

    // Service Details
    serviceType: "2-Person Crew Moving",
    numMovers: 2,
    pickupAddress: "123 Main Street, Canton, OH",
    dropoffAddress: "456 Oak Avenue, Akron, OH",

    // Pricing
    estimatedTotal: 625,
    estimatedHours: 4,
    distance: 25.3,          // Exact miles
    hourlyRate: 211.25,

    // Status Tracking
    status: "confirmed",
    source: "twilio-voice-ai",

    // Call Information
    callSid: "CA...",
    recordingSid: "RE...",
    recordingUrl: "https://api.twilio.com/...",

    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),

    // Notes
    notes: `Booked via AI phone - Quote: $${estimatedTotal} - ${timeSlot} slot - Distance: ${distance} miles`
};

await db.collection('appointments').insertOne(booking);
```

---

## Confirmation Email

### Email Template:
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
1. You'll receive a text message with a link to save your card on file (no charge yet)
2. We'll call you 1 day before to confirm timing
3. Our crew will arrive between the scheduled window

Questions? Call us at (330) 661-9985

Thanks for choosing Worry Free Moving!

Worry Free Moving
Canton, Ohio
(330) 661-9985
`;

await sendEmail(email, emailSubject, emailBody);
```

---

## SMS Payment Link

### Payment Link SMS:
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

**Payment Link Parameters**:
- `amount`: Estimated total
- `booking`: Booking ID
- `email`: Customer email
- `name`: Full customer name

---

## Booking Workflow

### Complete Booking Flow:
```javascript
async function createCompleteBooking(bookingData) {
    try {
        // 1. Generate Booking ID
        const bookingId = generateBookingId();

        // 2. Check Calendar Availability
        const availability = await checkCalendarAvailability(bookingData.date);

        if (availability.fullyBooked) {
            return { success: false, reason: 'date_unavailable' };
        }

        if (bookingData.timeSlot === 'morning' && !availability.morning) {
            return { success: false, reason: 'morning_unavailable' };
        }

        if (bookingData.timeSlot === 'afternoon' && !availability.afternoon) {
            return { success: false, reason: 'afternoon_unavailable' };
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
            calendarEventId: calendarEvent.id,
            confirmationSent: true
        };

    } catch (error) {
        console.error('Booking creation failed:', error);
        return { success: false, error: error.message };
    }
}
```

---

## Rescheduling Logic

### Update Existing Booking:
```javascript
async function rescheduleBooking(bookingId, newDate, newTimeSlot) {
    // 1. Check new date availability
    const availability = await checkCalendarAvailability(newDate);

    if (!availability[newTimeSlot]) {
        return { success: false, reason: 'slot_unavailable' };
    }

    // 2. Get existing booking
    const booking = await db.collection('appointments').findOne({ bookingId });

    // 3. Update Google Calendar event
    await calendar.events.patch({
        calendarId: 'primary',
        eventId: booking.calendarEventId,
        resource: {
            start: {
                dateTime: `${newDate}T${newTimeSlot === 'morning' ? '08:00:00' : '13:00:00'}`,
                timeZone: 'America/New_York'
            },
            end: {
                dateTime: `${newDate}T${newTimeSlot === 'morning' ? '08:00:00' : '13:00:00'}`,
                timeZone: 'America/New_York'
            }
        }
    });

    // 4. Update MongoDB
    await db.collection('appointments').updateOne(
        { bookingId },
        {
            $set: {
                date: newDate,
                time: newTimeSlot === 'morning' ? '08:00' : '13:00',
                timeSlot: newTimeSlot,
                updatedAt: new Date()
            }
        }
    );

    // 5. Send updated confirmation
    await sendRescheduleConfirmation(booking, newDate, newTimeSlot);

    return { success: true };
}
```

---

## Cancellation Protocol

### Cancel Booking:
```javascript
async function cancelBooking(bookingId, reason) {
    const booking = await db.collection('appointments').findOne({ bookingId });

    // 1. Delete Google Calendar event
    await calendar.events.delete({
        calendarId: 'primary',
        eventId: booking.calendarEventId
    });

    // 2. Update status in MongoDB (don't delete - keep for records)
    await db.collection('appointments').updateOne(
        { bookingId },
        {
            $set: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: reason
            }
        }
    );

    // 3. Send cancellation email
    await sendCancellationEmail(booking);

    return { success: true };
}
```

---

## Voice AI Calendar Responses

### Generate with Claude:
```javascript
// Available slot confirmation
const response = await claude.generateResponse('confirmation', {
    action: 'date available',
    date: '2024-12-01',
    slots: ['morning', 'afternoon']
});
// "Good news! We have availability on December 1st. Would you prefer morning or afternoon?"

// Booking confirmed
const confirmation = await claude.generateResponse('confirmation', {
    action: 'booking created',
    date: '2024-12-01',
    timeSlot: 'morning',
    bookingId: 'WF-1730123456-ABC123'
});
// "Perfect! Your move is all set for December 1st in the morning between 8 and 9 AM. Your booking ID is WF-1730123456-ABC123."

// Fully booked
const apology = await claude.generateResponse('error', {
    issue: 'date fully booked',
    suggestion: 'transfer to agent for alternative'
});
// "I'm sorry, we're fully booked that day. Let me connect you with someone who can help you find an alternative date."
```

---

## Date Validation

### Rules:
```javascript
function validateMoveDate(dateString) {
    const moveDate = new Date(dateString);
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 90); // 90-day booking window

    // Must be in future
    if (moveDate < today) {
        return { valid: false, reason: 'date_in_past' };
    }

    // Must be within 90 days
    if (moveDate > maxDate) {
        return { valid: false, reason: 'date_too_far' };
    }

    // Check if weekend (optional premium pricing in future)
    const dayOfWeek = moveDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return {
        valid: true,
        isWeekend: isWeekend,
        daysFromNow: Math.ceil((moveDate - today) / (1000 * 60 * 60 * 24))
    };
}
```

---

## Error Handling

### Calendar API Errors:
```javascript
try {
    const event = await createGoogleCalendarEvent(data);
} catch (error) {
    if (error.code === 401) {
        console.error('Calendar authentication failed - check credentials');
    } else if (error.code === 403) {
        console.error('Calendar permission denied');
    } else if (error.code === 409) {
        console.error('Calendar conflict - slot may be booked');
    }

    // Fallback: Still create MongoDB booking, note calendar failed
    await createMongoDBBooking({ ...data, calendarSynced: false });
}
```

---

## Admin Portal Integration

### View Bookings:
```javascript
// Get all bookings for a date
const bookings = await db.collection('appointments')
    .find({ date: "2024-12-01", status: "confirmed" })
    .sort({ time: 1 })
    .toArray();

// Calendar view (week)
const weekBookings = await db.collection('appointments')
    .find({
        date: { $gte: weekStart, $lte: weekEnd },
        status: "confirmed"
    })
    .sort({ date: 1, time: 1 })
    .toArray();
```

---

## Testing Calendar Functions

### Test Script:
```javascript
// Test 1: Check availability
const availability = await checkCalendarAvailability('2024-12-15');
console.log('Availability:', availability);

// Test 2: Create test booking
const testBooking = await createCompleteBooking({
    firstName: 'Test',
    lastName: 'Customer',
    email: 'test@example.com',
    phone: '+13305551234',
    date: '2024-12-15',
    timeSlot: 'morning',
    serviceType: '2-Person Crew Moving',
    numMovers: 2,
    pickupAddress: '123 Test St, Canton, OH',
    dropoffAddress: '456 Test Ave, Akron, OH',
    estimatedTotal: 500,
    estimatedHours: 4,
    distance: 20
});
console.log('Booking result:', testBooking);

// Test 3: Check slot now booked
const newAvailability = await checkCalendarAvailability('2024-12-15');
console.log('Updated availability:', newAvailability);
// Should show morning: false
```

---

## Monitoring & Logging

**Log Every Calendar Operation**:
```javascript
console.log(`📅 Checking availability for ${date}`);
console.log(`✅ Booking created: ${bookingId} for ${date} ${timeSlot}`);
console.log(`📧 Confirmation sent to ${email}`);
console.log(`📱 Payment SMS sent to ${phone}`);
console.log(`❌ Calendar sync failed: ${error.message}`);
```

---

## Environment Variables

```
GOOGLE_CALENDAR_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_CALENDAR_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
GOOGLE_CALENDAR_ID=primary
MONGODB_URI=mongodb+srv://...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+13306619985
BASE_URL=https://worry-free-booking.onrender.com
```

---

## Version

**Calendar Skill Version**: 1.0
**Last Updated**: 2024-10-26
**Implementation**: `services/twilioSmartVoice.js`, `services/calendar.js`
