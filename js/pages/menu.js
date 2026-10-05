import { init, db } from '../dataService.js';
import { initI18n, tr, onLangChange } from '../i18n.js';
import { mountPublicLayout } from '../layout.js';
import { hydrateIcons } from '../icons.js';
import { createMenuBrowser } from '../components/menuBrowser.js';

await init();
await initI18n(['menu']);
mountPublicLayout({ active: 'menu' });
hydrateIcons();

createMenuBrowser({ container: document.getElementById('menu-root'), mode: 'browse' });

