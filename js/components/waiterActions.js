/* ==========================================================================
   waiterActions.js - order cards + actions shared by the waiter dashboard and orders page.
   The waiter confirms WITH the customer, then walks to the chef. The app only records it.
   ========================================================================== */
import { db } from '../dataService.js';
import { t, tr } from '../i18n.js';
import { icon, vegMark } from '../icons.js';
import { el, esc, money, minutesSince, fmtTime, imgSrc, debounce } from '../utils.js';
import { openModal, confirmDialog, promptDialog, toast } from '../ui.js';
import * as os from '../orderService.js';

export const stLabel = (s) => t('status.' + s);
const ST_ICON = { placed: 'bell', confirmed: 'checkcircle', served: 'utensils', completed: 'star', cancelled: 'xcircle', ready: 'bag', handed: 'star' };
export const stBadge = (s) => `<span class="st st--${s}">${icon(ST_ICON[s] || 'info')}${stLabel(s)}</span>`;

/** One order as a card. opts: { showTable } */
export function orderCardHTML(o) {
  const waiting = o.status === 'placed' ? minutesSince(o.createdAt) : null;
  const next = os.nextStatus(o);
  const parcel = o.type === 'parcel';
  const nextLabel = { confirmed: t('waiter.act.confirm'), served: t('waiter.act.served'), ready: t('waiter.act.ready'), handed: t('waiter.act.handed'), completed: '' }[next] || '';
  const canNext = next && next !== 'completed';
  return `<article class="ocard ${o.status === 'placed' ? 'is-new' : ''}" data-oid="${o.id}" data-status="${o.status}">
    <div class="ocard__head"><span class="ocard__tag ${parcel ? 'ocard__tag--parcel' : ''}">${parcel ? `${icon('bag')}<small>${t('waiter.parcel')}</small>` : `<small>${t('common.table')}</small><b>${o.tableNo}</b>`}</span><div class="ocard__who"><span class="ocard__id">${parcel ? o.parcelToken : o.id}</span><span class="ocard__sub">${[o.customer?.name ? esc(o.customer.name) : '', !parcel && o.customer?.guests ? t('waiter.guests', { n: o.customer.guests }) : ''].filter(Boolean).join(' · ') || '&nbsp;'}</span></div>${stBadge(o.status)}</div>
    <div class="ocard__meta"><span>${icon('clock')}${fmtTime(o.createdAt)}</span>${waiting != null ? `<b class="wait wait--${waiting >= 10 ? 'hot' : waiting >= 5 ? 'warn' : 'ok'}">${t('waiter.waiting', { n: waiting })}</b>` : ''}${parcel && o.customer?.phone ? `<span>${icon('phone')}<a href="tel:+91${o.customer.phone}" class="link">${o.customer.phone}</a></span>` : ''}</div>
    <ul class="ocard__items">${o.items.map((i) => `<li><span>${vegMark(i.isVeg)} ${i.qty} × ${esc(tr(i.name))}${i.note ? `<span class="ocard__note">${icon('info')}${esc(i.note)}</span>` : ''}</span><span>${money(i.price * i.qty)}</span></li>`).join('')}</ul>
    <div class="kv kv--total"><span>${t('common.total')}</span><span>${money(o.total)}</span></div>
    ${o.status === 'placed' ? `<p class="hint">${t('waiter.confirmHint')}</p>` : ''}
    ${o.status === 'cancelled' ? `<p class="hint">${t('waiter.cancelReason')}: ${esc(o.cancelReason || '-')}</p>` : ''}
    <div class="ocard__actions">${canNext ? `<button type="button" class="btn btn--primary" data-act="next">${icon('check')}<span>${nextLabel}</span></button>` : ''}${['placed', 'confirmed', 'ready', 'served'].includes(o.status) && !(parcel && ['ready'].includes(o.status)) && !['served', 'handed'].includes(o.status) ? `<button type="button" class="btn btn--ghost" data-act="edit">${icon('edit')}<span>${t('waiter.act.edit')}</span></button>` : ''}${['placed', 'confirmed'].includes(o.status) ? `<button type="button" class="btn btn--danger" data-act="cancel">${icon('close')}<span>${t('waiter.act.cancel')}</span></button>` : ''}</div>
  </article>`;
}

