const db = require("../../db/db");

exports.createInvoice = (req, res) => {
  const { subscriptionId, customerId, items } = req.body;
  const invoiceNumber = "INV-" + Date.now();

  db.run(
    `INSERT INTO invoices (invoiceNumber, customerId, subscriptionId)
     VALUES (?, ?, ?)`,
    [invoiceNumber, customerId, subscriptionId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const invoiceId = this.lastID;
      let subtotal = 0;
      let totalTax = 0;

      const stmt = db.prepare(`
        INSERT INTO invoice_items
        (invoiceId, productName, quantity, unitPrice, amount)
        VALUES (?, ?, ?, ?, ?)
      `);

      items.forEach(item => {
        const amount = item.quantity * item.unitPrice;
        subtotal += amount;

        stmt.run(
          invoiceId,
          item.productName,
          item.quantity,
          item.unitPrice,
          amount,
          function () {
            const invoiceItemId = this.lastID;

            // 🔹 FETCH TAXES FOR THIS PRODUCT
            db.all(
              `SELECT t.*
               FROM taxes t
               JOIN product_taxes pt ON t.id = pt.taxId
               WHERE pt.productId = ? AND t.isActive = 1`,
              [item.productId],
              (err, taxes) => {
                if (err) return;

                taxes.forEach(tax => {
                  let taxAmount = 0;

                  if (tax.taxType === "PERCENTAGE") {
                    taxAmount = (amount * tax.rate) / 100;
                  } else {
                    taxAmount = tax.rate;
                  }

                  totalTax += taxAmount;

                  db.run(
                    `INSERT INTO invoice_item_taxes
                     (invoiceItemId, taxId, taxAmount)
                     VALUES (?, ?, ?)`,
                    [invoiceItemId, tax.id, taxAmount]
                  );
                });
              }
            );
          }
        );
      });

      stmt.finalize(() => {
        const total = subtotal + totalTax;

        db.run(
          `UPDATE invoices SET subtotal=?, tax=?, total=? WHERE id=?`,
          [subtotal, totalTax, total, invoiceId],
          () => {
            res.status(201).json({
              message: "Invoice created with product-based tax",
              invoiceId,
              invoiceNumber,
              subtotal,
              tax: totalTax,
              total
            });
          }
        );
      });
    }
  );
};


// GET ALL INVOICES
exports.getInvoices = (req, res) => {
  db.all(`SELECT * FROM invoices`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET INVOICE WITH ITEMS
exports.getInvoiceById = (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM invoices WHERE id=?`, [id], (err, invoice) => {
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    db.all(
      `SELECT * FROM invoice_items WHERE invoiceId=?`,
      [id],
      (err, items) => {
        res.json({ ...invoice, items });
      }
    );
  });
};

// CONFIRM INVOICE
exports.confirmInvoice = (req, res) => {
  db.run(
    `UPDATE invoices SET status='CONFIRMED' WHERE id=?`,
    [req.params.id],
    () => res.json({ message: "Invoice confirmed" })
  );
};

// MARK AS PAID
exports.markPaid = (req, res) => {
  db.run(
    `UPDATE invoices SET status='PAID' WHERE id=?`,
    [req.params.id],
    () => res.json({ message: "Invoice marked as paid" })
  );
};
