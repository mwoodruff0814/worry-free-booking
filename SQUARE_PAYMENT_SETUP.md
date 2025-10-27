# Square Payment Integration for AI Phone Receptionist

## Overview

This guide shows how to integrate Square payment links with your Vapi AI phone receptionist, allowing Sarah to send secure payment links via SMS when customers want to pay deposits or full balances over the phone.

---

## Step 1: Get Square API Credentials

1. **Log into Square Dashboard:**
   - Go to [squareup.com/dashboard](https://squareup.com/dashboard)
   - Sign in with your Square account

2. **Navigate to Developer Portal:**
   - Click your profile (top right)
   - Select "Developer Dashboard"
   - Or go directly to: [developer.squareup.com/apps](https://developer.squareup.com/apps)

3. **Create Application:**
   - Click "+" or "Create App"
   - Name: `Worry Free Moving AI Phone`
   - Click "Create App"

4. **Get Credentials:**
   - Click your app name
   - Go to "Credentials" tab
   - **Production:**
     - Copy "Production Application ID"
     - Copy "Production Access Token" (click "Show" first)
   - **Sandbox (for testing):**
     - Copy "Sandbox Application ID"
     - Copy "Sandbox Access Token"

---

## Step 2: Add Square Credentials to .env

Add these to your `.env` file:

```env
# Square Payment Configuration
SQUARE_ACCESS_TOKEN=your_production_access_token_here
SQUARE_APPLICATION_ID=your_application_id_here
SQUARE_LOCATION_ID=your_location_id_here

# Use sandbox for testing
# SQUARE_ACCESS_TOKEN=your_sandbox_access_token_here
# SQUARE_APPLICATION_ID=sandbox_application_id_here
# SQUARE_ENVIRONMENT=sandbox
```

**To find your Location ID:**
1. Square Dashboard → Settings → Business → Locations
2. Click your location
3. Copy the Location ID (starts with `L...`)

---

## Step 3: Install Square SDK

```bash
cd C:\Users\caspe\OneDrive\Desktop\worry-free-booking
npm install square
```

---

## Step 4: Create Square Payment Service

Create a new file: `services/squarePaymentService.js`

```javascript
const { Client, Environment } = require('square');

// Initialize Square client
const client = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: process.env.SQUARE_ENVIRONMENT === 'sandbox'
        ? Environment.Sandbox
        : Environment.Production
});

/**
 * Create a Square payment link and send via SMS
 */
async function createPaymentLink(params) {
    const { amount, description, customerPhone, customerEmail, customerName } = params;

    try {
        // Create payment link using Square Checkout API
        const { result } = await client.checkoutApi.createPaymentLink({
            idempotencyKey: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            quickPay: {
                name: description || 'Worry Free Moving Service',
                priceMoney: {
                    amount: Math.round(amount * 100), // Convert dollars to cents
                    currency: 'USD'
                },
                locationId: process.env.SQUARE_LOCATION_ID
            },
            checkoutOptions: {
                askForShippingAddress: false,
                merchantSupportEmail: 'support@worryfreemoving.com',
                redirectUrl: `${process.env.BASE_URL}/payment-success`
            },
            prePopulatedData: {
                buyerEmail: customerEmail,
                buyerPhoneNumber: customerPhone
            }
        });

        const paymentUrl = result.paymentLink.url;

        console.log(`✅ Square payment link created: $${amount} - ${paymentUrl}`);

        // Send SMS with payment link
        const { sendSMS } = require('./smsService');
        const smsMessage = `Worry Free Moving - Payment Request

${description}
Amount: $${amount.toFixed(2)}

Pay securely here: ${paymentUrl}

Questions? Call 330-435-8686

Thank you!`;

        await sendSMS(customerPhone, smsMessage);

        return {
            success: true,
            paymentUrl,
            paymentLinkId: result.paymentLink.id,
            message: 'Payment link sent successfully'
        };

    } catch (error) {
        console.error('Error creating Square payment link:', error);
        return {
            success: false,
            error: error.message || 'Failed to create payment link'
        };
    }
}

/**
 * Get payment status
 */
async function getPaymentStatus(paymentLinkId) {
    try {
        const { result } = await client.checkoutApi.retrievePaymentLink(paymentLinkId);

        return {
            success: true,
            status: result.paymentLink.orderStatus,
            isPaid: result.paymentLink.orderStatus === 'COMPLETED',
            amount: result.paymentLink.quickPay.priceMoney.amount / 100,
            url: result.paymentLink.url
        };
    } catch (error) {
        console.error('Error retrieving payment status:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Create invoice for more complex payments
 */
async function createInvoice(params) {
    const {
        customerName,
        customerEmail,
        customerPhone,
        items,
        dueDate
    } = params;

    try {
        // Create invoice
        const { result } = await client.invoicesApi.createInvoice({
            invoice: {
                locationId: process.env.SQUARE_LOCATION_ID,
                orderId: '', // Optional: link to existing order
                primaryRecipient: {
                    customerId: '', // Optional: if customer exists in Square
                    givenName: customerName.split(' ')[0],
                    familyName: customerName.split(' ').slice(1).join(' '),
                    emailAddress: customerEmail,
                    phoneNumber: customerPhone
                },
                paymentRequests: [{
                    requestType: 'BALANCE',
                    dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                }],
                deliveryMethod: 'EMAIL',
                invoiceNumber: `WF-${Date.now()}`,
                title: 'Worry Free Moving Services',
                description: 'Thank you for choosing Worry Free Moving!'
            },
            idempotencyKey: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });

        console.log(`✅ Square invoice created: ${result.invoice.id}`);

        return {
            success: true,
            invoiceId: result.invoice.id,
            invoiceUrl: result.invoice.publicUrl
        };

    } catch (error) {
        console.error('Error creating Square invoice:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    createPaymentLink,
    getPaymentStatus,
    createInvoice
};
```

---

## Step 5: Update Vapi Endpoint

Update `services/vapiEndpoints.js` to use the Square payment service:

Find the `handleSendPaymentLink` function and replace it with:

```javascript
/**
 * Send Square payment link
 */
async function handleSendPaymentLink(parameters, res) {
    try {
        const { phone, amount, description } = parameters;
        const { createPaymentLink } = require('./squarePaymentService');

        // Create and send payment link
        const result = await createPaymentLink({
            amount,
            description,
            customerPhone: phone,
            customerEmail: null, // AI should collect this earlier
            customerName: null
        });

        if (result.success) {
            return res.json({
                success: true,
                paymentUrl: result.paymentUrl,
                message: `Perfect! I've sent a secure payment link to ${phone}. You can complete the payment whenever you're ready. You'll receive a receipt via text once payment is processed. Is there anything else I can help with?`
            });
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        console.error('Error sending payment link:', error);
        return res.json({
            success: false,
            error: 'I had trouble sending the payment link. I can have someone call you right back to collect payment over the phone, or you can pay when the movers arrive. Which would you prefer?'
        });
    }
}
```

---

## Step 6: Test Square Integration

### Test 1: Create Payment Link Manually

```bash
curl -X POST https://your-app-name.onrender.com/api/square/test-payment \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+13304358686",
    "amount": 100,
    "description": "Test deposit for move"
  }'
