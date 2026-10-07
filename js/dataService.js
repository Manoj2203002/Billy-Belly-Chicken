/* ==========================================================================
   dataService.js - the ONLY place the UI touches data.
   Prototype: localStorage-backed, seeded from /data/*.json on first load.
   PRODUCTION: re-implement the body of these functions with fetch() calls to
   your REST/GraphQL/Firebase backend. The function signatures stay the same,
   so no page code has to change.
   ========================================================================== */
import { ROOT, store, session, uid, pad, todayStr, loadJSON } from './utils.js';

const SEED_VERSION = '2026.10.5';            // bump to force a re-seed for everyone
const PFX = 'bbc:db:';
const SEED_FILES = {
  restaurant: 'data/restaurant.json', categories: 'data/categories.json', menu: 'data/menu.json',
  specials: 'data/specials.json', offers: 'data/offers.json', gallery: 'data/gallery.json',
  tables: 'data/tables.json', staff: 'data/staff.json', orders: 'data/orders.json',
  reviews: 'data/reviews.json', settings: 'data/settings.json', tableSessions: 'data/tableSessions.json',
};
/** Collections that start empty and are created at runtime */
const RUNTIME = ['alerts', 'audit'];
const SINGLETONS = new Set(['restaurant', 'settings']);
const ID_PREFIX = { categories: 'c', menu: 'm', specials: 'sp', offers: 'o', gallery: 'g', tables: 't', staff: 'w', orders: 'O-', reviews: 'r', tableSessions: 'ts', alerts: 'al', audit: 'a' };

const cache = new Map();
const listeners = new Set();
let bc = null;
try { bc = new BroadcastChannel('bbc-data'); } catch { /* older browsers: storage event fallback below */ }

/* ---- seed token resolver: "{{today}}", "{{now-35}}" (minutes ago), "{{day-2}}" (days ago, same time) ---- */
function resolveTokens(v) {
  if (typeof v === 'string') {
    const m = v.match(/^\{\{(today|now|day)(?:-(\d+))?\}\}$/);
    if (!m) return v;
    const n = Number(m[2] || 0);
    if (m[1] === 'today') { const d = new Date(); d.setDate(d.getDate() - n); return todayStr(d); }
    if (m[1] === 'now') return new Date(Date.now() - n * 60000).toISOString();
    return new Date(Date.now() - n * 86400000).toISOString();
  }
  if (Array.isArray(v)) return v.map(resolveTokens);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveTokens(x)]));
  return v;
}

function writeRaw(col, data) { store.set(PFX + col, data); cache.set(col, data); }
function readRaw(col) {
  if (cache.has(col)) return cache.get(col);
  const d = store.get(PFX + col, SINGLETONS.has(col) ? {} : []);
  cache.set(col, d);
  return d;
}
function notify(col, fromRemote = false) {
  listeners.forEach((cb) => { try { cb(col, fromRemote); } catch (e) { console.error(e); } });
}

/** Load seed JSON on first visit (or when SEED_VERSION changes). Must be awaited once per page. */
let _ready = null;
export function init() {
  if (_ready) return _ready;
  _ready = (async () => {
    if (store.get('bbc:seedVersion') !== SEED_VERSION) await seed();
    // keep tabs in sync (orders placed in one tab appear in the waiter tab, etc.)
    if (bc) bc.onmessage = (e) => { cache.delete(e.data.col); notify(e.data.col, true); };
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(PFX)) { const col = e.key.slice(PFX.length); cache.delete(col); if (!bc) notify(col, true); }
    });
  })();
  return _ready;
}
async function seed() {
  const entries = await Promise.all(Object.entries(SEED_FILES).map(async ([col, path]) => {
    try { return [col, resolveTokens(await loadJSON(path, { cache: 'no-cache' }))]; }
    catch (err) { console.warn('[dataService] could not load', path, err); return [col, SINGLETONS.has(col) ? {} : []]; }
  }));
  entries.forEach(([col, data]) => writeRaw(col, data));
  RUNTIME.forEach((col) => writeRaw(col, []));
  store.set('bbc:counters', { parcel: { date: todayStr(), n: 14 }, orders: 1010 });
  store.set('bbc:seedVersion', SEED_VERSION);
}

