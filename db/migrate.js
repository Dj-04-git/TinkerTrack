/**
 * Database Migration Script
 * Run with: node db/migrate.js
 * 
 * This script will:
 * 1. Create a backup of the current database
 * 2. Create new tables with optimized schema
 * 3. Migrate existing data
 * 4. Drop old tables and rename new ones
 * 
 * BREAKING CHANGES:
 * - subscriptions.customerName is now customerId (INTEGER, references users)
 * - cart table no longer has denormalized columns (productName, planName, variantName, billingPeriod)
 * - users.phone is now TEXT instead of INTEGER
 * - Foreign key cascades are enabled - deleting parent records will delete children
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "../database.sqlite");
const BACKUP_PATH = path.join(__dirname, `../database.backup.${Date.now()}.sqlite`);

// Create backup
console.log("📦 Creating database backup...");
if (fs.existsSync(DB_PATH)) {
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log(`✅ Backup created: ${BACKUP_PATH}`);
} else {
  console.log("ℹ️  No existing database found, starting fresh.");
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ Failed to connect to database:", err);
    process.exit(1);
  }
  console.log("✅ Connected to database");
});

// Helper to run SQL with promise
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

async function migrate() {
  try {
    // Enable foreign keys
    await run("PRAGMA foreign_keys = OFF");
    
    console.log("\n🔄 Starting migration...\n");

    // ========================================
    // 1. USERS TABLE
    // ========================================
    console.log("📋 Migrating users table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS users_new (
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

    // Check if old table exists and migrate data
    const usersExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    if (usersExists) {
      await run(`
        INSERT INTO users_new (id, name, email, password, phone, location, about, isVerified, isAdmin)
        SELECT id, 
               COALESCE(name, 'Unknown'),
               email,
               password,
               CAST(phone AS TEXT),
               location,
               about,
               COALESCE(isVerified, 0),
               COALESCE(isAdmin, 0)
        FROM users
        WHERE email IS NOT NULL AND password IS NOT NULL
      `);
      await run("DROP TABLE users");
    }
    await run("ALTER TABLE users_new RENAME TO users");
    await run("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
    console.log("✅ Users table migrated");

    // ========================================
    // 2. OTP VERIFICATION TABLE
    // ========================================
    console.log("📋 Migrating otp_verification table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS otp_verification_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        otp TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME NOT NULL
      )
    `);

    const otpExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='otp_verification'");
    if (otpExists) {
      await run(`
        INSERT INTO otp_verification_new (id, email, otp, createdAt, expiresAt)
        SELECT id, email, otp, createdAt, expiresAt FROM otp_verification
        WHERE email IS NOT NULL AND otp IS NOT NULL
      `);
      await run("DROP TABLE otp_verification");
    }
    await run("ALTER TABLE otp_verification_new RENAME TO otp_verification");
    console.log("✅ OTP verification table migrated");

    // ========================================
    // 3. PRODUCTS TABLE
    // ========================================
    console.log("📋 Migrating products table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS products_new (
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

    const productsExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
    if (productsExists) {
      await run(`
        INSERT INTO products_new (id, productName, productType, salesPrice, costPrice, tax)
        SELECT id, productName, productType, COALESCE(salesPrice, 0), COALESCE(costPrice, 0), COALESCE(tax, 0)
        FROM products
      `);
      await run("DROP TABLE products");
    }
    await run("ALTER TABLE products_new RENAME TO products");
    console.log("✅ Products table migrated");

    // ========================================
    // 4. TAXES TABLE
    // ========================================
    console.log("📋 Migrating taxes table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS taxes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taxName TEXT NOT NULL,
        taxType TEXT CHECK(taxType IN ('PERCENTAGE', 'FIXED')) NOT NULL,
        rate REAL NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const taxesExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='taxes'");
    if (taxesExists) {
      await run(`
        INSERT INTO taxes_new (id, taxName, taxType, rate, isActive)
        SELECT id, taxName, taxType, rate, COALESCE(isActive, 1) FROM taxes
      `);
      await run("DROP TABLE taxes");
    }
    await run("ALTER TABLE taxes_new RENAME TO taxes");
    console.log("✅ Taxes table migrated");

    // ========================================
    // 5. RECURRING PLANS TABLE
    // ========================================
    console.log("📋 Migrating recurring_plans table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS recurring_plans_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        planName TEXT NOT NULL,
        price REAL NOT NULL,
        billingPeriod TEXT NOT NULL CHECK(billingPeriod IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const plansExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='recurring_plans'");
    if (plansExists) {
      await run(`
        INSERT INTO recurring_plans_new (id, planName, price, billingPeriod)
        SELECT id, planName, price, billingPeriod FROM recurring_plans
      `);
      await run("DROP TABLE recurring_plans");
    }
    await run("ALTER TABLE recurring_plans_new RENAME TO recurring_plans");
    console.log("✅ Recurring plans table migrated");

    // ========================================
    // 6. PRODUCT VARIANTS TABLE (with CASCADE)
    // ========================================
    console.log("📋 Migrating product_variants table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS product_variants_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER NOT NULL,
        attribute TEXT NOT NULL,
        value TEXT NOT NULL,
        extraPrice REAL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    const variantsExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='product_variants'");
    if (variantsExists) {
      await run(`
        INSERT INTO product_variants_new (id, productId, attribute, value, extraPrice)
        SELECT pv.id, pv.productId, pv.attribute, pv.value, COALESCE(pv.extraPrice, 0)
        FROM product_variants pv
        INNER JOIN products p ON pv.productId = p.id
      `);
      await run("DROP TABLE product_variants");
    }
    await run("ALTER TABLE product_variants_new RENAME TO product_variants");
    await run("CREATE INDEX IF NOT EXISTS idx_product_variants_productId ON product_variants(productId)");
    console.log("✅ Product variants table migrated");

    // ========================================
    // 7. PRODUCT PLANS TABLE (with CASCADE)
    // ========================================
    console.log("📋 Migrating product_plans table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS product_plans_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER NOT NULL,
        planId INTEGER NOT NULL,
        UNIQUE(productId, planId),
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (planId) REFERENCES recurring_plans(id) ON DELETE CASCADE
      )
    `);

    const productPlansExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='product_plans'");
    if (productPlansExists) {
      await run(`
        INSERT OR IGNORE INTO product_plans_new (id, productId, planId)
        SELECT pp.id, pp.productId, pp.planId
        FROM product_plans pp
        INNER JOIN products p ON pp.productId = p.id
        INNER JOIN recurring_plans rp ON pp.planId = rp.id
      `);
      await run("DROP TABLE product_plans");
    }
    await run("ALTER TABLE product_plans_new RENAME TO product_plans");
    await run("CREATE INDEX IF NOT EXISTS idx_product_plans_productId ON product_plans(productId)");
    await run("CREATE INDEX IF NOT EXISTS idx_product_plans_planId ON product_plans(planId)");
    console.log("✅ Product plans table migrated");

    // ========================================
    // 8. PRODUCT TAXES TABLE (with CASCADE)
    // ========================================
    console.log("📋 Migrating product_taxes table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS product_taxes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER NOT NULL,
        taxId INTEGER NOT NULL,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (taxId) REFERENCES taxes(id) ON DELETE CASCADE,
        UNIQUE(productId, taxId)
      )
    `);

    const productTaxesExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='product_taxes'");
    if (productTaxesExists) {
      await run(`
        INSERT OR IGNORE INTO product_taxes_new (id, productId, taxId)
        SELECT pt.id, pt.productId, pt.taxId
        FROM product_taxes pt
        INNER JOIN products p ON pt.productId = p.id
        INNER JOIN taxes t ON pt.taxId = t.id
      `);
      await run("DROP TABLE product_taxes");
    }
    await run("ALTER TABLE product_taxes_new RENAME TO product_taxes");
    await run("CREATE INDEX IF NOT EXISTS idx_product_taxes_productId ON product_taxes(productId)");
    console.log("✅ Product taxes table migrated");

    // ========================================
    // 9. DISCOUNTS TABLE (with proper constraints)
    // ========================================
    console.log("📋 Migrating discounts table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS discounts_new (
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

    const discountsExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='discounts'");
    if (discountsExists) {
      await run(`
        INSERT INTO discounts_new (id, discountName, type, value, minimumPurchase, minimumQuantity, startDate, endDate, limitUsage, usedCount, appliesTo, productId)
        SELECT id, discountName, type, value, COALESCE(minimumPurchase, 0), COALESCE(minimumQuantity, 0), startDate, endDate, limitUsage, COALESCE(usedCount, 0), appliesTo, productId
        FROM discounts
      `);
      await run("DROP TABLE discounts");
    }
    await run("ALTER TABLE discounts_new RENAME TO discounts");
    await run("CREATE INDEX IF NOT EXISTS idx_discounts_dates ON discounts(startDate, endDate)");
    await run("CREATE INDEX IF NOT EXISTS idx_discounts_appliesTo ON discounts(appliesTo)");
    console.log("✅ Discounts table migrated");

    // ========================================
    // 10. SUBSCRIPTIONS TABLE (customerName -> customerId)
    // ========================================
    console.log("📋 Migrating subscriptions table...");
    console.log("⚠️  WARNING: customerName is being converted to customerId");
    
    await run(`
      CREATE TABLE IF NOT EXISTS subscriptions_new (
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

    const subscriptionsExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='subscriptions'");
    if (subscriptionsExists) {
      // Try to match customerName to user id, otherwise set to NULL
      await run(`
        INSERT INTO subscriptions_new (id, subscriptionNumber, customerId, planId, startDate, endDate, paymentTerms, discountAmount, subtotal, tax, total, status, createdAt)
        SELECT 
          s.id, 
          s.subscriptionNumber, 
          u.id,
          s.planId, 
          s.startDate, 
          s.endDate, 
          s.paymentTerms, 
          COALESCE(s.discountAmount, 0), 
          COALESCE(s.subtotal, 0), 
          COALESCE(s.tax, 0), 
          COALESCE(s.total, 0), 
          COALESCE(s.status, 'Draft'), 
          s.createdAt
        FROM subscriptions s
        LEFT JOIN users u ON LOWER(s.customerName) = LOWER(u.name) OR LOWER(s.customerName) = LOWER(u.email)
      `);
      await run("DROP TABLE subscriptions");
    }
    await run("ALTER TABLE subscriptions_new RENAME TO subscriptions");
    await run("CREATE INDEX IF NOT EXISTS idx_subscriptions_customerId ON subscriptions(customerId)");
    await run("CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)");
    await run("CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON subscriptions(startDate, endDate)");
    console.log("✅ Subscriptions table migrated");

    // ========================================
    // 11. SUBSCRIPTION ITEMS TABLE (with CASCADE)
    // ========================================
    console.log("📋 Migrating subscription_items table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS subscription_items_new (
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

    const subItemsExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='subscription_items'");
    if (subItemsExists) {
      await run(`
        INSERT INTO subscription_items_new (id, subscriptionId, productId, quantity, unitPrice, tax, amount)
        SELECT si.id, si.subscriptionId, si.productId, COALESCE(si.quantity, 1), COALESCE(si.unitPrice, 0), COALESCE(si.tax, 0), COALESCE(si.amount, 0)
        FROM subscription_items si
        INNER JOIN subscriptions s ON si.subscriptionId = s.id
      `);
      await run("DROP TABLE subscription_items");
    }
    await run("ALTER TABLE subscription_items_new RENAME TO subscription_items");
    await run("CREATE INDEX IF NOT EXISTS idx_subscription_items_subscriptionId ON subscription_items(subscriptionId)");
    await run("CREATE INDEX IF NOT EXISTS idx_subscription_items_productId ON subscription_items(productId)");
    console.log("✅ Subscription items table migrated");

    // ========================================
    // 12. INVOICES TABLE (with new columns)
    // ========================================
    console.log("📋 Migrating invoices table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS invoices_new (
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

    const invoicesExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'");
    if (invoicesExists) {
      await run(`
        INSERT INTO invoices_new (id, invoiceNumber, customerId, subscriptionId, status, subtotal, tax, total, createdAt)
        SELECT id, invoiceNumber, customerId, subscriptionId, COALESCE(status, 'DRAFT'), COALESCE(subtotal, 0), COALESCE(tax, 0), COALESCE(total, 0), createdAt
        FROM invoices
      `);
      await run("DROP TABLE invoices");
    }
    await run("ALTER TABLE invoices_new RENAME TO invoices");
    await run("CREATE INDEX IF NOT EXISTS idx_invoices_customerId ON invoices(customerId)");
    await run("CREATE INDEX IF NOT EXISTS idx_invoices_subscriptionId ON invoices(subscriptionId)");
    await run("CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)");
    await run("CREATE INDEX IF NOT EXISTS idx_invoices_dueDate ON invoices(dueDate)");
    await run("CREATE INDEX IF NOT EXISTS idx_invoices_createdAt ON invoices(createdAt)");
    console.log("✅ Invoices table migrated");

    // ========================================
    // 13. NEW: INVOICE ITEMS TABLE
    // ========================================
    console.log("📋 Creating invoice_items table...");
    
    await run(`
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
    await run("CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items(invoiceId)");
    console.log("✅ Invoice items table created");

    // ========================================
    // 14. INVOICE ITEM TAXES TABLE (with CASCADE)
    // ========================================
    console.log("📋 Migrating invoice_item_taxes table...");
    
    await run(`
      CREATE TABLE IF NOT EXISTS invoice_item_taxes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoiceItemId INTEGER NOT NULL,
        taxId INTEGER NOT NULL,
        taxAmount REAL DEFAULT 0,
        FOREIGN KEY (invoiceItemId) REFERENCES invoice_items(id) ON DELETE CASCADE,
        FOREIGN KEY (taxId) REFERENCES taxes(id) ON DELETE CASCADE
      )
    `);

    const itemTaxesExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_item_taxes'");
    if (itemTaxesExists) {
      // Only migrate if invoice_items has matching records
      await run(`
        INSERT INTO invoice_item_taxes_new (id, invoiceItemId, taxId, taxAmount)
        SELECT iit.id, iit.invoiceItemId, iit.taxId, COALESCE(iit.taxAmount, 0)
        FROM invoice_item_taxes iit
        INNER JOIN invoice_items ii ON iit.invoiceItemId = ii.id
        INNER JOIN taxes t ON iit.taxId = t.id
      `);
      await run("DROP TABLE invoice_item_taxes");
    }
    await run("ALTER TABLE invoice_item_taxes_new RENAME TO invoice_item_taxes");
    await run("CREATE INDEX IF NOT EXISTS idx_invoice_item_taxes_invoiceItemId ON invoice_item_taxes(invoiceItemId)");
    console.log("✅ Invoice item taxes table migrated");

    // ========================================
    // 15. NEW: PAYMENTS TABLE
    // ========================================
    console.log("📋 Creating payments table...");
    
    await run(`
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
    await run("CREATE INDEX IF NOT EXISTS idx_payments_invoiceId ON payments(invoiceId)");
    await run("CREATE INDEX IF NOT EXISTS idx_payments_customerId ON payments(customerId)");
    await run("CREATE INDEX IF NOT EXISTS idx_payments_paymentDate ON payments(paymentDate)");
    await run("CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)");
    console.log("✅ Payments table created");

    // ========================================
    // 16. NEW: QUOTATIONS TABLE
    // ========================================
    console.log("📋 Creating quotations table...");
    
    await run(`
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
    await run("CREATE INDEX IF NOT EXISTS idx_quotations_subscriptionId ON quotations(subscriptionId)");
    await run("CREATE INDEX IF NOT EXISTS idx_quotations_customerId ON quotations(customerId)");
    await run("CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status)");
    console.log("✅ Quotations table created");

    // ========================================
    // 17. NEW: QUOTATION ITEMS TABLE
    // ========================================
    console.log("📋 Creating quotation_items table...");
    
    await run(`
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
    await run("CREATE INDEX IF NOT EXISTS idx_quotation_items_quotationId ON quotation_items(quotationId)");
    console.log("✅ Quotation items table created");

    // ========================================
    // 18. NEW: QUOTATION TEMPLATES TABLE
    // ========================================
    console.log("📋 Creating quotation_templates table...");
    
    await run(`
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
    console.log("✅ Quotation templates table created");

    // ========================================
    // 19. NEW: QUOTATION TEMPLATE ITEMS TABLE
    // ========================================
    console.log("📋 Creating quotation_template_items table...");
    
    await run(`
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
    await run("CREATE INDEX IF NOT EXISTS idx_quotation_template_items_templateId ON quotation_template_items(templateId)");
    console.log("✅ Quotation template items table created");

    // ========================================
    // 20. CART TABLE (normalized)
    // ========================================
    console.log("📋 Migrating cart table...");
    console.log("⚠️  WARNING: Removing denormalized columns from cart");
    
    await run(`
      CREATE TABLE IF NOT EXISTS cart_new (
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

    const cartExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='cart'");
    if (cartExists) {
      await run(`
        INSERT INTO cart_new (id, userId, productId, planId, variantId, quantity, createdAt)
        SELECT c.id, c.userId, c.productId, c.planId, c.variantId, COALESCE(c.quantity, 1), c.createdAt
        FROM cart c
        INNER JOIN users u ON c.userId = u.id
        INNER JOIN products p ON c.productId = p.id
      `);
      await run("DROP TABLE cart");
    }
    await run("ALTER TABLE cart_new RENAME TO cart");
    await run("CREATE INDEX IF NOT EXISTS idx_cart_userId ON cart(userId)");
    await run("CREATE INDEX IF NOT EXISTS idx_cart_productId ON cart(productId)");
    console.log("✅ Cart table migrated");

    // ========================================
    // 21. NEW: ACTIVITY LOG TABLE
    // ========================================
    console.log("📋 Creating activity_log table...");
    
    await run(`
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
    await run("CREATE INDEX IF NOT EXISTS idx_activity_log_userId ON activity_log(userId)");
    await run("CREATE INDEX IF NOT EXISTS idx_activity_log_entityType ON activity_log(entityType, entityId)");
    await run("CREATE INDEX IF NOT EXISTS idx_activity_log_createdAt ON activity_log(createdAt)");
    console.log("✅ Activity log table created");

    // ========================================
    // 22. NEW: PAYMENT TERMS TABLE
    // ========================================
    console.log("📋 Creating payment_terms table...");
    
    await run(`
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

    // Insert default payment terms
    await run(`INSERT OR IGNORE INTO payment_terms (termName, dueDays, description, isDefault) VALUES ('Due on Receipt', 0, 'Payment due immediately upon receipt', 1)`);
    await run(`INSERT OR IGNORE INTO payment_terms (termName, dueDays, description) VALUES ('Net 7', 7, 'Payment due within 7 days')`);
    await run(`INSERT OR IGNORE INTO payment_terms (termName, dueDays, description) VALUES ('Net 15', 15, 'Payment due within 15 days')`);
    await run(`INSERT OR IGNORE INTO payment_terms (termName, dueDays, description) VALUES ('Net 30', 30, 'Payment due within 30 days')`);
    await run(`INSERT OR IGNORE INTO payment_terms (termName, dueDays, description) VALUES ('Net 45', 45, 'Payment due within 45 days')`);
    await run(`INSERT OR IGNORE INTO payment_terms (termName, dueDays, description) VALUES ('Net 60', 60, 'Payment due within 60 days')`);
    console.log("✅ Payment terms table created with defaults");

    // ========================================
    // ENABLE FOREIGN KEYS
    // ========================================
    await run("PRAGMA foreign_keys = ON");
    
    // Verify foreign keys are enabled
    const fkStatus = await get("PRAGMA foreign_keys");
    console.log(`\n🔐 Foreign keys enabled: ${fkStatus.foreign_keys === 1 ? 'YES' : 'NO'}`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log("\n" + "=".repeat(50));
    console.log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(50));
    console.log("\n📋 Summary of changes:");
    console.log("  • Added indexes on frequently queried columns");
    console.log("  • Enabled ON DELETE CASCADE on foreign keys");
    console.log("  • Changed users.phone from INTEGER to TEXT");
    console.log("  • Changed subscriptions.customerName to customerId");
    console.log("  • Removed denormalized columns from cart table");
    console.log("  • Added dueDate, paidAt, amountPaid to invoices");
    console.log("  • Created invoice_items table");
    console.log("  • Created payments table");
    console.log("  • Created quotations + quotation_items tables");
    console.log("  • Created quotation_templates + items tables");
    console.log("  • Created activity_log table");
    console.log("  • Created payment_terms table with defaults");
    console.log("  • Added CHECK constraints for status fields");
    console.log("  • Added createdAt/updatedAt timestamps");
    console.log(`\n📦 Backup saved to: ${BACKUP_PATH}`);
    console.log("\n⚠️  IMPORTANT: Update your controllers to handle these changes!");
    console.log("   See the breaking changes section in the migration script.\n");

  } catch (error) {
    console.error("\n❌ MIGRATION FAILED:", error.message);
    console.error("Stack:", error.stack);
    console.log(`\n🔄 To restore, copy the backup: cp "${BACKUP_PATH}" "${DB_PATH}"`);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) console.error("Error closing database:", err);
      else console.log("Database connection closed.");
    });
  }
}

migrate();
