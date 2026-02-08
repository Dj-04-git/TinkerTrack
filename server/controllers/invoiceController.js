const db = require("../../db/db");

// Helper to generate invoice number
const generateInvoiceNumber = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM invoices`, [], (err, row) => {
      if (err) reject(err);
      const count = (row?.count || 0) + 1;
      resolve(`INV-${String(count).padStart(5, '0')}`);
    });
  });
};

// CREATE INVOICE
exports.createInvoice = async (req, res) => {
  try {
    const { subscriptionId, customerId, items, dueDate, notes, discountAmount } = req.body;
    const invoiceNumber = await generateInvoiceNumber();

    // Validate customer exists
    if (!customerId) {
      return res.status(400).json({ error: "Customer is required" });
    }

    db.run(
      `INSERT INTO invoices (invoiceNumber, customerId, subscriptionId, dueDate, notes, discountAmount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT')`,
      [invoiceNumber, customerId, subscriptionId || null, dueDate || null, notes || null, discountAmount || 0],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const invoiceId = this.lastID;
        let subtotal = 0;
        let totalTax = 0;
        let itemsProcessed = 0;

        if (!items || items.length === 0) {
          return res.status(201).json({
            message: "Invoice created",
            invoiceId,
            invoiceNumber,
            subtotal: 0,
            tax: 0,
            total: 0
          });
        }

        const stmt = db.prepare(`
          INSERT INTO invoice_items
          (invoiceId, productId, variantId, description, quantity, unitPrice, tax, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        items.forEach(item => {
          const amount = (item.quantity || 1) * (item.unitPrice || 0);
          const itemTax = item.tax || 0;
          subtotal += amount;
          totalTax += itemTax;

          stmt.run(
            invoiceId,
            item.productId || null,
            item.variantId || null,
            item.description || item.productName || null,
            item.quantity || 1,
            item.unitPrice || 0,
            itemTax,
            amount,
            function (err) {
              if (err) {
                console.error("Error inserting invoice item:", err);
                return;
              }

              const invoiceItemId = this.lastID;

              // Fetch and apply taxes for this product if productId exists
              if (item.productId) {
                db.all(
                  `SELECT t.*
                   FROM taxes t
                   JOIN product_taxes pt ON t.id = pt.taxId
                   WHERE pt.productId = ? AND t.isActive = 1`,
                  [item.productId],
                  (err, taxes) => {
                    if (err || !taxes) return;

                    taxes.forEach(tax => {
                      let taxAmount = 0;
                      if (tax.taxType === "PERCENTAGE") {
                        taxAmount = (amount * tax.rate) / 100;
                      } else {
                        taxAmount = tax.rate;
                      }

                      db.run(
                        `INSERT INTO invoice_item_taxes (invoiceItemId, taxId, taxAmount)
                         VALUES (?, ?, ?)`,
                        [invoiceItemId, tax.id, taxAmount]
                      );
                    });
                  }
                );
              }

              itemsProcessed++;
              if (itemsProcessed === items.length) {
                finalizeInvoice();
              }
            }
          );
        });

        stmt.finalize();

        function finalizeInvoice() {
          const discount = discountAmount || 0;
          const total = subtotal - discount + totalTax;

          db.run(
            `UPDATE invoices SET subtotal=?, discountAmount=?, tax=?, total=? WHERE id=?`,
            [subtotal, discount, totalTax, total, invoiceId],
            () => {
              res.status(201).json({
                message: "Invoice created",
                invoiceId,
                invoiceNumber,
                subtotal,
                discountAmount: discount,
                tax: totalTax,
                total
              });
            }
          );
        }

        // Fallback if no items with callbacks
        if (items.length === 0) {
          finalizeInvoice();
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL INVOICES with customer info
exports.getInvoices = (req, res) => {
  const { customerId, status, subscriptionId } = req.query;
  
  let query = `
    SELECT i.*, 
      u.name as customerName,
      u.email as customerEmail,
      s.subscriptionNumber
    FROM invoices i
    LEFT JOIN users u ON i.customerId = u.id
    LEFT JOIN subscriptions s ON i.subscriptionId = s.id
    WHERE 1=1
  `;
  let params = [];
  
  if (customerId) {
    query += ` AND i.customerId = ?`;
    params.push(customerId);
  }
  
  if (status) {
    query += ` AND i.status = ?`;
    params.push(status);
  }
  
  if (subscriptionId) {
    query += ` AND i.subscriptionId = ?`;
    params.push(subscriptionId);
  }
  
  query += ` ORDER BY i.createdAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET INVOICE WITH ITEMS
exports.getInvoiceById = (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT i.*, 
      u.name as customerName,
      u.email as customerEmail,
      u.phone as customerPhone,
      u.location as customerLocation,
      s.subscriptionNumber
     FROM invoices i
     LEFT JOIN users u ON i.customerId = u.id
     LEFT JOIN subscriptions s ON i.subscriptionId = s.id
     WHERE i.id = ? OR i.invoiceNumber = ?`,
    [id, id],
    (err, invoice) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      db.all(
        `SELECT ii.*, 
          p.productName,
          p.productType,
          pv.attribute as variantAttribute,
          pv.value as variantValue
         FROM invoice_items ii
         LEFT JOIN products p ON ii.productId = p.id
         LEFT JOIN product_variants pv ON ii.variantId = pv.id
         WHERE ii.invoiceId = ?`,
        [invoice.id],
        (err, items) => {
          if (err) return res.status(500).json({ error: err.message });

          // Get payments for this invoice
          db.all(
            `SELECT * FROM payments WHERE invoiceId = ? ORDER BY paymentDate DESC`,
            [invoice.id],
            (err, payments) => {
              res.json({ ...invoice, items, payments: payments || [] });
            }
          );
        }
      );
    }
  );
};

// UPDATE INVOICE
exports.updateInvoice = (req, res) => {
  const { id } = req.params;
  const { customerId, subscriptionId, dueDate, notes, status } = req.body;

  db.run(
    `UPDATE invoices SET 
       customerId = ?, subscriptionId = ?, dueDate = ?, notes = ?, status = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [customerId, subscriptionId || null, dueDate || null, notes || null, status, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Invoice not found" });

      res.json({ message: "Invoice updated" });
    }
  );
};

// SEND INVOICE
exports.sendInvoice = (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE invoices SET status = 'SENT', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Invoice not found" });

      res.json({ message: "Invoice sent" });
    }
  );
};

