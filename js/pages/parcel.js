import { init, db } from '../dataService.js';
import { initI18n, t, tr, onLangChange, applyI18n } from '../i18n.js';
import { mountPublicLayout } from '../layout.js';
import { hydrateIcons, icon } from '../icons.js';
import { $, $$, el, esc, money, imgSrc, store, setCurrency, isPhone, cleanPhone } from '../utils.js';
import { createCart } from '../cart.js';
import { createMenuBrowser } from '../components/menuBrowser.js';
import { createDrawer, confirmDialog, toast, flyToCart, confetti, checkDrawSVG } from '../ui.js';
import * as os from '../orderService.js';
import { subscribe } from '../orderSync.js';

await init();
await initI18n(['menu', 'order', 'parcel']);
mountPublicLayout({ active: '', footer: false, floating: false, preloader: false });
hydrateIcons();
const settings = db.get('settings'); setCurrency(settings.currency);
const cart = createCart('parcel'); cart.prune();
const live = $('#live'); const state = $('#state');
const FLOW = os.PARCEL_FLOW; const ICO = { placed: 'receipt', confirmed: 'checkcircle', ready: 'bag', handed: 'star' };

if (!os.acceptingStatus().ok) {
  $('#view-menu').hidden = true;
  state.hidden = false; state.innerHTML = `${icon('clock', { cls: 'big' })}<h2>${t('parcel.closedTitle')}</h2><p class="text-muted">${t('parcel.closedText')}</p><a class="btn btn--ghost" href="menu.html">${t('order.backMenu')}</a>`;
} else start();

