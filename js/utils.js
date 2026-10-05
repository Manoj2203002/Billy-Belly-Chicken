/* utils.js - small, dependency-free helpers shared by every page. */

/** Path prefix back to the site root ('' for root pages, '../' for /admin and /waiter). Set via <body data-root>. */
export const ROOT = (typeof document !== 'undefined' && document.body && document.body.dataset.root) || '';
export const url = (p) => ROOT + String(p).replace(/^\//, '');

/** Load a JSON file. Over http(s) it is fetched. When the site is opened by double-clicking the HTML files (file://),
 *  browsers block fetch(), so js/bundles/data.js pre-loads every JSON file into window.__BBC_FILES instead. */
export async function loadJSON(path, opts) {
  const pre = typeof window !== 'undefined' && window.__BBC_FILES;
  if (pre && pre[path] !== undefined) return structuredClone(pre[path]);
  const r = await fetch(ROOT + path, opts);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Create an element: el('div', {class:'x', onclick:fn, dataset:{a:1}}, child|string, ...) */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c.nodeType ? c : document.createTextNode(c));
  return node;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const throttleRaf = (fn) => { let q = false; return (...a) => { if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(...a); }); }; };
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isFinePointer = () => window.matchMedia('(hover:hover) and (pointer:fine)').matches;
export const param = (name) => new URLSearchParams(location.search).get(name);
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---- safe storage (private mode / blocked storage must not crash the app) ---- */
const mem = new Map();
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return mem.has(k) ? mem.get(k) : d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { mem.set(k, v); } },
  del(k) { try { localStorage.removeItem(k); } catch { mem.delete(k); } },
};
export const session = {
  get(k, d = null) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

/* ---- formatting ---- */
let _cur = '₹';
export const setCurrency = (c) => { _cur = c || '₹'; };
export const money = (n) => `${_cur}${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
export const num = (n) => Number(n || 0).toLocaleString('en-IN');
export const pad = (n, l = 2) => String(n).padStart(l, '0');
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isToday = (iso) => todayStr(new Date(iso)) === todayStr();
export function fmtTime(iso, lang = 'en') { return new Date(iso).toLocaleTimeString(lang === 'ta' ? 'ta-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' }); }
export function fmtDate(iso, lang = 'en') { return new Date(iso).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
export function fmtDateTime(iso, lang = 'en') { return `${fmtDate(iso, lang)}, ${fmtTime(iso, lang)}`; }
/** "5 min" style duration since a timestamp */
export function minutesSince(iso) { return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); }
export function timeAgo(iso, lang = 'en') {
  const m = minutesSince(iso);
  if (m < 1) return lang === 'ta' ? 'இப்போது' : 'just now';
  if (m < 60) return lang === 'ta' ? `${m} நிமிடம் முன்` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'ta' ? `${h} மணி முன்` : `${h} hr ago`;
  return fmtDate(iso, lang);
}

/** Download text as a file (used by CSV export / QR sheet) */
export function download(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = el('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function toCSV(rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n');
}
/** Validate an Indian mobile number (10 digits, starts 6-9, optional +91 / 0) */
export const cleanPhone = (v) => String(v).replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
export const isPhone = (v) => /^[6-9]\d{9}$/.test(cleanPhone(v));
export function readFileAsDataURL(file, maxW = 900) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      // downscale big images so localStorage doesn't overflow
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(fr.result);
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
/** Resolve an image path stored in data: data: URLs / http(s) pass through, relative paths get ROOT prefix */
export const imgSrc = (p) => !p ? url('assets/images/misc/placeholder.svg') : /^(data:|https?:|blob:)/.test(p) ? p : url(p);
