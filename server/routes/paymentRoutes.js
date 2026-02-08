const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// Create payment
router.post("/", paymentController.createPayment);

// Get all payments (with filters)
router.get("/", paymentController.getPayments);

// Get payment stats
router.get("/stats", paymentController.getPaymentStats);

// Get payments by method
router.get("/by-method", paymentController.getPaymentsByMethod);

// Get recent payments
router.get("/recent", paymentController.getRecentPayments);

// Get payment by ID
router.get("/:id", validateIdParam('id'), paymentController.getPaymentById);

// Update payment
router.put("/:id", validateIdParam('id'), paymentController.updatePayment);

// Refund payment
router.post("/:id/refund", validateIdParam('id'), paymentController.refundPayment);

// Delete payment (only pending)
router.delete("/:id", validateIdParam('id'), paymentController.deletePayment);

module.exports = router;
