import { db } from '../dataService.js';
import { t, onLangChange } from '../i18n.js';
import { $, esc, fmtDateTime } from '../utils.js';
import { toast, confirmDialog } from '../ui.js';
import { buildForm } from '../components/crud.js';
import { bootAdmin } from '../components/adminPage.js';

bootAdmin('settings', () => {
  const T = (k) => () => t('admin-settings.' + k);
  const s = db.get('settings'); const r = db.get('restaurant');
  const orderForm = buildForm({ values: { acceptingOrders: s.acceptingOrders !== false, enforceTimings: !!s.enforceTimings, open: s.timings?.open || '11:00', close: s.timings?.close || '22:00', taxName: s.taxName || 'GST', taxPercent: s.taxPercent ?? 5, orderCooldownSeconds: s.orderCooldownSeconds ?? 20, allowWaiterSoldOut: s.allowWaiterSoldOut !== false, popupEnabled: s.popupEnabled !== false, whatsapp: s.whatsapp || '' }, fields: [
    { name: 'acceptingOrders', label: T('accepting'), type: 'switch', hint: T('acceptingHint') }, { name: 'enforceTimings', label: T('enforce'), type: 'switch' },
    { name: 'open', label: T('open'), type: 'time' }, { name: 'close', label: T('close'), type: 'time', validate: (v, st) => v <= st.open ? t('admin-settings.bad') : '' },
    { name: 'taxName', label: T('taxName'), type: 'text', required: true }, { name: 'taxPercent', label: T('taxPercent'), type: 'number', min: 0, max: 40, step: 0.5 },
    { name: 'orderCooldownSeconds', label: T('cooldown'), type: 'number', min: 0, max: 600, hint: T('cooldownHint') }, { name: 'allowWaiterSoldOut', label: T('soldOut'), type: 'switch' }, { name: 'popupEnabled', label: T('popup'), type: 'switch' }, { name: 'whatsapp', label: T('whatsapp'), type: 'text', pattern: '^\\d{10,15}$', placeholder: '919952335513' }] });
  const infoForm = buildForm({ values: { name: r.name, tagline: r.tagline, address: r.address, phone: r.phone, email: r.email, instagramUrl: r.instagramUrl, mapUrl: r.mapUrl, mapEmbed: r.mapEmbed || '' }, fields: [
    { name: 'name', label: T('rname'), type: 'bilingual', required: true }, { name: 'tagline', label: T('tagline'), type: 'bilingual' }, { name: 'address', label: T('address'), type: 'bilingual-textarea', required: true },
    { name: 'phone', label: T('phone'), type: 'text', required: true }, { name: 'email', label: T('email'), type: 'email' }, { name: 'instagramUrl', label: T('insta'), type: 'text' }, { name: 'mapUrl', label: T('mapUrl'), type: 'text' }, { name: 'mapEmbed', label: T('mapEmbed'), type: 'text', hint: T('mapHint') }] });
  $('#f-order').append(orderForm.el); $('#f-info').append(infoForm.el);
  $('#save').addEventListener('click', () => {
    const a = orderForm.validate(); const b = infoForm.validate(); if (!a || !b) return;
    const o = orderForm.getValues();
    db.update('settings', { acceptingOrders: o.acceptingOrders, enforceTimings: o.enforceTimings, timings: { open: o.open, close: o.close }, taxName: o.taxName, taxPercent: Number(o.taxPercent), orderCooldownSeconds: Number(o.orderCooldownSeconds), allowWaiterSoldOut: o.allowWaiterSoldOut, popupEnabled: o.popupEnabled, whatsapp: o.whatsapp });
    db.update('restaurant', infoForm.getValues());
    db.audit('settings:update', `${o.acceptingOrders ? t('admin-settings.onNote') : t('admin-settings.offNote')}, ${o.taxName} ${o.taxPercent}%`); toast(t('admin-settings.saved'), { type: 'ok' }); log();
  });
  function log() {
    const rows = db.list('audit');
    $('#log').innerHTML = rows.length ? `<table class="table table--cards"><thead><tr><th>${t('admin-settings.logWhen')}</th><th>${t('admin-settings.logWho')}</th><th>${t('admin-settings.logWhat')}</th></tr></thead><tbody>${rows.slice(0, 40).map((x) => `<tr><td data-label="${t('admin-settings.logWhen')}">${fmtDateTime(x.at)}</td><td data-label="${t('admin-settings.logWho')}">${esc(x.by)}</td><td data-label="${t('admin-settings.logWhat')}"><b>${esc(x.action)}</b> ${esc(x.detail)}</td></tr>`).join('')}</tbody></table>` : `<p class="text-muted">${t('admin-settings.logNone')}</p>`;
  }
  $('#reset').addEventListener('click', async () => {
    if (!(await confirmDialog({ title: t('admin-settings.resetTitle'), message: t('admin-settings.resetMsg'), confirmText: t('admin-settings.reset'), danger: true }))) return;
    await db.reset(); toast(t('admin-settings.resetDone'), { type: 'ok' }); setTimeout(() => location.replace('login.html'), 700);
  });
  db.onChange((c) => { if (c === 'audit') log(); }); onLangChange(log); log();
});
