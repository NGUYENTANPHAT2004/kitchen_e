// routes/api/order.routes.js
const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/order.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware');

// Customer order routes
router.post('/', protect, orderController.createOrder);
router.get('/', protect, orderController.getUserOrders);

// Admin/Staff stats route (khai báo TRƯỚC /:id để không bị nuốt)
router.get('/stats', protect, authorize('admin', 'staff'), orderController.getOrderStats);

router.get('/:id', protect, orderController.getOrderById);
router.put('/:id/cancel', protect, orderController.cancelOrder);
router.get('/:id/tracking', protect, orderController.getOrderTracking);
router.post('/:orderId/items/:itemId/refund', protect, orderController.requestItemRefund);

// Admin/Staff order routes
router.put('/:id/status', protect, authorize('admin', 'staff'), orderController.updateOrderStatus);
router.put('/:orderId/items/:itemId/refund', protect, authorize('admin', 'staff'), orderController.processRefundRequest);

module.exports = router;