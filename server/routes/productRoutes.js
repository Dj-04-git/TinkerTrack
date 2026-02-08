const express = require("express");
const router = express.Router();
const controller = require("../controllers/productController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// Create product
router.post("/", controller.createProduct);

// Get all products (with filters)
router.get("/", controller.getProducts);

// Get product count
router.get("/count", controller.getProductCount);

// Get product by ID (with variants, plans, taxes)
router.get("/:productId", validateIdParam('productId'), controller.getProductById);

// Update product
router.put("/:productId", validateIdParam('productId'), controller.updateProduct);

// Delete product
router.delete("/:productId", validateIdParam('productId'), controller.deleteProduct);

// Get product plans
router.get("/:productId/plans", validateIdParam('productId'), controller.getProductPlans);

// Add plan to product
router.post("/:productId/plans", validateIdParam('productId'), controller.addPlanToProduct);

// Remove plan from product
router.delete("/:productId/plans/:planId", validateIdParam('productId'), controller.removePlanFromProduct);

// Get product variants
router.get("/:productId/variants", validateIdParam('productId'), controller.getProductVariants);

// Get product taxes
router.get("/:productId/taxes", validateIdParam('productId'), controller.getProductTaxes);

module.exports = router;
