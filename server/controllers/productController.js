const db = require("../../db/db");

// CREATE PRODUCT
exports.createProduct = (req, res) => {
  const { productName, productType, salesPrice, costPrice, tax } = req.body;

  if (!productName || !productName.trim()) {
    return res.status(400).json({ error: "Product name is required" });
  }

  db.run(
    `INSERT INTO products (productName, productType, salesPrice, costPrice, tax)
     VALUES (?, ?, ?, ?, ?)`,
    [productName.trim(), productType || null, salesPrice || 0, costPrice || 0, tax || 0],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ 
        message: "Product created",
        id: this.lastID 
      });
    }
  );
};

// GET ALL PRODUCTS
exports.getProducts = (req, res) => {
  const { productType, search } = req.query;
  
  let query = `SELECT * FROM products WHERE 1=1`;
  let params = [];
  
  if (productType) {
    query += ` AND productType = ?`;
    params.push(productType);
  }
  
  if (search) {
    query += ` AND productName LIKE ?`;
    params.push(`%${search}%`);
  }
  
  query += ` ORDER BY productName ASC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET PRODUCT BY ID with variants and plans
exports.getProductById = (req, res) => {
  const { productId } = req.params;
  
  db.get(`SELECT * FROM products WHERE id = ?`, [productId], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Get variants
    db.all(
      `SELECT * FROM product_variants WHERE productId = ?`,
      [productId],
      (err, variants) => {
        if (err) variants = [];

        // Get plans
        db.all(
          `SELECT rp.* FROM recurring_plans rp
           INNER JOIN product_plans pp ON rp.id = pp.planId
           WHERE pp.productId = ?`,
          [productId],
          (err, plans) => {
            if (err) plans = [];

            // Get taxes
            db.all(
              `SELECT t.* FROM taxes t
               INNER JOIN product_taxes pt ON t.id = pt.taxId
               WHERE pt.productId = ? AND t.isActive = 1`,
              [productId],
              (err, taxes) => {
                res.json({
                  ...product,
                  variants: variants || [],
                  plans: plans || [],
                  taxes: taxes || []
                });
              }
            );
          }
        );
      }
    );
  });
};

// UPDATE PRODUCT
exports.updateProduct = (req, res) => {
  const { productId } = req.params;
  const { productName, productType, salesPrice, costPrice, tax } = req.body;

  if (!productName || !productName.trim()) {
    return res.status(400).json({ error: "Product name is required" });
  }

  db.run(
    `UPDATE products SET 
       productName = ?, productType = ?, salesPrice = ?, costPrice = ?, tax = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [productName.trim(), productType || null, salesPrice || 0, costPrice || 0, tax || 0, productId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Product not found" });
      res.json({ message: "Product updated" });
    }
  );
};

// DELETE PRODUCT (cascades to variants, plans, taxes)
exports.deleteProduct = (req, res) => {
  const { productId } = req.params;

  db.run(`DELETE FROM products WHERE id = ?`, [productId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted" });
  });
};

// GET PRODUCT PLANS
exports.getProductPlans = (req, res) => {
  const { productId } = req.params;
  db.all(
    `SELECT rp.* FROM recurring_plans rp
     INNER JOIN product_plans pp ON rp.id = pp.planId
     WHERE pp.productId = ?`,
    [productId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// GET PRODUCT VARIANTS
exports.getProductVariants = (req, res) => {
  const { productId } = req.params;
  db.all(
    `SELECT * FROM product_variants WHERE productId = ?`,
    [productId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// GET PRODUCT TAXES
exports.getProductTaxes = (req, res) => {
  const { productId } = req.params;
  db.all(
    `SELECT t.* FROM taxes t
     INNER JOIN product_taxes pt ON t.id = pt.taxId
     WHERE pt.productId = ? AND t.isActive = 1`,
    [productId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// GET PRODUCT COUNT
exports.getProductCount = (req, res) => {
  const { productType } = req.query;
  
  let query = `SELECT COUNT(*) as count FROM products`;
  let params = [];
  
  if (productType) {
    query += ` WHERE productType = ?`;
    params.push(productType);
  }

  db.get(query, params, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: row?.count || 0 });
  });
};

// ADD PLAN TO PRODUCT
exports.addPlanToProduct = (req, res) => {
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
    db.get(`SELECT id, planName, price, billingPeriod FROM recurring_plans WHERE id = ?`, [planId], (err, plan) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!plan) return res.status(404).json({ error: "Plan not found" });

      // Check if already assigned
      db.get(
        `SELECT id FROM product_plans WHERE productId = ? AND planId = ?`,
        [productId, planId],
        (err, existing) => {
          if (err) return res.status(500).json({ error: err.message });
          if (existing) {
            return res.status(409).json({ error: "Plan is already assigned to this product" });
          }

          db.run(
            `INSERT INTO product_plans (productId, planId) VALUES (?, ?)`,
            [productId, planId],
            function (err) {
              if (err) return res.status(500).json({ error: err.message });
              res.status(201).json({
                message: "Plan added to product",
                id: this.lastID,
                productId: parseInt(productId),
                planId: parseInt(planId),
                plan: plan
              });
            }
          );
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
      if (this.changes === 0) {
        return res.status(404).json({ error: "Plan assignment not found" });
      }
      res.json({ message: "Plan removed from product" });
    }
  );
};
