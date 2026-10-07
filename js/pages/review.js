import { init, db } from '../dataService.js';
import { initI18n, t, onLangChange } from '../i18n.js';
import { mountPublicLayout } from '../layout.js';
import { hydrateIcons, icon, starsHTML } from '../icons.js';
import { $, $$, param, esc, fmtDate, store } from '../utils.js';
import { toast, checkDrawSVG, confetti } from '../ui.js';

await init();
await initI18n(['review']);
mountPublicLayout({ active: '', preloader: false });
hydrateIcons();

const CATS = ['food', 'service', 'ambience', 'cleanliness'];
const TAGS = ['food', 'service', 'clean', 'value', 'staff', 'ac'];
const PAGE = 3;
const state = { rating: 0, cats: { food: 0, service: 0, ambience: 0, cleanliness: 0 }, tags: new Set(), filter: 'all', shown: PAGE };
const voted = () => { try { return new Set(store.get('bbc:helpful') || []); } catch { return new Set(); } };

/* ---------- star inputs ---------- */
function stars(host, get, set) {
  host.innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${t('review.star', { n })}" data-n="${n}">${icon('starfill')}</button>`).join('');
  const paint = (v) => $$('button', host).forEach((b) => { const n = Number(b.dataset.n); b.classList.toggle('is-on', n <= v); b.setAttribute('aria-checked', n === v); });
  host.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; set(Number(b.dataset.n)); paint(get()); });
  host.addEventListener('keydown', (e) => { if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return; e.preventDefault(); set(Math.min(5, Math.max(1, get() + (e.key === 'ArrowRight' ? 1 : -1)))); paint(get()); });
  paint(get());
}
const mood = () => { $('#mood').textContent = state.rating ? t('review.s' + state.rating) : t('review.tap'); $('#mood').classList.toggle('is-set', !!state.rating); };
function drawForm() {
  stars($('#stars'), () => state.rating, (v) => { state.rating = v; $('#f-rating').classList.remove('has-error'); mood(); });
  mood();
  $('#tags').innerHTML = TAGS.map((k) => `<button type="button" class="rv-tag ${state.tags.has(k) ? 'is-on' : ''}" data-k="${k}" aria-pressed="${state.tags.has(k)}">${t('review.tag_' + k)}</button>`).join('');
  $('#cats').innerHTML = CATS.map((k) => `<div class="cat-row"><span>${t('review.' + k)}</span><div class="star-input" data-cat="${k}"></div></div>`).join('');
  $$('[data-cat]').forEach((h) => stars(h, () => state.cats[h.dataset.cat], (v) => { state.cats[h.dataset.cat] = v; }));
}
$('#tags').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k; state.tags.has(k) ? state.tags.delete(k) : state.tags.add(k); b.classList.toggle('is-on'); b.setAttribute('aria-pressed', state.tags.has(k)); });
$('#comment').addEventListener('input', (e) => { $('#count').textContent = e.target.value.length; });
const tbl = param('table'); if (tbl) $('#table').value = tbl;

