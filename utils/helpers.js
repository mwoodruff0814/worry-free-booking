const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique booking ID
 */
function generateBookingId() {
    const prefix = 'WFM';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = uuidv4().split('-')[0].toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Format phone number
 */
function formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

/**
 * Validate email
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validate phone
 */
function validatePhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10;
}

/**
 * Calculate end time based on service type
 * Returns end time string in format "HH:MM"
 */
function calculateEndTime(startTime, serviceType, estimatedHours = 2) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + (estimatedHours * 60);

    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;

    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format time for display (24hr to 12hr)
 */
function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Format time window (1-hour arrival window)
 * Takes a start time and returns "10:00 AM - 11:00 AM" format
 */
function formatTimeWindow(startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + 60; // 1 hour window

    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;

    const startFormatted = formatTime(startTime);
    const endFormatted = formatTime(`${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`);

    return `${startFormatted} - ${endFormatted}`;
}

/**
 * Get end time of 1-hour window
 * Returns the end time in 24hr format
 */
function getWindowEndTime(startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + 60;

    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;

    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
}

module.exports = {
    generateBookingId,
    formatPhoneNumber,
    validateEmail,
    validatePhone,
    calculateEndTime,
    formatDate,
    formatTime,
    formatTimeWindow,
    getWindowEndTime
};
