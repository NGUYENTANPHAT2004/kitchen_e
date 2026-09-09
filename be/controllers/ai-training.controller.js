const asyncHandler = require("../middlewares/async.middleware");
const ApiResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");
const AIAssistantLog = require("../models/AIAssistantLog");
const aiService = require("../services/ai.service");
const mongoose = require("mongoose");

async function trainingRequest(method, url, data, params) {
  try {
    const result = await aiService.axiosInstance.request({ method, url: `/api/training${url}`, data, params, timeout: 10000 });
    return result.data;
  } catch (error) {
    const detail = error.response?.data?.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(item => item.msg).join("; ") : "Chưa kết nối được dịch vụ huấn luyện AI. Vui lòng thử lại.";
    const status = [400, 404, 409, 422].includes(error.response?.status) ? error.response.status : 503;
    throw new ApiError(message, status);
  }
}

exports.forward = (method, path) => asyncHandler(async (req, res) => {
  const endpoint = typeof path === "function" ? path(req) : path;
  return ApiResponse.success(res, await trainingRequest(method, endpoint, method === "get" ? undefined : req.body, method === "get" ? req.query : undefined));
});

exports.exampleFromLog = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError("Mã hội thoại không hợp lệ.", 400);
  const log = await AIAssistantLog.findById(req.params.id);
  if (!log) throw new ApiError("Không tìm thấy nội dung hội thoại.", 404);
  const result = await trainingRequest("post", "/examples", {
    text: log.query, intent: req.body.intent, purpose: req.body.purpose || "train",
    approved: req.body.approved === true, sourceLogId: String(log._id),
  });
  return ApiResponse.created(res, result);
});

exports.conversations = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const query = { querySource: { $in: ["text", "voice", "suggestion"] }, sessionId: { $type: "string" } };
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const pattern = { $regex: req.query.search.trim().slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const matching = await AIAssistantLog.distinct("sessionId", { ...query, $or: [{ query: pattern }, { response: pattern }, { sessionId: pattern }] });
    query.sessionId = { $in: matching };
  }
  const [result] = await AIAssistantLog.aggregate([
    { $match: query },
    { $sort: { createdAt: 1 } },
    { $group: {
      _id: { sessionId: "$sessionId", userId: "$userId" }, title: { $first: "$query" },
      lastQuery: { $last: "$query" }, lastResponse: { $last: "$response" }, lastIntent: { $last: "$intentType" },
      messageCount: { $sum: 1 }, lastAt: { $last: "$createdAt" },
      negativeFeedback: { $sum: { $cond: [{ $eq: ["$feedback.isHelpful", false] }, 1, 0] } },
    } },
    { $sort: { lastAt: -1 } },
    { $facet: {
      count: [{ $count: "total" }],
      items: [
        { $skip: (page - 1) * limit }, { $limit: limit },
        { $lookup: { from: "users", localField: "_id.userId", foreignField: "_id", as: "users", pipeline: [{ $project: { firstName: 1, lastName: 1, username: 1 } }] } },
        { $project: { _id: 0, sessionId: "$_id.sessionId", userId: "$_id.userId", user: { $arrayElemAt: ["$users", 0] }, title: 1, lastQuery: 1, lastResponse: 1, lastIntent: 1, messageCount: 1, lastAt: 1, negativeFeedback: 1 } },
      ],
    } },
  ]);
  const total = result?.count[0]?.total || 0;
  return ApiResponse.success(res, { conversations: result?.items || [], pagination: { currentPage: page, totalPages: Math.max(1, Math.ceil(total / limit)), totalItems: total, limit } });
});
