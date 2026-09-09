const router = require("express").Router();
const { protect, authorize } = require("../../middlewares/auth.middleware");
const controller = require("../../controllers/report.controller");
router.use(protect, authorize("admin", "staff"));
router.get("/sales", controller.sales);
router.get("/customers", controller.customers);
module.exports = router;
