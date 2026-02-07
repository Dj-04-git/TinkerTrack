const express = require("express");
const router = express.Router();
const controller = require("../controllers/discountController");

// Admin only
router.post("/", controller.createDiscount);
router.get("/", controller.getDiscounts);

// Validate discount code
router.post("/validate", controller.validateDiscount);

// Use discount (increment used count)
router.post("/use/:discountId", controller.useDiscount);

module.exports = router;
