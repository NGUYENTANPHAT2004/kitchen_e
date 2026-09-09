const fs = require("node:fs");
const path = require("node:path");

// Discover the actual model bindings used by paginated controllers so a new
// listing cannot silently miss its model's pagination plugin.
const directory = path.resolve(__dirname, "../controllers");
const models = new Map();
for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".js"))) {
  const source = fs.readFileSync(path.join(directory, file), "utf8");
  const bindings = new Map(
    [...source.matchAll(/const\s+(\w+)\s*=\s*require\(["'](\.\.\/models\/[^"']+)["']\)/g)]
      .map((match) => [match[1], path.resolve(directory, match[2])])
  );
  for (const match of source.matchAll(/\b([A-Z]\w*)\.paginate\(/g)) {
    if (!bindings.has(match[1])) throw new Error(`Unknown paginated model ${match[1]} in ${file}`);
    models.set(match[1], bindings.get(match[1]));
  }
}

afterEach(() => jest.restoreAllMocks());

test.each([...models])("%s executes the pagination contract used by the API", async (_name, modulePath) => {
  const Model = require(modulePath);
  const row = { _id: "test-record" };
  const query = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([row]),
  };
  jest.spyOn(Model, "find").mockReturnValue(query);
  jest.spyOn(Model, "countDocuments").mockReturnValue({ exec: async () => 21 });
  const result = await Model.paginate({}, { page: 2, limit: 10 });
  expect(result).toMatchObject({ docs: [row], totalDocs: 21, totalPages: 3, page: 2, limit: 10, hasNextPage: true });
  expect(query.skip).toHaveBeenCalledWith(10);
  expect(query.limit).toHaveBeenCalledWith(10);
});
