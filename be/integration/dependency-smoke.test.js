const sharp = require("sharp");
const nodemailer = require("nodemailer");
const { RedisStore } = require("rate-limit-redis");

test("image processor decodes and resizes the local product assets", async () => {
  const output = await sharp(
    require("path").resolve(
      __dirname,
      "../../fe/public/images/chopping-board.webp"
    )
  )
    .resize(80, 60, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const metadata = await sharp(output).metadata();
  expect(metadata.format).toBe("jpeg");
  expect(metadata.width).toBeLessThanOrEqual(80);
  expect(metadata.height).toBeLessThanOrEqual(60);
});

test("mailer renders a message without any external delivery", async () => {
  const mailer = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  });
  const result = await mailer.sendMail({
    from: "test@kitchen.local",
    to: "customer@kitchen.local",
    subject: "Local test",
    html: "<p>Kitchen E</p>",
  });
  expect(result.message.toString()).toContain("Subject: Local test");
  expect(result.message.toString()).toContain("<p>Kitchen E</p>");
});

test("Redis limiter supports the installed store contract and isolated prefixes", async () => {
  const sendCommand = jest.fn(async (...args) =>
    args[0] === "SCRIPT" ? "test-sha" : [1, 1000]
  );
  const store = new RedisStore({ prefix: "kitchen:limit:auth:", sendCommand });
  store.init({ windowMs: 1000 });
  const result = await store.increment("127.0.0.1");
  expect(result.totalHits).toBe(1);
  expect(sendCommand).toHaveBeenCalledWith(
    "EVALSHA",
    expect.any(String),
    "1",
    "kitchen:limit:auth:127.0.0.1",
    "0",
    "1000"
  );
});
