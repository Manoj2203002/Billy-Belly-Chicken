import { init, db } from '../dataService.js';
import { initI18n, t, tr, onLangChange, applyI18n } from '../i18n.js';
import { mountPublicLayout } from '../layout.js';
import { hydrateIcons, icon } from '../icons.js';
import { $, $$, el, esc, money, param, imgSrc, fmtTime, store, setCurrency } from '../utils.js';
import { createCart } from '../cart.js';
import { createMenuBrowser } from '../components/menuBrowser.js';
import { createDrawer, openModal, confirmDialog, toast, flyToCart, confetti, checkDrawSVG, countTo } from '../ui.js';
import * as os from '../orderService.js';
import { subscribe } from '../orderSync.js';

await init();
await initI18n(['menu', 'order']);
mountPublicLayout({ active: '', footer: false, floating: false, preloader: false });
hydrateIcons();
const settings = db.get('settings'); setCurrency(settings.currency);

const tableNo = Number(param('table'));
const table = os.getTableByNumber(tableNo);
const state = $('#state');
const showState = (icn, title, text, extra = '') => {
  $('#view-menu').hidden = true; $('#view-orders').hidden = true; $('.bottomnav').hidden = true; $('#cartbar').hidden = true;
  state.hidden = false; state.innerHTML = `${icon(icn, { cls: 'big' })}<h2>${title}</h2><p class="text-muted">${text}</p>${extra}`;
};

/* ---------- guards: valid table, master switch, hours ---------- */
if (!table) {
  $('#table-no').textContent = '?';
  showState('alert', t('order.invalidTitle'), t('order.invalidText'), `<a class="btn btn--primary" href="menu.html">${t('order.backMenu')}</a>`);
} else if (!os.acceptingStatus().ok) {
  $('#table-no').textContent = table.number;
  const s = os.acceptingStatus(); const tm = settings.timings || {};
  showState('clock', t('order.closedTitle'), s.code === 'OUTSIDE_HOURS' ? t('order.closedHours', { open: tm.open, close: tm.close }) : t('order.closedText'), `<a class="btn btn--ghost" href="menu.html">${t('order.backMenu')}</a>`);
} else start();

