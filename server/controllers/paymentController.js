const db = require("../../db/db");

// Helper to generate payment number
const generatePaymentNumber = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM payments`, [], (err, row) => {
      if (err) reject(err);
      const count = (row?.count || 0) + 1;
      resolve(`PAY-${String(count).padStart(5, '0')}`);
    });
  });
};

// CREATE PAYMENT
exports.createPayment = async (req, res) => {
  try {
    const { invoiceId, customerId, amount, paymentMethod, reference, notes } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid payment amount is required" });
    }

    if (!customerId && !invoiceId) {
      return res.status(400).json({ error: "Either customer or invoice is required" });
    }

    const paymentNumber = await generatePaymentNumber();

    // If invoice is provided, get customer from invoice
    let finalCustomerId = customerId;
    if (invoiceId && !customerId) {
      const invoice = await new Promise((resolve, reject) => {
        db.get(`SELECT customerId, total, amountPaid FROM invoices WHERE id = ?`, [invoiceId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!invoice) {
        return res.status(400).json({ error: "Invoice not found" });
      }

      finalCustomerId = invoice.customerId;

      // Check if payment exceeds remaining amount
      const remaining = invoice.total - (invoice.amountPaid || 0);
      if (amount > remaining) {
        return res.status(400).json({ 
          error: `Payment amount exceeds remaining balance of ${remaining.toFixed(2)}` 
        });
      }
    }

    db.run(
      `INSERT INTO payments (paymentNumber, invoiceId, customerId, amount, paymentMethod, reference, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED')`,
      [paymentNumber, invoiceId || null, finalCustomerId, amount, paymentMethod || 'CASH', reference || null, notes || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const paymentId = this.lastID;

        // If linked to invoice, update invoice payment status
        if (invoiceId) {
          db.get(`SELECT total, amountPaid FROM invoices WHERE id = ?`, [invoiceId], (err, invoice) => {
            if (err || !invoice) {
              return res.status(201).json({
                message: "Payment recorded",
                paymentId,
                paymentNumber
              });
            }

            const newAmountPaid = (invoice.amountPaid || 0) + amount;
            let newStatus = 'PARTIALLY_PAID';
            let paidAt = null;

            if (newAmountPaid >= invoice.total) {
              newStatus = 'PAID';
              paidAt = new Date().toISOString();
            }

            db.run(
              `UPDATE invoices SET status = ?, amountPaid = ?, paidAt = ?, updatedAt = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [newStatus, newAmountPaid, paidAt, invoiceId],
              (err) => {
                res.status(201).json({
                  message: "Payment recorded",
                  paymentId,
                  paymentNumber,
                  invoiceStatus: newStatus,
                  invoiceAmountPaid: newAmountPaid,
                  invoiceRemaining: Math.max(0, invoice.total - newAmountPaid)
                });
              }
            );
          });
        } else {
          res.status(201).json({
            message: "Payment recorded",
            paymentId,
            paymentNumber
          });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL PAYMENTS
exports.getPayments = (req, res) => {
  const { customerId, invoiceId, status, startDate, endDate } = req.query;

  let query = `
    SELECT p.*,
      u.name as customerName,
      u.email as customerEmail,
      i.invoiceNumber,
      i.total as invoiceTotal
    FROM payments p
    LEFT JOIN users u ON p.customerId = u.id
    LEFT JOIN invoices i ON p.invoiceId = i.id
    WHERE 1=1
  `;
  let params = [];

  if (customerId) {
    query += ` AND p.customerId = ?`;
    params.push(customerId);
  }

  if (invoiceId) {
    query += ` AND p.invoiceId = ?`;
    params.push(invoiceId);
  }

  if (status) {
    query += ` AND p.status = ?`;
    params.push(status);
  }

  if (startDate) {
    query += ` AND DATE(p.paymentDate) >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND DATE(p.paymentDate) <= ?`;
    params.push(endDate);
  }

  query += ` ORDER BY p.paymentDate DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET PAYMENT BY ID
exports.getPaymentById = (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT p.*,
      u.name as customerName,
      u.email as customerEmail,
      u.phone as customerPhone,
      i.invoiceNumber,
      i.total as invoiceTotal,
      i.status as invoiceStatus
    FROM payments p
    LEFT JOIN users u ON p.customerId = u.id
    LEFT JOIN invoices i ON p.invoiceId = i.id
    WHERE p.id = ? OR p.paymentNumber = ?`,
    [id, id],
    (err, payment) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      res.json(payment);
    }
  );
};

// UPDATE PAYMENT
exports.updatePayment = (req, res) => {
  const { id } = req.params;
  const { paymentMethod, reference, notes, status } = req.body;

  db.run(
    `UPDATE payments SET paymentMethod = ?, reference = ?, notes = ?, status = ?
     WHERE id = ?`,
    [paymentMethod, reference || null, notes || null, status || 'COMPLETED', id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Payment not found" });
      res.json({ message: "Payment updated" });
    }
  );
};

// REFUND PAYMENT
exports.refundPayment = (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  db.get(`SELECT * FROM payments WHERE id = ?`, [id], (err, payment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.status === 'REFUNDED') {
      return res.status(400).json({ error: "Payment already refunded" });
    }

    db.run(
      `UPDATE payments SET status = 'REFUNDED', notes = COALESCE(notes, '') || ' | REFUNDED: ' || ?
       WHERE id = ?`,
      [reason || 'No reason provided', id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // If linked to invoice, update invoice
        if (payment.invoiceId) {
          db.run(
            `UPDATE invoices SET 
               amountPaid = amountPaid - ?,
               status = CASE 
                 WHEN amountPaid - ? <= 0 THEN 'SENT'
                 ELSE 'PARTIALLY_PAID'
               END,
               paidAt = NULL,
               updatedAt = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [payment.amount, payment.amount, payment.invoiceId],
            (err) => {
              if (err) console.error("Error updating invoice after refund:", err);
              res.json({ message: "Payment refunded" });
            }
          );
        } else {
          res.json({ message: "Payment refunded" });
        }
      }
    );
  });
};

