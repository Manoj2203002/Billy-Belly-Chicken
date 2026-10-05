/* cart.js - per-context cart (one for each table QR, one for parcel). Persists in localStorage so a refresh keeps it. */
import { store } from './utils.js';
import { priceLines, resolveItem } from './orderService.js';

export function createCart(key) {
  const K = `bbc:cart:${key}`;
  let lines = store.get(K, []);
  const subs = new Set();
  const save = () => { store.set(K, lines); subs.forEach((cb) => cb(api)); };
  const api = {
    key,
    lines: () => lines.map((l) => ({ ...l })),
    count: () => lines.reduce((n, l) => n + l.qty, 0),
    qtyOf: (id) => (lines.find((l) => l.itemId === id) || {}).qty || 0,
    /** add(itemId, qty=1, note='') - ignores sold-out / unknown items */
    add(itemId, qty = 1, note = '') {
      const it = resolveItem(itemId); if (!it || it.available === false) return false;
      const l = lines.find((x) => x.itemId === itemId);
      if (l) { l.qty = Math.min(99, l.qty + qty); if (note) l.note = note; } else lines.push({ itemId, qty, note });
      save(); return true;
    },
    setQty(itemId, qty) { const l = lines.find((x) => x.itemId === itemId); if (!l) return; if (qty <= 0) lines = lines.filter((x) => x !== l); else l.qty = Math.min(99, qty); save(); },
    setNote(itemId, note) { const l = lines.find((x) => x.itemId === itemId); if (l) { l.note = note; save(); } },
    remove(itemId) { lines = lines.filter((x) => x.itemId !== itemId); save(); },
    clear() { lines = []; save(); },
    /** drop lines that became sold-out/deleted; returns removed ids */
    prune() { const bad = lines.filter((l) => { const it = resolveItem(l.itemId); return !it || it.available === false; }).map((l) => l.itemId); if (bad.length) { lines = lines.filter((l) => !bad.includes(l.itemId)); save(); } return bad; },
    pricing: () => priceLines(lines),
    onChange(cb) { subs.add(cb); return () => subs.delete(cb); },
  };
  return api;
}
