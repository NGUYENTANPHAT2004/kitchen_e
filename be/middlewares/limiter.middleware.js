// middlewares/limiter.middleware.js
const rateLimit = require("express-rate-limit");
let RedisStore;
let Redis;
let redisClient;

if (process.env.REDIS_URL) {
  try {
    // Dùng ioredis
    Redis = require("ioredis");
    redisClient = new Redis(process.env.REDIS_URL);
    RedisStore = require("rate-limit-redis").RedisStore;
    redisClient.on("error", (error) =>
      console.error("Rate limiter Redis error:", error.message)
    );
  } catch (err) {
    console.error("Không thể khởi tạo Redis:", err);
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
  message = "Quá nhiều yêu cầu, vui lòng thử lại sau.",
  skipSuccessfulRequests = false,
  prefix = "kitchen:limit:default:",
} = {}) => {
  const config = {
    windowMs,
    max,
    message: {
      success: false,
      error: message,
    },
    skipSuccessfulRequests,
    standardHeaders: true, // Trả về rate limit info trong headers
    legacyHeaders: false, // Disable các headers X-RateLimit-*
  };

  // Sử dụng Redis store nếu đã cấu hình
  if (redisClient && RedisStore) {
    config.store = new RedisStore({
      prefix,
      sendCommand: (...args) => redisClient.call(...args),
    });
  }

  return rateLimit(config);
};

// Limiter mặc định cho toàn bộ API
const defaultLimiter = createLimiter({
  max: Number(process.env.API_RATE_LIMIT_MAX) || 1000,
  skipSuccessfulRequests: true,
});

// Limiter nghiêm ngặt hơn cho các route xác thực
const authLimiter = createLimiter({
  prefix: "kitchen:limit:auth:",
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 10, // 10 yêu cầu mỗi IP trong 1 giờ
  message: "Quá nhiều yêu cầu, vui lòng thử lại sau 1 giờ.",
});

// Limiter cho các API sản phẩm
const productsLimiter = createLimiter({
  prefix: "kitchen:limit:products:",
  windowMs: 5 * 60 * 1000, // 5 phút
  max: 200, // 200 requests mỗi IP
  skipSuccessfulRequests: true, // Chỉ đếm các request không thành công
});

module.exports = {
  defaultLimiter,
  authLimiter,
  productsLimiter,
  createLimiter,
};
