const StoreSettings = require("../models/StoreSettings");

const getSettings = async () => {
  const settings = await StoreSettings.findOne({ key: "store" }).lean();
  return settings || new StoreSettings().toObject();
};

const shippingCost = (settings, subtotal, method) =>
  subtotal >= settings.freeShippingThreshold
    ? 0
    : method === "express"
    ? settings.expressShipping
    : settings.standardShipping;

module.exports = { getSettings, shippingCost };
