# Google Business Profile & Facebook Booking Integration Guide

## Overview

This guide explains how to integrate your Worry-Free Moving booking system with Google Business Profile and Facebook so customers can book directly from Google Search, Google Maps, and Facebook.

---

## 🎯 Goals

1. **"Book" button on Google Search** - Customers can book from your Google Business listing
2. **"Book" button on Facebook** - Customers can book from your Facebook page
3. **Calendar sync** - Bookings appear in Google Calendar automatically
4. **Cross-platform availability** - Real-time availability across all platforms

---

## 📍 Part 1: Google Business Profile Integration ("Reserve with Google")

### What is Reserve with Google?

Reserve with Google allows customers to book services directly from:
- Google Search results
- Google Maps
- Your Google Business Profile

### Prerequisites

- Active Google Business Profile
- Verified business
- Website with HTTPS (required for booking integrations)
- Your booking system deployed to a public URL

### Step 1: Deploy Your Booking System

Before you can integrate with Google, your booking system needs to be accessible via HTTPS.

**Option A: Deploy to Vercel (Recommended - Free)**

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. From your project directory:
```bash
cd C:\Users\caspe\OneDrive\Desktop\worry-free-booking
vercel login
vercel
```

3. Follow prompts:
   - Set up and deploy: **Yes**
   - Which scope: **Your account**
   - Link to existing project: **No**
   - Project name: **worry-free-booking**
   - Directory: **./  (current directory)**
   - Override settings: **Yes**
   - Build command: **Leave empty** (or `npm run build` if you add one)
   - Output directory: **./**
   - Development command: **npm start**

4. Your booking system will be deployed at: `https://worry-free-booking.vercel.app`

**Option B: Use Existing Vercel Chatbot**

You already have the chatbot deployed at:
```
https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app
```

You can use this URL directly for Google Business integration since it now includes the complete booking flow.

### Step 2: Add Schema.org Structured Data

Add booking schema to sarah-ai.html to help Google understand your booking capability:

Add this to the `<head>` section of sarah-ai.html:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Worry-Free Moving",
  "image": "https://worryfreemovers.com/logo.png",
  "@id": "https://worryfreemovers.com",
  "url": "https://worryfreemovers.com",
  "telephone": "+1-330-435-8686",
  "priceRange": "$$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "11715 Mahoning Avenue",
    "addressLocality": "North Jackson",
    "addressRegion": "OH",
    "postalCode": "44451",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 41.0917,
    "longitude": -80.8645
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ],
    "opens": "08:00",
    "closes": "18:00"
  },
  "sameAs": [
    "https://www.facebook.com/worryfreemoving",
    "https://www.instagram.com/worryfreemoving"
  ],
  "potentialAction": {
    "@type": "ReserveAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app",
      "inLanguage": "en-US",
      "actionPlatform": [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform"
      ]
    },
    "result": {
      "@type": "Reservation",
      "name": "Moving Service Reservation"
    }
  }
}
</script>
```

### Step 3: Add "Book" Button to Google Business Profile

1. **Log into Google Business Profile**
   - Go to https://business.google.com
   - Select your Worry-Free Moving location

2. **Add Booking URL**
   - Click "Info" in the left menu
   - Scroll to "Add appointment URL"
   - Enter your booking URL:
     ```
     https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app
     ```
   - Click "Apply"

3. **Enable Booking Feature**
   - In Google Business Profile, go to "Services"
   - Add your services (Moving, Labor Only, Single Item, etc.)
   - For each service, enable "Book online"
   - Link to your booking URL

4. **Verify It Works**
   - Search for "Worry-Free Moving" on Google
   - You should see a "Book" or "Book online" button
   - Click it - should open your chatbot/booking system

### Step 4: Google Calendar Integration (Already Partially Implemented)

Your system already has Google Calendar integration in `services/googleCalendar.js`. To enable it:

1. **Get Google Calendar API Credentials**

   a. Go to https://console.cloud.google.com
   b. Create a new project or select existing
   c. Enable Google Calendar API
   d. Create OAuth 2.0 credentials
   e. Download `credentials.json`
   f. Place in project root: `C:\Users\caspe\OneDrive\Desktop\worry-free-booking\credentials.json`

2. **Run Initial Authentication**
   ```bash
   node test-google-auth.js
   ```
   This will open a browser for you to authorize the app.

3. **Verify Integration**
   - Create a test booking
   - Check your Google Calendar
   - Event should appear automatically

---

## 📘 Part 2: Facebook Booking Integration

### Step 1: Add "Book Now" Button to Facebook Page

1. **Log into Facebook Business Manager**
   - Go to https://business.facebook.com
   - Select your Worry-Free Moving page

2. **Add Call-to-Action Button**
   - Go to your Facebook Page
   - Click "Add a Button" (below cover photo)
   - Select "Book Now" or "Book with You"
   - Enter your booking URL:
     ```
     https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app
     ```
   - Click "Finish"

3. **Alternative: Use Messenger for Bookings**

   You can also integrate the chatbot directly into Facebook Messenger:

   a. Go to Facebook Page Settings → Messaging
   b. Enable "Instant Replies"
   c. Set automated response with booking link

   Example message:
   ```
   Hi! Thanks for reaching out to Worry-Free Moving! 🚚

   Get your instant quote and book your move here:
   https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app

   Or call us at 330-435-8686!
   ```

### Step 2: Facebook Pixel for Tracking (Optional)

Track bookings from Facebook:

1. Create Facebook Pixel at https://business.facebook.com/events_manager
2. Add pixel code to sarah-ai.html after successful booking:

```javascript
// In showBookingSuccess function, add:
if (typeof fbq !== 'undefined') {
    fbq('track', 'Schedule', {
        value: chatState.data.estimate?.total || 0,
        currency: 'USD',
        content_name: chatState.serviceType
    });
}
```

---

## 🗓️ Part 3: Calendar Synchronization

### Option 1: Google Calendar (Recommended - Already Implemented)

Your system already syncs to Google Calendar via `services/googleCalendar.js`.

**To enable:**
1. Add `credentials.json` (see Part 1, Step 4)
2. Restart server
3. Bookings will auto-sync to Google Calendar

### Option 2: Multi-Calendar Sync

Your system supports multiple calendars:
- **Worry-Free Moving** (main calendar)
- **Quality Moving** (affiliate calendar)
- **Internal** (crew schedule calendar)

Configured in: `data/calendars/`

### Option 3: iCloud Calendar Sync (Already Implemented)

To sync with iCloud Calendar:

1. **Add iCloud credentials to .env:**
   ```
   ICLOUD_USERNAME=your_apple_id@icloud.com
   ICLOUD_PASSWORD=app-specific-password
   ```

2. **Generate App-Specific Password:**
   - Go to https://appleid.apple.com
   - Sign in
   - Security → App-Specific Passwords
   - Generate password for "Booking System"

3. **Restart server** - bookings will sync to iCloud Calendar

---

## 🔗 Part 4: Direct Booking Links

### Create Shareable Booking Links

You can share direct links to your booking system:

**Main chatbot:**
```
https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app
```

**With pre-filled service type (coming soon):**
```
https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app?service=moving
https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app?service=labor
https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app?service=single
```

### Use on:
- Google Business Profile
- Facebook "Book" button
- Instagram bio link
- Email signatures
- Business cards (QR code)
- Truck decals (QR code)
- Yard signs

---

## 📱 Part 5: QR Code for In-Person Bookings

Generate QR codes for your booking link:

1. Go to https://www.qr-code-generator.com/
2. Enter URL: `https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app`
3. Customize with logo (optional)
4. Download high-resolution PNG

**Use QR codes on:**
- Business cards
- Truck wraps
- Yard signs
- Door hangers
- Flyers
- Invoices

---

## 🎨 Part 6: Embed Booking Widget on Your Website

Add the chatbot directly to worryfreemovers.com:

### Option 1: Full Page Embed

```html
<!-- Add to any page on worryfreemovers.com -->
<iframe
    src="https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app"
    style="width: 100%; height: 800px; border: none; border-radius: 10px;"
    title="Get Your Moving Quote">
</iframe>
```

### Option 2: Popup Widget

```html
<!-- Add to worryfreemovers.com -->
<button id="wfm-book-btn" style="position: fixed; bottom: 20px; right: 20px;
                                  background: #004085; color: white; padding: 15px 25px;
                                  border-radius: 50px; border: none; cursor: pointer;
                                  font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
    📅 Get Quote & Book
</button>

<div id="wfm-booking-modal" style="display: none; position: fixed; top: 0; left: 0;
                                    width: 100%; height: 100%; background: rgba(0,0,0,0.7);
                                    z-index: 9999; justify-content: center; align-items: center;">
    <div style="position: relative; width: 90%; max-width: 500px; height: 90%; max-height: 800px;
                background: white; border-radius: 15px; overflow: hidden;">
        <button id="wfm-close-btn" style="position: absolute; top: 10px; right: 10px;
                                           background: rgba(0,0,0,0.5); color: white; border: none;
                                           padding: 10px 15px; border-radius: 50%; cursor: pointer;
                                           font-size: 20px; z-index: 10000;">×</button>
        <iframe src="https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app"
                style="width: 100%; height: 100%; border: none;"></iframe>
    </div>
</div>

<script>
document.getElementById('wfm-book-btn').addEventListener('click', function() {
    document.getElementById('wfm-booking-modal').style.display = 'flex';
});

document.getElementById('wfm-close-btn').addEventListener('click', function() {
    document.getElementById('wfm-booking-modal').style.display = 'none';
});
</script>
```

---

## ✅ Testing Checklist

### Google Business Profile
- [ ] "Book" button visible on Google Search
- [ ] "Book" button visible on Google Maps
- [ ] Clicking "Book" opens your chatbot
- [ ] Schema.org data validates at https://search.google.com/test/rich-results
- [ ] Bookings appear in Google Calendar

### Facebook
- [ ] "Book Now" button visible on Facebook page
- [ ] Button links to correct URL
- [ ] Messenger auto-reply includes booking link
- [ ] Facebook Pixel tracks bookings (if enabled)

### Calendar Sync
- [ ] Google Calendar receives new bookings
- [ ] iCloud Calendar receives new bookings (if enabled)
- [ ] Calendar events include customer details
- [ ] 24-hour reminders work

### Cross-Platform
- [ ] Test booking from Google Search
- [ ] Test booking from Facebook
- [ ] Test booking from direct link
- [ ] Test booking from website embed
- [ ] Verify all bookings appear in admin portal

---

## 🚀 Going Live Checklist

1. **Deploy booking system to production URL**
   - Vercel deployment complete
   - HTTPS enabled
   - Custom domain (optional): `book.worryfreemovers.com`

2. **Update all booking links**
   - Google Business Profile
   - Facebook "Book Now" button
   - Website embeds
   - Email signatures

3. **Enable calendar sync**
   - Add Google Calendar credentials
   - Add iCloud credentials (optional)
   - Test booking creation

4. **Add schema.org markup**
   - Add to sarah-ai.html
   - Validate with Google Rich Results Test
   - Submit to Google Search Console

5. **Test end-to-end**
   - Book from Google
   - Book from Facebook
   - Verify calendar sync
   - Verify email notifications
   - Verify SMS notifications

6. **Monitor & optimize**
   - Track bookings by source
   - Monitor conversion rates
   - Adjust chatbot flow as needed

---

## 🔐 Security Notes

- Never expose API keys in client-side code
- Always use HTTPS for booking pages
- Store Square tokens on backend only
- Use environment variables for credentials
- Implement rate limiting on booking endpoints

---

## 📊 Analytics & Tracking

### Track booking sources:

Add UTM parameters to differentiate traffic:

**Google Business Profile:**
```
https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app?utm_source=google&utm_medium=business_profile&utm_campaign=bookings
```

**Facebook:**
```
https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app?utm_source=facebook&utm_medium=book_button&utm_campaign=bookings
```

**Instagram:**
```
https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app?utm_source=instagram&utm_medium=bio_link&utm_campaign=bookings
```

---

## 🆘 Troubleshooting

### "Book" button not showing on Google

**Possible causes:**
1. Business not verified
2. Booking URL not HTTPS
3. Schema.org markup missing/invalid
4. Service category doesn't support bookings

**Solutions:**
- Verify business at https://business.google.com
- Ensure URL starts with `https://`
- Validate schema at https://search.google.com/test/rich-results
- Contact Google Business Support

### Bookings not syncing to calendar

**Check:**
1. credentials.json exists in project root
2. Server has been restarted after adding credentials
3. Check server logs for calendar API errors
4. Verify OAuth scopes include calendar access

### Facebook button not working

**Check:**
1. URL is publicly accessible
2. URL starts with `https://`
3. Button type is set to "Book Now" or "Book with You"
4. Page is published (not draft)

---

## 📞 Support

For integration help:
- Google Business Support: https://support.google.com/business
- Facebook Business Support: https://www.facebook.com/business/help
- Your deployment: Check Vercel logs at https://vercel.com/dashboard

---

## 🎉 Summary

Once configured, your customers can book from:
- ✅ Google Search ("Book" button)
- ✅ Google Maps ("Book" button)
- ✅ Facebook ("Book Now" button)
- ✅ Instagram (bio link)
- ✅ Your website (embedded widget)
- ✅ QR codes (truck, yard signs, business cards)
- ✅ Direct link (email, SMS)

All bookings:
- ✅ Save customer payment info once (Square)
- ✅ Sync to Google Calendar
- ✅ Sync to iCloud Calendar (optional)
- ✅ Send email confirmations
- ✅ Send SMS confirmations
- ✅ Trigger 24-hour reminders
- ✅ Appear in admin portal

This creates a **seamless omnichannel booking experience** for your customers! 🚀
