/* ==========================================================================
   orderService.js - business rules for dine-in tabs, parcel orders, pricing,
   table sessions, alerts. Pages call these; they never write orders directly.
   PRODUCTION: move this module to the backend (same function names as API routes).
   ========================================================================== */
import { db } from './dataService.js';
import { publish } from './orderSync.js';
import { store, session, uid, todayStr, minutesSince } from './utils.js';

export const DINE_FLOW = ['placed', 'confirmed', 'served', 'completed'];
export const PARCEL_FLOW = ['placed', 'confirmed', 'ready', 'handed'];
export const flowFor = (order) => (order.type === 'parcel' ? PARCEL_FLOW : DINE_FLOW);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ---------------------------------------------------------------- items */
/** Resolve a menu item OR an active special (id 'sp01') into an orderable record */
export function resolveItem(id) {
  const m = db.get('menu', id);
  if (m) return m;
  const sp = db.get('specials', id);
  if (sp) return { id: sp.id, name: sp.title, description: sp.description, price: sp.price, image: sp.image, isVeg: !!sp.isVeg, available: sp.active !== false, categoryId: 'special', isSpecial: true };
  return null;
}

/* ---------------------------------------------------------------- pricing */
export function activeOffers(on = new Date()) {
  const d = todayStr(on);
  return db.list('offers', (o) => o.active !== false && (!o.validFrom || o.validFrom <= d) && (!o.validTo || o.validTo >= d));
}
function offerApplies(offer, item) {
  const ids = offer.itemIds || []; const cats = offer.categoryIds || [];
  if (!ids.length && !cats.length) return true;
  return ids.includes(item.id) || cats.includes(item.categoryId);
}
/**
 * priceLines([{itemId, qty, note}]) -> { items:[{itemId,name,price,qty,note,isVeg,lineTotal,lineDiscount,offerId}], subtotal, discount, tax, total, taxPct }
 * Best single offer per line. Percent = % of line, Flat = amount per unit. GST on (subtotal - discount).
 */
export function priceLines(lines) {
  const settings = db.get('settings') || {}; const offers = activeOffers();
  const taxPct = Number(settings.taxPercent ?? 5);
  const items = [];
  let subtotal = 0; let discount = 0;
  for (const l of lines) {
    const it = resolveItem(l.itemId); if (!it) continue;
    const qty = Math.max(1, Number(l.qty) || 1);
    const lineTotal = it.price * qty;
    let best = { amt: 0, id: null };
    if (!it.isSpecial) for (const o of offers) {
      if (!offerApplies(o, it)) continue;
      const amt = o.discountType === 'flat' ? Math.min(lineTotal, o.value * qty) : lineTotal * (o.value / 100);
      if (amt > best.amt) best = { amt, id: o.id };
    }
    subtotal += lineTotal; discount += best.amt;
    items.push({ itemId: it.id, name: it.name, price: it.price, qty, note: l.note || '', isVeg: !!it.isVeg, image: it.image, lineTotal, lineDiscount: round2(best.amt), offerId: best.id });
  }
  subtotal = round2(subtotal); discount = round2(discount);
  const tax = round2((subtotal - discount) * taxPct / 100);
  return { items, subtotal, discount, tax, taxPct, total: round2(subtotal - discount + tax) };
}

/* ---------------------------------------------------------------- store rules */
export function isOpenNow(settings = db.get('settings')) {
  const t = settings.timings || {}; const [oh, om] = (t.open || '11:00').split(':').map(Number); const [ch, cm] = (t.close || '22:00').split(':').map(Number);
  const n = new Date(); const mins = n.getHours() * 60 + n.getMinutes();
  return mins >= oh * 60 + om && mins < ch * 60 + cm;
}
/** { ok:true } or { ok:false, code:'SWITCH_OFF'|'OUTSIDE_HOURS' } */
export function acceptingStatus() {
  const s = db.get('settings');
  if (s.acceptingOrders === false) return { ok: false, code: 'SWITCH_OFF' };
  if (s.enforceTimings && !isOpenNow(s)) return { ok: false, code: 'OUTSIDE_HOURS' };
  return { ok: true };
}
export const getTableByNumber = (no) => db.find('tables', (t) => String(t.number) === String(no) && t.active !== false);

