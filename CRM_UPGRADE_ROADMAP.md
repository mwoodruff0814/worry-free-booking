# 🚀 Worry Free Moving - CRM Upgrade Roadmap

## Project Overview
Transform the booking system into a comprehensive Customer Relationship Management (CRM) platform with Square payments, calendar management, and customizable communications.

---

## 📋 Phase 1: Data Structure Reorganization (CURRENT)

### **Objective:** Separate building features from special items

### **Changes:**
**OLD Structure:**
```javascript
specialItems: {
    hasSafe: true,
    hasPiano: true,
    hasHeavyItems: true,
    hasStairs: true  // ❌ This is building data, not an item!
}
```

**NEW Structure:**
```javascript
buildingInfo: {
    pickup: {
        hasStairs: true,
        hasElevator: false,
        floors: 2
    },
    dropoff: {
        hasStairs: false,
        hasElevator: true,
        floors: 5
    }
},
specialItems: {
    hasSafe: true,
    hasPiano: true,
    hasHeavyItems: true,
    hasPoolTable: false
}
```

### **Status:** ✅ Configuration added, implementation pending

---

## 💳 Phase 2: Square Payment Integration

### **Objective:** Full payment processing with Square Terminal and card on file

### **Features to Build:**

#### **1. Square API Setup**
- [ ] Get Square Developer credentials
- [ ] Install Square SDK: `npm install square`
- [ ] Configure sandbox/production environments

#### **2. Customer Card on File**
```javascript
customer: {
    squareCustomerId: "CUST-123",
    cardOnFile: {
        cardBrand: "VISA",
        last4: "1234",
        expiryMonth: 12,
        expiryYear: 2025
    }
}
```

#### **3. Admin Terminal Payment**
- Manual keypad entry
- Terminal reader integration
- Receipt generation

#### **4. Payment Endpoints Needed:**
- `POST /api/payments/create-customer` - Create Square customer
- `POST /api/payments/save-card` - Save card on file
- `POST /api/payments/charge` - Process payment
- `POST /api/payments/terminal` - Terminal payment
- `GET /api/payments/history/:customerId` - Payment history

### **Square Setup Instructions:**

1. **Create Square Developer Account:**
   - Go to https://developer.squareup.com/
   - Sign up for developer account
   - Create new application

2. **Get Credentials:**
   - Sandbox Access Token (for testing)
   - Production Access Token (for live)
   - Location ID

3. **Update .env file:**
```env
SQUARE_ACCESS_TOKEN=your_actual_token_here
SQUARE_LOCATION_ID=your_location_id_here
SQUARE_ENVIRONMENT=sandbox  # or 'production'
```

### **Status:** ⏳ Configuration ready, implementation pending

---

## 📅 Phase 3: Calendar Availability System

### **Objective:** Customizable calendar with time slot management

### **Features:**

#### **1. Admin Calendar Settings**
```javascript
calendarSettings: {
    workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
    startTime: "08:00",
    endTime: "18:00",
    slotDuration: 60, // minutes
    maxBookingsPerDay: 5,
    blackoutDates: ["2025-12-25", "2025-01-01"],
    buffer: 30 // minutes between jobs
}
```

#### **2. Features:**
- Visual calendar in admin portal
- Drag-and-drop rescheduling
- Block out dates/times
- Set crew capacity
- Automatic conflict detection
- Google Calendar sync

#### **3. Endpoints Needed:**
- `GET /api/calendar/availability` - Get available slots
- `POST /api/calendar/settings` - Update calendar settings
- `GET /api/calendar/bookings/:date` - Get bookings for date
- `POST /api/calendar/block` - Block time slots

### **Status:** ⏳ Planned

---

## 📄 Phase 4: BOL Generation (Admin Only)

### **Objective:** Generate Bill of Lading with company branding

### **Features:**

#### **1. BOL Template:**
- Company logo and information
- Auto-fill customer data from booking
- Inventory list
- Terms and conditions
- Digital signature capture
- PDF generation

#### **2. Data Required:**
```javascript
bol: {
    bolNumber: "BOL-2025-001",
    company: {
        name: "Worry Free Moving",
        address: "123 Business St",
        phone: "330-435-8686",
        license: "MC-123456"
    },
    customer: {
        // Auto-filled from booking
    },
    inventory: [
        { item: "Sofa", quantity: 1, condition: "Good" },
        { item: "Boxes", quantity: 20, condition: "New" }
    ],
    signatures: {
        customer: "base64_signature",
        driver: "base64_signature"
    }
}
```

#### **3. Admin Portal Section:**
- BOL generation button in booking details
- Edit inventory before generating
- Print/Download PDF
- Email to customer
- Store in customer record

### **Status:** ⏳ Planned

---

## 📧 Phase 5: Customizable Communications

### **Objective:** Admin-controlled email/SMS templates

### **Features:**

#### **1. Message Templates:**
```javascript
templates: {
    booking_confirmation: {
        subject: "Booking Confirmed - {{date}}",
        sms: "Hi {{firstName}}! Your move is confirmed for {{date}}...",
        email: "<html>...</html>"
    },
    reminder_24hr: {
        subject: "Reminder: Move Tomorrow",
        sms: "Reminder: Your move is tomorrow {{date}}...",
        email: "<html>...</html>"
    },
    payment_receipt: {
        subject: "Payment Receipt",
        email: "<html>...</html>"
    },
    follow_up: {
        subject: "How was your move?",
        email: "<html>...</html>",
        sendAfter: 2 // days after move
    }
}
```

