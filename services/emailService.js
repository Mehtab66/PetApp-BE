const nodemailer = require('nodemailer');
const config = require('../config/config');

/**
 * Email Service
 * Handles sending emails using nodemailer
 */

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // Standard property to force IPv4
    family: 4,
    tls: {
        rejectUnauthorized: false
    }
});

// Verify transporter on startup with detailed logging
console.log('--- EMAIL SERVICE INITIALIZATION ---');
console.log('EMAIL_USER defined:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS defined:', !!process.env.EMAIL_PASS);
if (process.env.EMAIL_USER) {
    console.log('Using EMAIL_USER:', process.env.EMAIL_USER.substring(0, 3) + '...' + process.env.EMAIL_USER.split('@')[1]);
}

transporter.verify((error, success) => {
    if (error) {
        console.error('CRITICAL: SMTP Connection Error during startup:', error);
    } else {
        console.log('SUCCESS: SMTP Server is ready to take our messages');
    }
});
console.log('-------------------------------------');

/**
 * Generate OTP Email Template
 * @param {string} otp - The OTP code
 * @param {string} userName - The user's name
 * @returns {string} - HTML Email Template
 */
const getOTPTemplate = (otp, userName) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your PetVitals Account</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f7f9fc;
                margin: 0;
                padding: 0;
                color: #333;
            }
            .container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
            }
            .header {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                padding: 40px 20px;
                text-align: center;
                color: #ffffff;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 700;
                letter-spacing: -0.5px;
            }
            .content {
                padding: 40px 30px;
                text-align: center;
            }
            .content p {
                font-size: 16px;
                line-height: 1.6;
                color: #4b5563;
                margin-bottom: 25px;
            }
            .otp-container {
                background-color: #f3f4f6;
                padding: 20px;
                border-radius: 8px;
                display: inline-block;
                margin: 20px 0;
            }
            .otp-code {
                font-size: 36px;
                font-weight: 800;
                color: #4f46e5;
                letter-spacing: 8px;
                margin: 0;
            }
            .footer {
                background-color: #f9fafb;
                padding: 20px;
                text-align: center;
                border-top: 1px solid #e5e7eb;
            }
            .footer p {
                font-size: 13px;
                color: #9ca3af;
                margin: 0;
            }
            .social-links {
                margin-top: 15px;
            }
            @media screen and (max-width: 480px) {
                .container {
                    margin: 0;
                    border-radius: 0;
                }
                .content {
                    padding: 30px 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>PetVitals</h1>
            </div>
            <div class="content">
                <h2>Verify Your Email</h2>
                <p>Hi <strong>${userName}</strong>,</p>
                <p>Welcome to PetVitals! To complete your registration and ensure your pet's data is secure, please use the verification code below:</p>
                <div class="otp-container">
                    <div class="otp-code">${otp}</div>
                </div>
                <p>This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
                <p>Paws and love,<br>The PetVitals Team</p>
            </div>
            <div class="footer">
                <p>&copy; 2025 PetVitals Inc. All rights reserved.</p>
                <p>If you have any questions, contact us at pethealthvitals@gmail.com</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

/**
 * Generate Password Reset Email Template
 * @param {string} otp - The OTP code
 * @param {string} userName - The user's name
 * @returns {string} - HTML Email Template
 */
const getResetPasswordTemplate = (otp, userName) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - PetVitals</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; margin: 0; padding: 0; color: #333; }
            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding: 40px 20px; text-align: center; color: #ffffff; }
            .content { padding: 40px 30px; text-align: center; }
            .otp-container { background-color: #fef2f2; padding: 20px; border-radius: 8px; display: inline-block; margin: 20px 0; border: 1px dashed #ef4444; }
            .otp-code { font-size: 36px; font-weight: 800; color: #ef4444; letter-spacing: 8px; margin: 0; }
            .footer { background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>PetVitals</h1></div>
            <div class="content">
                <h2>Password Reset Request</h2>
                <p>Hi <strong>${userName}</strong>,</p>
                <p>We received a request to reset your password. Use the verification code below to proceed with the reset:</p>
                <div class="otp-container"><div class="otp-code">${otp}</div></div>
                <p>This code will expire in 10 minutes. If you didn't request this, please secure your account immediately.</p>
            </div>
            <div class="footer"><p>&copy; 2025 PetVitals Inc.</p></div>
        </div>
    </body>
    </html>
    `;
};

/**
 * Send OTP Email
 * @param {string} email - Recipient email
 * @param {string} otp - The OTP code
 * @param {string} userName - The user's name
 */
exports.sendOTPEmail = async (email, otp, userName) => {
    try {
        const mailOptions = {
            from: `"PetVitals Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your Account - PetVitals',
            html: getOTPTemplate(otp, userName),
        };

        if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
            console.log('-----------------------------------------');
            console.log(`DEV MODE: OTP for ${email} is: ${otp}`);
            console.log('-----------------------------------------');
            return true;
        }

        console.log(`[EMAIL_DEBUG] Attempting to send OTP email to: ${email}`);
        console.log(`[EMAIL_DEBUG] From: "PetVitals Support" <${process.env.EMAIL_USER}>`);
        
        const info = await transporter.sendMail(mailOptions);
        
        console.log('[EMAIL_SUCCESS] OTP Email sent successfully!');
        console.log('[EMAIL_SUCCESS] Message ID:', info.messageId);
        console.log('[EMAIL_SUCCESS] Response:', info.response);
        return true;
    } catch (error) {
        console.error('[EMAIL_ERROR] FAILED to send OTP email to:', email);
        console.error('[EMAIL_ERROR] Full Error Object:', JSON.stringify(error, null, 2));
        console.error('[EMAIL_ERROR] Error Message:', error.message);
        
        if (error.code === 'EAUTH') {
            console.error('[EMAIL_ERROR] AUTHENTICATION FAILURE: The EMAIL_USER or EMAIL_PASS (App Password) is incorrect.');
        }
        return false;
    }
};

/**
 * Send Password Reset Email
 * @param {string} email - Recipient email
 * @param {string} otp - The OTP code
 * @param {string} userName - The user's name
 */
exports.sendResetPasswordEmail = async (email, otp, userName) => {
    try {
        const mailOptions = {
            from: `"PetVitals Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Reset Your Password - PetVitals',
            html: getResetPasswordTemplate(otp, userName),
        };

        if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
            console.log('-----------------------------------------');
            console.log(`DEV MODE: RESET OTP for ${email} is: ${otp}`);
            console.log('-----------------------------------------');
            return true;
        }

        console.log(`[EMAIL_DEBUG] Attempting to send Reset email to: ${email}`);
        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL_SUCCESS] Reset Email sent successfully! ID:', info.messageId);
        return true;
    } catch (error) {
        console.error('[EMAIL_ERROR] FAILED to send reset email to:', email);
        console.error('[EMAIL_ERROR] Full Error Object:', JSON.stringify(error, null, 2));
        return false;
    }
};