```

### Test 2: Call AI and Request Payment Link

1. Call your Vapi number
2. Book an appointment
3. When AI asks about payment, say: "Can you send me a payment link?"
4. Verify SMS arrives with Square checkout link
5. Click link and verify payment page loads
6. Complete test payment (use Square test card in sandbox)

**Square Test Card (Sandbox Only):**
- Card: `4111 1111 1111 1111`
- Expiry: Any future date
- CVV: Any 3 digits
- Zip: Any 5 digits

---

## Step 7: Handle Payment Webhooks (Optional)

To get notified when customers complete payments:

1. **Configure webhook in Square Dashboard:**
   - Developer Dashboard → Webhooks
   - Add Endpoint URL: `https://your-app-name.onrender.com/api/square/webhook`
   - Select events: `payment.created`, `payment.updated`
   - Copy Signature Key

2. **Add webhook endpoint to server.js:**

```javascript
// Square payment webhook
app.post('/api/square/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-square-signature'];
        const body = JSON.stringify(req.body);

        // Verify webhook signature (optional but recommended)
        // const crypto = require('crypto');
        // const hash = crypto.createHmac('sha256', process.env.SQUARE_WEBHOOK_KEY)
        //     .update(body)
        //     .digest('base64');

        const { type, data } = req.body;

        if (type === 'payment.created' || type === 'payment.updated') {
            const payment = data.object.payment;
            console.log(`💳 Payment ${payment.status}: $${payment.amount_money.amount / 100}`);

            // Update booking payment status
            if (payment.order_id) {
                // Find booking by order_id and update payment status
                await updateAppointment(payment.order_id, {
                    paymentStatus: 'paid',
                    paymentMethod: 'credit-card',
                    paymentId: payment.id
                });
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Square webhook error:', error);
        res.status(500).send('Error');
    }
});
```

