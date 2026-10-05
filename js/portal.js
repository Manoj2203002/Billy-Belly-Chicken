/* ==========================================================================
   portal.js - shared shell for /admin and /waiter pages (sidebar drawer, topbar,
   language toggle, logout). Usage:  const user = await mountPortal({ role:'admin', active:'menu' })
   ========================================================================== */
import { guard, logout } from './auth.js';
import { db } from './dataService.js';
import { url, $, $$, el, imgSrc } from './utils.js';
import { icon, hydrateIcons } from './icons.js';
import { mountLangToggle, applyI18n, onLangChange } from './i18n.js';
import { initCommonUI } from './ui.js';

export const ADMIN_NAV = [
  { group: 'admin.nav.overview', items: [
    { id: 'dashboard', icon: 'dashboard', key: 'admin.nav.dashboard', href: 'dashboard.html' },
    { id: 'orders', icon: 'receipt', key: 'admin.nav.orders', href: 'orders.html' },
    { id: 'reports', icon: 'chart', key: 'admin.nav.reports', href: 'reports.html' } ] },
  { group: 'admin.nav.content', items: [
    { id: 'menu', icon: 'utensils', key: 'admin.nav.menu', href: 'menu.html' },
    { id: 'specials', icon: 'sparkle', key: 'admin.nav.specials', href: 'specials.html' },
    { id: 'offers', icon: 'tag', key: 'admin.nav.offers', href: 'offers.html' },
    { id: 'gallery', icon: 'image', key: 'admin.nav.gallery', href: 'gallery.html' },
    { id: 'reviews', icon: 'star', key: 'admin.nav.reviews', href: 'reviews.html' } ] },
  { group: 'admin.nav.operations', items: [
    { id: 'staff', icon: 'users', key: 'admin.nav.staff', href: 'staff.html' },
    { id: 'tables', icon: 'qr', key: 'admin.nav.tables', href: 'tables.html' },
    { id: 'settings', icon: 'settings', key: 'admin.nav.settings', href: 'settings.html' } ] },
];
export const WAITER_NAV = [
  { group: null, items: [
    { id: 'dashboard', icon: 'table', key: 'waiter.nav.tables', href: 'dashboard.html' },
    { id: 'orders', icon: 'receipt', key: 'waiter.nav.orders', href: 'orders.html' },
    { id: 'parcels', icon: 'bag', key: 'waiter.nav.parcels', href: 'parcels.html' },
    { id: 'stats', icon: 'trending', key: 'waiter.nav.stats', href: 'stats.html' } ] },
];

/** Returns the signed-in user, or null (and redirects) if not authenticated. Page content goes in <main id="app" class="page">. */
export function mountPortal({ role, active, titleKey }) {
  const user = guard(role); if (!user) return null;
  const nav = role === 'admin' ? ADMIN_NAV : WAITER_NAV;
  document.body.classList.add('portal', `portal--${role}`);
  const app = $('#app') || $('main');
  const shell = el('div', { class: 'portal-shell' });
  const groups = nav.map((g) => `${g.group ? `<div class="sidebar__group" data-i18n="${g.group}"></div>` : ''}${g.items.map((i) => `<a class="sidebar__link ${i.id === active ? 'is-active' : ''}" href="${i.href}" ${i.id === active ? 'aria-current="page"' : ''}>${icon(i.icon)}<span data-i18n="${i.key}"></span><span class="count" data-count-for="${i.id}"></span></a>`).join('')}`).join('');
  const side = el('aside', { class: 'sidebar dark', id: 'sidebar', html: `
    <div class="sidebar__brand"><img src="${url('assets/logo/logo-mark-160.png')}" alt=""><b>Billy Belly<br>Chicken<small data-i18n="${role === 'admin' ? 'admin.portal' : 'waiter.portal'}"></small></b></div>
    <nav class="sidebar__nav" aria-label="Portal">${groups}</nav>
    <div class="sidebar__foot"><div class="user-chip"><img src="${imgSrc(user.photo)}" alt=""><div><b>${user.name}</b><small>${role === 'admin' ? 'Admin' : user.empId || 'Waiter'}</small></div></div>
      <span data-lang-mount></span>
      <a class="btn btn--ghost btn--sm btn--block" href="${url('index.html')}" target="_blank" rel="noopener">${icon('globe')}<span data-i18n="portal.viewSite"></span></a>
      <button class="btn btn--dark btn--sm btn--block" type="button" data-logout>${icon('logout')}<span data-i18n="portal.logout"></span></button></div>` });
  const back = el('div', { class: 'sidebar-backdrop' });
  const main = el('div', { class: 'portal-main' });
  const top = el('header', { class: 'topbar', html: `<button class="icon-btn menu-btn" type="button" aria-controls="sidebar" aria-expanded="false" data-i18n-aria="nav.menuToggle">${icon('menu')}</button><div class="topbar__title" data-i18n="${titleKey || ''}"></div><div class="topbar__spacer"></div><div data-topbar-slot class="cluster"></div>` });
  app.replaceWith(shell); main.append(top, app); shell.append(side, back, main);
  const set = (open) => { side.classList.toggle('is-open', open); back.classList.toggle('is-open', open); $('.menu-btn', top).setAttribute('aria-expanded', open); };
  $('.menu-btn', top).addEventListener('click', () => set(!side.classList.contains('is-open')));
  back.addEventListener('click', () => set(false)); $$('.sidebar__link', side).forEach((a) => a.addEventListener('click', () => set(false)));
  $('[data-logout]', side).addEventListener('click', () => logout(role));
  mountLangToggle($('[data-lang-mount]', side));
  const s = db.get('settings'); void s;
  hydrateIcons(); applyI18n(); initCommonUI(); onLangChange(() => applyI18n());
  document.body.classList.add('page-enter');
  return user;
}
/** Update the small count pill next to a sidebar link */
export function setNavCount(id, n) { const c = $(`[data-count-for="${id}"]`); if (c) { c.innerHTML = n ? `<span class="badge badge--red">${n}</span>` : ''; } }
export const topbarSlot = () => $('[data-topbar-slot]');