// MARK AS PAID (full payment)
exports.markPaid = (req, res) => {
  const { id } = req.params;
  const { paymentMethod, reference, notes } = req.body;

  db.get(`SELECT total, amountPaid FROM invoices WHERE id = ?`, [id], (err, invoice) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const remainingAmount = invoice.total - (invoice.amountPaid || 0);

    // Record payment
    db.get(`SELECT COUNT(*) as count FROM payments`, [], (err, row) => {
      const paymentNumber = `PAY-${String((row?.count || 0) + 1).padStart(5, '0')}`;

      db.run(
        `INSERT INTO payments (paymentNumber, invoiceId, customerId, amount, paymentMethod, reference, notes)
         SELECT ?, ?, customerId, ?, ?, ?, ? FROM invoices WHERE id = ?`,
        [paymentNumber, id, remainingAmount, paymentMethod || 'CASH', reference || null, notes || null, id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          // Update invoice
          db.run(
            `UPDATE invoices SET status = 'PAID', amountPaid = total, paidAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [id],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ message: "Invoice marked as paid", paymentNumber });
            }
          );
        }
      );
    });
  });
};

// RECORD PARTIAL PAYMENT
exports.recordPayment = (req, res) => {
  const { id } = req.params;
  const { amount, paymentMethod, reference, notes } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Valid payment amount is required" });
  }

  db.get(`SELECT total, amountPaid, customerId FROM invoices WHERE id = ?`, [id], (err, invoice) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const currentPaid = invoice.amountPaid || 0;
    const newAmountPaid = currentPaid + amount;
    const remaining = invoice.total - newAmountPaid;

    if (amount > remaining + currentPaid) {
      return res.status(400).json({ error: "Payment amount exceeds invoice total" });
    }

    // Generate payment number
    db.get(`SELECT COUNT(*) as count FROM payments`, [], (err, row) => {
      const paymentNumber = `PAY-${String((row?.count || 0) + 1).padStart(5, '0')}`;

      db.run(
        `INSERT INTO payments (paymentNumber, invoiceId, customerId, amount, paymentMethod, reference, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [paymentNumber, id, invoice.customerId, amount, paymentMethod || 'CASH', reference || null, notes || null],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          // Determine new status
          let newStatus = 'PARTIALLY_PAID';
          let paidAt = null;
          if (newAmountPaid >= invoice.total) {
            newStatus = 'PAID';
            paidAt = new Date().toISOString();
          }

          db.run(
            `UPDATE invoices SET status = ?, amountPaid = ?, paidAt = ?, updatedAt = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newStatus, newAmountPaid, paidAt, id],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({
                message: "Payment recorded",
                paymentNumber,
                amountPaid: newAmountPaid,
                remaining: Math.max(0, invoice.total - newAmountPaid),
                status: newStatus
              });
            }
          );
        }
      );
    });
  });
};

// CANCEL INVOICE
exports.cancelInvoice = (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE invoices SET status = 'CANCELLED', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Invoice not found" });

      res.json({ message: "Invoice cancelled" });
    }
  );
};

// GET OVERDUE INVOICES
exports.getOverdueInvoices = (req, res) => {
  db.all(
    `SELECT i.*, 
      u.name as customerName,
      u.email as customerEmail,
      julianday('now') - julianday(i.dueDate) as daysOverdue
     FROM invoices i
     LEFT JOIN users u ON i.customerId = u.id
     WHERE i.status NOT IN ('PAID', 'CANCELLED') 
       AND i.dueDate IS NOT NULL 
       AND i.dueDate < date('now')
     ORDER BY i.dueDate ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// GET INVOICE COUNT BY USER
exports.getInvoiceCountByUser = (req, res) => {
  const { userId } = req.params;
  
  db.get(
    `SELECT COUNT(*) as count FROM invoices WHERE customerId = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ count: row?.count || 0 });
    }
  );
};

// GET TOTAL INVOICE COUNT
exports.getInvoiceCount = (req, res) => {
  const { status } = req.query;
  
  let query = `SELECT COUNT(*) as count FROM invoices`;
  let params = [];
  
  if (status) {
    query += ` WHERE status = ?`;
    params.push(status);
  }

  db.get(query, params, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: row?.count || 0 });
  });
};

// GET INVOICE STATS (for reporting)
exports.getInvoiceStats = (req, res) => {
  db.get(
    `SELECT 
      COUNT(*) as totalInvoices,
      SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paidCount,
      SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sentCount,
      SUM(CASE WHEN status = 'OVERDUE' OR (status NOT IN ('PAID', 'CANCELLED') AND dueDate < date('now')) THEN 1 ELSE 0 END) as overdueCount,
      SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draftCount,
      SUM(total) as totalAmount,
      SUM(amountPaid) as totalPaid,
      SUM(total - COALESCE(amountPaid, 0)) as totalOutstanding
     FROM invoices
     WHERE status != 'CANCELLED'`,
    [],
    (err, stats) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(stats);
    }
  );
};
