// services/notification.service.js
const Notification = require('../models/Notification');
const socketService = require('./socket.service');

/**
 * Service xử lý thông báo - kết hợp database và socket
 */
class NotificationService {
  /**
   * Tạo thông báo mới
   * @param {Object} notificationData - Dữ liệu thông báo
   * @returns {Promise<Object>} - Thông báo đã tạo
   */
  async createNotification(notificationData) {
    try {
      // Tạo thông báo trong database
      const notification = await Notification.createNotification(notificationData);
      
      // Gửi thông báo realtime nếu kênh inApp được bật
      if (notification.channels.inApp && socketService.isUserOnline(notification.userId.toString())) {
        socketService.notifyUser(notification.userId.toString(), {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          content: notification.message,
          image: notification.image,
          isActionRequired: notification.isActionRequired,
          action: notification.action,
          metadata: notification.metadata,
          priority: notification.priority,
          createdAt: notification.createdAt
        });
        
        // Cập nhật trạng thái đã gửi qua inApp
        notification.deliveryStatus.inApp.delivered = true;
        notification.deliveryStatus.inApp.deliveredAt = new Date();
        await notification.save();
      }
      
      // Gửi email nếu kênh email được bật
      if (notification.channels.email) {
        // Keep delivery pending until a real email provider/template adapter runs.
        console.warn('Notification email delivery is requested but no adapter is configured.');
      }
      
      // TODO: Xử lý các kênh khác (push, sms) tương tự
      
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }
  
  /**
   * Tạo thông báo cho nhiều người dùng
   * @param {Array} userIds - Danh sách ID người dùng
   * @param {Object} notificationData - Dữ liệu thông báo (không bao gồm userId)
   * @returns {Promise<Array>} - Danh sách các thông báo đã tạo
   */
  async createMultipleNotifications(userIds, notificationData) {
    try {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return [];
      }
      
      const notificationPromises = userIds.map(userId => 
        this.createNotification({
          ...notificationData,
          userId
        })
      );
      
      return await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Error creating multiple notifications:', error);
      throw error;
    }
  }
  
