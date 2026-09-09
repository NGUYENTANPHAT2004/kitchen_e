const Order = require("../models/Order");
const User = require("../models/User");
const ApiResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../middlewares/async.middleware");

const dateRange = (query) => {
  const end = query.endDate
    ? new Date(`${query.endDate}T23:59:59.999Z`)
    : new Date();
  const start = query.startDate
    ? new Date(`${query.startDate}T00:00:00.000Z`)
    : new Date(end.getTime() - 29 * 86400000);
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    start > end ||
    end - start > 366 * 86400000
  ) {
    throw new ApiError("Choose a valid date range of up to one year.", 400);
  }
  return { $gte: start, $lte: end };
};

exports.sales = asyncHandler(async (req, res) => {
  const createdAt = dateRange(req.query);
  const [report] = await Order.aggregate([
    {
      $match: {
        createdAt,
        isDeleted: { $ne: true },
        status: { $nin: ["cancelled", "refunded"] },
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              revenue: { $sum: { $cond: ["$isPaid", "$totalAmount", 0] } },
              orderValue: { $sum: "$totalAmount" },
              unpaid: { $sum: { $cond: ["$isPaid", 0, "$totalAmount"] } },
            },
          },
        ],
        daily: [
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              orders: { $sum: 1 },
              revenue: { $sum: { $cond: ["$isPaid", "$totalAmount", 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ],
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        topProducts: [
          { $match: { isPaid: true } },
          {
            $lookup: {
              from: "orderitems",
              localField: "_id",
              foreignField: "orderId",
              as: "items",
            },
          },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.productId",
              name: { $first: "$items.productSnapshot.name" },
              quantity: { $sum: "$items.quantity" },
              revenue: {
                $sum: { $multiply: ["$items.price", "$items.quantity"] },
              },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 20 },
        ],
      },
    },
  ]);
  return ApiResponse.success(res, {
    ...report,
    summary: report?.summary?.[0] || {
      orders: 0,
      revenue: 0,
      orderValue: 0,
      unpaid: 0,
    },
  });
});

exports.customers = asyncHandler(async (req, res) => {
  const createdAt = dateRange(req.query);
  const search = String(req.query.search || "")
    .trim()
    .slice(0, 100);
  const [report] = await User.aggregate([
    { $match: { role: "customer", isDeleted: { $ne: true } } },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              verified: { $sum: { $cond: ["$isEmailVerified", 1, 0] } },
              newCustomers: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ["$createdAt", createdAt.$gte] },
                        { $lte: ["$createdAt", createdAt.$lte] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        daily: [
          { $match: { createdAt } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        customers: [
          ...(search
            ? [
                {
                  $match: {
                    $or: ["email", "firstName", "lastName", "username"].map(
                      (field) => ({
                        [field]: {
                          $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                          $options: "i",
                        },
                      })
                    ),
                  },
                },
              ]
            : []),
          {
            $lookup: {
              from: "orders",
              let: { user: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$userId", "$$user"] },
                    createdAt,
                    isPaid: true,
                    isDeleted: { $ne: true },
                    status: { $nin: ["cancelled", "refunded"] },
                  },
                },
                {
                  $group: {
                    _id: null,
                    orders: { $sum: 1 },
                    spent: { $sum: "$totalAmount" },
                    lastOrder: { $max: "$createdAt" },
                  },
                },
              ],
              as: "purchases",
            },
          },
          {
            $set: {
              orders: { $ifNull: [{ $first: "$purchases.orders" }, 0] },
              spent: { $ifNull: [{ $first: "$purchases.spent" }, 0] },
              lastOrder: { $first: "$purchases.lastOrder" },
            },
          },
          { $sort: { spent: -1, createdAt: -1 } },
          { $limit: 100 },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              username: 1,
              email: 1,
              createdAt: 1,
              orders: 1,
              spent: 1,
              lastOrder: 1,
            },
          },
        ],
      },
    },
  ]);
  return ApiResponse.success(res, {
    ...report,
    summary: report?.summary?.[0] || { total: 0, verified: 0, newCustomers: 0 },
  });
});

exports.dateRange = dateRange;
