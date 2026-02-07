const db = require("../../db/db");

// ASSIGN TAX TO PRODUCT (ADMIN)
exports.assignTaxToProduct = (req, res) => {
  const { productId, taxId } = req.body;

  db.run(
    `INSERT OR IGNORE INTO product_taxes (productId, taxId)
     VALUES (?, ?)`,
    [productId, taxId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ message: "Tax assigned to product" });
    }
  );
};
