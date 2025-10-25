# Sarah AI Chatbot → Booking Portal Integration Guide

## Overview

This guide explains how to integrate Sarah AI's data collection with the booking portal system, ensuring customers only need to provide payment information **once**.

---

## 🎯 Goals

1. **Send collected data** from chatbot to booking API after estimate
2. **Check for existing customers** before asking for payment info
3. **Reuse saved payment methods** for returning customers
4. **Seamless booking flow** from estimate to confirmation

---

## 📊 Current Flow

### How Sarah AI Currently Works:
```
1. Customer starts chat
2. Sarah collects: name, email, phone, addresses, service details
3. Sarah calculates estimate
4. Sarah shows estimate breakdown
5. ❌ Customer conversation ends (no booking created)
```

### New Integrated Flow:
```
1. Customer starts chat
2. Sarah collects: name, email, phone, addresses, service details
3. Sarah calculates estimate
4. Sarah shows estimate breakdown
5. ✅ "Book This Move" button appears
6. Sarah checks if customer has card on file
7a. IF returning customer: Skip card collection, book directly
7b. IF new customer: Collect card info, save for future
8. Sarah sends booking to API
9. Booking confirmed with ID
10. Customer receives email confirmation
```

---

## 🔧 Implementation Steps

### Step 1: Add Customer Lookup After Estimate

**Location:** In `sarah-ai.html`, find where the estimate is displayed to the customer.

**Add this function:**
```javascript
// Check if customer exists in Square database
async function checkExistingCustomer(email) {
    try {
        const response = await fetch(`http://localhost:3001/api/square-customer/${encodeURIComponent(email)}`);
        const data = await response.json();

        if (data.success && data.hasCard) {
            console.log('Returning customer found:', data.customer);
            return {
                exists: true,
                customer: data.customer
            };
        } else {
            console.log('New customer - will need to collect card');
            return {
                exists: false,
                customer: null
            };
        }
    } catch (error) {
        console.error('Error checking customer:', error);
        return {
            exists: false,
            customer: null
        };
    }
}
```

---

### Step 2: Add "Book This Move" Button After Estimate

**Location:** After showing the price breakdown, add booking options.

**Add this button to the chat:**
```javascript
function showBookingOptions() {
    const bookingHTML = `
        <div class="booking-actions" style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
            <h3 style="margin-bottom: 15px;">Ready to book?</h3>
            <button onclick="initiateBooking()"
                    style="width: 100%; padding: 15px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                           color: white; border: none; border-radius: 25px; font-size: 18px; font-weight: 600;
                           cursor: pointer; margin-bottom: 10px;">
                📅 Book This Move
            </button>
            <button onclick="modifyEstimate()"
                    style="width: 100%; padding: 12px; background: #6c757d; color: white; border: none;
                           border-radius: 25px; font-size: 16px; cursor: pointer;">
                ✏️ Modify Details
            </button>
        </div>
    `;

    // Append to last bot message
    const lastMessage = document.querySelector('.bot-message:last-child');
    if (lastMessage) {
        lastMessage.insertAdjacentHTML('beforeend', bookingHTML);
    }
}
```

---

### Step 3: Implement Booking Flow

**Add this main booking function:**
```javascript
async function initiateBooking() {
    try {
        showBotMessage('Great! Let me check if you already have a card on file...');

        // Check if customer exists
        const customerCheck = await checkExistingCustomer(chatState.data.email);

        if (customerCheck.exists) {
            // Returning customer - skip card collection
            showBotMessage(`Welcome back, ${chatState.data.firstName}! I found your saved payment method ending in ****${customerCheck.customer.cardLast4}.`);
            showBotMessage('I\'ll use this card for the deposit. Processing your booking now...');

            // Send booking directly
            await sendBookingToAPI(customerCheck.customer.squareCustomerId);
        } else {
            // New customer - need to collect card
            showBotMessage('I\'ll need to collect your payment information to secure your booking. This will only take a moment.');
            await collectPaymentInfo();
        }
    } catch (error) {
        console.error('Error initiating booking:', error);
        showBotMessage('I\'m having trouble processing your booking. Please try again or call us at 330-435-8686.');
    }
}
```

---

### Step 4: Send Booking to API

**Add this function to send collected data:**
```javascript
async function sendBookingToAPI(squareCustomerId = null) {
    try {
        // Prepare booking data from chatState
        const bookingData = {
            // Customer info
            firstName: chatState.data.firstName,
            lastName: chatState.data.lastName,
            email: chatState.data.email,
            phone: chatState.data.phone,

            // Service details
            serviceType: getServiceTypeName(chatState.serviceType),
            pickupAddress: chatState.data.pickupAddress,
            dropoffAddress: chatState.data.dropoffAddress,

            // Move details
            date: chatState.data.selectedDate || 'TBD',
            time: chatState.data.selectedTime || 'TBD',

            // Estimate details
            estimateDetails: {
                subtotal: chatState.data.estimate?.subtotal || 0,
                fees: chatState.data.estimate?.fees || {},
                total: chatState.data.estimate?.total || 0,
                breakdown: chatState.data.estimate?.breakdown || {}
            },

            // Notes (combine all collected info)
            notes: buildNotesFromChatState(),

            // Payment info (if customer exists)
            payment: squareCustomerId ? {
                squareCustomerId: squareCustomerId,
                hasCardOnFile: true
            } : {
                hasCardOnFile: false
            }
        };

        // Send to booking API
        const response = await fetch('http://localhost:3001/api/book-appointment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookingData)
        });

        const data = await response.json();

        if (data.success) {
            showBookingSuccess(data.bookingId);
        } else {
            throw new Error(data.error || 'Booking failed');
        }
    } catch (error) {
        console.error('Error sending booking:', error);
        showBotMessage('I couldn\'t complete your booking. Please call us at 330-435-8686 and mention your estimate.');
    }
}

