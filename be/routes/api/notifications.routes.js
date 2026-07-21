// routes/api/notifications.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middlewares/auth.middleware');
const {
  getUserNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  deleteNotification,
  deleteReadNotifications,
  deleteAllNotifications,
  createBulkNotifications,
  createFromTemplate,
  getUnreadCount
} = require('../../controllers/notification.controller');

// @route   /api/notifications
router.use(protect);

router.get('/', getUserNotifications);
router.get('/unread-count', getUnreadCount);
router.get('/:id', getNotification);

router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.put('/:id/dismiss', dismissNotification);

router.delete('/read', deleteReadNotifications);
router.delete('/:id', deleteNotification);
router.delete('/', deleteAllNotifications);

router.post('/bulk', authorize('admin'), createBulkNotifications);
router.post('/template', authorize('admin'), createFromTemplate);

module.exports = router;
