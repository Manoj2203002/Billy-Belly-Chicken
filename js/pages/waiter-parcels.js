import { init, db } from '../dataService.js';
import { initI18n, t, onLangChange } from '../i18n.js';
import { mountPortal, setNavCount } from '../portal.js';
import { hydrateIcons } from '../icons.js';
import { $, $$, setCurrency, isToday } from '../utils.js';
import { emptyState } from '../ui.js';
import { subscribe } from '../orderSync.js';
import { orderCardHTML, bindOrderActions } from '../components/waiterActions.js';

await init(); await initI18n(['waiter-common', 'waiter-parcels']);
const user = mountPortal({ role: 'waiter', active: 'parcels', titleKey: 'waiter-parcels.pageTitle' });
if (user) {
  setCurrency(db.get('settings').currency); hydrateIcons();
  const F = [['active'],['placed'],['served'],['done'],['cancelled'],['all']]; let cur = F[0][0];
  const bar = $('#f'), sub = $('#sub'), list = $('#list'), q = $('#q');
  const pass = { active: (o) => ['placed', 'confirmed', 'ready'].includes(o.status) || (o.status === 'served'), placed: (o) => o.status === 'placed', served: (o) => ['served', 'ready'].includes(o.status), done: (o) => ['completed', 'handed'].includes(o.status), cancelled: (o) => o.status === 'cancelled', all: () => true };
  const COLS = ['placed', 'confirmed', 'ready', 'handed'];
  const colName = (k) => ({ placed: t('waiter-parcels.col.placed'), confirmed: t('waiter-parcels.col.confirmed'), ready: t('waiter-parcels.col.ready'), served: t('waiter-parcels.col.served'), handed: t('waiter-parcels.f.done') })[k];
  function paint() {
    const today = db.list('orders', (o) => o.type === 'parcel' && isToday(o.createdAt));
    const cnt = (k) => today.filter(pass[k]).length;
    bar.innerHTML = F.map(([k]) => { const n = cnt(k); return `<button class="tab ${k === cur ? 'is-active' : ''}" role="tab" data-f="${k}">${t('waiter-parcels.f.' + k)}${n && k !== 'all' && k !== 'cancelled' && k !== 'done' ? ` <i class="tab__n ${k === 'placed' ? 'tab__n--hot' : ''}">${n}</i>` : ''}</button>`; }).join('');
    sub.textContent = t('waiter-parcels.sub', { a: cnt('active'), c: cnt('placed') });
    const s = q.value.trim().toLowerCase();
    const rows = today.filter((o) => pass[cur](o) && (!s || `${o.id} ${o.tableNo || ''} ${o.parcelToken || ''} ${o.customer?.name || ''} ${o.customer?.phone || ''}`.toLowerCase().includes(s))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!rows.length) list.innerHTML = emptyState({ icon: 'receipt', title: t('waiter-parcels.empty') });
    else if (cur === 'active' || cur === 'all') {
      list.innerHTML = COLS.map((k) => { const r = rows.filter((o) => o.status === k); return r.length ? `<section class="wo-col wo-col--${k}"><h2 class="wo-col__h"><i></i>${colName(k)}<span>${r.length}</span></h2><div class="wo-col__list">${r.map(orderCardHTML).join('')}</div></section>` : ''; }).join('') + (cur === 'all' ? (() => { const r = rows.filter((o) => !COLS.includes(o.status)); return r.length ? `<section class="wo-col wo-col--done"><h2 class="wo-col__h"><i></i>${t('waiter-parcels.f.done')} / ${t('waiter-parcels.f.cancelled')}<span>${r.length}</span></h2><div class="wo-col__list">${r.map(orderCardHTML).join('')}</div></section>` : ''; })() : '');
      list.classList.add('is-board');
    } else { list.classList.remove('is-board'); list.innerHTML = `<div class="wo-col__list wo-col__list--flat">${rows.map(orderCardHTML).join('')}</div>`; }
    if (cur === 'active' || cur === 'all') list.classList.add('is-board');
    setNavCount('parcels', db.list('orders', (o) => o.type === 'parcel' && o.status === 'placed').length);
  }
  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { cur = b.dataset.f; paint(); } });
  q.addEventListener('input', paint); bindOrderActions(list, { user, after: paint });
  db.onChange((c) => { if (c === 'orders') paint(); }); subscribe(paint); onLangChange(paint); paint();
}