const clone = (x) => (x === undefined ? x : structuredClone(x));

export const db = {
  /** list(col, predicate?) -> array of copies */
  list(col, pred) { const a = readRaw(col); return clone(pred ? a.filter(pred) : a); },
  /** get(col, id) -> item | undefined ; get('settings') -> object */
  get(col, id) { const d = readRaw(col); return SINGLETONS.has(col) ? clone(d) : clone(d.find((x) => x.id === id)); },
  /** find first item matching predicate */
  find(col, pred) { return clone(readRaw(col).find(pred)); },
  nextId(col) {
    const pre = ID_PREFIX[col] || 'x';
    if (col === 'orders') { const c = store.get('bbc:counters', {}); c.orders = (c.orders || 1010) + 1; store.set('bbc:counters', c); return `O-${c.orders}`; }
    if (['tableSessions', 'alerts', 'audit'].includes(col)) return uid(pre);
    const rows = readRaw(col);
    const max = rows.reduce((m, x) => Math.max(m, parseInt(String(x.id).replace(/\D/g, ''), 10) || 0), 0);
    const width = rows.reduce((w, x) => Math.max(w, String(x.id).replace(/\D/g, '').length), 2);
    return `${pre}${pad(max + 1, width)}`;
  },
  create(col, item) {
    const arr = readRaw(col).slice();
    const rec = { ...clone(item) };
    if (!rec.id) rec.id = this.nextId(col);
    arr.push(rec); writeRaw(col, arr); this._emit(col);
    return clone(rec);
  },
  update(col, id, patch) {
    if (SINGLETONS.has(col)) { const next = { ...readRaw(col), ...clone(id) }; writeRaw(col, next); this._emit(col); return clone(next); }
    const arr = readRaw(col).slice(); const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return null;
    arr[i] = { ...arr[i], ...clone(patch) }; writeRaw(col, arr); this._emit(col);
    return clone(arr[i]);
  },
  /** replace a singleton (restaurant/settings) or a whole collection (used for reordering) */
  save(col, data) { writeRaw(col, clone(data)); this._emit(col); },
  remove(col, id) {
    const arr = readRaw(col); const next = arr.filter((x) => x.id !== id);
    if (next.length === arr.length) return false;
    writeRaw(col, next); this._emit(col); return true;
  },
  /** subscribe to changes: cb(collection, fromOtherTab) -> unsubscribe fn */
  onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  _emit(col) { if (bc) bc.postMessage({ col }); notify(col, false); },
  /** wipe everything and re-seed from JSON ("Reset demo data" button) */
  async reset() {
    Object.keys(localStorage).filter((k) => k.startsWith('bbc:') && !['bbc:lang'].includes(k)).forEach((k) => localStorage.removeItem(k));
    cache.clear(); _ready = null; await seed(); Object.keys(SEED_FILES).concat(RUNTIME).forEach((c) => this._emit(c));
  },
  /** audit log of admin changes */
  audit(action, detail = '') {
    const who = session.get('bbc:session:admin') || session.get('bbc:session:waiter') || {};
    const arr = readRaw('audit').slice(); arr.unshift({ id: uid('a'), at: new Date().toISOString(), by: who.name || 'system', role: who.role || '-', action, detail });
    writeRaw('audit', arr.slice(0, 300)); this._emit('audit');
  },
  /** parcel token generator: P-015, P-016 ... resets every day */
  nextParcelToken() {
    const c = store.get('bbc:counters', {}); const today = todayStr();
    if (!c.parcel || c.parcel.date !== today) c.parcel = { date: today, n: 0 };
    c.parcel.n += 1; store.set('bbc:counters', c);
    return `P-${pad(c.parcel.n, 3)}`;
  },
};
export const collections = Object.keys(SEED_FILES).concat(RUNTIME);
