const db = require("../db/db");

// CREATE QUOTATION TEMPLATE (Admin)
exports.createTemplate = (req, res) => {
  const { templateName, validityDays, planId, items } = req.body;

  db.run(
    `INSERT INTO quotation_templates (templateName, validityDays, planId)
     VALUES (?, ?, ?)`,
    [templateName, validityDays, planId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const templateId = this.lastID;

      // insert template items
      const stmt = db.prepare(
        `INSERT INTO quotation_template_items 
         (templateId, productId, quantity, unitPrice)
         VALUES (?, ?, ?, ?)`
      );

      items.forEach(item => {
        stmt.run(templateId, item.productId, item.quantity, item.unitPrice);
      });

      stmt.finalize();

      res.status(201).json({
        message: "Quotation template created",
        templateId
      });
    }
  );
};

// GET ALL TEMPLATES
exports.getTemplates = (req, res) => {
  db.all(`SELECT * FROM quotation_templates`, [], (err, templates) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(templates);
  });
};

// GET TEMPLATE WITH ITEMS
exports.getTemplateById = (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT * FROM quotation_templates WHERE id = ?`,
    [id],
    (err, template) => {
      if (!template) return res.status(404).json({ error: "Template not found" });

      db.all(
        `SELECT * FROM quotation_template_items WHERE templateId = ?`,
        [id],
        (err, items) => {
          res.json({ ...template, items });
        }
      );
    }
  );
};
