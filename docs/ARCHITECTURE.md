# Billy Belly Chicken: architecture & page contract

Static site (HTML + CSS + vanilla JS ES modules). No build step. Serve the folder root with any static server
(`npx serve .`, `python3 -m http.server 3000`, Netlify, Vercel, GitHub Pages, Firebase Hosting, S3).

## The rule: every page = its own HTML + its own CSS + its own JS

| Area | HTML | CSS | JS |
|---|---|---|---|
| Public | `/<name>.html` | `/css/pages/<name>.css` | `/js/pages/<name>.js` |
| Admin | `/admin/<name>.html` | `/css/pages/admin-<name>.css` | `/js/pages/admin-<name>.js` |
| Waiter | `/waiter/<name>.html` | `/css/pages/waiter-<name>.css` | `/js/pages/waiter-<name>.js` |
| Page strings (EN/TA) | | | `/data/i18n/pages/<ns>.en.json` + `<ns>.ta.json` (ns = `home`, `admin-menu`, `waiter-dashboard`...) |

Shared foundation (DO NOT duplicate; import/link it): `css/{fonts,variables,base,components,layout,portal}.css`,
`js/{utils,icons,ui,i18n,dataService,orderService,orderSync,cart,auth,qr,layout,portal}.js`,
`js/components/{crud,charts}.js`.

## HTML skeleton (public page at root; for /admin and /waiter prefix every path with `../` and set `data-root="../"`)

```html
<!doctype html>
<html lang="en" data-title-key="home.meta.title">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Billy Belly Chicken | Home</title>
  <meta name="description" content="...">
  <meta name="theme-color" content="#0a0909">
  <link rel="icon" href="assets/logo/favicon.ico"><link rel="apple-touch-icon" href="assets/logo/icon-192.png">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="preload" href="assets/fonts/big-shoulders-display-latin-900-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="css/fonts.css"><link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/base.css"><link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/layout.css">            <!-- public pages. Portals use ../css/portal.css instead -->
  <link rel="stylesheet" href="css/pages/home.css">         <!-- this page's own CSS -->
</head>
<body data-root="" data-page="home">
  <main id="main"> ... semantic sections, data-i18n attributes, data-reveal ... </main>
  <script type="module" src="js/pages/home.js"></script>
</body>
</html>
```
`data-root` MUST be on `<body>` ("" for root pages, "../" for admin/waiter). `utils.ROOT`/`url()` use it.
Navbar, footer, preloader, floating buttons are injected by `mountPublicLayout()`; do not hand-write them.
Portals: `<main id="app" class="page">...</main>` and `mountPortal()` wraps it with sidebar + topbar.

## Page JS skeleton
```js
import { init, db } from '../dataService.js';
import { initI18n, t, tr, onLangChange, applyI18n } from '../i18n.js';
import { mountPublicLayout } from '../layout.js';
import { hydrateIcons, icon } from '../icons.js';
await init();                    // seeds localStorage from /data/*.json on first run
await initI18n(['home']);        // loads data/i18n/{en,ta}.json + data/i18n/pages/home.{en,ta}.json
mountPublicLayout({ active: 'home' });     // active in: home | menu | offers | gallery | about | contact | ''
// ... render with db.list('menu') ... re-render inside onLangChange(() => render())
```
Portal pages: `import { mountPortal, setNavCount } from '../portal.js'; const user = mountPortal({ role:'admin', active:'menu', titleKey:'admin.nav.menu' }); if (!user) throw 0;` then `await init()` happens BEFORE mountPortal because guard() reads staff from the db.
Order of calls in portal pages: `await init(); await initI18n([ns]); const user = mountPortal(...); if(!user) return;`

## Core API cheat-sheet
- `dataService.db`: `list(col, pred?)`, `get(col,id)` (singletons: `get('settings')`, `get('restaurant')`), `find(col,pred)`, `create(col,item)`, `update(col,id,patch)` (singletons: `update('settings', patch)`), `remove(col,id)`, `save(col,data)`, `onChange(cb(col, fromOtherTab))`, `reset()`, `audit(action,detail)`, `nextParcelToken()`.
  Collections: restaurant*, settings*, categories, menu, specials, offers, gallery, tables, staff, orders, reviews, tableSessions, alerts, audit (*=singleton object).
  All text fields that are shown to customers are `{en, ta}`: render with `tr(field)`.