/* ---------------------------------------------------------------- table sessions */
export const getSession = (tableNo) => db.find('tableSessions', (s) => String(s.tableNo) === String(tableNo) && !s.closedAt);
/** Open (or reuse) the running session for a table. This device keeps the token in sessionStorage. */
export function ensureSession(tableNo) {
  let s = getSession(tableNo);
  if (!s) s = db.create('tableSessions', { tableNo: Number(tableNo), token: uid('tk'), openedAt: new Date().toISOString(), closedAt: null, guests: 0, callWaiter: null, billRequested: null, payment: null });
  return s;
}
export const deviceToken = (tableNo) => session.get(`bbc:tk:${tableNo}`);
export function claimSession(tableNo) { const s = ensureSession(tableNo); session.set(`bbc:tk:${tableNo}`, s.token); return s; }
/** Token valid = this device scanned the QR for the CURRENT session (not a stale/closed one) */
export function tokenValid(tableNo) { const s = getSession(tableNo); return !!s && deviceToken(tableNo) === s.token; }

/* ---------------------------------------------------------------- abuse protection */
const cooldownKey = (k) => `bbc:last:${k}`;
export function cooldownLeft(key) {
  const secs = Number((db.get('settings') || {}).orderCooldownSeconds ?? 20);
  const last = store.get(cooldownKey(key), 0);
  return Math.max(0, Math.ceil((last + secs * 1000 - Date.now()) / 1000));
}
const sigOf = (lines) => lines.map((l) => `${l.itemId}x${l.qty}`).sort().join('|');
export function isDuplicate(key, lines) {
  const prev = store.get(`bbc:sig:${key}`);
  return !!prev && prev.sig === sigOf(lines) && Date.now() - prev.at < 3 * 60000;
}

/* ---------------------------------------------------------------- placing orders */
function validateLines(lines) {
  if (!lines || !lines.length) { const e = new Error('EMPTY'); e.code = 'EMPTY'; throw e; }
  for (const l of lines) {
    const it = resolveItem(l.itemId);
    if (!it || it.available === false) { const e = new Error('SOLD_OUT'); e.code = 'SOLD_OUT'; e.itemId = l.itemId; throw e; }
  }
}
function fail(code, extra = {}) { const e = new Error(code); e.code = code; Object.assign(e, extra); throw e; }

/**
 * placeDineIn({ tableNo, customer:{name,guests}, lines:[{itemId,qty,note}], force })
 * Throws Error with .code: SWITCH_OFF | OUTSIDE_HOURS | BAD_TABLE | BAD_TOKEN | COOLDOWN(.seconds) | DUPLICATE | EMPTY | SOLD_OUT
 */
export function placeDineIn({ tableNo, customer = {}, lines, force = false }) {
  const st = acceptingStatus(); if (!st.ok) fail(st.code);
  const table = getTableByNumber(tableNo); if (!table) fail('BAD_TABLE');
  if (!tokenValid(tableNo)) fail('BAD_TOKEN');
  const key = `table-${tableNo}`;
  const left = cooldownLeft(key); if (left > 0) fail('COOLDOWN', { seconds: left });
  validateLines(lines);
  if (!force && isDuplicate(key, lines)) fail('DUPLICATE');
  const sess = getSession(tableNo);
  const priced = priceLines(lines);
  const now = new Date().toISOString();
  const order = db.create('orders', {
    type: 'dine-in', tableNo: Number(tableNo), sessionId: sess.id, parcelToken: null,
    customer: { name: customer.name || '', guests: Number(customer.guests) || 1, phone: '' },
    items: priced.items.map(({ itemId, name, price, qty, note, isVeg }) => ({ itemId, name, price, qty, note, isVeg })),
    status: 'placed', statusHistory: [{ status: 'placed', at: now, by: 'customer' }], waiterId: table.waiterId || null,
    subtotal: priced.subtotal, discount: priced.discount, tax: priced.tax, total: priced.total, createdAt: now, payment: null,
  });
  db.update('tableSessions', sess.id, { guests: Math.max(sess.guests || 0, Number(customer.guests) || 1) });
  store.set(cooldownKey(key), Date.now()); store.set(`bbc:sig:${key}`, { sig: sigOf(lines), at: Date.now() });
  publish('order:new', { orderId: order.id, tableNo: Number(tableNo), waiterId: order.waiterId });
  return order;
}

