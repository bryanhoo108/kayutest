import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, createStore } from './db.js';
import { createApp } from './app.js';

let server;
let base;
let cookie = '';

async function call(method, path, body, { auth = false } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

before(async () => {
  process.env.STAFF_PIN = '4321';
  const store = createStore(openDb(':memory:'));
  const { app } = createApp(store, { orderRateLimit: 1000 });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.closeAllConnections(); server.close(); });

test('menu has the 12 drinks at the agreed prices', async () => {
  const { data } = await call('GET', '/api/menu');
  assert.equal(data.items.length, 12);
  const price = (id) => data.items.find((i) => i.id === id).price;
  assert.equal(price('classic-iced-americano'), 600);
  for (const id of ['grapefruit-iced-americano', 'orange-iced-americano', 'cola-iced-americano', 'quicksand-iced-americano']) assert.equal(price(id), 800, id);
  assert.equal(price('brickmovers-iced-latte'), 800);
  for (const id of ['raw-coconut-iced-latte', 'wheatgrass-iced-latte', 'strawberry-iced-latte', 'mocha-iced-latte', 'oat-iced-latte']) assert.equal(price(id), 1000, id);
  assert.equal(price('blue-sea-goldfish-soda'), 1000);
});

test('customer order: server computes price, numbers increase, always takeaway', async () => {
  const r = await call('POST', '/api/orders', {
    type: 'dine_in', tableNo: '9', customerName: '  Mei  Ling ', note: 'hi',
    items: [
      { itemId: 'classic-iced-americano', qty: 2, options: { ice: 'less', sugar: 'none' }, price: 1 },
      { itemId: 'blue-sea-goldfish-soda', qty: 1 },
    ],
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.total, 2200);
  assert.equal(r.data.number, 1);
  assert.equal(r.data.type, 'takeaway');
  assert.equal(r.data.tableNo, null);
  assert.equal(r.data.customerName, 'Mei Ling');
  assert.equal(r.data.status, 'new');
  assert.equal(r.data.paymentStatus, 'unpaid');
  assert.equal(r.data.id, undefined, 'internal id is not exposed to customers');
  const ice = r.data.items[0].options.find((o) => o.group === 'ice');
  assert.equal(ice.choice, 'less');
  assert.equal(ice.isDefault, false);

  const r2 = await call('POST', '/api/orders', { customerName: 'Ali', items: [{ itemId: 'oat-iced-latte', qty: 1 }] });
  assert.equal(r2.data.number, 2);
  const view = await call('GET', `/api/orders/${r.data.token}`);
  assert.equal(view.data.number, 1);
});

test('order validation', async () => {
  assert.equal((await call('POST', '/api/orders', { customerName: 'A', items: [] })).status, 400);
  assert.equal((await call('POST', '/api/orders', { customerName: '', items: [{ itemId: 'oat-iced-latte', qty: 1 }] })).status, 400);
  assert.equal((await call('POST', '/api/orders', { customerName: 'A', items: [{ itemId: 'nope', qty: 1 }] })).status, 400);
  assert.equal((await call('POST', '/api/orders', { customerName: 'A', items: [{ itemId: 'oat-iced-latte', qty: 0 }] })).status, 400);
  assert.equal((await call('POST', '/api/orders', { customerName: 'A', items: [{ itemId: 'oat-iced-latte', qty: 1.5 }] })).status, 400);
  assert.equal((await call('POST', '/api/orders', { customerName: 'A', items: [{ itemId: 'oat-iced-latte', qty: 1, options: { ice: 'lava' } }] })).status, 400);
  assert.equal((await call('GET', '/api/orders/doesnotexist')).status, 404);
});

test('staff endpoints need the PIN', async () => {
  assert.equal((await call('GET', '/api/staff/board')).status, 401);
  assert.equal((await call('POST', '/api/staff/login', { pin: '0000' })).status, 401);
  const ok = await call('POST', '/api/staff/login', { pin: '4321' });
  assert.equal(ok.status, 200);
  cookie = ok.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('GET', '/api/staff/board', null, { auth: true })).status, 200);
  assert.equal((await call('GET', '/api/staff/board', null, { auth: false })).status, 401);
  // tampered cookie
  const bad = cookie.slice(0, -2) + 'xx';
  const res = await fetch(`${base}/api/staff/board`, { headers: { Cookie: bad } });
  assert.equal(res.status, 401);
});

