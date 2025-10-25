/**
 * Company Configuration
 * Manages dual company setup:
 * - Worry Free Moving: Full moving services (including labor-only)
 * - Quality Moving: Labor-only services (kept separate, not advertised together)
 */

const COMPANIES = {
    'Worry Free Moving': {
        name: 'Worry Free Moving',
        legalName: 'Worry Free Moving LLC',
        phone: '330-435-8686',
        email: 'service@worryfreemovers.com',
        address: {
            street: '',  // Add your address
            city: '',
            state: 'OH',
            zip: ''
        },
        logo: 'https://worryfreemovers.com/logo.png', // Update with actual logo URL
        website: 'https://worryfreemovers.com',
        usdot: '', // Add your USDOT number if applicable
        mcNumber: '', // Add your MC number if applicable
        services: ['Local Moving', 'Long Distance Moving', 'Labor Only', 'Packing', 'Single Item'],
        description: 'Professional moving services you can trust'
    },
    'Quality Moving': {
        name: 'Quality Moving',
        legalName: 'Quality Moving',
        phone: '330-720-3529', // Quality Moving dedicated number
        email: 'service@qualitymoving.com', // Update with actual email
        address: {
            street: '',  // Same or different address
            city: '',
            state: 'OH',
            zip: ''
        },
        logo: '', // Add Quality Moving logo URL
        website: '', // Add website if applicable
        usdot: '',
        mcNumber: '',
        services: ['Labor Only'],
        description: 'Quality labor-only moving services',
        // This company is only used for labor-only jobs
        laborOnlyCompany: true
    }
};

/**
 * Get company information based on service type
 * @param {string} serviceType - The type of service (e.g., "Moving Service", "Labor Only")
 * @returns {object} Company information
 */
function getCompanyInfo(serviceType) {
    if (!serviceType) {
        return COMPANIES['Worry Free Moving'];
    }

    // Check if it's a labor-only service
    const isLaborOnly = serviceType.toLowerCase().includes('labor');

    // If labor only, use Quality Moving (but can be overridden)
    // Note: Worry Free does labor-only too, but we keep Quality separate
    if (isLaborOnly && process.env.USE_QUALITY_MOVING === 'true') {
        return COMPANIES['Quality Moving'];
    }

    // Default to Worry Free Moving for all services
    return COMPANIES['Worry Free Moving'];
}

/**
 * Get company by name
 * @param {string} companyName - Name of the company
 * @returns {object} Company information
 */
function getCompany(companyName) {
    return COMPANIES[companyName] || COMPANIES['Worry Free Moving'];
}

/**
 * Determine which company should handle a booking
 * @param {object} bookingData - Booking information
 * @returns {string} Company name
 */
function determineCompany(bookingData) {
    const { serviceType, preferredCompany } = bookingData;

    // If explicitly specified, use that
    if (preferredCompany && COMPANIES[preferredCompany]) {
        return preferredCompany;
    }

    // For labor-only services, check environment setting
    if (serviceType && serviceType.toLowerCase().includes('labor')) {
        if (process.env.USE_QUALITY_MOVING === 'true') {
            return 'Quality Moving';
        }
    }

    // Default to Worry Free Moving
    return 'Worry Free Moving';
}

/**
 * Get all companies
 * @returns {object} All company configurations
 */
function getAllCompanies() {
    return COMPANIES;
}

/**
 * Update company information (for admin panel in future)
 * @param {string} companyName - Company to update
 * @param {object} updates - Updated fields
 */
function updateCompanyInfo(companyName, updates) {
    if (COMPANIES[companyName]) {
        COMPANIES[companyName] = {
            ...COMPANIES[companyName],
            ...updates
        };
        return true;
    }
    return false;
}

module.exports = {
    getCompanyInfo,
    getCompany,
    determineCompany,
    getAllCompanies,
    updateCompanyInfo,
    COMPANIES
};
