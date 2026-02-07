const express = require("express");
const router = express.Router();
const controller = require("../controllers/productVariantController");

router.post("/:productId/variants", controller.createVariant);
router.get("/:productId/variants", controller.getVariantsByProductId);

module.exports = router;
