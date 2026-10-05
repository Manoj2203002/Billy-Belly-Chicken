/* ==========================================================================
   crud.js - generic form builder + CRUD table view used by every admin module.
   buildForm({fields, values})  and  createCrud({...})  -- see bottom for docs.
   ========================================================================== */
import { db } from '../dataService.js';
import { el, esc, debounce, readFileAsDataURL, imgSrc, $, $$ } from '../utils.js';
import { icon } from '../icons.js';
import { t, tr, getLang, onLangChange } from '../i18n.js';
import { openModal, confirmDialog, toast, emptyState } from '../ui.js';

/** label helper: i18n key (contains a dot and resolves) or plain string */
export const L = (s) => { if (s == null) return ''; if (typeof s === 'function') return s(); const v = t(s); return v === s ? s : v; };

/* ------------------------------------------------------------------ FORM BUILDER */
/**
 * field = { name, label, type, required, options:[{value,label}], hint, span, min, max, step, pattern, placeholder, rows, default, readonly, showIf(values) }
 * types: text | textarea | number | tel | email | password | date | time | select | switch | bilingual | bilingual-textarea | image | multicheck | color
 *  - bilingual => value {en, ta}  (two inputs + "Auto-translate" button using translate.js)
 *  - image     => value string (path | URL | data URL) with URL input + file upload preview
 *  - multicheck=> value string[] of option values
 */
