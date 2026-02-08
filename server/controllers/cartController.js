const db = require("../../db/db");

// Add item to cart (normalized - no denormalized columns)
exports.addToCart = (req, res) => {
  const { userId, productId, planId, variantId, quantity } = req.body;

  // Validate required fields
  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }
  if (!productId) {
    return res.status(400).json({ error: "Product ID is required" });
  }

  // Verify product exists
  db.get(`SELECT id FROM products WHERE id = ?`, [productId], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(400).json({ error: "Product not found" });

    // Check if item already exists in cart (same product, plan, variant combo)
    db.get(
      `SELECT * FROM cart 
       WHERE userId = ? AND productId = ? 
       AND (planId = ? OR (planId IS NULL AND ? IS NULL))
       AND (variantId = ? OR (variantId IS NULL AND ? IS NULL))`,
      [userId, productId, planId, planId, variantId, variantId],
      (err, existingItem) => {
        if (err) return res.status(500).json({ error: err.message });

        if (existingItem) {
          // Update quantity
          db.run(
            `UPDATE cart SET quantity = quantity + ? WHERE id = ?`,
            [quantity || 1, existingItem.id],
            function (err) {
              if (err) return res.status(500).json({ error: err.message });
              
              // Return updated cart item with joined data
              getCartItemById(existingItem.id, res);
            }
          );
        } else {
          // Insert new item
          db.run(
            `INSERT INTO cart (userId, productId, planId, variantId, quantity)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, productId, planId || null, variantId || null, quantity || 1],
            function (err) {
              if (err) return res.status(500).json({ error: err.message });
              
              // Return new cart item with joined data
              getCartItemById(this.lastID, res, 201);
            }
          );
        }
      }
    );
  });
};

// Helper to get cart item with all joined data
function getCartItemById(cartId, res, statusCode = 200) {
  db.get(
    `SELECT c.*,
      p.productName,
      p.salesPrice as productPrice,
      p.productType,
      rp.planName,
      rp.price as planPrice,
      rp.billingPeriod,
      pv.attribute as variantAttribute,
      pv.value as variantValue,
      pv.extraPrice as variantExtraPrice
     FROM cart c
     LEFT JOIN products p ON c.productId = p.id
     LEFT JOIN recurring_plans rp ON c.planId = rp.id
     LEFT JOIN product_variants pv ON c.variantId = pv.id
     WHERE c.id = ?`,
    [cartId],
    (err, item) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!item) return res.status(404).json({ error: "Cart item not found" });

      // Calculate total price
      let price = item.productPrice || 0;
      if (item.planPrice) price = item.planPrice;
      if (item.variantExtraPrice) price += item.variantExtraPrice;

      res.status(statusCode).json({
        ...item,
        price,
        message: statusCode === 201 ? "Added to cart" : "Cart updated"
      });
    }
  );
}

// Get cart items with all product/plan/variant details via JOINs
exports.getCart = (req, res) => {
  const userId = req.query.userId;
  
  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }
  
  db.all(
    `SELECT c.*,
      p.productName,
      p.salesPrice as productPrice,
      p.productType,
      p.tax as productTax,
      rp.planName,
      rp.price as planPrice,
      rp.billingPeriod,
      pv.attribute as variantAttribute,
      pv.value as variantValue,
      pv.extraPrice as variantExtraPrice
     FROM cart c
     LEFT JOIN products p ON c.productId = p.id
     LEFT JOIN recurring_plans rp ON c.planId = rp.id
     LEFT JOIN product_variants pv ON c.variantId = pv.id
     WHERE c.userId = ?
     ORDER BY c.createdAt DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Calculate prices for each item
      const cartItems = rows.map(item => {
        let price = item.productPrice || 0;
        if (item.planPrice) price = item.planPrice;
        if (item.variantExtraPrice) price += item.variantExtraPrice;

        // Build variant name if exists
        let variantName = null;
        if (item.variantAttribute && item.variantValue) {
          variantName = `${item.variantAttribute}: ${item.variantValue}`;
        }

        return {
          ...item,
          price,
          variantName,
          lineTotal: price * item.quantity
        };
      });

      // Calculate cart totals
      const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

      res.json({
        items: cartItems,
        itemCount: cartItems.length,
        totalQuantity,
        subtotal
      });
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

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: "Quantity must be at least 1" });
  }

  db.run(
    `UPDATE cart SET quantity = ? WHERE id = ?`,
    [quantity, itemId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Item not found" });
      
      // Return updated item
      getCartItemById(itemId, res);
    }
  );
};

// Clear cart
exports.clearCart = (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  db.run(
    `DELETE FROM cart WHERE userId = ?`,
    [userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Cart cleared", itemsRemoved: this.changes });
    }
  );
};

// Get cart count
exports.getCartCount = (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  db.get(
    `SELECT COUNT(*) as itemCount, COALESCE(SUM(quantity), 0) as totalQuantity FROM cart WHERE userId = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        itemCount: row?.itemCount || 0,
        totalQuantity: row?.totalQuantity || 0
      });
    }
  );
};

