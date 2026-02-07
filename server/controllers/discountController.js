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

// VALIDATE DISCOUNT CODE
exports.validateDiscount = (req, res) => {
  const { code, subtotal, quantity } = req.body;

  if (!code) {
    return res.status(400).json({ valid: false, message: "Discount code is required" });
  }

  db.get(
    `SELECT * FROM discounts WHERE discountName = ? AND date('now') BETWEEN startDate AND endDate`,
    [code.toUpperCase()],
    (err, discount) => {
      if (err) return res.status(500).json({ valid: false, error: err.message });

      if (!discount) {
        return res.status(404).json({ valid: false, message: "Invalid or expired discount code" });
      }

      // Check usage limit
      if (discount.limitUsage && discount.usedCount >= discount.limitUsage) {
        return res.status(400).json({ valid: false, message: "Discount code usage limit reached" });
      }

      // Check minimum purchase
      if (discount.minimumPurchase > 0 && subtotal < discount.minimumPurchase) {
        return res.status(400).json({ 
          valid: false, 
          message: `Minimum purchase of $${discount.minimumPurchase} required` 
        });
      }

      // Check minimum quantity
      if (discount.minimumQuantity > 0 && quantity < discount.minimumQuantity) {
        return res.status(400).json({ 
          valid: false, 
          message: `Minimum ${discount.minimumQuantity} items required` 
        });
      }

      // Calculate discount amount
      let discountAmount = 0;
      if (discount.type === "PERCENTAGE") {
        discountAmount = (subtotal * discount.value) / 100;
      } else {
        discountAmount = discount.value;
      }

      // Ensure discount doesn't exceed subtotal
      discountAmount = Math.min(discountAmount, subtotal);

      res.json({
        valid: true,
        discount: {
          id: discount.id,
          code: discount.discountName,
          type: discount.type,
          value: discount.value,
          discountAmount: discountAmount.toFixed(2),
          appliesTo: discount.appliesTo
        }
      });
    }
  );
};

// USE DISCOUNT (increment used count)
exports.useDiscount = (req, res) => {
  const { discountId } = req.params;

  db.run(
    `UPDATE discounts SET usedCount = usedCount + 1 WHERE id = ?`,
    [discountId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Discount applied successfully" });
    }
  );
};
