const express = require('express');
const router = express.Router();
const aiController = require('../../controllers/ai.controller');
const { protect, optionalAuth, adminOnly } = require('../../middlewares/auth.middleware');

// @route   /api/ai

// POST /api/ai/chat - Xử lý tin nhắn chat (public, lấy userId nếu có)
router.post('/chat', optionalAuth, aiController.processChat);

// GET /api/ai/chat/history - Lấy lịch sử trò chuyện
router.get('/chat/history', optionalAuth, aiController.getChatHistory);

// GET /api/ai/chat/frequent-queries - Các truy vấn phổ biến (admin only)
router.get('/chat/frequent-queries', adminOnly, aiController.getFrequentQueries);

// GET /api/ai/recommendations/personalized - Gợi ý cá nhân hóa (cần đăng nhập)
router.get('/recommendations/personalized', protect, aiController.getPersonalizedRecommendations);

// GET /api/ai/recommendations/similar/:productId - Sản phẩm tương tự (public)
router.get('/recommendations/similar/:productId', aiController.getSimilarProducts);

// GET /api/ai/recipes/:productId - Công thức nấu ăn theo sản phẩm (public)
router.get('/recipes/:productId', aiController.getRecipeRecommendations);

// POST /api/ai/speech - Xử lý giọng nói (public, lấy userId nếu có)
router.post('/speech', optionalAuth, aiController.uploadFile('audio'), aiController.processSpeech);

// POST /api/ai/face/register - Đăng ký khuôn mặt (cần đăng nhập)
router.post('/face/register', protect, aiController.uploadFile('face'), aiController.registerFace);

// POST /api/ai/face/authenticate - Xác thực khuôn mặt (public)
router.post('/face/authenticate', aiController.uploadFile('face'), aiController.authenticateFace);

// GET /api/ai/insights/:userId - Thông tin insight người dùng (cần đăng nhập)
router.get('/insights/:userId', protect, aiController.getUserInsights);

// POST /api/ai/activity - Ghi log hoạt động (public, lấy userId nếu có)
router.post('/activity', optionalAuth, aiController.logUserActivity);

// POST /api/ai/feedback/:logId - Gửi feedback cho phản hồi AI (public)
router.post('/feedback/:logId', optionalAuth, aiController.provideFeedback);

// GET /api/ai/analytics/intent-distribution - Phân phối intent (admin only)
router.get('/analytics/intent-distribution', adminOnly, aiController.getIntentDistribution);

// GET /api/ai/analytics/feedback-stats - Thống kê feedback (admin only)
router.get('/analytics/feedback-stats', adminOnly, aiController.getFeedbackStats);

module.exports = router;
