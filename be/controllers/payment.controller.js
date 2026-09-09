// controllers/payment.controller.js
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../middlewares/async.middleware");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");
const idempotencyService = require("../services/idempotency.service");
const paymentGatewayService = require("../services/payment-gateway.service");
const assertPaymentAmount = (payment, amount) => {
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(payment.amount) ||
    amount !== payment.amount
  ) {
    throw new ApiError("Payment amount does not match the order.", 400);
  }
};
const sendWebhookAcknowledgement = (res, gateway, duplicate = false) => {
  if (gateway === "vnpay") return res.status(200).send("OK");
  if (gateway === "momo")
    return res.status(200).json({ status: "success", duplicate });
  return res.status(200).json({
    return_code: 1,
    return_message: duplicate ? "duplicate" : "success",
  });
};

const syncCompletedPaymentToOrder = async (payment) => {
  if (!payment || payment.status !== "completed" || !payment.orderId)
    return null;

  const order = await Order.findById(payment.orderId);
  if (!order) {
    throw new ApiError(
      "The payment references an order that no longer exists.",
      409
    );
  }
  if (["cancelled", "refunded"].includes(order.status)) {
    throw new ApiError(
      `Cannot apply a completed payment to a ${order.status} order.`,
      409
    );
  }

  if (!order.isPaid) {
    order.isPaid = true;
    order.paidAt = payment.paidAt || new Date();
    if (order.status === "pending") order.status = "processing";
    await order.save();
  }

  return order;
};

/**
 * @desc    Initiate payment for an order
 * @route   POST /api/payments/initiate
 * @access  Private
 */
