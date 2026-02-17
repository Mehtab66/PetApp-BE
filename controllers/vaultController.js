const Pet = require('../models/Pet');
const HealthRecord = require('../models/HealthRecord');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

/**
 * @desc    Export pet medical history as PDF
 * @route   GET /api/vault/pet/:petId/export
 * @access  Private
 */
exports.exportMedicalHistoryPDF = async (req, res, next) => {
    try {
        const pet = await Pet.findById(req.params.petId).populate('userId', 'name email phone');
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        // Check ownership
        if (pet.userId._id.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const records = await HealthRecord.find({ petId: req.params.petId }).sort({ date: -1 });

        const doc = new PDFDocument({ margin: 50 });

        // Buffering the PDF to memory to send it
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            let pdfData = Buffer.concat(buffers);
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=${pet.name}_Medical_History.pdf`,
                'Content-Length': pdfData.length
            }).end(pdfData);
        });

        // Header
        doc.fillColor('#6366f1').fontSize(26).text('PetVitals Medical Report', { align: 'center' });
        doc.moveDown();

        // Pet Info Section
        doc.fillColor('#000').fontSize(18).text('Pet Details', { underline: true });
        doc.fontSize(12).moveDown(0.5);
        doc.text(`Name: ${pet.name}`);
        doc.text(`Type: ${pet.type}`);
        doc.text(`Breed: ${pet.breed || 'N/A'}`);
        doc.text(`Gender: ${pet.gender}`);
        doc.text(`Age: ${pet.age || 'N/A'} years`);
        doc.text(`Weight: ${pet.weight || '--'} ${pet.weightUnit}`);
        doc.moveDown();

        // Owner Info
        doc.fontSize(18).text('Owner Details', { underline: true });
        doc.fontSize(12).moveDown(0.5);
        doc.text(`Owner: ${pet.userId.name}`);
        doc.text(`Phone: ${pet.userId.phone}`);
        doc.text(`Email: ${pet.userId.email}`);
        doc.moveDown();

        // Medical History
        doc.fontSize(18).text('Medical History', { underline: true });
        doc.moveDown(0.5);

        if (records.length === 0) {
            doc.fontSize(12).text('No health records found.');
        } else {
            records.forEach((record, index) => {
                doc.fillColor('#444').fontSize(14).text(`${index + 1}. ${record.title} (${new Date(record.date).toLocaleDateString()})`, { bold: true });
                doc.fillColor('#666').fontSize(11);
                doc.text(`Type: ${record.type.replace('_', ' ').toUpperCase()}`);

                if (record.description) doc.text(`Description: ${record.description}`);
                if (record.vaccineName) doc.text(`Vaccine/Med: ${record.vaccineName}`);
                if (record.dosage) doc.text(`Dosage: ${record.dosage}`);
                if (record.vetName) doc.text(`Vet: ${record.vetName} at ${record.vetClinic || 'Unknown clinic'}`);
                if (record.diagnosis) doc.text(`Diagnosis: ${record.diagnosis}`);
                if (record.treatment) doc.text(`Treatment: ${record.treatment}`);
                if (record.notes) doc.text(`Notes: ${record.notes}`);

                doc.moveDown();

                // Add page if near bottom
                if (doc.y > 650) doc.addPage();
            });
        }

        // Footer
        doc.fontSize(10).fillColor('#999').text(`Generated on ${new Date().toLocaleString()} by PetVitals Hub`, 50, doc.page.height - 50, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate PDF' });
    }
};

/**
 * @desc    Generate or get shareable vault link
 * @route   POST /api/vault/pet/:petId/share
 * @access  Private
 */
exports.toggleVaultSharing = async (req, res, next) => {
    try {
        const { active } = req.body;
        const pet = await Pet.findById(req.params.petId);

        if (!pet) {
            return res.status(404).json({ success: false, message: 'Pet not found' });
        }

        if (pet.userId.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        pet.medicalVaultActive = active;

        if (active && !pet.vaultShareToken) {
            pet.vaultShareToken = crypto.randomBytes(16).toString('hex');
        }

        await pet.save();

        res.status(200).json({
            success: true,
            data: {
                medicalVaultActive: pet.medicalVaultActive,
                vaultShareToken: pet.vaultShareToken
            }
        });
    } catch (error) {
        next(error);
    }
};
