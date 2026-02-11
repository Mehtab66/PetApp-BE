const { body, param } = require('express-validator');

/**
 * Health Record Validators
 * Validation rules for health record endpoints
 */

const createHealthRecordValidator = [
    body('type')
        .notEmpty()
        .withMessage('Record type is required')
        .isIn(['vaccination', 'medication', 'vet_visit', 'other'])
        .withMessage('Record type must be Vaccination, Medication, Vet Visit, or Other'),

    body('title')
        .trim()
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ min: 1, max: 100 })
        .withMessage('Title should be between 1 and 100 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description cannot be more than 500 characters'),

    body('date')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid date'),

    body('vaccineName')
        .optional()
        .trim(),

    body('nextDueDate')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid next due date'),

    body('medicationName')
        .optional()
        .trim(),

    body('dosage')
        .optional()
        .trim(),

    body('frequency')
        .optional()
        .trim(),

    body('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format'),

    body('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format'),

    body('vetName')
        .optional()
        .trim(),

    body('vetClinic')
        .optional()
        .trim(),

    body('diagnosis')
        .optional()
        .trim(),

    body('treatment')
        .optional()
        .trim(),

    body('cost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Cost must be a positive number'),

    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Notes cannot be more than 1000 characters'),
];

const petIdParamValidator = [
    param('petId')
        .isMongoId()
        .withMessage('Invalid pet ID'),
];

const recordIdParamValidator = [
    param('id')
        .isMongoId()
        .withMessage('Invalid record ID'),
];

module.exports = {
    createHealthRecordValidator,
    petIdParamValidator,
    recordIdParamValidator,
};
