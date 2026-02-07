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
      otp TEXT,
      phone INTEGER,
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

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productName TEXT NOT NULL,
      productType TEXT,
      salesPrice REAL,
      costPrice REAL
    )
  `);

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
});

module.exports = db;
