const mongoose = require('mongoose');

const aiInsightSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    petId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pet',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['analysis', 'roadmap', 'symptom_check', 'behavior', 'expense', 'nutrition', 'first_aid', 'breed_care'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // Auto-delete after 1 hour to prevent clutter
    }
});

module.exports = mongoose.model('AIInsight', aiInsightSchema);