/* ---------- score card, breakdown, list (approved reviews only) ---------- */
const approved = () => db.list('reviews', (r) => r.status === 'approved').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
function score() {
  const rv = approved(); const box = $('#rv-score');
  if (!rv.length) { box.innerHTML = `<b>–</b><a class="btn btn--primary btn--block" href="#write">${t('review.scoreBtn')}</a>`; return; }
  const avg = rv.reduce((s, r) => s + r.rating, 0) / rv.length;
  box.innerHTML = `<b>${avg.toFixed(1)}</b>${starsHTML(avg)}<span>${t('review.reviewsN', { c: rv.length })}</span><a class="btn btn--primary btn--block" href="#write">${t('review.scoreBtn')}</a>`;
}
function breakdown() {
  const rv = approved(); const box = $('#summary'); box.hidden = !rv.length; if (!rv.length) return;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: rv.filter((r) => r.rating === n).length }));
  const cat = (k) => { const a = rv.filter((r) => r.categories && r.categories[k]); return a.length ? a.reduce((s, r) => s + r.categories[k], 0) / a.length : 0; };
  box.innerHTML = `<h2>${t('review.breakT')}</h2>
    <ul class="rv-dist">${dist.map((d) => `<li><span>${d.n}</span>${icon('starfill')}<i class="bar"><i style="width:${(d.c / rv.length) * 100}%"></i></i><em>${d.c}</em></li>`).join('')}</ul>
    <h3 class="rv-sub">${t('review.byCat')}</h3>
    <ul class="rv-catavg">${CATS.map((k) => `<li><span>${t('review.' + k)}</span><i class="bar"><i style="width:${cat(k) * 20}%"></i></i><b>${cat(k) ? cat(k).toFixed(1) : '–'}</b></li>`).join('')}</ul>`;
}
const FILTERS = [['all', 'fAll'], ['5', 'f5'], ['4', 'f4'], ['low', 'f3']];
function list() {
  $('#rv-filter').innerHTML = FILTERS.map(([k, l]) => `<button type="button" class="chip ${state.filter === k ? 'is-active' : ''}" data-f="${k}" aria-pressed="${state.filter === k}">${t('review.' + l)}</button>`).join('');
  let rv = approved();
  if (state.filter === '5') rv = rv.filter((r) => r.rating === 5); else if (state.filter === '4') rv = rv.filter((r) => r.rating === 4); else if (state.filter === 'low') rv = rv.filter((r) => r.rating <= 3);
  const v = voted();
  $('#rv-grid').innerHTML = rv.length ? rv.slice(0, state.shown).map((r) => `
    <article class="rv-card">
      <header>
        <span class="rv-avatar" aria-hidden="true">${esc((r.name || 'G').trim().charAt(0).toUpperCase())}</span>
        <div><b>${esc(r.name || 'Guest')}</b><small>${t('review.verified')}${r.tableNo ? ' · ' + t('review.table', { n: r.tableNo }) : ''}</small></div>
        <div class="rv-card__r">${starsHTML(r.rating)}<small>${esc(fmtDate(r.createdAt))}</small></div>
      </header>
      ${r.title ? `<h3>${esc(r.title)}</h3>` : ''}
      <p>${esc(r.comment)}</p>
      ${(r.tags || []).length ? `<div class="rv-chips">${r.tags.map((k) => `<span>${esc(t('review.tag_' + k))}</span>`).join('')}</div>` : ''}
      ${r.reply ? `<div class="rv-reply"><b>${t('review.ownerReply')}</b>${esc(r.reply)}</div>` : ''}
      <footer><button type="button" class="rv-help ${v.has(r.id) ? 'is-on' : ''}" data-h="${r.id}" ${v.has(r.id) ? 'disabled' : ''}>${t('review.helpful')} (${r.helpful || 0})</button></footer>
    </article>`).join('') : `<p class="rv-empty">${t('review.empty')}</p>`;
  $('#more').hidden = rv.length <= state.shown;
}
$('#rv-filter').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; state.filter = b.dataset.f; state.shown = PAGE; list(); });
$('#more').addEventListener('click', () => { state.shown += PAGE; list(); });
$('#rv-grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-h]'); if (!b) return; const v = voted(); if (v.has(b.dataset.h)) return;
  const r = db.get('reviews', b.dataset.h); if (!r) return; db.update('reviews', r.id, { helpful: (r.helpful || 0) + 1 }); v.add(r.id);
  try { store.set('bbc:helpful', [...v]); } catch { /* ignore */ } list();
});

const all = () => { score(); breakdown(); list(); };
drawForm(); all();
onLangChange(() => { drawForm(); all(); });
db.onChange((c) => { if (c === 'reviews') all(); });

/* ---------- submit ---------- */
$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!state.rating) { $('#f-rating').classList.add('has-error'); $('#stars button').focus(); return; }
  db.create('reviews', { name: $('#name').value.trim() || 'Guest', title: $('#title').value.trim(), rating: state.rating, comment: $('#comment').value.trim(), categories: { ...state.cats }, tags: [...state.tags], helpful: 0, status: 'pending', tableNo: Number($('#table').value) || null, createdAt: new Date().toISOString(), reply: '' });
  $('#form').hidden = true; const th = $('#thanks'); th.hidden = false;
  th.innerHTML = `${checkDrawSVG(88)}<h2>${t('review.thanksTitle')}</h2><p>${t('review.thanksText')}</p><a class="btn btn--primary" href="index.html">${t('review.back')}</a>`;
  confetti(60); toast(t('review.thanksTitle'));
});
