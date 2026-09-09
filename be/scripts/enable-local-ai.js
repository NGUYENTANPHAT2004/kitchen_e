const mongoose = require("mongoose");
const AISettings = require("../models/AISettings");

async function enable() {
  try {
    await mongoose.connect(
      "mongodb://127.0.0.1:27018/kitchen_e_local?replicaSet=kitchenLocal",
      { serverSelectionTimeoutMS: 5000 }
    );
    await AISettings.findOneAndUpdate(
      { key: "assistant" },
      { $set: { enabled: true }, $setOnInsert: { language: "vi" } },
      { upsert: true, runValidators: true }
    );
    console.log("Chat enabled for the local test database.");
  } finally {
    await mongoose.disconnect();
  }
}

enable().catch(() => {
  console.error("Could not enable chat in the local test database.");
  process.exitCode = 1;
});
