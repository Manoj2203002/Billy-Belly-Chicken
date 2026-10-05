import { db } from '../dataService.js';
import { t, tr } from '../i18n.js';
import { el, esc, imgSrc } from '../utils.js';
import { icon } from '../icons.js';
import { openModal, toast } from '../ui.js';
import { createCrud, buildForm } from '../components/crud.js';
import { bootAdmin } from '../components/adminPage.js';

bootAdmin('staff', ({ user }) => {
  const T = (k) => () => t('admin-staff.' + k); const C = (k) => () => t('admin-common.' + k);
  const tablesOf = (id) => db.list('tables', (x) => x.waiterId === id).map((x) => x.number).sort((a, b) => a - b);
  function assign(s) {
    const mine = new Set(db.list('tables', (x) => x.waiterId === s.id).map((x) => x.id));
    const f = buildForm({ fields: [{ name: 'ids', label: T('tables'), type: 'multicheck', hint: T('assignHint'), options: db.list('tables').sort((a, b) => a.number - b.number).map((x) => ({ value: x.id, label: `${t('common.table')} ${x.number}` })) }], values: { ids: [...mine] } });
    const ok = el('button', { class: 'btn btn--primary', type: 'button' }, t('common.save'));
    const m = openModal({ title: t('admin-staff.assignTitle', { name: s.name }), body: f.el, footer: [ok], size: 'md' });
    ok.addEventListener('click', () => { const ids = new Set(f.getValues().ids);
      db.list('tables').forEach((x) => { if (ids.has(x.id)) db.update('tables', x.id, { waiterId: s.id }); else if (x.waiterId === s.id) db.update('tables', x.id, { waiterId: null }); });
      db.audit('staff:assign', `${s.name}: ${[...ids].length} tables`); toast(t('admin-staff.moved')); m.close(); crud.refresh(); });
  }
  const crud = createCrud({ container: document.getElementById('crud'), collection: 'staff', entity: T('entity'), modalSize: 'lg', sort: (a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'admin' ? -1 : 1), searchText: (s) => `${s.name} ${s.username} ${s.employeeId} ${s.phone}`,
    filters: [{ name: 'role', label: T('role'), options: [{ value: 'waiter', label: T('waiter') }, { value: 'admin', label: T('admin') }], test: (s, v) => s.role === v }],
    columns: [{ key: 'name', label: C('name'), sortable: true, render: (s) => `<div class="cell-name"><img class="thumb" src="${imgSrc(s.photo)}" alt=""><div><b>${esc(s.name)}</b><small>${esc(s.employeeId || '')} · @${esc(s.username)}</small></div></div>` },
      { key: 'role', label: T('role'), render: (s) => t('admin-staff.' + s.role) }, { key: 'shift', label: T('shift'), render: (s) => esc(s.shift || '') },
      { key: 'tables', label: T('tables'), render: (s) => s.role === 'waiter' ? (tablesOf(s.id).join(', ') || t('admin-staff.none')) : '-' }, { key: 'active', label: C('active'), render: (s) => t(s.active !== false ? 'admin-common.yes' : 'admin-common.no') }],
    rowActions: (s) => s.role === 'waiter' ? [el('button', { class: 'icon-btn', type: 'button', title: t('admin-staff.assign'), 'aria-label': t('admin-staff.assign'), html: icon('table'), onclick: () => assign(s) })] : [],
    fields: [{ name: 'name', label: C('name'), type: 'text', required: true }, { name: 'employeeId', label: T('emp'), type: 'text' }, { name: 'phone', label: T('phone'), type: 'tel' }, { name: 'role', label: T('role'), type: 'select', options: [{ value: 'waiter', label: T('waiter') }, { value: 'admin', label: T('admin') }] },
      { name: 'username', label: T('user'), type: 'text', required: true, pattern: '^[a-zA-Z0-9._-]{3,}$', validate: (v, st) => db.find('staff', (x) => x.username.toLowerCase() === String(v).toLowerCase() && x.id !== st.id) ? t('admin-staff.dupUser') : '' },
      { name: 'password', label: T('pass'), type: 'text', required: true, minLength: 6, hint: T('passHint') }, { name: 'shift', label: T('shift'), type: 'text' }, { name: 'photo', label: C('image'), type: 'image' }, { name: 'active', label: C('active'), type: 'switch', default: true }],
    newItem: () => ({ role: 'waiter', active: true, shift: 'Morning 11:00-16:00', photo: 'assets/images/staff/w01.svg' }),
    beforeSave: (v, ex) => { if (ex && ex.id === user.id && v.active === false) { toast(t('admin-staff.self'), { type: 'warn' }); return false; } if (!v.employeeId) v.employeeId = `BBC-${v.role === 'admin' ? 'A' : 'W'}${String(db.list('staff').length + 1).padStart(2, '0')}`; return v; },
    canDelete: (s) => s.id === user.id ? t('admin-staff.self') : (s.role === 'admin' && db.list('staff', (x) => x.role === 'admin').length < 2) ? t('admin-staff.lastAdmin') : true,
    deleteMessage: (s) => t('common.deleteMsg', { name: s.name }) });
  db.onChange((c) => { if (c === 'tables') crud.refresh(); });
});
