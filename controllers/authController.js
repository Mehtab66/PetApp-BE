const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const emailService = require('../services/emailService');
const crypto = require('crypto');

/**
 * Auth Controller
 * Handles user authentication and profile management
 */

// Helper to generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, phone } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            if (existingUser.isVerified) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists with this email',
                });
            } else {
                // If user exists but is not verified, we can allow re-registration
                // This handles legacy unverified users from the old system
                await User.deleteOne({ _id: existingUser._id });
            }
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        // Find and update or create pending registration
        let pendingUser = await PendingUser.findOne({ email });

        if (pendingUser) {
            pendingUser.name = name;
            pendingUser.password = password;
            pendingUser.phone = phone;
            pendingUser.otpCode = otp;
            pendingUser.otpExpire = otpExpire;
            pendingUser.otpCount = 1;
            pendingUser.lastOtpSent = new Date();
            await pendingUser.save();
        } else {
            pendingUser = await PendingUser.create({
                name,
                email,
                password,
                phone,
                otpCode: otp,
                otpExpire,
                otpCount: 1,
                lastOtpSent: new Date(),
            });
        }

        // Send Email
        try {
            await Promise.race([
                emailService.sendOTPEmail(email, otp, name),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 10000))
            ]);

            res.status(201).json({
                success: true,
                message: 'Registration initiated. Please verify your email with the OTP sent.',
                data: {
                    email: pendingUser.email,
                    isVerified: false
                },
            });
        } catch (emailError) {
            console.error('Email sending failed during registration:', emailError);
            res.status(201).json({
                success: true,
                message: 'Registration data saved, but we had trouble sending the verification email. Please use the resend option on the next screen.',
                data: {
                    email: pendingUser.email,
                    isVerified: false,
                    emailError: true
                },
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Verify OTP
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
exports.verifyOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        // Check if user is already verified (in User model)
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User is already verified',
            });
        }

        // Find in PendingUser
        const pendingUser = await PendingUser.findOne({ email });

        if (!pendingUser) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found or expired. Please register again.',
            });
        }

        // Check if OTP match and not expired
        if (pendingUser.otpCode !== otp || pendingUser.otpExpire < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP',
            });
        }

        // Create actual User
        // Note: Password is already hashed in PendingUser (due to pre-save hook)
        // User.js pre-save hook has been updated to not re-hash if it's already a bcrypt hash
        const newUser = new User({
            name: pendingUser.name,
            email: pendingUser.email,
            password: pendingUser.password, // Prevented from double-hashing by User model logic
            phone: pendingUser.phone,
            isVerified: true
        });

        await newUser.save();
        await PendingUser.deleteOne({ _id: pendingUser._id });

        // Generate token
        const token = newUser.generateToken();

        res.status(200).json({
            success: true,
            message: 'Email verified and account created successfully',
            data: {
                user: {
                    id: newUser._id,
                    name: newUser.name,
                    email: newUser.email,
                },
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Resend OTP
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
exports.resendOtp = async (req, res, next) => {
    try {
        const { email } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'This email is already verified and registered.',
            });
        }

        const pendingUser = await PendingUser.findOne({ email });

        if (!pendingUser) {
            return res.status(404).json({
                success: false,
                message: 'Registration session not found. Please register again.',
            });
        }

        // Rate limiting validation: prevent too many OTPs
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Reset count if last sent was more than an hour ago
        if (pendingUser.lastOtpSent < oneHourAgo) {
            pendingUser.otpCount = 0;
        }

        if (pendingUser.otpCount >= 5) {
            return res.status(429).json({
                success: false,
                message: 'Too many OTP requests. Please try again after an hour.',
            });
        }

        // Prevent resending too quickly (e.g., within 1 minute)
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        if (pendingUser.lastOtpSent > oneMinuteAgo) {
            return res.status(429).json({
                success: false,
                message: 'Please wait 60 seconds before requesting another OTP.',
            });
        }

        // Generate new OTP
        const otp = generateOTP();
        pendingUser.otpCode = otp;
        pendingUser.otpExpire = new Date(Date.now() + 10 * 60 * 1000);
        pendingUser.otpCount += 1;
        pendingUser.lastOtpSent = new Date();
        await pendingUser.save();

        // Send Email
        try {
            await Promise.race([
                emailService.sendOTPEmail(email, otp, pendingUser.name),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 10000))
            ]);

            res.status(200).json({
                success: true,
                message: 'OTP resent successfully',
            });
        } catch (emailError) {
            console.error('Email resending failed:', emailError);
            res.status(200).json({
                success: true,
                message: 'OTP request received, but we had trouble sending the email. Please try again or check your spam.',
                emailError: true
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Check verification
        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email before logging in',
                data: { isVerified: false, email: user.email }
            });
        }

        // Check password
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Generate token
        const token = user.generateToken();

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    createdAt: user.createdAt,
                },
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get user profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
exports.getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    createdAt: user.createdAt,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
    try {
        const { name, email, phone } = req.body;

        const fieldsToUpdate = {};
        if (name) fieldsToUpdate.name = name;
        if (email) fieldsToUpdate.email = email;
        if (phone) fieldsToUpdate.phone = phone;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            fieldsToUpdate,
            {
                new: true,
                runValidators: true,
            }
        );

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    createdAt: user.createdAt,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};
/**
 * @desc    Forgot Password - Send OTP
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No user found with that email',
            });
        }

        // Generate Reset OTP
        const otp = generateOTP();
        user.resetPasswordOTP = otp;
        user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        await user.save();

        // Send Reset Email
        try {
            await Promise.race([
                emailService.sendResetPasswordEmail(email, otp, user.name),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 10000))
            ]);

            res.status(200).json({
                success: true,
                message: 'Password reset OTP sent to your email',
            });
        } catch (emailError) {
            console.error('Reset email failed:', emailError);
            res.status(200).json({
                success: true,
                message: 'Reset request received, but we had trouble sending the email. Please try again or check your spam.',
                emailError: true
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Reset Password - Verify OTP and update password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Check if OTP match and not expired
        if (user.resetPasswordOTP !== otp || user.resetPasswordExpire < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code',
            });
        }

        // Set new password
        user.password = newPassword;
        user.resetPasswordOTP = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successful. You can now login with your new password.',
        });
    } catch (error) {
        next(error);
    }
};
/**
 * @desc    Change user password
 * @route   PUT /api/auth/password
 * @access  Private
 */
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Get user with password
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect',
            });
        }

        // Set new password
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated successfully',
        });
    } catch (error) {
        next(error);
    }
};
