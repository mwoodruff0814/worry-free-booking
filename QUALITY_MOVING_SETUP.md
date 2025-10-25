# Quality Moving Integration - Complete Setup Guide

## Overview

The system now supports **two separate companies** with completely independent data tracking while sharing the same availability calendar to prevent double-booking.

### Companies:
1. **Worry Free Moving** (Primary) - Full service moving
   - Phone: 330-435-8686
   - Email: service@worryfreemovers.com
   - Bookings: Direct via Sarah AI chatbot + Admin portal

2. **Quality Moving** (Labor Only) - MovingHelp marketplace
   - Phone: 330-720-3529
   - Email: qualitymovingsolution@gmail.com
   - Bookings: **ONLY via Admin portal** (pre-booked from MovingHelp.com)

---

## How It Works

### Data Storage
- **Worry Free:** `data/appointments.json`
- **Quality Moving:** `data/quality-appointments.json`
- **Completely separate** - no mixing of customer data

### Shared Availability
- Both companies check the **same calendar** for availability
- Prevents double-booking across both companies
- If Worry Free books 10am, Quality cannot book 10am (and vice versa)

### Booking ID Prefixes
- **Worry Free:** `WF-{timestamp}-{random}`
- **Quality Moving:** `QM-{timestamp}-{random}`

---

## Admin Portal Usage

### Accessing Admin Booking
1. Go to: http://localhost:3001/admin-booking.html
2. Select company at top: **Worry Free Moving** or **Quality Moving**
3. Fill in job details
4. Book normally - system routes to correct data file automatically

### Company Selection
The admin portal has two cards at the top:
```
┌────────────────┐  ┌────────────────┐
│  🚚 Worry Free │  │  💼 Quality    │
│     Moving     │  │     Moving     │
│  Full service  │  │  Labor-only    │
└────────────────┘  └────────────────┘
```

**Click to select** before entering booking details.

### Important Notes
- **Always select company first**
- Quality Moving bookings should come from MovingHelp orders
- All booking details carry forward (hours, crew, notes, etc.)
- Can disable confirmation emails if manually notifying customer

---

## Email & SMS Configuration

### Worry Free Moving
- **From Email:** service@worryfreemovers.com
- **Phone (SMS):** 330-435-8686
- **CC Emails:** matt@worryfreemovers.com, zlarimer24@gmail.com

### Quality Moving
- **From Email:** qualitymovingsolution@gmail.com
- **Phone (SMS):** 330-720-3529
- **CC Emails:** matt@worryfreemovers.com

### Configuration File
Location: `data/communication-settings.json`

```json
{
  "worryFreeMoving": {
    "companyName": "Worry Free Moving",
    "companyEmail": "service@worryfreemovers.com",
    "companyPhone": "330-435-8686",
    "ccEmails": ["matt@worryfreemovers.com", "zlarimer24@gmail.com"],
    "smsFromNumber": "+13304358686",
    "smsFromName": "Worry Free Moving"
  },
  "qualityMoving": {
    "companyName": "Quality Moving",
    "companyEmail": "qualitymovingsolution@gmail.com",
    "companyPhone": "330-720-3529",
    "ccEmails": ["matt@worryfreemovers.com"],
    "smsFromNumber": "+13307203529",
    "smsFromName": "Quality Moving"
  }
}
```

**Note:** Email/SMS services should read this file to use correct company info based on booking.

---

## Google Calendar Integration

All bookings (both companies) go to the **same Google Calendar**: matt@worryfreemovers.com

### Calendar Event Format
```
[WF] 2 Person Crew - John Smith    ← Worry Free booking
[QM] Labor Only - Jane Doe         ← Quality Moving booking
```

Events include:
- Company name
- Booking ID
- Customer details
- Service type
- Addresses
- Estimated hours/movers
- Priority level
- Crew assignment
- Notes

---

## API Changes

### POST /api/book-appointment

**NEW Parameters:**
```json
{
  "company": "Worry Free Moving" | "Quality Moving",
  "estimatedHours": 4,
  "numMovers": 3,
  "estimatedTotal": 450,
  "priority": "normal" | "high" | "urgent",
  "crewAssignment": "crew-a",
  "jobTag": "standard" | "vip" | "repeat" | "commercial" | "emergency",
  "paymentMethod": "pending" | "cash" | "check" | "credit-card" | "square-card-file" | "invoice",
  "paymentStatus": "pending" | "deposit" | "paid" | "partial",
  "sendConfirmation": true | false
}
```