/** placeParcel({ customer:{name,phone}, lines, force }) -> order with parcelToken like P-015 */
export function placeParcel({ customer, lines, force = false }) {
  const st = acceptingStatus(); if (!st.ok) fail(st.code);
  const key = 'parcel';
  const left = cooldownLeft(key); if (left > 0) fail('COOLDOWN', { seconds: left });
  validateLines(lines);
  if (!force && isDuplicate(key, lines)) fail('DUPLICATE');
  const priced = priceLines(lines); const now = new Date().toISOString();
  const order = db.create('orders', {
    type: 'parcel', tableNo: null, sessionId: null, parcelToken: db.nextParcelToken(),
    customer: { name: customer.name, phone: customer.phone, guests: 0 },
    items: priced.items.map(({ itemId, name, price, qty, note, isVeg }) => ({ itemId, name, price, qty, note, isVeg })),
    status: 'placed', statusHistory: [{ status: 'placed', at: now, by: 'customer' }], waiterId: null,
    subtotal: priced.subtotal, discount: priced.discount, tax: priced.tax, total: priced.total, createdAt: now, payment: null,
  });
  store.set(cooldownKey(key), Date.now()); store.set(`bbc:sig:${key}`, { sig: sigOf(lines), at: Date.now() });
  publish('order:new', { orderId: order.id, parcel: true, token: order.parcelToken });
  return order;
}

/* ---------------------------------------------------------------- lifecycle */
/** Allowed next statuses for a given order (cancel handled separately) */
export function nextStatus(order) {
  const f = flowFor(order); const i = f.indexOf(order.status);
  return i >= 0 && i < f.length - 1 ? f[i + 1] : null;
}
/** setStatus(orderId, status, { by:'Ravi', waiterId, reason }) */
export function setStatus(orderId, status, { by = 'staff', waiterId, reason } = {}) {
  const o = db.get('orders', orderId); if (!o) fail('NOT_FOUND');
  const now = new Date().toISOString();
  const patch = { status, statusHistory: [...o.statusHistory, { status, at: now, by, ...(reason ? { reason } : {}) }] };
  if (status === 'cancelled') patch.cancelReason = reason || '';
  if (waiterId && !o.waiterId) patch.waiterId = waiterId;
  const out = db.update('orders', orderId, patch);
  publish('order:status', { orderId, status, tableNo: o.tableNo, token: o.parcelToken });
  return out;
}
/** Customer may cancel ONLY while status === 'placed' */
export function cancelByCustomer(orderId) {
  const o = db.get('orders', orderId); if (!o) fail('NOT_FOUND');
  if (o.status !== 'placed') fail('NOT_CANCELLABLE');
  return setStatus(orderId, 'cancelled', { by: 'customer', reason: 'Cancelled by customer' });
}
/** Waiter edits quantities/adds items; recalculates the bill. lines=[{itemId,qty,note}] (qty 0 removes) */
export function updateOrderItems(orderId, lines, by = 'waiter') {
  const o = db.get('orders', orderId); if (!o) fail('NOT_FOUND');
  const clean = lines.filter((l) => l.qty > 0); if (!clean.length) fail('EMPTY');
  const p = priceLines(clean);
  const out = db.update('orders', orderId, {
    items: p.items.map(({ itemId, name, price, qty, note, isVeg }) => ({ itemId, name, price, qty, note, isVeg })),
    subtotal: p.subtotal, discount: p.discount, tax: p.tax, total: p.total,
    statusHistory: [...o.statusHistory, { status: o.status, at: new Date().toISOString(), by, note: 'items edited' }],
  });
  publish('order:status', { orderId, status: o.status, tableNo: o.tableNo, edited: true });
  return out;
}

