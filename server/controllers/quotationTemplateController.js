const db = require("../../db/db");

// ==========================================
// QUOTATION TEMPLATES
// ==========================================

// CREATE QUOTATION TEMPLATE (Admin)
exports.createTemplate = (req, res) => {
  const { templateName, description, items, isDefault } = req.body;

  if (!templateName) {
    return res.status(400).json({ error: "Template name is required" });
  }

  // If setting as default, unset other defaults first
  const setDefault = isDefault ? 1 : 0;
  
  const insertTemplate = () => {
    db.run(
      `INSERT INTO quotation_templates (templateName, description, isDefault, isActive)
       VALUES (?, ?, ?, 1)`,
      [templateName, description || null, setDefault],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const templateId = this.lastID;

        // Insert template items if provided
        if (items && items.length > 0) {
          const stmt = db.prepare(
            `INSERT INTO quotation_template_items 
             (templateId, productId, variantId, description, quantity, unitPrice, sortOrder)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          );

          items.forEach((item, index) => {
            stmt.run(
              templateId, 
              item.productId || null,
              item.variantId || null,
              item.description || null, 
              item.quantity || 1, 
              item.unitPrice || 0,
              item.sortOrder || index
            );
          });

          stmt.finalize();
        }

        res.status(201).json({
          message: "Quotation template created",
          templateId
        });
      }
    );
  };

  if (setDefault) {
    db.run(`UPDATE quotation_templates SET isDefault = 0`, [], () => {
      insertTemplate();
    });
  } else {
    insertTemplate();
  }
};

// GET ALL TEMPLATES
exports.getTemplates = (req, res) => {
  const { activeOnly } = req.query;
  
  let query = `SELECT * FROM quotation_templates`;
  if (activeOnly === 'true') {
    query += ` WHERE isActive = 1`;
  }
  query += ` ORDER BY isDefault DESC, templateName ASC`;

  db.all(query, [], (err, templates) => {
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
      if (err) return res.status(500).json({ error: err.message });
      if (!template) return res.status(404).json({ error: "Template not found" });

      db.all(
        `SELECT qti.*,
          p.productName,
          p.salesPrice as productPrice,
          pv.attribute as variantAttribute,
          pv.value as variantValue
         FROM quotation_template_items qti
         LEFT JOIN products p ON qti.productId = p.id
         LEFT JOIN product_variants pv ON qti.variantId = pv.id
         WHERE qti.templateId = ?
         ORDER BY qti.sortOrder ASC`,
        [id],
        (err, items) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ ...template, items });
        }
      );
    }
  );
};

// UPDATE TEMPLATE
exports.updateTemplate = (req, res) => {
  const { id } = req.params;
  const { templateName, description, items, isDefault, isActive } = req.body;

  const updateTemplate = () => {
    db.run(
      `UPDATE quotation_templates SET 
         templateName = ?, description = ?, isDefault = ?, isActive = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [templateName, description || null, isDefault ? 1 : 0, isActive !== false ? 1 : 0, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Template not found" });

        // Update items if provided
        if (items) {
          db.run(`DELETE FROM quotation_template_items WHERE templateId = ?`, [id], () => {
            if (items.length > 0) {
              const stmt = db.prepare(
                `INSERT INTO quotation_template_items 
                 (templateId, productId, variantId, description, quantity, unitPrice, sortOrder)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
              );

              items.forEach((item, index) => {
                stmt.run(
                  id, 
                  item.productId || null,
                  item.variantId || null,
                  item.description || null, 
                  item.quantity || 1, 
                  item.unitPrice || 0,
                  item.sortOrder || index
                );
              });

              stmt.finalize();
            }
            res.json({ message: "Template updated" });
          });
        } else {
          res.json({ message: "Template updated" });
        }
      }
    );
  };

  if (isDefault) {
    db.run(`UPDATE quotation_templates SET isDefault = 0 WHERE id != ?`, [id], () => {
      updateTemplate();
    });
  } else {
    updateTemplate();
  }
};

// DELETE TEMPLATE
exports.deleteTemplate = (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM quotation_templates WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Template not found" });
    res.json({ message: "Template deleted" });
  });
};

// ==========================================
// QUOTATIONS (actual quotes for customers)
// ==========================================

// Helper to generate quotation number
const generateQuotationNumber = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM quotations`, [], (err, row) => {
      if (err) reject(err);
      const count = (row?.count || 0) + 1;
      resolve(`Q-${String(count).padStart(5, '0')}`);
    });
  });
};

// CREATE QUOTATION
exports.createQuotation = async (req, res) => {
  try {
    const { subscriptionId, customerId, items, validUntil, notes, discountAmount } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "Customer is required" });
    }

    const quotationNumber = await generateQuotationNumber();

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    if (items && items.length > 0) {
      items.forEach(item => {
        subtotal += (item.unitPrice || 0) * (item.quantity || 1);
        totalTax += item.tax || 0;
      });
    }

    const discount = discountAmount || 0;
    const total = subtotal - discount + totalTax;

    db.run(
      `INSERT INTO quotations (quotationNumber, subscriptionId, customerId, subtotal, discountAmount, tax, total, validUntil, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
      [quotationNumber, subscriptionId || null, customerId, subtotal, discount, totalTax, total, validUntil || null, notes || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const quotationId = this.lastID;

        // Insert items
        if (items && items.length > 0) {
          const stmt = db.prepare(
            `INSERT INTO quotation_items (quotationId, productId, variantId, description, quantity, unitPrice, tax, amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          );

          items.forEach(item => {
            const amount = (item.unitPrice || 0) * (item.quantity || 1);
            stmt.run(
              quotationId,
              item.productId || null,
              item.variantId || null,
              item.description || null,
              item.quantity || 1,
              item.unitPrice || 0,
              item.tax || 0,
              amount
            );
          });

          stmt.finalize();
        }

        res.status(201).json({
          message: "Quotation created",
          quotationId,
          quotationNumber,
          subtotal,
          discountAmount: discount,
          tax: totalTax,
          total
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL QUOTATIONS
exports.getQuotations = (req, res) => {
  const { customerId, subscriptionId, status } = req.query;

  let query = `
    SELECT q.*,
      u.name as customerName,
      u.email as customerEmail,
      s.subscriptionNumber
    FROM quotations q
    LEFT JOIN users u ON q.customerId = u.id
    LEFT JOIN subscriptions s ON q.subscriptionId = s.id
    WHERE 1=1
  `;
  let params = [];

  if (customerId) {
    query += ` AND q.customerId = ?`;
    params.push(customerId);
  }

  if (subscriptionId) {
    query += ` AND q.subscriptionId = ?`;
    params.push(subscriptionId);
  }

  if (status) {
    query += ` AND q.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY q.createdAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET QUOTATION BY ID
exports.getQuotationById = (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT q.*,
      u.name as customerName,
      u.email as customerEmail,
      u.phone as customerPhone,
      s.subscriptionNumber
     FROM quotations q
     LEFT JOIN users u ON q.customerId = u.id
     LEFT JOIN subscriptions s ON q.subscriptionId = s.id
     WHERE q.id = ? OR q.quotationNumber = ?`,
    [id, id],
    (err, quotation) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!quotation) return res.status(404).json({ error: "Quotation not found" });

      db.all(
        `SELECT qi.*,
          p.productName,
          pv.attribute as variantAttribute,
          pv.value as variantValue
         FROM quotation_items qi
         LEFT JOIN products p ON qi.productId = p.id
         LEFT JOIN product_variants pv ON qi.variantId = pv.id
         WHERE qi.quotationId = ?`,
        [quotation.id],
        (err, items) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ ...quotation, items });
        }
      );
    }
  );
};

// SEND QUOTATION
exports.sendQuotation = (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE quotations SET status = 'SENT', sentAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Quotation not found" });
      res.json({ message: "Quotation sent" });
    }
  );
};

// ACCEPT QUOTATION
exports.acceptQuotation = (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE quotations SET status = 'ACCEPTED', respondedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Quotation not found" });

      // If linked to subscription, update subscription status
      db.get(`SELECT subscriptionId FROM quotations WHERE id = ?`, [id], (err, quotation) => {
        if (quotation?.subscriptionId) {
          db.run(
            `UPDATE subscriptions SET status = 'Confirmed', updatedAt = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [quotation.subscriptionId]
          );
        }
        res.json({ message: "Quotation accepted" });
      });
    }
  );
};

// REJECT QUOTATION
exports.rejectQuotation = (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  db.run(
    `UPDATE quotations SET 
       status = 'REJECTED', 
       respondedAt = CURRENT_TIMESTAMP, 
       notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL THEN ' | ' ELSE '' END || 'REJECTED: ' || ?,
       updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [reason || 'No reason provided', id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Quotation not found" });
      res.json({ message: "Quotation rejected" });
    }
  );
};

// DELETE QUOTATION
exports.deleteQuotation = (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM quotations WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Quotation not found" });
    res.json({ message: "Quotation deleted" });
  });
};

// CREATE QUOTATION FROM TEMPLATE
exports.createFromTemplate = async (req, res) => {
  try {
    const { templateId, customerId, subscriptionId, validUntil, notes } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: "Template ID is required" });
    }

    if (!customerId) {
      return res.status(400).json({ error: "Customer is required" });
    }

    // Get template and items
    db.get(`SELECT * FROM quotation_templates WHERE id = ?`, [templateId], (err, template) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!template) return res.status(404).json({ error: "Template not found" });

      db.all(
        `SELECT qti.*, p.productName, p.salesPrice
         FROM quotation_template_items qti
         LEFT JOIN products p ON qti.productId = p.id
         WHERE qti.templateId = ?`,
        [templateId],
        async (err, templateItems) => {
          if (err) return res.status(500).json({ error: err.message });

          // Create quotation with template items
          const items = templateItems.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            description: item.description || item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice || item.salesPrice || 0,
            tax: 0
          }));

          // Reuse createQuotation logic
          req.body = { customerId, subscriptionId, items, validUntil, notes };
          exports.createQuotation(req, res);
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
