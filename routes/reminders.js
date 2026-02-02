const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
    createReminderValidator,
    updateReminderValidator,
    reminderIdValidator,
} = require('../validators/reminderValidator');

/**
 * Reminder Routes
 * Handles reminder CRUD operations
 */

// @route   GET /api/reminders
// @desc    Get all reminders for authenticated user
// @access  Private
router.get('/', protect, reminderController.getAllReminders);

// @route   POST /api/reminders
// @desc    Create reminder
// @access  Private
router.post(
    '/',
    protect,
    createReminderValidator,
    validate,
    reminderController.createReminder
);

// @route   GET /api/reminders/:id
// @desc    Get single reminder
// @access  Private
router.get(
    '/:id',
    protect,
    reminderIdValidator,
    validate,
    reminderController.getReminderById
);

// @route   PUT /api/reminders/:id
// @desc    Update reminder
// @access  Private
router.put(
    '/:id',
    protect,
    updateReminderValidator,
    validate,
    reminderController.updateReminder
);

// @route   DELETE /api/reminders/:id
// @desc    Delete reminder
// @access  Private
router.delete(
    '/:id',
    protect,
    reminderIdValidator,
    validate,
    reminderController.deleteReminder
);

// @route   PATCH /api/reminders/:id/complete
// @desc    Mark reminder as completed
// @access  Private
router.patch(
    '/:id/complete',
    protect,
    reminderIdValidator,
    validate,
    reminderController.markCompleted
);

module.exports = router;
