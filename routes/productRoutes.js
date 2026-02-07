const express = require("express");
const router = express.Router();
const controller = require("../controllers/productController");

router.post("/", controller.createProduct);
router.get("/", controller.getProducts);

module.exports = router;
