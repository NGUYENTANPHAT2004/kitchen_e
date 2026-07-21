// middlewares/limiter.middleware.js
const rateLimit = require('express-rate-limit');
let RedisStore;
let Redis;
let redisClient;

if (process.env.REDIS_URL) {
  try {
    // Dùng ioredis
    Redis = require('ioredis');
    redisClient = new Redis(process.env.REDIS_URL);
    // Thử import cho version 3.x (function export)
    try {
      RedisStore = require('rate-limit-redis');
    } catch (e) {
      // Nếu không được, thử import kiểu named export (v2.x)
      RedisStore = require('rate-limit-redis').RateLimitRedisStore;
    }
  } catch (err) {
    console.error('Không thể khởi tạo Redis:', err);
  }
}

/**
 * Tạo rate limiter
 * @param {Object} options - Tùy chọn rate limit
 * @param {Number} options.windowMs - Cửa sổ thời gian (ms)
 * @param {Number} options.max - Số lượng requests tối đa trong cửa sổ thời gian
 * @param {String} options.message - Thông báo khi đạt giới hạn
 * @param {Boolean} options.skipSuccessfulRequests - Có bỏ qua các request thành công không
 */
const createLimiter = ({
  windowMs = 15 * 60 * 1000, // 15 phút
  max = 100, // 100 requests mỗi IP
  message = 'Quá nhiều yêu cầu, vui lòng thử lại sau.',
  skipSuccessfulRequests = false
} = {}) => {
  const config = {
    windowMs,
    max,
    message: {
      success: false,
      error: message
    },
    skipSuccessfulRequests,
    standardHeaders: true, // Trả về rate limit info trong headers
    legacyHeaders: false, // Disable các headers X-RateLimit-*
  };

  // Sử dụng Redis store nếu đã cấu hình
  if (redisClient && RedisStore) {
    // Tùy phiên bản, RedisStore có thể là function hoặc class
    try {
      config.store = typeof RedisStore === 'function'
        ? RedisStore({ sendCommand: (...args) => redisClient.call(...args) })
        : new RedisStore({ sendCommand: (...args) => redisClient.call(...args) });
    } catch (e) {
      // Nếu lỗi, thử cách còn lại
      try {
        config.store = new RedisStore({ sendCommand: (...args) => redisClient.call(...args) });
      } catch (e2) {
        config.store = RedisStore({ sendCommand: (...args) => redisClient.call(...args) });
      }
    }
  }

  return rateLimit(config);
};

// Limiter mặc định cho toàn bộ API
const defaultLimiter = createLimiter({
  max: Number(process.env.API_RATE_LIMIT_MAX) || 1000,
  skipSuccessfulRequests: true
});

// Limiter nghiêm ngặt hơn cho các route xác thực
const authLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 10, // 10 yêu cầu mỗi IP trong 1 giờ
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 1 giờ.'
});

// Limiter cho các API sản phẩm
const productsLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 phút
  max: 200, // 200 requests mỗi IP
  skipSuccessfulRequests: true // Chỉ đếm các request không thành công
});

module.exports = {
  defaultLimiter,
  authLimiter,
  productsLimiter,
  createLimiter
};