import { db } from '../dataService.js';
import { t } from '../i18n.js';
import { el, esc, fmtDate } from '../utils.js';
import { icon, starsHTML } from '../icons.js';
import { promptDialog, toast } from '../ui.js';
import { createCrud } from '../components/crud.js';
import { setNavCount } from '../portal.js';
import { bootAdmin } from '../components/adminPage.js';

bootAdmin('reviews', () => {
  const T = (k) => () => t('admin-reviews.' + k);
  const set = (r, patch, msg) => { db.update('reviews', r.id, patch); db.audit('review:update', `${r.name}: ${msg}`); toast(t('admin-reviews.saved'), { type: 'ok' }); crud.refresh(); badge(); };
  const badge = () => setNavCount('reviews', db.list('reviews', (r) => r.status === 'pending').length);
  const btn = (ic, key, fn, cls = '') => el('button', { class: `icon-btn ${cls}`, type: 'button', title: t('admin-reviews.' + key), 'aria-label': t('admin-reviews.' + key), html: icon(ic), onclick: fn });
  const crud = createCrud({ container: document.getElementById('crud'), collection: 'reviews', readOnly: true, entity: T('entity'), nameOf: (r) => r.name, sort: (a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || b.createdAt.localeCompare(a.createdAt), searchText: (r) => `${r.name} ${r.comment}`,
    filters: [{ name: 'st', label: () => t('admin-common.status'), options: ['pending', 'approved', 'rejected'].map((v) => ({ value: v, label: T(v) })), test: (r, v) => r.status === v }],
    columns: [{ key: 'name', label: T('guest'), render: (r) => `<b>${esc(r.name || t('admin-reviews.guest'))}</b>${r.tableNo ? `<small class="text-faint"> · ${t('common.table')} ${r.tableNo}</small>` : ''}` }, { key: 'rating', label: T('rating'), render: (r) => starsHTML(r.rating) },
      { key: 'comment', label: T('comment'), render: (r) => `<div style="max-width:46ch">${esc(r.comment)}${r.reply ? `<div class="text-faint" style="margin-top:.3rem">↳ ${esc(r.reply)}</div>` : ''}</div>` },
      { key: 'status', label: () => t('admin-common.status'), render: (r) => `<span class="badge ${r.status === 'pending' ? 'badge--red' : ''}">${t('admin-reviews.' + r.status)}</span>` }, { key: 'createdAt', label: T('when'), render: (r) => fmtDate(r.createdAt) }],
    rowActions: (r) => [
      ...(r.status !== 'approved' ? [btn('check', 'approve', () => set(r, { status: 'approved' }, 'approved'))] : []), ...(r.status !== 'rejected' ? [btn('close', 'reject', () => set(r, { status: 'rejected' }, 'rejected'))] : []),
      btn('chat', 'replyAction', async () => { const v = await promptDialog({ title: t('admin-reviews.replyTitle', { name: r.name }), label: t('admin-reviews.replyLabel'), value: r.reply || '', textarea: true }); if (v != null) set(r, { reply: v.trim() }, 'reply'); })] });
  db.onChange((c) => { if (c === 'reviews') { crud.refresh(); badge(); } }); badge();
});
