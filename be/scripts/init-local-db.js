const mongoose = require("mongoose");
const path = require("path");

async function initialize() {
  const connection = await mongoose
    .createConnection("mongodb://127.0.0.1:27018/admin?directConnection=true", {
      serverSelectionTimeoutMS: 30000,
    })
    .asPromise();
  try {
    const admin = connection.db.admin();
    const options = await admin.command({ getCmdLineOpts: 1 });
    const expectedPath = path.resolve(__dirname, "../../.local/mongo");
    const actualPath = path.resolve(options.parsed.storage?.dbPath || "");
    const replicaSet =
      options.parsed.replication?.replSetName ||
      options.parsed.replication?.replSet;
    if (
      actualPath.toLowerCase() !== expectedPath.toLowerCase() ||
      replicaSet !== "kitchenLocal"
    ) {
      throw new Error(
        "Port 27018 is not the Kitchen E local database. No changes made."
      );
    }
    try {
      await admin.command({ replSetGetStatus: 1 });
    } catch (error) {
      if (error.code !== 94) throw error;
      await admin.command({
        replSetInitiate: {
          _id: "kitchenLocal",
          members: [{ _id: 0, host: "127.0.0.1:27018" }],
        },
      });
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      const state = await admin.command({ hello: 1 });
      if (state.isWritablePrimary) {
        if (state.setName !== "kitchenLocal")
          throw new Error("Unexpected replica set");
        console.log("Kitchen E local database is ready.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(
      "Local replica set did not elect a primary within 60 seconds."
    );
  } finally {
    await connection.close();
  }
}
initialize().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
