const { body, param } = require('express-validator');

/**
 * Pet Validators
 * Validation rules for pet endpoints
 */

const createPetValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Pet name is required')
        .isLength({ min: 1, max: 50 })
        .withMessage('Pet name should be between 1 and 50 characters'),

    body('type')
        .notEmpty()
        .withMessage('Pet type is required')
        .isIn(['Dog', 'Cat', 'Bird', 'Fish', 'Rabbit', 'Hamster', 'Other'])
        .withMessage('Please select a valid pet type'),

    body('breed')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Breed cannot be more than 50 characters'),

    body('dateOfBirth')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid date of birth'),

    body('age')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Age must be a positive number'),

    body('gender')
        .optional()
        .isIn(['Male', 'Female', 'Unknown'])
        .withMessage('Please select a valid gender (Male, Female, or Unknown)'),

    body('weight')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Weight must be a positive number'),

    body('weightUnit')
        .optional()
        .isIn(['kg', 'lbs'])
        .withMessage('Invalid weight unit'),

    body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Notes cannot be more than 500 characters'),
];

const updatePetValidator = [
    param('id')
        .isMongoId()
        .withMessage('Invalid pet ID'),

    ...createPetValidator.map(validator => {
        // Make all fields optional for update
        const newValidator = validator;
        return newValidator;
    }),
];

const petIdValidator = [
    param('id')
        .isMongoId()
        .withMessage('Invalid pet ID'),
];

module.exports = {
    createPetValidator,
    updatePetValidator,
    petIdValidator,
};
