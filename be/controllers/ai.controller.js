// controllers/ai.controller.js
const mongoose = require('mongoose');
const asyncHandler = require('../middlewares/async.middleware');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const imageService = require('../utils/imageService');
const s3Service = require('../utils/s3Service');
const socketService = require('../services/socket.service');
const aiService = require('../services/ai.service');
const User = require('../models/User');
const AIAssistantLog = require('../models/AIAssistantLog');
const Product = require('../models/Product');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Xác định môi trường lưu trữ
const storageType = process.env.STORAGE_TYPE || 'local';

// Cấu hình multer cho tải lên file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Thêm timestamp để tránh trùng tên file
    cb(null, `${Date.now()}-${uuidv4()}-${file.originalname}`);
  }
});

// Cấu hình bộ lọc file
const fileFilter = (req, file, cb) => {
  // Chấp nhận hình ảnh và audio
  if (file.mimetype.startsWith('image/') || 
      file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new ApiError('Chỉ chấp nhận file hình ảnh hoặc âm thanh', 400), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Giới hạn 10MB
  },
  fileFilter: fileFilter
});

/**
 * Middleware upload file cho các loại file khác nhau
 */
exports.uploadFile = (type) => {
  switch (type) {
    case 'image':
      return upload.single('image');
    case 'audio':
      return upload.single('audio');
    case 'face':
      return upload.single('face_image');
    default:
      return upload.single('file');
  }
};

/**
 * Xử lý tin nhắn chat với AI assistant
 * @route POST /api/ai/chat
 * @access Public
 */
exports.processChat = asyncHandler(async (req, res, next) => {
  // Đánh dấu thời gian bắt đầu để tính thời gian xử lý
  const startTime = Date.now();
  
  const { message, sessionId, language } = req.body;
  
  // Xác thực đầu vào
  if (!message) {
    return next(new ApiError('Vui lòng nhập tin nhắn', 400));
  }
  
  // Lấy user ID nếu đã xác thực
  const userId = req.user ? req.user.id : null;
  
  try {
    // Tạo sessionId mới nếu không có
    const chatSessionId = sessionId || uuidv4();
    
    // Gửi thông báo đang xử lý qua socket nếu người dùng đang online
    if (userId && socketService.isUserOnline(userId)) {
      socketService.notifyUser(userId, {
        type: 'ai_processing',
        title: 'Đang xử lý',
        content: 'AI đang xử lý yêu cầu của bạn...'
      });
    }
    
    // Xử lý chat qua AI service
    const response = await aiService.processChat(message, userId, chatSessionId, language);
    
    // Tính thời gian xử lý
    const processingTime = Date.now() - startTime;
    
    // Lưu vào AIAssistantLog
    const logData = {
      userId: userId ? new mongoose.Types.ObjectId(userId) : null,
      sessionId: chatSessionId,
      query: message,
      response: response.response,
      intentType: response.intent_type || 'general', // Map từ AI service
      querySource: 'text',
      deviceInfo: req.headers['user-agent'] ? { userAgent: req.headers['user-agent'] } : {},
      responseTime: processingTime
    };
    
    // Tạo log AI Assistant
    const aiLog = await AIAssistantLog.create(logData);
    
    // Gửi sự kiện socket về kết quả chat nếu người dùng đang online
    if (userId && socketService.isUserOnline(userId)) {
      socketService.notifyRoom(`user:${userId}`, 'chat:response', {
        sessionId: chatSessionId,
        message: message,
        response: response.response,
        intentType: response.intent_type,
        timestamp: new Date()
      });
    }
    
    // Thêm ID của log vào response để client có thể gửi feedback
    response.log_id = aiLog._id;
    response.session_id = chatSessionId;
    
    return ApiResponse.success(res, response);
  } catch (error) {
    console.error('Error in AI chat processing:', error);
    
    // Log lỗi vào AIAssistantLog
    if (message) {
      await AIAssistantLog.create({
        userId: userId ? new mongoose.Types.ObjectId(userId) : null,
        sessionId: sessionId || uuidv4(),
        query: message,
        response: 'Error: ' + (error.message || 'Lỗi không xác định'),
        intentType: 'error',
        querySource: 'text',
        responseTime: Date.now() - startTime
      });
    }
    
    return next(new ApiError(error.message || 'Lỗi xử lý AI chat', 500));
  }
});

