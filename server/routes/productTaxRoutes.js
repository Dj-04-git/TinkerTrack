const express = require("express");
const router = express.Router();
const controller = require("../controllers/productTaxController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// Create tax
router.post("/", controller.createTax);

// Get all taxes
router.get("/", controller.getTaxes);

// Get tax by ID
router.get("/:taxId", validateIdParam('taxId'), controller.getTaxById);

// Update tax
router.put("/:taxId", validateIdParam('taxId'), controller.updateTax);

// Delete tax
router.delete("/:taxId", validateIdParam('taxId'), controller.deleteTax);

// Assign tax to product
router.post("/assign", controller.assignTaxToProduct);

// Remove tax from product
router.delete("/assign/:productId/:taxId", 
  validateIdParam('productId'), 
  validateIdParam('taxId'), 
  controller.removeTaxFromProduct
);

// Get taxes for product
router.get("/product/:productId", validateIdParam('productId'), controller.getTaxesForProduct);

// Get products for tax
router.get("/:taxId/products", validateIdParam('taxId'), controller.getProductsForTax);

module.exports = router;
