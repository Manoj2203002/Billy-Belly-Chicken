import { db } from '../dataService.js';
import { t } from '../i18n.js';
import { onLangChange } from '../i18n.js';
import { $, el, esc, download, imgSrc, url } from '../utils.js';
import { icon } from '../icons.js';
import { toast } from '../ui.js';
import { createCrud } from '../components/crud.js';
import { qrSVG, qrPNG, urls, baseUrl, isPublicUrl } from '../qr.js';
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

  const groups = $('#qr-groups'); const base = $('#base'); base.value = db.get('settings').baseUrl || baseUrl();
  /* tabs */
  const tabs = document.querySelectorAll('[data-tab]');
  function showTab(k) { tabs.forEach((b) => { const on = b.dataset.tab === k; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); }); document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== k; }); try { history.replaceState(null, '', k === 'qr' ? '#qr' : location.pathname + location.search); } catch { /* file:// */ } }
  tabs.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  showTab(location.hash === '#qr' ? 'qr' : 'tables');
  function pub() {
    const ok = isPublicUrl(baseUrl()); const st = $('#pub-state');
    st.className = 'qr-pub__state ' + (ok ? 'is-ok' : 'is-warn'); st.textContent = ok ? t('admin-tables.live') : t('admin-tables.warnLocal');
    $('#pub-ico').innerHTML = icon(ok ? 'checkcircle' : 'xcircle'); $('#pub-ico').className = 'qr-pub__ico ' + (ok ? 'is-ok' : 'is-warn');
    $('#qr-test').href = urls.table(1);
  }
  $('#base-save').addEventListener('click', () => {
    const v = base.value.trim(); if (v && !/^https?:\/\/[^\s/]+\.?[^\s]*$/i.test(v)) return toast(t('admin-tables.invalidUrl'), { type: 'warn' });
    db.update('settings', { baseUrl: v.replace(/\/+$/, '') }); db.audit('settings:baseUrl', v || '(site address)'); toast(t('admin-tables.baseSaved'), { type: 'ok' }); drawQR();
  });
  $('#base-site').addEventListener('click', () => { db.update('settings', { baseUrl: '' }); base.value = baseUrl(); toast(t('admin-tables.baseSaved'), { type: 'ok' }); drawQR(); });
  function card(label, sub, link, file, tone = '') {
    const n = el('article', { class: 'qr-card' + (tone ? ' qr-card--' + tone : '') });
    n.innerHTML = `<header class="qr-card__top"><img src="${url('assets/logo/logo-mark-120.webp')}" alt=""><span>Billy Belly Chicken</span></header><h3 class="qr-card__t">${esc(label)}</h3><div class="qr-card__qr">${qrSVG(link, { size: 220 })}</div><p class="qr-card__s">${esc(sub)}</p><div class="qr-card__a"><button class="qr-ib qr-ib--main" data-png type="button" title="${t('admin-tables.png')}" aria-label="${t('admin-tables.png')}">${icon('download')}<span>PNG</span></button><button class="qr-ib" data-copy type="button" title="${t('admin-tables.copy')}" aria-label="${t('admin-tables.copy')}">${icon('copy')}</button><a class="qr-ib" href="${esc(link)}" target="_blank" rel="noopener" title="${t('admin-tables.open')}" aria-label="${t('admin-tables.open')}">${icon('eye')}</a></div>`;
    n.querySelector('[data-png]').onclick = async () => download(file, await qrPNG(link), 'image/png');
    n.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(link); } catch { /* ignore */ } toast(t('admin-tables.copied')); };
    return n;
  }
  const group = (title, cards) => { const g = el('div', { class: 'qr-group' }); g.innerHTML = `<h3 class="qr-group__h">${esc(title)}<em>${cards.length}</em></h3><div class="qr-grid"></div>`; g.querySelector('.qr-grid').append(...cards); return g; };
  function drawQR() {
    const all = db.list('tables'); const act = all.filter((x) => x.active !== false).sort((a, b) => a.number - b.number);
    $('#qr-stats').innerHTML = [[all.length, t('admin-tables.sTables')], [act.length, t('admin-tables.sActive')], [act.length + 2, t('admin-tables.sQr')]].map(([n, l]) => `<li><b>${n}</b><span>${esc(l)}</span></li>`).join('');
    $('#qr-example').textContent = urls.table(1); pub();
    groups.replaceChildren(
      group(t('admin-tables.groupTables'), act.map((x) => card(`${t('common.table')} ${x.number}`, t('admin-tables.scan'), urls.table(x.number), `table-${x.number}.png`))),
      group(t('admin-tables.groupOther'), [card(t('admin-tables.parcelQr'), t('admin-tables.scanParcel'), urls.parcel(), 'parcel.png', 'dark'), card(t('admin-tables.reviewQr'), t('admin-tables.scanReview'), urls.review(), 'review.png', 'dark')]));
  }
  $('#print').addEventListener('click', () => { document.body.classList.add('printing-qr'); window.print(); setTimeout(() => document.body.classList.remove('printing-qr'), 600); });
  onLangChange(drawQR); drawQR();
});
