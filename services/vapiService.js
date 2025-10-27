const path = require('path');
const fs = require('fs').promises;

/**
 * Vapi AI Phone Receptionist Service
 * Handles quote calculation, pricing logic, and call data management
 */

// Pricing configuration
const PRICING = {
    hourlyRates: {
        '2-movers': 150,
        '3-movers': 200,
        '4-movers': 250
    },
    travelFee: {
        perMile: 2.5,
        freeMilesRadius: 10
    },
    packingRate: 50, // per hour per person
    specialItems: {
        'piano': 150,
        'gun-safe': 100,
        'hot-tub': 200,
        'antiques': 75,
        'pool-table': 125
    },
    stairsFee: 50, // per flight
    minimumCharge: 300
};

// Estimated hours based on home size
const ESTIMATED_HOURS = {
    'studio': { min: 2, max: 3, movers: 2 },
    '1-bedroom': { min: 3, max: 4, movers: 2 },
    '2-bedroom': { min: 4, max: 6, movers: 2 },
    '3-bedroom': { min: 6, max: 8, movers: 3 },
    '4-bedroom': { min: 8, max: 10, movers: 3 },
    '5+ bedroom': { min: 10, max: 14, movers: 4 },
    'commercial': { min: 8, max: 16, movers: 4 }
};

/**
 * Calculate distance between two addresses (simplified)
 * In production, use Google Maps Distance Matrix API
 */
function calculateDistance(address1, address2) {
    // Extract zip codes for rough distance estimation
    const zip1Match = address1.match(/\b\d{5}\b/);
    const zip2Match = address2.match(/\b\d{5}\b/);

    if (!zip1Match || !zip2Match) {
        return 15; // Default 15 miles if can't extract zips
    }

    const zip1 = zip1Match[0];
    const zip2 = zip2Match[0];

    // If same zip, assume 5 miles
    if (zip1 === zip2) return 5;

    // Rough estimation based on zip code difference
    // In production, replace with actual geocoding API
    const zipDiff = Math.abs(parseInt(zip1) - parseInt(zip2));

    if (zipDiff < 10) return 10;
    if (zipDiff < 50) return 25;
    if (zipDiff < 100) return 50;
    return 100; // Long distance
}

/**
 * Calculate a moving quote
 */
function calculateQuote(params) {
    const {
        moveType,
        homeSize,
        pickupAddress,
        deliveryAddress,
        hasStairs = false,
        needsPacking = false,
        specialItems = []
    } = params;

    // Get base estimates
    const sizeEstimate = ESTIMATED_HOURS[homeSize] || ESTIMATED_HOURS['2-bedroom'];
    const estimatedHours = (sizeEstimate.min + sizeEstimate.max) / 2;
    const numMovers = sizeEstimate.movers;

    // Calculate base labor cost
    const moverKey = `${numMovers}-movers`;
    const hourlyRate = PRICING.hourlyRates[moverKey] || PRICING.hourlyRates['2-movers'];
    let laborCost = estimatedHours * hourlyRate;

    // Calculate travel fee
    const distance = calculateDistance(pickupAddress, deliveryAddress);
    const extraMiles = Math.max(0, distance - PRICING.travelFee.freeMilesRadius);
    const travelFee = extraMiles * PRICING.travelFee.perMile;

    // Add stairs fee
    const stairsFee = hasStairs ? PRICING.stairsFee : 0;

    // Add packing cost
    const packingCost = needsPacking ? (estimatedHours * PRICING.packingRate) : 0;

    // Add special items fees
    const specialItemsCost = specialItems.reduce((total, item) => {
        return total + (PRICING.specialItems[item] || 0);
    }, 0);

    // Calculate subtotal
    let subtotal = laborCost + travelFee + stairsFee + packingCost + specialItemsCost;

    // Apply minimum charge
    subtotal = Math.max(subtotal, PRICING.minimumCharge);

    // Long distance markup
    if (moveType === 'long-distance' && distance > 50) {
        subtotal *= 1.5; // 50% markup for long distance
    }

    // Round to nearest $25
    const total = Math.ceil(subtotal / 25) * 25;

    return {
        success: true,
        quote: {
            total,
            breakdown: {
                laborCost: Math.round(laborCost),
                travelFee: Math.round(travelFee),
                stairsFee,
                packingCost: Math.round(packingCost),
                specialItemsCost,
                hourlyRate,
                estimatedHours,
                numMovers,
                distance: Math.round(distance)
            },
            summary: `Based on a ${homeSize} ${moveType} move from ${pickupAddress} to ${deliveryAddress}, your estimated total is $${total}. This includes ${numMovers} movers for approximately ${estimatedHours} hours at $${hourlyRate}/hour.`,
            estimatedHours,
            numMovers
        }
    };
}

