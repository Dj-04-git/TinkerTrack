const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(
  path.join(__dirname, "../database.sqlite"),
  (err) => {
    if (err) console.error(err.message);
    else console.log("SQLite connected");
  }
);

// CREATE TABLES
db.serialize(() => {
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
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriptionNumber TEXT UNIQUE,
      customerName TEXT,
      planId INTEGER,
      startDate TEXT,
      endDate TEXT,
      paymentTerms TEXT,
      status TEXT DEFAULT 'Draft'
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
});

module.exports = db;
