const db = require("../../db/db");

exports.createProduct = (req, res) => {
  const { productName, productType, salesPrice, costPrice } = req.body;

  db.run(
    `INSERT INTO products (productName, productType, salesPrice, costPrice)
     VALUES (?, ?, ?, ?)`,
    [productName, productType, salesPrice, costPrice],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
};

exports.getProducts = (req, res) => {
  db.all(`SELECT * FROM products`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getProductById = (req, res) => {
  const { productId } = req.params;
  db.get(`SELECT * FROM products WHERE id = ?`, [productId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Product not found" });
    res.json(row);
  });
};

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
