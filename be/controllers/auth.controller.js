// controllers/auth.controller.js - FIXED VERSION
const crypto = require('crypto');
const passport = require('passport');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');
const sendEmail = require('../utils/sendEmail');

const validateEnvVars = () => {
  const required = ['JWT_SECRET', 'JWT_EXPIRES_IN', 'JWT_COOKIE_EXPIRE', 'FRONTEND_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  // Validate numeric values
  const cookieExpire = parseInt(process.env.JWT_COOKIE_EXPIRE);
  if (isNaN(cookieExpire)) {
    throw new Error('JWT_COOKIE_EXPIRE must be a number');
  }
};

// Run validation on startup
validateEnvVars();

/**
 * @desc    Đăng ký người dùng mới
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res, next) => {
  const { username, email, password, firstName, lastName } = req.body;

  // 🔧 FIX 2: Better input validation
  if (!username || !email || !password) {
    return next(new ApiError('Username, email và password là bắt buộc', 400));
  }

  // 🔧 FIX 3: Improved duplicate check
  const existingUser = await User.findOne({ 
    $or: [
      { email: email.toLowerCase() }, 
      { username: username.toLowerCase() }
    ],
    isDeleted: false 
  });
  
  if (existingUser) {
    if (existingUser.email === email.toLowerCase()) {
      return next(new ApiError('Email đã được sử dụng', 400));
    } else {
      return next(new ApiError('Tên đăng nhập đã được sử dụng', 400));
    }
  }

  try {
    // Tạo người dùng mới
    const user = await User.create({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      firstName,
      lastName
    });

    // Tạo token xác thực email
    const emailToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Tạo URL xác thực
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailToken}`;

    // 🔧 FIX 4: Better email sending with retry mechanism
    let emailSent = false;
    let emailAttempts = 0;
    const maxEmailAttempts = 3;

    while (!emailSent && emailAttempts < maxEmailAttempts) {
      try {
        console.log(`🚀 Gửi email xác thực (lần thử ${emailAttempts + 1})`);
        
        await sendEmail({
          to: user.email,
          subject: 'Xác thực tài khoản',
          template: 'email-verification',
          context: {
            name: user.firstName || user.username,
            verifyUrl
          }
        });
        
        emailSent = true;
        console.log('✅ Gửi email thành công');
      } catch (emailError) {
        emailAttempts++;
        console.error(`❌ Lỗi gửi email (lần ${emailAttempts}):`, emailError.message);
        
        if (emailAttempts >= maxEmailAttempts) {
          // Cleanup user tokens on final failure
          user.emailVerificationToken = undefined;
          user.emailVerificationExpire = undefined;
          await user.save({ validateBeforeSave: false });
          
          return next(new ApiError('Không thể gửi email xác thực. Vui lòng thử lại sau.', 500));
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * emailAttempts));
      }
    }

    // 🔧 FIX 5: Safer token response with error handling
    try {
      console.log('✅ Gửi email xong, chuẩn bị gửi JWT');
      await sendTokenResponse(user, 201, res);
      console.log('✅ Gửi token xong');
    } catch (tokenError) {
      console.error('❌ Lỗi khi gửi token response:', tokenError);
      
      // Still return success since user was created and email was sent
      return ApiResponse.success(res, { 
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        },
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.'
      }, 'Đăng ký thành công', 201);
    }
    
  } catch (error) {
    console.error('❌ Lỗi trong quá trình đăng ký:', error);
    return next(new ApiError('Đăng ký thất bại. Vui lòng thử lại.', 500));
  }
});

/**
 * @desc    Đăng nhập người dùng
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = (req, res, next) => {
  // 🔧 FIX 6: Input validation for login
  const { email, password } = req.body;
  
  if (!email || !password) {
    return next(new ApiError('Email và password là bắt buộc', 400));
  }

  passport.authenticate('local', async (err, user, info) => {
    if (err) {
      console.error('❌ Passport authentication error:', err);
      return next(new ApiError('Lỗi đăng nhập', 500));
    }

    if (!user) {
      return next(new ApiError(info.message || 'Email hoặc mật khẩu không đúng', 401));
    }

    try {
      // 🔧 FIX 7: Safe user update with validation
      user.lastLogin = new Date();
      user.lastLoginIP = req.ip || req.connection.remoteAddress;
      
      await user.save({ validateBeforeSave: false });
      
      // 🔧 FIX 8: Safe token response
      await sendTokenResponse(user, 200, res);
    } catch (saveError) {
      console.error('❌ Lỗi khi cập nhật thông tin đăng nhập:', saveError);
      return next(new ApiError('Lỗi khi cập nhật thông tin đăng nhập', 500));
    }
  })(req, res, next);
};

/**
 * @desc    Đăng xuất người dùng (xóa cookie ở phía client)
 * @route   GET /api/auth/logout
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res) => {
  // 🔧 FIX 9: Enhanced logout with user activity tracking
  try {
    if (req.user) {
      req.user.lastLogout = new Date();
      await req.user.save({ validateBeforeSave: false });
    }
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật thời gian logout:', error);
    // Don't fail logout for this
  }

  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  return ApiResponse.success(res, null, 'Đăng xuất thành công');
});

/**
 * @desc    Lấy thông tin người dùng hiện tại
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = asyncHandler(async (req, res, next) => {
  // 🔧 FIX 10: Ensure user exists and is active
  const user = await User.findById(req.user.id).select('-password');
  
  if (!user || user.isDeleted) {
    return next(new ApiError('Người dùng không tồn tại', 404));
  }

  return ApiResponse.success(res, { user });
});

/**
 * @desc    Cập nhật thông tin người dùng
 * @route   PUT /api/auth/me
 * @access  Private
 */
exports.updateMe = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, phoneNumber } = req.body;

  // 🔧 FIX 11: Input sanitization and validation
  const fieldsToUpdate = {};
  
  if (firstName !== undefined) {
    fieldsToUpdate.firstName = firstName.trim();
  }
  if (lastName !== undefined) {
    fieldsToUpdate.lastName = lastName.trim();
  }
  if (phoneNumber !== undefined) {
    // Basic phone number validation
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length >= 10 && cleanPhone.length <= 15) {
      fieldsToUpdate.phoneNumber = cleanPhone;
    } else if (phoneNumber === '') {
      fieldsToUpdate.phoneNumber = null;
    } else {
      return next(new ApiError('Số điện thoại không hợp lệ', 400));
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    fieldsToUpdate,
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return next(new ApiError('Người dùng không tồn tại', 404));
  }

  return ApiResponse.success(res, { user });
});