  /**
   * Tạo thông báo từ template
   * @param {String} userId - ID người dùng
   * @param {String} templateName - Tên template
   * @param {Object} templateData - Dữ liệu để điền vào template
   * @param {Object} options - Tùy chọn thông báo
   * @returns {Promise<Object>} - Thông báo đã tạo
   */
  async createNotificationFromTemplate(userId, templateName, templateData = {}, options = {}) {
    try {
      // Định nghĩa các template thông báo
      const templates = {
        orderCreated: {
          type: 'order_status',
          title: 'Đơn hàng mới',
          message: `Đơn hàng #${templateData.orderCode || templateData.orderId} đã được tạo thành công và đang chờ xử lý.`,
          isActionRequired: false,
          action: {
            type: 'link',
            text: 'Xem đơn hàng',
            url: `/account/orders/${templateData.orderId}`
          },
          metadata: {
            orderId: templateData.orderId
          },
          priority: 'medium',
          channels: {
            inApp: true,
            email: true,
            push: false,
            sms: false
          }
        },
        
        orderStatusUpdate: {
          type: 'order_status',
          title: 'Cập nhật đơn hàng',
          message: `Đơn hàng #${templateData.orderCode || templateData.orderId} đã được cập nhật trạng thái: ${templateData.status}.`,
          isActionRequired: false,
          action: {
            type: 'link',
            text: 'Xem đơn hàng',
            url: `/account/orders/${templateData.orderId}`
          },
          metadata: {
            orderId: templateData.orderId
          },
          priority: 'medium',
          channels: {
            inApp: true,
            email: true,
            push: templateData.status === 'delivered' || templateData.status === 'cancelled',
            sms: false
          }
        },
        
        paymentSuccess: {
          type: 'payment_status',
          title: 'Thanh toán thành công',
          message: `Thanh toán cho đơn hàng #${templateData.orderCode || templateData.orderId} đã được xác nhận.`,
          isActionRequired: false,
          action: {
            type: 'link',
            text: 'Xem đơn hàng',
            url: `/account/orders/${templateData.orderId}`
          },
          metadata: {
            orderId: templateData.orderId,
            paymentId: templateData.paymentId
          },
          priority: 'medium',
          channels: {
            inApp: true,
            email: true,
            push: false,
            sms: false
          }
        },
        
        paymentFailed: {
          type: 'payment_status',
          title: 'Thanh toán thất bại',
          message: `Thanh toán cho đơn hàng #${templateData.orderCode || templateData.orderId} không thành công. Vui lòng thử lại.`,
          isActionRequired: true,
          action: {
            type: 'link',
            text: 'Thanh toán lại',
            url: `/checkout/payment/${templateData.orderId}`
          },
          metadata: {
            orderId: templateData.orderId,
            paymentId: templateData.paymentId
          },
          priority: 'high',
          channels: {
            inApp: true,
            email: true,
            push: true,
            sms: false
          }
        },
        
        flashSaleStarting: {
          type: 'flash_sale',
          title: 'Flash Sale sắp diễn ra',
          message: `Flash Sale "${templateData.name}" sẽ bắt đầu trong ${templateData.timeRemaining || '30 phút'} nữa.`,
          isActionRequired: false,
          action: {
            type: 'link',
            text: 'Xem Flash Sale',
            url: `/flash-sale/${templateData.flashSaleId}`
          },
          metadata: {
            flashSaleId: templateData.flashSaleId
          },
          priority: 'medium',
          channels: {
            inApp: true,
            email: false,
            push: true,
            sms: false
          }
        },
        
        newVoucher: {
          type: 'voucher',
          title: 'Mã giảm giá mới',
          message: `Bạn vừa nhận được mã giảm giá "${templateData.code}": ${templateData.description || 'Giảm giá cho đơn hàng'}.`,
          isActionRequired: false,
          action: {
            type: 'link',
            text: 'Sử dụng ngay',
            url: `/vouchers/${templateData.voucherId}`
          },
          metadata: {
            voucherId: templateData.voucherId
          },
          priority: 'medium',
          channels: {
            inApp: true,
            email: false,
            push: true,
            sms: false
          }
        },
        
        reviewResponse: {
          type: 'review_response',
          title: 'Phản hồi đánh giá',
          message: `Shop đã phản hồi đánh giá của bạn về sản phẩm "${templateData.productName}".`,
          isActionRequired: false,
          action: {
            type: 'link',
            text: 'Xem phản hồi',
            url: `/products/${templateData.productId}?reviewId=${templateData.reviewId}`
          },
          metadata: {
            productId: templateData.productId,
            reviewId: templateData.reviewId
          },
          priority: 'low',
          channels: {
            inApp: true,
            email: false,
            push: false,
            sms: false
          }
        },
        
        maintenanceReminder: {
          type: 'maintenance_reminder',
          title: 'Nhắc bảo trì thiết bị',
          message: `Thiết bị "${templateData.productName}" của bạn sắp đến thời gian bảo trì định kỳ.`,
          isActionRequired: true,
          action: {
            type: 'link',
            text: 'Đặt lịch bảo trì',
            url: `/maintenance-service/${templateData.productId}`
          },
          metadata: {
            productId: templateData.productId,
            extraData: {
              purchaseDate: templateData.purchaseDate,
              lastMaintenanceDate: templateData.lastMaintenanceDate
            }
          },
          priority: 'medium',
          channels: {
            inApp: true,
            email: true,
            push: false,
            sms: false
          }
        },
        
        wishlistBackInStock: {
          type: 'wishlist_back_in_stock',
          title: 'Sản phẩm yêu thích đã có hàng',
          message: `Sản phẩm "${templateData.productName}" trong danh sách yêu thích của bạn đã có hàng trở lại.`,
          isActionRequired: false,
          action: {
            type: 'link',
            text: 'Mua ngay',
            url: `/products/${templateData.productId}`
          },
          metadata: {
            productId: templateData.productId
          },
          priority: 'medium',
          channels: {
            inApp: true,
            email: true,
            push: true,
            sms: false
          }
        },
        
        wishlistPriceChange: {
          type: 'wishlist_price_change',
          title: 'Giá sản phẩm yêu thích đã thay đổi',
          message: `Sản phẩm "${templateData.productName}" trong danh sách yêu thích của bạn đã ${templateData.priceChange < 0 ? 'giảm' : 'tăng'} giá.`,
          isActionRequired: false,
          action: {
            type: 'link',
            text: 'Xem sản phẩm',
            url: `/products/${templateData.productId}`
          },
          metadata: {
            productId: templateData.productId,
            extraData: {
              oldPrice: templateData.oldPrice,
              newPrice: templateData.newPrice,
              priceChange: templateData.priceChange
            }
          },
          priority: 'low',
          channels: {
            inApp: true,
            email: templateData.priceChange < 0, // Chỉ gửi email khi giảm giá
            push: templateData.priceChange < 0,  // Chỉ gửi push notification khi giảm giá
            sms: false
          }
        },
        
        system: {
          type: 'system',
          title: templateData.title || 'Thông báo hệ thống',
          message: templateData.message || 'Có thông báo mới từ hệ thống.',
          isActionRequired: templateData.isActionRequired || false,
          action: templateData.action || {
            type: 'none'
          },
          metadata: templateData.metadata || {},
          priority: templateData.priority || 'medium',
          channels: templateData.channels || {
            inApp: true,
            email: false,
            push: false,
            sms: false
          }
        }
      };
      
      // Lấy template dựa trên tên
      let template = templates[templateName];
      
      if (!template) {
        throw new Error(`Template không tồn tại: ${templateName}`);
      }
      
      // Kết hợp template với options
      const notificationData = {
        ...template,
        ...options,
        userId
      };
      
      // Tạo thông báo
      return await this.createNotification(notificationData);
    } catch (error) {
      console.error('Error creating notification from template:', error);
      throw error;
    }
  }
  
