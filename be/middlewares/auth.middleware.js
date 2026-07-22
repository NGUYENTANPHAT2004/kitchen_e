// middlewares/auth.middleware.js - FIXED VERSION
const passport = require('passport');
const ApiError = require('../utils/apiError');
const rateLimit = require('express-rate-limit');

// 🔧 FIX 1: Rate limiting cho auth endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 🔧 Skip rate limiting for successful requests
  skipSuccessfulRequests: true,
  // 🔧 Custom key generator (có thể dùng user ID thay vì IP)
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

// 🔧 NEW: Rate limiting for /me endpoint (more lenient)
const meRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: {
      message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// 🔧 NEW: General rate limiting for other endpoints
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    success: false,
    error: {
      message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

/**
 * 🔧 FIX 2: Improved protect middleware với detailed logging
 */
exports.protect = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    // 🔧 Log authentication attempts
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    if (err) {
      console.error('❌ Auth Error:', {
        error: err.message,
        ip: clientIP,
        userAgent: userAgent,
        url: req.originalUrl,
        timestamp: new Date().toISOString()
      });
      return next(new ApiError('Lỗi xác thực', 500));
    }
    
    if (!user) {
      // 🔧 Log failed authentication attempts
      console.warn('🚫 Authentication Failed:', {
        reason: info?.message || 'Token invalid',
        ip: clientIP,
        userAgent: userAgent,
        url: req.originalUrl,
        timestamp: new Date().toISOString()
      });
      
      return next(
        new ApiError('Bạn cần đăng nhập để truy cập tính năng này', 401)
      );
    }
    
    // 🔧 FIX 3: Additional security checks
    
    // ✅ Check if account is locked
    if (user.isLocked && user.lockUntil && user.lockUntil > Date.now()) {
      console.warn('🔒 Account Locked:', {
        userId: user._id,
        lockUntil: user.lockUntil,
        ip: clientIP,
        timestamp: new Date().toISOString()
      });
      return next(new ApiError('Tài khoản đã bị khóa tạm thời', 423));
    }
    
    // ✅ Check for suspicious activity (optional)
    if (shouldCheckSuspiciousActivity(req, user)) {
      console.warn('⚠️ Suspicious Activity:', {
        userId: user._id,
        ip: clientIP,
        userAgent: userAgent,
        timestamp: new Date().toISOString()
      });
      // Could implement additional verification here
    }
    
    // 🔧 Log successful authentication
    console.log('✅ Authentication Success:', {
      userId: user._id,
      username: user.username,
      ip: clientIP,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
    
    // ✅ Set last activity
    user.lastActivity = new Date();
    user.save({ validateBeforeSave: false }).catch(err => {
      console.error('Failed to update last activity:', err);
    });
    
    // Gán thông tin người dùng vào request
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * 🔧 FIX 4: Enhanced optional auth middleware
 */
exports.optionalAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err) {
      console.error('Optional auth error:', err);
    }
    
    if (user) {
      // ✅ Basic checks for optional auth
      if (!user.isDeleted && (!user.isLocked || !user.lockUntil || user.lockUntil <= Date.now())) {
        req.user = user;
        
        // Update last activity for authenticated users
        user.lastActivity = new Date();
        user.save({ validateBeforeSave: false }).catch(err => {
          console.error('Failed to update last activity:', err);
        });
      }
    }
    next();
  })(req, res, next);
};

/**
 * 🔧 FIX 5: Enhanced role authorization với better logging
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    console.log('=== AUTHORIZE DEBUG ===');
    console.log('Required roles:', roles);
    console.log('User object:', req.user ? { id: req.user._id, role: req.user.role } : null);
    console.log('User role:', req.user?.role);
    console.log('User role type:', typeof req.user?.role);
    console.log('Roles includes check:', roles.includes(req.user?.role));
    
    if (!req.user) {
      console.warn('🚫 Authorization Failed - No User:', {
        url: req.originalUrl,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      return next(
        new ApiError('Bạn cần đăng nhập để truy cập tính năng này', 401)
      );
    }
    
    if (!roles.includes(req.user.role)) {
      console.warn('🚫 Authorization Failed - Insufficient Role:', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        url: req.originalUrl,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      return next(
        new ApiError('Bạn không có quyền truy cập tính năng này', 403)
      );
    }
    
    console.log('✅ Authorization Success:', {
      userId: req.user._id,
      userRole: req.user.role,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
    
    next();
  };
};

/**
 * 🔧 FIX 6: Enhanced owner or admin authorization
 */