/**
 * @desc    Thay đổi mật khẩu
 * @route   PUT /api/auth/password
 * @access  Private
 */
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // 🔧 FIX 12: Enhanced password validation
  if (!currentPassword || !newPassword) {
    return next(new ApiError('Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới', 400));
  }

  if (newPassword.length < 8) {
    return next(new ApiError('Mật khẩu mới phải có ít nhất 8 ký tự', 400));
  }

  if (currentPassword === newPassword) {
    return next(new ApiError('Mật khẩu mới phải khác mật khẩu hiện tại', 400));
  }

  // Lấy thông tin người dùng kèm mật khẩu
  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return next(new ApiError('Người dùng không tồn tại', 404));
  }

  // Kiểm tra mật khẩu hiện tại
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return next(new ApiError('Mật khẩu hiện tại không đúng', 401));
  }

  // Cập nhật mật khẩu mới
  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  // 🔧 FIX 13: Safe token response
  try {
    await sendTokenResponse(user, 200, res);
  } catch (tokenError) {
    console.error('❌ Lỗi khi gửi token sau cập nhật password:', tokenError);
    return next(new ApiError('Cập nhật mật khẩu thành công nhưng có lỗi khi tạo phiên đăng nhập mới', 500));
  }
});

/**
 * @desc    Quên mật khẩu - gửi email đặt lại
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ApiError('Vui lòng nhập địa chỉ email', 400));
  }

  // 🔧 FIX 14: Case-insensitive email search
  const user = await User.findOne({ 
    email: email.toLowerCase(),
    isDeleted: false 
  });

  if (!user) {
    // 🔧 FIX 15: Don't reveal if email exists - security best practice
    return ApiResponse.success(res, null, 'Nếu email tồn tại, bạn sẽ nhận được email đặt lại mật khẩu');
  }

  // Tạo token đặt lại mật khẩu
  const resetToken = user.generateResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // Tạo URL đặt lại mật khẩu
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  // Gửi email với retry mechanism
  try {
    await sendEmail({
      to: user.email,
      subject: 'Đặt lại mật khẩu',
      template: 'reset-password',
      context: {
        name: user.firstName || user.username,
        resetUrl,
        expireTime: '10 phút'
      }
    });

    return ApiResponse.success(res, null, 'Email đặt lại mật khẩu đã được gửi');
  } catch (error) {
    console.error('❌ Lỗi gửi email reset password:', error);
    
    // Nếu có lỗi khi gửi email, xóa token và báo lỗi
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ApiError('Không thể gửi email đặt lại mật khẩu', 500));
  }
});

/**
 * @desc    Đặt lại mật khẩu
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token || !password) {
    return next(new ApiError('Thiếu thông tin bắt buộc', 400));
  }

  // 🔧 FIX 16: Enhanced password validation
  if (password.length < 8) {
    return next(new ApiError('Mật khẩu phải có ít nhất 8 ký tự', 400));
  }

  // Mã hóa token để so sánh với token trong DB
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Tìm người dùng theo token và kiểm tra hạn của token
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
    isDeleted: false
  });

  if (!user) {
    return next(new ApiError('Token không hợp lệ hoặc đã hết hạn', 400));
  }

  // Đặt mật khẩu mới
  user.password = password;
  user.passwordChangedAt = new Date();
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  return ApiResponse.success(res, null, 'Đặt lại mật khẩu thành công');
});

/**
 * @desc    Xác thực email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return next(new ApiError('Thiếu token xác thực', 400));
  }

  // Mã hóa token để so sánh với token trong DB
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Tìm người dùng theo token và kiểm tra hạn của token
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpire: { $gt: Date.now() },
    isDeleted: false
  });

  if (!user) {
    return next(new ApiError('Token không hợp lệ hoặc đã hết hạn', 400));
  }

  // Xác thực email
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  user.emailVerifiedAt = new Date(); // 🔧 FIX 17: Track verification time
  await user.save({ validateBeforeSave: false });

  return ApiResponse.success(res, null, 'Xác thực email thành công');
});

/**
 * @desc    Gửi lại email xác thực
 * @route   POST /api/auth/resend-verification
 * @access  Private
 */
