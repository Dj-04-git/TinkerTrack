const db = require("../db/db");

// CREATE PLAN
exports.createPlan = (req, res) => {
  const { planName, price, billingPeriod } = req.body;

  db.run(
    `INSERT INTO recurring_plans (planName, price, billingPeriod)
     VALUES (?, ?, ?)`,
    [planName, price, billingPeriod],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
};

// GET PLANS
exports.getPlans = (req, res) => {
  db.all(`SELECT * FROM recurring_plans`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// ASSIGN PLAN TO PRODUCT
exports.assignPlanToProduct = (req, res) => {
  const { productId } = req.params;
  const { planId } = req.body;

  db.run(
    `INSERT OR IGNORE INTO product_plans (productId, planId)
     VALUES (?, ?)`,
    [productId, planId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Plan assigned to product" });
    }
  );
};
