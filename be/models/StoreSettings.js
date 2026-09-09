const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    key: { type: String, default: "store", unique: true },
    storeName: { type: String, default: "Kitchen E", maxlength: 80 },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    address: { type: String, default: "", maxlength: 300 },
    standardShipping: { type: Number, default: 30000, min: 0 },
    expressShipping: { type: Number, default: 50000, min: 0 },
    freeShippingThreshold: { type: Number, default: 500000, min: 0 },
    bankName: { type: String, default: "" },
    bankAccount: { type: String, default: "" },
    bankAccountName: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StoreSettings", schema);
