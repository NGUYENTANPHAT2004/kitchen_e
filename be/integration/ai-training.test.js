const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const passport = require("passport");
jest.mock("../utils/s3Service", () => ({}));
jest.mock("../utils/imageService", () => ({}));
jest.mock("../services/socket.service", () => ({ isUserOnline: () => false }));
jest.mock("../services/ai.service", () => ({ processChat: jest.fn(), axiosInstance: { request: jest.fn(), get: jest.fn() } }));
const service = require("../services/ai.service");
const Log = require("../models/AIAssistantLog");
const AISettings = require("../models/AISettings");
const { signSession, validSession } = require("../utils/ai-session");
const ids = { owner: new mongoose.Types.ObjectId(), other: new mongoose.Types.ObjectId(), admin: new mongoose.Types.ObjectId(), log: new mongoose.Types.ObjectId() };
const session = "8ec2969e-42e1-4e48-870e-528b223ba152";
const app = express();
app.use(express.json());
app.use("/ai", require("../routes/api/ai.routes"));
app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
const previousSecret = process.env.AI_SESSION_SECRET;

beforeAll(() => { process.env.AI_SESSION_SECRET = "isolated-ai-session-test-secret"; });
afterAll(() => { if (previousSecret === undefined) delete process.env.AI_SESSION_SECRET; else process.env.AI_SESSION_SECRET = previousSecret; });
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(passport, "authenticate").mockImplementation((_strategy, _options, callback) => (req, _res, _next) => {
    const actor = req.get("x-test-actor");
    callback(null, ids[actor] ? { id: String(ids[actor]), _id: ids[actor], role: actor === "admin" ? "admin" : "user", save: async () => {} } : null);
  });
  jest.spyOn(AISettings, "current").mockResolvedValue({ enabled: true, language: "vi" });
});
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

test("a session signature cannot be reused for another session or account", () => {
  const token = signSession(session, String(ids.owner));
  expect(validSession(session, String(ids.owner), token)).toBe(true);
  expect(validSession(session, String(ids.other), token)).toBe(false);
  expect(validSession(session, null, token)).toBe(false);
  expect(validSession(session + "x", String(ids.owner), token)).toBe(false);
  for (const malformed of [null, "", "z".repeat(64), {}, token.slice(1)]) expect(validSession(session, String(ids.owner), malformed)).toBe(false);
});

test("all training and conversation administration routes require an administrator", async () => {
  service.axiosInstance.request.mockResolvedValue({ data: { versions: [] } });
  for (const [method, path] of [["get", "/training/status"], ["post", "/training/train"], ["put", "/training/settings"], ["post", "/training/intents"], ["delete", "/training/examples/123"], ["post", "/training/versions/123/activate"], ["get", "/admin/conversations"]]) {
    await request(app)[method](`/ai${path}`).expect(401);
    await request(app)[method](`/ai${path}`).set("x-test-actor", "owner").expect(403);
  }
  await request(app).get("/ai/training/status").set("x-test-actor", "admin").expect(200);
  expect(service.axiosInstance.request).toHaveBeenCalledTimes(1);
});

test.each([400, 404, 409, 422, 503])("the training proxy preserves actionable errors (%s)", async status => {
  service.axiosInstance.request.mockRejectedValue({ response: { status, data: { detail: "Câu mẫu chưa đủ để huấn luyện" } } });
  const result = await request(app).post("/ai/training/train").set("x-test-actor", "admin").expect(status);
  expect(result.body.error).toBe("Câu mẫu chưa đủ để huấn luyện");
});

test("guest history needs its signature and always queries guest-owned records", async () => {
  const find = jest.spyOn(Log.collection, "find").mockReturnValue({ toArray: async () => [] });
  await request(app).get("/ai/chat/history").query({ sessionId: session }).expect(401);
  await request(app).get("/ai/chat/history").query({ sessionId: session }).set("X-Chat-Token", signSession(session, null)).expect(200);
  expect(find.mock.calls[0][0]).toEqual({ userId: null, sessionId: session });
});

test("customer history is scoped to its account even with another customer's session ID", async () => {
  const find = jest.spyOn(Log.collection, "find").mockReturnValue({ toArray: async () => [] });
  await request(app).get("/ai/chat/history").query({ sessionId: session, limit: 500 }).set("x-test-actor", "other").expect(200);
  expect(find.mock.calls[0][0]).toEqual({ userId: ids.other, sessionId: session });
  expect(find.mock.calls[0][1].limit).toBe(100);
  await request(app).get("/ai/chat/history").query({ userId: String(ids.owner) }).set("x-test-actor", "other").expect(403);
});

test("chat continuation verifies ownership before invoking Python and creates one authoritative log", async () => {
  service.processChat.mockResolvedValue({ response: "Chào bạn", intent_type: "greeting", model_version: "candidate" });
  const create = jest.spyOn(Log, "create").mockResolvedValue({ _id: ids.log });
  await request(app).post("/ai/chat").set("x-test-actor", "other").send({ message: "Chào", sessionId: session, sessionToken: signSession(session, String(ids.owner)) }).expect(403);
  expect(service.processChat).not.toHaveBeenCalled();
  const result = await request(app).post("/ai/chat").set("x-test-actor", "owner").send({ message: "Chào" }).expect(200);
  expect(create).toHaveBeenCalledTimes(1);
  expect(create.mock.calls[0][0]).toMatchObject({ userId: ids.owner, modelVersion: "candidate" });
  expect(validSession(result.body.data.session_id, String(ids.owner), result.body.data.session_token)).toBe(true);
});

test("feedback is restricted to its owner or the signed guest session", async () => {
  const save = jest.fn(async () => {});
  const log = { _id: ids.log, userId: ids.owner, sessionId: session, save };
  jest.spyOn(Log, "findById").mockImplementation(async () => log);
  await request(app).post(`/ai/feedback/${ids.log}`).set("x-test-actor", "other").send({ isHelpful: true }).expect(403);
  expect(save).not.toHaveBeenCalled();
  await request(app).post(`/ai/feedback/${ids.log}`).set("x-test-actor", "owner").send({ isHelpful: false }).expect(200);
  expect(log.feedback.isHelpful).toBe(false);
  log.userId = null;
  await request(app).post(`/ai/feedback/${ids.log}`).send({ isHelpful: true }).expect(403);
  await request(app).post(`/ai/feedback/${ids.log}`).send({ isHelpful: true, sessionToken: signSession(session, null) }).expect(200);
  expect(log.feedback.isHelpful).toBe(true);
});
