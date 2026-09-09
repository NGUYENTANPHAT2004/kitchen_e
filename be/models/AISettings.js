const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    key: { type: String, default: "assistant", unique: true },
    enabled: { type: Boolean, default: false },
    language: { type: String, enum: ["vi", "en"], default: "vi" },
  },
  { timestamps: true }
);
schema.statics.current = async function () {
  return (
    (await this.findOne({ key: "assistant" }).lean()) || {
      enabled: false,
      language: "vi",
    }
  );
};
module.exports = mongoose.model("AISettings", schema);
