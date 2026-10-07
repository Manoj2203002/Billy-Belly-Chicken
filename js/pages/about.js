import { init, db } from '../dataService.js';
import { initI18n, tr, onLangChange } from '../i18n.js';
import { mountPublicLayout } from '../layout.js';
import { hydrateIcons, icon } from '../icons.js';
import { $, esc, pad } from '../utils.js';

await init();
await initI18n(['about']);
mountPublicLayout({ active: 'about' });
const r = db.get('restaurant');
const ini = (s) => esc(String(s).trim().charAt(0).toUpperCase());
const KITCHEN = 5;                                   // first 5 roles in the profile are kitchen roles, the rest work the floor and counter
function render() {
  $('#ab-about').textContent = tr(r.about); $('#ab-tag').textContent = tr(r.tagline);
  $('#ab-mission').textContent = tr(r.mission); $('#ab-vision').textContent = tr(r.vision);
  $('#ab-motto').innerHTML = tr(r.missionMotto).split('•').map((w) => w.trim()).filter(Boolean).map((w) => `<li>${esc(w)}</li>`).join('');
  const hrs = tr(r.hours);
  $('#ab-stats').innerHTML = [
    [hrs.split(',')[0].replace(/:00/g, '').replace(/\s*[–-]\s*/, ' – '), tr({ en: 'Open every day', ta: 'தினமும் திறந்திருக்கும்' }), 'clock'],
    [r.cuisines.length, tr({ en: 'Cuisine categories', ta: 'உணவு வகைகள்' }), 'utensils'],
    [r.team.length, tr({ en: 'Team roles', ta: 'குழு பொறுப்புகள்' }), 'users'],
    [r.standards.length, tr({ en: 'Hygiene and service standards', ta: 'தரநிலைகள்' }), 'shield'],
  ].map(([n, l, ic]) => `<li><i>${icon(ic)}</i><b>${esc(n)}</b><span>${esc(l)}</span></li>`).join('');
  $('#ab-values').innerHTML = (r.values || []).map((v, i) => `<article class="ab-v"><span class="ab-v__n" aria-hidden="true">${pad(i + 1)}</span><span class="ab-v__ico">${icon(v.icon || 'star')}</span><h3>${esc(tr(v.title))}</h3>${v.desc ? `<p>${esc(tr(v.desc))}</p>` : ''}</article>`).join('');
  $('#ab-cuisines').innerHTML = r.cuisines.map((c, i) => `<li><span>${pad(i + 1)}</span>${esc(tr(c))}</li>`).join('');
  $('#ab-standards').innerHTML = r.standards.map((s) => `<li>${esc(tr(s))}</li>`).join('');
  const grp = (title, arr) => `<div class="ab-team__grp"><h3>${title}</h3><ul>${arr.map((x) => { const n = tr(x); return `<li><i aria-hidden="true">${ini(n)}</i>${esc(n)}</li>`; }).join('')}</ul></div>`;
  $('#ab-team').innerHTML = grp(tr({ en: 'Kitchen', ta: 'சமையலறை' }), r.team.slice(0, KITCHEN)) + grp(tr({ en: 'Service and counter', ta: 'சேவை & கவுண்டர்' }), r.team.slice(KITCHEN));
  $('#ab-address').textContent = tr(r.address); $('#ab-hours').textContent = hrs;
  const tel = 'tel:+91' + String(r.phone).replace(/\D/g, '');
  $('#ab-phone').textContent = r.phone; $('#ab-phone').href = tel; $('#ab-call').href = tel;
  $('#ab-email').textContent = r.email; $('#ab-email').href = 'mailto:' + r.email;
  $('#ab-insta').textContent = '@' + r.instagram; $('#ab-insta').href = r.instagramUrl; $('#ab-map').href = r.mapUrl;
}
render(); hydrateIcons(); onLangChange(() => { render(); hydrateIcons(); });
