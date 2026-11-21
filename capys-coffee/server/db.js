import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { CATEGORIES, ITEMS, OPTION_GROUPS } from './menu.js';

export const TIME_ZONE = process.env.STORE_TZ || 'Asia/Kuala_Lumpur';

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });

/** 'YYYY-MM-DD' of the given instant in the store's time zone. */
export function businessDate(ms = Date.now()) {
  return dateFmt.format(new Date(ms));
}
export function businessHour(ms) {
  return Number(hourFmt.format(new Date(ms)));
}

export const STATUSES = ['new', 'preparing', 'ready', 'completed', 'cancelled'];
export const PAYMENT_METHODS = ['cash', 'qr', 'card'];

// Allowed status moves. Moving back one step is allowed so mis-taps can be undone.
const TRANSITIONS = {
  new: ['preparing', 'cancelled'],
  preparing: ['ready', 'new', 'cancelled'],
  ready: ['completed', 'preparing', 'cancelled'],
  completed: ['ready'],
  cancelled: [],
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function hashPin(pin) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPin(pin, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(String(pin), salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function openDb(file = process.env.DB_FILE || 'data/capys.db') {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, name_zh TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      number INTEGER,
      name TEXT NOT NULL,
      name_zh TEXT NOT NULL DEFAULT '',
      tagline TEXT NOT NULL DEFAULT '',
      tagline_zh TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      description_zh TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL CHECK (price >= 0),
      art TEXT NOT NULL DEFAULT '{}',
      options TEXT NOT NULL DEFAULT '["ice","sugar"]',
      available INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      number INTEGER NOT NULL,
      business_date TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('qr','counter')),
      type TEXT NOT NULL CHECK (type IN ('dine_in','takeaway')),
      table_no TEXT,
      customer_name TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT,
      cash_received INTEGER,
      total INTEGER NOT NULL,
      item_count INTEGER NOT NULL,
      cancel_reason TEXT,
      created_at INTEGER NOT NULL,
      accepted_at INTEGER,
      ready_at INTEGER,
      completed_at INTEGER,
      cancelled_at INTEGER,
      paid_at INTEGER,
      updated_at INTEGER NOT NULL,
      UNIQUE (business_date, number)
    );
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(business_date);

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_zh TEXT NOT NULL DEFAULT '',
      unit_price INTEGER NOT NULL,
      qty INTEGER NOT NULL CHECK (qty > 0),
      options TEXT NOT NULL DEFAULT '[]',
      note TEXT NOT NULL DEFAULT '',
      line_total INTEGER NOT NULL,
      done INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `);
  seed(db);
  return db;
}

function seed(db) {
  const has = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  if (!has) {
    const insCat = db.prepare('INSERT INTO categories (id, name, name_zh, sort) VALUES (?, ?, ?, ?)');
    const insItem = db.prepare(`INSERT INTO items
      (id, category_id, number, name, name_zh, tagline, tagline_zh, description, description_zh, price, art, available, featured, sort)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`);
    db.exec('BEGIN');
    try {
      for (const c of CATEGORIES) insCat.run(c.id, c.name, c.name_zh, c.sort);
      ITEMS.forEach((i, idx) => insItem.run(i.id, i.category_id, i.number, i.name, i.name_zh, i.tagline, i.tagline_zh,
        i.description, i.description_zh, i.price, JSON.stringify(i.art), i.featured, idx));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  const defaults = {
    store_name: "Capy's Coffee",
    store_open: '1',
    auto_accept: '0',
    session_secret: randomBytes(32).toString('hex'),
    pin_hash: hashPin(process.env.STAFF_PIN || '1234'),
  };
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);
}

/* ------------------------------------------------------------------ */

export function createStore(db) {
  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };

  const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value;
  const setSetting = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, String(v));

  function publicSettings() {
    return {
      name: getSetting('store_name'),
      open: getSetting('store_open') === '1',
      autoAccept: getSetting('auto_accept') === '1',
      publicUrl: getSetting('public_url') || '',
      timeZone: TIME_ZONE,
    };
  }

  function rowToItem(r) {
    return {
      id: r.id, categoryId: r.category_id, number: r.number,
      name: r.name, nameZh: r.name_zh, tagline: r.tagline, taglineZh: r.tagline_zh,
      description: r.description, descriptionZh: r.description_zh,
      price: r.price, art: JSON.parse(r.art || '{}'), options: JSON.parse(r.options || '[]'),
      available: !!r.available, featured: !!r.featured, sort: r.sort,
    };
  }

  function menu() {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort, name').all()
      .map((c) => ({ id: c.id, name: c.name, nameZh: c.name_zh, sort: c.sort }));
    const items = db.prepare('SELECT * FROM items WHERE active = 1 ORDER BY sort, name').all().map(rowToItem);
    const optionGroups = OPTION_GROUPS.map((g) => ({
      id: g.id, name: g.name, nameZh: g.name_zh, default: g.default,
      choices: g.choices.map((c) => ({ id: c.id, name: c.name, nameZh: c.name_zh })),
    }));
    return { store: publicSettings(), categories, items, optionGroups };
  }

  function getItem(id) {
    const r = db.prepare('SELECT * FROM items WHERE id = ? AND active = 1').get(id);
    return r ? rowToItem(r) : null;
  }

  function updateItem(id, patch) {
    const item = getItem(id);
    if (!item) throw new HttpError(404, 'Item not found');
    const sets = [];
    const vals = [];
    const str = (v, max) => String(v ?? '').trim().slice(0, max);
    if ('available' in patch) { sets.push('available = ?'); vals.push(patch.available ? 1 : 0); }
    if ('featured' in patch) { sets.push('featured = ?'); vals.push(patch.featured ? 1 : 0); }
    if ('price' in patch) {
      const p = Number(patch.price);
      if (!Number.isInteger(p) || p < 0 || p > 100000) throw new HttpError(400, 'Price must be between RM 0.00 and RM 1,000.00');
      sets.push('price = ?'); vals.push(p);
    }
    if ('name' in patch) {
      const n = str(patch.name, 60);
      if (!n) throw new HttpError(400, 'Name is required');
      sets.push('name = ?'); vals.push(n);
    }
    for (const [key, col, max] of [['nameZh', 'name_zh', 30], ['tagline', 'tagline', 40], ['taglineZh', 'tagline_zh', 30], ['description', 'description', 240], ['descriptionZh', 'description_zh', 120]]) {
      if (key in patch) { sets.push(`${col} = ?`); vals.push(str(patch[key], max)); }
    }
    if ('categoryId' in patch) {
      if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(patch.categoryId)) throw new HttpError(400, 'Unknown category');
      sets.push('category_id = ?'); vals.push(patch.categoryId);
    }
    if (!sets.length) return item;
    db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    return getItem(id);
  }

  /* ---------------- orders ---------------- */

  function loadItems(orderIds) {
    if (!orderIds.length) return new Map();
    const rows = db.prepare(`SELECT * FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')}) ORDER BY id`).all(...orderIds);
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.order_id)) map.set(r.order_id, []);
      map.get(r.order_id).push({
        id: r.id, itemId: r.item_id, name: r.name, nameZh: r.name_zh, unitPrice: r.unit_price,
        qty: r.qty, options: JSON.parse(r.options), note: r.note, lineTotal: r.line_total, done: !!r.done,
      });
    }
    return map;
  }

  function rowToOrder(r, items) {
    return {
      id: r.id, token: r.token, number: r.number, businessDate: r.business_date,
      source: r.source, type: r.type, tableNo: r.table_no, customerName: r.customer_name, note: r.note,
      status: r.status, paymentStatus: r.payment_status, paymentMethod: r.payment_method, cashReceived: r.cash_received,
      total: r.total, itemCount: r.item_count, cancelReason: r.cancel_reason,
      createdAt: r.created_at, acceptedAt: r.accepted_at, readyAt: r.ready_at, completedAt: r.completed_at,
      cancelledAt: r.cancelled_at, paidAt: r.paid_at, updatedAt: r.updated_at,
      items: items || [],
    };
  }

  function hydrate(rows) {
    const items = loadItems(rows.map((r) => r.id));
    return rows.map((r) => rowToOrder(r, items.get(r.id)));
  }

  function getOrder(id) {
    const r = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    return r ? hydrate([r])[0] : null;
  }
  function getOrderByToken(token) {
    const r = db.prepare('SELECT * FROM orders WHERE token = ?').get(String(token));
    return r ? hydrate([r])[0] : null;
  }

  /** The view of an order a customer is allowed to see. */
  function publicOrder(o) {
    if (!o) return null;
    const { id, cashReceived, ...rest } = o;
    return { ...rest, items: o.items.map(({ id: _i, done: _d, ...it }) => it) };
  }

  function validateLines(rawItems) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) throw new HttpError(400, 'Your cart is empty');
    if (rawItems.length > 30) throw new HttpError(400, 'Too many lines in one order');
    const groups = new Map(OPTION_GROUPS.map((g) => [g.id, g]));
    const lines = [];
    let qtyTotal = 0;
    for (const raw of rawItems) {
      const item = getItem(raw?.itemId);
      if (!item) throw new HttpError(400, 'An item in your cart is no longer on the menu');
      if (!item.available) throw new HttpError(409, `${item.name} is sold out`);
      const qty = Number(raw.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 50) throw new HttpError(400, 'Quantity must be between 1 and 50');
      qtyTotal += qty;
      const chosen = raw.options && typeof raw.options === 'object' ? raw.options : {};
      const options = [];
      for (const gid of item.options) {
        const g = groups.get(gid);
        if (!g) continue;
        const cid = chosen[gid] ?? g.default;
        const choice = g.choices.find((c) => c.id === cid);
        if (!choice) throw new HttpError(400, `Invalid ${g.name.toLowerCase()} for ${item.name}`);
        options.push({ group: g.id, groupName: g.name, choice: choice.id, name: choice.name, nameZh: choice.name_zh, isDefault: choice.id === g.default });
      }
      lines.push({ item, qty, options, note: String(raw.note ?? '').trim().slice(0, 140) });
    }
    if (qtyTotal > 100) throw new HttpError(400, 'Too many drinks in one order — please split it');
    return lines;
  }

  function createOrder(input, { source }) {
    const settings = publicSettings();
    if (source === 'qr' && !settings.open) throw new HttpError(409, 'Sorry, we are not taking orders right now');
    // Capy's is a coffee truck with no seating: every order is takeaway.
    const type = 'takeaway';
    const customerName = String(input.customerName ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
    if (source === 'qr' && !customerName) throw new HttpError(400, 'Please enter a name so we can call you');
    const tableNo = null;
    const note = String(input.note ?? '').trim().slice(0, 200);
    const lines = validateLines(input.items);

    let payment = null;
    if (input.payment) {
      payment = normalisePayment(input.payment, lines.reduce((s, l) => s + l.item.price * l.qty, 0));
    }

    const now = Date.now();
    const bd = businessDate(now);
    let status = 'new';
    if (source === 'counter' || settings.autoAccept) status = 'preparing';

    const id = tx(() => {
      const number = (db.prepare('SELECT MAX(number) AS m FROM orders WHERE business_date = ?').get(bd).m || 0) + 1;
      const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
      const itemCount = lines.reduce((s, l) => s + l.qty, 0);
      const token = randomBytes(12).toString('base64url');
      const res = db.prepare(`INSERT INTO orders
        (token, number, business_date, source, type, table_no, customer_name, note, status, payment_status, payment_method,
         cash_received, total, item_count, created_at, accepted_at, paid_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        token, number, bd, source, type, tableNo, customerName, note, status,
        payment ? 'paid' : 'unpaid', payment?.method ?? null, payment?.cashReceived ?? null,
        total, itemCount, now, status === 'preparing' ? now : null, payment ? now : null, now,
      );
      const orderId = Number(res.lastInsertRowid);
      const insLine = db.prepare(`INSERT INTO order_items (order_id, item_id, name, name_zh, unit_price, qty, options, note, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const l of lines) {
        insLine.run(orderId, l.item.id, l.item.name, l.item.nameZh, l.item.price, l.qty, JSON.stringify(l.options), l.note, l.item.price * l.qty);
      }
      return orderId;
    });
    return getOrder(id);
  }

  function normalisePayment(p, total) {
    const method = String(p.method || '');
    if (!PAYMENT_METHODS.includes(method)) throw new HttpError(400, 'Choose a payment method');
    let cashReceived = null;
    if (method === 'cash' && p.cashReceived != null && p.cashReceived !== '') {
      cashReceived = Number(p.cashReceived);
      if (!Number.isInteger(cashReceived) || cashReceived < 0) throw new HttpError(400, 'Invalid cash amount');
      if (cashReceived < total) throw new HttpError(400, 'Cash received is less than the total');
    }
    return { method, cashReceived };
  }

  function setStatus(id, next, { reason } = {}) {
    const o = getOrder(id);
    if (!o) throw new HttpError(404, 'Order not found');
    if (!STATUSES.includes(next)) throw new HttpError(400, 'Unknown status');
    if (o.status === next) return o;
    if (!TRANSITIONS[o.status].includes(next)) throw new HttpError(409, `Order #${o.number} is already ${o.status}`);
    const now = Date.now();
    const sets = ['status = ?', 'updated_at = ?'];
    const vals = [next, now];
    if (next === 'preparing' && !o.acceptedAt) { sets.push('accepted_at = ?'); vals.push(now); }
    if (next === 'ready') { sets.push('ready_at = ?'); vals.push(now); }
    if (next === 'completed') { sets.push('completed_at = ?'); vals.push(now); }
    if (next === 'cancelled') {
      sets.push('cancelled_at = ?', 'cancel_reason = ?');
      vals.push(now, String(reason ?? '').trim().slice(0, 120) || null);
      if (o.paymentStatus === 'paid') { sets.push("payment_status = 'refunded'"); }
    }
    if (o.status === 'completed' && next === 'ready') { sets.push('completed_at = NULL'); }
    if (o.status === 'ready' && next === 'preparing') { sets.push('ready_at = NULL'); }
    if (o.status === 'preparing' && next === 'new') { sets.push('accepted_at = NULL'); }
    db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    if (next === 'ready' || next === 'completed') db.prepare('UPDATE order_items SET done = 1 WHERE order_id = ?').run(id);
    return getOrder(id);
  }

  function markPaid(id, payment) {
    const o = getOrder(id);
    if (!o) throw new HttpError(404, 'Order not found');
    if (o.status === 'cancelled') throw new HttpError(409, 'This order was cancelled');
    if (o.paymentStatus === 'paid') throw new HttpError(409, `Order #${o.number} is already paid`);
    const p = normalisePayment(payment || {}, o.total);
    const now = Date.now();
    db.prepare("UPDATE orders SET payment_status = 'paid', payment_method = ?, cash_received = ?, paid_at = ?, updated_at = ? WHERE id = ?")
      .run(p.method, p.cashReceived, now, now, id);
    return getOrder(id);
  }

  function voidPayment(id) {
    const o = getOrder(id);
    if (!o) throw new HttpError(404, 'Order not found');
    if (o.paymentStatus !== 'paid') throw new HttpError(409, 'Order is not paid');
    db.prepare("UPDATE orders SET payment_status = 'unpaid', payment_method = NULL, cash_received = NULL, paid_at = NULL, updated_at = ? WHERE id = ?")
      .run(Date.now(), id);
    return getOrder(id);
  }

  function setLineDone(orderId, lineId, done) {
    const o = getOrder(orderId);
    if (!o) throw new HttpError(404, 'Order not found');
    const res = db.prepare('UPDATE order_items SET done = ? WHERE id = ? AND order_id = ?').run(done ? 1 : 0, lineId, orderId);
    if (!res.changes) throw new HttpError(404, 'Line not found');
    db.prepare('UPDATE orders SET updated_at = ? WHERE id = ?').run(Date.now(), orderId);
    return getOrder(orderId);
  }

  /** Active orders plus anything completed/cancelled in the last 3 hours (for recall). */
  function boardOrders() {
    const since = Date.now() - 3 * 3600_000;
    const rows = db.prepare(`SELECT * FROM orders
      WHERE status IN ('new','preparing','ready')
         OR (status = 'completed' AND completed_at >= ?)
         OR (status = 'cancelled' AND cancelled_at >= ?)
      ORDER BY created_at`).all(since, since);
    return hydrate(rows);
  }

  function displayBoard() {
    const since = Date.now() - 15 * 60_000;
    const rows = db.prepare(`SELECT number, status, customer_name, ready_at FROM orders
      WHERE business_date = ? AND (status IN ('new','preparing') OR (status = 'ready'))
      ORDER BY number`).all(businessDate());
    return {
      preparing: rows.filter((r) => r.status !== 'ready').map((r) => ({ number: r.number, name: firstName(r.customer_name) })),
      ready: rows.filter((r) => r.status === 'ready').sort((a, b) => b.ready_at - a.ready_at)
        .map((r) => ({ number: r.number, name: firstName(r.customer_name), readyAt: r.ready_at })),
      since,
    };
  }
  const firstName = (n) => String(n || '').split(' ')[0].slice(0, 12);

  function searchOrders({ from, to, status, q, limit = 300 }) {
    const where = ['business_date BETWEEN ? AND ?'];
    const vals = [from, to];
    if (status && status !== 'all') {
      if (status === 'unpaid') where.push("payment_status = 'unpaid' AND status != 'cancelled'");
      else { where.push('status = ?'); vals.push(status); }
    }
    if (q) {
      const s = String(q).trim().replace(/^#/, '');
      if (/^\d+$/.test(s)) { where.push('number = ?'); vals.push(Number(s)); } else { where.push('customer_name LIKE ?'); vals.push(`%${s}%`); }
    }
    const rows = db.prepare(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...vals, Math.min(1000, limit));
    return hydrate(rows);
  }

  function report({ from, to }) {
    const orders = db.prepare('SELECT * FROM orders WHERE business_date BETWEEN ? AND ?').all(from, to);
    const valid = orders.filter((o) => o.status !== 'cancelled');
    const paid = valid.filter((o) => o.payment_status === 'paid');
    const sum = (arr) => arr.reduce((s, o) => s + o.total, 0);
    const byMethod = {};
    for (const m of PAYMENT_METHODS) byMethod[m] = { count: 0, amount: 0 };
    for (const o of paid) { byMethod[o.payment_method].count++; byMethod[o.payment_method].amount += o.total; }
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, amount: 0 }));
    for (const o of valid) { const h = businessHour(o.created_at); byHour[h].orders++; byHour[h].amount += o.total; }
    const byDay = new Map();
    for (const o of valid) {
      const d = byDay.get(o.business_date) || { date: o.business_date, orders: 0, amount: 0 };
      d.orders++; d.amount += o.total; byDay.set(o.business_date, d);
    }
    const lines = db.prepare(`SELECT oi.item_id, oi.name, SUM(oi.qty) AS qty, SUM(oi.line_total) AS amount
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.business_date BETWEEN ? AND ? AND o.status != 'cancelled'
      GROUP BY oi.item_id ORDER BY qty DESC, amount DESC`).all(from, to);
    const prepTimes = valid.filter((o) => o.ready_at && o.created_at).map((o) => o.ready_at - o.created_at).sort((a, b) => a - b);
    return {
      from, to,
      grossSales: sum(valid),
      collected: sum(paid),
      outstanding: sum(valid.filter((o) => o.payment_status !== 'paid')),
      orders: valid.length,
      cancelled: orders.length - valid.length,
      unpaidOrders: valid.filter((o) => o.payment_status !== 'paid').length,
      drinks: valid.reduce((s, o) => s + o.item_count, 0),
      avgTicket: valid.length ? Math.round(sum(valid) / valid.length) : 0,
      medianPrepMs: prepTimes.length ? prepTimes[Math.floor(prepTimes.length / 2)] : null,
      bySource: {
        qr: valid.filter((o) => o.source === 'qr').length,
        counter: valid.filter((o) => o.source === 'counter').length,
      },
      byMethod,
      byHour,
      byDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      items: lines.map((l) => ({ itemId: l.item_id, name: l.name, qty: l.qty, amount: l.amount })),
    };
  }

  function updateSettings(patch) {
    if ('open' in patch) setSetting('store_open', patch.open ? '1' : '0');
    if ('autoAccept' in patch) setSetting('auto_accept', patch.autoAccept ? '1' : '0');
    if ('publicUrl' in patch) {
      let u = String(patch.publicUrl ?? '').trim().replace(/\/+$/, '');
      if (u) {
        let parsed;
        try { parsed = new URL(u); } catch { throw new HttpError(400, 'Enter a full web address, e.g. https://order.capys.my'); }
        if (!/^https?:$/.test(parsed.protocol) || u.length > 200) throw new HttpError(400, 'Enter a full web address, e.g. https://order.capys.my');
        u = parsed.origin + parsed.pathname.replace(/\/+$/, '');
      }
      setSetting('public_url', u);
    }
    if ('name' in patch) {
      const n = String(patch.name ?? '').trim().slice(0, 40);
      if (!n) throw new HttpError(400, 'Store name is required');
      setSetting('store_name', n);
    }
    return publicSettings();
  }

  function checkPin(pin) {
    return verifyPin(pin, getSetting('pin_hash'));
  }
  function changePin(current, next) {
    if (!checkPin(current)) throw new HttpError(403, 'Current PIN is incorrect');
    if (!/^\d{4,8}$/.test(String(next))) throw new HttpError(400, 'New PIN must be 4–8 digits');
    setSetting('pin_hash', hashPin(next));
  }

  return {
    db, getSetting, publicSettings, menu, getItem, updateItem,
    createOrder, getOrder, getOrderByToken, publicOrder, setStatus, markPaid, voidPayment, setLineDone,
    boardOrders, displayBoard, searchOrders, report, updateSettings, checkPin, changePin,
  };
}
