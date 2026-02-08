const express = require("express");
const router = express.Router();
const controller = require("../controllers/cartController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// Add to cart
router.post("/", controller.addToCart);

// Get cart items
router.get("/", controller.getCart);

// Get cart count
router.get("/count", controller.getCartCount);

// Update cart item quantity
router.put("/:itemId", validateIdParam('itemId'), controller.updateCartItem);

// Delete cart item
router.delete("/:itemId", validateIdParam('itemId'), controller.deleteCartItem);

// Clear entire cart (uses query param userId)
router.delete("/", controller.clearCart);

module.exports = router;
