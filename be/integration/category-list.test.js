const express = require("express");
const request = require("supertest");
const Category = require("../models/Category");
const { getCategories } = require("../controllers/category.controller");

const app = express();
app.get("/categories", getCategories);
app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));
afterEach(() => jest.restoreAllMocks());

test.each([
  ["", true],
  ["&flat=true", false],
  ["&flat=true&includeProducts=true", false],
])("category pagination handles populate options %s", async (suffix, hasChildren) => {
  const paginate = jest.spyOn(Category, "paginate").mockResolvedValue({
    docs: [{ _id: "category-1", name: "Nồi & chảo", productsCount: 2 }],
    totalDocs: 4, totalPages: 1, page: 1, limit: 10,
  });
  const response = await request(app).get(`/categories?page=1&limit=10${suffix}`).expect(200);
  expect(response.body.data.pagination.totalItems).toBe(4);
  expect(response.body.data.categories[0].name).toBe("Nồi & chảo");
  const options = paginate.mock.calls[0][1];
  expect(Array.isArray(options.populate)).toBe(true);
  expect(options.populate.some((entry) => entry.path === "subcategories")).toBe(hasChildren);
});
