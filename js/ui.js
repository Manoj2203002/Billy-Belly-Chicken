/* ==========================================================================
   ui.js - reusable UI behaviours: toast, modal, confirm, drawer, ripple,
   magnetic buttons, tilt, reveal-on-scroll, split-text, counters, FLIP,
   fly-to-cart, confetti, tab indicator. Vanilla JS, transform/opacity only.
   ========================================================================== */
import { $, $$, el, reducedMotion, isFinePointer, throttleRaf, clamp } from './utils.js';
import { icon } from './icons.js';
import { t } from './i18n.js';

/* ----------------------------------------------------------------- toast */
let stack;
export function toast(message, { type = 'ok', title = '', ms = 3800 } = {}) {
  stack ||= document.body.appendChild(el('div', { class: 'toast-stack', role: 'status', 'aria-live': 'polite' }));
  const ic = { ok: 'checkcircle', error: 'xcircle', warn: 'alert', alert: 'bell', info: 'info' }[type] || 'info';
  const node = el('div', { class: `toast toast--${type}` }, el('span', { html: icon(ic) }), el('div', {}, title && el('div', { class: 'toast__title' }, title), el('div', { class: title ? 'toast__msg' : 'toast__title' }, message)));
  stack.append(node);
  const kill = () => { node.classList.add('is-out'); setTimeout(() => node.remove(), 360); };
  node.addEventListener('click', kill); setTimeout(kill, ms);
  return node;
}

/* ----------------------------------------------------------------- modal */
let lastFocus = null;
/**
 * openModal({ title, body: string|Node, footer: Node[]|Node, size: 'sm'|'lg', onClose, dismissible })
 * returns { el, body, close() }
 */
