const db = require("../../db/db");

const VALID_DISCOUNT_TYPES = ['FIXED', 'PERCENTAGE'];
const VALID_APPLIES_TO = ['PRODUCT', 'SUBSCRIPTION', 'ALL'];

// CREATE DISCOUNT (ADMIN)
exports.createDiscount = (req, res) => {
  const {
    discountName,
    discountCode,
    type,
    value,
    minimumPurchase,
    minimumQuantity,
    startDate,
    endDate,
    limitUsage,
    appliesTo,
    productId
  } = req.body;

  // Validate required fields
  if (!discountName || !discountName.trim()) {
    return res.status(400).json({ error: "Discount name is required" });
  }
  
  if (!type) {
    return res.status(400).json({ error: "Discount type is required" });
  }
  
  if (!VALID_DISCOUNT_TYPES.includes(type)) {
    return res.status(400).json({ 
      error: `Invalid type. Allowed values: ${VALID_DISCOUNT_TYPES.join(', ')}` 
    });
  }
  
  if (value === undefined || value === null || isNaN(parseFloat(value))) {
    return res.status(400).json({ error: "Valid discount value is required" });
  }
  
  if (parseFloat(value) <= 0) {
    return res.status(400).json({ error: "Discount value must be greater than 0" });
  }
  
  if (type === 'PERCENTAGE' && parseFloat(value) > 100) {
    return res.status(400).json({ error: "Percentage discount cannot exceed 100%" });
  }
  
  if (appliesTo && !VALID_APPLIES_TO.includes(appliesTo)) {
    return res.status(400).json({ 
      error: `Invalid appliesTo. Allowed values: ${VALID_APPLIES_TO.join(', ')}` 
    });
  }

  // Validate dates if provided
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    if (end < start) {
      return res.status(400).json({ error: "End date must be after start date" });
    }
  }

  // Generate code if not provided
  const code = discountCode ? discountCode.toUpperCase().trim() : null;

  // Check for duplicate code if provided
  if (code) {
    db.get(`SELECT id FROM discounts WHERE discountCode = ?`, [code], (err, existing) => {
      if (err) return res.status(500).json({ error: err.message });
      if (existing) {
        return res.status(409).json({ error: "Discount code already exists" });
      }
      insertDiscount();
    });
  } else {
    insertDiscount();
  }

  function insertDiscount() {
    db.run(
      `INSERT INTO discounts 
       (discountName, discountCode, type, value, minimumPurchase, minimumQuantity, startDate, endDate, limitUsage, appliesTo, productId, isActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        discountName.trim(),
        code,
        type,
        parseFloat(value),
        minimumPurchase || 0,
        minimumQuantity || 0,
        startDate || null,
        endDate || null,
        limitUsage || null,
        appliesTo || 'ALL',
        productId || null
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.status(201).json({
          message: "Discount created",
          discountId: this.lastID,
          discountCode: code
        });
      }
    );
  }
};

// GET ALL DISCOUNTS
exports.getDiscounts = (req, res) => {
  const { appliesTo, isActive, productId } = req.query;
  
  let query = `SELECT * FROM discounts WHERE 1=1`;
  let params = [];
  
  if (appliesTo) {
    query += ` AND appliesTo = ?`;
    params.push(appliesTo);
  }
  
  if (isActive !== undefined) {
    query += ` AND isActive = ?`;
    params.push(isActive === 'true' ? 1 : 0);
  }
  
  if (productId) {
    query += ` AND productId = ?`;
    params.push(productId);
  }
  
  query += ` ORDER BY createdAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET DISCOUNT BY ID
exports.getDiscountById = (req, res) => {
  const { discountId } = req.params;

  db.get(`SELECT * FROM discounts WHERE id = ?`, [discountId], (err, discount) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!discount) return res.status(404).json({ error: "Discount not found" });
    res.json(discount);
  });
};

// UPDATE DISCOUNT
exports.updateDiscount = (req, res) => {
  const { discountId } = req.params;
  const {
    discountName,
    discountCode,
    type,
    value,
    minimumPurchase,
    minimumQuantity,
    startDate,
    endDate,
    limitUsage,
    appliesTo,
    productId,
    isActive
  } = req.body;

  // Validate type if provided
  if (type && !VALID_DISCOUNT_TYPES.includes(type)) {
    return res.status(400).json({ 
      error: `Invalid type. Allowed values: ${VALID_DISCOUNT_TYPES.join(', ')}` 
    });
  }
  
  if (appliesTo && !VALID_APPLIES_TO.includes(appliesTo)) {
    return res.status(400).json({ 
      error: `Invalid appliesTo. Allowed values: ${VALID_APPLIES_TO.join(', ')}` 
    });
  }

  const code = discountCode ? discountCode.toUpperCase().trim() : null;

  db.run(
    `UPDATE discounts SET 
       discountName = COALESCE(?, discountName),
       discountCode = ?,
       type = COALESCE(?, type),
       value = COALESCE(?, value),
       minimumPurchase = COALESCE(?, minimumPurchase),
       minimumQuantity = COALESCE(?, minimumQuantity),
       startDate = ?,
       endDate = ?,
       limitUsage = ?,
       appliesTo = COALESCE(?, appliesTo),
       productId = ?,
       isActive = COALESCE(?, isActive)
     WHERE id = ?`,
    [
      discountName?.trim(),
      code,
      type,
      value !== undefined ? parseFloat(value) : null,
      minimumPurchase,
      minimumQuantity,
      startDate || null,
      endDate || null,
      limitUsage || null,
      appliesTo,
      productId || null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      discountId
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Discount not found" });
      res.json({ message: "Discount updated" });
    }
  );
};

// DELETE DISCOUNT
exports.deleteDiscount = (req, res) => {
  const { discountId } = req.params;

  db.run(`DELETE FROM discounts WHERE id = ?`, [discountId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Discount not found" });
    res.json({ message: "Discount deleted" });
  });
};

// VALIDATE DISCOUNT CODE
exports.validateDiscount = (req, res) => {
  const { code, subtotal, quantity } = req.body;

  if (!code) {
    return res.status(400).json({ valid: false, message: "Discount code is required" });
  }

  db.get(
    `SELECT * FROM discounts 
     WHERE (discountCode = ? OR discountName = ?)
       AND isActive = 1
       AND (startDate IS NULL OR date('now') >= startDate)
       AND (endDate IS NULL OR date('now') <= endDate)`,
    [code.toUpperCase(), code.toUpperCase()],
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
          code: discount.discountCode || discount.discountName,
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

  db.get(`SELECT id, limitUsage, usedCount FROM discounts WHERE id = ?`, [discountId], (err, discount) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!discount) return res.status(404).json({ error: "Discount not found" });

    // Check if limit reached
    if (discount.limitUsage && discount.usedCount >= discount.limitUsage) {
      return res.status(400).json({ error: "Discount usage limit reached" });
    }

    db.run(
      `UPDATE discounts SET usedCount = usedCount + 1 WHERE id = ?`,
      [discountId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Discount applied successfully" });
      }
    );
  });
};

// GET ACTIVE DISCOUNTS (for frontend)
exports.getActiveDiscounts = (req, res) => {
  db.all(
    `SELECT id, discountName, discountCode, type, value, appliesTo, minimumPurchase, minimumQuantity
     FROM discounts 
     WHERE isActive = 1 
       AND (startDate IS NULL OR date('now') >= startDate)
       AND (endDate IS NULL OR date('now') <= endDate)
       AND (limitUsage IS NULL OR usedCount < limitUsage)
     ORDER BY value DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};
