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

  
});

export default db;
