const db = require("../../db/db");

exports.createVariant = (req, res) => {
  const { productId } = req.params;
  const { attribute, value, extraPrice } = req.body;

  db.run(
    `INSERT INTO product_variants (productId, attribute, value, extraPrice)
     VALUES (?, ?, ?, ?)`,
    [productId, attribute, value, extraPrice],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
};

exports.getVariantsByProductId = (req, res) => {
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
