const db = require("../../db/db");

// CREATE SUBSCRIPTION (Draft)
exports.createSubscription = (req, res) => {
  const {
    customerId,
    planId,
    startDate,
    endDate,
    paymentTerms,
    items,
    discountId,
    discountAmount,
    notes
  } = req.body;

  // Validate customerId exists
  if (!customerId) {
    return res.status(400).json({ error: "Customer is required" });
  }

  // Verify customer exists
  db.get(`SELECT id FROM users WHERE id = ?`, [customerId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: "Customer not found" });

    // Generate subscription number like S-0001
    db.get(`SELECT COUNT(*) as count FROM subscriptions`, [], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      const count = (row?.count || 0) + 1;
      const subscriptionNumber = `S-${String(count).padStart(4, '0')}`;

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
        `INSERT INTO subscriptions 
         (subscriptionNumber, customerId, planId, startDate, endDate, paymentTerms, discountId, discountAmount, subtotal, tax, total, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`,
        [
          subscriptionNumber,
          customerId,
          planId || null,
          startDate,
          endDate,
          paymentTerms,
          discountId || null,
          discount,
          subtotal,
          totalTax,
          total,
          notes || null
        ],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          const subscriptionId = this.lastID;

          if (items && items.length > 0) {
            const stmt = db.prepare(`
              INSERT INTO subscription_items
              (subscriptionId, productId, variantId, description, quantity, unitPrice, tax, amount)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            items.forEach(item => {
              const amount = (item.unitPrice || 0) * (item.quantity || 1);
              stmt.run(
                subscriptionId,
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
            message: "Subscription created",
            subscriptionId,
            subscriptionNumber,
            subtotal,
            tax: totalTax,
            discountAmount: discount,
            total
          });
        }
      );
    });
  });
};

// UPDATE SUBSCRIPTION
exports.updateSubscription = (req, res) => {
  const { subscriptionId } = req.params;
  const {
    customerId,
    planId,
    startDate,
    endDate,
    paymentTerms,
    items,
    discountId,
    discountAmount,
    notes,
    status
  } = req.body;

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
    `UPDATE subscriptions SET 
       customerId = ?, planId = ?, startDate = ?, endDate = ?, paymentTerms = ?,
       discountId = ?, discountAmount = ?, subtotal = ?, tax = ?, total = ?,
       notes = ?, status = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      customerId,
      planId || null,
      startDate,
      endDate,
      paymentTerms,
      discountId || null,
      discount,
      subtotal,
      totalTax,
      total,
      notes || null,
      status || 'Draft',
      subscriptionId
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // Delete existing items and re-insert
      db.run(`DELETE FROM subscription_items WHERE subscriptionId = ?`, [subscriptionId], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        if (items && items.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO subscription_items
            (subscriptionId, productId, variantId, description, quantity, unitPrice, tax, amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

          items.forEach(item => {
            const amount = (item.unitPrice || 0) * (item.quantity || 1);
            stmt.run(
              subscriptionId,
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

        res.json({
          message: "Subscription updated",
          subscriptionId: parseInt(subscriptionId),
          subtotal,
          tax: totalTax,
          discountAmount: discount,
          total
        });
      });
    }
  );
};

// UPDATE STATUS
exports.updateSubscriptionStatus = (req, res) => {
  const { subscriptionId } = req.params;
  const { status } = req.body;

  const allowed = ["Draft", "Quotation", "Quotation Sent", "Confirmed", "Active", "Cancelled", "Closed", "Expired"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
  }

  db.run(
    `UPDATE subscriptions SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, subscriptionId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Subscription not found" });

      res.json({ message: `Subscription status updated to ${status}` });
    }
  );
};

// GET SUBSCRIPTIONS with customer name and product names
exports.getSubscriptions = (req, res) => {
  const { customerId, status } = req.query;
  
  let query = `
    SELECT s.*, 
      u.name as customerName,
      u.email as customerEmail,
      (SELECT GROUP_CONCAT(p.productName, ', ') 
       FROM subscription_items si 
       LEFT JOIN products p ON si.productId = p.id 
       WHERE si.subscriptionId = s.id) as productNames,
      rp.planName,
      rp.billingPeriod
    FROM subscriptions s
    LEFT JOIN users u ON s.customerId = u.id
    LEFT JOIN recurring_plans rp ON s.planId = rp.id
    WHERE 1=1
  `;
  let params = [];
  
  if (customerId) {
    query += ` AND s.customerId = ?`;
    params.push(customerId);
  }
  
  if (status) {
    query += ` AND s.status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY s.createdAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET SUBSCRIPTION BY ID with items and customer details
exports.getSubscriptionById = (req, res) => {
  const { subscriptionId } = req.params;

  db.get(
    `SELECT s.*, 
      u.name as customerName,
      u.email as customerEmail,
      u.phone as customerPhone,
      rp.planName,
      rp.billingPeriod,
      rp.price as planPrice
     FROM subscriptions s
     LEFT JOIN users u ON s.customerId = u.id
     LEFT JOIN recurring_plans rp ON s.planId = rp.id
     WHERE s.id = ? OR s.subscriptionNumber = ?`,
    [subscriptionId, subscriptionId],
    (err, subscription) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!subscription) return res.status(404).json({ error: "Subscription not found" });

      db.all(
        `SELECT si.*, 
          p.productName,
          p.productType,
          pv.attribute as variantAttribute,
          pv.value as variantValue
         FROM subscription_items si 
         LEFT JOIN products p ON si.productId = p.id 
         LEFT JOIN product_variants pv ON si.variantId = pv.id
         WHERE si.subscriptionId = ?`,
        [subscription.id],
        (err, items) => {
          if (err) return res.status(500).json({ error: err.message });

          res.json({
            ...subscription,
            items
          });
        }
      );
    }
  );
};

// DELETE SUBSCRIPTION (with cascade - items auto-deleted)
exports.deleteSubscription = (req, res) => {
  const { subscriptionId } = req.params;

  db.run(
    `DELETE FROM subscriptions WHERE id = ?`,
    [subscriptionId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Subscription not found" });

      res.json({ message: "Subscription deleted" });
    }
  );
};

// GET SUBSCRIPTION COUNT
exports.getSubscriptionCount = (req, res) => {
  const { status, customerId } = req.query;
  
  let query = `SELECT COUNT(*) as count FROM subscriptions WHERE 1=1`;
  let params = [];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  if (customerId) {
    query += ` AND customerId = ?`;
    params.push(customerId);
  }

  db.get(query, params, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: row?.count || 0 });
  });
};

// GET ALL CUSTOMERS (for dropdown)
exports.getCustomers = (req, res) => {
  db.all(
    `SELECT id, name, email, phone FROM users WHERE isVerified = 1 ORDER BY name`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