/** Delegated click handling for cards inside `root`. ctx = { user, after() } */
export function bindOrderActions(root, ctx) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn) return; const card = btn.closest('[data-oid]'); if (!card) return;
    const o = db.get('orders', card.dataset.oid); if (!o) return; const act = btn.dataset.act;
    if (act === 'next') {
      const nx = os.nextStatus(o); if (!nx) return;
      os.setStatus(o.id, nx, { by: ctx.user.name, waiterId: ctx.user.id }); toast(t('waiter.updated', { id: o.parcelToken || o.id, s: stLabel(nx) }), { type: 'ok' });
    } else if (act === 'cancel') {
      const reason = await promptDialog({ title: t('waiter.act.cancel'), label: t('waiter.cancelReason'), required: true, textarea: true }); if (!reason) return;
      os.setStatus(o.id, 'cancelled', { by: ctx.user.name, reason }); toast(t('waiter.cancelled'), { type: 'warn' });
    } else if (act === 'edit') { await editOrder(o, ctx.user); }
    ctx.after && ctx.after();
  });
}

/** Edit quantities / notes / add items on the customer's behalf */
export function editOrder(order, user) {
  return new Promise((resolve) => {
    const lines = order.items.map((i) => ({ itemId: i.itemId, qty: i.qty, note: i.note || '' }));
    const body = el('div', { class: 'stack' }); const list = el('div'); const picker = el('div', { class: 'stack' });
    const search = el('input', { class: 'input', type: 'search', placeholder: t('waiter.addItemSearch') }); const results = el('div', { class: 'stack' });
    picker.append(el('h3', {}, t('waiter.addItem')), search, results); body.append(list, el('hr', { class: 'hr' }), picker);
    const name = (id) => { const it = os.resolveItem(id); return it ? tr(it.name) : id; };
    function paint() {
      list.innerHTML = lines.map((l, i) => `<div class="cart-line" data-i="${i}"><div class="cart-line__top"><div class="cart-line__name">${esc(name(l.itemId))}</div></div><div class="cart-line__bar"><div class="stepper"><button type="button" data-d aria-label="-">${icon('minus')}</button><span class="stepper__val">${l.qty}</span><button type="button" data-u aria-label="+">${icon('plus')}</button></div><button type="button" class="btn btn--sm btn--ghost" data-r>${icon('trash')}</button></div><input class="input" data-n maxlength="80" value="${esc(l.note)}" placeholder="${esc(t('waiter.notePh'))}"></div>`).join('') || `<p class="text-muted">${t('waiter.noLines')}</p>`;
    }
    function find() {
      const q = search.value.trim().toLowerCase();
      const items = db.list('menu').filter((m) => !q || `${m.name.en} ${m.name.ta}`.toLowerCase().includes(q)).slice(0, 8);
      results.innerHTML = items.map((m) => `<button type="button" class="chip" data-add="${m.id}" ${m.available === false ? 'disabled aria-disabled="true"' : ''}>${esc(tr(m.name))} · ${money(m.price)}${m.available === false ? ` (${t('food.soldOut')})` : ''}</button>`).join('');
    }
    list.addEventListener('click', (e) => { const row = e.target.closest('[data-i]'); if (!row) return; const l = lines[+row.dataset.i];
      if (e.target.closest('[data-u]')) l.qty = Math.min(99, l.qty + 1); else if (e.target.closest('[data-d]')) l.qty = Math.max(0, l.qty - 1); else if (e.target.closest('[data-r]')) l.qty = 0;
      if (l.qty === 0) lines.splice(+row.dataset.i, 1); paint(); });
    list.addEventListener('change', (e) => { if (e.target.matches('[data-n]')) lines[+e.target.closest('[data-i]').dataset.i].note = e.target.value; });
    results.addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (!b || b.disabled) return; const l = lines.find((x) => x.itemId === b.dataset.add); l ? l.qty++ : lines.push({ itemId: b.dataset.add, qty: 1, note: '' }); paint(); });
    search.addEventListener('input', debounce(find, 120));
    const cancel = el('button', { class: 'btn btn--ghost', type: 'button' }, t('common.cancel')); const save = el('button', { class: 'btn btn--primary', type: 'button' }, t('common.save'));
    const m = openModal({ title: `${t('waiter.act.edit')} ${order.id}`, body, footer: [cancel, save], size: 'lg', onClose: () => resolve() });
    cancel.addEventListener('click', m.close);
    save.addEventListener('click', () => { try { os.updateOrderItems(order.id, lines, user.name); toast(t('common.saved')); m.close(); } catch (e) { toast(e.code === 'EMPTY' ? t('waiter.noLines') : t('common.error'), { type: 'warn' }); } });
    paint(); find();
  });
}

