# Calendar Sync Setup Guide

## Overview

This guide makes it **super simple** to share your booking calendar with crew members and managers - no technical knowledge needed!

---

## ✅ What You Get

- **One master calendar** (matt@worryfreemovers.com) with all bookings
- **Automatic sync** to crew members and managers
- **No double-booking** - everyone sees the same schedule
- **Real-time updates** - changes appear instantly
- **Mobile access** - works on any device

---

## 📱 Quick Start (5 Minutes)

### Step 1: Go to Google Calendar
1. Open: https://calendar.google.com
2. Sign in with: **matt@worryfreemovers.com**

### Step 2: Share with Each Person
1. On the left side, find "My calendars"
2. Hover over your calendar name
3. Click the **three dots** (⋮)
4. Click "**Settings and sharing**"

### Step 3: Add People
Scroll to "**Share with specific people**" section:

1. Click "**+ Add people**"
2. Enter their email address
3. Choose permission level:
   - **See all event details** - for crew members (they can view but not edit)
   - **Make changes to events** - for managers (they can edit)
4. Click "**Send**"

### Repeat for Each Person:
```
Crew Members (View Only):
✓ darrel@worryfreemovers.com
✓ zack@worryfreemovers.com
✓ [Add other crew members]

Managers (Can Edit):
✓ matt@worryfreemovers.com (already owner)
✓ [Add other managers]
```

---

## 🎯 Who Should Have Access?

### Crew Leaders (View Only)
- **Darrel** - Crew A Lead
- **Zack** - Crew B Lead
- They see all bookings but cannot edit
- Perfect for checking their schedule

### Managers (Full Access)
- **Matt** - Owner/Manager
- Can edit, reschedule, cancel bookings
- Full control over calendar

### Office Staff (View Only)
- Anyone who answers phones
- Can see availability
- Cannot change bookings

---

## 📧 What They'll Receive

### Automatic Email
Each person gets an email like this:

```
Subject: Matt Woodruff has shared a calendar with you

Matt Woodruff (matt@worryfreemovers.com) has invited you
to view the calendar "Worry Free Moving - Master Calendar"

[Add this calendar] ← Click this button
```

### After They Click "Add this calendar"
- Calendar appears in their Google Calendar
- Updates automatically
- They can view on phone/computer
- No setup needed!

---

## 📱 Viewing on Mobile

### iPhone/iPad (Apple Calendar)
1. Open **Calendar** app
2. Calendar automatically syncs from Google
3. That's it! They're done.

OR use Google Calendar app:
1. Install **Google Calendar** from App Store
2. Sign in with their work email
3. Calendar appears automatically

### Android
1. Open **Google Calendar** app (pre-installed)
2. Sign in with their work email
3. Calendar appears automatically

---

## 🎨 Color Coding

Make bookings easy to identify:

### In Calendar Settings:
- **Blue** = Worry Free Moving bookings
- **Green** = Quality Moving bookings
- **Red** = High Priority / Urgent
- **Purple** = VIP Customers

To change colors:
1. In Google Calendar, click on event
2. Click **pencil icon** (edit)
3. Choose color from palette

---

## ⚙️ Managing Access (Admin Portal)

### Current Settings
Location: `data/calendar-settings.json`

```json
{
  "syncTargets": [
    {
      "name": "Darrel (Crew Lead)",
      "email": "darrel@worryfreemovers.com",
      "role": "crew",
      "permissions": "read"
    },
    {
      "name": "Zack (Crew Lead)",
      "email": "zack@worryfreemovers.com",
      "role": "crew",
      "permissions": "read"
    },
    {
      "name": "Matt (Manager)",
      "email": "matt@worryfreemovers.com",
      "role": "manager",
      "permissions": "write"
    }
  ]
}
```

### To Add New Person:
1. Open `data/calendar-settings.json`
2. Add new entry to `syncTargets` array
3. OR use API: `POST /api/calendar-settings/add-sync-target`

### To Remove Person:
1. Go back to Google Calendar settings
2. Find their email under "Share with specific people"
3. Click **X** next to their name
4. Click "Remove"

---

## 🔒 Security & Privacy

### What Crew Members See:
- ✅ Date and time of booking
- ✅ Customer name
- ✅ Service type
- ✅ Addresses (pickup/dropoff)
- ✅ Estimated hours
- ✅ Notes and special instructions

### What Crew Members CANNOT Do:
- ❌ Edit bookings
- ❌ Cancel bookings
- ❌ Add new bookings
- ❌ See customer payment info
- ❌ Access admin portal

