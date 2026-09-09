const crypto = require("crypto");
const ApiError = require("./apiError");

function signSession(sessionId, userId) {
  const secret = process.env.AI_SESSION_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new ApiError("Chưa cấu hình phiên trò chuyện.", 503);
  return crypto.createHmac("sha256", secret).update(`${sessionId}:${userId || "guest"}`).digest("hex");
}

function validSession(sessionId, userId, token) {
  if (typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(sessionId) || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return false;
  return crypto.timingSafeEqual(Buffer.from(signSession(sessionId, userId), "hex"), Buffer.from(token, "hex"));
}

module.exports = { signSession, validSession };
