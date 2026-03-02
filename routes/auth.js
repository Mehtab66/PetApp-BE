const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { otpRateLimiter, authRateLimiter } = require('../middleware/rateLimiter');
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
router.post('/register', authRateLimiter, registerValidator, validate, authController.register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authRateLimiter, loginValidator, validate, authController.login);

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP
// @access  Public
router.post('/verify-otp', otpRateLimiter, authController.verifyOtp);

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
// @access  Public
router.post('/resend-otp', otpRateLimiter, authController.resendOtp);

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

// @route   PUT /api/auth/password
// @desc    Change user password
// @access  Private
router.put('/password', protect, authController.changePassword);

module.exports = router;
