# Worry Free Moving - Custom Booking System Features

## 🎉 Complete Feature List

### ✅ Core Booking Features

#### 1. **Custom Booking Interface**
- Replaces Acuity with your own booking system
- Step-by-step booking wizard
- Auto-fills customer information from chatbot
- Mobile-responsive design
- Real-time availability checking

#### 2. **Appointment Management**
- **Create bookings** with customer info, date, time, service type
- **Reschedule appointments** with automatic notifications
- **Edit appointment details** (notes, addresses, contact info)
- **Cancel appointments** with confirmation emails
- **View appointment history**

#### 3. **Multi-Calendar System** 🆕
- **Worry Free Moving Calendar** - Main moving services
- **Quality Moving Calendar** - Labor-only jobs (kept separate)
- **Internal Calendar** - Day offs, meetings, call-offs
- **Prevents double-booking** across all calendars
- **Smart availability checking** across multiple calendars

### 📧 Communication Features

#### 1. **Email Notifications**
- **Customer Confirmation Emails**
  - Professional HTML design
  - Calendar invite (.ics file) attached
  - Booking details and instructions

- **Company Notification Emails**
  - Sent to company email for every new booking
  - Full customer and booking details
  - Action reminders

- **Reschedule Notifications**
  - Shows old vs new date/time
  - Sent to both customer and company

- **Cancellation Emails**
  - Confirmation of cancellation
  - Option to rebook

- **24-Hour Reminders** ⏰
  - Automated system sends reminders 24 hours before appointments
  - Email + SMS
  - Pre-move checklist included
  - Runs every hour checking for upcoming appointments

#### 2. **SMS Text Messages** 📱
- **RingCentral API Integration**
- **Booking confirmations** via SMS
- **Reschedule notifications** via SMS
- **24-hour reminders** via SMS
- **Cancellation notifications**
- Fully automated

### 📅 Calendar Integration

#### 1. **Google Calendar Sync**
- Automatic event creation in Google Calendar
- Syncs booking details
- Updates and cancellations reflected

#### 2. **iCloud Calendar Sync**
- CalDAV integration
- Calendar invites in emails work with iCloud
- Cross-platform compatibility

#### 3. **Internal Calendar Management**
- Track day-offs, meetings, call-offs
- Blocks time slots for internal events
- Crew availability tracking

### 🏢 Dual Company Support

#### **Worry Free Moving**
- Full moving services
- Local & long-distance
- Labor-only (optional)
- Packing, single items

#### **Quality Moving** 🆕
- Labor-only company
- Kept 100% separate from Worry Free
- Can be enabled/disabled via environment variable
- Not advertised together to prevent conflicts
- Separate calendar and booking management

**Configuration:**
```env
USE_QUALITY_MOVING=true  # Use Quality Moving for labor-only
USE_QUALITY_MOVING=false # Worry Free handles all (default)
```

### 📄 Bill of Lading (BOL) Generator

- **Professional PDF BOL documents**
- Automatically determines correct company (Worry Free vs Quality)
- Includes:
  - Company information
  - Customer details
  - Move information
  - Inventory list with conditions
  - Special instructions
  - Terms and conditions
  - Signature sections
- Download as PDF
- Email to customers

**API Endpoint:**
```
POST /api/generate-bol
{
  "bookingId": "WFM-123",
  "inventoryItems": [...],
  "specialInstructions": "..."
}
```

### 🤖 Automation Features

#### 1. **Auto-Fill from Chatbot**
- Customer name (first & last)
- Email address
- Phone number
- Pickup/dropoff addresses
- Service type
- Estimate details

