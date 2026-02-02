const mongoose = require('mongoose');

/**
 * Reminder Model
 * Stores reminders for pet care activities
 */
const reminderSchema = new mongoose.Schema({
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
    type: {
        type: String,
        required: [true, 'Please provide reminder type'],
        enum: ['vaccination', 'medication', 'grooming', 'feeding', 'vet_appointment', 'exercise', 'training', 'bath', 'deworming', 'other'],
    },
    date: {
        type: Date,
        required: [true, 'Please provide a date'],
    },
    time: {
        type: String,
        required: [true, 'Please provide a time'],
    },
    isRecurring: {
        type: Boolean,
        default: false,
    },
    recurringPattern: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly', null],
        default: null,
    },
    isCompleted: {
        type: Boolean,
        default: false,
    },
    completedAt: {
        type: Date,
    },
    notificationSent: {
        type: Boolean,
        default: false,
    },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot be more than 500 characters'],
    },
}, {
    timestamps: true,
});

// Index for faster queries
reminderSchema.index({ userId: 1, date: 1 });
reminderSchema.index({ petId: 1, date: 1 });
reminderSchema.index({ isCompleted: 1, date: 1 });

// Method to mark reminder as completed
reminderSchema.methods.markCompleted = function () {
    this.isCompleted = true;
    this.completedAt = new Date();
    return this.save();
};

module.exports = mongoose.model('Reminder', reminderSchema);
