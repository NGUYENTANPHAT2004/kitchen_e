// models/Notification.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const { unexpiredNotifications } = require('../utils/notification-query');

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    type: {
      type: String,
      enum: [
        'order_status',
        'payment_status',
        'account_update',
        'product_restock',
        'price_drop',
        'review_response',
        'flash_sale',
        'voucher',
        'maintenance_reminder',
        'wishlist_price_change',
        'wishlist_back_in_stock',
        'system'
      ],
      required: [true, 'Notification type is required']
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true
    },
    image: {
      type: String
    },
    isRead: {
      type: Boolean,
      default: false
    },
    isActionRequired: {
      type: Boolean,
      default: false
    },
    isDismissed: {
      type: Boolean,
      default: false
    },
    action: {
      type: {
        type: String,
        enum: ['link', 'button', 'none'],
        default: 'none'
      },
      text: String,
      url: String
    },
    metadata: {
      orderId: mongoose.Schema.Types.ObjectId,
      productId: mongoose.Schema.Types.ObjectId,
      paymentId: mongoose.Schema.Types.ObjectId,
      voucherId: mongoose.Schema.Types.ObjectId,
      reviewId: mongoose.Schema.Types.ObjectId,
      flashSaleId: mongoose.Schema.Types.ObjectId,
      extraData: Object
    },
    expiresAt: {
      type: Date
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    channels: {
      inApp: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: false
      },
      push: {
        type: Boolean,
        default: false
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    deliveryStatus: {
      inApp: {
        delivered: {
          type: Boolean,
          default: true
        },
        deliveredAt: Date
      },
      email: {
        delivered: {
          type: Boolean,
          default: false
        },
        deliveredAt: Date
      },
      push: {
        delivered: {
          type: Boolean,
          default: false
        },
        deliveredAt: Date
      },
      sms: {
        delivered: {
          type: Boolean,
          default: false
        },
        deliveredAt: Date
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for checking if notification is expired
NotificationSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return this.expiresAt < new Date();
});

// Method to mark notification as read
NotificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  return this.save();
};

// Method to dismiss notification
NotificationSchema.methods.dismiss = async function() {
  this.isDismissed = true;
  return this.save();
};

// Static method to create a notification
NotificationSchema.statics.createNotification = async function(data) {
  // Set default channels based on notification type
  if (!data.channels) {
    data.channels = {
      inApp: true,
      email: false,
      push: false,
      sms: false
    };
    
    // Set channels based on notification type
    switch (data.type) {
      case 'order_status':
      case 'payment_status':
        data.channels.email = true;
        data.channels.push = true;
        break;
        
      case 'flash_sale':
      case 'voucher':
        data.channels.push = true;
        break;
        
      case 'maintenance_reminder':
        data.channels.email = true;
        break;
        
      case 'wishlist_back_in_stock':
        data.channels.email = true;
        data.channels.push = true;
        break;
    }
  }
  
  // Create notification
  const notification = await this.create({
    ...data,
    deliveryStatus: {
      inApp: {
        delivered: data.channels.inApp,
        deliveredAt: data.channels.inApp ? new Date() : null
      },
      email: {
        delivered: false
      },
      push: {
        delivered: false
      },
      sms: {
        delivered: false
      }
    }
  });
  
  return notification;
};

// Static method to get unread notifications for a user
NotificationSchema.statics.getUnreadNotifications = async function(userId) {
  return this.find({
    userId,
    isRead: false,
    isDismissed: false,
    ...unexpiredNotifications()
  }).sort({ createdAt: -1 });
};

// Static method to bulk mark notifications as read
NotificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    {
      userId,
      isRead: false
    },
    {
      $set: { isRead: true }
    }
  );
};

// Static method to update delivery status
NotificationSchema.statics.updateDeliveryStatus = async function(notificationId, channel) {
  const updateField = `deliveryStatus.${channel}`;
  
  return this.findByIdAndUpdate(
    notificationId,
    {
      $set: {
        [`${updateField}.delivered`]: true,
        [`${updateField}.deliveredAt`]: new Date()
      }
    },
    { new: true }
  );
};

NotificationSchema.index({ userId: 1, isRead: 1, isDismissed: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ 'metadata.orderId': 1 });
NotificationSchema.index({ 'metadata.productId': 1 });

NotificationSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Notification', NotificationSchema);
