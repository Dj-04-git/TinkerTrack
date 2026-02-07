const express = require("express");
const router = express.Router();
const controller = require("../controllers/recurringPlanController");

router.post("/", controller.createPlan);
router.get("/", controller.getPlans);
router.post("/assign/:productId", controller.assignPlanToProduct);

module.exports = router;
