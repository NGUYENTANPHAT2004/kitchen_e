const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const Review = require("../models/Review");
const Product = require("../models/Product");
const controller = require("../controllers/review.controller");

const ids = {
  review: new mongoose.Types.ObjectId(),
  product: new mongoose.Types.ObjectId(),
  owner: new mongoose.Types.ObjectId(),
  admin: new mongoose.Types.ObjectId(),
  other: new mongoose.Types.ObjectId(),
};
const pending = {
  _id: ids.review, userId: ids.owner, productId: ids.product,
  rating: 4, comment: "Đánh giá cần duyệt", isApproved: false, isRejected: false,
  isDeleted: false, reportCount: 0, createdAt: new Date(), updatedAt: new Date(),
};
const paged = { docs: [pending], totalDocs: 21, totalPages: 3, page: 2, limit: 10, hasNextPage: true, hasPrevPage: true };
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const actor = req.get("x-test-actor");
  if (ids[actor]) req.user = { id: String(ids[actor]), _id: ids[actor], role: actor === "admin" ? "admin" : "user" };
  next();
});
app.get("/reviews", controller.getReviews);
app.get("/pending", controller.getPendingReviews);
app.get("/reported", controller.getReportedReviews);
app.get("/products/:productId/reviews", controller.getProductReviews);
app.get("/reviews/:id", controller.getReview);
app.post("/reviews", controller.createReview);
app.put("/reviews/:id/approve", controller.approveReview);
app.put("/reviews/:id/reject", controller.rejectReview);
app.post("/reviews/:id/respond", controller.respondToReview);
app.put("/reviews/:id", controller.updateReview);
app.delete("/reviews/:id", controller.deleteReview);
app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));

afterEach(() => jest.restoreAllMocks());

test.each([
  ["/reviews", { isDeleted: { $ne: true } }],
  ["/pending", { isApproved: false, isRejected: false, isDeleted: { $ne: true } }],
  ["/reported", { reportCount: { $gt: 0 }, isDeleted: { $ne: true } }],
])("%s passes the same visibility filters through real pagination and Mongoose middleware", async (path, filter) => {
  // Stub only the database boundary: the plugin and query middleware must run.
  const find = jest.spyOn(Review.collection, "find").mockReturnValue({ toArray: async () => [] });
  const count = jest.spyOn(Review.collection, "countDocuments").mockResolvedValue(0);
  await request(app).get(path).set("x-test-actor", "admin").expect(200);
  expect(find.mock.calls[0][0]).toEqual(filter);
  expect(count.mock.calls[0][0]).toEqual(filter);
});

test("public listing excludes rejected, pending and deleted records from both rows and counts", async () => {
  const find = jest.spyOn(Review.collection, "find").mockReturnValue({ toArray: async () => [] });
  const count = jest.spyOn(Review.collection, "countDocuments").mockResolvedValue(0);
  await request(app).get("/reviews").expect(200);
  const filter = { isApproved: true, isRejected: { $ne: true }, isDeleted: { $ne: true } };
  expect(find.mock.calls[0][0]).toEqual(filter);
  expect(count.mock.calls[0][0]).toEqual(filter);
});

test("all management lists return the pagination totals used by the frontend", async () => {
  jest.spyOn(Review, "paginate").mockResolvedValue(paged);
  for (const path of ["/reviews", "/pending", "/reported"]) {
    const result = await request(app).get(path).set("x-test-actor", "admin").expect(200);
    expect(result.body.data.pagination).toMatchObject({ totalDocs: 21, totalItems: 21, totalPages: 3, currentPage: 2, limit: 10 });
  }
});

test("search matches product name, title and comment before pagination, with literal special characters", async () => {
  const products = jest.spyOn(Product, "find").mockReturnValue({ select: async () => [{ _id: ids.product }] });
  const paginate = jest.spyOn(Review, "paginate").mockResolvedValue(paged);
  await request(app).get("/reviews").set("x-test-actor", "admin").query({ search: " nồi.24 ", rating: "4", page: "2", limit: "10" }).expect(200);
  const filter = paginate.mock.calls[0][0];
  expect(filter.rating).toBe(4);
  const pattern = filter.$or[0].title;
  expect(new RegExp(pattern.$regex, pattern.$options).test("NỒI.24")).toBe(true);
  expect(new RegExp(pattern.$regex, pattern.$options).test("nồix24")).toBe(false);
  expect(filter.$or).toEqual([{ title: pattern }, { comment: pattern }, { productId: { $in: [ids.product] } }]);
  expect(products).toHaveBeenCalledWith({ name: pattern });
  expect(paginate.mock.calls[0][1]).toMatchObject({ page: 2, limit: 10 });
});

test("invalid pagination and sort parameters fall back to bounded defaults", async () => {
  const paginate = jest.spyOn(Review, "paginate").mockResolvedValue(paged);
  await request(app).get("/reviews?page=0&limit=999&sort=unknown&rating=invalid").expect(200);
  expect(paginate.mock.calls[0][1]).toMatchObject({ page: 1, limit: 100, sort: "-createdAt" });
  expect(paginate.mock.calls[0][0]).not.toHaveProperty("rating");
  await request(app).get("/reported?page=missing&limit=missing").expect(200);
  expect(paginate.mock.calls[1][1]).toMatchObject({ page: 1, limit: 10, sort: "-reportCount" });
});