export function buildForm({ fields, values = {} }) {
  const form = el('form', { class: 'form-grid', novalidate: true });
  const state = structuredClone(values);
  const refs = {};
  const get = (name) => state[name];

  fields.forEach((f) => {
    if (state[f.name] === undefined) state[f.name] = f.default !== undefined ? f.default : (f.type === 'switch' ? false : f.type === 'multicheck' ? [] : f.type?.startsWith('bilingual') ? { en: '', ta: '' } : f.type === 'number' ? '' : '');
    const wrap = el('div', { class: `field ${f.span || f.type === 'textarea' || f.type?.startsWith('bilingual') || f.type === 'image' || f.type === 'multicheck' ? 'span-all' : ''}`, dataset: { name: f.name } });
    const label = el('label', { class: 'field__label' }, L(f.label), f.required ? el('span', { class: 'req', 'aria-hidden': 'true' }, '*') : null);
    const err = el('div', { class: 'field__error', role: 'alert' });
    const id = `f_${f.name}_${Math.random().toString(36).slice(2, 6)}`; label.htmlFor = id;
    let control;
    const base = { id, name: f.name, placeholder: f.placeholder ? L(f.placeholder) : null, readonly: f.readonly ? '' : null };

    if (['text', 'number', 'tel', 'email', 'password', 'date', 'time', 'color'].includes(f.type || 'text')) {
      control = el('input', { class: 'input', type: f.type || 'text', ...base, min: f.min, max: f.max, step: f.step, autocomplete: f.type === 'password' ? 'new-password' : 'off' });
      control.value = state[f.name] ?? ''; control.addEventListener('input', () => { state[f.name] = f.type === 'number' ? (control.value === '' ? '' : Number(control.value)) : control.value; });
    } else if (f.type === 'textarea') {
      control = el('textarea', { class: 'textarea', rows: f.rows || 3, ...base }); control.value = state[f.name] ?? '';
      control.addEventListener('input', () => { state[f.name] = control.value; });
    } else if (f.type === 'select') {
      control = el('select', { class: 'select', ...base }, ...(f.options || []).map((o) => el('option', { value: o.value }, L(o.label))));
      control.value = state[f.name] ?? ''; control.addEventListener('change', () => { state[f.name] = control.value; runShowIf(); });
    } else if (f.type === 'switch') {
      const inp = el('input', { type: 'checkbox', id, name: f.name }); inp.checked = !!state[f.name];
      inp.addEventListener('change', () => { state[f.name] = inp.checked; runShowIf(); });
      control = el('label', { class: 'switch', for: id }, inp, el('span', { class: 'switch__track' }), el('span', {}, L(f.label)));
      label.style.display = 'none';
    } else if (f.type === 'bilingual' || f.type === 'bilingual-textarea') {
      const multi = f.type === 'bilingual-textarea';
      const en = el(multi ? 'textarea' : 'input', { class: multi ? 'textarea' : 'input', id, lang: 'en', rows: 3 });
      en.value = state[f.name].en || '';
      en.addEventListener('input', () => { state[f.name].en = en.value; });
      control = en;
      refs[f.name + '.en'] = en;
    } else if (f.type === 'image') {
      const prev = el('img', { class: 'media', alt: '', style: 'width:96px;height:96px;object-fit:cover;border-radius:12px;background:var(--surface-3)' });
      const urlIn = el('input', { class: 'input', id, type: 'text', placeholder: 'assets/images/... or https://...' }); const file = el('input', { type: 'file', accept: 'image/*', class: 'input' });
      const sync = () => { prev.src = imgSrc(state[f.name]); urlIn.value = (state[f.name] || '').startsWith('data:') ? '(uploaded image)' : state[f.name] || ''; };
      urlIn.addEventListener('change', () => { state[f.name] = urlIn.value.trim(); sync(); });
      file.addEventListener('change', async () => { if (file.files[0]) { state[f.name] = await readFileAsDataURL(file.files[0]); sync(); } });
      sync(); control = el('div', { class: 'cluster', style: 'align-items:flex-start;flex-wrap:nowrap' }, prev, el('div', { class: 'stack', style: '--stack:.5rem;flex:1;min-width:0' }, urlIn, file));
    } else if (f.type === 'multicheck') {
      control = el('div', { class: 'cluster', style: '--gap:.4rem 1rem' }, ...(f.options || []).map((o) => {
        const c = el('input', { type: 'checkbox', value: o.value }); c.checked = (state[f.name] || []).includes(o.value);
        c.addEventListener('change', () => { const s = new Set(state[f.name]); c.checked ? s.add(o.value) : s.delete(o.value); state[f.name] = [...s]; });
        return el('label', { class: 'check' }, c, L(o.label));
      }));
    }
    wrap.append(...[label, control, f.hint ? el('div', { class: 'field__hint' }, L(f.hint)) : null, err].filter(Boolean));
    refs[f.name] = { wrap, err, control }; form.append(wrap);
  });
  const runShowIf = () => fields.forEach((f) => { if (f.showIf) refs[f.name].wrap.hidden = !f.showIf(state); });
  runShowIf();

  function validate() {
    let ok = true; let first = null;
    fields.forEach((f) => {
      const r = refs[f.name]; if (!r || r.wrap.hidden) return; let msg = '';
      const v = state[f.name];
      if (f.required) {
        if (f.type?.startsWith('bilingual')) { if (!String(v.en || '').trim()) msg = t('common.required'); }
        else if (v === '' || v == null || (Array.isArray(v) && !v.length)) msg = t('common.required');
      }
      if (!msg && v !== '' && v != null) {
        if (f.type === 'number') { if (Number.isNaN(Number(v))) msg = t('common.invalid'); else if (f.min != null && v < f.min) msg = t('common.minValue', { n: f.min }); else if (f.max != null && v > f.max) msg = t('common.maxValue', { n: f.max }); }
        if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg = t('common.invalidEmail');
        if (f.type === 'tel' && !/^[6-9]\d{9}$/.test(String(v).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''))) msg = t('common.invalidPhone');
        if (f.pattern && !new RegExp(f.pattern).test(v)) msg = f.patternMsg ? L(f.patternMsg) : t('common.invalid');
        if (f.minLength && String(v).length < f.minLength) msg = t('common.minLength', { n: f.minLength });
      }
      if (!msg && f.validate) msg = f.validate(v, state) || '';
      r.wrap.classList.toggle('has-error', !!msg); r.err.textContent = msg;
      if (msg) { ok = false; first ||= r.wrap; }
    });
    if (first) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); const i = first.querySelector('input,select,textarea'); i && i.focus({ preventScroll: true }); }
    return ok;
  }
  return { el: form, getValues: () => structuredClone(state), validate, setValue(n, v) { state[n] = v; }, refs };
}

