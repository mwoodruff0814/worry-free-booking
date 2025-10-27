# Worry Free Moving - Pricing Calculation Skill

**Purpose**: Accurate pricing calculations following Worry Free Moving's exact pricing model
**Critical**: Must match pricing algorithm in `server.js` lines 1320-1370 exactly

---

## Pricing Model Overview

Worry Free Moving uses **distance-based dynamic pricing**:
- Base hourly rate varies by distance
- Additional crew members add to hourly rate
- Service charges vary by service type
- Labor-only includes travel fees

---

## Service Types

### 1. Moving Service (Movers + Truck)
- Includes professional movers
- Includes moving truck
- Full-service moving
- Higher base rate, higher service charge

### 2. Labor Only
- Movers only (customer provides truck)
- Lower base rate, lower service charge
- Includes travel fee calculation

---

## Moving Service Pricing Formula

```javascript
// Base Configuration
const BASE_RATE = 192.50;           // Starting hourly rate
const DISTANCE_MULTIPLIER = 0.75;   // Per mile added to hourly rate
const CREW_MULTIPLIER = 55;         // Per additional crew member
const SERVICE_CHARGE_PERCENT = 0.14; // 14% service charge

// Formula
hourlyRate = BASE_RATE + (distance × DISTANCE_MULTIPLIER) + ((numMovers - 2) × CREW_MULTIPLIER);
subtotal = hourlyRate × estimatedHours;
serviceCharge = subtotal × SERVICE_CHARGE_PERCENT;
total = subtotal + serviceCharge;
```

### Examples:

**Example 1: Local Move (10 miles, 2 movers, 4 hours)**
```
hourlyRate = 192.50 + (10 × 0.75) + ((2 - 2) × 55)
hourlyRate = 192.50 + 7.50 + 0
hourlyRate = $200.00/hour

subtotal = 200.00 × 4 hours = $800.00
serviceCharge = 800.00 × 0.14 = $112.00
total = $912.00
```

**Example 2: Medium Move (25 miles, 2 movers, 4 hours)**
```
hourlyRate = 192.50 + (25 × 0.75) + 0
hourlyRate = 192.50 + 18.75
hourlyRate = $211.25/hour

subtotal = 211.25 × 4 = $845.00
serviceCharge = 845.00 × 0.14 = $118.30
total = $963.30
```

**Example 3: Long Move (50 miles, 3 movers, 6 hours)**
```
hourlyRate = 192.50 + (50 × 0.75) + ((3 - 2) × 55)
hourlyRate = 192.50 + 37.50 + 55
hourlyRate = $285.00/hour

subtotal = 285.00 × 6 = $1,710.00
serviceCharge = 1,710.00 × 0.14 = $239.40
total = $1,949.40
```

---

## Labor Only Pricing Formula

```javascript
// Base Configuration
const BASE_RATE_LABOR = 115;           // Starting hourly rate
const DISTANCE_MULTIPLIER_LABOR = 0.50; // Per mile added to rate
const CREW_MULTIPLIER = 55;            // Per additional crew
const TRAVEL_FEE_RATE = 1.60;          // Per mile (round trip)
const SERVICE_CHARGE_PERCENT = 0.08;   // 8% service charge

// Formula
hourlyRate = BASE_RATE_LABOR + (distance × DISTANCE_MULTIPLIER_LABOR) + ((numMovers - 2) × CREW_MULTIPLIER);
subtotal = hourlyRate × hours;
travelFee = distance × 2 × TRAVEL_FEE_RATE; // Round trip
serviceCharge = subtotal × SERVICE_CHARGE_PERCENT;
total = subtotal + travelFee + serviceCharge;
```

### Examples:

**Example 1: Local Labor (10 miles, 2 movers, 3 hours)**
```
hourlyRate = 115 + (10 × 0.50) + 0
hourlyRate = 115 + 5
hourlyRate = $120.00/hour

subtotal = 120.00 × 3 = $360.00
travelFee = 10 × 2 × 1.60 = $32.00
serviceCharge = 360.00 × 0.08 = $28.80
total = 360 + 32 + 28.80 = $420.80
```

**Example 2: Medium Labor (25 miles, 3 movers, 4 hours)**
```
hourlyRate = 115 + (25 × 0.50) + ((3 - 2) × 55)
hourlyRate = 115 + 12.50 + 55
hourlyRate = $182.50/hour

subtotal = 182.50 × 4 = $730.00
travelFee = 25 × 2 × 1.60 = $80.00
serviceCharge = 730.00 × 0.08 = $58.40
total = 730 + 80 + 58.40 = $868.40
```