/* ---------------------------------------------------------------- table tab / bill */
export const sessionOrders = (tableNo) => { const s = getSession(tableNo); return s ? db.list('orders', (o) => o.sessionId === s.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []; };
/** running bill of a table = every non-cancelled order in the open session */
export function tabForTable(tableNo) {
  const orders = sessionOrders(tableNo); const live = orders.filter((o) => o.status !== 'cancelled');
  const sum = (k) => round2(live.reduce((a, o) => a + (o[k] || 0), 0));
  return { orders, live, subtotal: sum('subtotal'), discount: sum('discount'), tax: sum('tax'), total: sum('total') };
}
export function callWaiter(tableNo) {
  const s = ensureSession(tableNo); const at = new Date().toISOString();
  db.update('tableSessions', s.id, { callWaiter: at });
  const t = getTableByNumber(tableNo);
  publish('alert:call', { tableNo: Number(tableNo), waiterId: t && t.waiterId });
  return at;
}
export function requestBill(tableNo) {
  const s = ensureSession(tableNo); const at = new Date().toISOString();
  db.update('tableSessions', s.id, { billRequested: at });
  const t = getTableByNumber(tableNo);
  publish('alert:bill', { tableNo: Number(tableNo), waiterId: t && t.waiterId });
  return at;
}
export function clearCall(tableNo) { const s = getSession(tableNo); if (s) db.update('tableSessions', s.id, { callWaiter: null }); publish('order:status', { tableNo }); }
/**
 * Waiter closes table AFTER customer paid at counter. method = 'Cash' | 'UPI' | 'Card' (note only).
 * All confirmed/served orders become completed; session closes so the next QR scan starts fresh.
 */
export function closeTable(tableNo, { method = 'Cash', by = 'waiter' } = {}) {
  const s = getSession(tableNo); if (!s) fail('NO_SESSION');
  const now = new Date().toISOString(); const tab = tabForTable(tableNo);
  tab.live.forEach((o) => { if (o.status !== 'completed') setStatus(o.id, 'completed', { by }); db.update('orders', o.id, { payment: { method, at: now, by } }); });
  db.update('tableSessions', s.id, { closedAt: now, payment: { method, at: now, by, total: tab.total } });
  publish('table:closed', { tableNo: Number(tableNo) });
  return tab;
}
/**
 * Table card state for the waiter dashboard.
 * returns { state:'free'|'occupied'|'new'|'bill'|'called', session, waitingOrders:n, since }
 */
export function tableState(tableNo) {
  const s = getSession(tableNo);
  if (!s) return { state: 'free', session: null, waitingOrders: 0 };
  const orders = db.list('orders', (o) => o.sessionId === s.id);
  const waiting = orders.filter((o) => o.status === 'placed');
  let state = 'occupied';
  if (waiting.length) state = 'new'; else if (s.billRequested) state = 'bill'; else if (s.callWaiter) state = 'called';
  return { state, session: s, waitingOrders: waiting.length, since: s.openedAt, minutes: minutesSince(s.openedAt) };
}

/* ---------------------------------------------------------------- stats helpers (dashboard/reports) */
export function ordersToday() { const d = todayStr(); return db.list('orders', (o) => todayStr(new Date(o.createdAt)) === d); }
export function topItems(orders, limit = 5) {
  const m = new Map();
  orders.filter((o) => o.status !== 'cancelled').forEach((o) => o.items.forEach((i) => { const cur = m.get(i.itemId) || { itemId: i.itemId, name: i.name, qty: 0, revenue: 0 }; cur.qty += i.qty; cur.revenue += i.qty * i.price; m.set(i.itemId, cur); }));
  return [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}
export function avgRating() {
  const r = db.list('reviews', (x) => x.status === 'approved'); if (!r.length) return 0;
  return Math.round((r.reduce((a, x) => a + x.rating, 0) / r.length) * 10) / 10;
}
