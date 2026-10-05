require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db, ensureAdmin } = require('./db');
const { notifyOrder, notifyStatus } = require('./whatsapp');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DELIVERY = Number(process.env.DELIVERY_CHARGE ?? 30);
const FREE_ABOVE = Number(process.env.FREE_DELIVERY_ABOVE ?? 300);
const STATUSES = ['Placed', 'Confirmed', 'Out for Delivery', 'Delivered', 'Cancelled'];


ensureAdmin();
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const safeImage = v => (/^\/uploads\/[a-f0-9]+\.(png|jpg|webp)$/.test(String(v || '')) ? v : null);

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use('/api/admin/upload', express.json({ limit: '8mb' })); // photo upload (base64)
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }));

const cleanPhone = p => String(p || '').replace(/\D/g, '').slice(-10);
const sign = u => jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
const publicUser = u => ({ id: u.id, name: u.name, phone: u.phone, role: u.role });

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    const data = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(data.id);
    if (!user) throw new Error();
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in first' });
  }
}
const adminOnly = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only' });

// ---------- Auth ----------
app.post('/api/auth/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = cleanPhone(req.body.phone);
  const password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name' });
  if (phone.length !== 10) return res.status(400).json({ error: 'Enter a 10-digit mobile number' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (db.prepare('SELECT id FROM users WHERE phone = ?').get(phone))
    return res.status(409).json({ error: 'This number is already registered' });
  const info = db.prepare('INSERT INTO users (name, phone, password_hash) VALUES (?,?,?)')
    .run(name, phone, bcrypt.hashSync(password, 10));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ token: sign(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const phone = cleanPhone(req.body.phone);
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash))
    return res.status(401).json({ error: 'Incorrect mobile number or password' });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- Products ----------
app.get('/api/config', (req, res) =>
  res.json({ store: process.env.STORE_NAME || 'FreshSabji', delivery: DELIVERY, freeAbove: FREE_ABOVE }));

app.get('/api/products', (req, res) =>
  res.json(db.prepare('SELECT * FROM products ORDER BY category, name').all()));

// ---------- Orders (customer) ----------
app.post('/api/orders', auth, async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const address = String(req.body.address || '').trim();
  const notes = String(req.body.notes || '').trim().slice(0, 300);
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty' });
  if (address.length < 8) return res.status(400).json({ error: 'Please enter your full delivery address' });

  const getP = db.prepare('SELECT * FROM products WHERE id = ?');
  const lines = [];
  for (const it of items) {
    const p = getP.get(Number(it.id));
    const qty = Number(it.qty);
    if (!p || !p.in_stock) return res.status(400).json({ error: `${p ? p.name : 'Item'} is not available` });
    if (!(qty > 0) || qty > 50) return res.status(400).json({ error: 'Invalid quantity' });
    lines.push({ product_id: p.id, name: p.name, unit: p.unit, price: p.price, qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const delivery = subtotal >= FREE_ABOVE ? 0 : DELIVERY;
  const total = subtotal + delivery;

  const create = db.transaction(() => {
    const info = db.prepare(`INSERT INTO orders (user_id, customer_name, phone, address, notes, subtotal, delivery, total)
      VALUES (?,?,?,?,?,?,?,?)`).run(req.user.id, req.user.name, req.user.phone, address, notes, subtotal, delivery, total);
    const ins = db.prepare('INSERT INTO order_items (order_id, product_id, name, unit, price, qty) VALUES (?,?,?,?,?,?)');
    lines.forEach(l => ins.run(info.lastInsertRowid, l.product_id, l.name, l.unit, l.price, l.qty));
    return info.lastInsertRowid;
  });
  const orderId = create();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  notifyOrder(order, lines); // fire and forget: WhatsApp failure should not block the order
  res.json({ order: { ...order, items: lines } });
});

function withItems(orders) {
  const q = db.prepare('SELECT name, unit, price, qty FROM order_items WHERE order_id = ?');
  return orders.map(o => ({ ...o, items: q.all(o.id) }));
}

app.get('/api/orders/mine', auth, (req, res) =>
  res.json(withItems(db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id))));

// ---------- Admin ----------
app.get('/api/admin/orders', auth, adminOnly, (req, res) =>
  res.json(withItems(db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all())));

app.patch('/api/admin/orders/:id/status', auth, adminOnly, (req, res) => {
  const status = req.body.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  notifyStatus(order);
  res.json({ ok: true });
});

app.get('/api/admin/stats', auth, adminOnly, (req, res) => {
  const s = db.prepare(`SELECT COUNT(*) orders, COALESCE(SUM(CASE WHEN status!='Cancelled' THEN total END),0) revenue,
    COALESCE(SUM(status='Placed'),0) pending FROM orders`).get();
  res.json(s);
});

app.post('/api/admin/upload', auth, adminOnly, (req, res) => {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.data || ''));
  if (!m) return res.status(400).json({ error: 'Only JPG, PNG or WEBP images are allowed' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 6 * 1024 * 1024) return res.status(400).json({ error: 'Image is too large' });
  const file = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
  res.json({ url: '/uploads/' + file });
});

app.post('/api/admin/products', auth, adminOnly, (req, res) => {
  const { name, emoji, price, unit, category, image } = req.body;
  if (!name || !(Number(price) > 0)) return res.status(400).json({ error: 'Name and price are required' });
  db.prepare('INSERT INTO products (name, emoji, price, unit, category, image) VALUES (?,?,?,?,?,?)')
    .run(name, emoji || '🥬', Number(price), unit || 'kg', category || 'Vegetables', safeImage(image));
  res.json({ ok: true });
});

app.patch('/api/admin/products/:id', auth, adminOnly, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const price = req.body.price !== undefined ? Number(req.body.price) : p.price;
  const in_stock = req.body.in_stock !== undefined ? (req.body.in_stock ? 1 : 0) : p.in_stock;
  const image = req.body.image !== undefined ? safeImage(req.body.image) : p.image;
  if (!(price > 0)) return res.status(400).json({ error: 'Invalid price' });
  db.prepare('UPDATE products SET price = ?, in_stock = ?, image = ? WHERE id = ?').run(price, in_stock, image, p.id);
  res.json({ ok: true });
});

app.delete('/api/admin/products/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Store running at http://localhost:${port}`));