/**
 * Lấy gợi ý sản phẩm cá nhân hóa
 * @route GET /api/ai/recommendations/personalized
 * @access Private
 */
exports.getPersonalizedRecommendations = asyncHandler(async (req, res, next) => {
  // Lấy user ID từ người dùng đã xác thực
  const userId = req.user.id;
  
  // Lấy tham số từ query
  const { limit, includeViewed, categoryId } = req.query;
  
  try {
    // Tạo tùy chọn cho request
    const options = {
      limit: parseInt(limit) || 10,
      includeViewed: includeViewed === 'true',
      categoryId: categoryId
    };
    
    // Gọi AI service để lấy gợi ý
    const response = await aiService.getPersonalizedRecommendations(userId, options);
    
    // Log tương tác AI
    await AIAssistantLog.create({
      userId: new mongoose.Types.ObjectId(userId),
      query: `Yêu cầu gợi ý sản phẩm cá nhân hóa${categoryId ? ' cho danh mục ' + categoryId : ''}`,
      response: `Đã gợi ý ${response.products?.length || 0} sản phẩm`,
      intentType: 'product_recommendation',
      querySource: 'api'
    });
    
    return ApiResponse.success(res, response);
  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    return next(new ApiError(error.message || 'Lỗi lấy gợi ý sản phẩm', 500));
  }
});

/**
 * Lấy sản phẩm tương tự
 * @route GET /api/ai/recommendations/similar/:productId
 * @access Public
 */
exports.getSimilarProducts = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;
  const { limit } = req.query;
  
  // Kiểm tra sản phẩm tồn tại
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError('Sản phẩm không tồn tại', 404));
  }
  
  try {
    // Gọi AI service
    const response = await aiService.getSimilarProducts(
      productId,
      parseInt(limit) || 10
    );
    
    // Log tương tác AI (không yêu cầu userId)
    await AIAssistantLog.create({
      sessionId: uuidv4(),
      query: `Tìm sản phẩm tương tự với sản phẩm ${productId} (${product.name})`,
      response: `Đã tìm thấy ${response.products?.length || 0} sản phẩm tương tự`,
      intentType: 'product_recommendation',
      querySource: 'api'
    });
    
    return ApiResponse.success(res, response);
  } catch (error) {
    console.error('Error getting similar products:', error);
    return next(new ApiError(error.message || 'Lỗi tìm sản phẩm tương tự', 500));
  }
});

/**
 * Lấy công thức nấu ăn cho một sản phẩm
 * @route GET /api/ai/recipes/:productId
 * @access Public
 */
exports.getRecipeRecommendations = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;
  const { limit } = req.query;
  
  // Kiểm tra sản phẩm tồn tại
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError('Sản phẩm không tồn tại', 404));
  }
  
  try {
    // Gọi AI service
    const response = await aiService.getRecipeRecommendations(
      productId,
      parseInt(limit) || 5
    );
    
    // Log tương tác AI
    await AIAssistantLog.create({
      sessionId: uuidv4(),
      query: `Tìm công thức nấu ăn phù hợp với sản phẩm ${productId} (${product.name})`,
      response: `Đã tìm thấy ${response.recipes?.length || 0} công thức nấu ăn`,
      intentType: 'cooking_tips',
      querySource: 'api'
    });
    
    return ApiResponse.success(res, response);
  } catch (error) {
    console.error('Error getting recipe recommendations:', error);
    return next(new ApiError(error.message || 'Lỗi tìm công thức nấu ăn', 500));
  }
});

/**
 * Xử lý giọng nói và nhận phản hồi từ AI
 * @route POST /api/ai/speech
 * @access Public
 */
