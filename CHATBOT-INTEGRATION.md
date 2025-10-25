# Sarah AI v3 Chatbot Integration Guide

## Overview

This guide explains how to integrate the Sarah AI v3 chatbot with the centralized pricing system managed by the admin portal.

## Architecture

```
┌─────────────────┐
│  Admin Portal   │ ← Admin manages pricing here
└────────┬────────┘
         │ saves to
         ▼
┌─────────────────┐
│ services.json   │ ← Single source of truth
└────────┬────────┘
         │ served by
         ▼
┌─────────────────┐
│  /api/services  │ ← API endpoint
└────────┬────────┘
         │ consumed by
         ▼
┌─────────────────┬─────────────────┬─────────────────┐
│  Chatbot (AI)   │  Booking Pages  │   Mobile App    │
└─────────────────┴─────────────────┴─────────────────┘
```

## Important Rules

⚠️ **DO NOT hardcode prices in the chatbot**
⚠️ **DO NOT duplicate pricing logic**
⚠️ **ALWAYS fetch from /api/services endpoint**

## Integration Steps

### 1. Fetch Pricing Data

**Endpoint:** `GET http://localhost:3001/api/services`

**Response Format:**
```json
{
  "success": true,
  "services": {
    "movingServices": {
      "2-person-crew": {
        "name": "2 Person Crew",
        "baseRate": 192.50,
        "distanceAdjustment": 0.75,
        "serviceCharge": 0.14,
        "crew": 2,
        "enabled": true
      },
      "3-person-crew": { ... },
      "4-person-crew": { ... }
    },
    "laborOnly": {
      "baseRate": 115,
      "crewAddRate": 55,
      "travelRate": 1.60,
      "minimumHours": 2
    },
    "singleItem": {
      "baseRate": 249,
      "distanceRate": 1.50,
      "perMinuteRate": 1.67
    },
    "packingMaterials": { ... },
    "fees": {
      "stairs": {
        "amount": 25,
        "unit": "per flight"
      }
    }
  }
}
```

### 2. Chatbot Implementation Example

```javascript
// CORRECT ✅ - Fetch prices from API
async function calculateMovingEstimate(crew, hours, distance) {
    // Fetch latest pricing
    const response = await fetch('http://localhost:3001/api/services');
    const data = await response.json();
    const services = data.services;

    // Use fetched prices for calculation
    const crewService = services.movingServices[`${crew}-person-crew`];
    const baseRate = crewService.baseRate;
    const distanceAdj = crewService.distanceAdjustment;
    const serviceCharge = crewService.serviceCharge;

    const subtotal = (baseRate * hours) + (distance * distanceAdj);
    const total = subtotal * (1 + serviceCharge);

    return total;
}

// WRONG ❌ - Hardcoded prices
async function calculateMovingEstimate(crew, hours, distance) {
    const baseRate = 192.50; // DON'T DO THIS!
    const distanceAdj = 0.75; // These should come from API
    // ...
}
```

### 3. Caching Strategy

To improve performance, cache pricing data but refresh periodically:

```javascript
let cachedServices = null;
let cacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getServices() {
    const now = Date.now();

    // Return cache if fresh
    if (cachedServices && cacheTime && (now - cacheTime < CACHE_DURATION)) {
        return cachedServices;
    }

    // Fetch fresh data
    const response = await fetch('http://localhost:3001/api/services');
    const data = await response.json();

    if (data.success) {
        cachedServices = data.services;
        cacheTime = now;
    }

    return cachedServices;
}
```

### 4. URL Parameter Integration

When the chatbot generates booking URLs, include all collected data:

```javascript
function generateBookingURL(customerData) {
    const baseURL = 'http://localhost:3001/admin-portal.html';
    const params = new URLSearchParams({
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        email: customerData.email,
        phone: customerData.phone,
        date: customerData.date,
        time: customerData.time,
        serviceType: customerData.serviceType,
        pickupAddress: customerData.pickupAddress,
        dropoffAddress: customerData.dropoffAddress,
        // Add any other relevant params
    });

    return `${baseURL}?${params.toString()}`;
}
```

### 5. Backward Compatibility

When the services.json structure changes, ensure backward compatibility:

```javascript
async function getCrewBaseRate(crewSize) {
    const services = await getServices();
    const crewService = services.movingServices[`${crewSize}-person-crew`];

    // Backward compatible fallback
    if (!crewService) {
        console.warn(`Crew size ${crewSize} not found, using default`);
        return services.movingServices['2-person-crew'].baseRate;
    }

    return crewService.baseRate;
}
```

## Testing

Before deploying chatbot changes:

1. **Test API Connection**
   ```bash
   curl http://localhost:3001/api/services
   ```

2. **Verify Pricing Matches**
   - Compare chatbot calculations with admin portal estimates
   - Ensure all fees are included (stairs, service charge, etc.)

3. **Test Price Updates**
   - Change a price in admin portal
   - Verify chatbot uses new price after cache expires

## Common Pitfalls

❌ **Don't do this:**
- Hardcoding prices in chatbot code
- Duplicating calculation logic
- Forgetting to include service charges
- Using outdated cached data

✅ **Do this:**
- Always fetch from /api/services
- Respect the cache duration
- Include all fees in calculations
- Test with real admin portal data

## Support

For questions or issues:
- Check server.js:784-807 for API documentation
- Review admin-portal.html:1265-1289 for UI integration
- Test with the admin portal Services tab

## Future Enhancements

When implementing new features:
- [ ] Add real-time pricing updates via WebSocket
- [ ] Implement A/B testing for different pricing strategies
- [ ] Add promotional discount system
- [ ] Support for seasonal pricing adjustments
