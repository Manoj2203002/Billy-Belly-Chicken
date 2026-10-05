import { db } from '../dataService.js';
import { t, tr } from '../i18n.js';
import { el, esc, imgSrc } from '../utils.js';
import { icon } from '../icons.js';
import { createCrud } from '../components/crud.js';
import { bootAdmin } from '../components/adminPage.js';

bootAdmin('gallery', () => {
  const T = (k) => () => t('admin-gallery.' + k); const C = (k) => () => t('admin-common.' + k);
  function move(id, dir) {
    const list = db.list('gallery').sort((a, b) => a.order - b.order); const i = list.findIndex((g) => g.id === id); const j = i + dir; if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; list.forEach((g, n) => { g.order = n + 1; }); db.save('gallery', list); db.audit('gallery:reorder', id); crud.refresh();
  }
  const crud = createCrud({ container: document.getElementById('crud'), collection: 'gallery', entity: T('entity'), sort: (a, b) => a.order - b.order, searchText: (g) => `${g.caption?.en} ${g.caption?.ta}`,
    filters: [{ name: 'cat', label: T('cat'), options: ['food', 'ambience', 'team'].map((v) => ({ value: v, label: T(v) })), test: (g, v) => g.category === v }],
    columns: [{ key: 'order', label: C('order'), sortable: true }, { key: 'image', label: C('image'), render: (g) => `<img class="thumb" loading="lazy" src="${imgSrc(g.image)}" alt="">` }, { key: 'caption', label: T('caption'), render: (g) => esc(tr(g.caption)) }, { key: 'category', label: T('cat'), render: (g) => t('admin-gallery.' + g.category) }],
    rowActions: (g) => [el('button', { class: 'icon-btn', type: 'button', title: t('admin-gallery.up'), 'aria-label': t('admin-gallery.up'), html: icon('arrowup'), onclick: () => move(g.id, -1) }), el('button', { class: 'icon-btn', type: 'button', title: t('admin-gallery.down'), 'aria-label': t('admin-gallery.down'), html: icon('arrowdown'), onclick: () => move(g.id, 1) })],
    fields: [{ name: 'image', label: C('image'), type: 'image', required: true, hint: T('hint') }, { name: 'caption', label: T('caption'), type: 'bilingual', required: true }, { name: 'category', label: T('cat'), type: 'select', options: ['food', 'ambience', 'team'].map((v) => ({ value: v, label: T(v) })) }],
    newItem: () => ({ category: 'food', order: db.list('gallery').length + 1 }), beforeSave: (v, ex) => ({ ...v, order: ex ? ex.order : db.list('gallery').length + 1 }),
    afterChange: () => { const l = db.list('gallery').sort((a, b) => a.order - b.order); l.forEach((g, n) => { g.order = n + 1; }); db.save('gallery', l); crud.refresh(); } });
});
