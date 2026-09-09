const mongoose = require("mongoose");
const Product = require("../models/Product");
const Review = require("../models/Review");

// Rebuild derived fields for existing local data after adding persisted ratings.
// This intentionally uses the local demo database instead of credentials in .env.
async function rebuild() {
  await mongoose.connect("mongodb://127.0.0.1:27018/kitchen_e_local?replicaSet=kitchenLocal", { autoIndex: false });
  try {
    const [products, ratings] = await Promise.all([
      Product.find({ isDeleted: { $ne: true } }).select("_id").lean(),
      Review.aggregate([
        { $match: { isApproved: true, isRejected: { $ne: true }, isDeleted: { $ne: true } } },
        { $group: { _id: "$productId", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
      ]),
    ]);
    const byProduct = new Map(ratings.map(row => [String(row._id), row]));
    if (products.length) {
      await Product.bulkWrite(products.map(product => {
        const rating = byProduct.get(String(product._id));
        return { updateOne: {
          filter: { _id: product._id },
          update: { $set: { averageRating: rating?.averageRating ?? 0, reviewCount: rating?.reviewCount ?? 0 } },
        } };
      }));
    }
    console.log(`Rebuilt review ratings for ${products.length} local products.`);
  } finally {
    await mongoose.disconnect();
  }
}

rebuild().catch(error => { console.error(error.message); process.exitCode = 1; });
