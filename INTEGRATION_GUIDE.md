# Integration Guide: Replace Acuity with Custom Booking

This guide shows how to replace the Acuity scheduler in your Sarah AI v3.html chatbot with the custom booking system.

## Steps to Integrate

### 1. Start the Booking API Server

First, make sure your booking API server is running:

```bash
cd worry-free-booking
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

The API will run on `http://localhost:3001`

### 2. Update Sarah AI v3.html

Open `Sarah AI v3.html` and make the following changes:

#### A. Replace Acuity Container HTML

Find this section (around line 1295):
```html
<!-- Acuity Container -->
<div id="wfm-acuity-container" style="display: none;">
    <div id="wfm-acuity-header">
        <button id="wfm-acuity-back">← Back to Chat</button>
        <span>Schedule Your Move</span>
    </div>
    <iframe id="wfm-acuity-iframe"
            src=""
            frameborder="0">
    </iframe>
</div>
```

**Replace it with the custom booking UI from `booking-ui.html`**

Copy the entire HTML section from booking-ui.html (lines starting with `<div id="wfm-booking-container">`)

#### B. Replace Acuity Styles

Find this section (around line 397):
```css
/* Acuity Container Styles */
#wfm-acuity-container {
    ...
}
```

**Replace it with the booking styles from `booking-ui.html`**

Copy the entire `<style>` section from booking-ui.html.

#### C. Update JavaScript - Remove Acuity References

Find and **DELETE** these lines (around line 1712):
```javascript
// Acuity elements
const acuityContainer = document.getElementById('wfm-acuity-container');
const acuityIframe = document.getElementById('wfm-acuity-iframe');
const acuityBackBtn = document.getElementById('wfm-acuity-back');
```

Find and **DELETE** the Acuity functions (around line 2414):
```javascript
// Acuity integration functions with parameter passing
function showAcuityScheduler() {
    ...
}

function hideAcuityScheduler() {
    ...
}
```

Find and **DELETE** the Acuity back button listener (around line 3095):
```javascript
// Acuity back button
acuityBackBtn.addEventListener('click', hideAcuityScheduler);
```

#### D. Update Schedule Button Actions

Find all instances where `showAcuityScheduler()` is called and **replace with `showBookingUI()`**:

Search for: `showAcuityScheduler()`
Replace with: `showBookingUI()`

Common locations:
- Line 2667: Inside the quote submission handler
- Line 6583: Schedule button click handler
- Line 6597, 6606, 6612: Other schedule button handlers

Example change:
```javascript
// OLD:
if (value === 'schedule_acuity') {
    showAcuityScheduler();
}

// NEW:
if (value === 'schedule_acuity') {
    showBookingUI();
}
```

#### E. Add Booking JavaScript

At the end of the `<script>` section (before the closing `</script>` tag), **add the booking JavaScript code from `booking-ui.html`**:

Copy everything from the `<script>` section in booking-ui.html (starting with `// Booking System JavaScript`)

#### F. Update API URL (Important!)

In the booking JavaScript you just added, find this line:
```javascript
const bookingState = {
    currentStep: 1,
    selectedDate: null,
    selectedTime: null,
    customerInfo: {},
    apiUrl: 'http://localhost:3001/api' // Change to your API URL
};
```

If deploying to production, change the `apiUrl` to your production server URL:
```javascript
apiUrl: 'https://your-domain.com/api'
```

### 3. Remove Acuity Configuration

In the CONFIG object (around line 1360), you can optionally **remove or comment out**:
```javascript
acuityUrl: "https://app.acuityscheduling.com/schedule.php?owner=26866067&ref=embedded_csp",
```

### 4. Test the Integration

1. Open Sarah AI v3.html in your browser
2. Go through the chatbot flow
3. When you click "📅 Schedule with Sarah", the custom booking UI should appear
4. Customer information should be auto-filled
5. Select a date and time
6. Confirm the booking
7. Check that:
   - Appointment is saved in `data/appointments.json`
   - Confirmation email is sent
   - Calendar events are created (if configured)

## Summary of Changes

### Files to Modify:
- `Sarah AI v3.html` - Your main chatbot file

### Changes Required:
1. ✅ Replace Acuity HTML container with custom booking UI
2. ✅ Replace Acuity CSS styles with booking styles
3. ✅ Remove Acuity JavaScript functions and references
4. ✅ Replace `showAcuityScheduler()` calls with `showBookingUI()`
5. ✅ Add custom booking JavaScript code
6. ✅ Update API URL in booking configuration

## Deployment

### For Production:

1. **Deploy the API Server:**
   - Upload the `worry-free-booking` folder to your server
   - Install dependencies: `npm install`
   - Configure `.env` file with production credentials
   - Start server: `npm start` or use PM2/forever for process management
   - Recommended: Use a reverse proxy (nginx) and SSL certificate

2. **Update Chatbot HTML:**
   - Change `apiUrl` to your production API URL
   - Upload updated HTML file to your website

3. **Test thoroughly:**
   - Test complete booking flow
   - Verify emails are sent
   - Check calendar sync
   - Test on mobile devices

## Troubleshooting

### Booking UI doesn't appear:
- Check browser console for errors
- Verify API server is running
- Check that `showBookingUI()` function exists

### Auto-fill not working:
- Verify `chatState.data` contains customer information
- Check field names match (firstName, lastName, email, phone)

### API errors:
- Check API server logs
- Verify API URL is correct
- Check CORS settings if using different domains

### Emails not sending:
- Check `.env` file configuration
- Verify email credentials
- Check server logs for errors

## Support

If you need help with integration:
- Review the README.md file
- Check server logs for errors
- Contact: service@worryfreemovers.com

## Rollback Plan

If you need to revert to Acuity:
1. Keep a backup of the original Sarah AI v3.html
2. Simply restore the backup file
3. Stop the booking API server

---

**Note:** This integration completely removes Acuity dependency. All bookings will be managed by your custom system.
