# Worry Free Moving - Claude AI Skills

This directory contains specialized Claude AI skills for the Worry Free Moving voice AI system.

---

## Available Skills

### 1. Voice AI Assistant (`voice-ai-assistant.md`)
**Purpose**: Generic reusable Claude AI capabilities for any application

**Skills Included**:
- Extract structured data from natural speech
- Generate human-like conversational responses
- Detect customer intent
- Validate and clean data
- Summarize conversations
- Handle multi-turn conversations

**Use Case**: Building blocks for any AI-powered conversational system

---

### 2. Worry Free Moving Agent (`worry-free-moving-agent.md`)
**Purpose**: Complete AI receptionist agent for Worry Free Moving

**Includes**:
- Agent personality (Sarah, friendly receptionist)
- Complete call flow protocol
- Address, date, name, email parsing
- Natural response generation
- Transfer protocols
- Error handling

**Use Case**: Primary skill for voice AI phone system - defines entire agent behavior

---

### 3. Pricing Calculator (`worry-free-pricing.md`)
**Purpose**: Exact pricing calculations following Worry Free Moving's pricing model

**Includes**:
- Moving service pricing formula
- Labor-only pricing formula
- Distance-based dynamic rates
- Crew size pricing impact
- Service charges calculation
- Examples and test cases

**Use Case**: Ensure accurate, consistent pricing across all channels (phone, chatbot, admin portal)

---

### 4. Calendar & Scheduling (`worry-free-calendar.md`)
**Purpose**: Calendar availability checking and booking creation

**Includes**:
- Google Calendar integration
- Availability checking (morning/afternoon slots)
- Booking creation workflow
- MongoDB document structure
- Confirmation emails and SMS
- Rescheduling and cancellation

**Use Case**: Calendar-aware booking system with double-booking prevention

---

## Quick Start

### For Voice AI Development:
```javascript
// Import Claude AI service
const claude = require('./services/claudeAI');

// Extract customer data
const address = await claude.extractData(speech, 'address');
const date = await claude.extractData(speech, 'date');

// Generate natural response
const response = await claude.generateResponse('confirmation', {
    action: 'address received',
    address: address.data
});
```

### For Pricing Calculations:
```javascript
// Calculate accurate quote
const quote = await axios.post('/api/calculate-estimate', {
    serviceType: "2-Person Crew Moving",
    distance: 25.3,
    numMovers: 2,
    hours: 4
});
```

### For Calendar Booking:
```javascript
// Check availability
const availability = await checkCalendarAvailability('2024-12-01');

// Create booking if available
if (!availability.fullyBooked) {
    const booking = await createCompleteBooking(bookingData);
}
```

---

## Skill Usage by Component

### Voice AI Phone System (`services/twilioSmartVoice.js`)
**Uses**:
- ✅ Worry Free Moving Agent skill (complete call flow)
- ✅ Voice AI Assistant skill (data extraction, response generation)
- ✅ Pricing Calculator skill (quote calculations)
- ✅ Calendar & Scheduling skill (availability checking, booking)

### Chatbot
**Uses**:
- ✅ Voice AI Assistant skill (intent detection, data extraction)
- ✅ Pricing Calculator skill (instant quotes)
- ✅ Calendar & Scheduling skill (booking creation)

### Admin Portal
**Uses**:
- ✅ Pricing Calculator skill (manual quote creation)
- ✅ Calendar & Scheduling skill (view/manage bookings)

---

## Environment Variables Required

```bash
# Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+13306619985
TRANSFER_NUMBER=+13307542648

# Google Services
GOOGLE_MAPS_API_KEY=AIza...
GOOGLE_CALENDAR_CLIENT_EMAIL=service-account@...
GOOGLE_CALENDAR_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...

# Database
MONGODB_URI=mongodb+srv://...

# Server
BASE_URL=https://worry-free-booking.onrender.com
```

---

## Skill Development Guidelines

### When to Create a New Skill:
1. Reusable logic across multiple components
2. Complex business rules that need documentation
3. External API integrations
4. Domain-specific knowledge (pricing, scheduling, etc.)

### Skill File Format:
```markdown
# Skill Name

**Purpose**: Brief description

## Section 1: Configuration
[Configuration details]

## Section 2: Usage
[Code examples]

## Section 3: Integration
[How to use in different components]

## Version
**Version**: X.X
**Last Updated**: YYYY-MM-DD
```

---

## Testing Skills