---

## Estimated Hours Calculation

**Moving Service**:
```javascript
if (distance <= 10) {
    estimatedHours = 3; // Short local move
} else if (distance <= 25) {
    estimatedHours = 4; // Medium move
} else if (distance <= 50) {
    estimatedHours = 6; // Long move
} else {
    estimatedHours = 8; // Very long move
}
```

**Labor Only**:
```javascript
// Usually shorter since just loading/unloading
if (distance <= 15) {
    estimatedHours = 2;
} else if (distance <= 30) {
    estimatedHours = 3;
} else {
    estimatedHours = 4;
}
```

**Note**: These are estimates. Actual time may vary.

---

## API Integration

### Calculate Estimate Endpoint

**Endpoint**: `POST /api/calculate-estimate`

**Request Body**:
```javascript
{
    serviceType: "2-Person Crew Moving", // or "Labor Only"
    distance: 25.3,                      // Exact miles
    numMovers: 2,                        // 2, 3, or 4
    hours: 4                             // Estimated hours
}
```

**Response**:
```javascript
{
    estimate: 963.30,      // Total price
    hourlyRate: 211.25,    // Calculated hourly rate
    hours: 4,              // Hours used
    subtotal: 845.00,      // Before service charge
    serviceCharge: 118.30, // 14% for moving, 8% for labor
    travelFee: 0,          // Only for labor-only
    breakdown: {
        baseRate: 192.50,
        distanceAdd: 18.75,
        crewAdd: 0
    }
}
```

---

## Service Type Mapping

**Voice AI to API Mapping**:
```javascript
// When customer selects "moving" (Press 1)
apiServiceType = "2-Person Crew Moving";  // if 2 movers
apiServiceType = "3-Person Crew Moving";  // if 3 movers
apiServiceType = "4-Person Crew Moving";  // if 4 movers

// When customer selects "labor" (Press 2)
apiServiceType = "Labor Only";
```

---

## Claude AI Pricing Explanation Skill

When explaining pricing to customers, use natural language:

```javascript
const response = await claude.generateResponse('custom', {
    purpose: 'Explain pricing breakdown naturally',
    tone: 'Friendly and transparent',
    constraints: 'Keep under 3 sentences',
    data: {
        total: 963,
        hours: 4,
        hourlyRate: 211,
        distance: 25,
        crew: 2
    }
});
```

**Example Output**:
> "Your total is $963 for 2 movers with a truck. That's based on a $211 hourly rate for the 25-mile distance, times about 4 hours of service. This includes our service charge and all fees."

---

## Pricing Tiers Summary

### Moving Service (2 Movers)

| Distance | Hourly Rate | 4 Hours | 6 Hours | 8 Hours |
|----------|-------------|---------|---------|---------|
| 10 miles | $200        | $912    | $1,368  | $1,824  |
| 25 miles | $211        | $963    | $1,445  | $1,927  |
| 50 miles | $230        | $1,050  | $1,575  | $2,100  |
| 75 miles | $249        | $1,137  | $1,705  | $2,273  |

### Labor Only (2 Movers)

| Distance | Hourly Rate | 3 Hours | 4 Hours | Travel Fee |
|----------|-------------|---------|---------|------------|
| 10 miles | $120        | $421    | $561    | $32        |
| 25 miles | $128        | $454    | $605    | $80        |
| 50 miles | $140        | $534    | $712    | $160       |

*All prices include service charges*

---

## Crew Size Impact

**Additional Crew Members**:
- 3 movers: +$55/hour
- 4 movers: +$110/hour

**Example** (25 miles, 4 hours):
```
2 movers: $963
3 movers: $1,214 (+$251)
4 movers: $1,465 (+$502)
```

---

## Distance Accuracy Requirement

**CRITICAL**: Distance must be exact, not estimated

### Use Google Maps API:
```javascript
const distance = await calculateDistanceWithGoogleMaps(
    "123 Main St, Canton, OH",
    "456 Oak Ave, Akron, OH"
);
// Returns: { distance: 25.3, driveTime: 35 }
```

### Fallback City Estimates (if Google Maps fails):
```javascript
const cityDistances = {
    "Canton-Akron": 25,
    "Canton-Cleveland": 60,
    "Canton-Columbus": 120,
    "Akron-Cleveland": 40,
    // etc.
};
```

**Never**: Use hardcoded or guessed distances in production

---

## Presenting Quotes to Customers

