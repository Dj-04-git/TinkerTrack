const express = require("express");
const router = express.Router();
const controller = require("../controllers/discountController");

// Admin only
router.post("/", controller.createDiscount);
router.get("/", controller.getDiscounts);

module.exports = router;
