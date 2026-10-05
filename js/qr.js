/* qr.js - client-side QR generation (vendored MIT lib "qrcode-generator") + helpers for the print sheet. */
import qrcode from './vendor/qrcode.esm.js';
import { db } from './dataService.js';

import { ROOT } from './utils.js';
/** Build page URLs from the admin-configurable base URL (Settings > Base URL). */
export function baseUrl() {
  const s = db.get('settings') || {};
  let b = (s.baseUrl || new URL(ROOT, location.href).href).trim().replace(/\/+$/, '');
  return b;
}
export const urls = {
  table: (no) => `${baseUrl()}/order.html?table=${no}`,
  parcel: () => `${baseUrl()}/parcel.html`,
  review: () => `${baseUrl()}/review.html`,
  menu: () => `${baseUrl()}/menu.html`,
};
/** qrSVG(text, {size, margin, dark, light}) -> SVG string (crisp at any size, print-safe: black on white) */
export function qrSVG(text, { size = 220, margin = 2, dark = '#0a0909', light = '#ffffff' } = {}) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(); const total = n + margin * 2; let path = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + margin} ${r + margin}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${text}"><rect width="${total}" height="${total}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
/** Rasterise a QR (optionally with logo in the centre) to a PNG blob for download. */
export function qrPNG(text, { px = 1024, logo } = {}) {
  return new Promise((resolve) => {
    const svg = qrSVG(text, { size: px, margin: 3 });
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d');
      g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, px, px);
      const done = () => c.toBlob((b) => resolve(b), 'image/png');
      if (!logo) return done();
      const l = new Image(); l.onload = () => { const s = px * 0.2; g.fillStyle = '#fff'; g.fillRect((px - s) / 2 - 6, (px - s) / 2 - 6, s + 12, s + 12); g.drawImage(l, (px - s) / 2, (px - s) / 2, s, s * (l.height / l.width)); done(); }; l.onerror = done; l.src = logo;
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
