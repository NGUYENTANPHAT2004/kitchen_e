// routes/api/recipes.routes.js
const express = require("express");
const router = express.Router();
const recipeController = require("../../controllers/recipe.controller");
const {
  protect,
  authorize,
  optionalAuth,
} = require("../../middlewares/auth.middleware");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// Configure multer for multiple file uploads
const recipeUpload = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "stepImages", maxCount: 10 },
]);

// Public recipe routes
router.get("/", optionalAuth, recipeController.getRecipes);
router.get("/featured", recipeController.getFeaturedRecipes);
router.get("/popular", recipeController.getPopularRecipes);
router.get("/search", recipeController.searchRecipes);
router.get("/:id", optionalAuth, recipeController.getRecipe);
router.get("/:id/products", recipeController.getRecipeProducts);

// Protected recipe routes
router.post(
  "/",
  protect,
  authorize("admin", "staff"),
  recipeUpload,
  recipeController.createRecipe
);

router.put("/:id", protect, recipeUpload, recipeController.updateRecipe);

router.delete("/:id", protect, recipeController.deleteRecipe);

router.put(
  "/:id/restore",
  protect,
  authorize("admin"),
  recipeController.restoreRecipe
);

router.post("/:id/rate", protect, recipeController.rateRecipe);

router.post(
  "/:id/products",
  protect,
  authorize("admin", "staff", "author"),
  recipeController.manageRecipeProducts
);

router.put(
  "/:id/feature",
  protect,
  authorize("admin"),
  recipeController.toggleFeatureRecipe
);

router.put(
  "/:id/verify",
  protect,
  authorize("admin", "staff"),
  recipeController.verifyRecipe
);

module.exports = router;
