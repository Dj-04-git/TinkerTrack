const express = require("express");
const router = express.Router();
const controller = require("../controllers/quotationTemplateController");

router.post("/", controller.createTemplate);
router.get("/", controller.getTemplates);
router.get("/:id", controller.getTemplateById);

module.exports = router;
