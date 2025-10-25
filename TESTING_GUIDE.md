# Complete System Testing Guide

## Overview

This guide will help you test the complete flow from Sarah AI chatbot → Square payment → Booking system integration.

---

## ✅ What's Been Updated

### 1. **Stair Pricing (Cost)**
- **Apartment stairs:** $35/flight
- **House stairs:** $25/flight
- **Labor service:** $35/flight (assumes apartments)
- **Single item:** $35/flight (assumes apartments)

### 2. **Stair Time Estimates**
- **Apartment stairs:** 21 minutes per flight (0.35 hours)
- **House stairs:** 16.5 minutes per flight (0.275 hours)
- More accurate time estimates = better crew planning

### 3. **Square Integration**
- **Status:** ✅ READY TO TEST
- Chatbot checks for existing customers
- Skips card entry for returning customers
- Sends booking to local system after payment

---

## 🧪 Testing Scenarios

### **Test 1: New Customer - Apartment Move**

**Purpose:** Test apartment pricing, time estimates, and new customer flow

**Steps:**
1. Open chatbot: http://localhost:3001
2. Select "Moving Service"
3. Enter contact info with a NEW email (not in Square yet)
4. Select "🏢 Apartment"
5. Select bedrooms (e.g., 2 bedroom)
6. Enter 2 flights of stairs at pickup
7. Enter 1 flight of stairs at delivery
8. Complete the quote

**Expected Results:**
- Stair fee: **3 flights × $35 = $105** (apartment rate)
- Loading time increased by: **3 × 21 min = 63 minutes** (apartment stair time)
- Total time estimate should reflect the extra time
- After quote, chatbot asks for payment
- Square payment modal opens for NEW customer
- After payment, booking sent to system
- Confirmation shown with booking ID

---

### **Test 2: Returning Customer - House Move**

**Purpose:** Test returning customer flow and house pricing

**Steps:**
1. Use the SAME email from Test 1 (now in Square database)
2. Select "Moving Service"
3. Select "🏠 House"
4. Select bedrooms
5. Enter 2 flights of stairs

**Expected Results:**
- Chatbot says: "Welcome back! I found your saved payment method ending in ****XXXX"
- **NO payment modal** (skips card entry)
- Stair fee: **2 flights × $25 = $50** (house rate)
- Loading time increased by: **2 × 16.5 min = 33 minutes** (house stair time)
- Booking created automatically with existing Square customer ID
- Confirmation shown

---

### **Test 3: Labor Service**

**Purpose:** Test labor service with apartment stair rate

**Steps:**
1. Select "Labor Only Service"
2. Enter location
3. Select 2 crew members, 3 hours
4. Enter 3 flights of stairs

**Expected Results:**
- Stair fee: **3 flights × $35 = $105** (labor uses apartment rate)
- Quote breakdown shows stair fees
- Payment/booking flow works

---

### **Test 4: Single Item - Couch**

**Purpose:** Test single item with new stair rate

**Steps:**
1. Select "Single Item Move"
2. Choose "Couch/Sofa"
3. Enter pickup address
4. Enter delivery address
5. Enter 2 flights at pickup, 3 flights at delivery

**Expected Results:**
- Stair fee: **5 flights × $35 = $175** (single item uses apartment rate)
- Time estimate includes stairs
- Payment/booking flow works

---

## 📊 Verification Checklist

After each test, verify:

### ✅ Chatbot Side
- [ ] Estimate shows correct stair fees ($35 for apartments, $25 for houses)
- [ ] Time estimate is accurate (longer for apartments)
- [ ] Breakdown itemizes stair costs
- [ ] Returning customers skip payment modal
- [ ] New customers see payment modal

### ✅ Payment Side (Square)
- [ ] Payment modal loads correctly
- [ ] Card can be saved successfully
- [ ] Customer created in Square with email
- [ ] Returning customers recognized by email

### ✅ Booking System Side
- [ ] Check admin portal: http://localhost:3001/admin
- [ ] Booking appears in appointments list
- [ ] Stair fees shown in estimate details
- [ ] Square customer ID saved with booking
- [ ] Email confirmations sent (check inbox)
- [ ] Google Calendar event created

---

## 🔍 What to Look For

### **Stair Pricing Accuracy**

| Scenario | Property Type | Flights | Expected Fee |
|----------|---------------|---------|--------------|
| Moving - Apartment | Apartment | 3 | $105 ($35×3) |
| Moving - House | House | 3 | $75 ($25×3) |
| Labor Service | N/A | 2 | $70 ($35×2) |
| Single Item | N/A | 4 | $140 ($35×4) |

### **Time Estimate Accuracy**

| Scenario | Property Type | Flights | Extra Time |
|----------|---------------|---------|------------|
| Apartment | Apartment | 3 | +63 min (+1.05 hrs) |
| House | House | 3 | +49.5 min (+0.825 hrs) |

---

## 🚨 Common Issues & Solutions

