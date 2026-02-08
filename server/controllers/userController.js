const db = require("../../db/db");

// GET ALL USERS
exports.getUsers = (req, res) => {
  const { isVerified, isAdmin, search, limit, offset } = req.query;

  let query = `
    SELECT 
      id,
      name,
      email,
      phone,
      location,
      about,
      isVerified,
      isAdmin,
      createdAt,
      updatedAt
    FROM users
    WHERE 1=1
  `;
  let params = [];

  if (isVerified !== undefined) {
    query += ` AND isVerified = ?`;
    params.push(isVerified === 'true' ? 1 : 0);
  }

  if (isAdmin !== undefined) {
    query += ` AND isAdmin = ?`;
    params.push(isAdmin === 'true' ? 1 : 0);
  }

  if (search) {
    query += ` AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  query += ` ORDER BY createdAt DESC`;

  if (limit) {
    query += ` LIMIT ?`;
    params.push(parseInt(limit));
    if (offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(offset));
    }
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// GET USER BY ID
exports.getUserById = (req, res) => {
  const { userId } = req.params;

  db.get(
    `SELECT 
      id,
      name,
      email,
      phone,
      location,
      about,
      isVerified,
      isAdmin,
      createdAt,
      updatedAt
     FROM users
     WHERE id = ?`,
    [userId],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: "User not found" });

      // Get user's subscriptions
      db.all(
        `SELECT 
          id,
          subscriptionNumber,
          status,
          total,
          startDate,
          endDate,
          createdAt
         FROM subscriptions
         WHERE customerId = ?
         ORDER BY createdAt DESC
         LIMIT 10`,
        [userId],
        (err, subscriptions) => {
          if (err) return res.status(500).json({ error: err.message });

          // Get user's invoices
          db.all(
            `SELECT 
              id,
              invoiceNumber,
              status,
              total,
              amountPaid,
              dueDate,
              createdAt
             FROM invoices
             WHERE customerId = ?
             ORDER BY createdAt DESC
             LIMIT 10`,
            [userId],
            (err, invoices) => {
              if (err) return res.status(500).json({ error: err.message });

              // Get user's payments
              db.all(
                `SELECT 
                  id,
                  paymentNumber,
                  amount,
                  paymentMethod,
                  status,
                  paymentDate
                 FROM payments
                 WHERE customerId = ?
                 ORDER BY paymentDate DESC
                 LIMIT 10`,
                [userId],
                (err, payments) => {
                  if (err) return res.status(500).json({ error: err.message });

                  res.json({
                    ...user,
                    subscriptions,
                    invoices,
                    payments
                  });
                }
              );
            }
          );
        }
      );
    }
  );
};

// GET USER STATS
exports.getUserStats = (req, res) => {
  db.get(
    `SELECT 
      COUNT(*) as totalUsers,
      SUM(CASE WHEN isVerified = 1 THEN 1 ELSE 0 END) as verifiedUsers,
      SUM(CASE WHEN isAdmin = 1 THEN 1 ELSE 0 END) as adminUsers,
      SUM(CASE WHEN DATE(createdAt) >= DATE('now', '-30 days') THEN 1 ELSE 0 END) as newUsersLast30Days
     FROM users`,
    [],
    (err, stats) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(stats);
    }
  );
};

// UPDATE USER (admin only)
exports.updateUser = (req, res) => {
  const { userId } = req.params;
  const { name, phone, location, about, isVerified, isAdmin } = req.body;

  db.run(
    `UPDATE users SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      location = COALESCE(?, location),
      about = COALESCE(?, about),
      isVerified = COALESCE(?, isVerified),
      isAdmin = COALESCE(?, isAdmin),
      updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, phone, location, about, isVerified, isAdmin, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "User not found" });

      res.json({ message: "User updated successfully" });
    }
  );
};

// DELETE USER (admin only)
exports.deleteUser = (req, res) => {
  const { userId } = req.params;

  db.run(
    `DELETE FROM users WHERE id = ?`,
    [userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "User not found" });

      res.json({ message: "User deleted successfully" });
    }
  );
};
