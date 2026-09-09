const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const base = "http://127.0.0.1:5000/api";
let sessionId;
let sessionToken;
let assertions = 0;
function check(condition, label) {
  assert.ok(condition, label);
  assertions++;
  console.log(`PASS ${label}`);
}

async function json(url, { token, body } = {}) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, `Expected HTTP 200 from ${new URL(url).pathname}`);
  return response.json();
}

async function run() {
  try {
    await mongoose.connect(
      "mongodb://127.0.0.1:27018/kitchen_e_local?replicaSet=kitchenLocal",
      { serverSelectionTimeoutMS: 5000 }
    );
    const primary = await mongoose.connection.db.admin().command({ hello: 1 });
    check(primary.isWritablePrimary && primary.setName === "kitchenLocal", "MongoDB local replica set is ready");
    const web = await fetch("http://127.0.0.1:5173", { signal: AbortSignal.timeout(10000) });
    check(web.status === 200, "Frontend is reachable");
    check((await json(`${base}/health`)).status === "OK", "Backend is ready");
    const health = await json("http://127.0.0.1:8000/health");
    check(health.database === "connected" && health.database_name === "kitchen_e_local", "Python parses the replica-set URI and connects to the same database");
    check(health.chat.ready && health.chat.product_count > 0, "Python loads the real local product catalog");

    const admin = await json(`${base}/auth/login`, { body: { email: "admin@kitchen.local", password: "KitchenLocal2026!" } });
    check(typeof admin.token === "string", "Local admin login works");
    const customer = await json(`${base}/auth/login`, { body: { email: "customer@kitchen.local", password: "KitchenLocal2026!" } });
    check(typeof customer.token === "string", "Local customer login works");
    // Regression: /auth/me polling previously exhausted a shared 10/hour limit.
    for (let attempt = 0; attempt < 12; attempt++) {
      await json(`${base}/auth/me`, { token: customer.token });
    }
    const afterPolling = await json(`${base}/auth/login`, { body: { email: "customer@kitchen.local", password: "KitchenLocal2026!" } });
    check(typeof afterPolling.token === "string", "Successful profile polling never blocks the next login");
    const settings = (await json(`${base}/ai/settings`, { token: admin.token })).data;
    check(settings.connected && settings.settings.enabled, "Backend sees Python and chat is enabled");

    const greeting = (await json(`${base}/ai/chat`, { token: customer.token, body: { message: "Xin chào" } })).data;
    sessionId = greeting.session_id;
    sessionToken = greeting.session_token;
    check(greeting.intent_type === "greeting" && greeting.response.length > 0, "Authenticated chat round trip succeeds");
    const products = (await json(`${base}/ai/chat`, { token: customer.token, body: { message: "Chảo", sessionId, sessionToken } })).data;
    check(products.intent_type === "product_inquiry" && products.suggested_products.length > 0, "Product questions return catalog suggestions");
    for (const product of products.suggested_products) {
      check(product.image === null || typeof product.image === "string", "Product images serialize as URLs");
      const stored = await mongoose.connection.db.collection("products").findOne({ _id: new mongoose.Types.ObjectId(product.id) });
      check(stored && stored.name === product.name && stored.basePrice === product.price, "Suggested product and price match MongoDB");
    }
    const order = (await json(`${base}/ai/chat`, { token: customer.token, body: { message: "Đơn hàng LOCALTEST12345", sessionId, sessionToken } })).data;
    check(order.intent_type === "order_status" && order.response.includes("chưa tra cứu"), "Chat explains order-lookup limitations without inventing delivery status");
    const history = (await json(`${base}/ai/chat/history?sessionId=${encodeURIComponent(sessionId)}`, { token: customer.token })).data;
    check(history.count === 3 && history.history.some((entry) => entry.query === "Chảo"), "Backend persists the test conversation");
    console.log(`Local AI verification complete: ${assertions} assertions. Test conversation: ${sessionId}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(`Local AI verification failed: ${error.message}`);
  process.exitCode = 1;
});