function start() {
  const browser = createMenuBrowser({ container: $('#menu-root'), mode: 'order', cart, onAdd: (item, src) => flyToCart(src, $('#open-cart')) });
  const bar = () => { const n = cart.count(); $('#cartbar').hidden = n === 0 || !$('#view-menu') || $('#view-menu').hidden; $('#cart-count').textContent = n; $('#cart-total').textContent = money(cart.pricing().total); };
  cart.onChange(() => { bar(); if (drawer.isOpen) paintCart(); });

  const drawer = createDrawer({ title: t('order.cart') }); let placing = false; let cd;
  function paintCart() {
    const p = cart.pricing(); drawer.titleEl.textContent = t('order.cart');
    if (!p.items.length) { drawer.body.innerHTML = `<div class="empty">${icon('cart')}<p>${t('order.cartEmpty')}</p></div>`; drawer.foot.innerHTML = ''; return; }
    const keep = { n: $('#p-name', drawer.body)?.value ?? store.get('bbc:pName', ''), ph: $('#p-phone', drawer.body)?.value ?? store.get('bbc:pPhone', '') };
    drawer.body.innerHTML = p.items.map((l) => `<div class="cart-line" data-id="${l.itemId}"><div class="cart-line__top"><img src="${imgSrc(l.image)}" alt=""><div class="cart-line__name">${esc(tr(l.name))}</div><div class="cart-line__price">${money(l.lineTotal)}</div></div><div class="cart-line__bar"><div class="stepper"><button type="button" data-dec aria-label="-">${icon('minus')}</button><span class="stepper__val">${l.qty}</span><button type="button" data-inc aria-label="+">${icon('plus')}</button></div><button type="button" class="btn btn--sm btn--ghost" data-rm>${icon('trash')}<span>${t('order.remove')}</span></button></div><input class="input" data-note maxlength="80" placeholder="${esc(t('order.notePh'))}" value="${esc(cart.lines().find((x) => x.itemId === l.itemId)?.note || '')}"></div>`).join('')
      + `<div class="cart-form cart-form--parcel"><div class="field" id="f-name"><label class="field__label" for="p-name">${t('parcel.name')}<span class="req">*</span></label><input class="input" id="p-name" maxlength="40" autocomplete="name" value="${esc(keep.n)}"><div class="field__error">${t('parcel.nameErr')}</div></div><div class="field" id="f-phone"><label class="field__label" for="p-phone">${t('parcel.phone')}<span class="req">*</span></label><input class="input" id="p-phone" inputmode="numeric" autocomplete="tel" maxlength="14" placeholder="${t('parcel.phoneHint')}" value="${esc(keep.ph)}"><div class="field__error">${t('parcel.phoneErr')}</div></div></div>
      <div class="cart-sum"><div class="kv"><span>${t('order.subtotal')}</span><span>${money(p.subtotal)}</span></div>${p.discount ? `<div class="kv"><span>${t('order.offer')}</span><span>-${money(p.discount)}</span></div>` : ''}<div class="kv"><span>${esc(settings.taxName || 'GST')} (${p.taxPct}%)</span><span>${money(p.tax)}</span></div><div class="kv kv--total"><span>${t('order.total')}</span><span>${money(p.total)}</span></div></div><div class="bill__pay">${icon('money')}<span>${t('order.payAtCounter')}</span></div>`;
    drawer.foot.innerHTML = `<button type="button" class="btn btn--primary btn--lg btn--block" id="place">${icon('bag')}<span>${t('parcel.place')}</span></button>`; tick();
  }
  function tick() { const b = $('#place', drawer.foot); if (!b) return; clearInterval(cd); const f = () => { const left = os.cooldownLeft('parcel'); b.disabled = left > 0 || placing; $('span', b).textContent = left > 0 ? t('order.wait', { n: left }) : placing ? t('order.placing') : t('parcel.place'); if (left <= 0) clearInterval(cd); }; f(); cd = setInterval(f, 500); }
  drawer.body.addEventListener('click', (e) => { const line = e.target.closest('.cart-line'); if (!line) return; const id = line.dataset.id; const q = cart.qtyOf(id); if (e.target.closest('[data-inc]')) cart.setQty(id, q + 1); else if (e.target.closest('[data-dec]')) cart.setQty(id, q - 1); else if (e.target.closest('[data-rm]')) cart.remove(id); browser.refresh(); });
  drawer.body.addEventListener('change', (e) => { if (e.target.matches('[data-note]')) cart.setNote(e.target.closest('.cart-line').dataset.id, e.target.value.trim()); });
  $('#open-cart').addEventListener('click', () => { paintCart(); drawer.open(); });

  async function place(force = false) {
    if (placing) return; const name = $('#p-name', drawer.body).value.trim(); const phone = $('#p-phone', drawer.body).value.trim();
    const okN = name.length >= 2; const okP = isPhone(phone); $('#f-name').classList.toggle('has-error', !okN); $('#f-phone').classList.toggle('has-error', !okP);
    if (!okN || !okP) { (!okN ? $('#p-name') : $('#p-phone')).focus(); return; }
    $$('[data-note]', drawer.body).forEach((n) => cart.setNote(n.closest('.cart-line').dataset.id, n.value.trim()));
    store.set('bbc:pName', name); store.set('bbc:pPhone', phone); placing = true; tick(); await new Promise((r) => setTimeout(r, 450));
    try {
      const o = os.placeParcel({ customer: { name, phone: cleanPhone(phone) }, lines: cart.lines(), force });
      store.set('bbc:lastParcel', o.id); cart.clear(); drawer.close(); placing = false; showLive(); confetti(80);
    } catch (e) {
      placing = false;
      if (e.code === 'DUPLICATE') { if (await confirmDialog({ title: t('order.dupTitle'), message: t('order.dupText'), confirmText: t('order.sendAgain') })) return place(true); }
      else if (e.code === 'COOLDOWN') toast(t('order.cooldown', { n: e.seconds }), { type: 'warn' });
      else if (e.code === 'SOLD_OUT') { cart.prune(); browser.refresh(); toast(t('order.soldOut'), { type: 'warn' }); }
      else if (e.code === 'SWITCH_OFF' || e.code === 'OUTSIDE_HOURS') location.reload();
      else toast(t('common.error'), { type: 'error' });
      tick();
    }
  }
  drawer.foot.addEventListener('click', (e) => { if (e.target.closest('#place')) place(); });

  /* ---------- live token view ---------- */
  function showLive() {
    const id = store.get('bbc:lastParcel'); const o = id && db.get('orders', id);
    const finished = !o || o.status === 'handed' && Date.now() - new Date(o.statusHistory.at(-1).at) > 0 && store.get('bbc:parcelDismissed') === id;
    if (!o || finished) { live.hidden = true; $('#view-menu').hidden = false; bar(); return; }
    const idx = FLOW.indexOf(o.status); const cancelled = o.status === 'cancelled';
    live.hidden = false; $('#view-menu').hidden = true; $('#cartbar').hidden = true;
    const msg = o.status === 'ready' ? t('parcel.readyMsg') : o.status === 'handed' ? t('parcel.handedMsg') : '';
    live.innerHTML = `<div class="token-card dark" role="status" aria-live="polite"><div class="token-card__label">${t('parcel.token')}</div><div class="token-card__no">${o.parcelToken}</div><p class="text-muted">${t('parcel.tokenHint')} · ${esc(o.customer.name)}</p>
      ${cancelled ? `<span class="badge badge--outline" style="justify-self:center">${t('order.cancelledBadge')}</span>` : `<div class="tracker" style="--steps:${FLOW.length};--prog:${idx / (FLOW.length - 1)}">${FLOW.map((s, i) => `<div class="tracker__step ${i < idx || o.status === 'handed' ? 'is-done' : ''} ${i === idx && o.status !== 'handed' ? 'is-current' : ''}"><span class="tracker__dot">${icon(i < idx || o.status === 'handed' ? 'check' : ICO[s])}</span><span>${t('parcel.status.' + s)}</span></div>`).join('')}</div>`}
      ${msg ? `<p class="bill__pay" style="justify-content:center">${icon(o.status === 'ready' ? 'bell' : 'star')}<span>${msg}</span></p>` : ''}
      <ul class="token-card__items">${o.items.map((i) => `<li><span>${i.qty} × ${esc(tr(i.name))}</span><span>${money(i.price * i.qty)}</span></li>`).join('')}<li><b>${t('order.total')}</b><b>${money(o.total)}</b></li></ul><p class="bill__pay" style="justify-content:center">${icon('money')}<span>${t('order.payAtCounter')}</span></p>
      <div class="token-card__cta">${o.status === 'placed' ? `<button class="btn btn--danger" type="button" data-cancel>${icon('close')}<span>${t('parcel.cancel')}</span></button>` : ''}${['handed', 'cancelled'].includes(o.status) ? `<button class="btn btn--primary" type="button" data-another>${icon('plus')}<span>${t('parcel.another')}</span></button>` : ''}</div></div>`;
    applyI18n(); hydrateIcons(live);
  }
  live.addEventListener('click', async (e) => {
    const id = store.get('bbc:lastParcel');
    if (e.target.closest('[data-cancel]') && await confirmDialog({ title: t('parcel.cancel'), message: t('order.cancelConfirm'), danger: true })) { try { os.cancelByCustomer(id); toast(t('parcel.cancelled')); } catch { toast(t('order.cancelFail'), { type: 'warn' }); } showLive(); }
    if (e.target.closest('[data-another]')) { store.set('bbc:parcelDismissed', id); showLive(); }
  });
  db.onChange((c) => { if (c === 'orders' && !live.hidden) showLive(); if (c === 'menu') { cart.prune(); browser.refresh(); } });
  subscribe('order:status', () => !live.hidden && showLive());
  setInterval(() => { if (!live.hidden && !document.hidden) showLive(); }, 5000);
  onLangChange(() => { bar(); if (drawer.isOpen) paintCart(); showLive(); });
  showLive(); bar();
}
