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
  const bar = $('#f'), list = $('#list'), q = $('#q');
  const pass = { active: (o) => ['placed', 'confirmed', 'ready'].includes(o.status) || (o.status === 'served'), placed: (o) => o.status === 'placed', served: (o) => ['served', 'ready'].includes(o.status), done: (o) => ['completed', 'handed'].includes(o.status), cancelled: (o) => o.status === 'cancelled', all: () => true };
  function paint() {
    bar.innerHTML = F.map(([k]) => `<button class="tab ${k === cur ? 'is-active' : ''}" role="tab" data-f="${k}">${t('waiter-parcels.f.' + k)}</button>`).join('');
    const s = q.value.trim().toLowerCase();
    const rows = db.list('orders', (o) => o.type === 'parcel' && isToday(o.createdAt) && pass[cur](o) && (!s || `${o.id} ${o.tableNo || ''} ${o.parcelToken || ''} ${o.customer?.name || ''} ${o.customer?.phone || ''}`.toLowerCase().includes(s))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    list.innerHTML = rows.length ? rows.map(orderCardHTML).join('') : emptyState({ icon: 'receipt', title: t('waiter-parcels.empty') });
    setNavCount('parcels', db.list('orders', (o) => o.type === 'parcel' && o.status === 'placed').length);
  }
  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { cur = b.dataset.f; paint(); } });
  q.addEventListener('input', paint); bindOrderActions(list, { user, after: paint });
  db.onChange((c) => { if (c === 'orders') paint(); }); subscribe(paint); onLangChange(paint); paint();
}
