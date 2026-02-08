const db = require("../../db/db");

const VALID_TAX_TYPES = ['PERCENTAGE', 'FIXED'];

// CREATE TAX
exports.createTax = (req, res) => {
  const { taxName, taxType, rate } = req.body;

  // Validate required fields
  if (!taxName || !taxName.trim()) {
    return res.status(400).json({ error: "Tax name is required" });
  }
  
  if (!taxType) {
    return res.status(400).json({ error: "Tax type is required" });
  }
  
  if (!VALID_TAX_TYPES.includes(taxType)) {
    return res.status(400).json({ 
      error: `Invalid tax type. Allowed values: ${VALID_TAX_TYPES.join(', ')}` 
    });
  }
  
  if (rate === undefined || rate === null || isNaN(parseFloat(rate))) {
    return res.status(400).json({ error: "Valid tax rate is required" });
  }
  
  if (parseFloat(rate) < 0) {
    return res.status(400).json({ error: "Tax rate cannot be negative" });
  }
  
  if (taxType === 'PERCENTAGE' && parseFloat(rate) > 100) {
    return res.status(400).json({ error: "Percentage tax rate cannot exceed 100%" });
  }

  db.run(
    `INSERT INTO taxes (taxName, taxType, rate, isActive)
     VALUES (?, ?, ?, 1)`,
    [taxName.trim(), taxType, parseFloat(rate)],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ 
        message: "Tax created",
        id: this.lastID 
      });
    }
  );
};

// GET ALL TAXES
exports.getTaxes = (req, res) => {
  const { isActive } = req.query;
  
  let query = `SELECT * FROM taxes`;
  let params = [];
  
  if (isActive !== undefined) {
    query += ` WHERE isActive = ?`;
    params.push(isActive === 'true' ? 1 : 0);
  }
  
  query += ` ORDER BY taxName ASC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET TAX BY ID
exports.getTaxById = (req, res) => {
  const { taxId } = req.params;

  db.get(`SELECT * FROM taxes WHERE id = ?`, [taxId], (err, tax) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!tax) return res.status(404).json({ error: "Tax not found" });
    res.json(tax);
  });
};

// UPDATE TAX
exports.updateTax = (req, res) => {
  const { taxId } = req.params;
  const { taxName, taxType, rate, isActive } = req.body;

  if (taxType && !VALID_TAX_TYPES.includes(taxType)) {
    return res.status(400).json({ 
      error: `Invalid tax type. Allowed values: ${VALID_TAX_TYPES.join(', ')}` 
    });
  }

  db.run(
    `UPDATE taxes SET 
       taxName = COALESCE(?, taxName),
       taxType = COALESCE(?, taxType),
       rate = COALESCE(?, rate),
       isActive = COALESCE(?, isActive)
     WHERE id = ?`,
    [
      taxName?.trim(),
      taxType,
      rate !== undefined ? parseFloat(rate) : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      taxId
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Tax not found" });
      res.json({ message: "Tax updated" });
    }
  );
};

// DELETE TAX
exports.deleteTax = (req, res) => {
  const { taxId } = req.params;

  db.run(`DELETE FROM taxes WHERE id = ?`, [taxId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Tax not found" });
    res.json({ message: "Tax deleted" });
  });
};

// ASSIGN TAX TO PRODUCT (ADMIN)
exports.assignTaxToProduct = (req, res) => {
  const { productId, taxId } = req.body;

  // Validate required fields
  if (!productId) {
    return res.status(400).json({ error: "Product ID is required" });
  }
  if (!taxId) {
    return res.status(400).json({ error: "Tax ID is required" });
  }

  // Verify product exists
  db.get(`SELECT id FROM products WHERE id = ?`, [productId], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Verify tax exists
    db.get(`SELECT id FROM taxes WHERE id = ?`, [taxId], (err, tax) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!tax) return res.status(404).json({ error: "Tax not found" });

      db.run(
        `INSERT OR IGNORE INTO product_taxes (productId, taxId)
         VALUES (?, ?)`,
        [productId, taxId],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "Tax assigned to product" });
        }
      );
    });
  });
};

// REMOVE TAX FROM PRODUCT
exports.removeTaxFromProduct = (req, res) => {
  const { productId, taxId } = req.params;

  db.run(
    `DELETE FROM product_taxes WHERE productId = ? AND taxId = ?`,
    [productId, taxId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Tax assignment not found" });
      res.json({ message: "Tax removed from product" });
    }
  );
};

// GET TAXES FOR PRODUCT
exports.getTaxesForProduct = (req, res) => {
  const { productId } = req.params;

  db.all(
    `SELECT t.* FROM taxes t
     INNER JOIN product_taxes pt ON t.id = pt.taxId
     WHERE pt.productId = ? AND t.isActive = 1
     ORDER BY t.taxName`,
    [productId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// GET PRODUCTS FOR TAX
exports.getProductsForTax = (req, res) => {
  const { taxId } = req.params;

  db.all(
    `SELECT p.* FROM products p
     INNER JOIN product_taxes pt ON p.id = pt.productId
     WHERE pt.taxId = ?
     ORDER BY p.productName`,
    [taxId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};