### Voice AI Script:
```
"Let me calculate your quote."
[2 second pause]
"Great news! Your estimated total is $[TOTAL] for [NUM] movers [with a truck / labor only]."
"This includes approximately [HOURS] hours of service."
```

### Email Quote Format:
```
Hi [Customer Name],

Your Moving Quote:

Service: [Service Type]
Distance: [Distance] miles
Crew Size: [Num] movers
Estimated Time: [Hours] hours

Estimated Total: $[Total]

This includes:
- Hourly Rate: $[Rate]/hour
- Service Charge: [Percent]%
- [Travel Fee if labor only]

Ready to book? Call us at (330) 661-9985 or visit our website!

Worry Free Moving
Professional Moving Services in Canton, OH
```

---

## Validation Rules

### Distance
- **Minimum**: 1 mile
- **Maximum**: 200 miles (beyond this, transfer to agent)
- **Format**: Decimal (e.g., 25.3)

### Crew Size
- **Allowed**: 2, 3, or 4 movers only
- **Default**: 2 movers if not specified

### Hours
- **Minimum**: 2 hours
- **Maximum**: 12 hours (estimate)
- **Note**: Actual billing based on real time

---

## Error Handling

### If Distance Missing:
```javascript
if (!distance || distance <= 0) {
    throw new Error('Cannot calculate quote without valid distance');
}
```

### If API Call Fails:
```javascript
try {
    const quote = await calculateEstimate(data);
} catch (error) {
    console.error('Pricing calculation failed:', error);
    // Transfer to agent or use fallback estimate
}
```

---

## Testing Pricing Accuracy

### Test Cases:

```javascript
// Test 1: Local move
const test1 = await calculateEstimate({
    serviceType: "2-Person Crew Moving",
    distance: 10,
    numMovers: 2,
    hours: 4
});
// Expected: ~$912

// Test 2: Medium move, 3 movers
const test2 = await calculateEstimate({
    serviceType: "3-Person Crew Moving",
    distance: 25,
    numMovers: 3,
    hours: 4
});
// Expected: ~$1,214

// Test 3: Labor only
const test3 = await calculateEstimate({
    serviceType: "Labor Only",
    distance: 15,
    numMovers: 2,
    hours: 3
});
// Expected: ~$451
```

### Verify Against:
1. Admin portal pricing calculator
2. Chatbot quote system
3. Manual calculation using formulas above

**All must match exactly!**

---

## Special Pricing Scenarios

### Minimum Charge
- Always at least 2 hours billed
- Even if job takes 1 hour

### Travel Fee (Labor Only)
- Calculated as round trip (distance × 2)
- Not charged for moving service

### Service Charge
- Moving: 14% of subtotal
- Labor: 8% of subtotal
- Applied after hourly calculation

### After-Hours Premium (Future)
- Evenings (after 6 PM): +10%
- Weekends: +15%
- Not yet implemented

---

## Competitive Positioning

**Average Market Rates** (Canton, OH area):
- 2-man crew: $180-250/hour
- 3-man crew: $240-320/hour

**Worry Free Positioning**:
- Competitive base rates
- Transparent distance-based pricing
- No hidden fees
- Service charge clearly disclosed

---

## Integration Points

### Voice AI:
```javascript
// After collecting addresses and crew size
const quote = await calculateQuote(
    serviceType,
    distance,
    numMovers,
    estimatedHours
);

// Present to customer
const response = `Your estimated total is $${Math.round(quote.total)} for ${numMovers} movers`;
```

### Chatbot:
```javascript
// Same API call
const estimate = await axios.post('/api/calculate-estimate', data);
```

### Admin Portal:
```javascript
// Manual quote creation
const pricing = calculatePricingDetails(serviceData);
```

**All use same algorithm** - guaranteed consistency!

---

## Logging for Verification

**Log Every Quote**:
```javascript
console.log(`💰 Quote calculated: ${serviceType}, ${distance}mi, ${numMovers} crew = $${total}`);
console.log(`   Hourly: $${hourlyRate}, Hours: ${hours}, Service charge: $${serviceCharge}`);
```

**Monitor for**:
- Unusual quotes (too high/low)
- Distance accuracy
- Consistency across channels

---

## Version

**Pricing Model Version**: 2.0
**Last Updated**: 2024-10-26
**Implementation**: `server.js` lines 1320-1370
**API Endpoint**: `/api/calculate-estimate`

---

## References

- **Main Implementation**: `server.js` (lines 1320-1370)
- **Voice AI Usage**: `services/twilioSmartVoice.js`
- **Testing**: Use admin portal as source of truth
