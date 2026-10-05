/* ==========================================================================
   layout.js - builds the public-site chrome (preloader, navbar, mobile sheet,
   footer, floating actions) so every customer page shares one source.
   Usage in a page module:  await mountPublicLayout({ active: 'menu' })
   ========================================================================== */
import { db } from './dataService.js';
import { url, session, store, $, $$, el, throttleRaf } from './utils.js';
import { icon, hydrateIcons } from './icons.js';
import { mountLangToggle, applyI18n, onLangChange, tr, t } from './i18n.js';
import { initCommonUI, initScrollProgress, pageReady } from './ui.js';

const NAV = [
  { id: 'home', key: 'nav.home', href: 'index.html' },
  { id: 'menu', key: 'nav.menu', href: 'menu.html' },
  { id: 'offers', key: 'nav.offers', href: 'index.html#offers' },
  { id: 'gallery', key: 'nav.gallery', href: 'gallery.html' },
  { id: 'about', key: 'nav.about', href: 'about.html' },
  { id: 'contact', key: 'nav.contact', href: 'index.html#contact' },
];

let pre = null;
if (!session.get('bbc:preloaded') && !store.get('bbc:preloaded')) {
  session.set('bbc:preloaded', 1); store.set('bbc:preloaded', 1);
  pre = el('div', { class: 'preloader dark', 'aria-hidden': 'true', html: `<img class="preloader__logo" src="${url('assets/logo/logo.png')}" alt=""><div class="preloader__bar"></div>` });
  document.body.prepend(pre);
}

