// middlewares/error.middleware.js
const ApiError = require('../utils/apiError');
const { logger } = require('./logger.middleware');

/**
 * Middleware xử lý lỗi trung tâm
 * Xử lý tất cả các lỗi và gửi phản hồi phù hợp
 */
const errorHandler = (err, req, res, _next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log lỗi
  logger.error(`Error: ${error.message}`, {
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    user: req.user ? req.user.id : 'unauthenticated'
  });

  // MongoDB bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Không tìm thấy tài nguyên yêu cầu';
    error = new ApiError(message, 404);
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Giá trị '${err.keyValue[field]}' đã tồn tại cho trường ${field}`;
    error = new ApiError(message, 400);
  }

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ApiError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token không hợp lệ';
    error = new ApiError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token đã hết hạn';
    error = new ApiError(message, 401);
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = `Kích thước file vượt quá giới hạn (tối đa ${process.env.MAX_FILE_SIZE || '5MB'})`;
    error = new ApiError(message, 400);
  }

  // Gửi phản hồi lỗi
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Lỗi máy chủ',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

module.exports = errorHandler;