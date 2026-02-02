const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
    registerValidator,
    loginValidator,
    updateProfileValidator,
} = require('../validators/authValidator');

/**
 * Auth Routes
 * Handles user authentication and profile management
 */

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', registerValidator, validate, authController.register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidator, validate, authController.login);

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', protect, authController.getProfile);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put(
    '/profile',
    protect,
    updateProfileValidator,
    validate,
    authController.updateProfile
);

module.exports = router;