  /**
   * Đánh dấu thông báo đã đọc
   * @param {String} notificationId - ID thông báo
   * @returns {Promise<Object>} - Thông báo đã cập nhật
   */
  async markAsRead(notificationId) {
    try {
      const notification = await Notification.findById(notificationId);
      
      if (!notification) {
        throw new Error('Notification not found');
      }
      
      if (!notification.isRead) {
        await notification.markAsRead();
      }
      
      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }
  
  /**
   * Đánh dấu tất cả thông báo của người dùng là đã đọc
   * @param {String} userId - ID người dùng
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  async markAllAsRead(userId) {
    try {
      return await Notification.markAllAsRead(userId);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }
  
  /**
   * Đánh dấu thông báo đã bỏ qua
   * @param {String} notificationId - ID thông báo
   * @returns {Promise<Object>} - Thông báo đã cập nhật
   */
  async dismissNotification(notificationId) {
    try {
      const notification = await Notification.findById(notificationId);
      
      if (!notification) {
        throw new Error('Notification not found');
      }
      
      if (!notification.isDismissed) {
        await notification.dismiss();
      }
      
      return notification;
    } catch (error) {
      console.error('Error dismissing notification:', error);
      throw error;
    }
  }
  
  /**
   * Xóa thông báo
   * @param {String} notificationId - ID thông báo
   * @returns {Promise<Boolean>} - Kết quả xóa
   */
  async deleteNotification(notificationId) {
    try {
      const result = await Notification.findByIdAndDelete(notificationId);
      return !!result;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }
  
  /**
   * Lấy danh sách thông báo chưa đọc của người dùng
   * @param {String} userId - ID người dùng
   * @returns {Promise<Array>} - Danh sách thông báo
   */
  async getUnreadNotifications(userId) {
    try {
      return await Notification.getUnreadNotifications(userId);
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      throw error;
    }
  }
  
  /**
   * Lấy số lượng thông báo chưa đọc
   * @param {String} userId - ID người dùng
   * @returns {Promise<Number>} - Số lượng thông báo
   */
  async getUnreadCount(userId) {
    try {
      const notifications = await Notification.find({
        userId,
        isRead: false,
        isDismissed: false,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      }).countDocuments();
      
      return notifications;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      throw error;
    }
  }
  
  /**
   * Cập nhật trạng thái gửi thông báo
   * @param {String} notificationId - ID thông báo
   * @param {String} channel - Kênh thông báo (inApp, email, push, sms)
   * @returns {Promise<Object>} - Thông báo đã cập nhật
   */
  async updateDeliveryStatus(notificationId, channel) {
    try {
      return await Notification.updateDeliveryStatus(notificationId, channel);
    } catch (error) {
      console.error('Error updating notification delivery status:', error);
      throw error;
    }
  }
}

// Singleton instance
const notificationService = new NotificationService();
module.exports = notificationService;