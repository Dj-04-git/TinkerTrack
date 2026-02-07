const db = require("../../db/db");
const { v4: uuidv4 } = require("uuid");

// CREATE SUBSCRIPTION (Draft)
exports.createSubscription = (req, res) => {
  const {
    customerName,
    planId,
    startDate,
    endDate,
    paymentTerms,
    items
  } = req.body;

  const subscriptionNumber = "SUB-" + Date.now();

  db.run(
    `INSERT INTO subscriptions 
     (subscriptionNumber, customerName, planId, startDate, endDate, paymentTerms, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Draft')`,
    [
      subscriptionNumber,
      customerName,
      planId,
      startDate,
      endDate,
      paymentTerms
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
        message: "Subscription created (Draft)",
        subscriptionNumber
      });
    }
  );
};

// UPDATE STATUS
exports.updateSubscriptionStatus = (req, res) => {
  const { subscriptionId } = req.params;
  const { status } = req.body;

  const allowed = ["Draft", "Quotation", "Confirmed", "Active", "Closed"];
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

// GET SUBSCRIPTIONS
exports.getSubscriptions = (req, res) => {
  db.all(`SELECT * FROM subscriptions`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

