const express = require("express");
const router = express.Router();
const controller = require("../controllers/discountController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// Create discount (Admin)
router.post("/", controller.createDiscount);

// Get all discounts
router.get("/", controller.getDiscounts);

// Get active discounts (for frontend)
router.get("/active", controller.getActiveDiscounts);

// Validate discount code
router.post("/validate", controller.validateDiscount);

// Get discount by ID
router.get("/:discountId", validateIdParam('discountId'), controller.getDiscountById);

// Update discount
router.put("/:discountId", validateIdParam('discountId'), controller.updateDiscount);

// Delete discount
router.delete("/:discountId", validateIdParam('discountId'), controller.deleteDiscount);

// Use discount (increment used count)
router.post("/use/:discountId", validateIdParam('discountId'), controller.useDiscount);

module.exports = router;
