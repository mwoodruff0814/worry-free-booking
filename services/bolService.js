/**
 * Bill of Lading (BOL) Generator
 * Creates professional PDF BOL documents for moves
 */

const PDFDocument = require('pdfkit');
const { getCompany } = require('../utils/companyConfig');

/**
 * Generate Bill of Lading PDF
 * @param {object} options - BOL data
 * @returns {Buffer} PDF buffer
 */
async function generateBOL(options) {
    const {
        appointment,
        company,
        inventoryItems,
        specialInstructions
    } = options;

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
            const chunks = [];

            // Collect PDF data
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // Get company info
            const companyInfo = getCompany(company);

            // Header
            doc.fontSize(20)
               .fillColor('#004085')
               .text(companyInfo.name, { align: 'center' })
               .fontSize(10)
               .fillColor('#000000')
               .text('BILL OF LADING', { align: 'center' })
               .moveDown();

            // Company Info
            doc.fontSize(9)
               .text(`Phone: ${companyInfo.phone}`, { align: 'center' })
               .text(`Email: ${companyInfo.email}`, { align: 'center' });

            if (companyInfo.usdot) {
                doc.text(`USDOT#: ${companyInfo.usdot}`, { align: 'center' });
            }
            if (companyInfo.mcNumber) {
                doc.text(`MC#: ${companyInfo.mcNumber}`, { align: 'center' });
            }

            doc.moveDown(2);

            // BOL Number and Date
            const bolNumber = `BOL-${appointment.bookingId}`;
            const today = new Date().toLocaleDateString('en-US');

            doc.fontSize(11)
               .fillColor('#004085')
               .text(`BOL Number: ${bolNumber}`, 50, doc.y, { continued: true })
               .text(`Date: ${today}`, { align: 'right' })
               .fillColor('#000000')
               .moveDown();

            // Customer Information
            doc.fontSize(12)
               .fillColor('#004085')
               .text('CUSTOMER INFORMATION')
               .fillColor('#000000')
               .fontSize(10)
               .moveDown(0.5);

            const customer = [
                `Name: ${appointment.firstName} ${appointment.lastName}`,
                `Email: ${appointment.email}`,
                `Phone: ${appointment.phone}`,
                `Booking ID: ${appointment.bookingId}`
            ];

            customer.forEach(line => {
                doc.text(line);
            });

            doc.moveDown();

            // Move Information
            doc.fontSize(12)
               .fillColor('#004085')
               .text('MOVE INFORMATION')
               .fillColor('#000000')
               .fontSize(10)
               .moveDown(0.5);

            const moveDate = new Date(appointment.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const moveInfo = [
                `Service Type: ${appointment.serviceType}`,
                `Move Date: ${moveDate}`,
                `Move Time: ${formatTime(appointment.time)}`,
            ];

            if (appointment.pickupAddress) {
                moveInfo.push(`Pickup Address: ${appointment.pickupAddress}`);
            }

            if (appointment.dropoffAddress) {
                moveInfo.push(`Dropoff Address: ${appointment.dropoffAddress}`);
            }

            moveInfo.forEach(line => {
                doc.text(line);
            });

            doc.moveDown(2);

            // Inventory Table
            if (inventoryItems && inventoryItems.length > 0) {
                doc.fontSize(12)
                   .fillColor('#004085')
                   .text('INVENTORY')
                   .fillColor('#000000')
                   .moveDown(0.5);

                // Table header
                const tableTop = doc.y;
                const itemX = 50;
                const qtyX = 350;
                const conditionX = 420;
                const notesX = 500;

                doc.fontSize(9)
                   .font('Helvetica-Bold')
                   .text('Item', itemX, tableTop)
                   .text('Qty', qtyX, tableTop)
                   .text('Condition', conditionX, tableTop)
                   .text('Notes', notesX, tableTop);

                // Draw line under header
                doc.moveTo(50, doc.y + 5)
                   .lineTo(550, doc.y + 5)
                   .stroke();

                doc.moveDown(0.5);
                doc.font('Helvetica');

                // Inventory items
                inventoryItems.forEach((item, index) => {
                    const y = doc.y;
                    doc.text(item.name || '', itemX, y, { width: 290 })
                       .text(item.quantity || '1', qtyX, y)
                       .text(item.condition || 'Good', conditionX, y, { width: 70 })
                       .text(item.notes || '', notesX, y, { width: 50 });
                    doc.moveDown(0.3);
                });

                doc.moveDown();
            }

            // Special Instructions
            if (specialInstructions) {
                doc.fontSize(12)
                   .fillColor('#004085')
                   .text('SPECIAL INSTRUCTIONS')
                   .fillColor('#000000')
                   .fontSize(10)
                   .moveDown(0.5)
                   .text(specialInstructions, { width: 500 })
                   .moveDown(2);
            }

            // Terms and Conditions
            doc.fontSize(12)
               .fillColor('#004085')
               .text('TERMS AND CONDITIONS')
               .fillColor('#000000')
               .fontSize(8)
               .moveDown(0.5);

            const terms = [
                '1. The carrier is liable only for loss or damage to articles specifically listed on this bill of lading.',
                '2. Customer certifies that all articles listed are accepted for transportation subject to the classifications and tariffs in effect.',
                '3. Payment is due upon completion of services unless otherwise arranged in advance.',
                '4. The customer is responsible for declaring the value of items being moved.',
                '5. Claims for loss or damage must be filed in writing within 9 months of the move date.'
            ];

            terms.forEach(term => {
                doc.text(term, { width: 500 });
                doc.moveDown(0.3);
            });

            doc.moveDown(2);

            // Signature Lines
            const signatureY = doc.y;

            // Customer Signature
            doc.fontSize(10)
               .text('__________________________________', 50, signatureY)
               .text('Customer Signature', 50, signatureY + 20)
               .text(`Date: _______________`, 50, signatureY + 40);

            // Company Representative Signature
            doc.text('__________________________________', 300, signatureY)
               .text('Company Representative', 300, signatureY + 20)
               .text(`Date: _______________`, 300, signatureY + 40);

            // Footer
            doc.fontSize(8)
               .fillColor('#666666')
               .text(
                   `Generated on ${today} by ${companyInfo.name}`,
                   50,
                   doc.page.height - 50,
                   { align: 'center', width: doc.page.width - 100 }
               );

            // Finalize PDF
            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Format time for display
 */
function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

module.exports = {
    generateBOL
};
