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
