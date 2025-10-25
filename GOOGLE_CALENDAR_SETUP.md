# Google Calendar API Setup Guide

## Overview
This guide will help you get the `credentials.json` file needed to sync bookings with your Google Calendar (**matt@worryfreemovers.com**).

---

## Step 1: Go to Google Cloud Console

1. Open your browser and go to: **https://console.cloud.google.com**
2. Sign in with **matt@worryfreemovers.com**

---

## Step 2: Create a New Project (or Select Existing)

1. At the top of the page, click the **project dropdown**
2. Click **"NEW PROJECT"**
3. Project name: **Worry-Free Booking System**
4. Click **"CREATE"**
5. Wait for the project to be created (takes a few seconds)
6. Make sure the new project is selected in the dropdown

---

## Step 3: Enable Google Calendar API

1. In the left sidebar, click **"APIs & Services"** → **"Library"**
   - Or go directly to: https://console.cloud.google.com/apis/library

2. In the search box, type: **Google Calendar API**

3. Click on **"Google Calendar API"**

4. Click the blue **"ENABLE"** button

5. Wait for it to enable (takes a few seconds)

---

## Step 4: Create OAuth 2.0 Credentials

1. In the left sidebar, click **"APIs & Services"** → **"Credentials"**
   - Or go to: https://console.cloud.google.com/apis/credentials

2. Click **"+ CREATE CREDENTIALS"** at the top

3. Select **"OAuth client ID"**

4. **If prompted to configure consent screen:**
   - Click **"CONFIGURE CONSENT SCREEN"**
   - Select **"External"** (unless you have Google Workspace)
   - Click **"CREATE"**

   **Fill out the OAuth consent screen:**
   - App name: **Worry-Free Booking System**
   - User support email: **matt@worryfreemovers.com**
   - Developer contact email: **matt@worryfreemovers.com**
   - Click **"SAVE AND CONTINUE"**

   **Scopes:**
   - Click **"ADD OR REMOVE SCOPES"**
   - Search for "calendar"
   - Check: **Google Calendar API** → **/auth/calendar** (See, edit, share, and permanently delete all calendars)
   - Click **"UPDATE"**
   - Click **"SAVE AND CONTINUE"**

   **Test users:**
   - Click **"+ ADD USERS"**
   - Enter: **matt@worryfreemovers.com**
   - Click **"ADD"**
   - Click **"SAVE AND CONTINUE"**

   **Summary:**
   - Review and click **"BACK TO DASHBOARD"**

5. **Now create the OAuth client:**
   - Go back to **"Credentials"** in the left sidebar
   - Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**

   - Application type: **Desktop app**
   - Name: **Worry-Free Booking Desktop**
   - Click **"CREATE"**

6. **Download the credentials:**
   - A popup will appear saying "OAuth client created"
   - Click **"DOWNLOAD JSON"**
   - Save the file

---

## Step 5: Rename and Move the File

1. The downloaded file will be named something like:
   ```
   client_secret_XXXXXXXXXXXX.apps.googleusercontent.com.json
   ```

2. **Rename it to exactly:**
   ```
   credentials.json
   ```

3. **Move it to your project folder:**
   ```
   C:\Users\caspe\OneDrive\Desktop\worry-free-booking\credentials.json
   ```

---

## Step 6: Authorize the Application

