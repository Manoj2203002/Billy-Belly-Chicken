import { db } from '../dataService.js';
import { t, tr, onLangChange } from '../i18n.js';
import { $, $$, money, esc, todayStr, download, toCSV, fmtDateTime } from '../utils.js';
import { icon } from '../icons.js';
import { lineChart, donutChart } from '../components/charts.js';
import * as os from '../orderService.js';
import { bootAdmin } from '../components/adminPage.js';

bootAdmin('reports', () => {
  let rng = '7'; const df = $('#df'), dt = $('#dt'); dt.value = todayStr(); df.value = todayStr(new Date(Date.now() - 6 * 864e5));
  let cur = [];
  const inRange = (o) => {
    const d = todayStr(new Date(o.createdAt));
    if (rng === 'all') return true;
    if (rng === 'custom') return (!df.value || d >= df.value) && (!dt.value || d <= dt.value);
    return Date.now() - new Date(o.createdAt) < Number(rng) * 864e5;
  };
  function paint() {
    $$('#rng .tab').forEach((b) => b.classList.toggle('is-active', b.dataset.r === rng)); $('#cust').hidden = rng !== 'custom';
    const all = db.list('orders').filter(inRange); cur = all; const ok = all.filter((o) => o.status !== 'cancelled');
    const sales = ok.reduce((a, o) => a + o.total, 0);
    const k = (l, v, ic) => `<div class="stat"><div class="stat__label">${icon(ic)} ${t('admin-reports.' + l)}</div><div class="stat__value">${v}</div></div>`;
    $('#kpi').innerHTML = k('orders', ok.length, 'receipt') + k('sales', money(sales), 'money') + k('avg', money(ok.length ? sales / ok.length : 0), 'trending') + k('cancel', all.length - ok.length, 'xcircle');
    const by = {}; ok.forEach((o) => { const d = todayStr(new Date(o.createdAt)); by[d] = (by[d] || 0) + o.total; });
    const keys = Object.keys(by).sort();
    $('#c-day').innerHTML = keys.length ? '' : `<p class="text-muted">${t('admin-reports.none')}</p>`;
    if (keys.length) lineChart($('#c-day'), keys.map((d) => ({ label: d.slice(5), value: Math.round(by[d]) })), { height: 240, format: (v) => money(v), title: t('admin-reports.daily') });
    const cat = {}; ok.forEach((o) => o.items.forEach((i) => { const m = os.resolveItem(i.itemId); const c = db.get('categories', m && m.categoryId); const n = c ? tr(c.name) : '-'; cat[n] = (cat[n] || 0) + i.qty * i.price; }));
    $('#c-cat').innerHTML = ''; if (Object.keys(cat).length) donutChart($('#c-cat'), Object.entries(cat).map(([label, value]) => ({ label, value: Math.round(value) })), { size: 190, centerLabel: money(sales), title: t('admin-reports.cat') });
    const top = os.topItems(ok, 15);
    $('#top').innerHTML = top.length ? `<table class="table table--cards"><thead><tr><th>#</th><th>${t('admin-reports.dish')}</th><th>${t('admin-reports.qty')}</th><th>${t('admin-reports.rev')}</th></tr></thead><tbody>${top.map((x, i) => `<tr><td data-label="#">${i + 1}</td><td data-label="${t('admin-reports.dish')}">${esc(tr(x.name))}</td><td data-label="${t('admin-reports.qty')}">${x.qty}</td><td data-label="${t('admin-reports.rev')}">${money(x.revenue)}</td></tr>`).join('')}</tbody></table>` : `<p class="text-muted">${t('admin-reports.none')}</p>`;
    $('#exp2').onclick = () => download(`dishes-${todayStr()}.csv`, toCSV([['Dish', 'Qty', 'Revenue'], ...os.topItems(cur, 999).map((x) => [x.name.en, x.qty, x.revenue])]));
  }
  $('#rng').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { rng = b.dataset.r; paint(); } });
  df.addEventListener('change', paint); dt.addEventListener('change', paint);
  $('#exp').addEventListener('click', () => download(`orders-${todayStr()}.csv`, toCSV([['Order', 'Type', 'Table/Token', 'Status', 'Items', 'Subtotal', 'Discount', 'GST', 'Total', 'Payment', 'Created'], ...cur.map((o) => [o.id, o.type, o.type === 'parcel' ? o.parcelToken : o.tableNo, o.status, o.items.map((i) => `${i.qty}x ${i.name.en}`).join('; '), o.subtotal, o.discount, o.tax, o.total, o.payment?.method || '', o.createdAt])])));
  db.onChange((c) => { if (c === 'orders') paint(); }); onLangChange(paint); paint();
});
