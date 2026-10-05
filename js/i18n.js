/* ==========================================================================
   i18n.js - English / Tamil.
   - Static UI text: data/i18n/en.json + ta.json (common) and data/i18n/pages/<ns>.<lang>.json (per page)
   - HTML:  <h1 data-i18n="home.title"></h1>   <input data-i18n-placeholder="search.ph">   <button data-i18n-aria="nav.menu">
   - JS:    t('cart.items', {n: 3})   tr(item.name)   (tr picks .ta when Tamil, falls back to .en)
   ========================================================================== */
import { ROOT, store, loadJSON } from './utils.js';

// Tamil is switched off for now: English only. To bring it back, add 'ta' to LANGS, restore the toggle below and the data/i18n/*.ta.json files.
export const LANGS = ['en'];
let lang = 'en';
const dict = { en: {}, ta: {} };
const loaded = new Set();
const listeners = new Set();
let namespaces = [];

const flatten = (o, p = '', out = {}) => { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; if (v && typeof v === 'object') flatten(v, key, out); else out[key] = v; } return out; };
async function load(l, path) {
  const id = `${l}:${path}`; if (loaded.has(id)) return; loaded.add(id);
  try { Object.assign(dict[l], flatten(await loadJSON(path))); } catch { /* missing optional file */ }
}
async function loadAll(l) {
  await Promise.all([load(l, `data/i18n/${l}.json`), ...namespaces.map((ns) => load(l, `data/i18n/pages/${ns}.${l}.json`))]);
}

export const getLang = () => lang;
/** t('key', {vars}) -> string. Falls back to English, then to the key itself. */
export function t(key, vars) {
  let s = dict[lang][key] ?? dict.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  return s;
}
/** tr({en:'..',ta:'..'}) -> current language string, English fallback when Tamil missing. */
export function tr(obj, fallback = '') {
  if (obj == null) return fallback;
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.en || fallback;
}
/** Apply translations to every data-i18n* element inside root */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((n) => { n.innerHTML = t(n.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((n) => { n.setAttribute('placeholder', t(n.dataset.i18nPlaceholder)); });
  root.querySelectorAll('[data-i18n-aria]').forEach((n) => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach((n) => { n.setAttribute('title', t(n.dataset.i18nTitle)); });
  if (root === document) {
    document.documentElement.lang = lang;
    const tt = document.documentElement.dataset.titleKey; if (tt) document.title = t(tt);
  }
}
/** Call once per page: await initI18n(['home']) */
export async function initI18n(ns = []) {
  namespaces = ns;
  await loadAll('en'); if (lang !== 'en') await loadAll('ta');
  applyI18n();
}
export async function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  lang = l; store.set('bbc:lang', l);
  await loadAll(l); applyI18n();
  listeners.forEach((cb) => { try { cb(l); } catch (e) { console.error(e); } });
}
/** Re-render dynamic content when language changes: onLangChange(() => render()) */
export function onLangChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
/** Build the EN | தமிழ் toggle into a container */
export function mountLangToggle(container) { if (container) container.innerHTML = ''; }
