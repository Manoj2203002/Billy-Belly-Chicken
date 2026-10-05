import { init, db } from '../dataService.js';
import { initI18n, t, tr, onLangChange } from '../i18n.js';
import { mountPortal } from '../portal.js';
import { hydrateIcons } from '../icons.js';
import { $, money, setCurrency, isToday } from '../utils.js';
import { barChart, donutChart } from '../components/charts.js';
import { subscribe } from '../orderSync.js';

await init(); await initI18n(['waiter-common', 'waiter-stats']);
const user = mountPortal({ role: 'waiter', active: 'stats', titleKey: 'waiter-stats.pageTitle' });
if (user) {
  setCurrency(db.get('settings').currency); hydrateIcons();
  function paint() {
    const mine = db.list('orders', (o) => isToday(o.createdAt) && o.status !== 'cancelled' && (o.waiterId === user.id || (o.type !== 'parcel' && db.find('tables', (x) => String(x.number) === String(o.tableNo))?.waiterId === user.id)));
    const sales = mine.reduce((a, o) => a + o.total, 0);
    const k = (l, v, i) => `<div class="stat"><div class="stat__label">${l}</div><div class="stat__value">${v}</div></div>`;
    $('#kpi').innerHTML = k(t('waiter-stats.orders'), mine.length) + k(t('waiter-stats.served'), mine.filter((o) => ['served', 'completed', 'handed'].includes(o.status)).length) + k(t('waiter-stats.revenue'), money(sales)) + k(t('waiter-stats.avg'), money(mine.length ? sales / mine.length : 0));
    const hrs = {}; mine.forEach((o) => { const h = new Date(o.createdAt).getHours(); hrs[h] = (hrs[h] || 0) + 1; });
    const hk = Object.keys(hrs).sort((a, b) => a - b);
    const draw = (id, fn, has) => { const n = $(id); n.innerHTML = ''; has ? fn(n) : (n.innerHTML = `<p class="text-muted">${t('waiter-stats.none')}</p>`); };
    draw('#c-hour', (n) => barChart(n, hk.map((h) => ({ label: `${h}:00`, value: hrs[h] })), { height: 220, title: t('waiter-stats.hourly') }), hk.length);
    const sc = {}; mine.forEach((o) => { sc[o.status] = (sc[o.status] || 0) + 1; });
    draw('#c-status', (n) => donutChart(n, Object.entries(sc).map(([s, v]) => ({ label: t('status.' + s), value: v })), { size: 190, centerLabel: String(mine.length), title: t('waiter-stats.status') }), mine.length);
    const items = {}; mine.forEach((o) => o.items.forEach((i) => { const key = i.itemId; items[key] ||= { name: tr(i.name), v: 0 }; items[key].v += i.qty; }));
    const top = Object.values(items).sort((a, b) => b.v - a.v).slice(0, 6);
    draw('#c-top', (n) => barChart(n, top.map((x) => ({ label: x.name, value: x.v })), { height: 240, title: t('waiter-stats.top') }), top.length);
  }
  db.onChange((c) => { if (c === 'orders') paint(); }); subscribe(paint); onLangChange(paint); paint();
}
