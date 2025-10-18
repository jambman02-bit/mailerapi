const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware - FIXED CORS ISSUE
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// In-memory storage for verification codes
const verificationCodes = new Map();

// Test email configuration
const testTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'test@example.com',
      pass: process.env.SMTP_PASS || 'test-password',
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
    const transporter = testTransporter();
    
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
      from: process.env.SMTP_USER || 'noreply@yourapp.com',
      to: email,
      subject: subject,
      html: html,
    };

    // Only try to send email if SMTP credentials are configured
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const result = await transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${email}`);
      return { success: true, messageId: result.messageId };
    } else {
      console.log(`Email not sent - SMTP not configured. Code for ${email}: ${code}`);
      return { success: true, debug: true, code: code };
    }
  } catch (error) {
    console.error('Error sending email:', error);
    // Still return success but with debug info
    return { success: true, debug: true, code: code, error: error.message };
  }
};

// ========== API ROUTES ==========

// Root endpoint - FIXED
app.get('/', (req, res) => {
  res.json({ 
    message: 'Email Verification API is running!',
    status: 'OK',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /send-registration-code',
      'POST /send-password-reset-code', 
      'POST /verify-code',
      'GET /health',
      'GET /debug-codes'
    ]
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Email Verification API',
    version: '1.0.0'
  });
});

// Send registration verification code
app.post('/send-registration-code', async (req, res) => {
  try {
    console.log('Registration code request received:', req.body);
    
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

    console.log(`Generated code for ${email}: ${verificationCode}`);

    // Send email
    const emailResult = await sendVerificationEmail(email, verificationCode, 'registration');

    if (emailResult.success) {
      const response = {
        success: true,
        message: 'Registration verification code sent successfully'
      };
      
      // Include debug code if email wasn't actually sent
      if (emailResult.debug) {
        response.debugCode = verificationCode;
        response.message = 'Verification code generated (check debug code below)';
      }
      
      res.json(response);
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send verification code'
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
app.post('/send-password-reset-code', async (req, res) => {
  try {
    console.log('Password reset code request received:', req.body);
    
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

    console.log(`Generated password reset code for ${email}: ${verificationCode}`);

    // Send email
    const emailResult = await sendVerificationEmail(email, verificationCode, 'password-reset');

    if (emailResult.success) {
      const response = {
        success: true,
        message: 'Password reset code sent successfully'
      };
      
      if (emailResult.debug) {
        response.debugCode = verificationCode;
        response.message = 'Password reset code generated (check debug code below)';
      }
      
      res.json(response);
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send reset code'
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
app.post('/verify-code', async (req, res) => {
  try {
    console.log('Verify code request received:', req.body);
    
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

// Debug endpoint to see stored codes
app.get('/debug-codes', (req, res) => {
  const codes = {};
  verificationCodes.forEach((value, key) => {
    codes[key] = {
      ...value,
      expiresAt: new Date(value.expiresAt).toISOString(),
      expired: Date.now() > value.expiresAt
    };
  });
  res.json({
    storedCodes: codes,
    total: verificationCodes.size
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /send-registration-code',
      'POST /send-password-reset-code',
      'POST /verify-code',
      'GET /debug-codes'
    ]
  });
});

// Start server - FIXED for Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`📧 SMTP Configured: ${!!(process.env.SMTP_USER && process.env.SMTP_PASS)}`);
});

// Clean up expired codes every hour
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
    console.log(`🧹 Cleaned up ${cleaned} expired verification codes`);
  }
}, 60 * 60 * 1000);