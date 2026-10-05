import { init } from '../dataService.js';
import { initI18n, t, mountLangToggle } from '../i18n.js';
import { hydrateIcons } from '../icons.js';
import { $, param } from '../utils.js';
import { initCommonUI } from '../ui.js';
import * as auth from '../auth.js';

await init(); await initI18n(['admin-login']);
mountLangToggle($('[data-lang-mount]')); hydrateIcons(); initCommonUI();
if (auth.currentUser('admin')) location.replace('dashboard.html');
const form = $('#form'), err = $('#err'), pw = $('#p');
$('#eye').addEventListener('click', () => { pw.type = pw.type === 'password' ? 'text' : 'password'; });
form.addEventListener('submit', (e) => {
  e.preventDefault(); err.hidden = true;
  const u = $('#u').value.trim(), p = pw.value;
  const show = (k) => { err.textContent = t(k); err.hidden = false; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); };
  if (!u || !p) return show('admin-login.req');
  const r = auth.login('admin', u, p);
  if (!r.ok) return show(r.error === 'INACTIVE' ? 'admin-login.off' : 'admin-login.bad');
  const next = param('next');
  location.replace(next && /^[a-z]+\.html$/.test(next) ? next : 'dashboard.html');
});