exports.resendVerification = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ApiError('Người dùng không tồn tại', 404));
  }

  if (user.isEmailVerified) {
    return next(new ApiError('Email của bạn đã được xác thực', 400));
  }

  // 🔧 FIX 18: Rate limiting for resend verification
  const lastSent = user.emailVerificationTokenSentAt;
  const now = new Date();
  const timeDiff = now - lastSent;
  const minInterval = 60000; // 1 minute

  if (lastSent && timeDiff < minInterval) {
    const remainingTime = Math.ceil((minInterval - timeDiff) / 1000);
    return next(new ApiError(`Vui lòng đợi ${remainingTime} giây trước khi gửi lại`, 429));
  }

  // Tạo token xác thực mới
  const emailToken = user.generateEmailVerificationToken();
  user.emailVerificationTokenSentAt = now;
  await user.save({ validateBeforeSave: false });

  // Tạo URL xác thực
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailToken}`;

  // Gửi email
  try {
    console.log('🚀 Bắt đầu gửi lại email xác thực');
  
    await sendEmail({
      to: user.email,
      subject: 'Xác thực tài khoản',
      template: 'email-verification',
      context: {
        name: user.firstName || user.username,
        verifyUrl
      }
    });
  
    console.log('✅ Gửi email xong');
    return ApiResponse.success(res, null, 'Email xác thực đã được gửi lại');
  } catch (error) {
    console.error('❌ Lỗi chi tiết:', error);
    
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });
  
    return next(new ApiError('Lỗi xử lý sau khi gửi email: ' + error.message, 500));
  }
});

/**
 * @desc    Xác thực Google OAuth - callback
 * @route   GET /api/auth/google/callback
 * @access  Public
 */
exports.googleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, user) => {
    if (err || !user) {
      console.error('❌ Google OAuth error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
    }

    try {
      // Tạo JWT
      const token = user.getSignedJwtToken();

      // 🔧 FIX 19: Update login information for OAuth
      user.lastLogin = new Date();
      user.lastLoginIP = req.ip || req.connection.remoteAddress;
      await user.save({ validateBeforeSave: false });

      // Redirect về frontend kèm token
      return res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${token}`);
    } catch (tokenError) {
      console.error('❌ Error generating token for Google OAuth:', tokenError);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_generation_failed`);
    }
  })(req, res, next);
};

/**
 * @desc    Xác thực Facebook OAuth - callback
 * @route   GET /api/auth/facebook/callback
 * @access  Public
 */
exports.facebookCallback = (req, res, next) => {
  passport.authenticate('facebook', { session: false }, async (err, user) => {
    if (err || !user) {
      console.error('❌ Facebook OAuth error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=facebook_auth_failed`);
    }

    try {
      // Tạo JWT
      const token = user.getSignedJwtToken();

      // 🔧 FIX 20: Update login information for OAuth
      user.lastLogin = new Date();
      user.lastLoginIP = req.ip || req.connection.remoteAddress;
      await user.save({ validateBeforeSave: false });

      // Redirect về frontend kèm token
      return res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${token}`);
    } catch (tokenError) {
      console.error('❌ Error generating token for Facebook OAuth:', tokenError);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_generation_failed`);
    }
  })(req, res, next);
};

