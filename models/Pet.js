const mongoose = require('mongoose');

/**
 * Pet Model
 * Stores pet profile information
 */
const petSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: [true, 'Please provide pet name'],
        trim: true,
        maxlength: [50, 'Pet name cannot be more than 50 characters'],
    },
    type: {
        type: String,
        required: [true, 'Please provide pet type'],
    },
    breed: {
        type: String,
        trim: true,
        maxlength: [50, 'Breed cannot be more than 50 characters'],
    },
    dateOfBirth: {
        type: Date,
    },
    age: {
        type: Number,
        min: 0,
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Unknown'],
        default: 'Unknown',
    },
    weight: {
        type: Number,
        min: 0,
    },
    weightUnit: {
        type: String,
        enum: ['kg', 'lbs'],
        default: 'kg',
    },
    photo: {
        type: String,
        default: null,
    },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot be more than 500 characters'],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    monthlyBudget: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true,
});

// Index for faster queries
petSchema.index({ userId: 1, createdAt: -1 });

// Virtual for calculating age from date of birth
petSchema.virtual('calculatedAge').get(function () {
    if (this.dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(this.dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    }
    return this.age;
});

// Ensure virtuals are included in JSON
petSchema.set('toJSON', { virtuals: true });
petSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Pet', petSchema);
