const express = require("express");
const router = express.Router();
const controller = require("../controllers/quotationTemplateController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// ==========================================
// QUOTATION TEMPLATES
// ==========================================

// Create template
router.post("/templates", controller.createTemplate);

// Get all templates
router.get("/templates", controller.getTemplates);

// Get template by ID
router.get("/templates/:id", validateIdParam('id'), controller.getTemplateById);

// Update template
router.put("/templates/:id", validateIdParam('id'), controller.updateTemplate);

// Delete template
router.delete("/templates/:id", validateIdParam('id'), controller.deleteTemplate);

// ==========================================
// QUOTATIONS
// ==========================================

// Create quotation
router.post("/", controller.createQuotation);

// Create quotation from template
router.post("/from-template", controller.createFromTemplate);

// Get all quotations
router.get("/", controller.getQuotations);

// Get quotation by ID
router.get("/:id", validateIdParam('id'), controller.getQuotationById);

// Send quotation
router.post("/:id/send", validateIdParam('id'), controller.sendQuotation);

// Accept quotation
router.post("/:id/accept", validateIdParam('id'), controller.acceptQuotation);

// Reject quotation
router.post("/:id/reject", validateIdParam('id'), controller.rejectQuotation);

// Delete quotation
router.delete("/:id", validateIdParam('id'), controller.deleteQuotation);

// Legacy routes (backwards compatibility)
router.post("/legacy", controller.createTemplate);
router.get("/legacy", controller.getTemplates);
router.get("/legacy/:id", validateIdParam('id'), controller.getTemplateById);

module.exports = router;