// Helper function to get friendly service name
function getServiceTypeName(type) {
    const serviceNames = {
        'moving': 'Full Service Moving',
        'labor': 'Labor Only',
        'single': 'Single Item Move',
        'cleanout': 'Cleanout Service'
    };
    return serviceNames[type] || 'Moving Service';
}

// Helper function to build detailed notes
function buildNotesFromChatState() {
    let notes = [];

    if (chatState.data.bedrooms) {
        notes.push(`Bedrooms: ${chatState.data.bedrooms}`);
    }
    if (chatState.data.floors) {
        notes.push(`Floors at pickup: ${chatState.data.floors}, Floors at dropoff: ${chatState.data.deliveryFloors || 'N/A'}`);
    }
    if (chatState.data.hasElevator !== undefined) {
        notes.push(`Elevator: ${chatState.data.hasElevator ? 'Yes' : 'No'}`);
    }
    if (chatState.data.distance) {
        notes.push(`Distance: ${chatState.data.distance} miles`);
    }
    if (chatState.data.specialItems) {
        notes.push(`Special items: ${chatState.data.specialItems}`);
    }
    if (chatState.data.appliances && chatState.data.appliances.length > 0) {
        notes.push(`Appliances: ${chatState.data.appliances.join(', ')}`);
    }
    if (chatState.data.shopEquipment && chatState.data.shopEquipment.length > 0) {
        notes.push(`Shop equipment: ${chatState.data.shopEquipment.map(i => i.name).join(', ')}`);
    }
    if (chatState.data.oversizedFurniture && chatState.data.oversizedFurniture.length > 0) {
        notes.push(`Oversized furniture: ${chatState.data.oversizedFurniture.map(i => i.name).join(', ')}`);
    }
    if (chatState.data.packingNeeded) {
        notes.push(`Packing needed: ${chatState.data.packingNeeded}`);
    }
    if (chatState.data.notes) {
        notes.push(`Customer notes: ${chatState.data.notes}`);
    }

    return notes.join(' | ');
}
```

---

### Step 5: Success Message

**Show confirmation after booking:**
```javascript
function showBookingSuccess(bookingId) {
    const successHTML = `
        <div class="booking-success" style="padding: 25px; background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
                                           border-radius: 15px; margin: 20px 0; text-align: center;">
            <div style="font-size: 60px; margin-bottom: 15px;">✅</div>
            <h2 style="color: #155724; margin-bottom: 15px;">Booking Confirmed!</h2>
            <div style="background: white; padding: 15px; border-radius: 10px; margin: 15px 0;">
                <strong>Booking ID:</strong> <span style="color: #007bff; font-size: 20px; font-weight: 700;">${bookingId}</span>
            </div>
            <p style="margin: 15px 0; color: #155724;">
                📧 You'll receive a confirmation email shortly with all the details.<br>
                📞 We'll call you 24 hours before your move.
            </p>
            <hr style="border: 1px solid #28a745; margin: 20px 0;">
            <p style="font-size: 14px; color: #155724;">
                Questions? Call us at <strong>330-435-8686</strong>
            </p>
        </div>
    `;

    showBotMessage(successHTML, true); // true = allow HTML

    // Reset chat state for next conversation
    setTimeout(() => {
        if (confirm('Would you like to start a new conversation?')) {
            resetChat();
        }
    }, 3000);
}
```

---

## 🔐 Payment Collection Logic

### For New Customers Only

**When collecting card info, use existing Square Web SDK:**
```javascript
async function collectPaymentInfo() {
    // Your existing Square payment modal code here
    // After card is tokenized and saved via Vercel API:

    const cardSaved = await saveCardToSquare(cardToken);

    if (cardSaved.success) {
        showBotMessage('✅ Payment method saved successfully!');
        await sendBookingToAPI(cardSaved.customerId);
    } else {
        showBotMessage('There was an issue saving your payment method. Please try again.');
    }
}