**Behavior:**
- If `company` not provided, defaults to "Worry Free Moving"
- Saves to appropriate file based on company
- Generates company-specific booking ID
- Sends company-specific emails/SMS
- If `sendConfirmation` is false, skips all emails/SMS

### GET /api/appointments

**NEW Query Parameter:**
```
GET /api/appointments                    ← Returns BOTH companies
GET /api/appointments?company=Worry Free Moving    ← Only Worry Free
GET /api/appointments?company=Quality Moving       ← Only Quality
```

### GET /api/available-slots

**Updated Behavior:**
- Checks **BOTH** appointment files
- Blocks times if either company has booking
- Prevents double-booking

---

## Admin Portal Enhancements

### New Features
1. **Company Selector** - Choose company before booking
2. **All Job Details Saved** - Hours, movers, pricing, priority, crew assignment
3. **Disable Confirmation Toggle** - Option to skip email/SMS
4. **Enhanced Calendar Events** - Shows company, priority, crew assignment

### Available Time Windows
Shows 1-hour arrival windows (8am-9am, 9am-10am, etc.)

---

## Testing the System

### Test 1: Create Worry Free Booking
1. Open: http://localhost:3001/admin-booking.html
2. Click **Worry Free Moving** card
3. Fill in details
4. Select date and time
5. Click "Create Booking"
6. **Verify:**
   - Booking ID starts with `WF-`
   - Saved in `data/appointments.json`
   - Email from `service@worryfreemovers.com`
   - Calendar event shows `[WF]`

### Test 2: Create Quality Moving Booking
1. Reload admin booking page
2. Click **Quality Moving** card
3. Fill in details (simulating MovingHelp order)
4. Select date and time
5. Click "Create Booking"
6. **Verify:**
   - Booking ID starts with `QM-`
   - Saved in `data/quality-appointments.json`
   - Email from `qualitymovingsolution@gmail.com`
   - Calendar event shows `[QM]`

### Test 3: Verify Shared Availability
1. Book Worry Free at 10am on Oct 25
2. Try to book Quality at 10am on Oct 25
3. **Should show:** Time slot unavailable
4. **Verify:** Calendar shows only Worry Free booking (Quality blocked)

---

## Important Reminders

### Quality Moving Customers
- **99% pre-booked** from MovingHelp.com marketplace
- Customers **should not** have direct access to booking
- All bookings entered manually via admin portal
- Use hourly rate model: $115/hour
- 2 hour minimum
- No additional fees

### Data Separation
- Two companies = Two data files
- Never mix customer data
- Always select correct company in admin portal
- Booking IDs clearly identify company (WF- vs QM-)

### Availability Sharing
- Prevents double-booking
- Both companies see same blocked times
- If one company books a time, other cannot

---

## Troubleshooting

### Issue: Booking saved to wrong file
**Fix:** Ensure company card is clicked before entering details. Reload page and start over.

### Issue: Email from wrong company
**Fix:** Check `data/communication-settings.json` - ensure email service uses company field to load correct settings.

### Issue: Double-booking possible
**Fix:** Verify `getAllAppointments()` function is being used in availability checking - it should return appointments from BOTH files.

### Issue: Calendar event doesn't show company
**Fix:** Calendar event summary includes `[WF]` or `[QM]` prefix automatically. Check server logs for errors.

---

## Next Steps

1. ✅ **Test the admin booking portal** with both companies
2. ⏳ **Update email/SMS services** to read from communication-settings.json
3. ⏳ **Add company filter to admin portal** appointments view
4. ⏳ **Customize Quality Moving hourly rate** in services pricing ($115/hour)

---

## Server Status

Current setup:
- ✅ Server running: http://localhost:3001
- ✅ Admin booking: http://localhost:3001/admin-booking.html
- ✅ Separate data files created
- ✅ Shared calendar checking active
- ✅ Company-specific emails configured
- ✅ Booking ID prefixes implemented

---

## Contact

For questions about the system:
- Email: matt@worryfreemovers.com
- System documentation: This file