exports.authorizeOwnerOrAdmin = (paramName = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new ApiError('Bạn cần đăng nhập để truy cập tính năng này', 401)
      );
    }
    
    // Admin có toàn quyền truy cập
    if (req.user.role === 'admin') {
      console.log('✅ Admin Access Granted:', {
        adminId: req.user._id,
        url: req.originalUrl,
        timestamp: new Date().toISOString()
      });
      return next();
    }
    
    // Người dùng chỉ được truy cập tài nguyên của chính họ
    const resourceUserId = req.params[paramName];
    
    if (resourceUserId && resourceUserId !== req.user.id) {
      console.warn('🚫 Resource Access Denied:', {
        userId: req.user._id,
        attemptedResource: resourceUserId,
        url: req.originalUrl,
        timestamp: new Date().toISOString()
      });
      return next(
        new ApiError('Bạn không có quyền truy cập tài nguyên này', 403)
      );
    }
    
    console.log('✅ Owner Access Granted:', {
      userId: req.user._id,
      resource: resourceUserId,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
    
    next();
  };
};

/**
 * 🔧 NEW: Email verification required middleware
 */
exports.requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError('Bạn cần đăng nhập để truy cập tính năng này', 401));
  }
  
  if (!req.user.isEmailVerified) {
    return next(new ApiError('Bạn cần xác thực email để sử dụng tính năng này', 403));
  }
  
  next();
};

/**
 * 🔧 NEW: Account status check middleware
 */
exports.checkAccountStatus = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError('Bạn cần đăng nhập để truy cập tính năng này', 401));
  }
  
  // Check if account is deleted
  if (req.user.isDeleted) {
    return next(new ApiError('Tài khoản đã bị xóa', 410));
  }
  
  // Check if account is locked
  if (req.user.isLocked && req.user.lockUntil && req.user.lockUntil > Date.now()) {
    const unlockTime = new Date(req.user.lockUntil).toLocaleString('vi-VN');
    return next(new ApiError(`Tài khoản bị khóa đến ${unlockTime}`, 423));
  }
  
  next();
};

/**
 * 🔧 Helper function: Check for suspicious activity
 */
function shouldCheckSuspiciousActivity(req, user) {
  // Simple suspicious activity detection
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  
  // Check if IP has changed dramatically from last login
  if (user.lastLoginIP && user.lastLoginIP !== clientIP) {
    // Could implement geo-IP checking here
    return true;
  }
  
  // Check for unusual user agent patterns
  if (userAgent && (
    userAgent.includes('curl') || 
    userAgent.includes('wget') || 
    userAgent.includes('bot')
  )) {
    return true;
  }
  
  return false;
}

// 🔧 Export rate limiting
exports.authRateLimit = authRateLimit;
exports.meRateLimit = meRateLimit;
exports.generalRateLimit = generalRateLimit;

// 🔧 NEW: Create combined middleware for common auth patterns
exports.protectWithRateLimit = [authRateLimit, exports.protect];
exports.adminOnly = [exports.protect, exports.authorize('admin')];
exports.staffOrAdmin = [exports.protect, exports.authorize('staff', 'admin')];
exports.verifiedUsersOnly = [exports.protect, exports.requireEmailVerification];

// 🔧 NEW: Debug middleware functions
exports.debugJWT = (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
    
    const jwt = require('jsonwebtoken');
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
      reason: error.message
    });
  }
};

exports.testAuth = (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful',
    user: {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      isEmailVerified: req.user.isEmailVerified
    },
    auth: {
      token: req.headers.authorization?.split(' ')[1],
      timestamp: new Date().toISOString()
    }
  });
};

exports.debugAuth = (req, res) => {
  res.json({
    success: true,
    message: 'Auth debug info',
    request: {
      headers: {
        authorization: req.headers.authorization ? 'Bearer [REDACTED]' : undefined,
        'user-agent': req.headers['user-agent']
      },
      ip: req.ip,
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body
    },
    auth: {
      isAuthenticated: !!req.user,
      user: req.user ? {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role
      } : null
    },
    timestamp: new Date().toISOString()
  });
};