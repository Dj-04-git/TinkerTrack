const express = require("express");
const router = express.Router();
const controller = require("../controllers/recurringPlanController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// Create plan
router.post("/", controller.createPlan);

// Get all plans
router.get("/", controller.getPlans);

// Get plan by ID
router.get("/:planId", validateIdParam('planId'), controller.getPlanById);

// Update plan
router.put("/:planId", validateIdParam('planId'), controller.updatePlan);

// Delete plan
router.delete("/:planId", validateIdParam('planId'), controller.deletePlan);

// Assign plan to product
router.post("/assign/:productId", validateIdParam('productId'), controller.assignPlanToProduct);

// Remove plan from product
router.delete("/assign/:productId/:planId", 
  validateIdParam('productId'), 
  validateIdParam('planId'), 
  controller.removePlanFromProduct
);

// Get products for plan
router.get("/:planId/products", validateIdParam('planId'), controller.getProductsForPlan);

module.exports = router;
