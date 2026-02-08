const express = require("express");
const router = express.Router();
const controller = require("../controllers/productVariantController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// Get all variants (with filters)
router.get("/", controller.getAllVariants);

// Create variant for product
router.post("/:productId/variants", validateIdParam('productId'), controller.createVariant);

// Get variants by product
router.get("/:productId/variants", validateIdParam('productId'), controller.getVariantsByProductId);

// Update variant
router.put("/:productId/variants/:variantId", 
  validateIdParam('productId'), 
  validateIdParam('variantId'), 
  controller.updateVariant
);

// Delete variant
router.delete("/:productId/variants/:variantId", 
  validateIdParam('productId'), 
  validateIdParam('variantId'), 
  controller.deleteVariant
);

module.exports = router;