#### **2. Template Variables:**
- `{{firstName}}` `{{lastName}}`
- `{{date}}` `{{time}}`
- `{{companyName}}`
- `{{bookingId}}`
- `{{price}}`
- etc.

#### **3. Admin Template Editor:**
- Rich text editor for emails
- Preview before sending
- Test send feature
- Schedule automatic sends
- Track open/click rates

### **Status:** ⏳ Planned

---

## 🎯 Phase 6: Full CRM Features

### **Objective:** Complete customer relationship management

### **Features:**

#### **1. Customer Profiles:**
- Contact history
- Booking history
- Payment history
- Notes and tags
- Communication log
- Documents (BOL, receipts)

#### **2. Dashboard:**
- Revenue analytics
- Booking trends
- Customer lifetime value
- Payment status overview
- Upcoming appointments calendar
- Task management

#### **3. Reporting:**
- Monthly revenue reports
- Customer acquisition
- Service type breakdown
- Geographic heat map
- Crew utilization

#### **4. Automation:**
- Auto-send reminders
- Follow-up emails
- Birthday/anniversary messages
- Review requests
- Re-booking campaigns

### **Status:** ⏳ Planned

---

## 🤖 Phase 7: Sarah Chatbot Integration

### **Objective:** Consistent data flow between Sarah and booking system

### **Requirements:**

#### **1. Matching Questions:**
Sarah's questions must match booking form structure:

**Sarah asks:**
- "Where are you moving FROM? Are there stairs or an elevator?"
- "Where are you moving TO? Are there stairs or an elevator?"
- "Do you have any special items? (Safe, Piano, Heavy Furniture, Pool Table)"

**Booking form collects:**
```javascript
{
    pickupAddress: "123 Main St",
    pickupBuildingInfo: {
        hasStairs: true,
        hasElevator: false
    },
    dropoffAddress: "456 Oak Ave",
    dropoffBuildingInfo: {
        hasStairs: false,
        hasElevator: true
    },
    specialItems: {
        hasSafe: false,
        hasPiano: true,
        hasHeavyItems: true,
        hasPoolTable: false
    }
}
```

#### **2. Data Transfer:**
- Sarah collects data → Sends to booking API
- Booking API creates appointment
- Returns booking ID to Sarah
- Sarah confirms with customer

#### **3. API Endpoint:**
```javascript
POST /api/chatbot/booking
{
    source: "sarah",
    customerData: {...},
    buildingInfo: {...},
    specialItems: {...}
}
```

### **Status:** ⏳ Planned

---

## 📦 Dependencies to Install

```bash
npm install square
npm install pdfkit  # For BOL generation
npm install nodemailer-html-to-text
npm install ejs  # For email templates
npm install moment-timezone
npm install agenda  # For scheduled tasks
```

---

## 🗄️ Database Enhancements

### **New Data Files:**
```
data/
├── appointments.json          # Existing
├── customers.json             # NEW - Customer profiles
├── payments.json              # NEW - Payment history
├── templates.json             # NEW - Message templates
├── calendar-settings.json     # NEW - Calendar config
├── bols.json                  # NEW - BOL records
└── communications.json        # NEW - Communication log
```

---

## 🚦 Implementation Priority

### **HIGH PRIORITY (Do First):**
1. ✅ Square API configuration (Done)
2. Data structure reorganization (building info)
3. Square payment integration
4. BOL generation in admin portal

### **MEDIUM PRIORITY:**
5. Calendar availability system
6. Customizable email/SMS templates
7. Customer profiles

### **LOWER PRIORITY (Polish):**
8. Full CRM analytics
9. Automation workflows
10. Advanced reporting

---

## 📝 Next Steps

### **Immediate Actions:**

1. **Get Square Credentials:**
   - Sign up at https://developer.squareup.com/
   - Create application
   - Get sandbox credentials for testing
   - Update .env file

2. **Update Company Info in .env:**
   - Edit company name, address, phone
   - Add license number
   - Verify all details

3. **Decide on Priorities:**
   - Which features do you need first?
   - What's your timeline?

### **Development Sessions:**
Each major phase will require a dedicated development session:
- **Session 1:** Data structure + Square basics (2-3 hours)
- **Session 2:** Payment integration + card on file (2-3 hours)
- **Session 3:** Calendar system (2-3 hours)
- **Session 4:** BOL generation (2-3 hours)
- **Session 5:** Template customization (2-3 hours)
- **Session 6:** Full CRM features (3-4 hours)

---

## 💡 Notes

- **Current system is production-ready** for basic booking
- **This roadmap transforms it** into enterprise CRM
- **Each phase can be deployed independently**
- **Backward compatible** - won't break existing bookings
- **Progressive enhancement** - add features incrementally

---

## 🔗 Resources

- Square API Docs: https://developer.squareup.com/docs
- Square Node SDK: https://github.com/square/square-nodejs-sdk
- Square Terminal API: https://developer.squareup.com/docs/terminal-api/overview
- Calendar Integration: https://fullcalendar.io/
- PDF Generation: http://pdfkit.org/

---

## 📞 Support

This is your roadmap to a world-class CRM system. We'll build this systematically, testing each phase before moving to the next.

**Ready to start?** Let's begin with Square API setup and data restructuring!
