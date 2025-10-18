const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for verification codes
const verificationCodes = new Map();

// Email configuration
const createTransporter = () => {
    // If no SMTP credentials, use test mode
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('⚠️  SMTP not configured - using test mode');
        return {
            sendMail: async (mailOptions) => {
                console.log('📧 TEST MODE - Email would be sent to:', mailOptions.to);
                console.log('📧 TEST MODE - Subject:', mailOptions.subject);
                return { messageId: 'test-' + Date.now() };
            }
        };
    }

    return nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

// Generate 6-digit code
const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send email
const sendVerificationEmail = async (email, code, purpose = 'registration') => {
    try {
        const transporter = createTransporter();
        
        const subject = purpose === 'registration' 
            ? 'Verify Your Dnest Account'
            : 'Reset Your Dnest Password';
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333; text-align: center;">Dnest Verification Code</h2>
                <p>Hello,</p>
                <p>Your verification code is:</p>
                <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px; border: 2px dashed #dee2e6;">
                    <h1 style="margin: 0; color: #333; font-size: 32px; letter-spacing: 8px;">${code}</h1>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                <hr style="margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">Best regards,<br>The Dnest Team</p>
            </div>
        `;

        const mailOptions = {
            from: process.env.SMTP_USER || 'noreply@dnest.com',
            to: email,
            subject: subject,
            html: html,
        };

        const result = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${email}`);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('❌ Email failed:', error);
        return { success: false, error: error.message };
    }
};

// ========== ROUTES ==========

// Root endpoint - FIXED
app.get('/', (req, res) => {
    res.json({ 
        message: 'Dnest Email API is running! 🚀',
        status: 'OK',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: 'GET /health',
            sendRegistrationCode: 'POST /send-registration-code',
            sendPasswordResetCode: 'POST /send-password-reset-code',
            verifyCode: 'POST /verify-code'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        service: 'Dnest Email API',
        timestamp: new Date().toISOString(),
        smtp_configured: !!(process.env.SMTP_USER && process.env.SMTP_PASS)
    });
});

// Send registration code
app.post('/send-registration-code', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Generate code
        const code = generateVerificationCode();
        
        // Store with expiration (10 minutes)
        verificationCodes.set(email, {
            code: code,
            purpose: 'registration',
            expiresAt: Date.now() + 10 * 60 * 1000
        });

        console.log(`📧 Registration code for ${email}: ${code}`);

        // Try to send email
        const emailResult = await sendVerificationEmail(email, code, 'registration');

        const response = {
            success: true,
            message: 'Verification code sent successfully'
        };

        // If email not configured, include debug code
        if (!process.env.SMTP_USER || !emailResult.success) {
            response.debugCode = code;
            response.message = 'Use this code for testing (email not configured)';
        }

        res.json(response);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Send password reset code
app.post('/send-password-reset-code', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const code = generateVerificationCode();
        
        verificationCodes.set(email, {
            code: code,
            purpose: 'password-reset',
            expiresAt: Date.now() + 10 * 60 * 1000
        });

        console.log(`📧 Password reset code for ${email}: ${code}`);

        const emailResult = await sendVerificationEmail(email, code, 'password-reset');

        const response = {
            success: true,
            message: 'Password reset code sent successfully'
        };

        if (!process.env.SMTP_USER || !emailResult.success) {
            response.debugCode = code;
            response.message = 'Use this code for testing (email not configured)';
        }

        res.json(response);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Verify code
app.post('/verify-code', async (req, res) => {
    try {
        const { email, code, purpose } = req.body;

        if (!email || !code || !purpose) {
            return res.status(400).json({
                success: false,
                message: 'Email, code, and purpose are required'
            });
        }

        const storedData = verificationCodes.get(email);

        if (!storedData) {
            return res.status(400).json({
                success: false,
                message: 'No verification code found. Please request a new code.'
            });
        }

        if (storedData.purpose !== purpose) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification purpose'
            });
        }

        if (Date.now() > storedData.expiresAt) {
            verificationCodes.delete(email);
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new one.'
            });
        }

        if (storedData.code !== code) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code'
            });
        }

        // Code is valid - remove it
        verificationCodes.delete(email);

        res.json({
            success: true,
            message: 'Code verified successfully'
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Handle 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found. Available endpoints: GET /, GET /health, POST /send-registration-code, POST /send-password-reset-code, POST /verify-code'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Dnest Email API running on port ${PORT}`);
    console.log(`📍 Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`📧 SMTP Configured: ${!!(process.env.SMTP_USER && process.env.SMTP_PASS)}`);
});

// Clean expired codes every hour
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (let [email, data] of verificationCodes.entries()) {
        if (now > data.expiresAt) {
            verificationCodes.delete(email);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired codes`);
    }
}, 60 * 60 * 1000);