---

## Step 8: Update AI System Prompt

Add payment instructions to `vapi-assistant-config.json`:

```
## Payment Collection

When a customer books a move, ask:
"How would you like to handle payment? I can send you a secure payment link via text for a deposit, or you can pay when the movers arrive."

If customer wants a payment link:
1. Confirm their phone number
2. Confirm the amount ($100 deposit or full amount)
3. Use sendPaymentLink function
4. Say: "Perfect! I've sent a secure link to [phone]. You'll receive a receipt once payment goes through."

If customer wants to pay on moving day:
- Confirm they accept cash, card, or Venmo
- Note "pay on arrival" in booking notes
```

---

## Pricing Strategies

### Option 1: Deposit Required
```javascript
// In vapiEndpoints.js - after booking
if (estimatedTotal > 500) {
    const depositAmount = Math.min(100, estimatedTotal * 0.2); // $100 or 20%
    // Offer to send payment link for deposit
}
```

### Option 2: Full Payment Upfront
```javascript
// Send payment link for entire estimate
await createPaymentLink({
    amount: estimatedTotal,
    description: `Payment for move on ${date}`,
    customerPhone: phone,
    customerEmail: email
});
```

### Option 3: Flexible (AI Asks)
Let the AI ask: "Would you like to pay a $100 deposit now, pay in full, or wait until moving day?"

---

## Payment Link Expiration

By default, Square payment links don't expire. To set expiration:

```javascript
checkoutOptions: {
    // ... other options
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
}
```

---

## Troubleshooting

### Issue: Payment link not sending
**Check:**
- SMS service is configured (RingCentral or Twilio)
- Phone number format is correct (+1XXXXXXXXXX)
- Square credentials are valid

### Issue: Payment link shows error
**Check:**
- SQUARE_LOCATION_ID is set correctly
- Amount is greater than $1
- Square account is active and verified

### Issue: Webhook not receiving events
**Check:**
- Webhook URL is publicly accessible (not localhost)
- Signature verification is commented out for testing
- Events are selected in Square Dashboard

---

## Security Best Practices

1. **Never store credit card numbers** - Square handles this
2. **Use HTTPS only** - Render provides this automatically
3. **Verify webhook signatures** - Prevents fake payment notifications
4. **Use environment variables** - Never commit API keys to Git
5. **Test in Sandbox first** - Before going to production

---

## Going to Production

1. **Switch from Sandbox to Production:**
   ```env
   SQUARE_ACCESS_TOKEN=your_production_token
   SQUARE_APPLICATION_ID=your_production_app_id
   # Remove or comment out:
   # SQUARE_ENVIRONMENT=sandbox
   ```

2. **Verify production credentials** work:
   ```bash
   curl https://your-app-name.onrender.com/api/square/test-payment
   ```

3. **Test with real payment** (small amount like $1)

4. **Monitor first 10 payments** closely

---

## Monthly Costs

**Square Fees:**
- Online payments: 2.9% + $0.30 per transaction
- Example: $500 payment = $14.80 + $0.30 = $15.10 fee

**No monthly fee** if using Square for payments only.

---

**Your AI phone receptionist can now collect payments! 💳**