/* ------------------------------------------------------------------ CRUD VIEW */
/**
 * createCrud({
 *   container, collection:'menu', title:'admin.menu.title',
 *   columns:[{ key, label, render:(item)=>html|string|Node, sortable, cls }],
 *   fields:[...buildForm fields...],
 *   searchText:(item)=>string,                       // text used by the search box (default: JSON of item)
 *   filters:[{ name, label, options:[{value,label}], test:(item,value)=>bool }],
 *   newItem:()=>({...defaults}),                      // defaults for Add
 *   beforeSave:(values, existing)=>values|false,      // normalise / extra validation
 *   afterChange:()=>void,
 *   canDelete:(item)=>bool|string, deleteMessage:(item)=>string,
 *   rowActions:(item)=>[Node],                        // extra per-row buttons
 *   formExtra:(form,{isEdit,existing})=>Node  (shown under the form, e.g. live preview),
 *   toolbarExtra:[Node],  sort:(a,b)=>n,  entity:'admin.menu.item'  (singular label for toasts),
 *   modalSize:'lg', readOnly:false, nameOf:(item)=>string (audit & confirmations)
 * }) -> { refresh(), openEdit(id), openCreate() }
 */
export function createCrud(cfg) {
  const { container, collection } = cfg;
  const state = { q: '', filters: {}, sortKey: null, dir: 1 };
  const searchIn = el('input', { class: 'input', type: 'search', placeholder: t('common.search'), 'aria-label': t('common.search') });
  const add = cfg.readOnly ? null : el('button', { class: 'btn btn--primary', type: 'button' }, el('span', { html: icon('plus') }), t('common.add'));
  const filterEls = (cfg.filters || []).map((f) => { const s = el('select', { class: 'select', 'aria-label': L(f.label) }, el('option', { value: '' }, L(f.label)), ...f.options.map((o) => el('option', { value: o.value }, L(o.label)))); s.addEventListener('change', () => { state.filters[f.name] = s.value; render(); }); return s; });
  const toolbar = el('div', { class: 'toolbar' }, el('div', { class: 'grow input-group', html: icon('search') }, searchIn), ...filterEls, ...(cfg.toolbarExtra || []), add);
  const wrap = el('div', { class: 'table-wrap' }); const countEl = el('div', { class: 'text-faint', style: 'margin-top:.8rem;font-size:var(--fs-xs)' });
  container.replaceChildren(toolbar, wrap, countEl);

  const nameOf = (it) => cfg.nameOf ? cfg.nameOf(it) : (typeof it.name === 'object' ? tr(it.name) : it.name || it.title && tr(it.title) || it.id);
  function rows() {
    let list = db.list(collection);
    const q = state.q.trim().toLowerCase();
    if (q) list = list.filter((it) => (cfg.searchText ? cfg.searchText(it) : JSON.stringify(it)).toLowerCase().includes(q));
    (cfg.filters || []).forEach((f) => { const v = state.filters[f.name]; if (v) list = list.filter((it) => f.test(it, v)); });
    if (state.sortKey) { const c = cfg.columns.find((x) => x.key === state.sortKey); list.sort((a, b) => { const va = c.sortValue ? c.sortValue(a) : a[c.key]; const vb = c.sortValue ? c.sortValue(b) : b[c.key]; return (va > vb ? 1 : va < vb ? -1 : 0) * state.dir; }); }
    else if (cfg.sort) list.sort(cfg.sort);
    return list;
  }
  function render(flashId) {
    const list = rows();
    if (!list.length) { wrap.innerHTML = emptyState({ icon: 'search', title: t('common.noResults'), text: t('common.noResultsHint') }); countEl.textContent = ''; return; }
    const tbl = el('table', { class: 'table table--cards' });
    tbl.append(el('thead', {}, el('tr', {}, ...cfg.columns.map((c) => { const th = el('th', { scope: 'col', style: c.sortable ? 'cursor:pointer' : null }, L(c.label), state.sortKey === c.key ? (state.dir > 0 ? ' ▲' : ' ▼') : ''); if (c.sortable) th.addEventListener('click', () => { state.dir = state.sortKey === c.key ? -state.dir : 1; state.sortKey = c.key; render(); }); return th; }), el('th', { class: 'text-right' }, ''))));
    const tb = el('tbody');
    list.forEach((it) => {
      const tr_ = el('tr', { class: it.id === flashId ? 'row-in' : '', dataset: { id: it.id } });
      cfg.columns.forEach((c) => { const v = c.render ? c.render(it) : esc(it[c.key] ?? ''); const td = el('td', { 'data-label': L(c.label), class: c.cls || '' }); v instanceof Node ? td.append(v) : (td.innerHTML = v ?? ''); tr_.append(td); });
      const act = el('td', { class: 'actions-cell' }, el('div', { class: 'actions' }, ...(cfg.rowActions ? cfg.rowActions(it, api) : []),
        cfg.readOnly ? null : el('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.edit'), title: t('common.edit'), html: icon('edit'), onclick: () => api.openEdit(it.id) }),
        cfg.readOnly ? null : el('button', { class: 'icon-btn icon-btn--danger', type: 'button', 'aria-label': t('common.delete'), title: t('common.delete'), html: icon('trash'), onclick: () => api.remove(it.id) })));
      tr_.append(act); tb.append(tr_);
    });
    tbl.append(tb); wrap.replaceChildren(tbl); countEl.textContent = t('common.showing', { n: list.length });
  }
  function openForm(existing) {
    const isEdit = !!existing; const values = existing ? existing : (cfg.newItem ? cfg.newItem() : {});
    const form = buildForm({ fields: cfg.fields, values });
    const cancel = el('button', { class: 'btn btn--ghost', type: 'button' }, t('common.cancel')); const save = el('button', { class: 'btn btn--primary', type: 'submit' }, t('common.save'));
    const extra = cfg.formExtra ? cfg.formExtra(form, { isEdit, existing }) : null; /* optional node shown under the form (e.g. a live preview) */
    const m = openModal({ title: `${isEdit ? t('common.edit') : t('common.add')} ${cfg.entity ? L(cfg.entity) : ''}`, size: cfg.modalSize || 'lg', body: extra ? el('div', { class: 'stack' }, form.el, extra) : form.el, footer: [cancel, save] });
    cancel.addEventListener('click', m.close);
    const submit = (e) => {
      e && e.preventDefault(); if (!form.validate()) return;
      let v = form.getValues(); if (cfg.beforeSave) { v = cfg.beforeSave(v, existing); if (v === false) return; }
      if (isEdit) { db.update(collection, existing.id, v); db.audit(`${collection}:update`, nameOf({ ...existing, ...v })); }
      else { const c = db.create(collection, v); v.id = c.id; db.audit(`${collection}:create`, nameOf(c)); existing = c; }
      m.close(); toast(isEdit ? t('common.saved') : t('common.created'), { type: 'ok' }); render(isEdit ? existing.id : v.id); cfg.afterChange && cfg.afterChange();
    };
    form.el.addEventListener('submit', submit); save.addEventListener('click', submit);
  }
  const api = {
    refresh: () => render(),
    openCreate: () => openForm(null),
    openEdit: (id) => { const it = db.get(collection, id); it && openForm(it); },
    async remove(id) {
      const it = db.get(collection, id); if (!it) return;
      const block = cfg.canDelete ? cfg.canDelete(it) : true; if (block !== true && block !== undefined) return toast(typeof block === 'string' ? block : t('common.cannotDelete'), { type: 'warn' });
      const ok = await confirmDialog({ title: t('common.confirmDelete'), message: cfg.deleteMessage ? cfg.deleteMessage(it) : t('common.deleteMsg', { name: nameOf(it) }), confirmText: t('common.delete'), danger: true }); if (!ok) return;
      const row = wrap.querySelector(`tr[data-id="${id}"]`); if (row) { row.classList.add('row-out'); await new Promise((r) => setTimeout(r, 380)); }
      db.remove(collection, id); db.audit(`${collection}:delete`, nameOf(it)); toast(t('common.deleted'), { type: 'ok' }); render(); cfg.afterChange && cfg.afterChange();
    },
  };
  searchIn.addEventListener('input', debounce(() => { state.q = searchIn.value; render(); }, 150));
  add && add.addEventListener('click', () => openForm(null));
  onLangChange(() => { /* relabel the toolbar too, not only the rows */
    searchIn.placeholder = t('common.search'); searchIn.setAttribute('aria-label', t('common.search'));
    if (add && add.lastChild) add.lastChild.textContent = t('common.add');
    (cfg.filters || []).forEach((f, i) => { const s = filterEls[i]; s.setAttribute('aria-label', L(f.label)); s.options[0].textContent = L(f.label); f.options.forEach((o, j) => { if (s.options[j + 1]) s.options[j + 1].textContent = L(o.label); }); });
    render();
  }); render();
  return api;
}

/* helpers for columns */
export const imgCell = (src, size = 48) => `<img src="${imgSrc(src)}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:10px;background:var(--surface-3)" loading="lazy">`;
export const boolBadge = (v, yes = 'common.yes', no = 'common.no') => `<span class="badge ${v ? 'badge--ok' : ''}">${t(v ? yes : no)}</span>`;