exports.processSpeech = asyncHandler(async (req, res, next) => {
  // Đánh dấu thời gian bắt đầu
  const startTime = Date.now();
  
  if (!req.file) {
    return next(new ApiError('File audio là bắt buộc', 400));
  }
  
  const audioFilePath = req.file.path;
  const { respondWithVoice, sessionId } = req.body;
  
  // Lấy user ID nếu đã xác thực
  const userId = req.user ? req.user.id : null;
  
  try {
    // Đọc file audio
    let audioBuffer;
    
    if (storageType === 's3' && req.file.location) {
      // Nếu file ở S3, sử dụng S3 service để lấy
      const s3Response = await s3Service.downloadFile(req.file.key);
      audioBuffer = s3Response.data;
    } else {
      // Đọc file local
      audioBuffer = fs.readFileSync(audioFilePath);
    }
    
    // Tạo sessionId mới nếu chưa có
    const chatSessionId = sessionId || uuidv4();
    
    // Thông báo đang xử lý qua socket nếu cần
    if (userId && socketService.isUserOnline(userId)) {
      socketService.notifyUser(userId, {
        type: 'ai_speech_processing',
        title: 'Đang xử lý',
        content: 'AI đang nhận dạng giọng nói của bạn...'
      });
    }
    
    // Xử lý giọng nói qua AI service
    const response = await aiService.processSpeech(
      audioBuffer,
      userId,
      chatSessionId,
      respondWithVoice === 'true'
    );
    
    // Tính thời gian xử lý
    const processingTime = Date.now() - startTime;
    
    // Log tương tác AI nếu AI đã nhận dạng được văn bản
    if (response.recognized_text) {
      await AIAssistantLog.create({
        userId: userId ? new mongoose.Types.ObjectId(userId) : null,
        sessionId: chatSessionId,
        query: response.recognized_text,
        response: response.response || 'Không có phản hồi',
        intentType: response.intent_type || 'general',
        querySource: 'voice',
        responseTime: processingTime,
        deviceInfo: req.headers['user-agent'] ? { userAgent: req.headers['user-agent'] } : {}
      });
    }
    
    // Dọn dẹp file tạm
    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
    }
    
    // Nếu yêu cầu phản hồi bằng giọng nói
    if (respondWithVoice === 'true' && response.audio_content) {
      // Trả về file audio
      res.setHeader('Content-Type', 'audio/mp3');
      res.setHeader('Content-Disposition', 'attachment; filename=response.mp3');
      return res.send(Buffer.from(response.audio_content, 'base64'));
    }
    
    // Trả về kết quả JSON
    return ApiResponse.success(res, response);
  } catch (error) {
    // Đảm bảo dọn dẹp file tạm
    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
    }
    
    console.error('Error processing speech:', error);
    return next(new ApiError(error.message || 'Lỗi xử lý giọng nói', 500));
  }
});

/**
 * Đăng ký khuôn mặt cho xác thực
 * @route POST /api/ai/face/register
 * @access Private
 */
