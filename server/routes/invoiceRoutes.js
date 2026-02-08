const express = require("express");
const router = express.Router();
const controller = require("../controllers/invoiceController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// Create invoice
router.post("/", controller.createInvoice);

// Get all invoices (with filters)
router.get("/", controller.getInvoices);

// Get invoice stats
router.get("/stats", controller.getInvoiceStats);

// Get overdue invoices
router.get("/overdue", controller.getOverdueInvoices);

// Get total invoice count
router.get("/count", controller.getInvoiceCount);

// Get count by user
router.get("/count/:userId", validateIdParam('userId'), controller.getInvoiceCountByUser);

// Get invoice by ID
router.get("/:id", validateIdParam('id'), controller.getInvoiceById);

// Update invoice
router.put("/:id", validateIdParam('id'), controller.updateInvoice);

// Send invoice
router.post("/:id/send", validateIdParam('id'), controller.sendInvoice);

// Mark as paid (full payment)
router.post("/:id/pay", validateIdParam('id'), controller.markPaid);

// Record partial payment
router.post("/:id/payment", validateIdParam('id'), controller.recordPayment);

// Cancel invoice
router.post("/:id/cancel", validateIdParam('id'), controller.cancelInvoice);

module.exports = router;
