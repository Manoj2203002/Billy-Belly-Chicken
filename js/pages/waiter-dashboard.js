import { init, db } from '../dataService.js';
import { initI18n, t, tr, onLangChange } from '../i18n.js';
import { mountPortal, setNavCount } from '../portal.js';
import { hydrateIcons, icon } from '../icons.js';
import { $, $$, el, esc, money, minutesSince, setCurrency } from '../utils.js';
import { createDrawer, openModal, toast, emptyState } from '../ui.js';
import * as os from '../orderService.js';
import { subscribe, beep } from '../orderSync.js';
import { orderCardHTML, bindOrderActions, showBill, closeTableDialog, stBadge } from '../components/waiterActions.js';

await init(); await initI18n(['waiter-common', 'waiter-dashboard']);
const user = mountPortal({ role: 'waiter', active: 'dashboard', titleKey: 'waiter-dashboard.pageTitle' });
if (user) main();

function main() {
  setCurrency(db.get('settings').currency); hydrateIcons();
  let scope = 'mine', openNo = null;
  const grid = $('#grid'), sum = $('#sum'), snd = $('#snd');
  const drawer = createDrawer({ title: '', onClose: () => { openNo = null; } });
  const ctx = { user, after: () => { paint(); if (openNo) paintDrawer(); } };
  bindOrderActions(drawer.body, ctx);

  const tables = () => db.list('tables', (x) => x.active !== false && (scope === 'all' || x.waiterId === user.id)).sort((a, b) => a.number - b.number);

  function paint() {
    const list = tables(); const st = list.map((x) => ({ x, s: os.tableState(x.number) }));
    const count = (k) => st.filter((r) => r.s.state === k).length;
    const parcels = db.list('orders', (o) => o.type === 'parcel' && o.status === 'placed').length;
    setNavCount('dashboard', count('new')); setNavCount('parcels', parcels);
    const card = (k, n, ic) => `<div class="stat"><div class="stat__label">${icon(ic)} ${t('waiter-dashboard.summary.' + k)}</div><div class="stat__value">${n}</div></div>`;
    sum.innerHTML = card('new', count('new'), 'receipt') + card('bill', count('bill'), 'money') + card('call', count('called'), 'bell') + card('busy', st.filter((r) => r.s.state !== 'free').length, 'table');
    if (!list.length) { grid.innerHTML = emptyState({ icon: 'table', title: t('waiter-dashboard.none') }); return; }
    grid.innerHTML = st.map(({ x, s }) => `<button type="button" class="tcard tcard--${s.state}" data-no="${x.number}"><div class="tcard__no">${x.number}<small>${esc(x.area || '')}</small></div>
      <span class="st st--${s.state === 'free' ? 'completed' : s.state === 'occupied' ? 'confirmed' : 'placed'}">${t('waiter-dashboard.state.' + s.state)}</span>
      <div class="tcard__meta"><span>${icon('users')} ${t('waiter-dashboard.seats', { n: x.seats })}</span>${s.session ? `<span>${icon('clock')} ${t('waiter-dashboard.since', { n: s.minutes })}</span>` : ''}${s.waitingOrders ? `<span>${icon('bell')} ${t('waiter-dashboard.orders', { n: s.waitingOrders })}</span>` : ''}</div></button>`).join('');
  }

  function paintDrawer() {
    const no = openNo; const s = os.getSession(no); const tab = os.tabForTable(no);
    drawer.titleEl.textContent = `${t('common.table')} ${no}`;
    const alerts = [];
    if (s && s.callWaiter) alerts.push(`<div class="td-alert">${icon('bell')}<span>${t('waiter-dashboard.callAt', { n: minutesSince(s.callWaiter) })}</span><button class="btn btn--sm btn--primary" data-clear type="button">${t('waiter-dashboard.clearCall')}</button></div>`);
    if (s && s.billRequested) alerts.push(`<div class="td-alert">${icon('money')}<span>${t('waiter-dashboard.billAt', { n: minutesSince(s.billRequested) })}</span></div>`);
    drawer.body.innerHTML = `<div class="stack">${alerts.join('')}${tab.orders.length ? tab.orders.slice().reverse().map(orderCardHTML).join('') : `<p class="text-muted">${t('waiter-dashboard.drawerEmpty')}</p>`}
      ${tab.live.length ? `<div class="td-total"><h3>${t('waiter-dashboard.running')}</h3><div class="kv"><span>${t('common.subtotal')}</span><span>${money(tab.subtotal)}</span></div>${tab.discount ? `<div class="kv"><span>${t('common.discount')}</span><span>-${money(tab.discount)}</span></div>` : ''}<div class="kv"><span>${t('common.tax')}</span><span>${money(tab.tax)}</span></div><div class="kv kv--total"><span>${t('common.total')}</span><span>${money(tab.total)}</span></div></div>` : ''}</div>`;
    drawer.foot.innerHTML = s ? `<button class="btn btn--ghost" data-bill type="button">${icon('receipt')}<span>${t('waiter-dashboard.showBill')}</span></button><button class="btn btn--primary" data-close type="button">${icon('check')}<span>${t('waiter.closeTable')}</span></button>` : '';
  }
  drawer.body.addEventListener('click', (e) => { if (e.target.closest('[data-clear]')) { os.clearCall(openNo); ctx.after(); } });
  drawer.foot.addEventListener('click', (e) => {
    if (e.target.closest('[data-bill]')) showBill(openNo);
    if (e.target.closest('[data-close]')) closeTableDialog(openNo, user, () => { drawer.close(); paint(); });
  });
  grid.addEventListener('click', (e) => { const b = e.target.closest('[data-no]'); if (!b) return; openNo = Number(b.dataset.no); paintDrawer(); drawer.open(); });
  $('#scope').addEventListener('click', (e) => { const b = e.target.closest('[data-scope]'); if (!b) return; scope = b.dataset.scope; $$('#scope .tab').forEach((x) => x.classList.toggle('is-active', x === b)); paint(); });

  /* sold-out switch (only when admin allows it) */
  $('#soldout').addEventListener('click', () => {
    if (!db.get('settings').allowWaiterSoldOut) { toast(t('waiter-dashboard.soldOutOff'), { type: 'warn' }); return; }
    const body = el('div', { class: 'stack' }); const q = el('input', { class: 'input', type: 'search', placeholder: t('waiter.addItemSearch') }); const list = el('div', { class: 'so-list' });
    body.append(el('p', { class: 'text-muted' }, t('waiter-dashboard.soldOutHelp')), q, list);
    const draw = () => { const s = q.value.trim().toLowerCase(); list.innerHTML = db.list('menu', (m) => !s || `${m.name.en} ${m.name.ta}`.toLowerCase().includes(s)).map((m) => `<div class="so-row"><span>${esc(tr(m.name))}</span><label class="switch"><input type="checkbox" data-id="${m.id}" ${m.available === false ? '' : 'checked'} aria-label="${esc(tr(m.name))}"><span class="switch__track"></span></label></div>`).join(''); };
    list.addEventListener('change', (e) => { const i = e.target.closest('[data-id]'); if (i) { db.update('menu', i.dataset.id, { available: i.checked }); db.audit('Availability', `${i.dataset.id} -> ${i.checked ? 'available' : 'sold out'} (${user.name})`); } });
    q.addEventListener('input', draw); draw(); openModal({ title: t('waiter-dashboard.soldOut'), body, size: 'sm' });
  });

  /* live alerts */
  const mineOrAll = (tn) => { const tb = os.getTableByNumber(tn); return scope === 'all' || (tb && tb.waiterId === user.id); };
  const alertUser = (msg) => { toast(msg, { type: 'warn' }); if (snd.checked) beep(); };
  subscribe('alert:call', (p) => { if (mineOrAll(p.tableNo)) alertUser(t('waiter-dashboard.alertCall', { n: p.tableNo })); });
  subscribe('alert:bill', (p) => { if (mineOrAll(p.tableNo)) alertUser(t('waiter-dashboard.alertBill', { n: p.tableNo })); });
  subscribe('order:new', (p) => { if (p.parcel) alertUser(t('waiter-dashboard.alertParcel', { t: p.token || '' })); else if (mineOrAll(p.tableNo)) alertUser(t('waiter-dashboard.alertNew', { n: p.tableNo })); });
  const refresh = () => { paint(); if (openNo && drawer.isOpen) paintDrawer(); };
  db.onChange((c) => { if (['orders', 'tableSessions', 'tables'].includes(c)) refresh(); });
  subscribe(() => refresh());
  onLangChange(refresh); setInterval(refresh, 30000);
  paint();
}
