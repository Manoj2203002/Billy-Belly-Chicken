import { init, db } from '../dataService.js';
import { initI18n, t, tr, onLangChange, applyI18n } from '../i18n.js';
import { mountPublicLayout } from '../layout.js';
import { hydrateIcons } from '../icons.js';
import { $, $$, esc, imgSrc, reducedMotion } from '../utils.js';
import { flip } from '../ui.js';

await init();
await initI18n(['gallery']);
mountPublicLayout({ active: 'gallery' });
hydrateIcons();

let cat = 'all'; let shown = [];
const CATS = ['all', 'food', 'ambience', 'kitchen', 'events'];
function chips() {
  $('#filters').innerHTML = CATS.map((c) => `<button type="button" class="chip ${c === cat ? 'is-active' : ''}" data-c="${c}" aria-pressed="${c === cat}">${t('gallery.' + c)}</button>`).join('');
}
function list() { return db.list('gallery').sort((a, b) => a.order - b.order).filter((g) => cat === 'all' || g.category === cat); }
function grid(animate) {
  const run = () => {
    shown = list();
    $('#grid').innerHTML = shown.map((g, i) => `<button type="button" class="gitem" data-key="${g.id}" data-i="${i}" aria-label="${esc(tr(g.caption))}"><img src="${imgSrc(g.image)}" alt="${esc(tr(g.caption))}" loading="lazy" width="800" height="600"><span class="badge gitem__cat">${t('gallery.' + g.category)}</span><span class="gitem__cap">${esc(tr(g.caption))}</span></button>`).join('');
  };
  animate ? flip($('#grid'), run) : run();
}
chips(); grid(false);
$('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; chips(); grid(true); });
onLangChange(() => { chips(); grid(false); });

/* ---------- lightbox: shared-element open/close, keyboard, swipe ---------- */
const lb = $('#lightbox'); const img = $('#lb-img'); let idx = 0; let origin = null;
function show(i, from) {
  idx = (i + shown.length) % shown.length; const g = shown[idx];
  img.src = imgSrc(g.image); img.alt = tr(g.caption); $('#lb-cap').textContent = tr(g.caption);
  if (from && !reducedMotion()) {
    const r = from.getBoundingClientRect();
    img.onload = () => { const e = img.getBoundingClientRect(); img.animate([{ transform: `translate(${r.left - e.left}px,${r.top - e.top}px) scale(${r.width / e.width},${r.height / e.height})`, borderRadius: '24px' }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' }); img.onload = null; };
  }
}
function open(i, from) { origin = from; lb.hidden = false; requestAnimationFrame(() => lb.classList.add('is-open')); document.body.style.overflow = 'hidden'; show(i, from); $('#lb-close').focus(); }
function close() { lb.classList.remove('is-open'); document.body.style.overflow = ''; setTimeout(() => { lb.hidden = true; }, 350); origin && origin.focus && origin.focus(); }
$('#grid').addEventListener('click', (e) => { const b = e.target.closest('.gitem'); if (b) open(Number(b.dataset.i), b.querySelector('img')); });
$('#lb-close').addEventListener('click', close); $('#lb-prev').addEventListener('click', () => show(idx - 1)); $('#lb-next').addEventListener('click', () => show(idx + 1));
lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
document.addEventListener('keydown', (e) => { if (lb.hidden) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') show(idx + 1); if (e.key === 'ArrowLeft') show(idx - 1); });
let sx = 0; lb.addEventListener('touchstart', (e) => { sx = e.changedTouches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); }, { passive: true });
