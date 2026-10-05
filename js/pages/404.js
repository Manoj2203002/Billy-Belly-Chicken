import { init } from '/js/dataService.js';
import { initI18n, mountLangToggle, applyI18n } from '/js/i18n.js';
import { hydrateIcons } from '/js/icons.js';
import { initCommonUI } from '/js/ui.js';

await init();
await initI18n();
const tgl = document.createElement('div'); tgl.style.cssText = 'position:fixed;top:16px;right:16px;z-index:5'; document.body.append(tgl); mountLangToggle(tgl);
hydrateIcons(); applyI18n(); initCommonUI();