export function openModal({ title = '', body = '', footer = null, size = '', onClose, dismissible = true, cls = '' } = {}) {
  lastFocus = document.activeElement;
  const bodyEl = el('div', { class: 'modal__body' });
  typeof body === 'string' ? (bodyEl.innerHTML = body) : bodyEl.append(body);
  const closeBtn = el('button', { class: 'modal__close', type: 'button', 'aria-label': t('common.close'), html: icon('close') });
  const modal = el('div', { class: `modal ${size ? 'modal--' + size : ''} ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' },
    (title || dismissible) && el('div', { class: 'modal__head' }, el('h2', { class: 'modal__title' }, title), dismissible ? closeBtn : null), bodyEl,
    footer && el('div', { class: 'modal__foot' }, footer));
  const back = el('div', { class: 'modal-backdrop' }, modal);
  document.body.append(back); document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => back.classList.add('is-open'));
  const api = {
    el: modal, body: bodyEl,
    close() {
      back.classList.remove('is-open'); document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      setTimeout(() => back.remove(), 420); lastFocus && lastFocus.focus && lastFocus.focus(); onClose && onClose();
    },
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible) api.close();
    if (e.key === 'Tab') { // focus trap
      const f = $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', modal).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return; const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey);
  if (dismissible) { closeBtn.addEventListener('click', api.close); back.addEventListener('mousedown', (e) => { if (e.target === back) api.close(); }); }
  setTimeout(() => { const f = $('input,select,textarea,button.btn--primary', modal) || closeBtn; f && f.focus({ preventScroll: true }); }, 60);
  return api;
}
/** confirmDialog({title, message, confirmText, danger}) -> Promise<boolean> */
export function confirmDialog({ title = t('common.areYouSure'), message = '', confirmText = t('common.confirm'), cancelText = t('common.cancel'), danger = false } = {}) {
  return new Promise((resolve) => {
    let m; let result = false;
    const ok = el('button', { class: `btn ${danger ? 'btn--primary' : 'btn--primary'}`, type: 'button' }, confirmText);
    const no = el('button', { class: 'btn btn--ghost', type: 'button' }, cancelText);
    ok.addEventListener('click', () => { result = true; m.close(); }); no.addEventListener('click', () => m.close());
    m = openModal({ title, body: el('p', { class: 'text-muted' }, message), footer: [no, ok], size: 'sm', onClose: () => resolve(result) });
  });
}
/** promptDialog({title, label, value, required}) -> Promise<string|null> */
export function promptDialog({ title = '', label = '', value = '', placeholder = '', textarea = false, required = false } = {}) {
  return new Promise((resolve) => {
    let m; let result = null;
    const input = el(textarea ? 'textarea' : 'input', { class: textarea ? 'textarea' : 'input', placeholder, value: textarea ? null : value }); if (textarea) input.value = value;
    const err = el('div', { class: 'field__error' }, t('common.required'));
    const ok = el('button', { class: 'btn btn--primary', type: 'button' }, t('common.confirm')); const no = el('button', { class: 'btn btn--ghost', type: 'button' }, t('common.cancel'));
    ok.addEventListener('click', () => { if (required && !input.value.trim()) { input.closest('.field').classList.add('has-error'); return; } result = input.value.trim(); m.close(); });
    no.addEventListener('click', () => m.close());
    m = openModal({ title, size: 'sm', body: el('div', { class: 'field' }, el('label', { class: 'field__label' }, label), input, err), footer: [no, ok], onClose: () => resolve(result) });
  });
}

/* ----------------------------------------------------------------- drawer */
/** createDrawer({ title, side:'right'|'left' }) -> { el, body, foot, open(), close(), toggle() } */
export function createDrawer({ title = '', side = 'right', footer = true, onOpen, onClose } = {}) {
  const back = el('div', { class: 'drawer-backdrop' });
  const body = el('div', { class: 'drawer__body' }); const foot = el('div', { class: 'drawer__foot' });
  const closeBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.close'), html: icon('close') });
  const titleEl = el('h2', { class: 'modal__title' }, title);
  const d = el('aside', { class: `drawer ${side === 'left' ? 'drawer--left' : ''}`, 'aria-hidden': 'true', 'aria-label': title }, el('div', { class: 'drawer__head' }, titleEl, closeBtn), body, footer ? foot : null);
  document.body.append(back, d);
  const api = {
    el: d, body, foot, titleEl, isOpen: false,
    open() { api.isOpen = true; d.classList.add('is-open'); back.classList.add('is-open'); d.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; onOpen && onOpen(); },
    close() { api.isOpen = false; d.classList.remove('is-open'); back.classList.remove('is-open'); d.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; onClose && onClose(); },
    toggle() { api.isOpen ? api.close() : api.open(); },
  };
  closeBtn.addEventListener('click', api.close); back.addEventListener('click', api.close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && api.isOpen) api.close(); });
  return api;
}

/* ----------------------------------------------------------------- tactile micro-interactions */
/** Ripple on any .btn / .ripple-host (delegated, call once) */
export function initRipple() {
  return; // buttons are intentionally static (no ripple)
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn, .ripple-host'); if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(); const s = Math.max(r.width, r.height);
    const sp = el('span', { class: 'ripple' }); sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.append(sp); setTimeout(() => sp.remove(), 720);
  });
}
/** Magnetic pull on elements with [data-magnetic] (desktop only) */
export function initMagnetic(root = document) {
  return; // buttons are intentionally static (no magnetic pull)
  if (!isFinePointer() || reducedMotion()) return;
  $$('[data-magnetic]', root).forEach((n) => {
    if (n.dataset.magInit) return; n.dataset.magInit = '1';
    n.addEventListener('pointermove', (e) => { const r = n.getBoundingClientRect(); const x = (e.clientX - r.left - r.width / 2) * 0.28; const y = (e.clientY - r.top - r.height / 2) * 0.35; n.style.transform = `translate(${x}px,${y}px)`; });
    n.addEventListener('pointerleave', () => { n.style.transition = 'transform .6s var(--ease-spring)'; n.style.transform = ''; setTimeout(() => (n.style.transition = ''), 600); });
  });
}
/** 3D tilt for [data-tilt] cards (desktop only) */
export function initTilt(root = document) {
  if (!isFinePointer() || reducedMotion()) return;
  $$('[data-tilt]', root).forEach((n) => {
    if (n.dataset.tiltInit) return; n.dataset.tiltInit = '1';
    n.addEventListener('pointermove', (e) => { const r = n.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5; const py = (e.clientY - r.top) / r.height - 0.5; n.style.transform = `perspective(900px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateZ(0)`; });
    n.addEventListener('pointerleave', () => { n.style.transition = 'transform .6s var(--ease)'; n.style.transform = ''; setTimeout(() => (n.style.transition = ''), 600); });
  });
}
/** Custom cursor dot + ring (desktop only) */
export function initCursor() {
  if (!isFinePointer() || reducedMotion() || $('.cursor-dot')) return;
  const dot = el('div', { class: 'cursor-dot' }); const ring = el('div', { class: 'cursor-ring' });
  document.body.append(dot, ring); document.body.classList.add('has-cursor');
  let x = 0; let y = 0; let rx = 0; let ry = 0;
  window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px,${y}px)`; }, { passive: true });
  (function loop() { rx += (x - rx) * 0.18; ry += (y - ry) * 0.18; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(loop); })();
  document.addEventListener('pointerover', (e) => ring.classList.toggle('is-hover', !!e.target.closest('a,button,[role=button],input,select,textarea,label,[data-tilt]')));
}

/* ----------------------------------------------------------------- scroll-driven */
let io;
/** Reveal [data-reveal] elements when scrolled into view. Stagger with style="--i:n" or data-stagger on parent. */
export function initReveal(root = document) {
  const targets = $$('[data-reveal]:not(.is-in), [data-split]:not(.split-in)', root);
  $$('[data-stagger]', root).forEach((p) => Array.from(p.children).forEach((c, i) => { if (!c.style.getPropertyValue('--i')) c.style.setProperty('--i', i); if (!c.hasAttribute('data-reveal')) c.setAttribute('data-reveal', p.dataset.stagger || 'up'); }));
  const all = $$('[data-reveal]:not(.is-in), [data-split]:not(.split-in)', root);
  if (!('IntersectionObserver' in window) || reducedMotion()) { all.forEach((n) => n.classList.add('is-in', 'split-in')); return; }
  const vh = innerHeight * 0.96;
  const later = [];
  // anything already on screen is simply shown (no hidden-then-animate flash); only below-the-fold items animate in
  all.forEach((n) => { if (n.getBoundingClientRect().top < vh) n.classList.add('is-in', 'split-in'); else { n.classList.add('rv'); later.push(n); } });
  io ||= new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in', 'split-in'); io.unobserve(en.target); } }), { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
  later.forEach((n) => io.observe(n));
  void targets;
}
/** Wrap words of [data-split] elements so they slide up one by one */
export function splitWords(root = document) {
  $$('[data-split]', root).forEach((n) => {
    if (n.dataset.splitDone) return; n.dataset.splitDone = '1';
    if (reducedMotion() || n.getBoundingClientRect().top < innerHeight * 0.96) return; // above the fold: leave as plain text
    const text = n.textContent; n.setAttribute('aria-label', text); n.textContent = '';
    text.split(/(\s+)/).forEach((w, i) => { if (/^\s+$/.test(w)) return n.append(' '); const o = el('span', { class: 'w', 'aria-hidden': 'true' }, el('span', { class: 'w__i', style: `--wi:${i / 2}` }, w)); n.append(o); });
  });
}
/** Parallax: [data-parallax="0.15"] moves slower/faster than scroll (transform only, paused off-screen) */
export function initParallax(root = document) {
  if (reducedMotion()) return;
  const items = $$('[data-parallax]', root).map((n) => ({ n, f: parseFloat(n.dataset.parallax) || 0.15, vis: true }));
  if (!items.length) return;
  const io2 = new IntersectionObserver((es) => es.forEach((e) => { const it = items.find((i) => i.n === e.target); if (it) it.vis = e.isIntersecting; }));
  items.forEach((i) => io2.observe(i.n));
  const upd = throttleRaf(() => items.forEach((i) => { if (!i.vis) return; const r = i.n.getBoundingClientRect(); const c = r.top + r.height / 2 - innerHeight / 2; i.n.style.transform = `translate3d(0,${(-c * i.f).toFixed(1)}px,0)`; }));
  addEventListener('scroll', upd, { passive: true }); upd();
}
/** Animated counters: <span data-count="1200" data-suffix="+">0</span> */
export function initCounters(root = document) {
  const nodes = $$('[data-count]:not([data-counted])', root); if (!nodes.length) return;
  const run = (n) => { n.dataset.counted = '1'; countTo(n, parseFloat(n.dataset.count), { suffix: n.dataset.suffix || '', decimals: Number(n.dataset.decimals || 0) }); };
  if (!('IntersectionObserver' in window) || reducedMotion()) return nodes.forEach((n) => { n.textContent = Number(n.dataset.count).toLocaleString('en-IN') + (n.dataset.suffix || ''); });
  const o = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { run(e.target); o.unobserve(e.target); } }), { threshold: 0.4 });
  nodes.forEach((n) => o.observe(n));
}
/** Tween a number inside a node (also used for dashboard stat changes) */
export function countTo(node, to, { dur = 1400, suffix = '', decimals = 0, prefix = '' } = {}) {
  const from = parseFloat(node.dataset.cur ?? '0') || 0; node.dataset.cur = to;
  if (reducedMotion()) { node.textContent = prefix + to.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix; return; }
  const t0 = performance.now();
  (function tick(now) { const p = clamp((now - t0) / dur, 0, 1); const e = 1 - Math.pow(1 - p, 4); const v = from + (to - from) * e;
    node.textContent = prefix + v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix; if (p < 1) requestAnimationFrame(tick); })(t0);
}
/** Top scroll progress bar */
export function initScrollProgress() {
  const bar = $('.scroll-progress') || document.body.appendChild(el('div', { class: 'scroll-progress', 'aria-hidden': 'true' }));
  const upd = throttleRaf(() => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`; });
  addEventListener('scroll', upd, { passive: true }); upd();
}

/* ----------------------------------------------------------------- tabs with sliding indicator */
/** initTabs(container, { onChange(id) }) - container has .tabs__tab[data-id]; an indicator is auto-created. */
export function initTabs(container, { onChange } = {}) {
  let ind = $('.tabs__indicator', container); if (!ind) { ind = el('i', { class: 'tabs__indicator' }); container.append(ind); }
  const tabs = () => $$('.tabs__tab', container);
  const place = (tab) => { if (!tab) return; ind.style.setProperty('--w', tab.offsetWidth + 'px'); ind.style.setProperty('--x', tab.offsetLeft + 'px'); };
  const select = (tab, fire = true) => { tabs().forEach((x) => { const on = x === tab; x.classList.toggle('is-active', on); x.setAttribute('aria-selected', on); }); place(tab); container.scrollTo({ left: tab.offsetLeft - (container.clientWidth - tab.offsetWidth) / 2, behavior: reducedMotion() ? 'auto' : 'smooth' }); fire && onChange && onChange(tab.dataset.id); };
  container.addEventListener('click', (e) => { const tab = e.target.closest('.tabs__tab'); if (tab) select(tab); });
  const cur = () => tabs().find((x) => x.classList.contains('is-active')) || tabs()[0];
  addEventListener('resize', () => place(cur())); requestAnimationFrame(() => place(cur()));
  document.fonts && document.fonts.ready.then(() => place(cur()));
  return { select: (id) => { const tab = tabs().find((x) => x.dataset.id === id); tab && select(tab, false); }, refresh: () => place(cur()) };
}

/* ----------------------------------------------------------------- FLIP list animation */
/** flip(container, mutate) - records child positions, runs mutate() (re-render), animates items to new positions. Children need data-key. */
export function flip(container, mutate) {
  const first = new Map($$('[data-key]', container).map((n) => [n.dataset.key, n.getBoundingClientRect()]));
  mutate();
  if (reducedMotion()) return;
  $$('[data-key]', container).forEach((n, i) => {
    const f = first.get(n.dataset.key); const l = n.getBoundingClientRect();
    if (!f) { n.animate([{ opacity: 0, transform: 'scale(.92) translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: Math.min(i * 22, 300), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }); return; }
    const dx = f.left - l.left; const dy = f.top - l.top; if (!dx && !dy) return;
    n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
  });
}

/* ----------------------------------------------------------------- delight */
/** Fly a red dot from an element to the cart icon, then bounce the badge */
export function flyToCart(fromEl, toEl) {
  if (!fromEl || !toEl) return; const bump = () => { const b = $('.cart-badge', toEl) || toEl; b.classList.remove('bounce'); void b.offsetWidth; b.classList.add('bounce'); };
  if (reducedMotion()) return bump();
  const a = fromEl.getBoundingClientRect(); const b = toEl.getBoundingClientRect(); const s = 18;
  const dot = el('div', { class: 'fly-clone' }); dot.style.cssText = `left:${a.left + a.width / 2 - s / 2}px;top:${a.top + a.height / 2 - s / 2}px;width:${s}px;height:${s}px`;
  document.body.append(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2); const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  dot.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy - 80}px) scale(1.3)`, offset: 0.45 }, { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: .8 }], { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => { dot.remove(); bump(); };
}
/** Lightweight confetti burst (red / white only) */
export function confetti(n = 70) {
  if (reducedMotion()) return;
  const cols = ['#e1201a', '#ffffff', '#ff4d45', '#a8120e'];
  for (let i = 0; i < n; i++) { const c = el('i', { class: 'confetti' }); c.style.cssText = `left:${Math.random() * 100}vw;background:${cols[i % cols.length]};--dx:${(Math.random() - 0.5) * 240}px;--r:${Math.random() * 1080}deg;--t:${1.6 + Math.random() * 1.6}s;animation-delay:${Math.random() * 0.4}s;border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`; document.body.append(c); setTimeout(() => c.remove(), 3800); }
}
/** Animated check mark svg (stroke draw) */
export const checkDrawSVG = (size = 96) => `<svg class="check-draw" width="${size}" height="${size}" viewBox="0 0 52 52" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg>`;

/** Skeleton placeholders: skeletons(n, 'height:120px') */
export const skeletonHTML = (n = 3, h = '120px') => Array.from({ length: n }, () => `<div class="skeleton" style="height:${h}"></div>`).join('');
/** Empty-state block */
export function emptyState({ icon: ic = 'search', title = '', text = '', action = '' } = {}) { return `<div class="empty">${icon(ic)}<div class="empty__title">${title}</div><p>${text}</p>${action}</div>`; }

/** Add a CSS class to body once the page is ready for entrance animations */
export function pageReady() { document.body.classList.add('page-enter'); }

/** Initialise common behaviours for any page */
export function initCommonUI() { initRipple(); initMagnetic(); initTilt(); splitWords(); initReveal(); initCounters(); initParallax(); }
