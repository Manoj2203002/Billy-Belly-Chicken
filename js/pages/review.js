import { init, db } from '../dataService.js';
import { initI18n, t, onLangChange } from '../i18n.js';
import { mountPublicLayout } from '../layout.js';
import { hydrateIcons, icon, starsHTML } from '../icons.js';
import { $, $$, param, store } from '../utils.js';
import { toast, checkDrawSVG, confetti } from '../ui.js';
import { avgRating } from '../orderService.js';

await init();
await initI18n(['review']);
mountPublicLayout({ active: '', preloader: false });
hydrateIcons();

const state = { rating: 0, cats: { food: 0, service: 0, ambience: 0, cleanliness: 0 } };
function stars(host, key, setter) {
  host.innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${t('review.star', { n })}" data-n="${n}">${icon('starfill')}</button>`).join('');
  const paint = (v) => $$('button', host).forEach((b) => { const on = Number(b.dataset.n) <= v; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', Number(b.dataset.n) === v); });
  host.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setter(Number(b.dataset.n)); paint(Number(b.dataset.n)); } });
  host.addEventListener('keydown', (e) => { if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return; const v = Math.min(5, Math.max(1, (key === 'rating' ? state.rating : state.cats[key]) + (e.key === 'ArrowRight' ? 1 : -1))); setter(v); paint(v); });
  return paint;
}
const mainPaint = stars($('#stars'), 'rating', (v) => { state.rating = v; $('#f-rating').classList.remove('has-error'); });
function drawCats() {
  $('#cats').innerHTML = ['food', 'service', 'ambience', 'cleanliness'].map((k) => `<div class="cat-row"><span>${t('review.' + k)}</span><div class="star-input" data-cat="${k}"></div></div>`).join('');
  $$('[data-cat]').forEach((h) => { const p = stars(h, h.dataset.cat, (v) => { state.cats[h.dataset.cat] = v; }); p(state.cats[h.dataset.cat]); });
}
drawCats(); mainPaint(state.rating);
const tbl = param('table'); if (tbl) $('#table').value = tbl;
function avg() { const n = db.list('reviews', (r) => r.status === 'approved').length; const box = $('#avg'); box.hidden = !n; if (n) box.innerHTML = `<b>${avgRating()}</b><div>${starsHTML(avgRating())}<div class="text-muted">${t('review.avg', { n: avgRating(), c: n })}</div></div>`; }
avg(); onLangChange(() => { drawCats(); mainPaint(state.rating); avg(); });

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!state.rating) { $('#f-rating').classList.add('has-error'); $('#stars button').focus(); return; }
  const tn = Number($('#table').value) || null;
  db.create('reviews', { name: $('#name').value.trim() || 'Guest', rating: state.rating, comment: $('#comment').value.trim(), categories: { ...state.cats }, status: 'pending', tableNo: tn, createdAt: new Date().toISOString(), reply: '' });
  $('#form').hidden = true; const th = $('#thanks'); th.hidden = false;
  th.innerHTML = `${checkDrawSVG(96)}<h2 class="display display--xl">${t('review.thanksTitle')}</h2><p class="text-muted">${t('review.thanksText')}</p><a class="btn btn--primary" href="index.html">${t('review.back')}</a>`;
  confetti(60); toast(t('review.thanksTitle'));
});
