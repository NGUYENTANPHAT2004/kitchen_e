const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const User = require("../models/User");
const base = "http://127.0.0.1:5000/api";
const tag = Date.now().toString(36);
let assertions = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  assertions++;
  console.log(`PASS ${label}`);
};
async function api(path, token, method = "GET", body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return { status: response.status, ...data };
}
async function login(email) {
  const result = await api("/auth/login", null, "POST", {
    email,
    password: "KitchenLocal2026!",
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  return result.token;
}
async function run() {
  await mongoose.connect(
    "mongodb://127.0.0.1:27018/kitchen_e_local?replicaSet=kitchenLocal"
  );
  const customer = await login("customer@kitchen.local");
  const admin = await login("admin@kitchen.local");
  const catalog = await api("/products?limit=20", customer);
  check(
    (await api("/ai/settings", customer)).status === 403,
    "AI settings require admin"
  );
  const aiSettings = await api("/ai/settings", admin);
  check(
    typeof aiSettings.data.connected === "boolean",
    "AI connection status is explicit"
  );
  check(
    (await api("/ai/settings", admin, "PUT", aiSettings.data.settings)).success,
    "AI settings are persisted"
  );
  check(
    (await api("/ai/chat/history?sessionId=local-test")).status === 401,
    "anonymous users cannot read chat history"
  );
  const product = catalog.data.products.find(
    (entry) => entry.sku === "KE-LOCAL-2"
  );
  check(product && product.stockQuantity > 0, "catalog includes stock");
  check(Array.isArray(product.variants), "catalog includes variant choices");
  check(
    (await api("/settings", customer)).status === 403,
    "customers cannot access management settings"
  );
  check(
    (await api("/reports/sales", customer)).status === 403,
    "customers cannot access reports"
  );
  check(
    (await api("/reports/sales?startDate=2026-10-01&endDate=2026-09-01", admin))
      .status === 400,
    "report rejects reversed dates"
  );
  check(
    (
      await api("/notifications/bulk", admin, "POST", {
        userIds: [],
        title: "Test",
        message: "Test",
        type: "system",
      })
    ).status === 400,
    "empty recipient list cannot broadcast"
  );
  await api("/cart", customer, "DELETE");
  const added = await api("/cart/items", customer, "POST", {
    productId: product._id,
    quantity: 2,
  });
  check(
    added.success,
    `cart add succeeds: ${JSON.stringify(added.error || "")}`
  );
  const cart = await api("/cart", customer);
  check(
    cart.data.cart.items.length === 1 && cart.data.cart.items[0].quantity === 2,
    "cart persists added quantity"
  );
  const voucher = await api("/vouchers/apply", customer, "POST", {
    code: "KITCHEN10",
  });
  check(
    voucher.success,
    `voucher validates: ${JSON.stringify(voucher.error || "")}`
  );
  const payload = {
    paymentMethod: "cod",
    shippingMethod: "standard",
    voucherCode: "KITCHEN10",
    shippingAddress: {
      fullName: "Local Test",
      phone: "0901234567",
      address: "123 Test Street",
      city: "Test City",
      state: "Test District",
      postalCode: "70000",
      country: "Vietnam",
    },
  };
  const headers = { "Idempotency-Key": `local-check-${tag}` };
  const placed = await api("/orders", customer, "POST", payload, headers);
  check(
    placed.status === 201,
    `checkout succeeds: ${JSON.stringify(placed.error || placed.message)}`
  );
  const order = placed.data.order;
  check(
    order.orderItems.length === 1 &&
      order.orderItems[0].productSnapshot.name === product.name,
    "order snapshots product and items"
  );
  check(
    order.subtotal === product.basePrice * 2 &&
      order.discount === order.subtotal * 0.1,
    "order uses server price and voucher"
  );
  const replay = await api("/orders", customer, "POST", payload, headers);
  check(replay.data?.order?._id === order._id, "retry returns the same order");
  const modified = await api(
    "/orders",
    customer,
    "POST",
    { ...payload, notes: "changed" },
    headers
  );
  check(modified.status === 409, "idempotency key rejects changed request");
  const customerOrders = await api("/orders", customer);
  check(
    customerOrders.data.orders.every(
      (entry) =>
        String(entry.userId?._id || entry.userId) === String(order.userId)
    ),
    "customer order list stays scoped"
  );
  const adminOrders = await api("/orders?scope=admin&limit=100", admin);
  check(
    adminOrders.data.orders.some((entry) => entry._id === order._id),
    "admin list includes customer orders"
  );
  check(
    (
      await api(`/orders/${order._id}/status`, admin, "PUT", {
        status: "delivered",
      })
    ).status === 409,
    "order cannot skip fulfillment stages"
  );
  check(
    (await api(`/orders/${order._id}/cancel`, customer, "PUT")).success,
    "customer cancels pending unpaid order"
  );
  const restored = await Product.findById(product._id);
  check(
    restored.stockQuantity === product.stockQuantity,
    "cancellation restores stock exactly"
  );
  await api(`/orders/${order._id}/cancel`, customer, "PUT");
  check(
    (await Product.findById(product._id)).stockQuantity ===
      product.stockQuantity,
    "repeat cancellation does not inflate stock"
  );
  check(
    (
      await api("/payments/initiate", customer, "POST", {
        orderId: order._id,
        paymentMethod: "momo",
      })
    ).status === 503,
    "unsupported gateway fails without fake redirect"
  );

  const secondEmail = `test${tag}@kitchen.local`;
  await User.create({
    email: secondEmail,
    username: `t_${tag}`,
    password: "KitchenLocal2026!",
    isEmailVerified: true,
  });
  const second = await login(secondEmail);
  check(
    (await api(`/orders/${order._id}`, second)).status === 403,
    "other customer cannot read an order"
  );
  const last = await Product.create({
    name: `Local concurrency ${tag}`,
    description: "Local integration test stock",
    sku: `LOCAL-RACE-${tag}`,
    categoryId: product.categoryId._id,
    basePrice: 100000,
    stockQuantity: 1,
  });
  await api("/cart", customer, "DELETE");
  await api("/cart/items", customer, "POST", {
    productId: String(last._id),
    quantity: 1,
  });
  await api("/cart/items", second, "POST", {
    productId: String(last._id),
    quantity: 1,
  });
  const results = await Promise.all(
    [customer, second].map((token, index) =>
      api(
        "/orders",
        token,
        "POST",
        { ...payload, voucherCode: undefined },
        { "Idempotency-Key": `race-${tag}-${index}` }
      )
    )
  );
  check(
    results.filter((result) => result.status === 201).length === 1,
    `only one last-stock checkout succeeds (${results.map((r) => r.status)})`
  );
  check(
    results.filter((result) => result.status === 409).length === 1,
    "losing checkout gets a recoverable conflict"
  );
  check(
    (await Product.findById(last._id)).stockQuantity === 0,
    "concurrent checkout never oversells"
  );
  const winnerIndex = results.findIndex((result) => result.status === 201);
  const winner = results[winnerIndex].data.order;
  await api(
    `/orders/${winner._id}/cancel`,
    [customer, second][winnerIndex],
    "PUT"
  );
  await api("/cart", customer, "DELETE");
  await api("/cart", second, "DELETE");
  await Product.updateOne({ _id: last._id }, { $set: { isDeleted: true } });
  const currentSettings = (await api("/settings", admin)).data.settings;
  const fields = [
    "storeName",
    "contactEmail",
    "contactPhone",
    "address",
    "standardShipping",
    "expressShipping",
    "freeShippingThreshold",
    "bankName",
    "bankAccount",
    "bankAccountName",
  ];
  const originalSettings = Object.fromEntries(
    fields.map((field) => [field, currentSettings[field]])
  );
  try {
    const bankSettings = {
      ...originalSettings,
      bankName: "LOCAL TEST ONLY",
      bankAccount: "TEST-NOT-A-REAL-ACCOUNT",
      bankAccountName: "LOCAL TEST",
      standardShipping: 35000,
    };
    check(
      (await api("/settings", admin, "PUT", bankSettings)).success,
      "admin persists store settings"
    );
    check(
      (await api("/settings/public")).data.settings.standardShipping === 35000,
      "public settings reflect persisted fees"
    );
    check(
      (
        await api("/settings", admin, "PUT", {
          ...bankSettings,
          standardShipping: -1,
        })
      ).status === 400,
      "negative shipping fees are rejected"
    );
    await api("/cart/items", customer, "POST", {
      productId: product._id,
      quantity: 1,
    });
    const transfer = await api(
      "/orders",
      customer,
      "POST",
      { ...payload, voucherCode: undefined, paymentMethod: "bank_transfer" },
      { "Idempotency-Key": `transfer-${tag}` }
    );
    check(transfer.status === 201, "bank transfer order has a pending payment");
    const transferId = transfer.data.order._id;
    check(
      transfer.data.order.shippingCost === 35000,
      "checkout uses persisted shipping setting"
    );
    check(
      (
        await api(`/orders/${transferId}/confirm-transfer`, customer, "POST", {
          reference: `LOCAL-${tag}`,
        })
      ).status === 403,
      "customer cannot confirm their own payment"
    );
    const confirmed = await api(
      `/orders/${transferId}/confirm-transfer`,
      admin,
      "POST",
      { reference: `LOCAL-${tag}` }
    );
    check(
      confirmed.data?.order?.isPaid === true,
      "admin confirmation transaction marks transfer paid"
    );
    check(
      (
        await api(`/orders/${transferId}/confirm-transfer`, admin, "POST", {
          reference: `LOCAL-${tag}`,
        })
      ).status === 409,
      "duplicate bank confirmation is rejected"
    );
    check(
      (
        await api(`/orders/${transferId}/status`, admin, "PUT", {
          status: "shipped",
        })
      ).success,
      "paid order advances to shipped"
    );
    check(
      (
        await api(`/orders/${transferId}/status`, admin, "PUT", {
          status: "delivered",
        })
      ).success,
      "shipped order advances to delivered"
    );
    check(
      (await api("/reports/sales", admin)).data.summary.revenue >=
        transfer.data.order.totalAmount,
      "report includes confirmed paid revenue"
    );
  } finally {
    const restoredSettings = await api(
      "/settings",
      admin,
      "PUT",
      originalSettings
    );
    assert.ok(
      restoredSettings.success,
      "Restore original local store settings"
    );
  }
  const recipeData = {
    title: `Local recipe ${tag}`,
    description: "Local CRUD verification",
    ingredients: [{ name: "Vegetables", quantity: "100", unit: "g" }],
    instructions: [{ step: 1, description: "Cook vegetables." }],
    preparationTime: 5,
    cookingTime: 5,
    servings: 1,
    isPublished: true,
    tags: ["local", "test"],
    coverImage: "/images/kitchen.jpg",
  };
  const recipe = await api("/recipes", admin, "POST", recipeData);
  check(recipe.status === 201, "admin creates recipe");
  const recipeId = recipe.data.recipe._id;
  const edited = await api(`/recipes/${recipeId}`, admin, "PUT", {
    title: `Edited ${tag}`,
    tags: JSON.stringify(["updated"]),
    nutritionInfo: { carbs: 15 },
  });
  check(
    edited.data?.recipe?.tags[0] === "updated" &&
      edited.data.recipe.nutritionInfo.carbs === 15,
    "recipe edit saves tags and nutrition"
  );
  check(
    (
      await api(`/recipes/${recipeId}/products`, admin, "POST", {
        productId: product._id,
        action: "add",
      })
    ).success,
    "recipe links an actual product"
  );
  check(
    (await api(`/recipes/${recipeId}`, admin)).data.recipe.relatedProducts
      .length === 1,
    "recipe detail returns product links"
  );
  check(
    (await api(`/recipes/${recipeId}`, admin, "PUT", { isPublished: false }))
      .success,
    "recipe can be saved as a draft"
  );
  check(
    (await api(`/recipes/${recipeId}`)).status === 404,
    "draft recipe stays hidden from visitors"
  );
  check(
    (await api(`/recipes/${recipeId}`, admin)).data?.recipe?.isPublished ===
      false,
    "admin can reopen a draft"
  );
  check(
    (
      await api(`/recipes/${recipeId}/products`, admin, "POST", {
        productId: product._id,
        action: "remove",
      })
    ).success,
    "admin can edit draft product links"
  );
  check(
    (await api(`/recipes/${recipeId}`, admin, "DELETE")).success,
    "admin can delete a draft"
  );
  check(
    (await api(`/recipes/${recipeId}/restore`, admin, "PUT")).success,
    "admin can restore a deleted draft"
  );
  await api(`/recipes/${recipeId}`, admin, "DELETE");
  const sale = await api("/flash-sales", admin, "POST", {
    name: `Local sale ${tag}`,
    startDate: new Date(Date.now() + 3600000).toISOString(),
    endDate: new Date(Date.now() + 7200000).toISOString(),
  });
  check(sale.status === 201, "admin creates Flash Sale");
  const saleId = sale.data._id;
  const saleItem = await api(`/flash-sales/${saleId}/items`, admin, "POST", {
    productId: product._id,
    discountPercent: 10,
    quantity: 5,
  });
  check(saleItem.status === 201, "Flash Sale adds product");
  const saleUpdate = await api(
    `/flash-sales/items/${saleItem.data._id}`,
    admin,
    "PUT",
    { discountPercent: 20 }
  );
  check(
    saleUpdate.data?.discountedPrice === product.basePrice * 0.8,
    "Flash Sale editing recalculates price"
  );
  check(
    (await api(`/flash-sales/items/${saleItem.data._id}`, admin, "DELETE"))
      .success,
    "Flash Sale item deletion works with Mongoose 7"
  );
  await api(`/flash-sales/${saleId}`, admin, "DELETE");
  const bundle = await api("/bundles", admin, "POST", {
    name: `Local bundle ${tag}`,
    description: "Local bundle test",
    discountType: "fixed",
    discountValue: 10000,
    isActive: false,
  });
  check(bundle.status === 201, "fixed bundle discount can exceed 100 VND");
  const bundleId = bundle.data.bundle._id;
  const bundleItem = await api(`/bundles/${bundleId}/items`, admin, "POST", {
    productId: product._id,
    quantity: 2,
  });
  check(bundleItem.status === 201, "bundle accepts a real product");
  check(
    (
      await api(
        `/bundles/${bundleId}/items/${bundleItem.data.item._id}`,
        admin,
        "DELETE"
      )
    ).success,
    "bundle product can be removed"
  );
  await api(`/bundles/${bundleId}`, admin, "DELETE");
  console.log(`Verified ${assertions} local commerce assertions.`);
}
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
