# Worry Free Moving - Custom Booking System

A custom appointment booking system that integrates with your chatbot, Google Calendar, iCloud Calendar, and sends email confirmations.

## Features

- ✅ Custom booking interface (replaces Acuity)
- ✅ Auto-fills customer information from chatbot
- ✅ Sends professional confirmation emails with calendar invites
- ✅ Automatically syncs with Google Calendar
- ✅ Automatically syncs with iCloud Calendar
- ✅ Stores appointments locally
- ✅ RESTful API for booking management

## Setup Instructions

### 1. Install Dependencies

```bash
cd worry-free-booking
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

#### Email Configuration (Choose one)

**Option A: Gmail**
1. Enable 2-factor authentication on your Google account
2. Generate an app-specific password: https://myaccount.google.com/apppasswords
3. Set in `.env`:
```
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
```

**Option B: Other SMTP Provider**
```
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASSWORD=your-password
```

### 3. Google Calendar Integration (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Desktop app)
5. Download credentials as `credentials.json` and place in project root
6. Run the authorization flow:

```bash
node setup-google-auth.js
```

This will open a browser window to authorize access. After authorization, a `token.json` file will be created.

### 4. iCloud Calendar Integration (Optional)

1. Go to [Apple ID Account](https://appleid.apple.com)
2. Sign in and go to Security
3. Generate an app-specific password
4. Add to `.env`:

```
ICLOUD_USERNAME=your@icloud.com
ICLOUD_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### 5. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The API will be available at `http://localhost:3001`

## API Endpoints

### Health Check
```
GET /api/health
```

### Get Available Time Slots
```
GET /api/available-slots?date=2025-10-23
```

### Book Appointment
```
POST /api/book-appointment
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "330-555-1234",
  "date": "2025-10-23",
  "time": "10:00",
  "serviceType": "Moving Service",
  "pickupAddress": "123 Main St",
  "dropoffAddress": "456 Oak Ave",
  "notes": "Need help with heavy furniture",
  "estimateDetails": {
    "total": 350
  }
}
```

### Get Appointment
```
GET /api/appointment/:bookingId
```

### Cancel Appointment
```
POST /api/cancel-appointment
Content-Type: application/json

{
  "bookingId": "WFM-ABC123-XYZ"
}
```

## Integration with Chatbot

### Frontend Integration

The booking UI is embedded in your chatbot HTML. See `booking-ui.html` for the complete booking interface.

### Auto-fill Customer Data

When the chatbot opens the booking system, it automatically passes customer information:

```javascript
// In your chatbot code:
function showCustomBooking() {
    const bookingUI = document.getElementById('wfm-booking-container');

    // Auto-fill customer data
    document.getElementById('booking-first-name').value = chatState.data.firstName;
    document.getElementById('booking-last-name').value = chatState.data.lastName;
    document.getElementById('booking-email').value = chatState.data.email;
    document.getElementById('booking-phone').value = chatState.data.phone;

    // Show booking UI
    bookingUI.style.display = 'flex';
}
```

## File Structure

```
worry-free-booking/
├── server.js                 # Main Express server
├── package.json              # Dependencies
├── .env.example              # Environment template
├── README.md                 # This file
├── services/
│   ├── googleCalendar.js     # Google Calendar integration
│   ├── icloudCalendar.js     # iCloud Calendar integration
│   └── emailService.js       # Email notifications
├── utils/
│   └── helpers.js            # Utility functions
└── data/
    └── appointments.json     # Appointment storage
```

## Troubleshooting

### Email Not Sending
- Verify EMAIL_SERVICE is set correctly
- Check email credentials are valid
- For Gmail, ensure you're using app-specific password
- Check spam folder

### Google Calendar Not Syncing
- Ensure `credentials.json` exists
- Run `node setup-google-auth.js` to authorize
- Check `token.json` was created
- Verify Google Calendar API is enabled

### iCloud Calendar Not Syncing
- Verify you're using app-specific password (not regular password)
- Check username/password in `.env`
- Ensure iCloud Calendar is enabled on your Apple account

## Security Notes

- Never commit `.env` file to git
- Keep `credentials.json` and `token.json` private
- Use environment variables for all sensitive data
- Consider using a proper database for production

## Support

For issues or questions:
- Email: service@worryfreemovers.com
- Phone: 330-435-8686

## License

Proprietary - Worry Free Moving © 2025
