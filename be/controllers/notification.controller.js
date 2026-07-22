// controllers/notification.controller.js
const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('../middlewares/async.middleware');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const notificationService = require('../services/notification.service');

/**
 * @desc      Lấy danh sách thông báo của người dùng
 * @route     GET /api/notifications
 * @access    Private
 */
exports.getUserNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isRead, isDismissed, type } = req.query;
  
  const query = { userId: req.user.id };
  
  // Lọc theo trạng thái đã đọc
  if (isRead === 'true') {
    query.isRead = true;
  } else if (isRead === 'false') {
    query.isRead = false;
  }
  
  // Lọc theo trạng thái đã bỏ qua
  if (isDismissed === 'true') {
    query.isDismissed = true;
  } else if (isDismissed === 'false') {
    query.isDismissed = false;
  }
  
  // Lọc theo loại thông báo
  if (type) {
    query.type = type;
  }
  
  // Chỉ lấy những thông báo chưa hết hạn
  query.$or = [
    { expiresAt: { $exists: false } },
    { expiresAt: { $gt: new Date() } }
  ];
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { createdAt: -1 }
  };
  
  // Sử dụng plugin mongoose-paginate-v2
  const result = await Notification.paginate(query, options);
  
  return ApiResponse.success(res, {
    notifications: result.docs,
    pagination: {
      total: result.totalDocs,
      totalPages: result.totalPages,
      currentPage: result.page,
      perPage: result.limit,
      hasNext: result.hasNextPage,
      hasPrev: result.hasPrevPage
    }
  }, 'Danh sách thông báo');
});

/**
 * @desc      Lấy một thông báo theo ID
 * @route     GET /api/notifications/:id
 * @access    Private
 */
exports.getNotification = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user.id
  });
  
  if (!notification) {
    return next(new ApiError('Không tìm thấy thông báo', 404));
  }
  
  return ApiResponse.success(res, notification, 'Chi tiết thông báo');
});

/**
 * @desc      Đánh dấu thông báo là đã đọc
 * @route     PUT /api/notifications/:id/read
 * @access    Private
 */
exports.markAsRead = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user.id
  });
  
  if (!notification) {
    return next(new ApiError('Không tìm thấy thông báo', 404));
  }
  
  if (!notification.isRead) {
    await notification.markAsRead();
  }
  
  return ApiResponse.success(res, notification, 'Đã đánh dấu thông báo là đã đọc');
});

/**
 * @desc      Đánh dấu tất cả thông báo là đã đọc
 * @route     PUT /api/notifications/read-all
 * @access    Private
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.markAllAsRead(req.user.id);
  
  return ApiResponse.success(res, {
    affected: result.nModified || result.modifiedCount || 0
  }, 'Đã đánh dấu tất cả thông báo là đã đọc');
});

/**
 * @desc      Đánh dấu thông báo là đã bỏ qua
 * @route     PUT /api/notifications/:id/dismiss
 * @access    Private
 */
exports.dismissNotification = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user.id
  });
  
  if (!notification) {
    return next(new ApiError('Không tìm thấy thông báo', 404));
  }
  
  if (!notification.isDismissed) {
    await notification.dismiss();
  }
  
  return ApiResponse.success(res, notification, 'Đã bỏ qua thông báo');
});

/**
 * @desc      Xóa một thông báo
 * @route     DELETE /api/notifications/:id
 * @access    Private
 */
exports.deleteNotification = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user.id
  });
  
  if (!notification) {
    return next(new ApiError('Không tìm thấy thông báo', 404));
  }
  
  await Notification.findByIdAndDelete(req.params.id);
  
  return ApiResponse.success(res, null, 'Đã xóa thông báo');
});

/**
 * @desc      Xóa tất cả thông báo đã đọc
 * @route     DELETE /api/notifications/read
 * @access    Private
 */
exports.deleteReadNotifications = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({
    userId: req.user.id,
    isRead: true
  });
  
  return ApiResponse.success(res, {
    deleted: result.deletedCount || 0
  }, 'Đã xóa các thông báo đã đọc');
});

/**
 * @desc      Xóa tất cả thông báo
 * @route     DELETE /api/notifications
 * @access    Private
 */
exports.deleteAllNotifications = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({
    userId: req.user.id
  });
  
  return ApiResponse.success(res, {
    deleted: result.deletedCount || 0
  }, 'Đã xóa tất cả thông báo');
});

/**
 * @desc      Tạo thông báo cho nhiều người dùng
 * @route     POST /api/notifications/bulk
 * @access    Private (Admin)
 */
exports.createBulkNotifications = asyncHandler(async (req, res, next) => {
  const { userIds, title, message, type, action, isActionRequired, expiresAt, priority, channels } = req.body;
  
  if (!title || !message) {
    return next(new ApiError('Vui lòng cung cấp tiêu đề và nội dung thông báo', 400));
  }
  
  // Kiểm tra loại thông báo hợp lệ
  const validTypes = [
    'order_status', 'payment_status', 'account_update', 'product_restock',
    'price_drop', 'review_response', 'flash_sale', 'voucher',
    'maintenance_reminder', 'wishlist_price_change', 'wishlist_back_in_stock', 'system'
  ];
  
  if (!validTypes.includes(type)) {
    return next(new ApiError('Loại thông báo không hợp lệ', 400));
  }
  
  // Kiểm tra danh sách người dùng
  let users;
  if (userIds && userIds.length > 0) {
    users = await User.find({ _id: { $in: userIds } }).select('_id');
    
    if (users.length === 0) {
      return next(new ApiError('Không tìm thấy người dùng nào', 404));
    }
  } else {
    // Nếu không có userIds, gửi cho tất cả người dùng
    users = await User.find().select('_id');
  }
  
  // Dữ liệu thông báo cơ bản
  const notificationData = {
    type: type || 'system',
    title,
    message,
    isActionRequired: isActionRequired || false,
    action: action || { type: 'none' },
    expiresAt: expiresAt || undefined,
    priority: priority || 'medium',
    channels: channels || { inApp: true, email: false, push: false, sms: false }
  };
  
  // Tạo thông báo cho từng người dùng
  const notifications = await notificationService.createMultipleNotifications(
    users.map(user => user._id.toString()),
    notificationData
  );
  
  return ApiResponse.success(res, {
    count: notifications.length,
    notifications: notifications.map(n => ({
      id: n._id,
      userId: n.userId,
      type: n.type
    }))
  }, 'Tạo thông báo thành công');
});

/**
 * @desc      Lấy số lượng thông báo chưa đọc
 * @route     GET /api/notifications/unread-count
 * @access    Private
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id);
  
  return ApiResponse.success(res, { count }, 'Số lượng thông báo chưa đọc');
});

/**
 * @desc      Tạo thông báo từ template
 * @route     POST /api/notifications/template
 * @access    Private (Admin)
 */
exports.createFromTemplate = asyncHandler(async (req, res, next) => {
  const { userId, template, templateData } = req.body;
  
  if (!userId || !template) {
    return next(new ApiError('Vui lòng cung cấp userId và template', 400));
  }
  
  // Kiểm tra người dùng tồn tại
  const user = await User.findById(userId);
  if (!user) {
    return next(new ApiError('Không tìm thấy người dùng', 404));
  }
  
  // Tạo thông báo từ template
  const notification = await notificationService.createNotificationFromTemplate(
    userId,
    template,
    templateData || {}
  );
  
  return ApiResponse.success(res, notification, 'Tạo thông báo thành công');
});