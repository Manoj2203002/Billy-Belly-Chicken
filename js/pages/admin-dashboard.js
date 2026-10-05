import { db } from '../dataService.js';
import { t, tr, onLangChange } from '../i18n.js';
import { $, money, fmtTime, esc, todayStr, isToday } from '../utils.js';
import { icon } from '../icons.js';
import { lineChart, donutChart, barChart } from '../components/charts.js';
import { subscribe } from '../orderSync.js';
import * as os from '../orderService.js';
import { bootAdmin } from '../components/adminPage.js';
import { stBadge } from '../components/waiterActions.js';
import { setNavCount } from '../portal.js';

bootAdmin('dashboard', () => {
  const paint = () => {
    const all = db.list('orders'); const live = all.filter((o) => o.status !== 'cancelled');
    const today = live.filter((o) => isToday(o.createdAt));
    const rev = today.reduce((a, o) => a + o.total, 0);
    const pend = db.list('reviews', (r) => r.status === 'pending').length; setNavCount('reviews', pend);
    const open = db.list('tableSessions', (s) => !s.closedAt).length;
    const k = (l, v, ic) => `<div class="stat"><div class="stat__label">${icon(ic)} ${t('admin-dashboard.' + l)}</div><div class="stat__value">${v}</div></div>`;
    $('#kpi').innerHTML = k('orders', today.length, 'receipt') + k('revenue', money(rev), 'money') + k('parcels', today.filter((o) => o.type === 'parcel').length, 'bag') + k('open', open, 'table') + k('pending', pend, 'star') + k('rating', (os.avgRating() || 0).toFixed ? Number(os.avgRating() || 0).toFixed(1) : '-', 'sparkle');
    const on = db.get('settings').acceptingOrders; const acc = $('#acc'); acc.innerHTML = `${icon(on ? 'checkcircle' : 'xcircle')} ${t(on ? 'admin-dashboard.on' : 'admin-dashboard.off')} · ${t('admin-dashboard.manage')}`;
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
    lineChart($('#c-week'), days.map((d) => ({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), value: Math.round(live.filter((o) => todayStr(new Date(o.createdAt)) === todayStr(d)).reduce((a, o) => a + o.total, 0)) })), { height: 240, format: (v) => money(v), title: t('admin-dashboard.week') });
    const week = live.filter((o) => Date.now() - new Date(o.createdAt) < 7 * 864e5);
    const dine = week.filter((o) => o.type !== 'parcel').length; const par = week.length - dine;
    donutChart($('#c-mix'), [{ label: t('admin-dashboard.dine'), value: dine }, { label: t('admin-dashboard.parcel'), value: par }], { size: 190, centerLabel: String(week.length), title: t('admin-dashboard.mix') });
    barChart($('#c-top'), os.topItems(week, 6).map((x) => ({ label: tr(x.name), value: x.qty })), { height: 240, title: t('admin-dashboard.top') });
    const rows = all.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
    $('#recent').innerHTML = rows.length ? `<table class="table table--cards"><thead><tr><th>${t('admin-dashboard.id')}</th><th>${t('admin-dashboard.where')}</th><th>${t('admin-dashboard.total')}</th><th>${t('admin-common.status')}</th><th>${t('admin-dashboard.time')}</th></tr></thead><tbody>${rows.map((o) => `<tr><td data-label="${t('admin-dashboard.id')}">${o.id}</td><td data-label="${t('admin-dashboard.where')}">${o.type === 'parcel' ? o.parcelToken : t('common.table') + ' ' + o.tableNo}</td><td data-label="${t('admin-dashboard.total')}">${money(o.total)}</td><td data-label="${t('admin-common.status')}">${stBadge(o.status)}</td><td data-label="${t('admin-dashboard.time')}">${fmtTime(o.createdAt)}</td></tr>`).join('')}</tbody></table>` : `<p class="text-muted">${t('admin-dashboard.none')}</p>`;
  };
  db.onChange(() => paint()); subscribe(paint); onLangChange(paint); paint();
});