exports.registerFace = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError('Hình ảnh khuôn mặt là bắt buộc', 400));
  }
  
  const imageFilePath = req.file.path;
  
  // Mặc định lấy ID người dùng hiện tại, có thể ghi đè nếu là admin
  let userId = req.user.id;
  
  // Nếu cung cấp user_id và người dùng là admin, cho phép đăng ký cho người khác
  if (req.body.user_id && req.user.role === 'admin') {
    userId = req.body.user_id;
  }
  
  const overrideExisting = req.body.override_existing === 'true';
  
  try {
    // Kiểm tra user tồn tại
    const user = await User.findById(userId);
    if (!user) {
      return next(new ApiError('Người dùng không tồn tại', 404));
    }
    
    // Xử lý hình ảnh trước khi gửi đến AI service
    let imageBuffer;
    let processedImageInfo;
    
    if (storageType === 's3' && req.file.location) {
      // Nếu file đã ở S3, lấy từ S3
      const s3Response = await s3Service.downloadFile(req.file.key);
      imageBuffer = s3Response.data;
    } else {
      // Xử lý ảnh local
      processedImageInfo = await imageService.processImage(req.file, 'uploads/faces', {
        width: 640,  // Kích thước phù hợp cho nhận diện khuôn mặt
        height: 640,
        quality: 90
      });
      
      // Đọc file đã xử lý
      imageBuffer = fs.readFileSync(processedImageInfo.path);
    }
    
    // Gọi AI service để đăng ký khuôn mặt
    const response = await aiService.registerFace(
      userId,
      imageBuffer,
      overrideExisting
    );
    
    // Log tương tác AI
    await AIAssistantLog.create({
      userId: new mongoose.Types.ObjectId(userId),
      query: 'Face registration request',
      response: response.success ? 'Face registered successfully' : 'Face registration failed',
      intentType: 'face_auth',
      querySource: 'api'
    });
    
    // Dọn dẹp file tạm nếu cần
    if (fs.existsSync(imageFilePath)) {
      fs.unlinkSync(imageFilePath);
    }
    
    return ApiResponse.success(res, response);
  } catch (error) {
    // Dọn dẹp file tạm khi có lỗi
    if (fs.existsSync(imageFilePath)) {
      fs.unlinkSync(imageFilePath);
    }
    
    console.error('Error registering face:', error);
    return next(new ApiError(error.message || 'Lỗi đăng ký khuôn mặt', 500));
  }
});

/**
 * Xác thực bằng khuôn mặt
 * @route POST /api/ai/face/authenticate
 * @access Public
 */
exports.authenticateFace = asyncHandler(async (req, res, next) => {
  // Đánh dấu thời gian bắt đầu
  const startTime = Date.now();
  
  if (!req.file) {
    return next(new ApiError('Hình ảnh khuôn mặt là bắt buộc', 400));
  }
  
  const imageFilePath = req.file.path;
  
  try {
    // Xử lý hình ảnh trước khi gửi đến AI service
    let imageBuffer;
    let processedImageInfo;
    
    if (storageType === 's3' && req.file.location) {
      // Nếu file đã ở S3, lấy từ S3
      const s3Response = await s3Service.downloadFile(req.file.key);
      imageBuffer = s3Response.data;
    } else {
      // Xử lý ảnh local
      processedImageInfo = await imageService.processImage(req.file, 'uploads/faces', {
        width: 640,
        height: 640,
        quality: 90
      });
      
      // Đọc file đã xử lý
      imageBuffer = fs.readFileSync(processedImageInfo.path || imageFilePath);
    }
    
    // Gọi AI service để xác thực
    const response = await aiService.authenticateFace(imageBuffer);
    
    // Tính thời gian xử lý
    const processingTime = Date.now() - startTime;
    
    // Log tương tác AI
    await AIAssistantLog.create({
      userId: response.success ? new mongoose.Types.ObjectId(response.user_id) : null,
      sessionId: uuidv4(),
      query: 'Face authentication request',
      response: response.success ? 'Authentication successful' : 'Authentication failed',
      intentType: 'face_auth',
      querySource: 'api',
      responseTime: processingTime
    });
    
    // Nếu xác thực thành công
    if (response.success) {
      // Thông báo đăng nhập qua socket
      socketService.notifyUser(response.user_id, {
        type: 'face_auth_success',
        title: 'Xác thực thành công',
        content: 'Bạn đã đăng nhập thành công bằng nhận dạng khuôn mặt.'
      });
    }
    
    // Dọn dẹp file tạm
    if (fs.existsSync(imageFilePath)) {
      fs.unlinkSync(imageFilePath);
    }
    
    if (processedImageInfo && processedImageInfo.path && fs.existsSync(processedImageInfo.path)) {
      fs.unlinkSync(processedImageInfo.path);
    }
    
    return ApiResponse.success(res, response);
  } catch (error) {
    // Dọn dẹp file tạm khi có lỗi
    if (fs.existsSync(imageFilePath)) {
      fs.unlinkSync(imageFilePath);
    }
    
    console.error('Error in face authentication:', error);
    return next(new ApiError(error.message || 'Lỗi xác thực khuôn mặt', 500));
  }
});

