const db = require("../../db/db");
const { v4: uuidv4 } = require("uuid");

// CREATE SUBSCRIPTION (Draft)
exports.createSubscription = (req, res) => {
  const {
    userId,
    customerName,
    planId,
    startDate,
    endDate,
    paymentTerms,
    items,
    discountCode,
    discountAmount
  } = req.body;

  // Generate subscription number like S-0001
  db.get(`SELECT COUNT(*) as count FROM subscriptions`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    const count = (row?.count || 0) + 1;
    const subscriptionNumber = `S-${String(count).padStart(4, '0')}`;

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    items.forEach(item => {
      subtotal += item.unitPrice * item.quantity;
      totalTax += item.tax || 0;
    });

    const discount = discountAmount || 0;
    const total = subtotal - discount + totalTax;

    db.run(
      `INSERT INTO subscriptions 
       (subscriptionNumber, userId, customerName, planId, startDate, endDate, paymentTerms, discountCode, discountAmount, subtotal, tax, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid')`,
      [
        subscriptionNumber,
        userId || 1,
        customerName,
        planId,
        startDate,
        endDate,
        paymentTerms,
        discountCode || null,
        discount,
        subtotal,
        totalTax,
        total
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const subscriptionId = this.lastID;

        const stmt = db.prepare(`
          INSERT INTO subscription_items
          (subscriptionId, productId, quantity, unitPrice, tax, amount)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        items.forEach(item => {
          stmt.run(
            subscriptionId,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.tax,
            item.amount
          );
        });

        stmt.finalize();

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
};

// UPDATE STATUS
exports.updateSubscriptionStatus = (req, res) => {
  const { subscriptionId } = req.params;
  const { status } = req.body;

  const allowed = ["Draft", "Quotation", "Confirmed", "Active", "Closed", "Paid", "Pending"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  db.run(
    `UPDATE subscriptions SET status = ? WHERE id = ?`,
    [status, subscriptionId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ message: `Subscription moved to ${status}` });
    }
  );
};

// GET SUBSCRIPTIONS with first product name
exports.getSubscriptions = (req, res) => {
  const { userId } = req.query;
  
  let query = `
    SELECT s.*, 
      (SELECT GROUP_CONCAT(p.productName, ', ') 
       FROM subscription_items si 
       LEFT JOIN products p ON si.productId = p.id 
       WHERE si.subscriptionId = s.id) as productNames
    FROM subscriptions s
  `;
  let params = [];
  
  if (userId) {
    query += ` WHERE s.userId = ?`;
    params.push(userId);
  }
  
  query += ` ORDER BY s.createdAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET SUBSCRIPTION BY ID with items
exports.getSubscriptionById = (req, res) => {
  const { subscriptionId } = req.params;

  db.get(`SELECT * FROM subscriptions WHERE id = ? OR subscriptionNumber = ?`, [subscriptionId, subscriptionId], (err, subscription) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!subscription) return res.status(404).json({ error: "Subscription not found" });

    db.all(
      `SELECT si.*, p.productName 
       FROM subscription_items si 
       LEFT JOIN products p ON si.productId = p.id 
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
  });
};

