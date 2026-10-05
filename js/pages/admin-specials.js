import { db } from '../dataService.js';
import { t, tr } from '../i18n.js';
import { esc, money, imgSrc, todayStr } from '../utils.js';
import { createCrud } from '../components/crud.js';
import { bootAdmin } from '../components/adminPage.js';

bootAdmin('specials', () => {
  const T = (k) => () => t('admin-specials.' + k); const C = (k) => () => t('admin-common.' + k);
  createCrud({ container: document.getElementById('crud'), collection: 'specials', entity: T('entity'), sort: (a, b) => b.date.localeCompare(a.date), searchText: (s) => `${s.title.en} ${s.title.ta}`,
    columns: [{ key: 'image', label: C('image'), render: (s) => `<img class="thumb" loading="lazy" src="${imgSrc(s.image)}" alt="">` }, { key: 'title', label: C('name'), render: (s) => `<b>${esc(tr(s.title))}</b>` }, { key: 'date', label: C('date'), sortable: true, render: (s) => esc(s.date) + (s.date === todayStr() ? ' *' : '') }, { key: 'price', label: T('price'), render: (s) => money(s.price) }, { key: 'active', label: C('active'), render: (s) => t(s.active !== false ? 'admin-common.yes' : 'admin-common.no') }],
    fields: [{ name: 'title', label: C('name'), type: 'bilingual', required: true }, { name: 'description', label: C('description'), type: 'bilingual-textarea' }, { name: 'date', label: T('day'), type: 'date', required: true, hint: T('dateHint') },
      { name: 'price', label: T('price'), type: 'number', min: 1, required: true }, { name: 'originalPrice', label: T('orig'), type: 'number', min: 0 }, { name: 'image', label: C('image'), type: 'image' },
      { name: 'itemIds', label: T('dishes'), type: 'multicheck', get options() { return db.list('menu').map((m) => ({ value: m.id, label: tr(m.name) })); } }, { name: 'isVeg', label: T('veg'), type: 'switch' }, { name: 'active', label: C('active'), type: 'switch', default: true }],
    newItem: () => ({ date: todayStr(), active: true, itemIds: [] }),
    beforeSave: (v) => ({ ...v, price: Number(v.price), originalPrice: Number(v.originalPrice) || 0 }) });
});
