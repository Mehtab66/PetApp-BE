const mongoose = require('mongoose');

/**
 * Roadmap Model
 * Stores AI generated health and meal roadmaps for pets
 */
const roadmapSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    petId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pet',
        required: true,
        index: true,
    },
    content: {
        type: String,
        required: true,
    },
    mealPlan: {
        type: String,
    },
    vitalityScore: {
        type: Number,
        min: 0,
        max: 100,
    },
    isLatest: {
        type: Boolean,
        default: true,
    }
}, {
    timestamps: true,
});

// Index for faster lookups
roadmapSchema.index({ petId: 1, isLatest: 1 });

module.exports = mongoose.model('Roadmap', roadmapSchema);
