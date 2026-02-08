const express = require("express");
const router = express.Router();
const controller = require("../controllers/reportingController");

// Get all reporting data (combined endpoint)
router.get("/", controller.getReportingData);

// Get dashboard KPIs
router.get("/kpis", controller.getDashboardKPIs);

// Get revenue by month
router.get("/revenue-by-month", controller.getRevenueByMonth);

// Get subscriptions by plan
router.get("/subscriptions-by-plan", controller.getSubscriptionsByPlan);

// Get payments by status
router.get("/payments-by-status", controller.getPaymentsByStatus);

// Get recent payments
router.get("/recent-payments", controller.getRecentPayments);

// Get overdue invoices
router.get("/overdue-invoices", controller.getOverdueInvoices);

module.exports = router;
