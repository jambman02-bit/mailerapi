const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for verification codes (use a database in production)
const verificationCodes = new Map();

// Create Nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Generate random verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification email
const sendVerificationEmail = async (email, code, purpose = 'registration') => {
  try {
    const transporter = createTransporter();
    
    const subject = purpose === 'registration' 
      ? 'Verify Your Account - Registration Code'
      : 'Reset Your Password - Verification Code';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${purpose === 'registration' ? 'Account Verification' : 'Password Reset'}</h2>
        <p>Hello,</p>
        <p>Please use the following verification code to ${purpose === 'registration' ? 'complete your registration' : 'reset your password'}:</p>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; margin: 20px 0;">
          <h1 style="margin: 0; color: #333; letter-spacing: 5px;">${code}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <br>
        <p>Best regards,<br>Your App Team</p>
      </div>
    `;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: subject,
      html: html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// API Routes

// Send registration verification code
app.post('/api/send-registration-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    
    // Store code with expiration (10 minutes)
    verificationCodes.set(email, {
      code: verificationCode,
      purpose: 'registration',
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Send email
    const emailResult = await sendVerificationEmail(email, verificationCode, 'registration');

    if (emailResult.success) {
      res.json({
        success: true,
        message: 'Registration verification code sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send verification email',
        error: emailResult.error
      });
    }
  } catch (error) {
    console.error('Error in send-registration-code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send password reset code
app.post('/api/send-password-reset-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    
    // Store code with expiration (10 minutes)
    verificationCodes.set(email, {
      code: verificationCode,
      purpose: 'password-reset',
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Send email
    const emailResult = await sendVerificationEmail(email, verificationCode, 'password-reset');

    if (emailResult.success) {
      res.json({
        success: true,
        message: 'Password reset code sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send password reset email',
        error: emailResult.error
      });
    }
  } catch (error) {
    console.error('Error in send-password-reset-code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify code
app.post('/api/verify-code', async (req, res) => {
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
        message: 'No verification code found for this email'
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
        message: 'Verification code has expired'
      });
    }

    if (storedData.code !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Code is valid - remove it from storage
    verificationCodes.delete(email);

    res.json({
      success: true,
      message: 'Code verified successfully'
    });
  } catch (error) {
    console.error('Error in verify-code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Email Verification API'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Clean up expired codes every hour
setInterval(() => {
  const now = Date.now();
  for (let [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
    }
  }
}, 60 * 60 * 1000); // 1 hour