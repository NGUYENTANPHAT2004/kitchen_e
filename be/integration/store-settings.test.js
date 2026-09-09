const { dateRange } = require("../controllers/report.controller");
const { shippingCost } = require("../services/store-settings.service");
describe("Store settings and report rules", () => {
  const settings = {
    freeShippingThreshold: 500000,
    standardShipping: 30000,
    expressShipping: 50000,
  };
  test("uses shipping fees below the threshold", () => {
    expect(shippingCost(settings, 499999, "standard")).toBe(30000);
    expect(shippingCost(settings, 499999, "express")).toBe(50000);
  });
  test("ships for free at the exact configured threshold", () => {
    expect(shippingCost(settings, 500000, "standard")).toBe(0);
  });
  test("rejects invalid, reversed and excessive report ranges", () => {
    for (const query of [
      { startDate: "bad" },
      { startDate: "2026-10-01", endDate: "2026-09-01" },
      { startDate: "2024-01-01", endDate: "2026-09-01" },
    ])
      expect(() => dateRange(query)).toThrow();
  });
  test("includes the entire end date", () => {
    expect(
      dateRange({
        startDate: "2026-09-01",
        endDate: "2026-09-07",
      }).$lte.toISOString()
    ).toBe("2026-09-07T23:59:59.999Z");
  });
});
