// routes/api/auth.routes.js - COMPLETE FIX
const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../../controllers/auth.controller');
const { 
  protect, 
  authRateLimit, 
  meRateLimit, 
  generalRateLimit,
  debugJWT,
  testAuth,
} = require('../../middlewares/auth.middleware');

// 🔧 FIXED: Apply appropriate rate limits to different endpoints

// Strict rate limiting for login/register (security critical)
router.post('/register', authRateLimit, authController.register);
router.post('/login', authRateLimit, authController.login);

// 🔧 FIXED: More lenient rate limiting for /me endpoint (called frequently)
router.get('/me', meRateLimit, protect, authController.getMe);

// General rate limiting for account management
router.get('/logout', protect, authController.logout);
router.put('/me', generalRateLimit, protect, authController.updateMe);
router.put('/password', generalRateLimit, protect, authController.updatePassword);

// Moderate rate limiting for password reset (security sensitive)
router.post('/forgot-password', authRateLimit, authController.forgotPassword);
router.post('/reset-password/:token', authRateLimit, authController.resetPassword);

// General rate limiting for email verification
router.get('/verify-email/:token', generalRateLimit, authController.verifyEmail);
router.post('/resend-verification', generalRateLimit, protect, authController.resendVerification);

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
router.get('/google/callback', authController.googleCallback);

router.get(
  '/facebook',
  passport.authenticate('facebook', { scope: ['email', 'public_profile'] })
);
router.get('/facebook/callback', authController.facebookCallback);

// General rate limiting for account linking
router.get('/link/google', protect, authController.linkGoogle);
router.get('/link/facebook', protect, authController.linkFacebook);

// 🔧 NEW: Debug endpoints (only in development)
if (process.env.NODE_ENV === 'development') {
  // Test server health (no auth needed)
  router.get('/debug/health', (req, res) => {
    res.json({
      success: true,
      message: 'Auth service is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      jwt: {
        secretConfigured: !!process.env.JWT_SECRET,
        secretLength: process.env.JWT_SECRET?.length || 0
      }
    });
  });

  // Test JWT verification (with auth header)
  router.get('/debug/jwt', debugJWT);

  // Test full auth flow (with auth header)
  router.get('/debug/test', protect, testAuth);

  // Manual token validation (POST with token in body)
  router.post('/debug/validate', (req, res) => {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token required in request body'
      });
    }
    
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      res.json({
        success: true,
        message: 'Token is valid',
        decoded: decoded,
        expiresAt: new Date(decoded.exp * 1000),
        isExpired: decoded.exp * 1000 < Date.now(),
        timeUntilExpiry: Math.max(0, decoded.exp * 1000 - Date.now())
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Token validation failed',
        reason: error.message,
        tokenPreview: token?.substring(0, 20) + '...'
      });
    }
  });

  console.log('🔧 Auth debug endpoints enabled:');
  console.log('  - GET /api/auth/debug/health');
  console.log('  - GET /api/auth/debug/jwt (requires auth header)');
  console.log('  - GET /api/auth/debug/test (requires auth header)');
  console.log('  - POST /api/auth/debug/validate (requires token in body)');
}

module.exports = router;