const express = require("express");
const router = express.Router();
const controller = require("../controllers/subscriptionController");

router.post("/", controller.createSubscription);
router.get("/", controller.getSubscriptions);
router.get("/:subscriptionId", controller.getSubscriptionById);
router.put("/:subscriptionId/status", controller.updateSubscriptionStatus);

module.exports = router;