test('full barista flow: start → ready → pay → collect, with guarded transitions', async () => {
  const { data: board } = await call('GET', '/api/staff/board', null, { auth: true });
  const o = board.orders.find((x) => x.number === 1);
  assert.ok(o);
  assert.equal((await call('POST', `/api/staff/orders/${o.id}/status`, { status: 'completed' }, { auth: true })).status, 409, 'cannot skip from new to completed');
  let r = await call('POST', `/api/staff/orders/${o.id}/status`, { status: 'preparing' }, { auth: true });
  assert.equal(r.data.status, 'preparing');
  assert.ok(r.data.acceptedAt);
  r = await call('POST', `/api/staff/orders/${o.id}/lines/${o.items[0].id}`, { done: true }, { auth: true });
  assert.equal(r.data.items[0].done, true);
  r = await call('POST', `/api/staff/orders/${o.id}/status`, { status: 'ready' }, { auth: true });
  assert.equal(r.data.status, 'ready');
  assert.ok(r.data.items.every((l) => l.done));
  // cash less than total is rejected
  assert.equal((await call('POST', `/api/staff/orders/${o.id}/pay`, { method: 'cash', cashReceived: 1000 }, { auth: true })).status, 400);
  r = await call('POST', `/api/staff/orders/${o.id}/pay`, { method: 'cash', cashReceived: 5000 }, { auth: true });
  assert.equal(r.data.paymentStatus, 'paid');
  assert.equal(r.data.cashReceived, 5000);
  assert.equal((await call('POST', `/api/staff/orders/${o.id}/pay`, { method: 'qr' }, { auth: true })).status, 409, 'no double payment');
  r = await call('POST', `/api/staff/orders/${o.id}/status`, { status: 'completed' }, { auth: true });
  assert.equal(r.data.status, 'completed');
  const pub = await call('GET', `/api/orders/${o.token}`);
  assert.equal(pub.data.status, 'completed');
  assert.equal(pub.data.cashReceived, undefined);
});

test('walk-up order from the staff screen goes straight to preparing and can be pre-paid', async () => {
  const r = await call('POST', '/api/staff/orders', {
    items: [{ itemId: 'mocha-iced-latte', qty: 3 }], payment: { method: 'card' },
  }, { auth: true });
  assert.equal(r.status, 201);
  assert.equal(r.data.source, 'counter');
  assert.equal(r.data.status, 'preparing');
  assert.equal(r.data.paymentStatus, 'paid');
  assert.equal(r.data.total, 3000);
});

test('cancelling a paid order marks it refunded and excludes it from sales', async () => {
  const r = await call('POST', '/api/staff/orders', { items: [{ itemId: 'oat-iced-latte', qty: 1 }], payment: { method: 'qr' } }, { auth: true });
  const c = await call('POST', `/api/staff/orders/${r.data.id}/status`, { status: 'cancelled', reason: 'Wrong order' }, { auth: true });
  assert.equal(c.data.status, 'cancelled');
  assert.equal(c.data.paymentStatus, 'refunded');
  assert.equal(c.data.cancelReason, 'Wrong order');
  assert.equal((await call('POST', `/api/staff/orders/${r.data.id}/status`, { status: 'preparing' }, { auth: true })).status, 409);
});

