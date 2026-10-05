const { DatabaseSync } = require('node:sqlite'); // built into Node 22.5+ (no install / compile needed)
const bcrypt = require('bcryptjs');
const path = require('path');

const raw = new DatabaseSync(path.join(__dirname, 'store.db'));
raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// Small wrapper so the rest of the code can use db.prepare / db.exec / db.transaction
const db = {
  exec: sql => raw.exec(sql),
  prepare: sql => raw.prepare(sql),
  transaction: fn => (...args) => {
    raw.exec('BEGIN');
    try { const r = fn(...args); raw.exec('COMMIT'); return r; }
    catch (e) { raw.exec('ROLLBACK'); throw e; }
  }
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🥬',
  price REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  category TEXT NOT NULL DEFAULT 'Vegetables',
  in_stock INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  subtotal REAL NOT NULL,
  delivery REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Placed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price REAL NOT NULL,
  qty REAL NOT NULL
);
`);

// Add product photo column (for databases created earlier)
if (!db.prepare('PRAGMA table_info(products)').all().some(c => c.name === 'image')) {
  db.exec('ALTER TABLE products ADD COLUMN image TEXT');
}

// Payment columns on orders (for databases created earlier)
const orderCols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
[
  ['payment_method', "TEXT NOT NULL DEFAULT 'cod'"],
  ['payment_status', "TEXT NOT NULL DEFAULT 'COD'"],
  ['razorpay_order_id', 'TEXT'],
  ['razorpay_payment_id', 'TEXT']
].forEach(([name, type]) => {
  if (!orderCols.includes(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${type}`);
});

// Seed products on first run
if (db.prepare('SELECT COUNT(*) c FROM products').get().c === 0) {
  const ins = db.prepare('INSERT INTO products (name, emoji, price, unit, category) VALUES (?,?,?,?,?)');
  [
    ['Tomato', '🍅', 30, 'kg', 'Vegetables'],
    ['Potato', '🥔', 25, 'kg', 'Vegetables'],
    ['Onion', '🧅', 35, 'kg', 'Vegetables'],
    ['Carrot', '🥕', 40, 'kg', 'Vegetables'],
    ['Spinach', '🥬', 20, 'bunch', 'Leafy'],
    ['Fenugreek (Methi)', '🌿', 15, 'bunch', 'Leafy'],
    ['Green Chilli', '🌶️', 80, 'kg', 'Vegetables'],
    ['Capsicum', '🫑', 60, 'kg', 'Vegetables'],
    ['Brinjal (Eggplant)', '🍆', 35, 'kg', 'Vegetables'],
    ['Okra (Bhindi)', '🌱', 50, 'kg', 'Vegetables'],
    ['Bottle Gourd', '🥒', 30, 'kg', 'Vegetables'],
    ['Cauliflower', '🥦', 40, 'kg', 'Vegetables'],
    ['Lemon', '🍋', 10, 'pc', 'Fruits'],
    ['Banana', '🍌', 60, 'dozen', 'Fruits'],
    ['Apple', '🍎', 180, 'kg', 'Fruits'],
    ['Coriander', '🌿', 10, 'bunch', 'Leafy']
  ].forEach(p => ins.run(...p));
}

// Create admin account from .env on first run
function ensureAdmin() {
  const phone = String(process.env.ADMIN_PHONE || '9999999999').replace(/\D/g, '').slice(-10);
  if (!db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)) {
    db.prepare('INSERT INTO users (name, phone, password_hash, role) VALUES (?,?,?,?)').run(
      process.env.ADMIN_NAME || 'Shop Owner',
      phone,
      bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin12345', 10),
      'admin'
    );
    console.log(`Admin created -> phone: ${phone}`);
  }
}

module.exports = { db, ensureAdmin };