async function saveCardToSquare(cardToken) {
    try {
        const response = await fetch(
            'https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app/api/square-customer',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceId: cardToken,
                    customer: {
                        firstName: chatState.data.firstName,
                        lastName: chatState.data.lastName,
                        email: chatState.data.email,
                        phone: chatState.data.phone
                    }
                })
            }
        );

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error saving card:', error);
        return { success: false };
    }
}
```

---

## 📝 Database Schema Update

**Update appointments.json to include payment info:**
```json
{
    "bookingId": "WFM-123456",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "330-555-1234",
    "serviceType": "Full Service Moving",
    "pickupAddress": "123 Main St, Akron OH",
    "dropoffAddress": "456 Oak Ave, Canton OH",
    "date": "2025-11-01",
    "time": "10:00",
    "estimateDetails": {
        "subtotal": 400.00,
        "fees": {
            "driveTime": 50.00,
            "tolls": 0
        },
        "total": 450.00
    },
    "notes": "Bedrooms: 3 | Floors: 2 | Distance: 25 miles",
    "payment": {
        "squareCustomerId": "CUST-ABC123",
        "hasCardOnFile": true,
        "cardBrand": "VISA",
        "cardLast4": "1234"
    },
    "status": "confirmed",
    "createdAt": "2025-10-24T10:30:00Z",
    "source": "chatbot"
}
```

---

## 🚀 Testing Checklist

### Test Case 1: New Customer Flow
- [ ] Chat collects all information
- [ ] Estimate displays correctly
- [ ] "Book This Move" button appears
- [ ] System checks for existing customer (returns false)
- [ ] Payment modal appears
- [ ] Customer enters card info
- [ ] Card is saved via Vercel API
- [ ] Booking is created in local system
- [ ] Confirmation email sent
- [ ] Success message displayed with booking ID

### Test Case 2: Returning Customer Flow
- [ ] Chat collects all information
- [ ] System checks email (finds existing customer)
- [ ] Message shows "Welcome back! Card ending in ****1234"
- [ ] **Payment modal is skipped**
- [ ] Booking created immediately
- [ ] Confirmation email sent
- [ ] Success message displayed

### Test Case 3: Error Handling
- [ ] If API is down, show friendly error
- [ ] If card save fails, allow retry
- [ ] If booking fails, provide phone number

---

## 🎨 UI Enhancements (Optional)

### Add Visual Indicator for Card on File
```javascript
function showReturningCustomerBadge(cardLast4) {
    return `
        <div style="display: inline-flex; align-items: center; padding: 8px 15px;
                    background: #28a745; color: white; border-radius: 20px; font-size: 14px;">
            <span style="margin-right: 5px;">💳</span>
            <span>Card on file: ****${cardLast4}</span>
        </div>
    `;
}
```

---

## 📊 Benefits of This Integration

### For Customers:
✅ Faster checkout for returning customers
✅ Only enter card info once
✅ Seamless flow from quote to booking
✅ Automatic email confirmations
✅ Booking ID for reference

### For Your Business:
✅ More conversions (easier to book)
✅ Better customer data centralization
✅ Payment info secured in Square
✅ Reduced friction in booking process
✅ All bookings tracked in one system

---

## 🔒 Security Notes

### ✅ What's Secure:
- Card data never touches your servers
- PCI compliance via Square Web SDK
- Tokenization before transmission
- Square customer IDs stored (not card numbers)
- HTTPS for all API calls

### ⚠️ Important:
- **Never log** full credit card numbers
- **Never store** CVV codes
- **Always use** Square's tokenization
- **Keep** Square access token on backend only

---

## 🎯 Next Steps

### Immediate (This Session):
1. Test customer lookup endpoint: `GET /api/square-customer/:email`
2. Add "Book This Move" button after estimate in sarah-ai.html
3. Implement customer check before payment collection
4. Add booking data transmission to API

### Short Term:
1. Update admin portal to show payment info
2. Add ability to charge saved cards
3. Payment tracking per booking
4. Deposit vs final payment workflow

### Future Enhancements:
1. Automatic deposit collection when booking
2. Final payment reminder 24 hours before move
3. Refund capability in admin portal
4. Payment analytics and reporting

---

## 📞 Support

**If you encounter issues:**
1. Check browser console for errors
2. Verify API endpoints are responding
3. Test Square integration independently
4. Contact Square support for payment issues

**Your Vercel Backend:**
- URL: https://worry-free-chatbot-git-master-matt-5184s-projects.vercel.app
- Endpoint: /api/square-customer

**Local Booking API:**
- URL: http://localhost:3001
- Endpoints:
  - POST /api/book-appointment
  - GET /api/square-customer/:email

---

## ✅ Summary

**What Changed:**
1. Added customer lookup endpoint in server.js
2. Chatbot now sends bookings to API after estimate
3. System checks for saved payment methods
4. Returning customers skip card collection
5. All bookings centralized in booking system

**Customer Experience:**
```
First Time:     Quote → Enter Card → Book → Confirmed ✅
Returning:      Quote → Book → Confirmed ✅ (No card entry!)
```

This creates a **seamless, conversion-optimized booking flow** while maintaining **PCI compliance and security**. 🎉