- `i18n`: `t(key, vars)`, `tr({en,ta})`, `getLang()`, `setLang()`, `onLangChange(cb)`, `applyI18n(root)`, `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria`, `data-i18n-title`, `data-i18n-html`. Common keys live in `data/i18n/en.json` (see it: `common.*`, `status.*`, `food.*`, `tag.*`, `nav.*`, `footer.*`). Put everything page-specific in your own `data/i18n/pages/<ns>.en.json` (nested JSON is flattened to dotted keys).
- `orderService` (ALL business rules live here, never write orders by hand): `priceLines(lines)`, `placeDineIn`, `placeParcel`, `setStatus`, `cancelByCustomer`, `updateOrderItems`, `tabForTable`, `sessionOrders`, `callWaiter`, `requestBill`, `clearCall`, `closeTable`, `tableState`, `claimSession`, `tokenValid`, `getSession`, `ensureSession`, `getTableByNumber`, `acceptingStatus`, `cooldownLeft`, `isDuplicate`, `activeOffers`, `resolveItem`, `nextStatus`, `flowFor`, `DINE_FLOW`, `PARCEL_FLOW`, `ordersToday`, `topItems`, `avgRating`. Errors are thrown as `Error` with `.code` (`SWITCH_OFF OUTSIDE_HOURS BAD_TABLE BAD_TOKEN COOLDOWN(.seconds) DUPLICATE EMPTY SOLD_OUT NOT_CANCELLABLE`).
- `orderSync`: `subscribe('order:new'|'order:status'|'alert:call'|'alert:bill'|'table:closed', cb)`, `publish`, `beep()`. Also `db.onChange` fires in every tab when any collection changes: that is the primary live-update mechanism.
- `cart.createCart('table-5' | 'parcel')` -> `add/setQty/setNote/remove/clear/lines/count/pricing/onChange/prune`.
- `auth`: `login(role,u,p)`, `guard(role)`, `logout(role)`, `currentUser(role)`.
- `ui`: `toast(msg,{type:'ok|error|warn|alert|info',title})`, `openModal({title,body,footer,size})`, `confirmDialog`, `promptDialog`, `createDrawer`, `initTabs(container,{onChange})`, `flip(container, mutate)` (children need `data-key`), `flyToCart(fromEl,toEl)`, `confetti()`, `checkDrawSVG()`, `countTo(node,n)`, `emptyState()`, `skeletonHTML()`, `splitWords/initReveal/initCounters/initParallax/initMagnetic/initTilt` (already run by `initCommonUI` inside mountPublicLayout/mountPortal; call `initReveal(container)` again after injecting new `[data-reveal]` markup).
- `icons`: `icon(name,{size,cls})`, `hydrateIcons(root)` for `<i data-icon="cart">`, `spiceHTML`, `starsHTML`, `vegMark`. Icon names: see `js/icons.js`. NEVER use emoji as icons. Need a new icon? Add to the `P` map in icons.js (surgical edit, same style).
- `crud.js`: `buildForm({fields,values})`, `createCrud({...})` (read the doc comment at the top of each function), `imgCell`, `boolBadge`. `charts.js`: `barChart`, `lineChart`, `donutChart`.
- `qr.js`: `urls.table(n) / urls.parcel() / urls.review()`, `qrSVG(text,{size})`, `qrPNG(text)`.
- `utils`: `$ $$ el esc money num todayStr fmtTime fmtDate fmtDateTime timeAgo minutesSince download toCSV isPhone cleanPhone readFileAsDataURL imgSrc url ROOT param store session debounce`.
  Always render image paths from data with `imgSrc(path)` so they work from /admin and /waiter and accept data: URLs.

## Design rules (the owner's brief)
- Black background, red = brand + primary action, white = text. Only the CSS variables from `variables.css`. No new brand colours.
- Not template-looking: oversized display type (`.display`, Big Shoulders Display), serif italic accents (`.serif`), asymmetric/editorial layouts, overlapping elements, marquee bands, bento grids, sticky side titles, horizontal scroll strips, flame divider (`.divider-flame`). Consecutive sections must look different. Specific, characterful copy in the restaurant's voice using the About text from `restaurant.json` (no lorem ipsum, no "Welcome to our restaurant").
- Mobile-first (320px up to 2560px), no horizontal scroll, 44px tap targets, `dvh`, safe-area insets, `clamp()`, `auto-fit/minmax`, container queries where useful. Admin tables use `table table--cards` + `data-label` on `<td>`.
- Motion (tasteful, fast, transform/opacity only, respects `prefers-reduced-motion`): `data-reveal` + `data-stagger`, `data-split` headlines, `data-parallax`, `data-count`, `data-tilt`, `data-magnetic`, FLIP on filters, add-to-cart fly animation, etc. as relevant to your pages.
- No inline `style="..."` attributes in HTML files. Put styling in the page CSS file; for dynamic values set CSS custom properties from JS (`node.style.setProperty('--x', v)`).
- Accessible: semantic landmarks, one `<h1>` per page, labels on inputs, `aria-live` for live status, visible focus (already global), alt text on images, AA contrast.
- Both languages everywhere. Every visible string via `data-i18n`/`t()`; data fields via `tr()`. Re-render dynamic parts on `onLangChange`.
- Customer-facing images are SVG placeholders in `assets/images/**` (real photos replace them later; keep the same file names or update the JSON).
- Business rules: no payment gateway (pay at counter), no kitchen screen/printer (waiter confirms with the customer then tells the chef), table QR -> `order.html?table=N`, waiting-area QR -> `parcel.html`, review QR -> `review.html`.

## Verifying your work (REQUIRED before you report done)
A static server is already running on http://localhost:3000 (project root). Screenshot + console-error helper:
`cd /tmp/npmwork && node shot.js http://localhost:3000/<page> /tmp/<name>.png <width> <height> <fullPage:0|1>`
(prints console errors/warnings; then open the PNG with the Read tool to LOOK at it). Write your own Playwright scripts for interaction flows
(`const { chromium } = require('playwright-core'); chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`, run from /tmp/npmwork).
Check at least 360px, 768px and 1440px for each page; zero console errors; no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`); both EN and TA (`localStorage.setItem('bbc:lang','ta')` then reload); flows actually work end-to-end.
Do NOT edit shared foundation files except for a real bug (surgical edit, and mention it in your report). Report: files created, anything you could not finish, any core bug/gap you found.
Original owner brief with full detail: /root/.claude/uploads/9fd38980-dfb2-55d2-b3d9-26f1b4899152/9f79305f-attachment.txt (read the sections for your pages).
Demo credentials: admin / Admin@123; waiters ravi, priya, karthik, divya / Waiter@123.
Demo data: tables 1-10 (table 2 has a bill requested, table 5 has a call-waiter alert + confirmed order, table 9 has a new order waiting). Parcel tokens P-011..P-013 exist.