function mockPersistence() {
  const findOne = jest.spyOn(Review.collection, "findOne").mockResolvedValue({ ...pending });
  const updateOne = jest.spyOn(Review.collection, "updateOne").mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
  jest.spyOn(Review.collection, "find").mockReturnValue({ toArray: async () => [] });
  jest.spyOn(Product.collection, "updateOne").mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
  return { findOne, updateOne };
}

test.each([
  ["approve", {}, { isApproved: true, isRejected: false }],
  ["reject", { reason: "Không phù hợp" }, { isApproved: false, isRejected: true, rejectionReason: "Không phù hợp" }],
])("the %s action can locate and save a pending review through real model methods", async (action, body, expected) => {
  const { findOne, updateOne } = mockPersistence();
  const result = await request(app).put(`/reviews/${ids.review}/${action}`).set("x-test-actor", "admin").send(body).expect(200);
  expect(findOne.mock.calls[0][0]).not.toHaveProperty("isApproved");
  expect(result.body.data).toMatchObject(expected);
  expect(updateOne).toHaveBeenCalledTimes(1);
  expect(Product.collection.updateOne).toHaveBeenCalledWith(
    { _id: ids.product },
    expect.objectContaining({ $set: expect.objectContaining({ averageRating: 0, reviewCount: 0 }) }),
    expect.any(Object)
  );
});

test("approve-and-respond persists both values in a single save", async () => {
  const { updateOne } = mockPersistence();
  const result = await request(app).post(`/reviews/${ids.review}/respond`).set("x-test-actor", "admin")
    .send({ comment: "  Cảm ơn bạn  ", approve: true }).expect(200);
  expect(result.body.data).toMatchObject({ isApproved: true, isRejected: false, adminResponse: { comment: "Cảm ơn bạn", adminId: String(ids.admin), createdAt: expect.any(String) } });
  expect(updateOne).toHaveBeenCalledTimes(1);
  expect(updateOne.mock.calls[0][1].$set).toMatchObject({ isApproved: true, adminResponse: { comment: "Cảm ơn bạn", adminId: ids.admin, createdAt: expect.any(Date) } });
});

test("responding without the approval flag leaves moderation status unchanged", async () => {
  mockPersistence();
  const result = await request(app).post(`/reviews/${ids.review}/respond`).set("x-test-actor", "admin")
    .send({ comment: "Cảm ơn bạn" }).expect(200);
  expect(result.body.data.isApproved).toBe(false);
});

test.each([{ comment: "   " }, { comment: {} }, { comment: "x".repeat(1001) }, { comment: "Thanks", approve: "true" }])("invalid response body is rejected without saving", async (body) => {
  const find = jest.spyOn(Review, "findById");
  await request(app).post(`/reviews/${ids.review}/respond`).set("x-test-actor", "admin").send(body).expect(400);
  expect(find).not.toHaveBeenCalled();
});

test("a rejected or pending review is included in the duplicate-review check", async () => {
  jest.spyOn(Product, "findById").mockResolvedValue({ _id: ids.product });
  const find = jest.spyOn(Review.collection, "findOne").mockResolvedValue(pending);
  await request(app).post("/reviews").set("x-test-actor", "owner").send({ productId: String(ids.product), rating: 5, comment: "Again" }).expect(400);
  expect(find.mock.calls[0][0]).not.toHaveProperty("isApproved");
});

test.each(["owner", "admin", "other"])("pending detail checks ownership after lookup for %s", async (actor) => {
  const doc = { ...pending, userId: { _id: ids.owner } };
  const query = { populate: jest.fn().mockReturnThis(), then: (resolve) => Promise.resolve(doc).then(resolve) };
  jest.spyOn(Review, "findById").mockReturnValue(query);
  await request(app).get(`/reviews/${ids.review}`).set("x-test-actor", actor).expect(actor === "other" ? 404 : 200);
});

test("missing populated user does not crash detail permission checks", async () => {
  const query = { populate: jest.fn().mockReturnThis(), then: (resolve) => Promise.resolve({ ...pending, userId: null }).then(resolve) };
  jest.spyOn(Review, "findById").mockReturnValue(query);
  await request(app).get(`/reviews/${ids.review}`).set("x-test-actor", "other").expect(404);
  await request(app).get(`/reviews/${ids.review}`).set("x-test-actor", "admin").expect(200);
});

test("owners can delete pending reviews, while other customers cannot", async () => {
  const { findOne, updateOne } = mockPersistence();
  await request(app).delete(`/reviews/${ids.review}`).set("x-test-actor", "other").expect(401);
  expect(updateOne).not.toHaveBeenCalled();
  await request(app).delete(`/reviews/${ids.review}`).set("x-test-actor", "owner").expect(200);
  expect(findOne.mock.calls[0][0]).not.toHaveProperty("isApproved");
  expect(updateOne.mock.calls[0][1].$set.isDeleted).toBe(true);
});

test("product rating average uses all published reviews even when the list is filtered by rating", async () => {
  jest.spyOn(Product, "findById").mockResolvedValue({ _id: ids.product });
  jest.spyOn(Review, "paginate").mockResolvedValue({ ...paged, totalDocs: 1 });
  jest.spyOn(Review, "aggregate").mockResolvedValue([{ _id: 5, count: 1 }, { _id: 3, count: 1 }]);
  const result = await request(app).get(`/products/${ids.product}/reviews?rating=5`).expect(200);
  expect(result.body.data.stats).toMatchObject({ totalReviews: 2, averageRating: "4.0" });
  expect(result.body.data.pagination.totalItems).toBe(1);
});
