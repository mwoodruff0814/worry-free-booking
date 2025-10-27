# Vapi AI Phone Receptionist - Quick Reference

## Key Phone Numbers
- **Main Business Line:** 330-435-8686 (RingCentral)
- **Vapi AI Number:** *(Set during setup)*
- **Transfer Destination:** +13304358686 (RingCentral)

## Common Customer Phrases & AI Responses

### Getting a Quote
**Customer:** "How much does it cost to move?"
**AI:** Asks questions about home size, addresses, move type, special items, stairs
**Result:** Generates instant quote using pricing engine

### Booking a Move
**Customer:** "I'd like to schedule a move"
**AI:** Checks availability → Collects info → Books appointment
**Result:** Calendar event created, confirmation email sent

### Transferring to Human
**Customer says any of:**
- "I want to speak to someone"
- "Can I talk to a real person?"
- "This isn't working"
- AI detects frustration

**AI Response:** "I understand. Let me connect you with one of our moving specialists..."
**Result:** Transfers to RingCentral → Rings Matt/Zach

### Payment
**Customer:** "How do I pay?"
**AI:** "We accept cash, credit cards, and Venmo. I can text you a secure payment link right now if you'd like."
**Result:** Sends Square payment link via SMS

## API Endpoints

### Test Vapi Integration
```bash
GET https://your-app-name.onrender.com/api/vapi/test
```
Response:
```json
{
  "success": true,
  "message": "Vapi integration is active",
  "configured": true
}
```

### View Today's Call Summary
```bash
GET https://your-app-name.onrender.com/api/vapi/summary
```

### View Specific Date Summary
```bash
GET https://your-app-name.onrender.com/api/vapi/summary/2024-12-15
```

### Manually Trigger OneDrive Sync
```bash
POST https://your-app-name.onrender.com/api/vapi/sync
```

## Vapi Dashboard Quick Links

- **View Call Logs:** https://vapi.ai/dashboard/calls
- **Edit Assistant:** https://vapi.ai/dashboard/assistants
- **Phone Numbers:** https://vapi.ai/dashboard/phone-numbers
- **Billing:** https://vapi.ai/dashboard/billing
- **Usage Analytics:** https://vapi.ai/dashboard/analytics

## Call Data Storage

### Local Server Storage
```
worry-free-booking/data/vapi-calls/
  ├── call-2024-12-15T10-30-00-abc123.json
  ├── call-2024-12-15T14-22-15-def456.json
  └── ...
```

### OneDrive Backup (Auto-sync every 6 hours)
```
C:\Users\caspe\OneDrive\Worry Free Moving\Data Backups\AI Phone Calls\
  ├── call-2024-12-15T10-30-00-abc123.json
  ├── call-2024-12-15T14-22-15-def456.json
  └── ...
```

## Pricing Configuration

Current rates (edit in `services/vapiService.js`):

```javascript
hourlyRates: {
    '2-movers': $150/hour
    '3-movers': $200/hour
    '4-movers': $250/hour
}

travelFee: $2.50 per mile (free first 10 miles)
packingRate: $50/hour per person
stairsFee: $50 per flight

specialItems: {
    piano: $150
    gun-safe: $100
    hot-tub: $200
    antiques: $75
    pool-table: $125
}
```

## Automated Tasks

### Every 6 Hours (00:00, 06:00, 12:00, 18:00 EST)
✅ Sync call data to OneDrive
✅ Backup recordings and transcripts

### Daily at 11:59 PM EST
✅ Generate daily call summary
✅ Email report to admin
✅ Calculate performance metrics

## Performance Metrics

The system tracks:
- **Total Calls** - All inbound calls received
- **Quotes Generated** - Successful quote calculations
- **Bookings Made** - Appointments scheduled
- **Transfers to Human** - Calls escalated to staff
- **Average Duration** - Mean call length in seconds
- **Conversion Rate** - Bookings ÷ Total Calls
- **Self-Service Rate** - (Total Calls - Transfers) ÷ Total Calls

## What Gets Created When AI Books an Appointment?

1. ✅ **MongoDB Record** - Appointment saved to database
2. ✅ **Google Calendar Event** - Synced to Matt & Zach's calendars
3. ✅ **Central Admin Calendar** - Shows in admin portal
4. ✅ **Customer Record** - Auto-created in CRM if new
5. ✅ **Confirmation Email** - Sent to customer
6. ✅ **Company Notification** - Email to office
7. ✅ **Booking ID** - Unique ID (e.g., WF-1234567890-ABC123)
8. ✅ **Call Recording** - Saved with booking reference

## Common Scenarios

### Scenario 1: Customer wants a simple quote
1. AI asks 6-8 questions (3 minutes)
2. Generates quote instantly
3. Emails quote to customer
4. Call ends
**Total time:** ~3-4 minutes

### Scenario 2: Customer books a move
1. AI generates quote (3 minutes)
2. Customer agrees to price
3. AI collects name, email, phone (2 minutes)
4. Checks availability
5. Books appointment
6. Sends confirmation
**Total time:** ~6-8 minutes

### Scenario 3: Complex request (transfer)
1. Customer asks about specialty item (piano)
2. AI attempts to help (2 minutes)
3. Realizes it needs human expertise
4. Says: "Let me connect you with our specialist..."
5. Transfers to RingCentral
**Total time before transfer:** ~2-3 minutes

## Call Quality Checks

After first 10 calls, review:
- [ ] Is AI greeting professional and friendly?
- [ ] Does AI ask all necessary quote questions?
- [ ] Are quoted prices accurate?
- [ ] Do bookings appear correctly in calendar?
- [ ] Are confirmations emailed promptly?
- [ ] Do transfers work smoothly?
- [ ] Is call quality clear (no static/lag)?

## Optimization Tips

1. **Review transcripts weekly** - Look for common confusion points
2. **Update system prompt** - Add FAQs based on real questions
3. **Adjust pricing** - Keep rates current in vapiService.js
4. **Monitor conversion rate** - Target >30% bookings per call
5. **Check transfer reasons** - Reduce unnecessary transfers

## Emergency Actions

### Disable AI (Route All Calls to RingCentral)
1. Log into Vapi Dashboard
2. Go to Phone Numbers
3. Click your number
4. Change "Fallback Number" to +13304358686
5. Pause assistant

### Re-enable AI
1. Vapi Dashboard → Phone Numbers
2. Re-assign assistant to your number
3. Test with a call

### View Live Calls
Vapi Dashboard → Calls → Filter: "In Progress"

## Support Contacts

**Vapi Technical Support:**
- Email: support@vapi.ai
- Slack: vapi.ai/slack
- Docs: docs.vapi.ai

**Your System:**
- Server: Render.com dashboard
- Database: MongoDB Atlas
- Logs: Check Render deployment logs

## Success Checklist

After setup, verify:
- [ ] AI answers calls within 2 rings
- [ ] Voice is clear and natural
- [ ] Quotes are accurate
- [ ] Bookings sync to calendar immediately
- [ ] Confirmation emails arrive within 1 minute
- [ ] Transfers connect to RingCentral
- [ ] Daily reports arrive via email
- [ ] OneDrive syncs every 6 hours
- [ ] No errors in Render logs
- [ ] Vapi dashboard shows all calls

---

**Pro Tip:** Keep this reference handy during your first week of operation. Review call logs daily to spot areas for improvement!
