const db = require("../../db/db");

// Helper to promisify db.get
const dbGet = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

// Helper to promisify db.all
const dbAll = (query, params = []) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

// GET ALL REPORTING DATA (combined endpoint)
exports.getReportingData = async (req, res) => {
  try {
    const { months = 6, limit = 5 } = req.query;
    
    // Run all queries in parallel
    const [
      activeSubsRow,
      revenueRow,
      paymentsRow,
      overdueRow,
      revenueByMonth,
      subscriptionsByPlan,
      paymentsByStatus,
      recentPayments,
      overdueInvoices
    ] = await Promise.all([
      // Active subscriptions
      dbGet(`SELECT COUNT(*) as count FROM subscriptions WHERE status IN ('Active', 'Confirmed')`),
      // Total revenue
      dbGet(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'COMPLETED'`),
      // Payments count
      dbGet(`SELECT COUNT(*) as count FROM payments WHERE status = 'COMPLETED'`),
      // Overdue invoices
      dbGet(`SELECT COUNT(*) as count, COALESCE(SUM(total - COALESCE(amountPaid, 0)), 0) as amount FROM invoices WHERE status = 'OVERDUE' OR (status NOT IN ('PAID', 'CANCELLED') AND DATE(dueDate) < DATE('now'))`),
      // Revenue by month
      dbAll(`SELECT strftime('%Y-%m', paymentDate) as month, strftime('%b', paymentDate) as monthName, COALESCE(SUM(amount), 0) as revenue FROM payments WHERE status = 'COMPLETED' AND paymentDate >= date('now', '-' || ? || ' months') GROUP BY strftime('%Y-%m', paymentDate) ORDER BY month ASC`, [parseInt(months)]),
      // Subscriptions by plan
      dbAll(`SELECT COALESCE(rp.planName, 'No Plan') as plan, COUNT(*) as count FROM subscriptions s LEFT JOIN recurring_plans rp ON s.planId = rp.id WHERE s.status IN ('Active', 'Confirmed', 'Draft', 'Quotation') GROUP BY rp.planName ORDER BY count DESC`),
      // Payments by status
      dbAll(`SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount FROM payments GROUP BY status ORDER BY count DESC`),
      // Recent payments
      dbAll(`SELECT p.id, p.paymentNumber, p.amount, p.paymentMethod, p.status, p.paymentDate, u.name as customerName FROM payments p LEFT JOIN users u ON p.customerId = u.id ORDER BY p.paymentDate DESC LIMIT ?`, [parseInt(limit)]),
      // Overdue invoices list
      dbAll(`SELECT i.id, i.invoiceNumber, i.total, i.amountPaid, i.dueDate, CAST(julianday('now') - julianday(i.dueDate) AS INTEGER) as daysOverdue, u.name as customerName FROM invoices i LEFT JOIN users u ON i.customerId = u.id WHERE i.status = 'OVERDUE' OR (i.status NOT IN ('PAID', 'CANCELLED') AND DATE(i.dueDate) < DATE('now')) ORDER BY i.dueDate ASC LIMIT ?`, [parseInt(limit)])
    ]);

    // Calculate subscription plan percentages
    const totalSubs = subscriptionsByPlan.reduce((sum, r) => sum + r.count, 0);
    const subscriptionsByPlanWithPercent = subscriptionsByPlan.map(r => ({
      ...r,
      percentage: totalSubs > 0 ? parseFloat(((r.count / totalSubs) * 100).toFixed(1)) : 0
    }));

    // Format overdue invoices
    const overdueInvoicesFormatted = overdueInvoices.map(r => ({
      ...r,
      amountDue: (r.total || 0) - (r.amountPaid || 0)
    }));

    res.json({
      kpis: {
        activeSubscriptions: activeSubsRow?.count || 0,
        activeSubscriptionsChange: 0,
        totalRevenue: revenueRow?.total || 0,
        revenueChange: 0,
        paymentsReceived: paymentsRow?.count || 0,
        paymentsChange: 0,
        overdueInvoices: overdueRow?.count || 0,
        overdueAmount: overdueRow?.amount || 0
      },
      revenueByMonth,
      subscriptionsByPlan: subscriptionsByPlanWithPercent,
      paymentsByStatus,
      recentPayments,
      overdueInvoices: overdueInvoicesFormatted
    });
  } catch (err) {
    console.error('Reporting error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET DASHBOARD KPIs
exports.getDashboardKPIs = async (req, res) => {
  try {
    const [activeSubsRow, revenueRow, paymentsRow, overdueRow] = await Promise.all([
      dbGet(`SELECT COUNT(*) as count FROM subscriptions WHERE status IN ('Active', 'Confirmed')`),
      dbGet(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'COMPLETED'`),
      dbGet(`SELECT COUNT(*) as count FROM payments WHERE status = 'COMPLETED'`),
      dbGet(`SELECT COUNT(*) as count, COALESCE(SUM(total - COALESCE(amountPaid, 0)), 0) as amount FROM invoices WHERE status = 'OVERDUE' OR (status NOT IN ('PAID', 'CANCELLED') AND DATE(dueDate) < DATE('now'))`)
    ]);

    res.json({
      activeSubscriptions: activeSubsRow?.count || 0,
      activeSubscriptionsChange: 0,
      totalRevenue: revenueRow?.total || 0,
      revenueChange: 0,
      paymentsReceived: paymentsRow?.count || 0,
      paymentsChange: 0,
      overdueInvoices: overdueRow?.count || 0,
      overdueAmount: overdueRow?.amount || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET REVENUE BY MONTH
exports.getRevenueByMonth = async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const rows = await dbAll(
      `SELECT strftime('%Y-%m', paymentDate) as month, strftime('%b', paymentDate) as monthName, COALESCE(SUM(amount), 0) as revenue FROM payments WHERE status = 'COMPLETED' AND paymentDate >= date('now', '-' || ? || ' months') GROUP BY strftime('%Y-%m', paymentDate) ORDER BY month ASC`,
      [parseInt(months)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET SUBSCRIPTIONS BY PLAN
exports.getSubscriptionsByPlan = async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT COALESCE(rp.planName, 'No Plan') as plan, COUNT(*) as count FROM subscriptions s LEFT JOIN recurring_plans rp ON s.planId = rp.id WHERE s.status IN ('Active', 'Confirmed', 'Draft', 'Quotation') GROUP BY rp.planName ORDER BY count DESC`
    );
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    const result = rows.map(r => ({
      ...r,
      percentage: total > 0 ? parseFloat(((r.count / total) * 100).toFixed(1)) : 0
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET PAYMENTS BY STATUS
exports.getPaymentsByStatus = async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount FROM payments GROUP BY status ORDER BY count DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET RECENT PAYMENTS
exports.getRecentPayments = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const rows = await dbAll(
      `SELECT p.id, p.paymentNumber, p.amount, p.paymentMethod, p.status, p.paymentDate, u.name as customerName, u.email as customerEmail FROM payments p LEFT JOIN users u ON p.customerId = u.id ORDER BY p.paymentDate DESC LIMIT ?`,
      [parseInt(limit)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET OVERDUE INVOICES
exports.getOverdueInvoices = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const rows = await dbAll(
      `SELECT i.id, i.invoiceNumber, i.total, i.amountPaid, i.dueDate, CAST(julianday('now') - julianday(i.dueDate) AS INTEGER) as daysOverdue, u.name as customerName, u.email as customerEmail FROM invoices i LEFT JOIN users u ON i.customerId = u.id WHERE i.status = 'OVERDUE' OR (i.status NOT IN ('PAID', 'CANCELLED') AND DATE(i.dueDate) < DATE('now')) ORDER BY i.dueDate ASC LIMIT ?`,
      [parseInt(limit)]
    );
    const result = rows.map(r => ({
      ...r,
      amountDue: (r.total || 0) - (r.amountPaid || 0)
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
