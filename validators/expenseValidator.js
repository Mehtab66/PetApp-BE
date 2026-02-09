const { check } = require('express-validator');

exports.createExpenseValidator = [
    check('petId')
        .notEmpty()
        .withMessage('Pet ID is required')
        .isMongoId()
        .withMessage('Invalid Pet ID'),

    check('title')
        .notEmpty()
        .withMessage('Title is required')
        .trim(),

    check('amount')
        .notEmpty()
        .withMessage('Amount is required')
        .isFloat({ min: 0 })
        .withMessage('Amount must be a positive number'),

    check('category')
        .optional()
        .isIn(['Food', 'Health', 'Toys', 'Grooming', 'Accessories', 'Insurance', 'Training', 'Other'])
        .withMessage('Invalid category'),

    check('date')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format')
];

exports.updateExpenseValidator = [
    check('title')
        .optional()
        .notEmpty()
        .withMessage('Title cannot be empty')
        .trim(),

    check('amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Amount must be a positive number'),

    check('category')
        .optional()
        .isIn(['Food', 'Health', 'Toys', 'Grooming', 'Accessories', 'Insurance', 'Training', 'Other'])
        .withMessage('Invalid category'),

    check('date')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format')
];