1. **Stop your server** (if it's running): Press **Ctrl+C** in the terminal

2. **Run the authorization script:**
   ```bash
   node setup-google-auth.js
   ```

3. **A browser window will open** asking you to sign in

4. **Sign in with:** matt@worryfreemovers.com

5. **You'll see a warning:** "Google hasn't verified this app"
   - Click **"Advanced"**
   - Click **"Go to Worry-Free Booking System (unsafe)"**
   - This is safe - it's your own app!

6. **Grant permissions:**
   - Click **"Allow"** to give calendar access
   - Click **"Allow"** again on the next screen

7. **Success!** You should see in the terminal:
   ```
   Authentication successful!
   Token saved to token.json
   ```

8. **Close the browser window**

---

## Step 7: Verify It Works

1. **Check that these files now exist:**
   ```
   C:\Users\caspe\OneDrive\Desktop\worry-free-booking\credentials.json ✅
   C:\Users\caspe\OneDrive\Desktop\worry-free-booking\token.json ✅
   ```

2. **Restart your server:**
   ```bash
   npm start
   ```

3. **You should see in the server output:**
   ```
   ✅ Google Calendar: ACTIVE (matt@worryfreemovers.com)
   ```

4. **Test it:**
   - Create a test booking through the chatbot
   - Check your Google Calendar at: https://calendar.google.com
   - The appointment should appear automatically!

---

## What You Get After Setup

When a booking is created, the system will:

✅ Email confirmation with .ics file
✅ **Automatic event in your Google Calendar (matt@worryfreemovers.com)**
✅ Event includes all booking details (customer, addresses, phone, etc.)
✅ Automatic reminders set
✅ Updates if booking is rescheduled
✅ Deleted if booking is cancelled
✅ Sync across all your devices instantly

---

## Your Calendar Information

**Your Google Calendar:** matt@worryfreemovers.com

**View Calendar Online:**
```
https://calendar.google.com
```

**Embed in Website:**
```html
<iframe src="https://calendar.google.com/calendar/embed?src=matt%40worryfreemovers.com&ctz=America%2FNew_York"
        style="border: 0" width="800" height="600" frameborder="0" scrolling="no"></iframe>
```

**iCal Feed (for syncing with other apps):**
```
https://calendar.google.com/calendar/ical/matt%40worryfreemovers.com/public/basic.ics
```

---

## Troubleshooting

### "credentials.json not found"

**Possible causes:**
1. File is not in the correct location
2. File is named incorrectly
3. File has wrong extension (.json.txt instead of .json)

**Solutions:**
- Make sure the file is at: `C:\Users\caspe\OneDrive\Desktop\worry-free-booking\credentials.json`
- Make sure it's named exactly `credentials.json` (not `credentials.json.txt`)
- In Windows Explorer, show file extensions: View → Show → File name extensions

### "Token has been expired or revoked"

**How to fix:**
1. Delete `token.json` from the project folder
2. Run `node setup-google-auth.js` again
3. Re-authorize the app in the browser
4. A new `token.json` will be created

### "Access blocked: This app's request is invalid"

**How to fix:**
1. Go back to Google Cloud Console
2. Go to OAuth consent screen
3. Under "Test users", make sure **matt@worryfreemovers.com** is added
4. Wait a few minutes and try again

### "The browser didn't open during authorization"

**How to fix:**
1. Look in the terminal for a URL
2. Copy the entire URL manually
3. Paste it into your browser
4. Complete the authorization process

### "Calendar events are not being created"

**Check:**
1. `credentials.json` exists in project root
2. `token.json` exists in project root
3. Server logs show "✅ Google Calendar: ACTIVE"
4. No errors in server logs
5. Try creating a test booking and check server console for errors

---

## Files After Setup

Your project folder should have:

```
C:\Users\caspe\OneDrive\Desktop\worry-free-booking\
├── credentials.json       ← Downloaded from Google Cloud Console
├── token.json            ← Created automatically during authorization
├── .env                  ← Your configuration (already exists)
├── server.js
├── sarah-ai.html
└── ...
```

---

## Security Notes

🔒 **Keep these files private:**
- **credentials.json** - Gives access to your Google Calendar API
- **token.json** - Contains your authorization token
- Never commit these to git (already in .gitignore)
- Never share publicly
- Never send via email

---

## How It Works

1. **Booking created** → System sends data to server
2. **Server validates** → Checks all required information
3. **Google Calendar API** → Creates event automatically
4. **Event appears** → In your Google Calendar instantly
5. **All devices sync** → Phone, computer, tablet all updated
6. **Email sent** → Customer gets confirmation with .ics file too

---

## Benefits

**Before (Email only):**
- ✅ Customer gets calendar invite
- ❌ You have to manually add to calendar
- ❌ Or remember to click .ics file in email
- ❌ Easy to miss bookings

**After (Google Calendar API):**
- ✅ Customer gets calendar invite
- ✅ **Your calendar updates automatically**
- ✅ **No manual work required**
- ✅ **Never miss a booking**
- ✅ **Sync with crew calendars**
- ✅ **Integrate with Google Business Profile**

---

## Quick Reference

| Action | Command |
|--------|---------|
| Download credentials | https://console.cloud.google.com/apis/credentials |
| Authorize app | `node setup-google-auth.js` |
| Re-authorize | Delete `token.json` → Run `node setup-google-auth.js` |
| View calendar | https://calendar.google.com |
| Check integration status | Look for "✅ Google Calendar: ACTIVE" in server logs |
| Test booking | Create booking → Check Google Calendar |

---

## Example credentials.json Format

Your `credentials.json` file should look like this:

```json
{
  "installed": {
    "client_id": "xxxxx.apps.googleusercontent.com",
    "project_id": "worry-free-booking-xxxxx",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "xxxxx",
    "redirect_uris": ["http://localhost"]
  }
}
```

**If it doesn't look like this,** you may have downloaded the wrong type of credentials. Make sure you selected **"Desktop app"** when creating the OAuth client ID.

---

## Need Help?

**Step-by-step guide:** See above
**Google Cloud Console:** https://console.cloud.google.com
**Google Calendar API Docs:** https://developers.google.com/calendar/api
**Your calendar:** https://calendar.google.com

---

## Summary

1. ✅ Go to Google Cloud Console
2. ✅ Create project and enable Calendar API
3. ✅ Create OAuth Desktop credentials
4. ✅ Download and rename to `credentials.json`
5. ✅ Move to project folder
6. ✅ Run `node setup-google-auth.js`
7. ✅ Authorize with matt@worryfreemovers.com
8. ✅ Restart server
9. ✅ Test with a booking

That's it! Your bookings will now automatically appear in Google Calendar.
