const rateLimit = require('express-rate-limit');

/**
 * OTP Rate Limiter
 * Specifically for verification and resend OTP endpoints
 * Limits to 5 requests per 10 minutes per IP
 */
exports.otpRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        success: false,
        message: 'Too many OTP requests from this IP, please try again after 10 minutes',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Auth Rate Limiter
 * For login and register endpoints
 */
exports.authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again after 15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
