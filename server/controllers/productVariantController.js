const db = require("../../db/db");

// CREATE VARIANT
exports.createVariant = (req, res) => {
  const { productId } = req.params;
  const { attribute, value, extraPrice } = req.body;

  // Validate required fields
  if (!attribute || !attribute.trim()) {
    return res.status(400).json({ error: "Attribute is required" });
  }
  if (!value || !value.trim()) {
    return res.status(400).json({ error: "Value is required" });
  }

  // Verify product exists
  db.get(`SELECT id FROM products WHERE id = ?`, [productId], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Check for duplicate variant
    db.get(
      `SELECT id FROM product_variants WHERE productId = ? AND attribute = ? AND value = ?`,
      [productId, attribute.trim(), value.trim()],
      (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existing) {
          return res.status(409).json({ error: "Variant with this attribute and value already exists" });
        }

        db.run(
          `INSERT INTO product_variants (productId, attribute, value, extraPrice)
           VALUES (?, ?, ?, ?)`,
          [productId, attribute.trim(), value.trim(), extraPrice || 0],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ 
              message: "Variant created",
              id: this.lastID,
              productId: parseInt(productId),
              attribute: attribute.trim(),
              value: value.trim(),
              extraPrice: extraPrice || 0
            });
          }
        );
      }
    );
  });
};

// GET VARIANTS BY PRODUCT ID
exports.getVariantsByProductId = (req, res) => {
  const { productId } = req.params;
  
  // Verify product exists first
  db.get(`SELECT id FROM products WHERE id = ?`, [productId], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(404).json({ error: "Product not found" });

    db.all(
      `SELECT * FROM product_variants WHERE productId = ? ORDER BY attribute, value`,
      [productId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      }
    );
  });
};

// UPDATE VARIANT
exports.updateVariant = (req, res) => {
  const { productId, variantId } = req.params;
  const { attribute, value, extraPrice } = req.body;

  // Validate required fields
  if (!attribute || !attribute.trim()) {
    return res.status(400).json({ error: "Attribute is required" });
  }
  if (!value || !value.trim()) {
    return res.status(400).json({ error: "Value is required" });
  }

  db.run(
    `UPDATE product_variants SET attribute = ?, value = ?, extraPrice = ?
     WHERE id = ? AND productId = ?`,
    [attribute.trim(), value.trim(), extraPrice || 0, variantId, productId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Variant not found" });
      res.json({ message: "Variant updated" });
    }
  );
};

// DELETE VARIANT
exports.deleteVariant = (req, res) => {
  const { productId, variantId } = req.params;

  db.run(
    `DELETE FROM product_variants WHERE id = ? AND productId = ?`,
    [variantId, productId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Variant not found" });
      res.json({ message: "Variant deleted" });
    }
  );
};

// GET ALL VARIANTS (with product info)
exports.getAllVariants = (req, res) => {
  const { attribute, productId } = req.query;
  
  let query = `
    SELECT pv.*, p.productName 
    FROM product_variants pv
    JOIN products p ON pv.productId = p.id
    WHERE 1=1
  `;
  let params = [];
  
  if (attribute) {
    query += ` AND pv.attribute = ?`;
    params.push(attribute);
  }
  
  if (productId) {
    query += ` AND pv.productId = ?`;
    params.push(productId);
  }
  
  query += ` ORDER BY p.productName, pv.attribute, pv.value`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
