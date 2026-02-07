const express = require("express");
const router = express.Router();
const controller = require("../controllers/cartController");

router.post("/", controller.addToCart);
router.get("/", controller.getCart);
router.delete("/:itemId", controller.deleteCartItem);
router.put("/:itemId", controller.updateCartItem);
router.delete("/", controller.clearCart);

module.exports = router;
