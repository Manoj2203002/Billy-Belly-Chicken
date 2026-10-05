import { db } from '../dataService.js';
import { t, tr } from '../i18n.js';
import { el, esc, money, fmtDateTime, isToday } from '../utils.js';
import { icon } from '../icons.js';
import { openModal, promptDialog, toast } from '../ui.js';
import * as os from '../orderService.js';
import { createCrud } from '../components/crud.js';
import { editOrder, stBadge } from '../components/waiterActions.js';
import { bootAdmin } from '../components/adminPage.js';

bootAdmin('orders', ({ user }) => {
  const T = (k) => () => t('admin-orders.' + k);
  const ST = ['placed', 'confirmed', 'served', 'ready', 'completed', 'handed', 'cancelled'];
  function setStatus(o) {
    const sel = el('select', { class: 'select' }, ...ST.filter((s) => s === 'cancelled' || os.flowFor(o).includes(s)).map((s) => el('option', { value: s }, t('status.' + s)))); sel.value = o.status;
    const ok = el('button', { class: 'btn btn--primary', type: 'button' }, t('common.save'));
    const m = openModal({ title: t('admin-orders.statusTitle', { id: o.id }), size: 'sm', body: el('div', { class: 'field' }, el('label', { class: 'field__label' }, t('admin-orders.newStatus')), sel), footer: [ok] });
    ok.addEventListener('click', async () => {
      if (sel.value === o.status) return m.close(); let reason = '';
      if (sel.value === 'cancelled') { m.close(); reason = await promptDialog({ title: t('admin-orders.cancel'), label: t('admin-orders.reason'), required: true, textarea: true }); if (!reason) return; }
      os.setStatus(o.id, sel.value, { by: user.name, reason }); db.audit('order:status', `${o.id} -> ${sel.value}`); toast(t('admin-orders.saved'), { type: 'ok' }); m.close(); crud.refresh();
    });
  }
  const crud = createCrud({ container: document.getElementById('crud'), collection: 'orders', readOnly: true, entity: T('entity'), sort: (a, b) => b.createdAt.localeCompare(a.createdAt), nameOf: (o) => o.id,
    searchText: (o) => `${o.id} ${o.tableNo || ''} ${o.parcelToken || ''} ${o.customer?.name || ''} ${o.customer?.phone || ''} ${o.items.map((i) => i.name.en).join(' ')}`,
    filters: [{ name: 'st', label: () => t('admin-common.status'), options: ST.map((s) => ({ value: s, label: () => t('status.' + s) })), test: (o, v) => o.status === v }, { name: 'ty', label: T('type'), options: [{ value: 'dine-in', label: T('dine') }, { value: 'parcel', label: T('parcel') }], test: (o, v) => (o.type === 'parcel') === (v === 'parcel') }, { name: 'day', label: T('anyDay'), options: [{ value: 't', label: T('today') }], test: (o) => isToday(o.createdAt) }],
    columns: [{ key: 'id', label: T('id'), render: (o) => `<b>${o.id}</b>` }, { key: 'where', label: T('where'), render: (o) => o.type === 'parcel' ? o.parcelToken : `${t('common.table')} ${o.tableNo}` },
      { key: 'customer', label: T('customer'), render: (o) => esc(o.customer?.name || '-') }, { key: 'items', label: T('items'), render: (o) => o.items.map((i) => `${i.qty}× ${esc(tr(i.name))}`).join(', ') },
      { key: 'total', label: T('total'), render: (o) => money(o.total) }, { key: 'status', label: () => t('admin-common.status'), render: (o) => stBadge(o.status) }, { key: 'createdAt', label: T('time'), render: (o) => fmtDateTime(o.createdAt) }],
    rowActions: (o) => [
      el('button', { class: 'icon-btn', type: 'button', title: t('admin-orders.setStatus'), 'aria-label': t('admin-orders.setStatus'), html: icon('refresh'), onclick: () => setStatus(o) }),
      ...(['completed', 'handed', 'cancelled'].includes(o.status) ? [] : [el('button', { class: 'icon-btn', type: 'button', title: t('admin-orders.editItems'), 'aria-label': t('admin-orders.editItems'), html: icon('edit'), onclick: async () => { await editOrder(o, user); crud.refresh(); } })]) ] });
  db.onChange((c) => { if (c === 'orders') crud.refresh(); });
});