test('sold-out items cannot be ordered, and the report adds up', async () => {
  await call('PATCH', '/api/staff/items/wheatgrass-iced-latte', { available: false }, { auth: true });
  const r = await call('POST', '/api/orders', { customerName: 'B', items: [{ itemId: 'wheatgrass-iced-latte', qty: 1 }] });
  assert.equal(r.status, 409);
  const { data } = await call('GET', '/api/staff/reports', null, { auth: true });
  // orders: #1 2200 (paid cash), #2 1000 (unpaid), mocha 3000 (card) ; cancelled one excluded
  assert.equal(data.orders, 3);
  assert.equal(data.grossSales, 6200);
  assert.equal(data.collected, 5200);
  assert.equal(data.outstanding, 1000);
  assert.equal(data.cancelled, 1);
  assert.equal(data.byMethod.cash.amount, 2200);
  assert.equal(data.byMethod.card.amount, 3000);
  assert.equal(data.byMethod.qr.amount, 0);
  assert.equal(data.items[0].itemId, 'mocha-iced-latte');
  const csv = await call('GET', '/api/staff/export.csv', null, { auth: true });
  assert.match(csv.data, /Mei Ling/);
});

test('price edits apply to new orders only', async () => {
  await call('PATCH', '/api/staff/items/classic-iced-americano', { price: 650 }, { auth: true });
  const r = await call('POST', '/api/orders', { customerName: 'C', items: [{ itemId: 'classic-iced-americano', qty: 1 }] });
  assert.equal(r.data.total, 650);
  const first = (await call('GET', '/api/staff/orders?status=all', null, { auth: true })).data.orders.find((o) => o.number === 1);
  assert.equal(first.total, 2200);
  assert.equal((await call('PATCH', '/api/staff/items/classic-iced-americano', { price: -5 }, { auth: true })).status, 400);
});

test('closing the store blocks QR orders but not walk-up orders', async () => {
  await call('PATCH', '/api/staff/settings', { open: false }, { auth: true });
  assert.equal((await call('POST', '/api/orders', { customerName: 'D', items: [{ itemId: 'oat-iced-latte', qty: 1 }] })).status, 409);
  assert.equal((await call('POST', '/api/staff/orders', { items: [{ itemId: 'oat-iced-latte', qty: 1 }] }, { auth: true })).status, 201);
  await call('PATCH', '/api/staff/settings', { open: true }, { auth: true });
});

test('order rate limit kicks in', async () => {
  const store = createStore(openDb(':memory:'));
  const { app } = createApp(store, { orderRateLimit: 2 });
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}/api/orders`;
  const post = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: 'X', items: [{ itemId: 'oat-iced-latte', qty: 1 }] }) });
  assert.equal((await post()).status, 201);
  assert.equal((await post()).status, 201);
  assert.equal((await post()).status, 429);
  srv.closeAllConnections();
  srv.close();
});

test('PIN change', async () => {
  assert.equal((await call('POST', '/api/staff/pin', { current: '1111', next: '5555' }, { auth: true })).status, 403);
  assert.equal((await call('POST', '/api/staff/pin', { current: '4321', next: '12' }, { auth: true })).status, 400);
  assert.equal((await call('POST', '/api/staff/pin', { current: '4321', next: '5555' }, { auth: true })).status, 200);
  assert.equal((await call('POST', '/api/staff/login', { pin: '5555' })).status, 200);
});

test('live stream delivers order updates to the customer who placed it', async () => {
  const r = await call('POST', '/api/orders', { customerName: 'E', items: [{ itemId: 'oat-iced-latte', qty: 1 }] });
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/stream?orders=${r.data.token}`, { signal: ctrl.signal });
  const reader = res.body.getReader();
  const { data: board } = await call('GET', '/api/staff/board', null, { auth: true });
  const id = board.orders.find((o) => o.token === r.data.token).id;
  await call('POST', `/api/staff/orders/${id}/status`, { status: 'preparing' }, { auth: true });
  let buf = '';
  const deadline = Date.now() + 3000;
  while (!buf.includes('"status":"preparing"') && Date.now() < deadline) {
    const { value } = await reader.read();
    buf += new TextDecoder().decode(value);
  }
  ctrl.abort();
  assert.match(buf, /event: order/);
  assert.match(buf, /"status":"preparing"/);
  assert.doesNotMatch(buf, /cashReceived/);
});
