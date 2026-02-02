const { body, param } = require('express-validator');

/**
 * Reminder Validators
 * Validation rules for reminder endpoints
 */

const createReminderValidator = [
    body('petId')
        .notEmpty()
        .withMessage('Pet ID is required')
        .isMongoId()
        .withMessage('Invalid pet ID'),

    body('title')
        .trim()
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ min: 1, max: 100 })
        .withMessage('Title must be between 1 and 100 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot be more than 500 characters'),

    body('type')
        .notEmpty()
        .withMessage('Reminder type is required')
        .isIn(['vaccination', 'medication', 'grooming', 'feeding', 'vet_appointment', 'exercise', 'training', 'bath', 'deworming', 'other'])
        .withMessage('Invalid reminder type'),

    body('date')
        .notEmpty()
        .withMessage('Date is required')
        .isISO8601()
        .withMessage('Invalid date format'),

    body('time')
        .notEmpty()
        .withMessage('Time is required')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Invalid time format (HH:MM)'),

    body('isRecurring')
        .optional()
        .isBoolean()
        .withMessage('isRecurring must be a boolean'),

    body('recurringPattern')
        .optional()
        .isIn(['daily', 'weekly', 'monthly', 'yearly', null])
        .withMessage('Invalid recurring pattern'),

    body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Notes cannot be more than 500 characters'),
];

const updateReminderValidator = [
    param('id')
        .isMongoId()
        .withMessage('Invalid reminder ID'),

    ...createReminderValidator.map(validator => validator),
];

const reminderIdValidator = [
    param('id')
        .isMongoId()
        .withMessage('Invalid reminder ID'),
];

module.exports = {
    createReminderValidator,
    updateReminderValidator,
    reminderIdValidator,
};
