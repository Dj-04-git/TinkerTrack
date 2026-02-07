const express = require("express");
const router = express.Router();
const controller = require("../controllers/productTaxController");

// Admin only
router.post("/assign", controller.assignTaxToProduct);

module.exports = router;