### What Managers Can Do:
- ✅ Everything crew members can see
- ✅ Edit bookings
- ✅ Reschedule appointments
- ✅ Cancel bookings
- ✅ Add new bookings

---

## 📅 How Events Appear

### Event Title Format:
```
[WF] 2 Person Crew - John Smith
[QM] Labor Only - Jane Doe
```

- **[WF]** = Worry Free Moving
- **[QM]** = Quality Moving

### Event Description Contains:
```
Company: Worry Free Moving
Booking ID: WF-1234567890-ABC123
Customer: John Smith
Phone: 330-555-1234
Service: 2 Person Crew
Pickup: 123 Main St, Akron OH
Dropoff: 456 Oak Ave, Canton OH
Est. Hours: 4
Movers: 2
Priority: NORMAL
Crew: Crew A (Darrel's Team)
Notes: Heavy furniture, stairs at pickup
```

---

## 🚨 Troubleshooting

### Problem: Person didn't receive email
**Solution:**
1. Check spam/junk folder
2. Resend invitation from Google Calendar
3. Make sure email address is correct

### Problem: Calendar not showing up on phone
**Solution:**
1. Make sure they clicked "Add this calendar" in email
2. On phone, open Calendar app settings
3. Make sure calendar is toggled ON
4. Check that sync is enabled

### Problem: Updates not appearing
**Solution:**
1. Pull down to refresh (on mobile)
2. Check internet connection
3. Sign out and sign back in to Calendar app

### Problem: Person can edit when they shouldn't
**Solution:**
1. Go to Google Calendar settings
2. Find their email
3. Change permission to "See all event details"
4. Save

---

## 💡 Pro Tips

### 1. Use Calendar App Notifications
Crew members can enable notifications for:
- New bookings (1 day before)
- Booking changes (immediately)
- Cancellations (immediately)

### 2. Filter by Company
In Google Calendar:
- Search "**[WF]**" to see only Worry Free bookings
- Search "**[QM]**" to see only Quality Moving bookings

### 3. Weekly View
Crew members should use "**Week**" view:
- Shows full week at a glance
- Easy to see upcoming jobs
- Better than month view for daily planning

### 4. Offline Access
Google Calendar works offline:
- Events sync when online
- Can view schedule without internet
- Perfect for job sites

---

## 📞 Need Help?

### Common Questions:

**Q: Can crew members add their own events?**
A: No, they have read-only access. This prevents accidental changes.

**Q: Do they need a Gmail account?**
A: No! Google Calendar invites work with any email address.

**Q: What if they use Apple Calendar?**
A: It works! Google Calendar syncs to Apple Calendar automatically.

**Q: Can they see old bookings?**
A: Yes, entire calendar history is visible.

**Q: Does this cost anything?**
A: No! Google Calendar sharing is 100% free.

---

## ✅ Setup Checklist

Use this checklist to track who has access:

- [ ] **Darrel** - Email sent, calendar added, confirmed working
- [ ] **Zack** - Email sent, calendar added, confirmed working
- [ ] **Matt** - Already has access (owner)
- [ ] **Office Staff** - Email sent, calendar added
- [ ] **Other crew members** - Add as needed

---

## 🎯 Summary

**What you did:**
1. ✅ Shared Google Calendar with crew/managers
2. ✅ Set correct permissions (view vs edit)
3. ✅ Everyone can see bookings in real-time

**What they need to do:**
1. ✅ Click "Add this calendar" in email
2. ✅ Open Calendar app on phone
3. ✅ Done! Calendar syncs automatically

**Result:**
- Everyone sees the same schedule
- No double-booking
- Real-time updates
- Works on any device
- Zero maintenance

---

## 🔄 Ongoing Management

### Adding New Crew Member:
1. Go to Google Calendar settings
2. Click "Add people"
3. Enter email, choose "See all event details"
4. Done!

### Removing Crew Member:
1. Go to Google Calendar settings
2. Find their email
3. Click X to remove
4. Confirm

### No complicated setup required!

---

## API Reference (For Developers)

### Get Calendar Settings:
```
GET /api/calendar-settings
```

### Add Sync Target:
```
POST /api/calendar-settings/add-sync-target
Body: {
  "name": "New Person",
  "email": "person@example.com",
  "role": "crew",
  "permissions": "read",
  "notes": "Optional notes"
}
```

### Remove Sync Target:
```
DELETE /api/calendar-settings/sync-target/:id
```

---

**That's it! Your calendar is now synced with your entire team.**

For questions: matt@worryfreemovers.com