/**
 * Lấy thông tin insight về hành vi người dùng
 * @route GET /api/ai/insights/:userId
 * @access Private
 */
exports.getUserInsights = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { refresh } = req.query;
  
  // Xác minh người dùng tồn tại
  const user = await User.findById(userId || req.user.id);
  if (!user) {
    return next(new ApiError('Người dùng không tồn tại', 404));
  }
  
  // Đảm bảo người dùng hiện tại chỉ có thể xem insight của chính mình trừ khi là admin
  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return next(new ApiError('Bạn không có quyền truy cập dữ liệu này', 403));
  }
  
  try {
    // Gọi AI service
    const response = await aiService.getUserInsights(
      userId || req.user.id,
      refresh === 'true'
    );
    
    return ApiResponse.success(res, response);
  } catch (error) {
    console.error('Error getting user insights:', error);
    return next(new ApiError(error.message || 'Lỗi lấy thông tin insight', 500));
  }
});

/**
 * Lấy insights của người dùng hiện tại
 * @route GET /api/ai/insights
 * @access Private
 */
exports.getCurrentUserInsights = asyncHandler(async (req, res, next) => {
  // Chuyển params vào getUserInsights
  req.params.userId = req.user.id;
  return this.getUserInsights(req, res, next);
});

/**
 * Ghi log hoạt động người dùng
 * @route POST /api/ai/activity
 * @access Public
 */
exports.logUserActivity = asyncHandler(async (req, res, next) => {
  const { activityType, data } = req.body;
  
  // Xác thực đầu vào
  if (!activityType || !data) {
    return next(new ApiError('Activity type và data là bắt buộc', 400));
  }
  
  // Lấy user ID và session ID
  const userId = req.user ? req.user.id : null;
  const sessionId = req.body.sessionId || req.cookies.sessionId || uuidv4();
  
  try {
    // Gọi AI service
    const response = await aiService.logUserActivity(
      userId,
      sessionId,
      activityType,
      data
    );
    
    // Set cookie sessionId nếu chưa có
    if (!req.cookies.sessionId) {
      res.cookie('sessionId', sessionId, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }
    
    return ApiResponse.success(res, response);
  } catch (error) {
    console.error('Error logging user activity:', error);
    return next(new ApiError(error.message || 'Lỗi ghi log hoạt động', 500));
  }
});

/**
 * Cung cấp feedback cho phản hồi AI
 * @route POST /api/ai/feedback/:logId
 * @access Public
 */
exports.provideFeedback = asyncHandler(async (req, res, next) => {
  const { logId } = req.params;
  const { isHelpful, comments } = req.body;
  
  // Xác thực đầu vào
  if (isHelpful === undefined) {
    return next(new ApiError('isHelpful là bắt buộc', 400));
  }
  
  try {
    // Tìm log entry
    const logEntry = await AIAssistantLog.findById(logId);
    
    if (!logEntry) {
      return next(new ApiError('Log entry không tồn tại', 404));
    }
    
    // Thêm feedback
    logEntry.feedback = {
      isHelpful,
      comments,
      providedAt: new Date()
    };
    
    await logEntry.save();
    
    // Trả về kết quả
    return ApiResponse.success(res, {
      success: true,
      message: 'Feedback đã được ghi nhận',
      log_id: logId
    });
  } catch (error) {
    console.error('Error providing feedback:', error);
    return next(new ApiError(error.message || 'Lỗi khi cung cấp feedback', 500));
  }
});

/**
 * Lấy lịch sử trò chuyện
 * @route GET /api/ai/chat/history
 * @access Public
 */
exports.getChatHistory = asyncHandler(async (req, res, next) => {
  const { sessionId, userId, limit } = req.query;
  
  // Yêu cầu cung cấp sessionId hoặc userId
  if (!sessionId && !userId) {
    return next(new ApiError('Yêu cầu sessionId hoặc userId', 400));
  }
  
  // Đảm bảo người dùng hiện tại chỉ có thể xem lịch sử của chính mình trừ khi là admin
  if (userId && req.user && req.user.role !== 'admin' && req.user.id !== userId) {
    return next(new ApiError('Bạn không có quyền truy cập dữ liệu này', 403));
  }
  
  try {
    let query = {};
    
    if (sessionId) {
      query.sessionId = sessionId;
    } else if (userId) {
      query.userId = new mongoose.Types.ObjectId(userId);
    }
    
    // Lấy lịch sử trò chuyện
    const history = await AIAssistantLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 20);
    
    // Format kết quả
    const formattedHistory = history.map(item => ({
      id: item._id,
      session_id: item.sessionId,
      user_id: item.userId ? item.userId.toString() : null,
      query: item.query,
      response: item.response,
      intent_type: item.intentType,
      query_source: item.querySource,
      created_at: item.createdAt,
      response_time: item.responseTime,
      feedback: item.feedback
    }));
    
    return ApiResponse.success(res, {
      count: formattedHistory.length,
      history: formattedHistory
    });
  } catch (error) {
    console.error('Error getting chat history:', error);
    return next(new ApiError(error.message || 'Lỗi lấy lịch sử trò chuyện', 500));
  }
});

