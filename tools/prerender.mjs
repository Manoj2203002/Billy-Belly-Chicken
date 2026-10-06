/* prerender.mjs
   Bakes the shared page chrome (navbar, mobile menu, footer, floating buttons) into each public HTML file so the very first
   paint already shows the full site frame, instead of waiting for JavaScript to build it.
   At runtime js/layout.js removes these [data-pre] copies and builds the live, interactive versions in the same frame.

   Run AFTER `npm run bundle`:   npm run prerender
   Needs:  npm i -D playwright-core   and a Chromium (set CHROME_PATH if it is not found automatically).
   Safe to run again at any time: it replaces its own previous output (between the <!--pre:...--> markers). */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(new URL('..', import.meta.url).pathname);
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright-core')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright-core')); }
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find((p) => existsSync(p));

const PAGES = ['index', 'menu', 'gallery', 'about', 'parcel', 'order', 'review'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = join(root, p);
  if (!f.startsWith(root) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(0);
const port = srv.address().port;

const CONTENT_PAGES = new Set(['index', 'menu', 'gallery', 'about']);  // pages whose dynamic sections are baked in too
const SKIP_IDS = new Set(['open-badge']);                              // time-dependent: left to the script
const stripBlocks = (t) => t.replace(/<!--pre:([\w-]+)-->[\s\S]*?<!--\/pre:\1-->/g, '');
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
let done = 0;
for (const name of PAGES) {
  const file = join(root, `${name}.html`);
  let s = stripBlocks(readFileSync(file, 'utf8'));
  s = s.replace(/<div class="nav-ph"[\s\S]*?<\/div>\s*/, '');
  writeFileSync(file, s);                                              // the page is loaded WITHOUT any baked parts, so we capture the true script output
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/${name}.html?table=1`, { waitUntil: 'load' });
  await page.waitForSelector('header.nav', { timeout: 8000 });
  await page.waitForTimeout(900); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // which empty, id'd containers inside <main> does the script fill?
  const mainSrc = (s.match(/<main[\s\S]*?<\/main>/) || [''])[0];
  const emptyIds = CONTENT_PAGES.has(name) ? [...mainSrc.matchAll(/<(\w+)[^>]*?\sid="([\w-]+)"[^>]*>\s*<\/\1>/g)].map((m) => m[2]).filter((id) => !SKIP_IDS.has(id)) : [];
  const hiddenIds = CONTENT_PAGES.has(name) ? [...mainSrc.matchAll(/<\w+[^>]*?\sid="([\w-]+)"[^>]*?\shidden[\s>=][^>]*>/g)].map((m) => m[1]) : [];
  const parts = await page.evaluate(({ emptyIds, hiddenIds }) => {
    const clean = (n) => { const c = n.cloneNode(true); c.setAttribute('data-pre', ''); c.querySelectorAll('.is-scrolled,.is-open').forEach((x) => x.classList.remove('is-scrolled', 'is-open')); c.classList.remove('is-scrolled', 'is-open'); return c.outerHTML; };
    const frag = (id) => {
      const n = document.getElementById(id); if (!n || !n.innerHTML.trim()) return null;
      const c = n.cloneNode(true);
      c.querySelectorAll('.rv,.is-in,.split-in,[data-split-done],[data-i18n],[data-i18n-placeholder],[data-i18n-aria],[data-i18n-title]').forEach((x) => { x.classList.remove('rv', 'is-in', 'split-in'); x.removeAttribute('data-split-done'); ['data-i18n', 'data-i18n-placeholder', 'data-i18n-aria', 'data-i18n-title'].forEach((a) => x.removeAttribute(a)); if (!x.getAttribute('class')) x.removeAttribute('class'); });
      return c.innerHTML;
    };
    return {
      top: [document.querySelector('header.nav'), document.querySelector('.nav-sheet')].filter(Boolean).map(clean).join(''),
      bottom: [document.querySelector('footer.footer'), document.querySelector('.float-actions')].filter(Boolean).map(clean).join(''),
      fills: emptyIds.map((id) => [id, frag(id)]).filter((x) => x[1]),
      unhide: hiddenIds.filter((id) => { const n = document.getElementById(id); return n && !n.hidden; }),
    };
  }, { emptyIds, hiddenIds });
  await page.close();
  for (const [id, html] of parts.fills) s = s.replace(new RegExp(`(<(\\w+)[^>]*?\\sid="${id}"[^>]*>)\\s*(</\\2>)`), (m, open, tag, close) => `${open}<!--pre:fill-${id}-->${html}<!--/pre:fill-${id}-->${close}`);
  for (const id of parts.unhide) s = s.replace(new RegExp(`(<\\w+[^>]*?\\sid="${id}"[^>]*?)\\shidden(?=[\\s>=])(="[^"]*")?`), '$1');
  s = s.replace(/(<body[^>]*>)/, `$1<!--pre:top-->${parts.top}<!--/pre:top-->`);
  s = s.replace(/(\s*<script>window\.addEventListener\("error")/, `<!--pre:bottom-->${parts.bottom}<!--/pre:bottom-->$1`);
  writeFileSync(file, s); done++;
  console.log('prerendered', name, `(chrome ${parts.top.length + parts.bottom.length}b, ${parts.fills.length} sections, ${parts.unhide.length} unhidden)`);
}
await browser.close(); srv.close();
console.log('done', done, 'pages');
