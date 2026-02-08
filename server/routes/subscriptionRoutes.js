const express = require("express");
const router = express.Router();
const controller = require("../controllers/subscriptionController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// Create subscription
router.post("/", controller.createSubscription);

// Get all subscriptions (with filters)
router.get("/", controller.getSubscriptions);

// Get subscription count
router.get("/count", controller.getSubscriptionCount);

// Get customers list (for dropdown)
router.get("/customers", controller.getCustomers);

// Get subscription by ID
router.get("/:subscriptionId", validateIdParam('subscriptionId'), controller.getSubscriptionById);

// Update subscription
router.put("/:subscriptionId", validateIdParam('subscriptionId'), controller.updateSubscription);

// Update subscription status
router.put("/:subscriptionId/status", validateIdParam('subscriptionId'), controller.updateSubscriptionStatus);

// Delete subscription
router.delete("/:subscriptionId", validateIdParam('subscriptionId'), controller.deleteSubscription);

module.exports = router;