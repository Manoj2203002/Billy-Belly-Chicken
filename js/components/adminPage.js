/* adminPage.js - tiny boot helper shared by every admin page: data + i18n + guard + shell. */
import { init, db } from '../dataService.js';
import { initI18n } from '../i18n.js';
import { mountPortal } from '../portal.js';
import { hydrateIcons } from '../icons.js';
import { $, setCurrency } from '../utils.js';

/** bootAdmin('menu', run) -> runs run({ user, app, settings }) once signed in. Namespace file: data/i18n/pages/admin-<name>.* */
export async function bootAdmin(name, run) {
  await init(); await initI18n(['admin-common', `admin-${name}`]);
  const user = mountPortal({ role: 'admin', active: name, titleKey: `admin-${name}.title` });
  if (!user) return;
  const settings = db.get('settings'); setCurrency(settings.currency); hydrateIcons();
  await run({ user, app: $('.portal-main .page') || $('#app'), settings });
  hydrateIcons();
}