/**
 * @desc    Liên kết tài khoản Google
 * @route   GET /api/auth/link/google
 * @access  Private
 */
exports.linkGoogle = (req, res, next) => {
  req.session.linkProvider = true;
  req.session.userId = req.user.id;
  
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next);
};

/**
 * @desc    Liên kết tài khoản Facebook
 * @route   GET /api/auth/link/facebook
 * @access  Private
 */
exports.linkFacebook = (req, res, next) => {
  req.session.linkProvider = true;
  req.session.userId = req.user.id;
  
  passport.authenticate('facebook', {
    scope: ['email', 'public_profile']
  })(req, res, next);
};

/**
 * 🔧 FIX 21: Enhanced sendTokenResponse with comprehensive error handling
 */
const sendTokenResponse = async (user, statusCode, res) => {
  try {
    // Validate inputs
    if (!user || !user.getSignedJwtToken) {
      throw new Error('Invalid user object');
    }

    if (!res || typeof res.status !== 'function') {
      throw new Error('Invalid response object');
    }

    // Tạo token
    const token = user.getSignedJwtToken();
    if (!token) {
      throw new Error('Failed to generate JWT token');
    }
    
    console.log('✅ JWT token đã được tạo');

    // Thiết lập cookie với validation
    const cookieExpire = parseInt(process.env.JWT_COOKIE_EXPIRE);
    if (isNaN(cookieExpire)) {
      throw new Error('Invalid JWT_COOKIE_EXPIRE value');
    }

    const options = {
      expires: new Date(Date.now() + cookieExpire * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    };

    console.log('✅ Chuẩn bị gửi response');

    // 🔧 FIX 22: Safe user data serialization
    const userResponse = {
      id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      avatar: user.avatar || null,
      phoneNumber: user.phoneNumber || null
    };

    res
      .status(statusCode)
      .cookie('token', token, options)
      .json({
        success: true,
        token,
        user: userResponse
      });
      
    console.log('✅ Gửi token response thành công');
  } catch (error) {
    console.error('❌ Lỗi trong sendTokenResponse:', error);
    throw new Error(`Token response error: ${error.message}`);
  }
};