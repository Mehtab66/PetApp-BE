const mongoose = require('mongoose');

/**
 * Health Record Model
 * Stores vaccination, medication, and vet visit records
 */
const healthRecordSchema = new mongoose.Schema({
    petId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pet',
        required: true,
        index: true,
    },
    type: {
        type: String,
        required: [true, 'Please provide record type'],
        enum: ['vaccination', 'medication', 'vet_visit', 'other'],
    },
    title: {
        type: String,
        required: [true, 'Please provide a title'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    date: {
        type: Date,
        required: [true, 'Please provide a date'],
        default: Date.now,
    },
    // Vaccination specific fields
    vaccineName: {
        type: String,
        trim: true,
    },
    nextDueDate: {
        type: Date,
    },
    // Medication specific fields
    medicationName: {
        type: String,
        trim: true,
    },
    dosage: {
        type: String,
        trim: true,
    },
    frequency: {
        type: String,
        trim: true,
    },
    startDate: {
        type: Date,
    },
    endDate: {
        type: Date,
    },
    // Vet visit specific fields
    vetName: {
        type: String,
        trim: true,
    },
    vetClinic: {
        type: String,
        trim: true,
    },
    diagnosis: {
        type: String,
        trim: true,
    },
    treatment: {
        type: String,
        trim: true,
    },
    // General fields
    cost: {
        type: Number,
        min: 0,
    },
    attachments: [{
        type: String,
    }],
    notes: {
        type: String,
        maxlength: [1000, 'Notes cannot be more than 1000 characters'],
    },
}, {
    timestamps: true,
});

// Index for faster queries
healthRecordSchema.index({ petId: 1, date: -1 });
healthRecordSchema.index({ petId: 1, type: 1 });

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
