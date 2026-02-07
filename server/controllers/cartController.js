const db = require("../../db/db");

// Add item to cart
exports.addToCart = (req, res) => {
  const { userId, productId, productName, planId, planName, variantId, variantName, price, billingPeriod, quantity } = req.body;

  // Check if item already exists in cart
  db.get(
    `SELECT * FROM cart WHERE userId = ? AND productId = ? AND planId = ? AND (variantId = ? OR (variantId IS NULL AND ? IS NULL))`,
    [userId || 1, productId, planId, variantId, variantId],
    (err, existingItem) => {
      if (err) return res.status(500).json({ error: err.message });

      if (existingItem) {
        // Update quantity
        db.run(
          `UPDATE cart SET quantity = quantity + ? WHERE id = ?`,
          [quantity || 1, existingItem.id],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Cart updated", id: existingItem.id });
          }
        );
      } else {
        // Insert new item
        db.run(
          `INSERT INTO cart (userId, productId, productName, planId, planName, variantId, variantName, price, billingPeriod, quantity)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId || 1, productId, productName, planId, planName, variantId, variantName, price, billingPeriod, quantity || 1],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Added to cart", id: this.lastID });
          }
        );
      }
    }
  );
};

// Get cart items
exports.getCart = (req, res) => {
  const userId = req.query.userId || 1;
  
  db.all(
    `SELECT * FROM cart WHERE userId = ?`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// Delete cart item
exports.deleteCartItem = (req, res) => {
  const { itemId } = req.params;

  db.run(
    `DELETE FROM cart WHERE id = ?`,
    [itemId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Item not found" });
      res.json({ message: "Item removed from cart" });
    }
  );
};

// Update cart item quantity
exports.updateCartItem = (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  if (quantity < 1) {
    return res.status(400).json({ error: "Quantity must be at least 1" });
  }

  db.run(
    `UPDATE cart SET quantity = ? WHERE id = ?`,
    [quantity, itemId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Item not found" });
      res.json({ message: "Cart updated" });
    }
  );
};

// Clear cart
exports.clearCart = (req, res) => {
  const userId = req.query.userId || 1;

  db.run(
    `DELETE FROM cart WHERE userId = ?`,
    [userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Cart cleared" });
    }
  );
};
