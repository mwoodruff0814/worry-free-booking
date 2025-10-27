# Vapi + RingCentral AI Phone Receptionist Setup Guide

## Overview

This guide will walk you through setting up the **Vapi AI Phone Receptionist** that integrates seamlessly with your existing Worry Free Moving booking system and RingCentral phone service.

**What You'll Get:**
- 24/7 AI phone answering (Sarah, your virtual receptionist)
- Automatic quote generation based on customer requirements
- Real-time appointment booking synced to admin portal & Google Calendar
- Customer data collection and CRM integration
- Square payment link sending via SMS
- Smart call transfers to Matt/Zach when needed
- Automatic call recording and transcription
- Daily call summaries and performance reports
- Automatic backup to OneDrive every 6 hours

**Estimated Cost:** $67-82/month (Vapi service + existing RingCentral)

---

## Step 1: Create Vapi Account

1. Go to [vapi.ai](https://vapi.ai) and sign up for an account
2. Choose the **Pay As You Go** plan ($0.15/minute - no monthly fee)
3. Once logged in, go to **Dashboard** → **Settings** → **API Keys**
4. Copy your **API Key** (starts with `sk_...`)
5. Copy your **Public Key** (starts with `pk_...`)

**Save these for later - you'll need them!**

---

## Step 2: Configure Environment Variables

Add the following to your `.env` file in the `worry-free-booking` directory:

```env
# Vapi AI Phone Configuration
VAPI_API_KEY=sk_your_api_key_here
VAPI_PUBLIC_KEY=pk_your_public_key_here
VAPI_WEBHOOK_SECRET=your_random_secret_here
TRANSFER_NUMBER=+13304358686

# Your server URL (Render deployment URL)
BASE_URL=https://your-app-name.onrender.com

# Admin email for daily reports
ADMIN_EMAIL=zlarimer24@gmail.com
```

**To generate a webhook secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 3: Deploy Updated Code to Render

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Add Vapi AI phone receptionist integration"
   git push origin master
   ```

2. **Render will automatically deploy** your updated code (if auto-deploy is enabled)

3. **Verify deployment:**
   - Go to your Render dashboard
   - Check that the build succeeded
   - Look for this line in logs:
     ```
     📞 Vapi AI Phone: CONFIGURED
     ```

4. **Test the webhook endpoint:**
   Open in browser: `https://your-app-name.onrender.com/api/vapi/test`

   You should see:
   ```json
   {
     "success": true,
     "message": "Vapi integration is active",
     "configured": true,
     "webhookUrl": "https://your-app-name.onrender.com/api/vapi/webhook"
   }
   ```

---

## Step 4: Create AI Assistant in Vapi Dashboard

1. **Log into Vapi Dashboard** → **Assistants** → **Create Assistant**

2. **Copy the configuration** from `vapi-assistant-config.json` (in your project folder)

3. **Update these fields in the Vapi dashboard:**

   **Basic Settings:**
   - Name: `Worry Free Moving AI Receptionist`
   - First Message: `Hi! Thanks for calling Worry Free Moving. This is Sarah. I can help you get a quote, schedule your move, or answer any questions. How can I help you today?`

   **Voice Settings:**
   - Provider: `ElevenLabs`
   - Voice: `Rachel` (or choose your preferred voice)
   - Speed: `1.0`
   - Stability: `0.7`

   **Model Settings:**
   - Provider: `OpenAI`
   - Model: `gpt-4`
   - Temperature: `0.7`
   - Max Tokens: `500`

   **System Prompt:** Copy the entire `systemPrompt` section from `vapi-assistant-config.json`

4. **Configure Functions:**

   Click **Add Function** for each function below:

   ### Function 1: calculateQuote
   ```json
   {
     "name": "calculateQuote",
     "description": "Calculate a moving quote based on customer requirements",
     "url": "https://your-app-name.onrender.com/api/vapi/webhook",
     "method": "POST"
   }
   ```
   *(Copy parameters from vapi-assistant-config.json)*

   ### Function 2: checkAvailability
   ```json
   {
     "name": "checkAvailability",
     "description": "Check if a specific date and time is available",
     "url": "https://your-app-name.onrender.com/api/vapi/webhook",
     "method": "POST"
   }
   ```

   ### Function 3: bookAppointment
   ```json
   {
     "name": "bookAppointment",
     "description": "Book a confirmed moving appointment",
     "url": "https://your-app-name.onrender.com/api/vapi/webhook",
     "method": "POST"
   }
   ```

   ### Function 4: sendPaymentLink
   ```json
   {
     "name": "sendPaymentLink",
     "description": "Send Square payment link via SMS",
     "url": "https://your-app-name.onrender.com/api/vapi/webhook",
     "method": "POST"
   }
   ```

   ### Function 5: transferToHuman
   ```json
   {
     "name": "transferToHuman",
     "description": "Transfer call to Matt or Zach",
     "url": "https://your-app-name.onrender.com/api/vapi/webhook",
     "method": "POST"
   }
   ```

   ### Function 6: createCustomer
   ```json
   {
     "name": "createCustomer",
     "description": "Create customer record in CRM",
     "url": "https://your-app-name.onrender.com/api/vapi/webhook",
     "method": "POST"
   }
   ```

5. **Advanced Settings:**
   - Enable Call Recording: ✅ Yes
   - Enable Transcription: ✅ Yes
   - Max Call Duration: `1800` seconds (30 minutes)
   - Silence Timeout: `30` seconds
   - Background Sound: `office`
   - Server URL: `https://your-app-name.onrender.com/api/vapi/webhook`
   - Server URL Secret: *(paste your VAPI_WEBHOOK_SECRET)*

6. **Click "Save Assistant"**

7. **Copy the Assistant ID** (starts with `asst_...`) - you'll need this for phone setup

---

## Step 5: Connect RingCentral to Vapi

You have **two options** for connecting your RingCentral number to Vapi:

### Option A: Call Forwarding (Easiest - Recommended)

1. **Log into RingCentral Admin Portal**

2. **Set up conditional forwarding:**
   - Go to **Settings** → **Phone System** → **Call Handling**
   - Find your main number (330-435-8686)
   - Set forwarding rules:
     - **During business hours:** Forward to Vapi number (see step 3)
     - **After hours:** Forward to Vapi number
     - **When busy:** Forward to Vapi number

3. **Get your Vapi phone number:**
   - In Vapi Dashboard → **Phone Numbers** → **Buy Number**
   - Choose a local Ohio number (330 area code recommended)
   - Cost: ~$5-15/month
   - Copy the number (e.g., `+13304445555`)

4. **Assign assistant to phone number:**
   - In Vapi Dashboard → **Phone Numbers**
   - Click your number → **Assign Assistant**
   - Select "Worry Free Moving AI Receptionist"
   - Save

5. **Update RingCentral forwarding:**
   - Forward 330-435-8686 → Your Vapi number (+13304445555)
   - Test by calling your main number

### Option B: Direct Vapi Number (Simpler for Testing)

1. **Use Vapi number as your business line:**
   - Buy a number in Vapi Dashboard
   - Update your website/ads with the new number
   - Keep RingCentral as backup

2. **Configure transfer number in Vapi:**
   - In assistant settings, set "Forwarding Number" to `+13304358686`
   - When AI transfers, it routes to your RingCentral

---

## Step 6: Configure Call Transfers

To enable seamless transfers from AI → RingCentral → Matt/Zach:

1. **Update Vapi assistant settings:**
   - Forwarding Phone Number: `+13304358686` (your RingCentral)

2. **Set up RingCentral call queue (optional):**
   - Create a queue with Matt and Zach as members
   - Use this queue number as the transfer destination

3. **Test transfer flow:**
   - Call the Vapi number
   - Say "I'd like to speak with someone"
   - Verify it rings RingCentral

---

## Step 7: Test the System

### Test 1: Basic Call Flow
1. Call your Vapi number
2. Listen to Sarah's greeting
3. Say "I need a quote for a move"
4. Provide answers (home size, addresses, date)
5. Verify you receive a quote
6. Say "no thanks" and end call

**Check:**
- Call appears in Vapi Dashboard → Calls
- Call data saved to `worry-free-booking/data/vapi-calls/`
- Call eventually syncs to OneDrive

### Test 2: Booking Appointment
1. Call and request a quote
2. When asked, say "yes, I'd like to book"
3. Provide name, email, phone
4. Confirm the booking

**Check:**
- Appointment appears in Admin Portal
- Google Calendar event created
- Confirmation email received
- Customer created in CRM

### Test 3: Availability Check
1. Call and request to book a date
2. AI should check calendar availability
3. Try booking a time that's already taken
4. Verify AI suggests alternative times

### Test 4: Call Transfer
1. Call and say "I want to speak to someone"
2. Verify call transfers to RingCentral
3. Answer on your RingCentral device

**Check:**
- Transfer happens smoothly
- Call data shows "transferred" status

### Test 5: Payment Link
1. Complete a booking
2. When asked about payment, say "can you send me a link?"
3. Verify SMS received with payment link (once Square is integrated)

---

## Step 8: Monitor and Optimize

### View Call Logs
```bash
# View all calls from today
curl https://your-app-name.onrender.com/api/vapi/summary/2024-12-15
```

### Daily Email Reports
Every day at 11:59 PM, you'll receive an email with:
- Total calls
- Quotes generated
- Bookings made
- Transfers to human
- Average call duration
- Performance metrics

### OneDrive Backup
Call data automatically backs up to:
```
C:\Users\caspe\OneDrive\Worry Free Moving\Data Backups\AI Phone Calls\
```

Every 6 hours:
- Call recordings (MP3)
- Transcripts (JSON)
- Call metadata
- Quote data

### Manual Sync
Trigger immediate sync:
```bash
curl -X POST https://your-app-name.onrender.com/api/vapi/sync
```

---

## Customization

### Update Pricing
Edit `services/vapiService.js`:

```javascript
const PRICING = {
    hourlyRates: {
        '2-movers': 150,  // Adjust rates here
        '3-movers': 200,
        '4-movers': 250
    },
    // ... rest of pricing config
};
```

### Update System Prompt
Edit the assistant in Vapi Dashboard → System Prompt

**Common updates:**
- Add new FAQs
- Update service areas
- Change pricing explanation
- Modify transfer conditions

### Update Voice/Personality
In Vapi Dashboard → Voice Settings:
- Try different voices (Rachel, Josh, Bella, etc.)
- Adjust speed (0.8 = slower, 1.2 = faster)
- Change background sounds

---

## Troubleshooting

### Issue: Calls not connecting
**Solution:**
1. Check Vapi phone number is assigned to assistant
2. Verify RingCentral forwarding is active
3. Check Vapi account has credits

### Issue: Booking fails
**Solution:**
1. Check server logs on Render
2. Verify MongoDB connection is active
3. Test endpoint: `/api/vapi/test`
4. Check Google Calendar credentials are valid

### Issue: Transfers don't work
**Solution:**
1. Verify `TRANSFER_NUMBER` in `.env` is correct
2. Check RingCentral accepts forwarded calls
3. Test transfer number manually

### Issue: OneDrive sync not working
**Solution:**
1. Check OneDrive folder path exists:
   ```
   C:\Users\caspe\OneDrive\Worry Free Moving\Data Backups\AI Phone Calls\
   ```
2. Verify OneDrive is running and syncing
3. Check folder permissions

### Issue: No daily reports
**Solution:**
1. Verify `ADMIN_EMAIL` in `.env`
2. Check email service is configured
3. Look for scheduler logs: `Vapi sync scheduler initialized`

---

## Cost Breakdown

| Service | Monthly Cost | Usage-Based Cost |
|---------|-------------|------------------|
| Vapi Pay-As-You-Go | $0/month | $0.15/minute |
| Vapi Phone Number | $5-15/month | - |
| RingCentral (existing) | Current plan | - |
| **Phone Number** | **$5-15/month** | **+ $0.15/min** |

**Example Usage:**
- 100 calls/month × 5 min average = 500 minutes
- 500 min × $0.15 = $75
- Phone number: $10
- **Total: ~$85/month**

**Cost Per Call:**
- 5 minute call = $0.75
- 10 minute call = $1.50
- 15 minute call = $2.25

**ROI:** If AI books just 1-2 extra jobs per month, it pays for itself!

---

## Next Steps

1. ✅ Complete this setup guide
2. ✅ Test all call flows thoroughly
3. ✅ Update your website with the new phone number (if using direct Vapi number)
4. ✅ Train Matt and Zach on handling transferred calls
5. ✅ Monitor first week of calls closely
6. ✅ Optimize system prompt based on real conversations
7. ✅ Set up Square payment integration (optional - see SQUARE_PAYMENT_SETUP.md)

---

## Support

**Vapi Support:**
- Dashboard: [vapi.ai/dashboard](https://vapi.ai/dashboard)
- Docs: [docs.vapi.ai](https://docs.vapi.ai)
- Slack: [vapi.ai/slack](https://vapi.ai/slack)

**Technical Issues:**
- Check Render logs for errors
- Review Vapi call logs in dashboard
- Test endpoints using Postman or curl

**Questions?**
- Email: your-email@example.com
- Phone: 330-435-8686 (ask for Matt or Zach)

---

**Congratulations! Your AI phone receptionist is ready to start answering calls and booking moves! 🎉**
