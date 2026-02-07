const express = require("express");
const router = express.Router();
const controller = require("../controllers/invoiceController");

router.post("/", controller.createInvoice);        // auto-create
router.get("/", controller.getInvoices);           // list
router.get("/:id", controller.getInvoiceById);     // view
router.post("/:id/confirm", controller.confirmInvoice);
router.post("/:id/pay", controller.markPaid);

module.exports = router;