// DELETE PAYMENT (only for pending payments)
exports.deletePayment = (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM payments WHERE id = ?`, [id], (err, payment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.status === 'COMPLETED') {
      return res.status(400).json({ error: "Cannot delete completed payments. Use refund instead." });
    }

    db.run(`DELETE FROM payments WHERE id = ?`, [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Payment deleted" });
    });
  });
};

// GET PAYMENT STATS
exports.getPaymentStats = (req, res) => {
  const { startDate, endDate } = req.query;

  let dateFilter = '';
  let params = [];

  if (startDate && endDate) {
    dateFilter = ` AND DATE(paymentDate) BETWEEN ? AND ?`;
    params = [startDate, endDate];
  } else if (startDate) {
    dateFilter = ` AND DATE(paymentDate) >= ?`;
    params = [startDate];
  } else if (endDate) {
    dateFilter = ` AND DATE(paymentDate) <= ?`;
    params = [endDate];
  }

  db.get(
    `SELECT 
      COUNT(*) as totalPayments,
      SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as totalReceived,
      SUM(CASE WHEN status = 'REFUNDED' THEN amount ELSE 0 END) as totalRefunded,
      SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END) as totalPending,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completedCount,
      COUNT(CASE WHEN status = 'REFUNDED' THEN 1 END) as refundedCount,
      COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pendingCount,
      AVG(CASE WHEN status = 'COMPLETED' THEN amount END) as averagePayment
     FROM payments
     WHERE 1=1 ${dateFilter}`,
    params,
    (err, stats) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(stats);
    }
  );
};

// GET PAYMENTS BY METHOD
exports.getPaymentsByMethod = (req, res) => {
  const { startDate, endDate } = req.query;

  let dateFilter = '';
  let params = [];

  if (startDate && endDate) {
    dateFilter = ` AND DATE(paymentDate) BETWEEN ? AND ?`;
    params = [startDate, endDate];
  }

  db.all(
    `SELECT 
      paymentMethod,
      COUNT(*) as count,
      SUM(amount) as total
     FROM payments
     WHERE status = 'COMPLETED' ${dateFilter}
     GROUP BY paymentMethod
     ORDER BY total DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// GET RECENT PAYMENTS
exports.getRecentPayments = (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  db.all(
    `SELECT p.*,
      u.name as customerName,
      i.invoiceNumber
     FROM payments p
     LEFT JOIN users u ON p.customerId = u.id
     LEFT JOIN invoices i ON p.invoiceId = i.id
     WHERE p.status = 'COMPLETED'
     ORDER BY p.paymentDate DESC
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};
