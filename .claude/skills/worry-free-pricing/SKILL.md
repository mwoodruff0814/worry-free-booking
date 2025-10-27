---
name: worry-free-pricing
description: Accurate pricing calculations for Worry Free Moving following exact pricing model. Calculates distance-based dynamic hourly rates, crew size pricing, service charges, and travel fees. Use when calculating moving quotes, estimating costs, or validating pricing accuracy.
---

# Worry Free Moving - Pricing Calculator

Exact pricing calculations following Worry Free Moving's pricing model. Must match `server.js` lines 1320-1370 exactly.

## Pricing Model Overview

**Distance-based dynamic pricing**:
- Base hourly rate varies by distance
- Additional crew members add to hourly rate
- Service charges vary by service type
- Labor-only includes travel fees

## Service Types

### 1. Moving Service (Movers + Truck)
- Includes professional movers + truck
- Base rate: $192.50/hour
- Service charge: 14%

### 2. Labor Only
- Movers only (customer provides truck)
- Base rate: $115/hour
- Service charge: 8%
- Includes round-trip travel fee

## Moving Service Formula

```javascript
// Configuration
const BASE_RATE = 192.50;
const DISTANCE_MULTIPLIER = 0.75;
const CREW_MULTIPLIER = 55;
const SERVICE_CHARGE_PERCENT = 0.14; // 14%

// Calculation
hourlyRate = BASE_RATE + (distance × DISTANCE_MULTIPLIER) + ((numMovers - 2) × CREW_MULTIPLIER);
subtotal = hourlyRate × estimatedHours;
serviceCharge = subtotal × SERVICE_CHARGE_PERCENT;
total = subtotal + serviceCharge;
```

### Examples

**Local Move (10 miles, 2 movers, 4 hours)**:
```
hourlyRate = 192.50 + (10 × 0.75) + 0 = $200.00/hour
subtotal = 200.00 × 4 = $800.00
serviceCharge = 800.00 × 0.14 = $112.00
total = $912.00
```

**Medium Move (25 miles, 2 movers, 4 hours)**:
```
hourlyRate = 192.50 + (25 × 0.75) + 0 = $211.25/hour
subtotal = 211.25 × 4 = $845.00
serviceCharge = 845.00 × 0.14 = $118.30
total = $963.30
```

**Long Move (50 miles, 3 movers, 6 hours)**:
```
hourlyRate = 192.50 + (50 × 0.75) + 55 = $285.00/hour
subtotal = 285.00 × 6 = $1,710.00
serviceCharge = 1,710.00 × 0.14 = $239.40
total = $1,949.40
```

## Labor Only Formula

```javascript
// Configuration
const BASE_RATE_LABOR = 115;
const DISTANCE_MULTIPLIER_LABOR = 0.50;
const CREW_MULTIPLIER = 55;
const TRAVEL_FEE_RATE = 1.60; // Per mile (round trip)
const SERVICE_CHARGE_PERCENT = 0.08; // 8%

// Calculation
hourlyRate = BASE_RATE_LABOR + (distance × DISTANCE_MULTIPLIER_LABOR) + ((numMovers - 2) × CREW_MULTIPLIER);
subtotal = hourlyRate × hours;
travelFee = distance × 2 × TRAVEL_FEE_RATE; // Round trip
serviceCharge = subtotal × SERVICE_CHARGE_PERCENT;
total = subtotal + travelFee + serviceCharge;
```

### Examples

**Local Labor (10 miles, 2 movers, 3 hours)**:
```
hourlyRate = 115 + (10 × 0.50) + 0 = $120.00/hour
subtotal = 120.00 × 3 = $360.00
travelFee = 10 × 2 × 1.60 = $32.00
serviceCharge = 360.00 × 0.08 = $28.80
total = $420.80
```

**Medium Labor (25 miles, 3 movers, 4 hours)**:
```
hourlyRate = 115 + (25 × 0.50) + 55 = $182.50/hour
subtotal = 182.50 × 4 = $730.00
travelFee = 25 × 2 × 1.60 = $80.00
serviceCharge = 730.00 × 0.08 = $58.40
total = $868.40
```

