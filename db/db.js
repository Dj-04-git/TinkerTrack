import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new sqlite3.Database(
  path.join(__dirname, "../database.sqlite"),
  () => console.log("SQLite connected")
);
// CREATE TABLES
db.serialize(() => {

  //user Table
  //phone 10 digit only
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

  //Product
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productName TEXT NOT NULL,
      productType TEXT,
      salesPrice REAL,
      costPrice REAL
    )
  `);

    //product variants
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

  // Recurring plans
  db.run(`
    CREATE TABLE IF NOT EXISTS recurring_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planName TEXT NOT NULL,
      price REAL NOT NULL,
      billingPeriod TEXT NOT NULL
    )
  `);

  //normal plans
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

  //subscription
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

  // Subscription_items
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

export default db;
