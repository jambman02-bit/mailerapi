const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// In-memory storage for verification codes
const verificationCodes = new Map();
const resetTokens = new Map();

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
    }
  });
};

// Test email configuration on server start
const transporter = createTransporter();
transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Email transporter configuration error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

// Generate random verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate reset token
const generateResetToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Send verification email with professional template
const sendVerificationEmail = async (email, code, purpose = 'registration', username = 'User') => {
  try {
    const transporter = createTransporter();
    
    const isRegistration = purpose === 'registration';
    const subject = isRegistration 
      ? 'Verify Your Email - Dnest Property Management'
      : 'Reset Your Password - Dnest Property Management';
    
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000);
    const formattedTime = expirationTime.toLocaleString();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { 
                  font-family: 'Inter', system-ui, sans-serif, Arial; 
                  font-size: 14px; 
                  line-height: 1.6; 
                  color: #333; 
                  max-width: 600px; 
                  margin: 0 auto; 
                  padding: 20px;
              }
              .header { 
                  text-align: center; 
                  margin-bottom: 30px; 
                  padding-bottom: 20px;
                  border-bottom: 2px solid ${isRegistration ? '#16a34a' : '#dc2626'};
              }
              .logo { 
                  color: ${isRegistration ? '#16a34a' : '#dc2626'}; 
                  font-size: 28px; 
                  font-weight: bold; 
                  margin: 0; 
              }
              .tagline { 
                  color: #6b7280; 
                  margin: 5px 0 0 0; 
                  font-size: 12px;
              }
              .verification-code { 
                  font-size: 32px; 
                  text-align: center; 
                  margin: 30px 0; 
                  font-weight: bold; 
                  color: ${isRegistration ? '#16a34a' : '#dc2626'};
                  letter-spacing: 5px;
                  padding: 15px;
                  background-color: ${isRegistration ? '#f0fdf4' : '#fef2f2'};
                  border-radius: 8px;
                  border: 2px dashed ${isRegistration ? '#16a34a' : '#dc2626'};
              }
              .info-box { 
                  background-color: #f8fafc; 
                  padding: 15px; 
                  border-radius: 8px; 
                  border-left: 4px solid #3b82f6;
                  margin: 20px 0;
              }
              .footer { 
                  margin-top: 30px; 
                  padding-top: 20px; 
                  border-top: 1px solid #e5e7eb; 
                  color: #6b7280; 
                  font-size: 12px; 
                  text-align: center;
              }
          </style>
      </head>
      <body>
          <div class="header">
              <h1 class="logo">Dnest</h1>
              <p class="tagline">Property Management System</p>
          </div>
          
          <p>Hello <strong>${username}</strong>,</p>
          
          <p>${isRegistration 
            ? 'To complete your registration with Dnest, please use the following verification code:' 
            : 'To reset your password, please use the following verification code:'}</p>
          
          <div class="verification-code">${code}</div>
          
          <div class="info-box">
              <p><strong>⏰ Valid for:</strong> 10 minutes</p>
              <p><strong>🕒 Expires at:</strong> ${formattedTime}</p>
          </div>
          
          <p><strong>Important Security Notes:</strong></p>
          <ul>
              <li>Do not share this code with anyone</li>
              <li>Dnest will never ask for this code via phone or other channels</li>
              <li>If you didn't request this code, please ignore this email</li>
          </ul>
          
          <div class="footer">
              <p>Thanks for choosing Dnest Property Management System!</p>
              <p>If you need help, contact our support team.</p>
          </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: {
        name: 'Dnest Property Management',
        address: process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@dnest.com'
      },
      to: email,
      subject: subject,
      html: html,
    };

    // Only try to send email if SMTP credentials are configured
    if ((process.env.SMTP_USER && process.env.SMTP_PASS) || (process.env.EMAIL_USER && process.env.EMAIL_PASS)) {
      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent to ${email}`);
      return { success: true, messageId: result.messageId };
    } else {
      console.log(`📧 Email not sent - SMTP not configured. Code for ${email}: ${code}`);
      return { success: true, debug: true, code: code };
    }
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// ========== API ROUTES ==========

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Dnest Email Verification API is running!',
    status: 'OK',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /send-registration-code',
      'POST /send-password-reset-code', 
      'POST /verify-code',
      'POST /request-password-reset',
      'POST /verify-reset-token',
      'POST /reset-password',
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
    service: 'Dnest Email Verification API',
    version: '1.0.0',
    emailConfigured: !!(process.env.SMTP_USER || process.env.EMAIL_USER)
  });
});

// Send registration verification code
app.post('/send-registration-code', async (req, res) => {
  try {
    console.log('📧 Registration code request received:', req.body);
    
    const { email, username } = req.body;

    if (!email || !username) {
      return res.status(400).json({
        success: false,
        message: 'Email and username are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format'
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    
    // Store code with expiration (10 minutes)
    verificationCodes.set(email, {
      code: verificationCode,
      purpose: 'registration',
      expiresAt: Date.now() + 10 * 60 * 1000,
      username: username
    });

    console.log(`🔐 Generated registration code for ${email}: ${verificationCode}`);

    // Send email with professional template
    const emailResult = await sendVerificationEmail(email, verificationCode, 'registration', username);

    if (emailResult.success) {
      const response = {
        success: true,
        message: 'Registration verification code sent successfully',
        email: email,
        username: username
      };
      
      // Include debug code if email wasn't actually sent
      if (emailResult.debug) {
        response.debugCode = verificationCode;
        response.message = 'Verification code generated (SMTP not configured - check debug code)';
      } else {
        response.messageId = emailResult.messageId;
      }
      
      res.json(response);
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send verification code',
        error: emailResult.error
      });
    }
  } catch (error) {
    console.error('❌ Error in send-registration-code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send password reset code
app.post('/send-password-reset-code', async (req, res) => {
  try {
    console.log('🔐 Password reset code request received:', req.body);
    
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format'
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    
    // Store code with expiration (10 minutes)
    verificationCodes.set(email, {
      code: verificationCode,
      purpose: 'password-reset',
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    console.log(`🔑 Generated password reset code for ${email}: ${verificationCode}`);

    // Send email with professional template
    const emailResult = await sendVerificationEmail(email, verificationCode, 'password-reset');

    if (emailResult.success) {
      const response = {
        success: true,
        message: 'Password reset code sent successfully',
        email: email
      };
      
      if (emailResult.debug) {
        response.debugCode = verificationCode;
        response.message = 'Password reset code generated (SMTP not configured - check debug code)';
      } else {
        response.messageId = emailResult.messageId;
      }
      
      res.json(response);
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send reset code',
        error: emailResult.error
      });
    }
  } catch (error) {
    console.error('❌ Error in send-password-reset-code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Enhanced password reset endpoints from your server.js
app.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('🔐 Password reset requested for:', email);

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const expirationTime = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store token
    resetTokens.set(resetToken, {
      email: email,
      expires: expirationTime
    });

    const formattedTime = new Date(expirationTime).toLocaleString();

    // Send reset email
    const emailResult = await sendVerificationEmail(email, resetToken, 'password-reset');

    if (emailResult.success) {
      // Clean up old tokens after expiration
      setTimeout(() => {
        resetTokens.delete(resetToken);
      }, 15 * 60 * 1000);

      const response = {
        success: true, 
        message: 'Password reset email sent successfully',
        email: email
      };

      if (emailResult.debug) {
        response.debugToken = resetToken;
        response.message = 'Password reset token generated (SMTP not configured - check debug token)';
      } else {
        response.messageId = emailResult.messageId;
      }

      res.json(response);
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send password reset email',
        error: emailResult.error 
      });
    }

  } catch (error) {
    console.error('❌ Error in request-password-reset:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// Verify code endpoint
app.post('/verify-code', async (req, res) => {
  try {
    console.log('🔍 Verify code request received:', req.body);
    
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
      message: 'Code verified successfully',
      email: email,
      purpose: purpose
    });
  } catch (error) {
    console.error('❌ Error in verify-code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify reset token endpoint
app.post('/verify-reset-token', (req, res) => {
  try {
    const { token } = req.body;
    console.log('🔍 Verifying reset token:', token);

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reset token is required' 
      });
    }

    const tokenData = resetTokens.get(token);

    if (!tokenData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    if (Date.now() > tokenData.expires) {
      resetTokens.delete(token);
      return res.status(410).json({ 
        success: false, 
        message: 'Reset token has expired' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Token is valid',
      email: tokenData.email 
    });

  } catch (error) {
    console.error('❌ Error verifying reset token:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify reset token',
      error: error.message 
    });
  }
});

// Reset password endpoint
app.post('/reset-password', (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    console.log('🔄 Processing password reset');

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    const tokenData = resetTokens.get(token);

    if (!tokenData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    if (Date.now() > tokenData.expires) {
      resetTokens.delete(token);
      return res.status(410).json({ 
        success: false, 
        message: 'Reset token has expired' 
      });
    }

    const userEmail = tokenData.email;
    
    // TODO: In production, update the user's password in your database
    console.log(`✅ Password reset successful for: ${userEmail}`);
    
    // Remove the used token
    resetTokens.delete(token);

    res.json({ 
      success: true, 
      message: 'Password has been reset successfully' 
    });

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reset password',
      error: error.message 
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

  const tokens = {};
  resetTokens.forEach((value, key) => {
    tokens[key] = {
      ...value,
      expires: new Date(value.expires).toISOString(),
      expired: Date.now() > value.expires
    };
  });

  res.json({
    verificationCodes: codes,
    resetTokens: tokens,
    totalVerificationCodes: verificationCodes.size,
    totalResetTokens: resetTokens.size
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
      'POST /request-password-reset',
      'POST /verify-code',
      'POST /verify-reset-token',
      'POST /reset-password',
      'GET /debug-codes'
    ]
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Dnest Email API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`📧 SMTP Configured: ${!!(process.env.SMTP_USER || process.env.EMAIL_USER)}`);
  console.log(`✅ Server ready to send professional verification emails!`);
});

// Clean up expired codes every hour
setInterval(() => {
  const now = Date.now();
  let cleanedCodes = 0;
  let cleanedTokens = 0;
  
  for (let [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
      cleanedCodes++;
    }
  }
  
  for (let [token, data] of resetTokens.entries()) {
    if (now > data.expires) {
      resetTokens.delete(token);
      cleanedTokens++;
    }
  }
  
  if (cleanedCodes > 0 || cleanedTokens > 0) {
    console.log(`🧹 Cleaned up ${cleanedCodes} expired verification codes and ${cleanedTokens} expired reset tokens`);
  }
}, 60 * 60 * 1000);