/** Printable, view-only bill summary for a table */
export function showBill(tableNo) {
  const tab = os.tabForTable(tableNo); const r = db.get('restaurant'); const s = db.get('settings');
  const rows = {}; tab.live.forEach((o) => o.items.forEach((i) => { const k = i.itemId; rows[k] ||= { name: i.name, qty: 0, amt: 0 }; rows[k].qty += i.qty; rows[k].amt += i.qty * i.price; }));
  const body = el('div', { html: `<div class="bill-sheet print-area"><img src="${imgSrc('assets/logo/logo-320.webp')}" alt=""><h3>${esc(tr(r.name))}</h3><div style="text-align:center;font-size:.8rem">${esc(tr(r.address))}<br>${esc(r.phone)}</div><div class="kv" style="margin-top:.6rem"><span>${t('common.table')} ${tableNo}</span><span>${new Date().toLocaleString()}</span></div><table><thead><tr><th>${t('common.items')}</th><th>${t('common.qty')}</th><th>${t('common.price')}</th></tr></thead><tbody>${Object.values(rows).map((x) => `<tr><td>${esc(tr(x.name))}</td><td>${x.qty}</td><td>${money(x.amt)}</td></tr>`).join('')}</tbody></table>
    <div class="kv"><span>${t('common.subtotal')}</span><span>${money(tab.subtotal)}</span></div>${tab.discount ? `<div class="kv"><span>${t('common.discount')}</span><span>-${money(tab.discount)}</span></div>` : ''}<div class="kv"><span>${esc(s.taxName || 'GST')}</span><span>${money(tab.tax)}</span></div><div class="kv kv--total"><span>${t('common.total')}</span><span>${money(tab.total)}</span></div><p>${t('waiter.payAtCounter')}</p></div>` });
  const pr = el('button', { class: 'btn btn--primary', type: 'button', onclick: () => { document.body.classList.add('printing-bill'); window.print(); setTimeout(() => document.body.classList.remove('printing-bill'), 500); } }, el('span', { html: icon('print') }), t('common.print'));
  openModal({ title: t('waiter.bill'), body, footer: [pr], size: 'sm' });
}

/** Close a table after the customer paid at the counter (method is a note only) */
export function closeTableDialog(tableNo, user, done) {
  const tab = os.tabForTable(tableNo); let method = 'Cash';
  const opts = [['Cash', 'money'], ['UPI', 'upi'], ['Card', 'card']];
  const body = el('div', { class: 'stack' }, el('p', { class: 'text-muted' }, t('waiter.closeHint', { total: money(tab.total) })), el('div', { class: 'segmented', role: 'group' }, ...opts.map(([m, ic]) => el('button', { type: 'button', class: m === method ? 'is-active' : '', dataset: { m }, html: `${icon(ic)} ${m}` }))));
  body.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b) return; method = b.dataset.m; body.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('is-active', x === b)); });
  const ok = el('button', { class: 'btn btn--primary', type: 'button' }, t('waiter.closeTable')); const no = el('button', { class: 'btn btn--ghost', type: 'button' }, t('common.cancel'));
  const m = openModal({ title: `${t('common.table')} ${tableNo}`, size: 'sm', body, footer: [no, ok] }); no.addEventListener('click', m.close);
  ok.addEventListener('click', () => { os.closeTable(tableNo, { method, by: user.name }); toast(t('waiter.tableClosed'), { type: 'ok' }); m.close(); done && done(); });
}
