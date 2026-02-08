const db = require("../../db/db");

const VALID_BILLING_PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

// CREATE PLAN
exports.createPlan = (req, res) => {
  const { planName, price, billingPeriod } = req.body;

  // Validate required fields
  if (!planName || !planName.trim()) {
    return res.status(400).json({ error: "Plan name is required" });
  }
  
  if (price === undefined || price === null || isNaN(parseFloat(price))) {
    return res.status(400).json({ error: "Valid price is required" });
  }
  
  if (parseFloat(price) < 0) {
    return res.status(400).json({ error: "Price cannot be negative" });
  }
  
  if (!billingPeriod) {
    return res.status(400).json({ error: "Billing period is required" });
  }
  
  if (!VALID_BILLING_PERIODS.includes(billingPeriod)) {
    return res.status(400).json({ 
      error: `Invalid billing period. Allowed values: ${VALID_BILLING_PERIODS.join(', ')}` 
    });
  }

  // Check for duplicate plan name
  db.get(`SELECT id FROM recurring_plans WHERE planName = ?`, [planName.trim()], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) {
      return res.status(409).json({ error: "Plan with this name already exists" });
    }

    db.run(
      `INSERT INTO recurring_plans (planName, price, billingPeriod)
       VALUES (?, ?, ?)`,
      [planName.trim(), parseFloat(price), billingPeriod],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ 
          message: "Plan created",
          id: this.lastID,
          planName: planName.trim(),
          price: parseFloat(price),
          billingPeriod
        });
      }
    );
  });
};

// GET ALL PLANS
exports.getPlans = (req, res) => {
  const { billingPeriod } = req.query;
  
  let query = `SELECT * FROM recurring_plans`;
  let params = [];
  
  if (billingPeriod) {
    if (!VALID_BILLING_PERIODS.includes(billingPeriod)) {
      return res.status(400).json({ 
        error: `Invalid billing period. Allowed values: ${VALID_BILLING_PERIODS.join(', ')}` 
      });
    }
    query += ` WHERE billingPeriod = ?`;
    params.push(billingPeriod);
  }
  
  query += ` ORDER BY planName ASC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET PLAN BY ID
exports.getPlanById = (req, res) => {
  const { planId } = req.params;

  db.get(`SELECT * FROM recurring_plans WHERE id = ?`, [planId], (err, plan) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  });
};

// UPDATE PLAN
exports.updatePlan = (req, res) => {
  const { planId } = req.params;
  const { planName, price, billingPeriod } = req.body;

  // Validate required fields
  if (!planName || !planName.trim()) {
    return res.status(400).json({ error: "Plan name is required" });
  }
  
  if (price === undefined || price === null || isNaN(parseFloat(price))) {
    return res.status(400).json({ error: "Valid price is required" });
  }
  
  if (!billingPeriod || !VALID_BILLING_PERIODS.includes(billingPeriod)) {
    return res.status(400).json({ 
      error: `Invalid billing period. Allowed values: ${VALID_BILLING_PERIODS.join(', ')}` 
    });
  }

  db.run(
    `UPDATE recurring_plans SET planName = ?, price = ?, billingPeriod = ?
     WHERE id = ?`,
    [planName.trim(), parseFloat(price), billingPeriod, planId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Plan not found" });
      res.json({ message: "Plan updated" });
    }
  );
};

// DELETE PLAN
exports.deletePlan = (req, res) => {
  const { planId } = req.params;

  // Check if plan is in use
  db.get(`SELECT id FROM subscriptions WHERE planId = ? LIMIT 1`, [planId], (err, subscription) => {
    if (err) return res.status(500).json({ error: err.message });
    if (subscription) {
      return res.status(400).json({ error: "Cannot delete plan that is in use by subscriptions" });
    }

    db.run(`DELETE FROM recurring_plans WHERE id = ?`, [planId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Plan not found" });
      res.json({ message: "Plan deleted" });
    });
  });
};

// ASSIGN PLAN TO PRODUCT
exports.assignPlanToProduct = (req, res) => {
  const { productId } = req.params;
  const { planId } = req.body;

  if (!planId) {
    return res.status(400).json({ error: "Plan ID is required" });
  }

  // Verify product exists
  db.get(`SELECT id FROM products WHERE id = ?`, [productId], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Verify plan exists
    db.get(`SELECT id FROM recurring_plans WHERE id = ?`, [planId], (err, plan) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!plan) return res.status(404).json({ error: "Plan not found" });

      db.run(
        `INSERT OR IGNORE INTO product_plans (productId, planId)
         VALUES (?, ?)`,
        [productId, planId],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "Plan assigned to product" });
        }
      );
    });
  });
};

// REMOVE PLAN FROM PRODUCT
exports.removePlanFromProduct = (req, res) => {
  const { productId, planId } = req.params;

  db.run(
    `DELETE FROM product_plans WHERE productId = ? AND planId = ?`,
    [productId, planId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Plan assignment not found" });
      res.json({ message: "Plan removed from product" });
    }
  );
};

// GET PRODUCTS FOR PLAN
exports.getProductsForPlan = (req, res) => {
  const { planId } = req.params;

  db.all(
    `SELECT p.* FROM products p
     INNER JOIN product_plans pp ON p.id = pp.productId
     WHERE pp.planId = ?
     ORDER BY p.productName`,
    [planId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};
