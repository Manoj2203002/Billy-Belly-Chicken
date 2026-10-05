/* ==========================================================================
   orderSync.js - real-time simulation between browser tabs.
   Customer tab <-> waiter tab. Uses BroadcastChannel, with a localStorage
   "storage" event fallback. PRODUCTION: replace with a WebSocket / SSE / Firebase
   listener that calls the same subscribe() callbacks.
   Event types: 'order:new' 'order:status' 'alert:call' 'alert:bill' 'table:closed'
   ========================================================================== */
const CH = 'bbc-orders';
const KEY = 'bbc:evt';
let bc = null;
try { bc = new BroadcastChannel(CH); } catch { /* fallback to storage events */ }
const subs = new Set();

function fire(msg) { subs.forEach((cb) => { try { cb(msg); } catch (e) { console.error(e); } }); }

if (bc) bc.onmessage = (e) => fire({ ...e.data, remote: true });
window.addEventListener('storage', (e) => {
  if (e.key === KEY && e.newValue && !bc) { try { fire({ ...JSON.parse(e.newValue), remote: true }); } catch { /* ignore */ } }
});

/** Broadcast an event to every other tab AND to subscribers in this tab. */
export function publish(type, payload = {}) {
  const msg = { type, payload, at: Date.now() };
  if (bc) bc.postMessage(msg);
  else { try { localStorage.setItem(KEY, JSON.stringify(msg)); } catch { /* ignore */ } }
  fire({ ...msg, remote: false });
}
/** subscribe(cb) or subscribe('order:new', cb). Returns an unsubscribe function. */
export function subscribe(typeOrCb, maybeCb) {
  const cb = typeof typeOrCb === 'function' ? typeOrCb : (m) => { if (m.type === typeOrCb) maybeCb(m); };
  subs.add(cb); return () => subs.delete(cb);
}
/** Short beep for new-order alerts (WebAudio, no asset needed). Safe to call without a user gesture - fails silently. */
export function beep(freq = 880, ms = 160) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(); const g = ac.createGain();
    o.frequency.value = freq; o.type = 'sine'; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination);
    o.start(); setTimeout(() => { o.stop(); ac.close(); }, ms);
  } catch { /* ignore */ }
}