/**
 * Lấy các truy vấn phổ biến
 * @route GET /api/ai/chat/frequent-queries
 * @access Private (Admin only)
 */
exports.getFrequentQueries = asyncHandler(async (req, res, next) => {
  // Chỉ admin mới có quyền truy cập
  if (req.user.role !== 'admin') {
    return next(new ApiError('Bạn không có quyền truy cập dữ liệu này', 403));
  }
  
  const { limit } = req.query;
  
  try {
    // Sử dụng phương thức static từ model
    const frequentQueries = await AIAssistantLog.getFrequentQueries(parseInt(limit) || 10);
    
    // Format kết quả
    const formattedQueries = frequentQueries.map(item => ({
      query: item._id,
      count: item.count,
      intent_types: item.intentTypes,
      last_asked: item.lastAsked
    }));
    
    return ApiResponse.success(res, formattedQueries);
  } catch (error) {
    console.error('Error getting frequent queries:', error);
    return next(new ApiError(error.message || 'Lỗi lấy truy vấn phổ biến', 500));
  }
});

/**
 * Lấy phân phối intent
 * @route GET /api/ai/analytics/intent-distribution
 * @access Private (Admin only)
 */
exports.getIntentDistribution = asyncHandler(async (req, res, next) => {
  // Chỉ admin mới có quyền truy cập
  if (req.user.role !== 'admin') {
    return next(new ApiError('Bạn không có quyền truy cập dữ liệu này', 403));
  }
  
  const { startDate, endDate } = req.query;
  
  try {
    // Convert dates if provided
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    // Sử dụng phương thức static từ model
    const distribution = await AIAssistantLog.getIntentDistribution(start, end);
    
    return ApiResponse.success(res, distribution);
  } catch (error) {
    console.error('Error getting intent distribution:', error);
    return next(new ApiError(error.message || 'Lỗi lấy phân phối intent', 500));
  }
});

/**
 * Lấy thống kê feedback
 * @route GET /api/ai/analytics/feedback-stats
 * @access Private (Admin only)
 */
exports.getFeedbackStats = asyncHandler(async (req, res, next) => {
  // Chỉ admin mới có quyền truy cập
  if (req.user.role !== 'admin') {
    return next(new ApiError('Bạn không có quyền truy cập dữ liệu này', 403));
  }
  
  try {
    // Sử dụng phương thức static từ model
    const feedbackStats = await AIAssistantLog.getFeedbackStats();
    
    return ApiResponse.success(res, feedbackStats);
  } catch (error) {
    console.error('Error getting feedback stats:', error);
    return next(new ApiError(error.message || 'Lỗi lấy thống kê feedback', 500));
  }
});