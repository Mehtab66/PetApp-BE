const mongoose = require('mongoose');

/**
 * Weight Log Model
 * Stores longitudinal weight data for a pet
 */
const weightLogSchema = new mongoose.Schema({
    petId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pet',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    weight: {
        type: Number,
        required: [true, 'Please provide the weight'],
        min: [0, 'Weight cannot be negative']
    },
    unit: {
        type: String,
        enum: ['kg', 'lbs'],
        default: 'kg',
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot be more than 500 characters'],
    }
}, {
    timestamps: true,
});

// Index for getting a pet's logs in chronological order
weightLogSchema.index({ petId: 1, date: -1 });

module.exports = mongoose.model('WeightLog', weightLogSchema);