### **Issue: Payment modal doesn't open**

**Cause:** Square SDK not loaded
**Fix:** Check browser console for errors, refresh page

### **Issue: "Customer already exists" error**

**Expected behavior:** System should recognize returning customer and skip payment
**If showing error:** Check that `checkExistingCustomer()` is being called

### **Issue: Booking not appearing in admin portal**

**Check:**
1. Server running: http://localhost:3001
2. Check server console for errors
3. Verify `data/appointments.json` file updated

### **Issue: Wrong stair pricing**

**Check:**
- For Moving Service: Verify property type (apartment vs house) was selected
- For Labor/Single Item: Should always use $35 (apartment rate)

---

## 📧 Email Notifications Test

After booking, check these emails:

**Customer Email (to customer@email.com):**
- Subject: "Your Worry-Free Moving Quote & Booking Confirmation"
- Shows correct stair fees
- CC: matt@worryfreemovers.com, zlarimer24@gmail.com

**Company Email (to service@worryfreemovers.com):**
- Subject: "New Booking - [Customer Name]"
- Includes Square customer ID
- Shows stair fees in breakdown
- CC: matt@worryfreemovers.com, zlarimer24@gmail.com

---

## 🗓️ Google Calendar Verification

After booking:

1. Go to: https://calendar.google.com
2. Sign in with: matt@worryfreemovers.com
3. Find the booking event
4. Verify it includes:
   - Customer name
   - Pickup/delivery addresses
   - Service type
   - Estimated hours (including stair time)
   - Stair fees in description

---

## 📱 SMS Verification (RingCentral)

If SMS is enabled:

**Customer SMS:**
- Confirms booking
- Shows total amount
- Includes stair fees

**Check server logs for:**
```
📱 SMS sent successfully to +1XXXXXXXXXX
```

---

## 🔐 Square Customer Database Check

**To verify Square integration:**

### New Customer Test:
1. Use brand new email: test-new-customer@example.com
2. Complete booking with payment
3. Go to Square Dashboard: https://squareup.com/dashboard
4. Check Customers → Should see new customer with that email
5. Customer should have saved card on file

### Returning Customer Test:
1. Use SAME email: test-new-customer@example.com
2. Start new quote
3. System should say: "Welcome back! Found your payment method"
4. Should skip payment modal entirely
5. Booking should use existing Square customer ID

---

## ✅ Complete Test Workflow

**Full End-to-End Test (15 minutes):**

1. **New Customer - Apartment Move**
   - Use: newtest@example.com
   - Property: Apartment
   - Stairs: 3 flights
   - ✅ Pays $105 for stairs ($35×3)
   - ✅ Saves card in Square
   - ✅ Booking created
   - ✅ Emails sent
   - ✅ Calendar event created

2. **Returning Customer - House Move**
   - Use: newtest@example.com (SAME email)
   - Property: House
   - Stairs: 2 flights
   - ✅ Skips payment (recognized)
   - ✅ Pays $50 for stairs ($25×2)
   - ✅ Uses existing Square ID
   - ✅ Booking created

3. **Labor Service**
   - New email: labor-test@example.com
   - Stairs: 2 flights
   - ✅ Pays $70 for stairs ($35×2)
   - ✅ Booking created

4. **Single Item**
   - New email: singleitem-test@example.com
   - Stairs: 4 flights total
   - ✅ Pays $140 for stairs ($35×4)
   - ✅ Booking created

5. **Verify Admin Portal**
   - http://localhost:3001/admin
   - Username: admin
   - Password: WorryFree2024!
   - ✅ All 4 bookings visible
   - ✅ Stair fees shown correctly

---

## 📞 Support Resources

**If you encounter issues:**

1. **Server logs:** Check terminal running `npm start`
2. **Browser console:** Press F12 → Console tab
3. **Admin portal:** http://localhost:3001/admin
4. **Data files:**
   - Bookings: `data/appointments.json`
   - Services: `data/services.json`

---

## 🎯 Success Criteria

Your system is working correctly if:

- ✅ Apartment stairs charge $35/flight
- ✅ House stairs charge $25/flight
- ✅ Apartment stairs add 21 min per flight to estimate
- ✅ House stairs add 16.5 min per flight to estimate
- ✅ New customers enter payment info
- ✅ Returning customers skip payment entry
- ✅ Bookings appear in admin portal
- ✅ Emails sent to customer + team
- ✅ Google Calendar events created
- ✅ Square customer database updated

---

## 🚀 Ready to Test!

The system is fully configured and ready. Start with Test 1 above and work through the scenarios.

**Current Status:**
- ✅ Server running: http://localhost:3001
- ✅ Google Calendar integrated
- ✅ Email notifications active
- ✅ SMS notifications active
- ✅ Square payment integration ready
- ✅ Stair pricing differentiated (apartment vs house)
- ✅ Time estimates updated

**Test URL:** http://localhost:3001

Good luck with testing! 🎉