## Estimated Hours

### Moving Service
```javascript
if (distance <= 10) estimatedHours = 3;
else if (distance <= 25) estimatedHours = 4;
else if (distance <= 50) estimatedHours = 6;
else estimatedHours = 8;
```

### Labor Only
```javascript
if (distance <= 15) estimatedHours = 2;
else if (distance <= 30) estimatedHours = 3;
else estimatedHours = 4;
```

## API Integration

### Calculate Estimate Endpoint

**Endpoint**: `POST /api/calculate-estimate`

**Request**:
```javascript
{
    serviceType: "2-Person Crew Moving", // or "Labor Only"
    distance: 25.3,
    numMovers: 2,
    hours: 4
}
```

**Response**:
```javascript
{
    estimate: 963.30,
    hourlyRate: 211.25,
    hours: 4,
    subtotal: 845.00,
    serviceCharge: 118.30,
    travelFee: 0,
    breakdown: {
        baseRate: 192.50,
        distanceAdd: 18.75,
        crewAdd: 0
    }
}
```

## Service Type Mapping

```javascript
// Voice AI to API
if (serviceType === "moving") {
    apiServiceType = `${numMovers}-Person Crew Moving`;
} else {
    apiServiceType = "Labor Only";
}
```

## Crew Size Impact

**Additional Crew Members**: +$55/hour each

**Example** (25 miles, 4 hours):
- 2 movers: $963
- 3 movers: $1,214 (+$251)
- 4 movers: $1,465 (+$502)

## Distance Accuracy Requirement

**CRITICAL**: Distance must be exact from Google Maps API, not estimated.

```javascript
const distance = await calculateDistanceWithGoogleMaps(
    "123 Main St, Canton, OH",
    "456 Oak Ave, Akron, OH"
);
// Returns: { distance: 25.3, driveTime: 35 }
```

## Presenting Quotes

### Voice AI Script
```
"Let me calculate your quote."
[2 second pause]
"Great news! Your estimated total is $625 for 2 movers with a truck.
This includes approximately 4 hours of service."
```

### Email Quote Format
```
Your Moving Quote:

Service: 2-Person Crew Moving
Distance: 25 miles
Crew Size: 2 movers
Estimated Time: 4 hours

Estimated Total: $963

This includes:
- Hourly Rate: $211/hour
- Service Charge: 14%

Ready to book? Call (330) 661-9985
```

## Validation Rules

### Distance
- Minimum: 1 mile
- Maximum: 200 miles (transfer to agent beyond)
- Format: Decimal (e.g., 25.3)

### Crew Size
- Allowed: 2, 3, or 4 movers only
- Default: 2 movers if not specified

### Hours
- Minimum: 2 hours
- Maximum: 12 hours (estimate)
- Note: Actual billing based on real time

## Testing

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

**Verify Against**:
1. Admin portal pricing calculator
2. Chatbot quote system
3. Manual calculation

All must match exactly!

## Pricing Tiers Summary

### Moving Service (2 Movers, 4 Hours)

| Distance | Hourly Rate | Total  |
|----------|-------------|--------|
| 10 miles | $200        | $912   |
| 25 miles | $211        | $963   |
| 50 miles | $230        | $1,050 |
| 75 miles | $249        | $1,137 |

### Labor Only (2 Movers, 3 Hours)

| Distance | Hourly Rate | Total | Travel Fee |
|----------|-------------|-------|------------|
| 10 miles | $120        | $421  | $32        |
| 25 miles | $128        | $454  | $80        |
| 50 miles | $140        | $534  | $160       |

## Special Scenarios

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

## Integration Example

```javascript
// Voice AI usage
const quote = await calculateQuote(
    serviceType,
    distance,
    numMovers,
    estimatedHours
);

const response = `Your estimated total is $${Math.round(quote.total)} for ${numMovers} movers`;
```

## Implementation

**File**: `server.js` (lines 1320-1370)
**API Endpoint**: `/api/calculate-estimate`
**Version**: 2.0
