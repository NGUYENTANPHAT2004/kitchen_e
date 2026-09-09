const mongoose = require("mongoose");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../middlewares/async.middleware");

exports.confirmTransfer = asyncHandler(async (req, res) => {
  const reference = String(req.body.reference || "").trim();
  if (reference.length < 4 || reference.length > 100)
    throw new ApiError("A bank transaction reference is required", 400);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await Order.findOneAndUpdate(
        {
          _id: req.params.id,
          paymentMethod: "bank_transfer",
          isPaid: false,
          status: { $in: ["pending", "processing"] },
        },
        { $set: { isPaid: true, paidAt: new Date(), status: "processing" } },
        { new: true, session }
      );
      if (!result)
        throw new ApiError(
          "Order is already paid or cannot receive payment",
          409
        );
      const payment = await Payment.findOneAndUpdate(
        {
          orderId: result._id,
          paymentMethod: "bank_transfer",
          status: "pending",
        },
        {
          $set: {
            status: "completed",
            transactionId: reference,
            paidAt: new Date(),
            paymentDetails: { confirmedBy: req.user._id.toString(), reference },
          },
        },
        { new: true, session }
      );
      if (!payment)
        throw new ApiError("No pending bank transfer payment found", 409);
    });
  } finally {
    await session.endSession();
  }
  return ApiResponse.success(res, { order: result });
});
