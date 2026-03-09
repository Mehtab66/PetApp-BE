const mongoose = require('mongoose');

const LocationPointSchema = new mongoose.Schema({
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const WalkLogSchema = new mongoose.Schema({
    petId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pet',
        required: [true, 'Please provide a pet ID']
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Please provide a user ID']
    },
    distance: {
        type: Number, // in kilometers
        required: true,
        default: 0
    },
    duration: {
        type: Number, // in seconds
        required: true,
        default: 0
    },
    path: [LocationPointSchema],
    date: {
        type: Date,
        default: Date.now
    },
    isFavorite: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot be more than 500 characters']
    }
}, {
    timestamps: true
});

// Calculate average pace (min/km) virtually
WalkLogSchema.virtual('averagePace').get(function () {
    if (this.distance === 0 || this.duration === 0) return 0;
    // Duration is in seconds, Distance in km
    // Pace is typically minutes per kilometer (e.g. 5.5 min/km)
    const minutes = this.duration / 60;
    return (minutes / this.distance).toFixed(2);
});

module.exports = mongoose.model('WalkLog', WalkLogSchema);
