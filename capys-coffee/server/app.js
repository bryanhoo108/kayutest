import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';
import { HttpError, businessDate } from './db.js';

const COOKIE = 'capys_staff';
const SESSION_MS = 14 * 3600_000; // one long shift

/* ---------------- live updates (Server-Sent Events) ---------------- */

function createHub() {
  const clients = new Set();
  const heartbeat = setInterval(() => {
    for (const c of clients) c.res.write(': ping\n\n');
  }, 25_000);
  heartbeat.unref();

  function add(req, res, meta) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    const client = { res, ...meta };
    clients.add(client);
    req.on('close', () => clients.delete(client));
    return client;
  }
  function send(client, event, data) {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  return {
    add, send,
    each(fn) { for (const c of clients) fn(c); },
    get size() { return clients.size; },
  };
}

/* ---------------- helpers ---------------- */

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (key) => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
    h.count++;
    return h.count <= max;
  };
}

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function createApp(store, { webDist, orderRateLimit = 40 } = {}) {
  const app = express();
  const hub = createHub();
  const secret = store.getSetting('session_secret');

  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  /* ---- staff session ---- */
  const sign = (payload) => {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const mac = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${mac}`;
  };
  const verify = (token) => {
    if (!token || !token.includes('.')) return null;
    const [body, mac] = token.split('.');
    const expected = createHmac('sha256', secret).update(body).digest();
    const given = Buffer.from(mac, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
      const p = JSON.parse(Buffer.from(body, 'base64url').toString());
      return p.exp > Date.now() ? p : null;
    } catch { return null; }
  };
  const isStaff = (req) => !!verify(parseCookies(req.headers.cookie)[COOKIE]);
  const requireStaff = (req, res, next) => (isStaff(req) ? next() : res.status(401).json({ error: 'Please sign in' }));

  /* ---- broadcasting ---- */
  function broadcastOrder(order) {
    const pub = store.publicOrder(order);
    let board;
    hub.each((c) => {
      if (c.staff) hub.send(c, 'order', order);
      else {
        if (c.orders?.has(order.token)) hub.send(c, 'order', pub);
        if (c.display) hub.send(c, 'board', (board ??= store.displayBoard()));
      }
    });
  }
  function broadcastMenu() {
    const m = store.menu();
    hub.each((c) => hub.send(c, 'menu', m));
  }

  const loginLimit = rateLimiter({ windowMs: 5 * 60_000, max: 8 });
  // Generous on purpose: mobile carriers put many phones behind one shared IP (CGNAT).
  const orderLimit = rateLimiter({ windowMs: 60_000, max: orderRateLimit });

  const api = express.Router();

  /* ================= public ================= */

  api.get('/health', (req, res) => res.json({ ok: true, time: Date.now(), businessDate: businessDate() }));

  api.get('/menu', (req, res) => res.json(store.menu()));

  api.post('/orders', (req, res) => {
    if (!orderLimit(req.ip)) throw new HttpError(429, 'Too many orders from this device — please wait a minute');
    const order = store.createOrder(req.body || {}, { source: 'qr' });
    broadcastOrder(order);
    res.status(201).json(store.publicOrder(order));
  });

  api.get('/orders/:token', (req, res) => {
    const o = store.getOrderByToken(req.params.token);
    if (!o) throw new HttpError(404, 'Order not found');
    res.json(store.publicOrder(o));
  });

  api.get('/display', (req, res) => res.json(store.displayBoard()));

  api.get('/stream', (req, res) => {
    const tokens = String(req.query.orders || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
    hub.add(req, res, { staff: false, orders: new Set(tokens), display: req.query.display === '1' });
  });

  api.get('/qr', async (req, res, next) => {
    try {
      const text = String(req.query.text || '');
      if (!text || text.length > 300) throw new HttpError(400, 'Bad QR text');
      const svg = await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2A1810', light: '#FFFFFF' } });
      res.type('image/svg+xml').setHeader('Cache-Control', 'public, max-age=86400');
      res.send(svg);
    } catch (e) { next(e); }
  });

  /* ================= staff ================= */

  api.post('/staff/login', (req, res) => {
    if (!loginLimit(req.ip)) throw new HttpError(429, 'Too many attempts — try again in 5 minutes');
    const pin = String(req.body?.pin ?? '');
    if (!store.checkPin(pin)) throw new HttpError(401, 'Incorrect PIN');
    const token = sign({ exp: Date.now() + SESSION_MS });
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${req.secure ? '; Secure' : ''}`);
    res.json({ ok: true });
  });
  api.post('/staff/logout', (req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  });
  api.get('/staff/me', (req, res) => res.json({ signedIn: isStaff(req) }));

  api.use('/staff', requireStaff);

  api.get('/staff/stream', (req, res) => hub.add(req, res, { staff: true }));
  api.get('/staff/board', (req, res) => res.json({ orders: store.boardOrders(), now: Date.now() }));

  api.get('/staff/orders', (req, res) => {
    const today = businessDate();
    const from = isDate(req.query.from) ? req.query.from : today;
    const to = isDate(req.query.to) ? req.query.to : from;
    res.json({ orders: store.searchOrders({ from, to, status: req.query.status, q: req.query.q }) });
  });

  api.get('/staff/orders/:id', (req, res) => {
    const o = store.getOrder(Number(req.params.id));
    if (!o) throw new HttpError(404, 'Order not found');
    res.json(o);
  });

  api.post('/staff/orders', (req, res) => {
    const order = store.createOrder(req.body || {}, { source: 'counter' });
    broadcastOrder(order);
    res.status(201).json(order);
  });

  api.post('/staff/orders/:id/status', (req, res) => {
    const order = store.setStatus(Number(req.params.id), req.body?.status, { reason: req.body?.reason });
    broadcastOrder(order);
    res.json(order);
  });

  api.post('/staff/orders/:id/pay', (req, res) => {
    const order = store.markPaid(Number(req.params.id), req.body || {});
    broadcastOrder(order);
    res.json(order);
  });

  api.post('/staff/orders/:id/void-payment', (req, res) => {
    const order = store.voidPayment(Number(req.params.id));
    broadcastOrder(order);
    res.json(order);
  });

  api.post('/staff/orders/:id/lines/:lineId', (req, res) => {
    const order = store.setLineDone(Number(req.params.id), Number(req.params.lineId), !!req.body?.done);
    broadcastOrder(order);
    res.json(order);
  });

  api.patch('/staff/items/:id', (req, res) => {
    const item = store.updateItem(req.params.id, req.body || {});
    broadcastMenu();
    res.json(item);
  });

  api.get('/staff/settings', (req, res) => res.json(store.publicSettings()));
  api.patch('/staff/settings', (req, res) => {
    const s = store.updateSettings(req.body || {});
    broadcastMenu();
    res.json(s);
  });
  api.post('/staff/pin', (req, res) => {
    store.changePin(req.body?.current, req.body?.next);
    res.json({ ok: true });
  });

  api.get('/staff/reports', (req, res) => {
    const today = businessDate();
    const from = isDate(req.query.from) ? req.query.from : today;
    const to = isDate(req.query.to) ? req.query.to : from;
    if (from > to) throw new HttpError(400, 'Start date is after end date');
    res.json(store.report({ from, to }));
  });

  api.get('/staff/export.csv', (req, res) => {
    const today = businessDate();
    const from = isDate(req.query.from) ? req.query.from : today;
    const to = isDate(req.query.to) ? req.query.to : from;
    const orders = store.searchOrders({ from, to, limit: 1000 }).reverse();
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rm = (sen) => (sen / 100).toFixed(2);
    const rows = [['Date', 'Order', 'Time', 'Source', 'Customer', 'Items', 'Total (RM)', 'Status', 'Payment', 'Method']];
    for (const o of orders) {
      rows.push([
        o.businessDate, `#${o.number}`, new Date(o.createdAt).toLocaleTimeString('en-GB', { timeZone: store.publicSettings().timeZone }),
        o.source === 'qr' ? 'QR' : 'Counter', o.customerName,
        o.items.map((i) => `${i.qty}x ${i.name}`).join('; '), rm(o.total), o.status, o.paymentStatus, o.paymentMethod || '',
      ]);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="capys-orders-${from}_to_${to}.csv"`);
    res.send('﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'));
  });

  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  /* ---- web app ---- */
  if (webDist && existsSync(join(webDist, 'index.html'))) {
    app.use(express.static(webDist, {
      index: false,
      setHeaders(res, path) {
        if (path.includes(`${join(webDist, 'assets')}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  // Errors. Express 4 only catches synchronous throws; the one async handler (/qr) passes errors to next().
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });

  return { app, hub };
}
