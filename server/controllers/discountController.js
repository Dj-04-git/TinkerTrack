const db = require("../../db/db");

// CREATE DISCOUNT (ADMIN)
exports.createDiscount = (req, res) => {
  const {
    discountName,
    type,
    value,
    minimumPurchase,
    minimumQuantity,
    startDate,
    endDate,
    limitUsage,
    appliesTo,
    productId,
    subscriptionId
  } = req.body;

  db.run(
    `INSERT INTO discounts 
     (discountName, type, value, minimumPurchase, minimumQuantity, startDate, endDate, limitUsage, appliesTo, productId, subscriptionId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      discountName,
      type,
      value,
      minimumPurchase || 0,
      minimumQuantity || 0,
      startDate,
      endDate,
      limitUsage,
      appliesTo,
      productId || null,
      subscriptionId || null
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.status(201).json({
        message: "Discount created",
        discountId: this.lastID
      });
    }
  );
};

// GET ALL DISCOUNTS
exports.getDiscounts = (req, res) => {
  db.all(`SELECT * FROM discounts`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