exports.initiatePayment = asyncHandler(async (req, res) => {
  const { orderId, paymentMethod } = req.body;
  if (!orderId || !paymentMethod) {
    throw new ApiError("Order ID and payment method are required", 400);
  }
  if (!["cod", "bank_transfer", "vnpay"].includes(paymentMethod)) {
    throw new ApiError("This payment gateway is not integrated.", 503);
  }
  if (
    paymentMethod === "vnpay" &&
    (process.env.VNPAY_ENABLED !== "true" ||
      !process.env.VNPAY_TMN_CODE ||
      !process.env.VNPAY_HASH_SECRET ||
      !process.env.VNPAY_URL)
  ) {
    throw new ApiError("VNPay is not configured and enabled.", 503);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError("Order not found", 404);
  }
  if (order.userId.toString() !== req.user._id.toString()) {
    throw new ApiError("Not authorized to pay for this order", 403);
  }
  if (order.isPaid) {
    throw new ApiError("This order is already paid", 400);
  }
  if (["cancelled", "refunded"].includes(order.status)) {
    throw new ApiError("Cannot pay for a cancelled order", 400);
  }

  const idempotency = await idempotencyService.begin({
    scope: `initiate-payment:${orderId}`,
    key: req.get("Idempotency-Key") || req.body.idempotencyKey,
    ownerId: req.user._id,
    payload: req.body,
  });
  if (idempotency.replay) {
    return res.status(idempotency.statusCode).json(idempotency.responseBody);
  }

  try {
    const existingPayment = await Payment.findOne({
      orderId,
      status: { $in: ["pending", "completed"] },
    });

    if (existingPayment?.status === "completed") {
      const responseBody = {
        success: true,
        message: "Payment already completed",
        data: { payment: existingPayment },
      };
      await idempotencyService.complete({
        record: idempotency.record,
        statusCode: 200,
        responseBody,
      });
      return res.status(200).json(responseBody);
    }

    let payment = existingPayment;
    if (payment && payment.paymentMethod !== paymentMethod) {
      payment.status = "cancelled";
      await payment.save();
      payment = null;
    }

    const paymentData = {
      orderId,
      userId: req.user._id,
      paymentMethod,
      amount: order.totalAmount,
      currency: "VND",
      status: "pending",
      returnUrl: `${process.env.API_URL}/api/payments/complete`,
      notifyUrl: `${process.env.API_URL}/api/payments/webhook`,
    };

    if (!payment) {
      payment = await Payment.createPayment(paymentData);
    }

    let redirectUrl;
    if (paymentMethod === "vnpay") {
      redirectUrl =
        payment.paymentUrl || (await generateVnPayUrl(payment, order));
    } else if (!["cod", "bank_transfer"].includes(paymentMethod)) {
      throw new ApiError("Unsupported payment method", 400);
    }

    if (redirectUrl && payment.paymentUrl !== redirectUrl) {
      payment.paymentUrl = redirectUrl;
      await payment.save();
    }

    const responseBody = {
      success: true,
      message: null,
      data: { payment, ...(redirectUrl ? { redirectUrl } : {}) },
    };
    await idempotencyService.complete({
      record: idempotency.record,
      statusCode: 200,
      responseBody,
    });
    return res.status(200).json(responseBody);
  } catch (error) {
    await idempotencyService.abandon(idempotency.record);
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Payment initialization failed: ${error.message}`, 500);
  }
});
/**
 * @desc    Complete payment (after redirect from payment gateway)
 * @route   GET /api/payments/complete
 * @access  Public
 */
exports.completePayment = asyncHandler(async (req, res) => {
  const {
    paymentId,
    vnp_TxnRef,
    vnp_ResponseCode,
    vnp_TransactionStatus,
    orderId,
  } = req.query;

  let payment;

  // Find payment by ID or order ID
  if (paymentId || vnp_TxnRef) {
    payment = await Payment.findOne({ paymentId: paymentId || vnp_TxnRef });
  } else if (orderId) {
    payment = await Payment.findOne({ orderId });
  } else {
    throw new ApiError(
      "Payment ID, VNPay reference, or Order ID is required",
      400
    );
  }

  if (!payment) {
    throw new ApiError("Payment not found", 404);
  }

  // Only a signed VNPay response may change payment state. Generic query
  // parameters such as ?status=success are never trusted.
  if (
    payment.paymentMethod === "vnpay" &&
    (vnp_ResponseCode !== undefined || vnp_TransactionStatus !== undefined)
  ) {
    if (!paymentGatewayService.verifyVnPay(req.query)) {
      throw new ApiError("Invalid VNPay signature", 400);
    }
    assertPaymentAmount(payment, Number(req.query.vnp_Amount) / 100);

    payment.gatewayResponse = req.query;
    if (
      vnp_ResponseCode === "00" &&
      (!vnp_TransactionStatus || vnp_TransactionStatus === "00")
    ) {
      if (["failed", "cancelled", "refunded"].includes(payment.status)) {
        throw new ApiError(
          `Cannot complete a payment in ${payment.status} state`,
          409
        );
      }
      payment.status = "completed";
      payment.transactionId = req.query.vnp_TransactionNo;
      payment.paidAt = new Date();
    } else if (payment.status === "pending") {
      payment.status = "failed";
      payment.errorMessage = `VNPay error: ${vnp_ResponseCode}`;
    }
    await payment.save();
  }
  // Keep order payment state explicit rather than relying only on a
  // document hook, then include the synchronized order in the response.
  const order =
    payment.status === "completed"
      ? await syncCompletedPaymentToOrder(payment)
      : await Order.findById(payment.orderId);

  return ApiResponse.success(res, {
    payment,
    order: order
      ? {
          _id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          isPaid: order.isPaid,
        }
      : null,
  });
});

/**
 * @desc    Payment webhook (for gateway callbacks)
 * @route   POST /api/payments/webhook
 * @access  Public
 */
exports.paymentWebhook = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const normalized = paymentGatewayService.normalizeWebhook(body);

  if (!normalized.verify()) {
    return res.status(401).json({ error: "Invalid payment webhook signature" });
  }

  const payloadHash = paymentGatewayService.hashPayload(body);
  let event;
  try {
    event = await PaymentWebhookEvent.create({
      gateway: normalized.gateway,
      eventId: normalized.eventId,
      paymentId: normalized.paymentId,
      payloadHash,
      status: "received",
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const previous = await PaymentWebhookEvent.findOne({
      gateway: normalized.gateway,
      eventId: normalized.eventId,
    });
    if (previous && previous.payloadHash !== payloadHash) {
      return res
        .status(409)
        .json({
          error: "Webhook event ID was reused with a different payload",
        });
    }
    if (!previous || previous.status === "processed") {
      return sendWebhookAcknowledgement(res, normalized.gateway, true);
    }

    // A process can stop after the event is recorded but before the payment is
    // updated. Re-run received/failed events; only processed events are final.
    previous.status = "received";
    previous.errorMessage = undefined;
    await previous.save();
    event = previous;
  }

  try {
    const payment = await Payment.findOne({ paymentId: normalized.paymentId });
    if (!payment) {
      event.status = "failed";
      event.errorMessage = "Payment not found";
      await event.save();
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.paymentMethod !== normalized.gateway) {
      event.status = "failed";
      event.errorMessage = "Payment method mismatch";
      await event.save();
      return res.status(400).json({ error: "Payment method mismatch" });
    }
    assertPaymentAmount(payment, normalized.amount);

    payment.gatewayResponse = body;
    if (normalized.status === "completed") {
      if (["failed", "cancelled", "refunded"].includes(payment.status)) {
        event.status = "failed";
        event.errorMessage = `Cannot complete a payment in ${payment.status} state`;
        await event.save();
        return res.status(409).json({ error: event.errorMessage });
      }
      if (payment.status !== "completed") {
        payment.status = "completed";
        payment.transactionId = normalized.transactionId;
        payment.paidAt = new Date();
      }
    } else if (payment.status === "pending") {
      payment.status = "failed";
      payment.errorMessage = normalized.message;
    }

    await payment.save();
    if (normalized.status === "completed" && payment.status === "completed") {
      await syncCompletedPaymentToOrder(payment);
    }
    event.status = "processed";
    event.processedAt = new Date();
    await event.save();

    return sendWebhookAcknowledgement(res, normalized.gateway);
  } catch (error) {
    event.status = "failed";
    event.errorMessage = error.message;
    await event.save();
    throw error;
  }
});
/**
 * @desc    Get payment by ID
 * @route   GET /api/payments/:id
 * @access  Private
 */
exports.getPaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find payment
  const payment = await Payment.findById(id);

  if (!payment) {
    throw new ApiError("Payment not found", 404);
  }

  // Check if payment belongs to user (unless admin)
  if (
    payment.userId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin" &&
    req.user.role !== "staff"
  ) {
    throw new ApiError("Not authorized to access this payment", 403);
  }

  // Find order
  const order = await Order.findById(payment.orderId);

  return ApiResponse.success(res, {
    payment,
    order: order
      ? {
          _id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          isPaid: order.isPaid,
        }
      : null,
  });
});

/**
 * @desc    Process refund
 * @route   POST /api/payments/:id/refund
 * @access  Private (Admin/Staff)
 */
exports.processRefund = asyncHandler(async (_req, _res) => {
  throw new ApiError(
    "Automatic refunds are not integrated. Reconcile the refund with your payment provider before updating financial records.",
    503
  );
});

/**
 * @desc    Get payment statistics (admin/staff)
 * @route   GET /api/payments/stats
 * @access  Private (Admin/Staff)
 */
exports.getPaymentStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Get payment method stats
  const methodStats = await Payment.getPaymentStats(startDate, endDate);

  // Get daily stats
  const dailyStats = await Payment.aggregate([
    {
      $match: {
        status: "completed",
        ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
        ...(endDate && { createdAt: { $lte: new Date(endDate) } }),
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
        total: { $sum: "$amount" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return ApiResponse.success(res, {
    byMethod: methodStats,
    daily: dailyStats,
  });
});

// Helper function to generate VNPay payment URL
const generateVnPayUrl = async (payment, order) => {
  const vnp_Params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_Amount: Math.round(payment.amount * 100), // Convert to smallest currency unit
    vnp_CreateDate: new Date(Date.now() + 7 * 3600000)
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14),
    vnp_CurrCode: "VND",
    vnp_IpAddr: "127.0.0.1",
    vnp_Locale: "vn",
    vnp_OrderInfo: `Thanh toan don hang ${order.orderNumber}`,
    vnp_OrderType: "other",
    vnp_ReturnUrl: payment.returnUrl,
    vnp_TxnRef: payment.paymentId,
  };

  // Sort params alphabetically
  const signed = paymentGatewayService.buildVnPaySignature(
    vnp_Params,
    process.env.VNPAY_HASH_SECRET
  );

  // Add signature to params
  vnp_Params["vnp_SecureHash"] = signed;

  // Build URL
  const vnpUrl =
    `${process.env.VNPAY_URL}?` +
    Object.keys(vnp_Params)
      .map(
        (key) =>
          `${key}=${encodeURIComponent(vnp_Params[key]).replace(/%20/g, "+")}`
      )
      .join("&");

  return vnpUrl;
};
