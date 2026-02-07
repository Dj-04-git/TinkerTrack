const express = require("express");
const router = express.Router();
const controller = require("../controllers/productController");

router.post("/", controller.createProduct);
router.get("/", controller.getProducts);
router.get("/:productId", controller.getProductById);
router.get("/:productId/plans", controller.getProductPlans);

module.exports = router;
