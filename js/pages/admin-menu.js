import { db } from '../dataService.js';
import { t, tr } from '../i18n.js';
import { $, esc, money, imgSrc } from '../utils.js';
import { icon, vegMark } from '../icons.js';
import { createCrud } from '../components/crud.js';
import { bootAdmin } from '../components/adminPage.js';

bootAdmin('menu', () => {
  const T = (k) => () => t('admin-menu.' + k); const C = (k) => () => t('admin-common.' + k);
  const catOpts = () => db.list('categories').sort((a, b) => a.order - b.order).map((c) => ({ value: c.id, label: tr(c.name) }));
  const seg = $('#seg'); const catBox = $('#crud-cat'), itemBox = $('#crud-item');
  const show = (w) => { catBox.hidden = w !== 'cat'; itemBox.hidden = w !== 'item'; seg.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.w === w)); };
  seg.addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (b) show(b.dataset.w); });
  const dot = (on) => `<span class="dot ${on ? 'dot--on' : ''}"></span>${t(on ? 'admin-common.yes' : 'admin-common.no')}`;

  createCrud({ container: catBox, collection: 'categories', entity: T('entityCat'), modalSize: 'md', sort: (a, b) => a.order - b.order, searchText: (c) => `${c.name.en} ${c.name.ta}`,
    columns: [{ key: 'order', label: C('order'), sortable: true }, { key: 'name', label: C('name'), render: (c) => `<b>${esc(tr(c.name))}</b>` }, { key: 'active', label: C('active'), render: (c) => dot(c.active !== false) }],
    fields: [{ name: 'name', label: C('name'), type: 'bilingual', required: true }, { name: 'icon', label: T('icon'), type: 'text', default: 'flame', hint: 'flame, bowl, burger, drumstick ...' }, { name: 'order', label: C('order'), type: 'number', min: 1, default: db.list('categories').length + 1 }, { name: 'active', label: C('active'), type: 'switch', default: true }],
    newItem: () => ({ order: db.list('categories').length + 1, active: true, icon: 'flame' }),
    canDelete: (c) => db.list('menu', (m) => m.categoryId === c.id).length ? t('admin-menu.inUse') : true });

  createCrud({ container: itemBox, collection: 'menu', entity: T('entityItem'), modalSize: 'lg', sort: (a, b) => (a.categoryId > b.categoryId ? 1 : a.categoryId < b.categoryId ? -1 : a.order - b.order), searchText: (m) => `${m.name.en} ${m.name.ta} ${m.description?.en || ''}`,
    filters: [{ name: 'cat', label: C('category'), get options() { return catOpts(); }, test: (m, v) => m.categoryId === v }, { name: 'av', label: C('status'), options: [{ value: 'y', label: T('onMenu') }, { value: 'n', label: T('soldOut') }], test: (m, v) => (v === 'y') === (m.available !== false) }],
    columns: [{ key: 'image', label: C('image'), render: (m) => `<img class="thumb" loading="lazy" src="${imgSrc(m.image)}" alt="">` },
      { key: 'name', label: C('name'), sortable: true, sortValue: (m) => m.name.en, render: (m) => `<div class="cell-name"><div>${vegMark(m.isVeg)} <b>${esc(tr(m.name))}</b><small>${esc(tr(db.get('categories', m.categoryId)?.name) || '')}</small></div></div>` },
      { key: 'price', label: C('price'), sortable: true, render: (m) => money(m.price) }, { key: 'available', label: T('avail'), render: (m) => dot(m.available !== false) }],
    fields: [{ name: 'categoryId', label: C('category'), type: 'select', required: true, get options() { return catOpts(); } }, { name: 'name', label: C('name'), type: 'bilingual', required: true }, { name: 'description', label: C('description'), type: 'bilingual-textarea' },
      { name: 'price', label: C('price'), type: 'number', min: 1, step: 1, required: true }, { name: 'spiceLevel', label: T('spice'), type: 'select', options: [{ value: 0, label: T('s0') }, { value: 1, label: T('s1') }, { value: 2, label: T('s2') }, { value: 3, label: T('s3') }] },
      { name: 'image', label: C('image'), type: 'image' }, { name: 'tags', label: C('tags'), type: 'multicheck', options: [{ value: 'bestseller', label: T('tagBest') }, { value: 'chef', label: T('tagChef') }, { value: 'new', label: T('tagNew') }] },
      { name: 'isVeg', label: T('veg'), type: 'switch' }, { name: 'available', label: T('avail'), type: 'switch', default: true }, { name: 'featured', label: T('feat'), type: 'switch' }, { name: 'order', label: C('order'), type: 'number', min: 1, default: 99 }],
    newItem: () => ({ categoryId: catOpts()[0]?.value, available: true, spiceLevel: 1, tags: [], order: 99 }),
    beforeSave: (v) => ({ ...v, spiceLevel: Number(v.spiceLevel), price: Number(v.price), allergens: v.allergens || [] }) });
  show('item');
});