### Test Voice AI Assistant:
```javascript
const claude = require('./services/claudeAI');

async function testExtraction() {
    const tests = [
        { speech: "123 main canton", type: "address" },
        { speech: "next friday", type: "date" },
        { speech: "john at gmail dot com", type: "email" }
    ];

    for (const test of tests) {
        const result = await claude.extractData(test.speech, test.type);
        console.log(`${test.type}:`, result.data);
    }
}

testExtraction();
```

### Test Pricing:
```javascript
async function testPricing() {
    const testCases = [
        { serviceType: "2-Person Crew Moving", distance: 10, numMovers: 2, hours: 4 },
        { serviceType: "3-Person Crew Moving", distance: 25, numMovers: 3, hours: 4 },
        { serviceType: "Labor Only", distance: 15, numMovers: 2, hours: 3 }
    ];

    for (const test of testCases) {
        const quote = await calculateEstimate(test);
        console.log(`${test.serviceType} (${test.distance}mi):`, quote.estimate);
    }
}
```

### Test Calendar:
```javascript
async function testCalendar() {
    const date = '2024-12-15';

    // Check availability
    const availability = await checkCalendarAvailability(date);
    console.log('Availability:', availability);

    // Create test booking
    if (!availability.fullyBooked) {
        const booking = await createCompleteBooking({
            date: date,
            timeSlot: 'morning',
            // ... other booking data
        });
        console.log('Booking created:', booking.bookingId);
    }
}
```

---

## Integration Flow

```
┌─────────────────────────────────────────────────────┐
│                 Customer Calls                      │
│                 (330) 661-9985                      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│        Worry Free Moving Agent Skill                │
│        (Call flow, personality, protocols)          │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ Voice AI     │ │ Pricing  │ │ Calendar     │
│ Assistant    │ │ Skill    │ │ Skill        │
│              │ │          │ │              │
│ - Extract    │ │ - Quote  │ │ - Check      │
│   data       │ │   calc   │ │   available  │
│ - Generate   │ │ - Exact  │ │ - Create     │
│   responses  │ │   rates  │ │   booking    │
└──────────────┘ └──────────┘ └──────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │   Booking Complete    │
          │   - MongoDB saved     │
          │   - Calendar updated  │
          │   - Emails sent       │
          │   - SMS payment link  │
          └───────────────────────┘
```

---

## Cost Breakdown

### Per Call (5 minutes average):
- **Claude AI**: ~$0.008-0.015
  - 3-5 data extractions: ~$0.005
  - 5-8 response generations: ~$0.010
- **Google Maps API**: ~$0.005
- **Twilio Voice**: ~$0.40-0.45
- **SMS**: ~$0.01

**Total**: ~$0.42-0.48 per call with booking

### Monthly (100 bookings):
- **Total Cost**: ~$42-48/month
- **Savings vs Vapi**: 70% cheaper ($85/month)

---

## Skill Versions

| Skill                  | Version | Last Updated | Status |
|------------------------|---------|--------------|--------|
| Voice AI Assistant     | 1.0     | 2024-10-26   | Stable |
| WF Moving Agent        | 4.0     | 2024-10-26   | Stable |
| Pricing Calculator     | 2.0     | 2024-10-26   | Stable |
| Calendar & Scheduling  | 1.0     | 2024-10-26   | Stable |

---

## Troubleshooting

### Common Issues:

**Claude Extraction Failing**:
- Check `ANTHROPIC_API_KEY` is set
- Review console logs for `🧠 Claude extracted:` messages
- Verify JSON parsing (check for markdown code blocks)

**Pricing Doesn't Match**:
- Verify distance is exact (not estimated)
- Check `/api/calculate-estimate` endpoint is being called
- Compare with admin portal pricing

**Calendar Booking Fails**:
- Check Google Calendar credentials
- Verify MongoDB connection
- Check date format (YYYY-MM-DD)
- Review availability checking logic

---

## Support

**Issues**: Check Render logs for error messages
**Testing**: Call (330) 661-9985 for live testing
**Documentation**: Each skill file contains detailed examples

---

## Future Skills

Potential skills to add:
- ✨ **Customer Lookup**: Check existing customer records
- ✨ **SMS Follow-up**: Automated reminder system
- ✨ **Review Requests**: Post-move review collection
- ✨ **Analytics**: Call performance tracking
- ✨ **Multi-language**: Spanish language support

---

**Last Updated**: 2024-10-26
**Maintained By**: Worry Free Moving Development Team
