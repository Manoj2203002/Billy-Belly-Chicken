import { init, db } from '../dataService.js';
import { initI18n, t, tr, getLang, onLangChange, applyI18n } from '../i18n.js';
import { mountPublicLayout } from '../layout.js';
import { hydrateIcons, icon, starsHTML } from '../icons.js';
import { $, el, esc, money, imgSrc, session, store, todayStr, fmtDate, setCurrency } from '../utils.js';
import { initReveal, initCounters, initParallax, openModal } from '../ui.js';
import { activeOffers, isOpenNow, avgRating } from '../orderService.js';

await init();
await initI18n(['home']);
mountPublicLayout({ active: 'home' });

const r = db.get('restaurant'); const settings = db.get('settings'); setCurrency(settings.currency);

const todaysSpecial = () => { const list = db.list('specials', (s) => s.active !== false); return list.find((s) => s.date === todayStr()) || list.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null; };

function render() {
  /* hero + status */
  $('#hero-tagline').textContent = tr(r.tagline);
  const open = isOpenNow(settings); const b = $('#open-badge'); b.textContent = open ? t('home.open.yes') : t('home.open.no', { t: settings.timings.open }); b.classList.toggle('badge--red', open); b.classList.toggle('badge--live', open);
  /* special */
  const sp = todaysSpecial();
  $('#special').hidden = !sp;
  if (sp) {
    const items = (sp.itemIds || []).map((id) => db.get('menu', id)).filter(Boolean);
    $('#special-media').innerHTML = `<img src="${imgSrc(sp.image)}" alt="${esc(tr(sp.title))}" loading="lazy" width="800" height="600"><div class="special__stamp" aria-hidden="true"><span>${t('home.special.eyebrow')}</span></div>`;
    $('#special-copy').innerHTML = `<span class="eyebrow">${t('home.special.eyebrow')}</span><h2 class="display display--xl" id="special-h">${esc(tr(sp.title))}</h2><p class="lead">${esc(tr(sp.description))}</p>
      ${items.length ? `<div><small class="text-faint">${t('home.special.includes')}</small><div class="special__items">${items.map((i) => `<span class="badge badge--outline">${esc(tr(i.name))}</span>`).join('')}</div></div>` : ''}
      <div class="special__price"><span class="price" data-cur="₹">${sp.price}</span>${sp.originalPrice ? `<s>${money(sp.originalPrice)}</s><span class="badge badge--red">${t('home.special.save', { n: money(sp.originalPrice - sp.price) })}</span>` : ''}</div>
      <div class="cluster"><a class="btn btn--primary btn--lg" href="parcel.html" data-magnetic>${icon('bag')}<span>${t('home.special.parcel')}</span></a><span class="text-muted">${icon('qr')} ${t('home.special.order')}</span></div>`;
  }
  /* offers */
  $('#offers-strip').innerHTML = activeOffers().map((o) => `<article class="offer dark" data-reveal="up"><img src="${imgSrc(o.image)}" alt="" loading="lazy" width="800" height="600"><div class="offer__big">${o.discountType === 'percent' ? `${o.value}%` : `₹${o.value}`}<small>${o.discountType === 'percent' ? t('home.offers.off') : t('home.offers.flat')}</small></div><h3>${esc(tr(o.title))}</h3><p class="text-muted">${esc(tr(o.description))}</p><span class="offer__until">${t('home.offers.until', { d: fmtDate(o.validTo, getLang()) })}</span></article>`).join('');
  /* featured bento */
  const feat = db.list('menu', (m) => m.featured && m.available !== false).sort((a, c) => a.order - c.order).slice(0, 8);
  $('#bento').innerHTML = feat.map((m) => `<a class="bento__item dark" href="menu.html" data-reveal="scale"><img src="${imgSrc(m.image)}" alt="${esc(tr(m.name))}" loading="lazy" width="800" height="600">${(m.tags || []).includes('bestseller') ? `<span class="badge badge--red bento__tag">${t('tag.bestseller')}</span>` : ''}<div class="bento__cap"><b>${esc(tr(m.name))}</b><span class="price" data-cur="₹">${m.price}</span></div></a>`).join('');
  /* about */
  $('#about-text').textContent = tr(r.about); $('#about-mission').textContent = tr(r.vision);
  $('#stats').innerHTML = (r.stats || []).map((s) => `<div class="stat-c"><b data-count="${s.value}" data-suffix="${s.suffix || ''}">0</b><span>${esc(tr(s.label))}</span></div>`).join('');
  /* values */
  $('#values-list').innerHTML = (r.values || []).map((v, i) => `<article class="vcard"><span class="vcard__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="vcard__ico">${icon(v.icon || 'star')}</span><h3>${esc(tr(v.title))}</h3>${v.desc ? `<p>${esc(tr(v.desc))}</p>` : ''}</article>`).join('');
  /* gallery teaser */
  $('#gal-grid').innerHTML = db.list('gallery').sort((a, c) => a.order - c.order).filter((g) => g.category === 'food' || g.category === 'ambience').slice(0, 4).map((g) => `<a href="gallery.html" data-reveal="up"><img src="${imgSrc(g.image)}" alt="${esc(tr(g.caption))}" loading="lazy" width="800" height="600"><span>${esc(tr(g.caption))}</span></a>`).join('');
  /* reviews: approved only */
  const rv = db.list('reviews', (x) => x.status === 'approved').sort((a, c) => c.rating - a.rating || c.createdAt.localeCompare(a.createdAt));
  $('#rev-avg').innerHTML = rv.length ? `<b>${avgRating()}</b><div>${starsHTML(avgRating())}<div class="text-muted">${t('home.reviews.avg', { c: rv.length })}</div></div>` : '';
  $('#rev-list').innerHTML = rv.length ? rv.slice(0, 6).map((x) => `<article class="rev" data-reveal="up"><header><span class="rev__av" aria-hidden="true">${esc((x.name || 'G').trim().charAt(0).toUpperCase())}</span><div><b>${esc(x.name)}</b><small>${t('home.reviews.verified')}</small></div>${starsHTML(x.rating)}</header><q>${esc(x.comment)}</q>${x.reply ? `<div class="rev__reply"><b>${t('home.reviews.reply')}:</b> ${esc(x.reply)}</div>` : ''}</article>`).join('') : `<p class="text-muted">${t('home.reviews.empty')}</p>`;
  /* contact */
  const tel = String(r.phone).replace(/\D/g, '');
  $('#contact-list').innerHTML = `<li>${icon('pin')}<div><small>${t('home.contact.address')}</small>${esc(tr(r.address))}</div></li><li>${icon('clock')}<div><small>${t('home.contact.hours')}</small>${esc(tr(r.hours))}</div></li><li>${icon('phone')}<div><small>${t('home.contact.phone')}</small><a class="link" href="tel:+91${tel}">${esc(r.phone)}</a></div></li><li>${icon('mail')}<div><small>${t('home.contact.email')}</small><a class="link" href="mailto:${esc(r.email)}">${esc(r.email)}</a></div></li>`;
  $('#c-call').href = `tel:+91${tel}`; $('#c-wa').href = `https://wa.me/91${tel}`; $('#c-ig').href = r.instagramUrl;
  $('#map').innerHTML = r.mapEmbed ? `<iframe src="${esc(r.mapEmbed)}" title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : `<div class="map-ph">${icon('pin')}<p class="text-muted">${t('home.contact.mapNote')}</p><a class="btn btn--primary" href="${esc(r.mapUrl)}" target="_blank" rel="noopener">${icon('arrowright')}<span>${t('home.contact.maps')}</span></a></div>`;
  hydrateIcons(); applyI18n(); initReveal(); initCounters();
}
render(); initParallax();
onLangChange(render);
db.onChange((c) => { if (['specials', 'offers', 'menu', 'reviews', 'gallery', 'settings', 'restaurant'].includes(c)) render(); });

/* ---------- Welcome popup: today's special + offers as swipeable slides ---------- */
function popup() {
  if (settings.popupEnabled === false) return;
  if (session.get('bbc:popupShown') || store.get('bbc:popupHide') === todayStr()) return;
  const sp = todaysSpecial(); const offers = activeOffers();
  const slides = [];
  if (sp) slides.push({ tag: t('home.special.eyebrow'), img: sp.image, title: tr(sp.title), text: tr(sp.description), big: `<span class="price" data-cur="₹">${sp.price}</span>${sp.originalPrice ? `<s class="text-faint">${money(sp.originalPrice)}</s>` : ''}` });
  offers.slice(0, 5).forEach((o) => slides.push({ tag: t('home.offers.eyebrow'), img: o.image, title: tr(o.title), text: tr(o.description), big: `<span class="pop__off">${o.discountType === 'percent' ? o.value + '%' : '₹' + o.value} ${o.discountType === 'percent' ? t('home.offers.off') : t('home.offers.flat')}</span>` }));
  if (!slides.length) return;
  session.set('bbc:popupShown', 1);
  const many = slides.length > 1;
  const body = el('div', { class: 'pop', html: `
    <div class="pop__track" id="pop-track">${slides.map((x) => `<article class="pop__slide">
      <img class="pop__img" src="${imgSrc(x.img)}" alt="" loading="eager">
      <div class="pop__txt"><span class="badge badge--red">${esc(x.tag)}</span><h2 class="pop__title">${esc(x.title)}</h2><p class="text-muted">${esc(x.text)}</p><div class="pop__price">${x.big}</div></div></article>`).join('')}</div>
    ${many ? `<div class="pop__nav"><button type="button" class="icon-btn" id="pop-prev" aria-label="Previous">${icon('chevleft')}</button><div class="pop__dots" id="pop-dots">${slides.map((_, i) => `<i class="${i ? '' : 'is-on'}"></i>`).join('')}</div><button type="button" class="icon-btn" id="pop-next" aria-label="Next">${icon('chevright')}</button></div>` : ''}
    <div class="pop__foot"><a class="btn btn--primary" href="menu.html">${icon('utensils')}<span>${t('home.hero.cta1')}</span></a><label class="check"><input type="checkbox" id="pop-hide"><span>${t('home.popup.dont')}</span></label></div>` });
  const m = openModal({ body, cls: 'pop-modal', title: '', dismissible: true, onClose: () => { if ($('#pop-hide', body)?.checked) store.set('bbc:popupHide', todayStr()); } });
  const track = $('#pop-track', body);
  if (many) {
    const dots = [...body.querySelectorAll('#pop-dots i')]; const w = () => track.clientWidth;
    const idx = () => Math.round(track.scrollLeft / w());
    const go = (i) => track.scrollTo({ left: Math.max(0, Math.min(slides.length - 1, i)) * w(), behavior: 'smooth' });
    track.addEventListener('scroll', () => { const i = idx(); dots.forEach((d, k) => d.classList.toggle('is-on', k === i)); }, { passive: true });
    $('#pop-prev', body).addEventListener('click', () => go(idx() - 1));
    $('#pop-next', body).addEventListener('click', () => go(idx() + 1));
  }
  hydrateIcons(body);
}
setTimeout(popup, session.get('bbc:preloaded') && performance.now() < 3000 ? 2400 : 900);
