const express = require("express");
const router = express.Router();
const aiController = require("../../controllers/ai.controller");
const {
  protect,
  optionalAuth,
  adminOnly,
} = require("../../middlewares/auth.middleware");
const AISettings = require("../../models/AISettings");
const asyncHandler = require("../../middlewares/async.middleware");
const ApiResponse = require("../../utils/apiResponse");
const ApiError = require("../../utils/apiError");
const aiService = require("../../services/ai.service");
const training = require("../../controllers/ai-training.controller");
const { createLimiter } = require("../../middlewares/limiter.middleware");

router.get("/status", asyncHandler(async (_req, res) => {
  const settings = await AISettings.current();
  let connected = false;
  if (settings.enabled) {
    try {
      const result = await aiService.axiosInstance.get("/health", { timeout: 2500 });
      connected = result.data?.status === "healthy";
    } catch (_error) { /* The chat UI presents a retry action. */ }
  }
  return ApiResponse.success(res, { enabled: settings.enabled, connected, language: settings.language });
}));

router.get("/admin/conversations", adminOnly, training.conversations);
router.post("/admin/logs/:id/training-example", adminOnly, training.exampleFromLog);
router.get("/training/status", adminOnly, training.forward("get", "/status"));
router.put("/training/settings", adminOnly, training.forward("put", "/settings"));
router.get("/training/intents", adminOnly, training.forward("get", "/intents"));
router.post("/training/intents", adminOnly, training.forward("post", "/intents"));
router.put("/training/intents/:key", adminOnly, training.forward("put", req => `/intents/${encodeURIComponent(req.params.key)}`));
router.delete("/training/intents/:key", adminOnly, training.forward("delete", req => `/intents/${encodeURIComponent(req.params.key)}`));
router.get("/training/examples", adminOnly, training.forward("get", "/examples"));
router.post("/training/examples", adminOnly, training.forward("post", "/examples"));
router.put("/training/examples/:id", adminOnly, training.forward("put", req => `/examples/${encodeURIComponent(req.params.id)}`));
router.delete("/training/examples/:id", adminOnly, training.forward("delete", req => `/examples/${encodeURIComponent(req.params.id)}`));
router.post("/training/train", adminOnly, training.forward("post", "/train"));
router.post("/training/versions/:id/activate", adminOnly, training.forward("post", req => `/versions/${encodeURIComponent(req.params.id)}/activate`));

router.get(
  "/settings",
  adminOnly,
  asyncHandler(async (_req, res) => {
    let connected = false;
    try {
      const response = await aiService.axiosInstance.get("/health", {
        timeout: 2500,
      });
      connected = response.data?.status === "healthy";
    } catch (_error) {
      /* An optional AI service may be offline. */
    }
    const { enabled, language } = await AISettings.current();
    return ApiResponse.success(res, {
      settings: { enabled, language },
      connected,
    });
  })
);
router.put(
  "/settings",
  adminOnly,
  asyncHandler(async (req, res) => {
    const { enabled, language } = req.body;
    if (
      typeof enabled !== "boolean" ||
      !["vi", "en"].includes(language) ||
      Object.keys(req.body).some(
        (key) => !["enabled", "language"].includes(key)
      )
    ) {
      throw new ApiError("Invalid AI settings", 400);
    }
    await AISettings.findOneAndUpdate(
      { key: "assistant" },
      { $set: { enabled, language } },
      { upsert: true, runValidators: true }
    );
    return ApiResponse.success(res, { settings: { enabled, language } });
  })
);

// @route   /api/ai

// POST /api/ai/chat - Xử lý tin nhắn chat (public, lấy userId nếu có)
router.post("/chat", createLimiter({ windowMs: 60000, max: 30, prefix: "kitchen:limit:ai-chat:" }), optionalAuth, aiController.processChat);

// GET /api/ai/chat/history - Lấy lịch sử trò chuyện
router.get("/chat/history", optionalAuth, aiController.getChatHistory);

// GET /api/ai/chat/frequent-queries - Các truy vấn phổ biến (admin only)
router.get(
  "/chat/frequent-queries",
  adminOnly,
  aiController.getFrequentQueries
);

// GET /api/ai/recommendations/personalized - Gợi ý cá nhân hóa (cần đăng nhập)
router.get(
  "/recommendations/personalized",
  protect,
  aiController.getPersonalizedRecommendations
);

// GET /api/ai/recommendations/similar/:productId - Sản phẩm tương tự (public)
router.get(
  "/recommendations/similar/:productId",
  aiController.getSimilarProducts
);

// GET /api/ai/recipes/:productId - Công thức nấu ăn theo sản phẩm (public)
router.get("/recipes/:productId", aiController.getRecipeRecommendations);

// POST /api/ai/speech - Xử lý giọng nói (public, lấy userId nếu có)
router.post(
  "/speech",
  optionalAuth,
  aiController.uploadFile("audio"),
  aiController.processSpeech
);

// POST /api/ai/face/register - Đăng ký khuôn mặt (cần đăng nhập)
router.post(
  "/face/register",
  protect,
  aiController.uploadFile("face"),
  aiController.registerFace
);

// POST /api/ai/face/authenticate - Xác thực khuôn mặt (public)
router.post(
  "/face/authenticate",
  aiController.uploadFile("face"),
  aiController.authenticateFace
);

// GET /api/ai/insights/:userId - Thông tin insight người dùng (cần đăng nhập)
router.get("/insights/:userId", protect, aiController.getUserInsights);

// POST /api/ai/activity - Ghi log hoạt động (public, lấy userId nếu có)
router.post("/activity", optionalAuth, aiController.logUserActivity);

// POST /api/ai/feedback/:logId - Gửi feedback cho phản hồi AI (public)
router.post("/feedback/:logId", optionalAuth, aiController.provideFeedback);

// GET /api/ai/analytics/intent-distribution - Phân phối intent (admin only)
router.get(
  "/analytics/intent-distribution",
  adminOnly,
  aiController.getIntentDistribution
);

// GET /api/ai/analytics/feedback-stats - Thống kê feedback (admin only)
router.get(
  "/analytics/feedback-stats",
  adminOnly,
  aiController.getFeedbackStats
);

module.exports = router;
