const express = require("express");
const request = require("supertest");
const Notification = require("../models/Notification");
const { getUserNotifications, getUnreadCount, markAsRead } = require("../controllers/notification.controller");

const app = express();
app.use((req, _res, next) => { req.user = { id: "local-test-user" }; next(); });
app.get("/notifications", getUserNotifications);
app.get("/notifications/unread-count", getUnreadCount);
app.put("/notifications/:id/read", markAsRead);
app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));
const result = {
  docs: [{ _id: "notice-1", title: "Local test notification" }],
  totalDocs: 21, totalPages: 3, page: 2, limit: 10, hasNextPage: true, hasPrevPage: true,
};

afterEach(() => jest.restoreAllMocks());

test("notification listing returns the frontend pagination contract for the signed-in user", async () => {
  const paginate = jest.spyOn(Notification, "paginate").mockResolvedValue(result);
  const response = await request(app).get("/notifications?page=2&limit=10").expect(200);
  expect(response.body.data).toMatchObject({ notifications: result.docs, pagination: { total: 21, totalPages: 3, currentPage: 2, perPage: 10 } });
  expect(paginate.mock.calls[0][0].userId).toBe("local-test-user");
  expect(paginate.mock.calls[0][1]).toMatchObject({ page: 2, limit: 10 });
});

test("text search combines with expiry, type and read filters before pagination", async () => {
  const paginate = jest.spyOn(Notification, "paginate").mockResolvedValue(result);
  await request(app).get("/notifications").query({ search: " note.10 ", type: "system", isRead: "false", isDismissed: "false" }).expect(200);
  const query = paginate.mock.calls[0][0];
  expect(query).toMatchObject({ userId: "local-test-user", type: "system", isRead: false, isDismissed: false });
  expect(query.$or).toEqual([{ expiresAt: null }, { expiresAt: { $gt: expect.any(Date) } }]);
  for (const field of ["title", "message"]) {
    const pattern = query.$and[0].$or.find((entry) => entry[field])[field];
    const matcher = new RegExp(pattern.$regex, pattern.$options);
    expect(matcher.test("NOTE.10")).toBe(true);
    expect(matcher.test("NOTEX10")).toBe(false);
  }
});

test("invalid pagination is normalized before calling the model", async () => {
  const paginate = jest.spyOn(Notification, "paginate").mockResolvedValue(result);
  await request(app).get("/notifications?page=0&limit=200").expect(200);
  expect(paginate.mock.calls[0][1]).toMatchObject({ page: 1, limit: 100 });
  await request(app).get("/notifications?page=missing&limit=missing").expect(200);
  expect(paginate.mock.calls[1][1]).toMatchObject({ page: 1, limit: 20 });
});

test("unread count includes notifications without an expiry and excludes dismissed entries", async () => {
  const find = jest.spyOn(Notification, "find").mockReturnValue({ countDocuments: async () => 2 });
  const response = await request(app).get("/notifications/unread-count").expect(200);
  expect(response.body.data.count).toBe(2);
  expect(find.mock.calls[0][0]).toMatchObject({ userId: "local-test-user", isRead: false, isDismissed: false, $or: [{ expiresAt: null }, { expiresAt: { $gt: expect.any(Date) } }] });
});

test("opening a notification returns its updated read state", async () => {
  const notification = { _id: "notice-1", isRead: false, markAsRead: jest.fn(async () => { notification.isRead = true; }) };
  const find = jest.spyOn(Notification, "findOne").mockResolvedValue(notification);
  const response = await request(app).put("/notifications/notice-1/read").expect(200);
  expect(find).toHaveBeenCalledWith({ _id: "notice-1", userId: "local-test-user" });
  expect(notification.markAsRead).toHaveBeenCalledTimes(1);
  expect(response.body.data.isRead).toBe(true);
});
