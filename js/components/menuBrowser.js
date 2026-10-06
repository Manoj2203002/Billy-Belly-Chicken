/* ==========================================================================
   menuBrowser.js - shared menu UI for menu.html (browse), order.html and parcel.html (order).
   createMenuBrowser({ container, mode:'browse'|'order', cart, onAdd(item, sourceEl) }) -> { render(), destroy() }
   ========================================================================== */
import { db } from '../dataService.js';
import { t, tr, onLangChange } from '../i18n.js';
import { el, esc, money, imgSrc, debounce } from '../utils.js';
import { icon, spiceHTML, vegMark } from '../icons.js';
import { initTabs, flip, initTilt, initReveal, skeletonHTML, emptyState } from '../ui.js';
import { priceLines, resolveItem } from '../orderService.js';

export function createMenuBrowser({ container, mode = 'browse', cart = null, onAdd = null }) {
  const st = { cat: 'all', q: '', diet: 'all', spice: 'all', sort: 'default', chef: false, best: false };
  const ordering = mode === 'order' && cart;
  let tabsApi = null;

  container.innerHTML = `
    <div class="mb__bar">
      <div class="mb__tools">
        <label class="input-group mb__search">${icon('search')}<input class="input" type="search" data-i18n-placeholder="menu.search" autocomplete="off" aria-label="${t('menu.search')}"></label>
        <div class="chip-row mb__chips" role="group" aria-label="${t('menu.filters')}">
          <button type="button" class="chip" data-diet="all" aria-pressed="true" data-i18n="menu.all"></button>
          <button type="button" class="chip" data-diet="veg" aria-pressed="false">${vegMark(true)}<span data-i18n="food.veg"></span></button>
          <button type="button" class="chip" data-diet="non" aria-pressed="false">${vegMark(false)}<span data-i18n="food.nonveg"></span></button>
          <button type="button" class="chip" data-flag="chef" aria-pressed="false">${icon('chef')}<span data-i18n="tag.chefs-pick"></span></button>
          <button type="button" class="chip" data-flag="best" aria-pressed="false">${icon('award')}<span data-i18n="tag.bestseller"></span></button>
        </div>
        <div class="mb__selects">
          <select class="select" data-spice aria-label="${t('menu.spice')}"><option value="all" data-i18n="menu.anySpice"></option><option value="0" data-i18n="food.spice.0"></option><option value="1" data-i18n="food.spice.1"></option><option value="2" data-i18n="food.spice.2"></option><option value="3" data-i18n="food.spice.3"></option></select>
          <select class="select" data-sort aria-label="${t('menu.sort')}"><option value="default" data-i18n="menu.sortDefault"></option><option value="asc" data-i18n="menu.sortAsc"></option><option value="desc" data-i18n="menu.sortDesc"></option></select>
        </div>
      </div>
      <div class="tabs mb__tabs" role="tablist" aria-label="${t('menu.categories')}"></div>
    </div>
    <div class="mb__special" hidden></div>
    <div class="mb__grid" aria-live="polite">${skeletonHTML(6, '300px')}</div>
    <div class="mb__empty" hidden></div>`;
  const $q = (s) => container.querySelector(s);
  const grid = $q('.mb__grid'); const tabsEl = $q('.mb__tabs'); const specialEl = $q('.mb__special'); const emptyEl = $q('.mb__empty');

  const cats = () => db.list('categories', (c) => c.active !== false).sort((a, b) => a.order - b.order);
  function drawTabs() {
    tabsEl.innerHTML = [{ id: 'all', name: { en: 'All', ta: 'அனைத்தும்' } }, ...cats()].map((c) => `<button type="button" role="tab" class="tabs__tab ${c.id === st.cat ? 'is-active' : ''}" data-id="${c.id}" aria-selected="${c.id === st.cat}">${esc(tr(c.name))}</button>`).join('');
    tabsApi = initTabs(tabsEl, { onChange: (id) => { st.cat = id; paint(true); } });
    tabsApi.select(st.cat);
  }

  /* unit price after the best active offer */
  function offerInfo(item) {
    const p = priceLines([{ itemId: item.id, qty: 1 }]);
    const l = p.items[0]; return l && l.lineDiscount > 0 ? { now: item.price - l.lineDiscount, off: l.lineDiscount } : null;
  }
  function visible() {
    let list = db.list('menu');
    if (st.cat !== 'all') list = list.filter((m) => m.categoryId === st.cat);
    if (st.diet === 'veg') list = list.filter((m) => m.isVeg); if (st.diet === 'non') list = list.filter((m) => !m.isVeg);
    if (st.spice !== 'all') list = list.filter((m) => m.spiceLevel === Number(st.spice));
    if (st.chef) list = list.filter((m) => (m.tags || []).includes('chefs-pick'));
    if (st.best) list = list.filter((m) => (m.tags || []).includes('bestseller'));
    const q = st.q.trim().toLowerCase();
    if (q) list = list.filter((m) => `${m.name.en} ${m.name.ta} ${m.description.en} ${m.description.ta}`.toLowerCase().includes(q));
    const catOrder = Object.fromEntries(cats().map((c, i) => [c.id, i]));
    list.sort((a, b) => (st.sort === 'asc' ? a.price - b.price : st.sort === 'desc' ? b.price - a.price : (catOrder[a.categoryId] - catOrder[b.categoryId]) || a.order - b.order));
    return list;
  }
  function cardHTML(m) {
    const o = offerInfo(m); const sold = m.available === false; const qty = ordering ? cart.qtyOf(m.id) : 0;
    const tags = (m.tags || []).map((g) => `<span class="badge ${g === 'new' ? 'badge--red' : ''}">${esc(t('tag.' + g))}</span>`).join('');
    const action = !ordering ? '' : sold ? `<span class="badge">${t('food.soldOut')}</span>` : qty
      ? `<div class="stepper" data-stepper><button type="button" data-dec aria-label="-">${icon('minus')}</button><span class="stepper__val">${qty}</span><button type="button" data-inc aria-label="+">${icon('plus')}</button></div>`
      : `<button type="button" class="btn btn--primary btn--sm" data-add>${icon('plus')}<span>${t('food.add')}</span></button>`;
    return `<article class="mcard ${sold ? 'is-sold' : ''}" data-key="${m.id}" data-id="${m.id}" >
      <div class="media mcard__media"><img src="${imgSrc(m.image)}" alt="${esc(tr(m.name))}" loading="lazy" width="800" height="600">
        <div class="mcard__tags">${tags}</div>${o ? `<span class="mcard__off badge badge--red">${t('menu.save', { n: money(o.off) })}</span>` : ''}${sold ? `<div class="mcard__sold"><span>${t('food.soldOut')}</span></div>` : ''}</div>
      <div class="mcard__body"><div class="mcard__top">${vegMark(m.isVeg)}<h3 class="mcard__name">${esc(tr(m.name))}</h3></div>
        <p class="mcard__desc">${esc(tr(m.description))}</p>
        <div class="mcard__foot"><div class="mcard__price"><span class="price" data-cur="₹">${o ? o.now : m.price}</span>${o ? `<s>${money(m.price)}</s>` : ''}${spiceHTML(m.spiceLevel)}</div>${action}</div></div></article>`;
  }
  function paint(animate) {
    const list = visible();
    const run = () => { grid.innerHTML = list.map(cardHTML).join(''); emptyEl.hidden = list.length > 0; grid.hidden = !list.length; if (!list.length) emptyEl.innerHTML = emptyState({ icon: 'search', title: t('common.noResults'), text: t('common.noResultsHint') }); };
    animate && grid.children.length ? flip(grid, run) : run();
  }
  function drawSpecial() {
    const sp = db.list('specials', (s) => s.active !== false).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    if (!sp) { specialEl.hidden = true; return; }
    const sold = false; const qty = ordering ? cart.qtyOf(sp.id) : 0;
    specialEl.hidden = false;
    specialEl.innerHTML = `<div class="mspecial dark"><img src="${imgSrc(sp.image)}" alt="" loading="lazy"><div class="mspecial__txt"><span class="badge badge--red badge--live">${t('menu.todaySpecial')}</span><h3 class="display display--lg">${esc(tr(sp.title))}</h3><p class="text-muted">${esc(tr(sp.description))}</p>
      <div class="mspecial__foot"><span class="price" data-cur="₹">${sp.price}</span>${sp.originalPrice ? `<s>${money(sp.originalPrice)}</s>` : ''}${ordering && !sold ? (qty ? `<div class="stepper" data-stepper data-sp="${sp.id}"><button type="button" data-dec>${icon('minus')}</button><span class="stepper__val">${qty}</span><button type="button" data-inc>${icon('plus')}</button></div>` : `<button type="button" class="btn btn--primary" data-add data-sp="${sp.id}">${icon('plus')}<span>${t('food.add')}</span></button>`) : ''}</div></div></div>`;
  }

  /* events */
  const onSearch = debounce((v) => { st.q = v; paint(true); }, 180);
  $q('.mb__search input').addEventListener('input', (e) => onSearch(e.target.value));
  container.querySelectorAll('[data-diet]').forEach((b) => b.addEventListener('click', () => { st.diet = b.dataset.diet; container.querySelectorAll('[data-diet]').forEach((x) => x.setAttribute('aria-pressed', x === b)); container.querySelectorAll('[data-diet]').forEach((x) => x.classList.toggle('is-active', x === b)); paint(true); }));
  container.querySelectorAll('[data-flag]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.flag; st[k] = !st[k]; b.setAttribute('aria-pressed', st[k]); b.classList.toggle('is-active', st[k]); paint(true); }));
  $q('[data-spice]').addEventListener('change', (e) => { st.spice = e.target.value; paint(true); });
  $q('[data-sort]').addEventListener('change', (e) => { st.sort = e.target.value; paint(true); });
  container.querySelector('[data-diet="all"]').classList.add('is-active');
  const act = (e) => {
    if (!ordering) return; const btn = e.target.closest('[data-add],[data-inc],[data-dec]'); if (!btn) return;
    const host = btn.closest('[data-id],[data-sp]'); const id = host.dataset.id || host.dataset.sp || btn.dataset.sp; const item = resolveItem(id); if (!item) return;
    if (btn.hasAttribute('data-dec')) cart.setQty(id, cart.qtyOf(id) - 1);
    else { if (!cart.add(id, 1)) return; onAdd && onAdd(item, btn); }
    refreshQty();
  };
  container.addEventListener('click', act);
  function refreshQty() {
    container.querySelectorAll('.mcard').forEach((card) => { const m = db.get('menu', card.dataset.id); if (!m) return; const foot = card.querySelector('.mcard__foot'); const old = foot.lastElementChild; const tmp = el('div', { html: cardHTML(m) }); const nw = tmp.querySelector('.mcard__foot').lastElementChild; if (old && nw && old.outerHTML !== nw.outerHTML) { old.replaceWith(nw); const v = nw.querySelector('.stepper__val'); v && v.classList.add('bump'); } });
    drawSpecial();
  }
  function render() { drawTabs(); drawSpecial(); paint(false); applyText(); initReveal(container); }
  const applyText = () => { container.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); }); container.querySelectorAll('[data-i18n-placeholder]').forEach((n) => n.setAttribute('placeholder', t(n.dataset.i18nPlaceholder))); };
  const off = onLangChange(render); const offDb = db.onChange((c) => { if (['menu', 'offers', 'specials', 'categories'].includes(c)) { drawTabs(); drawSpecial(); paint(false); } });
  render();
  return { render, refresh: refreshQty, destroy() { off(); offDb(); } };
}
