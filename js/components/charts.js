/* charts.js - tiny SVG charts with draw-in animation (no libraries). Palette: red / white / greys only. */
import { esc, money } from '../utils.js';
import { reducedMotion } from '../utils.js';

const NS = 'http://www.w3.org/2000/svg';
const RED = '#d71920'; const WHITE = '#ffffff'; const GREY = 'rgba(20,17,17,.35)';
const PALETTE = ['#d71920', '#141111', '#a8120e', '#7a7370', '#ff6a62', '#c9c3be'];
const css = `.ch-axis text{fill:var(--text-muted);font:11px "Inter",sans-serif}.ch-grid line{stroke:var(--border)}
.ch-bar{transform-box:fill-box;transform-origin:50% 100%;animation:ch-grow .9s cubic-bezier(.22,1,.36,1) both}
@keyframes ch-grow{from{transform:scaleY(0)}}
.ch-line{stroke-dasharray:var(--len);stroke-dashoffset:var(--len);animation:ch-draw 1.4s .1s cubic-bezier(.22,1,.36,1) forwards}
@keyframes ch-draw{to{stroke-dashoffset:0}}.ch-area{opacity:0;animation:ch-fade 1s .8s forwards}@keyframes ch-fade{to{opacity:1}}
.ch-dot{opacity:0;animation:ch-fade .4s 1.2s forwards}
.ch-tip{pointer-events:none}@media (prefers-reduced-motion:reduce){.ch-bar,.ch-line,.ch-area,.ch-dot{animation:none;stroke-dashoffset:0;opacity:1}}`;
function ensureCSS() { if (document.getElementById('ch-css')) return; const s = document.createElement('style'); s.id = 'ch-css'; s.textContent = css; document.head.append(s); }
const svg = (w, h) => `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" preserveAspectRatio="xMidYMid meet" style="display:block;height:auto;overflow:visible">`;

/** barChart(node, [{label, value}], {height, format, title}) */
export function barChart(node, data, { height = 260, format = (v) => v, title = 'Bar chart' } = {}) {
  ensureCSS(); const W = 560; const H = height; const m = { t: 16, r: 10, b: 30, l: 42 };
  const max = Math.max(1, ...data.map((d) => d.value)) * 1.12; const bw = (W - m.l - m.r) / Math.max(1, data.length);
  const y = (v) => m.t + (H - m.t - m.b) * (1 - v / max);
  let g = ''; for (let i = 0; i <= 4; i++) { const v = (max / 4) * i; g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`; }
  let ax = ''; for (let i = 0; i <= 4; i++) { const v = (max / 4) * i; ax += `<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${esc(format(Math.round(v)))}</text>`; }
  const bars = data.map((d, i) => { const x = m.l + i * bw + bw * 0.18; const w = bw * 0.64; const hh = Math.max(2, H - m.b - y(d.value));
    return `<g><rect class="ch-bar" style="animation-delay:${i * 60}ms" x="${x}" y="${y(d.value)}" width="${w}" height="${hh}" rx="5" fill="${RED}"><title>${esc(d.label)}: ${esc(format(d.value))}</title></rect><text x="${x + w / 2}" y="${H - 10}" text-anchor="middle">${esc(String(d.label).slice(0, 9))}</text></g>`; }).join('');
  node.innerHTML = `${svg(W, H).replace('role="img"', `role="img" aria-label="${esc(title)}"`)}<g class="ch-grid">${g}</g><g class="ch-axis">${ax}${bars}</g></svg>`;
}
/** lineChart(node, [{label, value}], {height, format}) */
export function lineChart(node, data, { height = 260, format = (v) => v, title = 'Line chart' } = {}) {
  ensureCSS(); const W = 560; const H = height; const m = { t: 16, r: 14, b: 30, l: 46 };
  const max = Math.max(1, ...data.map((d) => d.value)) * 1.15; const step = (W - m.l - m.r) / Math.max(1, data.length - 1);
  const px = (i) => m.l + i * step; const py = (v) => m.t + (H - m.t - m.b) * (1 - v / max);
  const pts = data.map((d, i) => [px(i), py(d.value)]); const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L${px(data.length - 1)} ${H - m.b} L${px(0)} ${H - m.b}Z`;
  let g = ''; let ax = ''; for (let i = 0; i <= 4; i++) { const v = (max / 4) * i; g += `<line x1="${m.l}" x2="${W - m.r}" y1="${py(v)}" y2="${py(v)}"/>`; ax += `<text x="${m.l - 8}" y="${py(v) + 4}" text-anchor="end">${esc(format(Math.round(v)))}</text>`; }
  const labels = data.map((d, i) => `<text x="${px(i)}" y="${H - 10}" text-anchor="middle">${esc(String(d.label))}</text>`).join('');
  const dots = pts.map((p, i) => `<circle class="ch-dot" cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#fff" stroke="${RED}" stroke-width="2.5"><title>${esc(data[i].label)}: ${esc(format(data[i].value))}</title></circle>`).join('');
  node.innerHTML = `${svg(W, H).replace('role="img"', `role="img" aria-label="${esc(title)}"`)}<defs><linearGradient id="lg1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${RED}" stop-opacity=".45"/><stop offset="1" stop-color="${RED}" stop-opacity="0"/></linearGradient></defs><g class="ch-grid">${g}</g><g class="ch-axis">${ax}${labels}</g><path class="ch-area" d="${area}" fill="url(#lg1)"/><path class="ch-line" d="${path}" fill="none" stroke="${RED}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="--len:2000" pathLength="2000"/>${dots}</svg>`;
}
/** donutChart(node, [{label, value}], {size, centerLabel}) with a legend underneath */
export function donutChart(node, data, { size = 200, centerLabel = '', title = 'Donut chart' } = {}) {
  ensureCSS(); const total = data.reduce((a, d) => a + d.value, 0) || 1; const r = 70; const C = 2 * Math.PI * r; let off = 0;
  const segs = data.map((d, i) => { const len = (d.value / total) * C; const s = `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"><title>${esc(d.label)}: ${d.value}</title><animate attributeName="stroke-dasharray" from="0 ${C}" to="${len} ${C - len}" dur="${reducedMotion() ? 0 : 1}s" begin="0s" fill="freeze"/></circle>`; off += len; return s; }).join('');
  const legend = data.map((d, i) => `<li style="display:flex;align-items:center;gap:.5rem"><i style="width:10px;height:10px;border-radius:3px;background:${PALETTE[i % PALETTE.length]}"></i><span>${esc(d.label)}</span><b style="margin-left:auto">${d.value}</b></li>`).join('');
  node.innerHTML = `<div style="display:grid;gap:1rem;justify-items:center"><svg viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${esc(title)}"><circle cx="100" cy="100" r="${r}" fill="none" stroke="rgba(20,17,17,.07)" stroke-width="26"/>${segs}<text x="100" y="106" text-anchor="middle" style="fill:var(--text)" font-family="Big Shoulders Display" font-weight="900" font-size="30">${esc(centerLabel || total)}</text></svg><ul style="width:100%;display:grid;gap:.35rem;font-size:.85rem">${legend}</ul></div>`;
}
export { PALETTE, money };
