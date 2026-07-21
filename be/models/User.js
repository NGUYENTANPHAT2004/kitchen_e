// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Vui lòng nhập tên đăng nhập'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Tên đăng nhập phải có ít nhất 3 ký tự'],
      maxlength: [20, 'Tên đăng nhập không được vượt quá 20 ký tự']
    },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập địa chỉ email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/ ,
        'Vui lòng nhập email hợp lệ'
      ]
    },
    password: {
      type: String,
      required: [true, 'Vui lòng nhập mật khẩu'],
      minlength: [8, 'Mật khẩu phải có ít nhất 8 ký tự'],
      select: false // Không trả về mật khẩu khi truy vấn
    },
    firstName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    phoneNumber: {
      type: String,
      trim: true
    },
    avatar: {
      type: String,
      default: 'default-avatar.jpg'
    },
    role: {
      type: String,
      enum: ['customer', 'staff', 'admin'],
      default: 'customer'
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'facebook'],
      default: 'local'
    },
    googleId: {
      type: String
    },
    facebookId: {
      type: String
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    passwordChangedAt: Date,
    isDeleted: {
      type: Boolean,
      default: false
    },
    lastLogin: Date,
    lastActivity: Date,
    avatarPath: String,
    isLocked: {
      type: Boolean,
      default: false
    },
    lockUntil: Date,
    addresses: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId()
        },
        fullName: {
          type: String,
          required: true,
          trim: true
        },
        phone: {
          type: String,
          required: true,
          trim: true
        },
        address: {
          type: String,
          required: true,
          trim: true
        },
        city: {
          type: String,
          required: true,
          trim: true
        },
        state: {
          type: String,
          trim: true
        },
        postalCode: {
          type: String,
          trim: true
        },
        country: {
          type: String,
          default: 'Vietnam',
          trim: true
        },
        isDefault: {
          type: Boolean,
          default: false
        }
      }
    ],
    // ID c?a ??a ch? m?c ??nh trong m?ng addresses (embedded subdocument).
    defaultAddress: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Mã hóa mật khẩu trước khi lưu
UserSchema.pre('save', async function(next) {
  // Chỉ mã hóa lại khi mật khẩu bị thay đổi
  if (!this.isModified('password')) {
    return next();
  }
  
  // Cập nhật thời gian thay đổi mật khẩu
  this.passwordChangedAt = Date.now() - 1000;
  
  // Mã hóa mật khẩu
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Middleware để xử lý soft delete
UserSchema.pre(/^find/, function(next) {
  if (!this.getOptions().includeDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

// Phương thức tạo JWT
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN
    }
  );
};

// Phương thức kiểm tra mật khẩu
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Phương thức tạo token xác thực email
UserSchema.methods.generateEmailVerificationToken = function() {
  // Tạo token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Mã hóa token và lưu vào DB
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  // Thiết lập thời gian hết hạn (24 giờ)
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
  
  return token;
};

// Phương thức tạo token đặt lại mật khẩu
UserSchema.methods.generateResetPasswordToken = function() {
  // Tạo token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Mã hóa token và lưu vào DB
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Thiết lập thời gian hết hạn (10 phút)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

// Virtual field: full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ googleId: 1 });
UserSchema.index({ facebookId: 1 });

module.exports = mongoose.model('User', UserSchema);