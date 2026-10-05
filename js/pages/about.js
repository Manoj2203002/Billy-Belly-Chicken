import { init, db } from '../dataService.js';
import { initI18n, tr, onLangChange, applyI18n } from '../i18n.js';
import { mountPublicLayout } from '../layout.js';
import { hydrateIcons } from '../icons.js';
import { $, esc } from '../utils.js';
import { initReveal } from '../ui.js';

await init();
await initI18n(['about']);
mountPublicLayout({ active: 'about' });
const r = db.get('restaurant') || {};
function render() {
  $('#ab-about').textContent = tr(r.about); $('#ab-motto').textContent = tr(r.missionMotto); $('#ab-mission').textContent = tr(r.mission); $('#ab-vision').textContent = tr(r.vision);
  $('#ab-cuisines').innerHTML = (r.cuisines || []).map((c) => `<li>${esc(tr(c))}</li>`).join('');
  $('#ab-standards').innerHTML = (r.standards || []).map((s) => `<li>${esc(tr(s))}</li>`).join('');
  $('#ab-team').innerHTML = (r.team || []).map((s) => `<li>${esc(tr(s))}</li>`).join('');
  $('#ab-address').textContent = tr(r.address); $('#ab-hours').textContent = tr(r.hours);
  initReveal();
}
render(); hydrateIcons(); onLangChange(render);
