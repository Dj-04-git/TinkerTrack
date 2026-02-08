const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(
  path.join(__dirname, "../database.sqlite"),
  () => console.log("SQLite connected")
);
// CREATE TABLES
db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      phone INTEGER CHECK(length(phone) = 10),
      location TEXT,
      about TEXT,
      isVerified INTEGER DEFAULT 0
    )
  `);

  db.all("PRAGMA table_info(users)", (err, columns) => {
    if (err || !Array.isArray(columns)) {
      return;
    }

    const hasIsAdmin = columns.some((column) => column.name === "isAdmin");
    if (!hasIsAdmin) {
      db.run("ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0");
    }
  });



    //(temporary storage)
    db.run(`
      CREATE TABLE IF NOT EXISTS otp_verification (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        otp TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME
      )
    `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productName TEXT NOT NULL,
      productType TEXT,
      salesPrice REAL,
      costPrice REAL,
      tax REAL DEFAULT 0
    )
  `);

  // Add tax column if it doesn't exist (for existing databases)
  db.all("PRAGMA table_info(products)", (err, columns) => {
    if (err || !Array.isArray(columns)) {
      return;
    }
    const hasTax = columns.some((column) => column.name === "tax");
    if (!hasTax) {
      db.run("ALTER TABLE products ADD COLUMN tax REAL DEFAULT 0");
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER,
      attribute TEXT,
      value TEXT,
      extraPrice REAL,
      FOREIGN KEY (productId) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recurring_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planName TEXT NOT NULL,
      price REAL NOT NULL,
      billingPeriod TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS product_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER,
      planId INTEGER,
      UNIQUE(productId, planId),
      FOREIGN KEY (productId) REFERENCES products(id),
      FOREIGN KEY (planId) REFERENCES recurring_plans(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discountName TEXT NOT NULL,
      type TEXT CHECK(type IN ('FIXED', 'PERCENTAGE')) NOT NULL,
      value REAL NOT NULL,
      minimumPurchase REAL DEFAULT 0,
      minimumQuantity INTEGER DEFAULT 0,
      startDate DATE,
      endDate DATE,
      limitUsage INTEGER,
      usedCount INTEGER DEFAULT 0,
      appliesTo TEXT CHECK(appliesTo IN ('PRODUCT', 'SUBSCRIPTION')) NOT NULL,
      productId INTEGER,
      subscriptionId INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taxName TEXT NOT NULL,
      taxType TEXT CHECK(taxType IN ('PERCENTAGE', 'FIXED')) NOT NULL,
      rate REAL NOT NULL,
      isActive INTEGER DEFAULT 1
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_item_taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceItemId INTEGER,
      taxId INTEGER,
      taxAmount REAL,
      FOREIGN KEY (invoiceItemId) REFERENCES invoice_items(id),
      FOREIGN KEY (taxId) REFERENCES taxes(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS product_taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      taxId INTEGER NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id),
      FOREIGN KEY (taxId) REFERENCES taxes(id),
      UNIQUE(productId, taxId)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNumber TEXT UNIQUE,
      customerId INTEGER,
      subscriptionId INTEGER,
      status TEXT DEFAULT 'DRAFT',
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriptionNumber TEXT UNIQUE,
      customerName TEXT,
      planId INTEGER,
      startDate TEXT,
      endDate TEXT,
      paymentTerms TEXT,
      discountCode TEXT,
      discountAmount REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'Draft',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subscription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriptionId INTEGER,
      productId INTEGER,
      quantity INTEGER,
      unitPrice REAL,
      tax REAL,
      amount REAL,
      FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      productId INTEGER,
      productName TEXT,
      planId INTEGER,
      planName TEXT,
      variantId INTEGER,
      variantName TEXT,
      price REAL,
      billingPeriod TEXT,
      quantity INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (productId) REFERENCES products(id),
      FOREIGN KEY (planId) REFERENCES recurring_plans(id),
      FOREIGN KEY (variantId) REFERENCES product_variants(id)
    )
  `);
});

module.exports = db;