/**
 * Format quote for voice response
 */
function formatQuoteForVoice(quoteResult) {
    const { quote } = quoteResult;
    const { total, breakdown } = quote;

    let response = `I can help you with that! Based on what you've told me, here's your estimate:\n\n`;
    response += `**Total Estimate: $${total}**\n\n`;
    response += `This includes:\n`;
    response += `- ${breakdown.numMovers} professional movers for about ${breakdown.estimatedHours} hours\n`;
    response += `- Hourly rate of $${breakdown.hourlyRate}\n`;

    if (breakdown.travelFee > 0) {
        response += `- Travel fee for ${breakdown.distance} miles: $${breakdown.travelFee}\n`;
    }

    if (breakdown.stairsFee > 0) {
        response += `- Stairs handling: $${breakdown.stairsFee}\n`;
    }

    if (breakdown.packingCost > 0) {
        response += `- Packing services: $${breakdown.packingCost}\n`;
    }

    if (breakdown.specialItemsCost > 0) {
        response += `- Special items handling: $${breakdown.specialItemsCost}\n`;
    }

    response += `\nThis is an estimate - the final cost depends on actual time and any additional services needed. Would you like to schedule this move?`;

    return response;
}

/**
 * Save call transcript and data to local backup
 */
async function saveCallData(callData) {
    try {
        const backupDir = path.join(__dirname, '..', 'data', 'vapi-calls');

        // Create directory if it doesn't exist
        try {
            await fs.access(backupDir);
        } catch {
            await fs.mkdir(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `call-${timestamp}-${callData.callId}.json`;
        const filepath = path.join(backupDir, filename);

        await fs.writeFile(filepath, JSON.stringify(callData, null, 2));
        console.log(`📞 Call data saved: ${filename}`);

        return { success: true, filepath };
    } catch (error) {
        console.error('Error saving call data:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sync call data to OneDrive
 */
async function syncToOneDrive() {
    try {
        const sourceDir = path.join(__dirname, '..', 'data', 'vapi-calls');
        const oneDriveDir = 'C:\\Users\\caspe\\OneDrive\\Worry Free Moving\\Data Backups\\AI Phone Calls';

        // Create OneDrive directory if it doesn't exist
        try {
            await fs.access(oneDriveDir);
        } catch {
            await fs.mkdir(oneDriveDir, { recursive: true });
        }

        // Read all call files
        const files = await fs.readdir(sourceDir);
        let syncCount = 0;

        for (const file of files) {
            if (file.endsWith('.json')) {
                const sourcePath = path.join(sourceDir, file);
                const destPath = path.join(oneDriveDir, file);

                // Check if file already exists in OneDrive
                try {
                    await fs.access(destPath);
                    // File exists, skip
                } catch {
                    // File doesn't exist, copy it
                    await fs.copyFile(sourcePath, destPath);
                    syncCount++;
                }
            }
        }

        console.log(`☁️ Synced ${syncCount} call records to OneDrive`);
        return { success: true, syncCount };
    } catch (error) {
        console.error('Error syncing to OneDrive:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate daily call summary
 */
async function generateCallSummary(date) {
    try {
        const callsDir = path.join(__dirname, '..', 'data', 'vapi-calls');
        const files = await fs.readdir(callsDir);

        const targetDate = date || new Date().toISOString().split('T')[0];
        const callsForDate = [];

        for (const file of files) {
            if (file.includes(targetDate)) {
                const filepath = path.join(callsDir, file);
                const data = await fs.readFile(filepath, 'utf8');
                callsForDate.push(JSON.parse(data));
            }
        }

        const summary = {
            date: targetDate,
            totalCalls: callsForDate.length,
            quotesGenerated: callsForDate.filter(c => c.quoteGenerated).length,
            bookingsMade: callsForDate.filter(c => c.bookingCreated).length,
            transfersToHuman: callsForDate.filter(c => c.transferredToHuman).length,
            averageDuration: callsForDate.reduce((sum, c) => sum + (c.duration || 0), 0) / callsForDate.length || 0,
            calls: callsForDate
        };

        return { success: true, summary };
    } catch (error) {
        console.error('Error generating call summary:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    calculateQuote,
    formatQuoteForVoice,
    saveCallData,
    syncToOneDrive,
    generateCallSummary,
    PRICING,
    ESTIMATED_HOURS
};
