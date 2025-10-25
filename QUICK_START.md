# Quick Start Guide

Get your custom booking system up and running in 10 minutes!

## Prerequisites

- Node.js 16+ installed
- Email account (Gmail recommended)
- Text editor

## Step 1: Install Dependencies (2 minutes)

```bash
cd worry-free-booking
npm install
```

## Step 2: Configure Environment (3 minutes)

Create `.env` file from template:

```bash
cp .env.example .env
```

**Minimum required configuration** (edit `.env`):

```env
PORT=3001

# Email - Use Gmail for easiest setup
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Company email (receives booking notifications)
COMPANY_EMAIL=service@worryfreemovers.com
```

### How to get Gmail app-specific password:

1. Go to https://myaccount.google.com/apppasswords
2. Sign in to your Google account
3. Click "Select app" → Choose "Mail"
4. Click "Select device" → Choose "Other" → Type "Booking System"
5. Click "Generate"
6. Copy the 16-character password (remove spaces)
7. Paste into `.env` as `EMAIL_PASSWORD`

## Step 3: Start the Server (1 minute)

```bash
npm start
```

You should see:
```
🚀 Booking API server running on http://localhost:3001
📅 Appointments storage: /path/to/data/appointments.json
```

## Step 4: Test the API (2 minutes)

Open a new terminal and test:

```bash
# Health check
curl http://localhost:3001/api/health

# Get available slots
curl "http://localhost:3001/api/available-slots?date=2025-10-24"
```

## Step 5: Integrate with Chatbot (2 minutes)

1. Open your `Sarah AI v3.html` file
2. Follow the detailed instructions in `INTEGRATION_GUIDE.md`

**Quick version:**
- Copy the HTML from `booking-ui.html` and replace the Acuity container
- Copy the CSS styles
- Replace `showAcuityScheduler()` calls with `showBookingUI()`
- Add the booking JavaScript code

## Testing Your Booking System

### Test Email (Optional but Recommended)

Create a test booking to verify emails work:

```bash
curl -X POST http://localhost:3001/api/book-appointment \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "your-test-email@example.com",
    "phone": "330-555-1234",
    "date": "2025-10-24",
    "time": "10:00",
    "serviceType": "Test Booking"
  }'
```

Check your email for the confirmation!

### Test the UI

1. Open your modified `Sarah AI v3.html` in a browser
2. Go through the chatbot flow
3. Click "📅 Schedule with Sarah"
4. The custom booking UI should appear with auto-filled information
5. Complete a test booking

## What's Working Now

✅ Custom booking interface (no more Acuity!)
✅ Email confirmations with calendar invites
✅ Auto-fill customer information from chatbot
✅ Appointment storage
✅ Available time slot checking

## Optional: Add Calendar Sync

### Google Calendar (10 minutes)

Follow detailed instructions in `README.md` under "Google Calendar Integration"

Quick steps:
1. Create Google Cloud project
2. Enable Calendar API
3. Download credentials.json
4. Run `node setup-google-auth.js`

### iCloud Calendar (5 minutes)

1. Go to https://appleid.apple.com
2. Generate app-specific password
3. Add to `.env`:
```env
ICLOUD_USERNAME=your@icloud.com
ICLOUD_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

## Next Steps

### For Production Deployment:

See `DEPLOYMENT.md` for detailed deployment guides:
- **Vercel** (easiest, free)
- **Heroku** (easy, free tier available)
- **Your own server** (full control)

### For Development:

Use nodemon for auto-restart on file changes:
```bash
npm run dev
```

## Common Issues

### "Cannot find module 'express'"
Run `npm install` in the project directory

### "EADDRINUSE: address already in use"
Port 3001 is already in use. Change PORT in `.env` or kill the process:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <process_id> /F

# Mac/Linux
lsof -ti:3001 | xargs kill -9
```

### Emails not sending
- Check email credentials in `.env`
- For Gmail, make sure you're using app-specific password
- Check spam folder
- Look for errors in console output

### "credentials.json not found" warning
This is OK if you're not using Google Calendar yet. The booking system will work without it.

## File Structure

```
worry-free-booking/
├── server.js              # Main server (starts here)
├── booking-ui.html        # UI code to copy into chatbot
├── services/              # Calendar and email services
├── data/                  # Appointment storage (auto-created)
└── .env                   # Your configuration (create this)
```

## Getting Help

1. Check the error message in your terminal
2. Review `README.md` for detailed documentation
3. Check `INTEGRATION_GUIDE.md` for chatbot integration
4. Email: service@worryfreemovers.com

## What You've Built

🎉 Congratulations! You now have:

- ✅ A custom booking system (no third-party dependencies!)
- ✅ Auto-fill integration with your chatbot
- ✅ Professional email confirmations
- ✅ Calendar invites (.ics files)
- ✅ Appointment management
- ✅ Available slot tracking
- ✅ Full control over your booking data

## Performance Tips

- Appointments are stored in JSON files (good for hundreds of bookings)
- For high volume (1000+ bookings), migrate to MongoDB or PostgreSQL
- Use PM2 in production for auto-restart
- Enable HTTPS in production (Vercel does this automatically)

---

**Ready to book your first customer? Let's go! 🚀**