export function mountPublicLayout({ active = '', preloader = true, nav = true, footer = true, floating = true } = {}) {
  const r = db.get('restaurant') || {};
  const phoneDigits = String(r.phone || '').replace(/\D/g, '');
  const root = document.body;
  root.classList.add('public');

  // skip link + scroll progress
  root.prepend(el('a', { class: 'skip-link', href: '#main', 'data-i18n': 'common.skip' }, 'Skip to content'));
  initScrollProgress();

  if (pre) {
    const hide = () => { pre.classList.add('is-done'); document.documentElement.classList.add('is-loaded'); setTimeout(() => pre.remove(), 1200); };
    if (preloader) setTimeout(hide, 200); else hide();
  } else {
    document.documentElement.classList.add('is-loaded');
  }

  if (nav) {
    const links = NAV.map((n, i) => `<a class="nav__link ${n.id === active ? 'is-active' : ''}" href="${url(n.href)}" data-i18n="${n.key}"></a>`).join('');
    const sheetLinks = NAV.map((n, i) => `<a class="sheet-link ${n.id === active ? 'is-active' : ''}" style="--i:${i}" href="${url(n.href)}"><span data-i18n="${n.key}"></span></a>`).join('');
    const header = el('header', { class: 'nav dark', html: `
      <div class="nav__inner">
        <a class="nav__brand" href="${url('index.html')}" aria-label="Billy Belly Chicken">
          <img src="${url('assets/logo/logo-mark-160.png')}" alt="" width="60" height="50"><span>Billy Belly<em>Chicken</em></span>
        </a>
        <nav class="nav__links" aria-label="Primary">${links}</nav>
        <div class="nav__actions">
          <span data-lang-mount></span>
          <a class="btn btn--primary btn--sm nav__cta" href="${url('parcel.html')}" data-magnetic>${icon('bag')}<span data-i18n="nav.parcel"></span></a>
          <button class="nav__burger" type="button" aria-expanded="false" aria-controls="nav-sheet" data-i18n-aria="nav.menuToggle"><i></i><i></i><i></i></button>
        </div>
      </div>` });
    const sheet = el('div', { class: 'nav-sheet dark', id: 'nav-sheet', html: `<nav aria-label="Mobile">${sheetLinks}</nav>
      <div class="stack" style="--stack:1rem"><a class="btn btn--primary btn--block btn--lg" href="${url('parcel.html')}">${icon('bag')}<span data-i18n="nav.parcel"></span></a>
      <a class="btn btn--ghost btn--block" href="tel:+91${phoneDigits}">${icon('phone')}<span>${r.phone || ''}</span></a></div>` });
    root.prepend(sheet); root.prepend(header);
    mountLangToggle($('[data-lang-mount]', header));
    const burger = $('.nav__burger', header);
    const toggle = (open) => { burger.setAttribute('aria-expanded', open); sheet.classList.toggle('is-open', open); root.style.overflow = open ? 'hidden' : ''; };
    burger.addEventListener('click', () => toggle(burger.getAttribute('aria-expanded') !== 'true'));
    $$('a', sheet).forEach((a) => a.addEventListener('click', () => toggle(false)));
    const sc = throttleRaf(() => header.classList.toggle('is-scrolled', scrollY > 24)); addEventListener('scroll', sc, { passive: true }); sc();
  }

  if (footer) {
    const f = el('footer', { class: 'footer dark', html: `
      <div class="footer__flame divider-flame divider-flame--flip" aria-hidden="true"></div>
      <div class="container">
        <div class="footer__big" aria-hidden="true">Billy Belly Chicken</div>
        <div class="footer__grid">
          <div class="footer__brand"><img src="${url('assets/logo/logo-420.png')}" alt="Billy Belly Chicken logo" loading="lazy">
            <p class="text-muted" data-js="tagline"></p>
            <div class="footer__social">
              <a href="${r.instagramUrl || '#'}" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram')}</a>
              <a href="https://wa.me/91${phoneDigits}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('whatsapp')}</a>
              <a href="mailto:${r.email || ''}" aria-label="Email">${icon('mail')}</a>
            </div></div>
          <div><h4 data-i18n="footer.explore"></h4><ul>
            <li><a href="${url('menu.html')}" data-i18n="nav.menu"></a></li><li><a href="${url('index.html#offers')}" data-i18n="nav.offers"></a></li>
            <li><a href="${url('gallery.html')}" data-i18n="nav.gallery"></a></li><li><a href="${url('about.html')}" data-i18n="nav.about"></a></li>
            <li><a href="${url('review.html')}" data-i18n="nav.review"></a></li></ul></div>
          <div><h4 data-i18n="footer.visit"></h4><ul class="text-muted">
            <li data-js="address"></li><li><span data-i18n="footer.hours"></span>: <span data-js="hours"></span></li>
            <li><a href="${r.mapUrl || '#'}" target="_blank" rel="noopener" class="link" data-i18n="footer.directions"></a></li></ul></div>
          <div><h4 data-i18n="footer.talk"></h4><ul>
            <li><a href="tel:+91${phoneDigits}">${r.phone || ''}</a></li><li><a href="mailto:${r.email || ''}">${r.email || ''}</a></li>
            <li><a href="https://wa.me/91${phoneDigits}" target="_blank" rel="noopener">WhatsApp</a></li>
            <li class="footer-staff"><a href="${url('waiter/login.html')}" data-i18n="footer.staff"></a> · <a href="${url('admin/login.html')}" data-i18n="footer.admin"></a></li></ul></div>
        </div>
        <div class="footer__bar"><span>© <span data-js="year"></span> Billy Belly Chicken. <span data-i18n="footer.rights"></span></span><span data-i18n="footer.payNote"></span></div>
      </div>` });
    root.append(f);
    const fill = () => {
      $('[data-js="tagline"]', f).textContent = tr(r.tagline); $('[data-js="address"]', f).textContent = tr(r.address);
      $('[data-js="hours"]', f).textContent = tr(r.hours); $('[data-js="year"]', f).textContent = new Date().getFullYear();
    };
    fill(); onLangChange(fill);
  }

  if (floating) {
    root.append(el('div', { class: 'float-actions no-print', html: `<a href="https://wa.me/91${phoneDigits}" target="_blank" rel="noopener" data-i18n-aria="footer.whatsapp">${icon('whatsapp')}</a><a href="tel:+91${phoneDigits}" data-i18n-aria="footer.call">${icon('phone')}</a>` }));
  }
  if (!$('main#main')) { const m = $('main'); if (m) m.id = 'main'; }
  hydrateIcons(); applyI18n(); initCommonUI(); pageReady();
  onLangChange(() => applyI18n());
}