function start() {
  $('#table-no').textContent = table.number;
  $('#table-area').textContent = `${table.area} · ${table.seats} ${t('order.seats')}`;
  os.claimSession(tableNo);
  const cart = createCart(`table-${tableNo}`);
  cart.prune();
  let view = 'menu';

  const browser = createMenuBrowser({ container: $('#menu-root'), mode: 'order', cart, onAdd: (item, src) => { flyToCart(src, $('#open-cart')); } });

  /* ---------- cart bar ---------- */
  function paintBar() {
    const n = cart.count(); const bar = $('#cartbar'); bar.hidden = n === 0 || view !== 'menu';
    $('#cart-count').textContent = n; $('#cart-total').textContent = money(cart.pricing().total);
  }
  cart.onChange(() => { paintBar(); if (drawer.isOpen) paintCart(); });

  /* ---------- cart drawer ---------- */
  const drawer = createDrawer({ title: t('order.cart') });
  let placing = false; let cdTimer = null;
  function paintCart() {
    const p = cart.pricing(); drawer.titleEl.textContent = t('order.cart');
    if (!p.items.length) { drawer.body.innerHTML = `<div class="empty">${icon('cart')}<p>${t('order.cartEmpty')}</p></div>`; drawer.foot.innerHTML = ''; return; }
    const keep = { name: $('#cust-name', drawer.body)?.value || store.get('bbc:custName', ''), guests: $('#cust-guests', drawer.body)?.value || store.get('bbc:custGuests', 2) };
    drawer.body.innerHTML = p.items.map((l) => `<div class="cart-line" data-id="${l.itemId}"><div class="cart-line__top"><img src="${imgSrc(l.image)}" alt=""><div class="cart-line__name">${esc(tr(l.name))}${l.lineDiscount ? `<div class="text-faint" style="font-size:var(--fs-xs)">${t('order.offer')}: -${money(l.lineDiscount)}</div>` : ''}</div><div class="cart-line__price">${money(l.lineTotal)}</div></div>
      <div class="cart-line__bar"><div class="stepper"><button type="button" data-dec aria-label="-">${icon('minus')}</button><span class="stepper__val">${l.qty}</span><button type="button" data-inc aria-label="+">${icon('plus')}</button></div><button type="button" class="btn btn--sm btn--ghost" data-rm>${icon('trash')}<span>${t('order.remove')}</span></button></div>
      <input class="input" data-note maxlength="80" placeholder="${esc(t('order.notePh'))}" value="${esc(cart.lines().find((x) => x.itemId === l.itemId)?.note || '')}" aria-label="${esc(t('order.notePh'))}"></div>`).join('')
      + `<div class="cart-form"><label class="field"><span class="field__label">${t('order.nameLbl')}</span><input class="input" id="cust-name" maxlength="40" value="${esc(keep.name)}"></label><label class="field"><span class="field__label">${t('order.guestsLbl')}</span><input class="input" id="cust-guests" type="number" min="1" max="20" value="${keep.guests}"></label></div>
      <div class="cart-sum"><div class="kv"><span>${t('order.subtotal')}</span><span>${money(p.subtotal)}</span></div>${p.discount ? `<div class="kv"><span>${t('order.offer')}</span><span>-${money(p.discount)}</span></div>` : ''}<div class="kv"><span>${esc(settings.taxName || 'GST')} (${p.taxPct}%)</span><span>${money(p.tax)}</span></div><div class="kv kv--total"><span>${t('order.total')}</span><span>${money(p.total)}</span></div></div>
      <div class="bill__pay">${icon('money')}<span>${t('order.payAtCounter')}</span></div>`;
    drawer.foot.innerHTML = `<button type="button" class="btn btn--primary btn--lg btn--block" id="place">${icon('check')}<span>${t('order.place')}</span></button>`;
    updatePlaceBtn();
  }
  function updatePlaceBtn() {
    const b = $('#place', drawer.foot); if (!b) return; clearInterval(cdTimer);
    const tick = () => { const left = os.cooldownLeft(`table-${tableNo}`); b.disabled = left > 0 || placing; $('span', b).textContent = left > 0 ? t('order.wait', { n: left }) : placing ? t('order.placing') : t('order.place'); if (left <= 0) clearInterval(cdTimer); };
    tick(); cdTimer = setInterval(tick, 500);
  }
  drawer.body.addEventListener('click', (e) => {
    const line = e.target.closest('.cart-line'); if (!line) return; const id = line.dataset.id; const q = cart.qtyOf(id);
    if (e.target.closest('[data-inc]')) cart.setQty(id, q + 1); else if (e.target.closest('[data-dec]')) cart.setQty(id, q - 1); else if (e.target.closest('[data-rm]')) cart.remove(id);
    browser.refresh();
  });
  drawer.body.addEventListener('change', (e) => { if (e.target.matches('[data-note]')) cart.setNote(e.target.closest('.cart-line').dataset.id, e.target.value.trim()); });
  $('#open-cart').addEventListener('click', () => { paintCart(); drawer.open(); });

  async function place(force = false) {
    if (placing) return; const name = ($('#cust-name', drawer.body)?.value || '').trim(); const guests = Number($('#cust-guests', drawer.body)?.value) || 1;
    $$('[data-note]', drawer.body).forEach((n) => cart.setNote(n.closest('.cart-line').dataset.id, n.value.trim()));
    store.set('bbc:custName', name); store.set('bbc:custGuests', guests);
    placing = true; updatePlaceBtn();
    await new Promise((r) => setTimeout(r, 450));
    try {
      const order = os.placeDineIn({ tableNo, customer: { name, guests }, lines: cart.lines(), force });
      cart.clear(); drawer.close(); browser.refresh(); placing = false; setView('orders'); showConfirm(order);
    } catch (e) {
      placing = false;
      if (e.code === 'DUPLICATE') { const ok = await confirmDialog({ title: t('order.dupTitle'), message: t('order.dupText'), confirmText: t('order.sendAgain') }); if (ok) return place(true); }
      else if (e.code === 'COOLDOWN') toast(t('order.cooldown', { n: e.seconds }), { type: 'warn' });
      else if (e.code === 'SOLD_OUT') { cart.prune(); browser.refresh(); toast(t('order.soldOut'), { type: 'warn' }); }
      else if (e.code === 'EMPTY') toast(t('order.emptyCart'), { type: 'warn' });
      else if (e.code === 'BAD_TOKEN') { drawer.close(); badToken(); }
      else if (e.code === 'SWITCH_OFF' || e.code === 'OUTSIDE_HOURS') location.reload();
      else toast(t('common.error'), { type: 'error' });
      updatePlaceBtn();
    }
  }
  drawer.foot.addEventListener('click', (e) => { if (e.target.closest('#place')) place(); });
  function badToken() {
    const m = openModal({ title: t('order.badToken'), size: 'sm', body: `<p class="text-muted">${t('order.badTokenText')}</p>`, footer: [el('button', { class: 'btn btn--primary', type: 'button', onclick: () => { os.claimSession(tableNo); m.close(); toast(t('common.ok')); } }, t('order.newSession'))] });
  }
  function showConfirm(order) {
    const m = openModal({ size: 'sm', dismissible: true, body: `<div class="confirm-pop">${checkDrawSVG(96)}<h2 class="display display--lg">${t('order.placedTitle')}</h2><div class="confirm-pop__id">${order.id}</div><p class="text-muted">${t('order.table')} ${tableNo} · ${t('order.placedText')}</p></div>`, footer: [el('button', { class: 'btn btn--primary', type: 'button', onclick: () => m.close() }, t('order.viewOrders'))] });
    confetti(80);
  }

  /* ---------- orders view: rounds, tracker, bill ---------- */
  const FLOW = os.DINE_FLOW; const STEP_ICO = { placed: 'receipt', confirmed: 'checkcircle', served: 'utensils', completed: 'star' };
  function tracker(o) {
    const idx = FLOW.indexOf(o.status);
    return `<div class="tracker" style="--steps:${FLOW.length};--prog:${Math.max(0, idx) / (FLOW.length - 1)}" role="list">${FLOW.map((s, i) => `<div class="tracker__step ${i < idx || o.status === 'completed' ? 'is-done' : ''} ${i === idx && o.status !== 'completed' ? 'is-current' : ''}" role="listitem"><span class="tracker__dot">${icon(i < idx || o.status === 'completed' ? 'check' : STEP_ICO[s])}</span><span>${t('order.status.' + s)}</span></div>`).join('')}</div>`;
  }
  function paintOrders() {
    const host = $('#view-orders'); const tab = os.tabForTable(tableNo);
    const active = tab.orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length;
    const dot = $('#orders-dot'); dot.hidden = !active; dot.textContent = active;
    let html = `<h2 class="display display--xl" style="margin-top:var(--sp-6)">${t('order.yourOrders')}</h2>`;
    if (!tab.orders.length) html += `<div class="empty empty-orders">${icon('receipt')}<p>${t('order.noOrders')}</p><button class="btn btn--primary" type="button" data-view="menu">${t('order.navMenu')}</button></div>`;
    tab.orders.forEach((o, i) => {
      html += `<article class="round card" data-id="${o.id}"><div class="round__head"><div><div class="round__id">${o.id}</div><div class="text-faint" style="font-size:var(--fs-xs)">${t('order.round', { n: i + 1 })} · ${fmtTime(o.createdAt)}</div></div>${o.status === 'cancelled' ? `<span class="badge badge--outline">${t('order.cancelledBadge')}</span>` : o.status === 'placed' ? `<button type="button" class="btn btn--sm btn--danger" data-cancel="${o.id}">${icon('close')}<span>${t('order.cancel')}</span></button>` : ''}</div>
        ${o.status === 'cancelled' ? '' : tracker(o)}
        <ul class="round__items">${o.items.map((it) => `<li><span>${it.qty} × ${esc(tr(it.name))}${it.note ? `<span class="round__note">${esc(it.note)}</span>` : ''}</span><span>${money(it.price * it.qty)}</span></li>`).join('')}</ul>
        ${o.status === 'placed' ? `<p class="text-faint" style="font-size:var(--fs-xs)">${t('order.cancelHint')}</p>` : ''}</article>`;
    });
    if (tab.live.length) html += `<section class="bill card" aria-label="${t('order.billTitle')}"><h2>${t('order.billTitle')}</h2><div class="kv"><span>${t('order.subtotal')}</span><span>${money(tab.subtotal)}</span></div>${tab.discount ? `<div class="kv"><span>${t('order.offer')}</span><span>-${money(tab.discount)}</span></div>` : ''}<div class="kv"><span>${esc(settings.taxName || 'GST')}</span><span>${money(tab.tax)}</span></div><div class="kv kv--total"><span>${t('order.total')}</span><span>${money(tab.total)}</span></div><div class="bill__pay">${icon('money')}<span>${t('order.payAtCounter')}</span></div><div class="cluster" style="margin-top:var(--sp-4)"><button type="button" class="btn btn--ghost" id="b2">${icon('hand')}<span>${t('order.callWaiter')}</span></button><button type="button" class="btn btn--primary" id="b3">${icon('bill')}<span>${t('order.requestBill')}</span></button></div></section>`;
    host.innerHTML = html; hydrateIcons(host);
    $('#b2')?.addEventListener('click', callWaiter); $('#b3')?.addEventListener('click', askBill);
  }
  $('#view-orders').addEventListener('click', async (e) => {
    const c = e.target.closest('[data-cancel]'); if (c) { if (!(await confirmDialog({ title: t('order.cancel'), message: t('order.cancelConfirm'), danger: true }))) return;
      try { os.cancelByCustomer(c.dataset.cancel); toast(t('order.cancelled')); } catch { toast(t('order.cancelFail'), { type: 'warn' }); } paintOrders(); }
    const v = e.target.closest('[data-view]'); if (v) setView(v.dataset.view);
  });

  /* ---------- view switching + actions ---------- */
  function setView(v) {
    view = v; $('#view-menu').hidden = v !== 'menu'; $('#view-orders').hidden = v !== 'orders';
    $$('.bottomnav__btn[data-view]').forEach((b) => b.classList.toggle('is-active', b.dataset.view === v));
    if (v === 'orders') paintOrders(); paintBar(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('.bottomnav__btn[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  function callWaiter() {
    const s = os.getSession(tableNo);
    if (s && s.callWaiter && Date.now() - new Date(s.callWaiter).getTime() < 60000) return toast(t('order.callCooldown'), { type: 'warn' });
    os.callWaiter(tableNo); toast(t('order.called'), { type: 'ok' });
  }
  function askBill() { os.requestBill(tableNo); toast(t('order.billAsked'), { type: 'ok' }); setView('orders'); }
  $('#btn-call').addEventListener('click', callWaiter); $('#btn-bill').addEventListener('click', askBill);

  /* ---------- live updates (waiter changes status in another tab) ---------- */
  db.onChange((col) => { if (['orders', 'tableSessions'].includes(col) && view === 'orders') paintOrders(); if (col === 'settings' && !os.acceptingStatus().ok) location.reload(); if (col === 'menu') { cart.prune(); browser.refresh(); paintBar(); } });
  subscribe('table:closed', (m) => { if (Number(m.payload.tableNo) === tableNo) thanks(); });
  subscribe('order:status', () => { if (view === 'orders') paintOrders(); });
  function thanks() {
    cart.clear(); $('#view-menu').hidden = true; $('#view-orders').hidden = true; $('.bottomnav').hidden = true; $('#cartbar').hidden = true; drawer.close();
    state.hidden = false; state.innerHTML = `${checkDrawSVG(96)}<h2>${t('order.thanksTitle')}</h2><p class="text-muted">${t('order.thanksText')}</p><div class="cluster"><a class="btn btn--primary" href="review.html?table=${tableNo}">${icon('star')}<span>${t('order.leaveReview')}</span></a><button class="btn btn--ghost" type="button" onclick="location.reload()">${t('order.freshStart')}</button></div>`;
    confetti(60);
  }
  onLangChange(() => { paintBar(); if (drawer.isOpen) paintCart(); if (view === 'orders') paintOrders(); $('#table-area').textContent = `${table.area} · ${table.seats} ${t('order.seats')}`; });
  setInterval(() => { if (view === 'orders' && !document.hidden) paintOrders(); }, 5000);   // safety net if a broadcast is missed
  paintBar(); applyText();
  function applyText() { applyI18n(); }
}
