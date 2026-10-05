import { db } from '../dataService.js';
import { t } from '../i18n.js';
import { onLangChange } from '../i18n.js';
import { $, el, esc, download, imgSrc, url } from '../utils.js';
import { icon } from '../icons.js';
import { toast } from '../ui.js';
import { createCrud } from '../components/crud.js';
import { qrSVG, qrPNG, urls, baseUrl } from '../qr.js';
import { bootAdmin } from '../components/adminPage.js';

bootAdmin('tables', () => {
  const T = (k) => () => t('admin-tables.' + k); const C = (k) => () => t('admin-common.' + k);
  const waiters = () => db.list('staff', (s) => s.role === 'waiter').map((s) => ({ value: s.id, label: s.name }));
  const crud = createCrud({ container: $('#crud'), collection: 'tables', entity: T('entity'), modalSize: 'md', sort: (a, b) => a.number - b.number, searchText: (x) => `${x.number} ${x.area}`,
    columns: [{ key: 'number', label: T('no'), sortable: true, render: (x) => `<b>${x.number}</b>` }, { key: 'seats', label: T('seats') }, { key: 'area', label: T('area'), render: (x) => esc(x.area || '') },
      { key: 'waiterId', label: T('waiter'), render: (x) => esc(db.get('staff', x.waiterId)?.name || t('admin-tables.none')) }, { key: 'active', label: C('active'), render: (x) => t(x.active !== false ? 'admin-common.yes' : 'admin-common.no') }],
    fields: [{ name: 'number', label: T('no'), type: 'number', min: 1, max: 999, required: true, validate: (v, st) => db.find('tables', (x) => Number(x.number) === Number(v) && x.id !== st.id) ? t('admin-tables.dup') : '' }, { name: 'seats', label: T('seats'), type: 'number', min: 1, max: 30, default: 4 },
      { name: 'area', label: T('area'), type: 'text', default: 'AC Hall' }, { name: 'waiterId', label: T('waiter'), type: 'select', get options() { return [{ value: '', label: t('admin-tables.none') }, ...waiters()]; } }, { name: 'active', label: C('active'), type: 'switch', default: true }],
    newItem: () => ({ number: Math.max(0, ...db.list('tables').map((x) => x.number)) + 1, seats: 4, area: 'AC Hall', waiterId: '', active: true }),
    beforeSave: (v) => ({ ...v, number: Number(v.number), seats: Number(v.seats), waiterId: v.waiterId || null }),
    canDelete: (x) => os_open(x.number) ? t('admin-tables.inUse') : true, afterChange: drawQR });
  function os_open(no) { return db.list('tableSessions', (s) => String(s.tableNo) === String(no) && !s.closedAt).length > 0; }

  const grid = $('#qr-grid'); const base = $('#base'); base.value = db.get('settings').baseUrl || '';
  $('#base-save').addEventListener('click', () => {
    const v = base.value.trim(); if (v && !/^https?:\/\/[^\s/]+\.?[^\s]*$/i.test(v)) return toast(t('admin-tables.invalidUrl'), { type: 'warn' });
    db.update('settings', { baseUrl: v.replace(/\/+$/, '') }); db.audit('settings:baseUrl', v || '(site address)'); toast(t('admin-tables.baseSaved'), { type: 'ok' }); drawQR();
  });
  function card(label, sub, link, file) {
    const n = el('article', { class: 'qr-card' }); n.innerHTML = `<div class="qr-card__brand"><img src="${url('assets/logo/logo-mark-160.png')}" alt=""><b>Billy Belly Chicken</b></div><h3 class="qr-card__t">${esc(label)}</h3><div class="qr-card__qr">${qrSVG(link, { size: 200 })}</div><p class="qr-card__s">${esc(sub)}</p><code class="qr-card__u">${esc(link)}</code>
      <div class="qr-card__a"><button class="btn btn--ghost btn--sm" data-png type="button">${icon('download')}<span>${t('admin-tables.png')}</span></button><button class="btn btn--ghost btn--sm" data-copy type="button">${icon('copy')}<span>${t('admin-tables.copy')}</span></button></div>`;
    n.querySelector('[data-png]').onclick = async () => download(file, await qrPNG(link), 'image/png');
    n.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(link); } catch { /* ignore */ } toast(t('admin-tables.copied')); };
    return n;
  }
  function drawQR() {
    grid.replaceChildren(...db.list('tables', (x) => x.active !== false).sort((a, b) => a.number - b.number).map((x) => card(`${t('common.table')} ${x.number}`, t('admin-tables.scan'), urls.table(x.number), `table-${x.number}.png`)),
      card(t('admin-tables.parcelQr'), t('admin-tables.scanParcel'), urls.parcel(), 'parcel.png'), card(t('admin-tables.reviewQr'), t('admin-tables.scanReview'), urls.review(), 'review.png'));
  }
  $('#print').addEventListener('click', () => { document.body.classList.add('printing-qr'); window.print(); setTimeout(() => document.body.classList.remove('printing-qr'), 600); });
  onLangChange(drawQR); drawQR();
});
