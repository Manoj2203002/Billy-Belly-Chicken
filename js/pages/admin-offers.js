import { db } from '../dataService.js';
import { t, tr } from '../i18n.js';
import { esc, imgSrc, todayStr } from '../utils.js';
import { createCrud } from '../components/crud.js';
import { bootAdmin } from '../components/adminPage.js';

bootAdmin('offers', () => {
  const T = (k) => () => t('admin-offers.' + k); const C = (k) => () => t('admin-common.' + k);
  const state = (o) => o.active === false ? 'off' : (o.validTo && o.validTo < todayStr()) ? 'expired' : (o.validFrom && o.validFrom > todayStr()) ? 'expired' : 'live';
  createCrud({ container: document.getElementById('crud'), collection: 'offers', entity: T('entity'), searchText: (o) => `${o.title.en} ${o.title.ta}`, sort: (a, b) => (b.validTo || '').localeCompare(a.validTo || ''),
    columns: [{ key: 'image', label: C('image'), render: (o) => `<img class="thumb" loading="lazy" src="${imgSrc(o.image)}" alt="">` }, { key: 'title', label: C('name'), render: (o) => `<b>${esc(tr(o.title))}</b>` },
      { key: 'value', label: T('value'), render: (o) => o.discountType === 'percent' ? `${o.value}%` : `₹${o.value}` }, { key: 'validTo', label: T('valid'), render: (o) => `${esc(o.validFrom || '')} → ${esc(o.validTo || '')}` },
      { key: 'active', label: T('status'), render: (o) => `<span class="badge ${state(o) === 'live' ? 'badge--red' : ''}">${t('admin-offers.' + state(o))}</span>` }],
    fields: [{ name: 'title', label: C('name'), type: 'bilingual', required: true }, { name: 'description', label: C('description'), type: 'bilingual-textarea' },
      { name: 'discountType', label: T('type'), type: 'select', options: [{ value: 'percent', label: T('percent') }, { value: 'flat', label: T('flat') }] }, { name: 'value', label: T('value'), type: 'number', min: 1, required: true },
      { name: 'validFrom', label: C('from'), type: 'date' }, { name: 'validTo', label: C('to'), type: 'date' }, { name: 'image', label: C('image'), type: 'image' },
      { name: 'categoryIds', label: T('cats'), type: 'multicheck', hint: T('scopeHint'), get options() { return db.list('categories').map((c) => ({ value: c.id, label: tr(c.name) })); } },
      { name: 'itemIds', label: T('dishes'), type: 'multicheck', get options() { return db.list('menu').map((m) => ({ value: m.id, label: tr(m.name) })); } }, { name: 'active', label: C('active'), type: 'switch', default: true }],
    newItem: () => ({ discountType: 'percent', value: 10, validFrom: todayStr(), active: true, itemIds: [], categoryIds: [] }),
    beforeSave: (v) => { if (v.validFrom && v.validTo && v.validTo < v.validFrom) { import('../ui.js').then((u) => u.toast(t('admin-offers.range'), { type: 'warn' })); return false; } if (v.discountType === 'percent' && v.value > 90) v.value = 90; return { ...v, value: Number(v.value) }; } });
});
