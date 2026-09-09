const router = require("express").Router();
const Joi = require("joi");
const StoreSettings = require("../../models/StoreSettings");
const { getSettings } = require("../../services/store-settings.service");
const { protect, authorize } = require("../../middlewares/auth.middleware");
const asyncHandler = require("../../middlewares/async.middleware");
const ApiError = require("../../utils/apiError");
const ApiResponse = require("../../utils/apiResponse");

const settingsSchema = Joi.object({
  storeName: Joi.string().trim().min(1).max(80).required(),
  contactEmail: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .allow("")
    .required(),
  contactPhone: Joi.string().trim().max(30).allow("").required(),
  address: Joi.string().trim().max(300).allow("").required(),
  standardShipping: Joi.number().integer().min(0).max(10000000).required(),
  expressShipping: Joi.number().integer().min(0).max(10000000).required(),
  freeShippingThreshold: Joi.number()
    .integer()
    .min(0)
    .max(100000000)
    .required(),
  bankName: Joi.string().trim().max(100).allow("").required(),
  bankAccount: Joi.string().trim().max(50).allow("").required(),
  bankAccountName: Joi.string().trim().max(100).allow("").required(),
});

router.get(
  "/public",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    delete settings._id;
    delete settings.__v;
    delete settings.key;
    return ApiResponse.success(res, { settings });
  })
);
router.get(
  "/",
  protect,
  authorize("admin", "staff"),
  asyncHandler(async (_req, res) => {
    return ApiResponse.success(res, { settings: await getSettings() });
  })
);
router.put(
  "/",
  protect,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const { error, value } = settingsSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error)
      throw new ApiError(
        error.details.map((item) => item.message).join(", "),
        400
      );
    const settings = await StoreSettings.findOneAndUpdate(
      { key: "store" },
      { $set: value },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
    return ApiResponse.success(res, { settings });
  })
);

module.exports = router;
