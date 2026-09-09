const express = require("express");
const request = require("supertest");
const Voucher = require("../models/Voucher");
const UserVoucher = require("../models/UserVoucher");
const { getVouchers, getUserVouchers } = require("../controllers/voucher.controller");

const app = express();
app.get("/vouchers", getVouchers);
app.get("/users/:userId/vouchers", getUserVouchers);
app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));

const paged = {
  docs: [{ _id: "voucher-1", code: "KITCHEN10" }],
  totalDocs: 21,
  totalPages: 3,
  page: 2,
  limit: 10,
  hasNextPage: true,
  hasPrevPage: true,
};

afterEach(() => jest.restoreAllMocks());

test("both voucher models expose the pagination method used by their controllers", () => {
  expect(typeof Voucher.paginate).toBe("function");
  expect(typeof UserVoucher.paginate).toBe("function");
});

test("listing returns records and the pagination fields consumed by the management page", async () => {
  const paginate = jest.spyOn(Voucher, "paginate").mockResolvedValue(paged);
  const response = await request(app).get("/vouchers?page=2&limit=10").expect(200);
  expect(response.body.data).toMatchObject({
    vouchers: [{ code: "KITCHEN10" }],
    pagination: { currentPage: 2, totalPages: 3, totalDocs: 21, totalItems: 21, limit: 10 },
  });
  expect(paginate).toHaveBeenCalledWith(
    { isDeleted: false },
    expect.objectContaining({ page: 2, limit: 10 })
  );
});

test("search, enabled state and discount type from the frontend are applied together", async () => {
  const paginate = jest.spyOn(Voucher, "paginate").mockResolvedValue(paged);
  await request(app).get("/vouchers").query({ search: " kitchen.10 ", isActive: "false", discountType: "fixed" }).expect(200);
  const query = paginate.mock.calls[0][0];
  expect(query).toMatchObject({ isDeleted: false, isActive: false, discountType: "fixed" });
  for (const field of ["code", "description"]) {
    const pattern = query.$or.find((item) => item[field])[field];
    const expression = new RegExp(pattern.$regex, pattern.$options);
    expect(expression.test("KITCHEN.10")).toBe(true);
    expect(expression.test("KITCHENX10")).toBe(false);
  }
});

test("legacy active and expired filters remain supported", async () => {
  const paginate = jest.spyOn(Voucher, "paginate").mockResolvedValue(paged);
  await request(app).get("/vouchers?active=true").expect(200);
  expect(paginate.mock.calls[0][0]).toMatchObject({ isActive: true, startDate: { $lte: expect.any(Date) }, endDate: { $gte: expect.any(Date) } });
  await request(app).get("/vouchers?expired=true").expect(200);
  expect(paginate.mock.calls[1][0]).toMatchObject({ endDate: { $lt: expect.any(Date) } });
});

test("invalid pagination values fall back to bounded values", async () => {
  const paginate = jest.spyOn(Voucher, "paginate").mockResolvedValue(paged);
  await request(app).get("/vouchers?page=0&limit=200").expect(200);
  expect(paginate.mock.calls[0][1]).toMatchObject({ page: 1, limit: 100 });
  await request(app).get("/vouchers?page=missing&limit=missing").expect(200);
  expect(paginate.mock.calls[1][1]).toMatchObject({ page: 1, limit: 10 });
});

test("assigned voucher listing can use its model's pagination method", async () => {
  const paginate = jest.spyOn(UserVoucher, "paginate").mockResolvedValue({
    ...paged, docs: [{ voucherId: { code: "PRIVATE10" } }],
  });
  const response = await request(app).get("/users/customer-1/vouchers?active=true").expect(200);
  expect(response.body.data.vouchers[0].voucherId.code).toBe("PRIVATE10");
  expect(paginate.mock.calls[0][0]).toMatchObject({ userId: "customer-1", isUsed: false, isDeleted: false });
});