#### 2. **24-Hour Reminder System** ⏰
- **Automated cron job** runs every hour
- Checks appointments 24 hours away
- Sends email + SMS reminders
- Includes pre-move checklist
- Marks reminders as sent (won't duplicate)
- Runs continuously in background

#### 3. **Smart Availability**
- Real-time slot checking
- Cross-calendar validation
- Prevents double-booking
- Shows which calendar has bookings

### 🔧 API Endpoints

#### Booking Management
```
POST /api/book-appointment        - Create new booking
GET  /api/appointment/:bookingId  - Get appointment details
POST /api/reschedule-appointment  - Reschedule appointment
POST /api/update-appointment      - Update appointment details
POST /api/cancel-appointment      - Cancel appointment
```

#### Availability
```
GET /api/available-slots?date=YYYY-MM-DD  - Get available times
```

#### Utilities
```
GET  /api/company-info?serviceType=...    - Get company information
POST /api/generate-bol                    - Generate BOL PDF
GET  /api/health                          - Health check
```

### 💾 Data Storage

#### Appointments Database
- JSON file storage (`data/appointments.json`)
- Easy to migrate to MongoDB/PostgreSQL
- Includes full booking history
- Tracks reschedules and cancellations

#### Multi-Calendar Storage
```
data/
  calendars/
    worry-free-moving.json
    quality-moving.json
    internal.json
```

### 🔐 Security Features

- Environment variables for sensitive data
- No credentials in code
- .gitignore configured
- App-specific passwords for email/calendar
- HTTPS ready (Vercel/production)

### 📊 Tracking & Analytics

- Booking creation timestamps
- Reschedule history
- Cancellation tracking
- Reminder delivery confirmation
- Email/SMS send status
- Calendar sync status

## 🆚 Comparison: Acuity vs Custom System

| Feature | Acuity | Custom System |
|---------|--------|---------------|
| Monthly Cost | ~$16-$50 | **FREE** (just hosting) |
| Auto-fill from chatbot | ❌ | ✅ |
| Dual company support | ❌ | ✅ |
| Custom BOL generation | ❌ | ✅ |
| SMS confirmations | Paid add-on | ✅ Included |
| 24-hour reminders | Limited | ✅ Full automation |
| Company notifications | Limited | ✅ Full featured |
| Multi-calendar | Limited | ✅ 3 separate calendars |
| Full control | ❌ | ✅ |
| Custom branding | Limited | ✅ Complete control |
| Data ownership | Acuity owns | ✅ You own |

## 🚀 Quick Feature Guide

### For Customers:
1. Chat with Sarah (your chatbot)
2. Get instant quote
3. Click "Schedule with Sarah"
4. See auto-filled information
5. Pick date & time
6. Confirm booking
7. Receive email + SMS confirmation with calendar invite
8. Get 24-hour reminder before move

### For Your Business:
1. Receive instant email for every booking
2. See full customer details
3. Track across multiple calendars
4. Generate BOLs instantly
5. Manage internal schedules
6. Reschedule with automatic notifications
7. Everything syncs to Google Calendar/iCloud

## 📱 Notifications Summary

### When a booking is created:
- ✅ Customer gets confirmation email with calendar invite
- ✅ Company gets notification email with full details
- ✅ Customer gets SMS confirmation
- ✅ Event added to Google/iCloud calendars
- ✅ Added to appropriate company calendar

### 24 hours before appointment:
- ✅ Customer gets reminder email with checklist
- ✅ Customer gets SMS reminder

### When rescheduled:
- ✅ Customer gets reschedule confirmation (email + SMS)
- ✅ Company gets notification
- ✅ Calendar events updated

### When cancelled:
- ✅ Customer gets cancellation confirmation (email + SMS)
- ✅ Company gets notification
- ✅ Calendar events cancelled

## 🎯 Next Steps

### Now:
1. Install dependencies: `npm install`
2. Configure `.env` file
3. Start server: `npm start`
4. Integrate with chatbot (see INTEGRATION_GUIDE.md)

### Optional Enhancements:
1. Add payment processing integration
2. Create admin dashboard
3. Add crew assignment features
4. Implement customer portal
5. Add reporting and analytics
6. Migrate to database (MongoDB/PostgreSQL)

## 💡 Pro Tips

### RingCentral SMS Setup:
1. Go to https://developers.ringcentral.com
2. Create developer account
3. Create an app (get Client ID & Secret)
4. Get your credentials
5. Add to `.env` file

### Gmail App Password:
1. Enable 2-factor authentication
2. Go to https://myaccount.google.com/apppasswords
3. Generate app password
4. Copy to `.env`

### Google Calendar Setup:
1. Run `node setup-google-auth.js`
2. Follow authorization flow
3. Done!

## 📞 Support

Questions? Check out:
- `README.md` - Full documentation
- `QUICK_START.md` - Get started fast
- `INTEGRATION_GUIDE.md` - Chatbot integration
- `DEPLOYMENT.md` - Deploy to production

Email: service@worryfreemovers.com
Phone: 330-435-8686

---

**Built with ❤️ for Worry Free Moving**

*Zero monthly fees. Complete control. Professional features.*
