const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(
  path.join(__dirname, "../database.sqlite"),
  (err) => {
    if (err) {
      console.error("SQLite connection failed:", err);
    } else {
      console.log("SQLite connected");
      // Enable foreign key enforcement
      db.run("PRAGMA foreign_keys = ON");
    }
  }
);

// CREATE TABLES (optimized schema)
db.serialize(() => {

  // ========================================
  // USERS
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT CHECK(length(phone) = 10),
      location TEXT,
      about TEXT,
      isVerified INTEGER DEFAULT 0,
      isAdmin INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");

  // ========================================
  // OTP VERIFICATION (temporary storage)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS otp_verification (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      otp TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiresAt DATETIME NOT NULL
    )
  `);

  // ========================================
  // PRODUCTS
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productName TEXT NOT NULL,
      productType TEXT,
      salesPrice REAL DEFAULT 0,
      costPrice REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ========================================
  // TAXES
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taxName TEXT NOT NULL,
      taxType TEXT CHECK(taxType IN ('PERCENTAGE', 'FIXED')) NOT NULL,
      rate REAL NOT NULL,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ========================================
  // RECURRING PLANS
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS recurring_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planName TEXT NOT NULL,
      price REAL NOT NULL,
      billingPeriod TEXT NOT NULL CHECK(billingPeriod IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ========================================
  // PRODUCT VARIANTS (with CASCADE)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      attribute TEXT NOT NULL,
      value TEXT NOT NULL,
      extraPrice REAL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_product_variants_productId ON product_variants(productId)");

  // ========================================
  // PRODUCT PLANS (with CASCADE)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS product_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      planId INTEGER NOT NULL,
      UNIQUE(productId, planId),
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (planId) REFERENCES recurring_plans(id) ON DELETE CASCADE
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_product_plans_productId ON product_plans(productId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_product_plans_planId ON product_plans(planId)");

  // ========================================
  // PRODUCT TAXES (with CASCADE)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS product_taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      taxId INTEGER NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (taxId) REFERENCES taxes(id) ON DELETE CASCADE,
      UNIQUE(productId, taxId)
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_product_taxes_productId ON product_taxes(productId)");

  // ========================================
  // DISCOUNTS
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discountName TEXT NOT NULL,
      discountCode TEXT UNIQUE,
      type TEXT CHECK(type IN ('FIXED', 'PERCENTAGE')) NOT NULL,
      value REAL NOT NULL,
      minimumPurchase REAL DEFAULT 0,
      minimumQuantity INTEGER DEFAULT 0,
      startDate DATE,
      endDate DATE,
      limitUsage INTEGER,
      usedCount INTEGER DEFAULT 0,
      appliesTo TEXT CHECK(appliesTo IN ('PRODUCT', 'SUBSCRIPTION', 'ALL')) NOT NULL DEFAULT 'ALL',
      productId INTEGER,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_discounts_dates ON discounts(startDate, endDate)");
  db.run("CREATE INDEX IF NOT EXISTS idx_discounts_appliesTo ON discounts(appliesTo)");

  // ========================================
  // PAYMENT TERMS
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      termName TEXT NOT NULL,
      dueDays INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      isDefault INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ========================================
  // SUBSCRIPTIONS (customerId instead of customerName)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriptionNumber TEXT UNIQUE,
      customerId INTEGER,
      planId INTEGER,
      startDate TEXT,
      endDate TEXT,
      paymentTerms TEXT,
      discountId INTEGER,
      discountAmount REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft', 'Quotation', 'Quotation Sent', 'Confirmed', 'Active', 'Cancelled', 'Closed', 'Expired')),
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (planId) REFERENCES recurring_plans(id) ON DELETE SET NULL,
      FOREIGN KEY (discountId) REFERENCES discounts(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_subscriptions_customerId ON subscriptions(customerId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)");
  db.run("CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON subscriptions(startDate, endDate)");

  // ========================================
  // SUBSCRIPTION ITEMS (with CASCADE)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS subscription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriptionId INTEGER NOT NULL,
      productId INTEGER,
      variantId INTEGER,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      unitPrice REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (variantId) REFERENCES product_variants(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_subscription_items_subscriptionId ON subscription_items(subscriptionId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_subscription_items_productId ON subscription_items(productId)");

  // ========================================
  // INVOICES (with dueDate, paidAt, amountPaid)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNumber TEXT UNIQUE,
      customerId INTEGER,
      subscriptionId INTEGER,
      status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED')),
      subtotal REAL DEFAULT 0,
      discountAmount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      amountPaid REAL DEFAULT 0,
      dueDate DATETIME,
      paidAt DATETIME,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_invoices_customerId ON invoices(customerId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_invoices_subscriptionId ON invoices(subscriptionId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)");
  db.run("CREATE INDEX IF NOT EXISTS idx_invoices_dueDate ON invoices(dueDate)");
  db.run("CREATE INDEX IF NOT EXISTS idx_invoices_createdAt ON invoices(createdAt)");

  // ========================================
  // INVOICE ITEMS (NEW)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceId INTEGER NOT NULL,
      productId INTEGER,
      variantId INTEGER,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      unitPrice REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (variantId) REFERENCES product_variants(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items(invoiceId)");

  // ========================================
  // INVOICE ITEM TAXES (with CASCADE)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_item_taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceItemId INTEGER NOT NULL,
      taxId INTEGER NOT NULL,
      taxAmount REAL DEFAULT 0,
      FOREIGN KEY (invoiceItemId) REFERENCES invoice_items(id) ON DELETE CASCADE,
      FOREIGN KEY (taxId) REFERENCES taxes(id) ON DELETE CASCADE
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_invoice_item_taxes_invoiceItemId ON invoice_item_taxes(invoiceItemId)");

  // ========================================
  // PAYMENTS (NEW)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paymentNumber TEXT UNIQUE,
      invoiceId INTEGER,
      customerId INTEGER,
      amount REAL NOT NULL,
      paymentMethod TEXT CHECK(paymentMethod IN ('CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER')),
      paymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      reference TEXT,
      notes TEXT,
      status TEXT DEFAULT 'COMPLETED' CHECK(status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE SET NULL,
      FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_payments_invoiceId ON payments(invoiceId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_payments_customerId ON payments(customerId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_payments_paymentDate ON payments(paymentDate)");
  db.run("CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)");

  // ========================================
  // QUOTATIONS (NEW)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotationNumber TEXT UNIQUE,
      subscriptionId INTEGER,
      customerId INTEGER,
      status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
      subtotal REAL DEFAULT 0,
      discountAmount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      validUntil DATETIME,
      notes TEXT,
      sentAt DATETIME,
      respondedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_quotations_subscriptionId ON quotations(subscriptionId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_quotations_customerId ON quotations(customerId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status)");

  // ========================================
  // QUOTATION ITEMS (NEW)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotationId INTEGER NOT NULL,
      productId INTEGER,
      variantId INTEGER,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      unitPrice REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      FOREIGN KEY (quotationId) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (variantId) REFERENCES product_variants(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_quotation_items_quotationId ON quotation_items(quotationId)");

  // ========================================
  // QUOTATION TEMPLATES (NEW)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS quotation_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      templateName TEXT NOT NULL,
      description TEXT,
      isDefault INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ========================================
  // QUOTATION TEMPLATE ITEMS (NEW)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS quotation_template_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      templateId INTEGER NOT NULL,
      productId INTEGER,
      variantId INTEGER,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      unitPrice REAL DEFAULT 0,
      sortOrder INTEGER DEFAULT 0,
      FOREIGN KEY (templateId) REFERENCES quotation_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (variantId) REFERENCES product_variants(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_quotation_template_items_templateId ON quotation_template_items(templateId)");

  // ========================================
  // CART (normalized - no denormalized columns)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      planId INTEGER,
      variantId INTEGER,
      quantity INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (planId) REFERENCES recurring_plans(id) ON DELETE SET NULL,
      FOREIGN KEY (variantId) REFERENCES product_variants(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_cart_userId ON cart(userId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_cart_productId ON cart(productId)");

  // ========================================
  // ACTIVITY LOG (NEW)
  // ========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      action TEXT NOT NULL,
      entityType TEXT,
      entityId INTEGER,
      details TEXT,
      ipAddress TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_activity_log_userId ON activity_log(userId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_activity_log_entityType ON activity_log(entityType, entityId)");
  db.run("CREATE INDEX IF NOT EXISTS idx_activity_log_createdAt ON activity_log(createdAt)");

});

module.exports = db;