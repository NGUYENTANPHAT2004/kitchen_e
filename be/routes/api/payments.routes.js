// routes/api/payment.routes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/payment.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware');

// Public payment routes
router.get('/complete', paymentController.completePayment);
router.post('/webhook', paymentController.paymentWebhook);

// Customer payment routes
router.post('/initiate', protect, paymentController.initiatePayment);

// Admin/Staff stats route (khai báo TRƯỚC /:id để không bị nuốt)
router.get('/stats', protect, authorize('admin', 'staff'), paymentController.getPaymentStats);

router.get('/:id', protect, paymentController.getPaymentById);

// Admin/Staff payment routes
router.post('/:id/refund', protect, authorize('admin', 'staff'), paymentController.processRefund);

module.exports = router;