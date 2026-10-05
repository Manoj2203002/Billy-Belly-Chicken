(() => {
  // js/utils.js
  var ROOT = typeof document !== "undefined" && document.body && document.body.dataset.root || "";
  var url = (p) => ROOT + String(p).replace(/^\//, "");
  async function loadJSON(path, opts) {
    const pre = typeof window !== "undefined" && window.__BBC_FILES;
    if (pre && pre[path] !== void 0) return structuredClone(pre[path]);
    const r = await fetch(ROOT + path, opts);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  var $ = (sel, root = document) => root.querySelector(sel);
  var $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) node.append(c.nodeType ? c : document.createTextNode(c));
    return node;
  }
  var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  var debounce = (fn, ms = 200) => {
    let t2;
    return (...a) => {
      clearTimeout(t2);
      t2 = setTimeout(() => fn(...a), ms);
    };
  };
  var throttleRaf = (fn) => {
    let q = false;
    return (...a) => {
      if (q) return;
      q = true;
      requestAnimationFrame(() => {
        q = false;
        fn(...a);
      });
    };
  };
  var reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isFinePointer = () => window.matchMedia("(hover:hover) and (pointer:fine)").matches;
  var param = (name) => new URLSearchParams(location.search).get(name);
  var uid = (p = "id") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  var mem = /* @__PURE__ */ new Map();
  var store = {
    get(k, d = null) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch {
        return mem.has(k) ? mem.get(k) : d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        mem.set(k, v);
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch {
        mem.delete(k);
      }
    }
  };
  var session = {
    get(k, d = null) {
      try {
        const v = sessionStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        sessionStorage.setItem(k, JSON.stringify(v));
      } catch {
      }
    },
    del(k) {
      try {
        sessionStorage.removeItem(k);
      } catch {
      }
    }
  };
  var _cur = "\u20B9";
  var setCurrency = (c) => {
    _cur = c || "\u20B9";
  };
  var money = (n) => `${_cur}${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
  var pad = (n, l = 2) => String(n).padStart(l, "0");
  var todayStr = (d = /* @__PURE__ */ new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function fmtTime(iso, lang2 = "en") {
    return new Date(iso).toLocaleTimeString(lang2 === "ta" ? "ta-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  var imgSrc = (p) => !p ? url("assets/images/misc/placeholder.svg") : /^(data:|https?:|blob:)/.test(p) ? p : url(p);

  // js/dataService.js
  var SEED_VERSION = "2026.10.2";
  var PFX = "bbc:db:";
  var SEED_FILES = {
    restaurant: "data/restaurant.json",
    categories: "data/categories.json",
    menu: "data/menu.json",
    specials: "data/specials.json",
    offers: "data/offers.json",
    gallery: "data/gallery.json",
    tables: "data/tables.json",
    staff: "data/staff.json",
    orders: "data/orders.json",
    reviews: "data/reviews.json",
    settings: "data/settings.json",
    tableSessions: "data/tableSessions.json"
  };
  var RUNTIME = ["alerts", "audit"];
  var SINGLETONS = /* @__PURE__ */ new Set(["restaurant", "settings"]);
  var ID_PREFIX = { categories: "c", menu: "m", specials: "sp", offers: "o", gallery: "g", tables: "t", staff: "w", orders: "O-", reviews: "r", tableSessions: "ts", alerts: "al", audit: "a" };
  var cache = /* @__PURE__ */ new Map();
  var listeners = /* @__PURE__ */ new Set();
  var bc = null;
  try {
    bc = new BroadcastChannel("bbc-data");
  } catch {
  }
  function resolveTokens(v) {
    if (typeof v === "string") {
      const m = v.match(/^\{\{(today|now|day)(?:-(\d+))?\}\}$/);
      if (!m) return v;
      const n = Number(m[2] || 0);
      if (m[1] === "today") {
        const d = /* @__PURE__ */ new Date();
        d.setDate(d.getDate() - n);
        return todayStr(d);
      }
      if (m[1] === "now") return new Date(Date.now() - n * 6e4).toISOString();
      return new Date(Date.now() - n * 864e5).toISOString();
    }
    if (Array.isArray(v)) return v.map(resolveTokens);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveTokens(x)]));
    return v;
  }
  function writeRaw(col, data) {
    store.set(PFX + col, data);
    cache.set(col, data);
  }
  function readRaw(col) {
    if (cache.has(col)) return cache.get(col);
    const d = store.get(PFX + col, SINGLETONS.has(col) ? {} : []);
    cache.set(col, d);
    return d;
  }
  function notify(col, fromRemote = false) {
    listeners.forEach((cb) => {
      try {
        cb(col, fromRemote);
      } catch (e) {
        console.error(e);
      }
    });
  }
  var _ready = null;
  function init() {
    if (_ready) return _ready;
    _ready = (async () => {
      if (store.get("bbc:seedVersion") !== SEED_VERSION) await seed();
      if (bc) bc.onmessage = (e) => {
        cache.delete(e.data.col);
        notify(e.data.col, true);
      };
      window.addEventListener("storage", (e) => {
        if (e.key && e.key.startsWith(PFX)) {
          const col = e.key.slice(PFX.length);
          cache.delete(col);
          if (!bc) notify(col, true);
        }
      });
    })();
    return _ready;
  }
  async function seed() {
    const entries = await Promise.all(Object.entries(SEED_FILES).map(async ([col, path]) => {
      try {
        return [col, resolveTokens(await loadJSON(path, { cache: "no-cache" }))];
      } catch (err) {
        console.warn("[dataService] could not load", path, err);
        return [col, SINGLETONS.has(col) ? {} : []];
      }
    }));
    entries.forEach(([col, data]) => writeRaw(col, data));
    RUNTIME.forEach((col) => writeRaw(col, []));
    store.set("bbc:counters", { parcel: { date: todayStr(), n: 14 }, orders: 1010 });
    store.set("bbc:seedVersion", SEED_VERSION);
  }
  var clone = (x) => x === void 0 ? x : structuredClone(x);
  var db = {
    /** list(col, predicate?) -> array of copies */
    list(col, pred) {
      const a = readRaw(col);
      return clone(pred ? a.filter(pred) : a);
    },
    /** get(col, id) -> item | undefined ; get('settings') -> object */
    get(col, id) {
      const d = readRaw(col);
      return SINGLETONS.has(col) ? clone(d) : clone(d.find((x) => x.id === id));
    },
    /** find first item matching predicate */
    find(col, pred) {
      return clone(readRaw(col).find(pred));
    },
    nextId(col) {
      const pre = ID_PREFIX[col] || "x";
      if (col === "orders") {
        const c = store.get("bbc:counters", {});
        c.orders = (c.orders || 1010) + 1;
        store.set("bbc:counters", c);
        return `O-${c.orders}`;
      }
      if (["tableSessions", "alerts", "audit"].includes(col)) return uid(pre);
      const rows = readRaw(col);
      const max = rows.reduce((m, x) => Math.max(m, parseInt(String(x.id).replace(/\D/g, ""), 10) || 0), 0);
      const width = rows.reduce((w, x) => Math.max(w, String(x.id).replace(/\D/g, "").length), 2);
      return `${pre}${pad(max + 1, width)}`;
    },
    create(col, item) {
      const arr = readRaw(col).slice();
      const rec = { ...clone(item) };
      if (!rec.id) rec.id = this.nextId(col);
      arr.push(rec);
      writeRaw(col, arr);
      this._emit(col);
      return clone(rec);
    },
    update(col, id, patch) {
      if (SINGLETONS.has(col)) {
        const next = { ...readRaw(col), ...clone(id) };
        writeRaw(col, next);
        this._emit(col);
        return clone(next);
      }
      const arr = readRaw(col).slice();
      const i = arr.findIndex((x) => x.id === id);
      if (i < 0) return null;
      arr[i] = { ...arr[i], ...clone(patch) };
      writeRaw(col, arr);
      this._emit(col);
      return clone(arr[i]);
    },
    /** replace a singleton (restaurant/settings) or a whole collection (used for reordering) */
    save(col, data) {
      writeRaw(col, clone(data));
      this._emit(col);
    },
    remove(col, id) {
      const arr = readRaw(col);
      const next = arr.filter((x) => x.id !== id);
      if (next.length === arr.length) return false;
      writeRaw(col, next);
      this._emit(col);
      return true;
    },
    /** subscribe to changes: cb(collection, fromOtherTab) -> unsubscribe fn */
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    _emit(col) {
      if (bc) bc.postMessage({ col });
      notify(col, false);
    },
    /** wipe everything and re-seed from JSON ("Reset demo data" button) */
    async reset() {
      Object.keys(localStorage).filter((k) => k.startsWith("bbc:") && !["bbc:lang"].includes(k)).forEach((k) => localStorage.removeItem(k));
      cache.clear();
      _ready = null;
      await seed();
      Object.keys(SEED_FILES).concat(RUNTIME).forEach((c) => this._emit(c));
    },
    /** audit log of admin changes */
    audit(action, detail = "") {
      const who = session.get("bbc:session:admin") || session.get("bbc:session:waiter") || {};
      const arr = readRaw("audit").slice();
      arr.unshift({ id: uid("a"), at: (/* @__PURE__ */ new Date()).toISOString(), by: who.name || "system", role: who.role || "-", action, detail });
      writeRaw("audit", arr.slice(0, 300));
      this._emit("audit");
    },
    /** parcel token generator: P-015, P-016 ... resets every day */
    nextParcelToken() {
      const c = store.get("bbc:counters", {});
      const today = todayStr();
      if (!c.parcel || c.parcel.date !== today) c.parcel = { date: today, n: 0 };
      c.parcel.n += 1;
      store.set("bbc:counters", c);
      return `P-${pad(c.parcel.n, 3)}`;
    }
  };
  var collections = Object.keys(SEED_FILES).concat(RUNTIME);

  // js/i18n.js
  var lang = "en";
  var dict = { en: {}, ta: {} };
  var loaded = /* @__PURE__ */ new Set();
  var listeners2 = /* @__PURE__ */ new Set();
  var namespaces = [];
  var flatten = (o, p = "", out = {}) => {
    for (const [k, v] of Object.entries(o)) {
      const key = p ? `${p}.${k}` : k;
      if (v && typeof v === "object") flatten(v, key, out);
      else out[key] = v;
    }
    return out;
  };
  async function load(l, path) {
    const id = `${l}:${path}`;
    if (loaded.has(id)) return;
    loaded.add(id);
    try {
      Object.assign(dict[l], flatten(await loadJSON(path)));
    } catch {
    }
  }
  async function loadAll(l) {
    await Promise.all([load(l, `data/i18n/${l}.json`), ...namespaces.map((ns) => load(l, `data/i18n/pages/${ns}.${l}.json`))]);
  }
  function t(key, vars) {
    let s = dict[lang][key] ?? dict.en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
    return s;
  }
  function tr(obj, fallback = "") {
    if (obj == null) return fallback;
    if (typeof obj === "string") return obj;
    return obj[lang] || obj.en || fallback;
  }
  function applyI18n(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((n) => {
      n.textContent = t(n.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-html]").forEach((n) => {
      n.innerHTML = t(n.dataset.i18nHtml);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((n) => {
      n.setAttribute("placeholder", t(n.dataset.i18nPlaceholder));
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((n) => {
      n.setAttribute("aria-label", t(n.dataset.i18nAria));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((n) => {
      n.setAttribute("title", t(n.dataset.i18nTitle));
    });
    if (root === document) {
      document.documentElement.lang = lang;
      const tt = document.documentElement.dataset.titleKey;
      if (tt) document.title = t(tt);
    }
  }
  async function initI18n(ns = []) {
    namespaces = ns;
    await loadAll("en");
    if (lang !== "en") await loadAll("ta");
    applyI18n();
  }
  function onLangChange(cb) {
    listeners2.add(cb);
    return () => listeners2.delete(cb);
  }
  function mountLangToggle(container) {
    if (container) container.innerHTML = "";
  }

  // js/icons.js
  var P = {
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    cart: '<path d="M3 4h2.5l2.2 10.2a1.6 1.6 0 0 0 1.6 1.3h7.4a1.6 1.6 0 0 0 1.55-1.2L20 8H6.2"/><circle cx="9.5" cy="19.5" r="1.2"/><circle cx="17" cy="19.5" r="1.2"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    flame: '<path d="M12 3c.5 3-1.5 4.5-3 6.5S6.5 13 7 15.5A5.2 5.2 0 0 0 12 20a5.2 5.2 0 0 0 5-5.5c0-2-1-3.2-2-4.3 0 1.4-.7 2.3-1.6 2.8.4-3-.6-6.4-1.4-10Z"/>',
    chili: '<path d="M16.5 4.5c1.3-1.3 3-.8 3 .6M15 7c-4.5-1-9.5 1.5-11 9 5-1 11.5-1 12.2-6.8.2-1.4-.3-2.1-1.2-2.2Z"/>',
    drumstick: '<ellipse cx="15" cy="9" rx="5.800" ry="5.200" transform="rotate(-20 15 9)"/><path d="M11 13 5.500 18.500"/><circle cx="4.500" cy="19" r="1.600"/><circle cx="6.800" cy="20.800" r="1.600"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c2-5 5-8 9-10"/>',
    phone: '<path d="M6.5 3.5h3l1.5 4-2 1.300a11 11 0 0 0 5.200 5.200l1.300-2 4 1.500v3a2 2 0 0 1-2.200 2A15.500 15.500 0 0 1 4.500 5.700a2 2 0 0 1 2-2.200Z"/>',
    whatsapp: '<path d="M4 20l1.200-4.100A8 8 0 1 1 8.200 19L4 20Z"/><path d="M9 9.200c.2 2.200 2.600 4.700 5.200 5.300l1.100-1.100-1.800-1-.9.600c-.8-.4-1.500-1.100-1.900-1.900l.600-.9-1-1.800L9 9.200Z"/>',
    pin: '<path d="M12 21s7-5.700 7-11a7 7 0 0 0-14 0c0 5.300 7 11 7 11Z"/><circle cx="12" cy="10" r="2.500"/>',
    clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
    star: '<path d="m12 3.500 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.800 6.800 19.600l1-5.800L3.500 9.700l5.900-.8L12 3.500Z"/>',
    starfill: '<path fill="currentColor" d="m12 3.500 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.800 6.800 19.600l1-5.800L3.500 9.700l5.900-.8L12 3.500Z"/>',
    check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
    checkcircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.300 2.800 2.800L16.200 9.500"/>',
    xcircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
    bell: '<path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15L6 16.500Z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    receipt: '<path d="M6 3h12v18l-3-1.800-3 1.800-3-1.800L6 21V3Z"/><path d="M9 8h6M9 12h6"/>',
    user: '<circle cx="12" cy="8" r="3.800"/><path d="M4.500 20a7.500 7.500 0 0 1 15 0"/>',
    users: '<circle cx="9" cy="8.500" r="3.200"/><path d="M3 19.500a6 6 0 0 1 12 0"/><path d="M16 5.500a3.200 3.200 0 0 1 0 6.100M18 14a6 6 0 0 1 3 5.500"/>',
    table: '<path d="M3 9h18M5 9v10M19 9v10M7 9V5h10v4"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2.500v2.500H14zM19 14h1v1M14 19.500h2M18.500 18v2.500M20 20.500v0"/>',
    edit: '<path d="M4 20h4L19.500 8.500a2.100 2.100 0 0 0-3-3L5 17l-1 3Z"/><path d="m14.500 7.500 3 3"/>',
    trash: '<path d="M4 7h16M10 7V4.500h4V7M6.500 7l.8 12.500h9.400L17.500 7M10 11v5.500M14 11v5.500"/>',
    eye: '<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12Z"/><circle cx="12" cy="12" r="2.800"/>',
    eyeoff: '<path d="M3 3l18 18M10 6a9 9 0 0 1 2-.5c6 0 9.500 6.500 9.500 6.500a15 15 0 0 1-2.800 3.500M6.300 7.300A15 15 0 0 0 2.500 12S6 18.500 12 18.500a9 9 0 0 0 3.500-.7"/>',
    image: '<rect x="3.500" y="4.500" width="17" height="15" rx="2.500"/><circle cx="9" cy="10" r="1.600"/><path d="m4 17 5-4.500 4 3.500 3-2.500 4.500 3.500"/>',
    upload: '<path d="M12 16V4m0 0L7.500 8.500M12 4l4.500 4.500M4.500 16v3.500h15V16"/>',
    download: '<path d="M12 4v12m0 0 4.500-4.500M12 16l-4.500-4.500M4.500 16v3.500h15V16"/>',
    print: '<path d="M7 9V3.500h10V9M7 17H4.500V9h15v8H17"/><path d="M7 14h10v6.500H7z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12.500 16V8M17 16v-6"/>',
    trending: '<path d="m3.500 17 6-6 4 4 7-8"/><path d="M15 7h5.500v5.500"/>',
    dashboard: '<rect x="3.500" y="3.500" width="7" height="9" rx="1.500"/><rect x="13.500" y="3.500" width="7" height="5" rx="1.500"/><rect x="13.500" y="11.500" width="7" height="9" rx="1.500"/><rect x="3.500" y="15.500" width="7" height="5" rx="1.500"/>',
    tag: '<path d="M3.500 12.500V4.500h8l9 9-8 8-9-9Z"/><circle cx="8" cy="9" r="1.200"/>',
    gift: '<rect x="3.500" y="9" width="17" height="11.500" rx="1.500"/><path d="M2.500 9h19v-3h-19zM12 6v14.500M12 6c-1-3-5-3.500-5-1.200S10 6 12 6Zm0 0c1-3 5-3.500 5-1.200S14 6 12 6Z"/>',
    logout: '<path d="M10 4.500H5.500v15H10M15 8l4 4-4 4M19 12H9"/>',
    arrowright: '<path d="M4 12h16m0 0-6-6m6 6-6 6"/>',
    arrowleft: '<path d="M20 12H4m0 0 6-6m-6 6 6 6"/>',
    arrowup: '<path d="M12 20V4m0 0-6 6m6-6 6 6"/>',
    arrowdown: '<path d="M12 4v16m0 0-6-6m6 6 6-6"/>',
    chevdown: '<path d="m6 9 6 6 6-6"/>',
    chevright: '<path d="m9 6 6 6-6 6"/>',
    chevleft: '<path d="m15 6-6 6 6 6"/>',
    filter: '<path d="M3.500 5.500h17l-6.500 8v5.500l-4-2v-3.500l-6.500-8Z"/>',
    sort: '<path d="M7 4v16m0 0-3.500-3.500M7 20l3.500-3.500M17 20V4m0 0-3.500 3.500M17 4l3.500 3.500"/>',
    instagram: '<rect x="3.500" y="3.500" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r=".8" fill="currentColor"/>',
    mail: '<rect x="3" y="5.500" width="18" height="13" rx="2"/><path d="m4 7.500 8 6 8-6"/>',
    alert: '<path d="M12 3.500 2.500 20h19L12 3.500Z"/><path d="M12 10v4.500M12 17.300v.2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.500M12 7.800v.2"/>',
    utensils: '<path d="M6 3.500v7.500a2 2 0 0 0 2 2v7.500M10 3.500V11M3 3.500V11a3 3 0 0 0 3 3M17 20.500V3.500c-2.500 1.500-3.500 5-3.500 8h3.500"/>',
    sparkle: '<path d="M12 3.500c.6 4.200 2.300 5.900 6.500 6.500-4.200.6-5.900 2.300-6.500 6.500-.6-4.200-2.300-5.900-6.500-6.500 4.200-.6 5.900-2.300 6.500-6.500ZM18.500 16.500c.3 1.700 1 2.400 2.500 2.700-1.500.3-2.200 1-2.500 2.700-.3-1.700-1-2.400-2.500-2.700 1.500-.3 2.200-1 2.500-2.700Z"/>',
    home: '<path d="M4 11 12 4l8 7v9h-5.500v-5.500h-5V20H4v-9Z"/>',
    list: '<path d="M8.500 6.500H20M8.500 12H20M8.500 17.500H20"/><circle cx="4.500" cy="6.500" r=".9" fill="currentColor"/><circle cx="4.500" cy="12" r=".9" fill="currentColor"/><circle cx="4.500" cy="17.500" r=".9" fill="currentColor"/>',
    grid: '<rect x="3.500" y="3.500" width="7" height="7" rx="1.500"/><rect x="13.500" y="3.500" width="7" height="7" rx="1.500"/><rect x="3.500" y="13.500" width="7" height="7" rx="1.500"/><rect x="13.500" y="13.500" width="7" height="7" rx="1.500"/>',
    calendar: '<rect x="3.500" y="5" width="17" height="15.500" rx="2"/><path d="M3.500 10h17M8 3v4M16 3v4"/>',
    money: '<rect x="2.500" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.800"/><path d="M6 9.500v.2M18 14.300v.2"/>',
    card: '<rect x="2.500" y="5" width="19" height="14" rx="2.500"/><path d="M2.500 10h19M6.500 15h3"/>',
    upi: '<path d="M7 4.500 4.500 19.500M12.500 4.500 10 19.500M5.500 12h14.500l-3-4M20 12l-3 4"/>',
    dots: '<circle cx="5.500" cy="12" r="1.400" fill="currentColor"/><circle cx="12" cy="12" r="1.400" fill="currentColor"/><circle cx="18.500" cy="12" r="1.400" fill="currentColor"/>',
    drag: '<circle cx="9" cy="6" r="1.300" fill="currentColor"/><circle cx="15" cy="6" r="1.300" fill="currentColor"/><circle cx="9" cy="12" r="1.300" fill="currentColor"/><circle cx="15" cy="12" r="1.300" fill="currentColor"/><circle cx="9" cy="18" r="1.300" fill="currentColor"/><circle cx="15" cy="18" r="1.300" fill="currentColor"/>',
    award: '<circle cx="12" cy="9" r="5.500"/><path d="m8.800 13.500-1.300 7 4.500-2.500 4.500 2.500-1.300-7"/>',
    translate: '<path d="M4 6h9M8.500 4v2M6 6c0 4 3 7 6 8M12 6c0 4-3 7-7 8.500M13.500 20l4-9 4 9M14.800 17h5.400"/>',
    copy: '<rect x="8.500" y="8.500" width="12" height="12" rx="2"/><path d="M15.500 8.500V5a1.500 1.500 0 0 0-1.500-1.500H5A1.500 1.500 0 0 0 3.500 5v9A1.500 1.500 0 0 0 5 15.500h3.500"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.400-4M4 4v3.500h3.500M4 13a8 8 0 0 0 14.400 4M20 20v-3.500h-3.500"/>',
    lock: '<rect x="5" y="10.500" width="14" height="10" rx="2"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/>',
    shield: '<path d="M12 3.500 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6l-7-2.500Z"/><path d="m9 12 2.200 2.200L15.500 10"/>',
    hand: '<path d="M8 12.500V6a1.500 1.500 0 0 1 3 0v5M11 11V4.500a1.500 1.500 0 0 1 3 0V11M14 11V6a1.500 1.500 0 0 1 3 0v8c0 4-2.500 6.500-6 6.500-2.500 0-4-1-5.500-3.500L3.800 14a1.500 1.500 0 0 1 2.500-1.600L8 14.500"/>',
    bill: '<rect x="4.500" y="3.500" width="15" height="17" rx="2"/><path d="M8.500 8.500h7M8.500 12.500h7M8.500 16.500h4"/>',
    chef: '<path d="M7 14.500V19h10v-4.500M7 14.500a4 4 0 0 1-1.200-7.600A4 4 0 0 1 12 4a4 4 0 0 1 6.200 2.900A4 4 0 0 1 17 14.500H7Z"/>',
    burger: '<path d="M4 11a8 6 0 0 1 16 0H4ZM3 15h18M4 18.500a2 2 0 0 0 2 1.500h12a2 2 0 0 0 2-1.500H4Z"/>',
    cup: '<path d="M6 5h12l-1.300 14.300a1.500 1.500 0 0 1-1.500 1.200H8.800a1.500 1.500 0 0 1-1.500-1.200L6 5Z"/><path d="M6.500 10h11M13 5l2-2.500"/>',
    move: '<path d="M12 3.500v17M3.500 12h17M12 3.500 9.500 6M12 3.500 14.500 6M12 20.500 9.500 18M12 20.500l2.500-2.500M3.500 12 6 9.500M3.500 12 6 14.500M20.500 12 18 9.500M20.500 12 18 14.500"/>',
    sound: '<path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500H4Z"/><path d="M15.500 9a4.200 4.200 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/>',
    soundoff: '<path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500H4Z"/><path d="m16 9.500 5 5m0-5-5 5"/>',
    history: '<path d="M3.500 12a8.500 8.500 0 1 0 2.600-6.100M3.500 4.500v4h4"/><path d="M12 8v4.500l3 1.500"/>',
    box: '<path d="M3.500 7.500 12 3.500l8.500 4v9L12 20.500l-8.500-4v-9ZM3.500 7.500 12 11.500l8.500-4M12 11.500v9"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
    zap: '<path d="M13 2.500 4.500 13.500H11L10 21.500l8.500-11H12.500L13 2.500Z"/>'
  };
  function icon(name, { size, cls = "", label = "" } = {}) {
    const body = P[name] || P.info;
    const s = size ? ` width="${size}" height="${size}"` : "";
    const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
    return `<svg class="icon ${cls}"${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`;
  }
  var iconNames = Object.keys(P);
  function hydrateIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach((n) => {
      if (n.dataset.iconDone) return;
      n.insertAdjacentHTML("afterbegin", icon(n.dataset.icon, { size: n.dataset.iconSize }));
      n.dataset.iconDone = "1";
    });
  }
  function spiceHTML(level = 0, max = 3) {
    if (!level) return "";
    return `<span class="spice" title="Spice ${level}/${max}">${Array.from({ length: max }, (_, i) => icon("chili", { cls: i < level ? "" : "off" })).join("")}</span>`;
  }
  function vegMark(isVeg) {
    return `<span class="veg-mark ${isVeg ? "" : "veg-mark--non"}" role="img" aria-label="${isVeg ? "Vegetarian" : "Non-vegetarian"}"></span>`;
  }

  // js/ui.js
  var stack;
  function toast(message, { type = "ok", title = "", ms = 3800 } = {}) {
    stack || (stack = document.body.appendChild(el("div", { class: "toast-stack", role: "status", "aria-live": "polite" })));
    const ic = { ok: "checkcircle", error: "xcircle", warn: "alert", alert: "bell", info: "info" }[type] || "info";
    const node = el("div", { class: `toast toast--${type}` }, el("span", { html: icon(ic) }), el("div", {}, title && el("div", { class: "toast__title" }, title), el("div", { class: title ? "toast__msg" : "toast__title" }, message)));
    stack.append(node);
    const kill = () => {
      node.classList.add("is-out");
      setTimeout(() => node.remove(), 360);
    };
    node.addEventListener("click", kill);
    setTimeout(kill, ms);
    return node;
  }
  var lastFocus = null;
  function openModal({ title = "", body = "", footer = null, size = "", onClose, dismissible = true, cls = "" } = {}) {
    lastFocus = document.activeElement;
    const bodyEl = el("div", { class: "modal__body" });
    typeof body === "string" ? bodyEl.innerHTML = body : bodyEl.append(body);
    const closeBtn = el("button", { class: "modal__close", type: "button", "aria-label": t("common.close"), html: icon("close") });
    const modal = el(
      "div",
      { class: `modal ${size ? "modal--" + size : ""} ${cls}`, role: "dialog", "aria-modal": "true", "aria-label": title || "Dialog" },
      (title || dismissible) && el("div", { class: "modal__head" }, el("h2", { class: "modal__title" }, title), dismissible ? closeBtn : null),
      bodyEl,
      footer && el("div", { class: "modal__foot" }, footer)
    );
    const back = el("div", { class: "modal-backdrop" }, modal);
    document.body.append(back);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => back.classList.add("is-open"));
    const api = {
      el: modal,
      body: bodyEl,
      close() {
        back.classList.remove("is-open");
        document.body.style.overflow = "";
        document.removeEventListener("keydown", onKey);
        setTimeout(() => back.remove(), 420);
        lastFocus && lastFocus.focus && lastFocus.focus();
        onClose && onClose();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape" && dismissible) api.close();
      if (e.key === "Tab") {
        const f = $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', modal).filter((x) => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    if (dismissible) {
      closeBtn.addEventListener("click", api.close);
      back.addEventListener("mousedown", (e) => {
        if (e.target === back) api.close();
      });
    }
    setTimeout(() => {
      const f = $("input,select,textarea,button.btn--primary", modal) || closeBtn;
      f && f.focus({ preventScroll: true });
    }, 60);
    return api;
  }
  function confirmDialog({ title = t("common.areYouSure"), message = "", confirmText = t("common.confirm"), cancelText = t("common.cancel"), danger = false } = {}) {
    return new Promise((resolve) => {
      let m;
      let result = false;
      const ok = el("button", { class: `btn ${danger ? "btn--primary" : "btn--primary"}`, type: "button" }, confirmText);
      const no = el("button", { class: "btn btn--ghost", type: "button" }, cancelText);
      ok.addEventListener("click", () => {
        result = true;
        m.close();
      });
      no.addEventListener("click", () => m.close());
      m = openModal({ title, body: el("p", { class: "text-muted" }, message), footer: [no, ok], size: "sm", onClose: () => resolve(result) });
    });
  }
  function createDrawer({ title = "", side = "right", footer = true, onOpen, onClose } = {}) {
    const back = el("div", { class: "drawer-backdrop" });
    const body = el("div", { class: "drawer__body" });
    const foot = el("div", { class: "drawer__foot" });
    const closeBtn = el("button", { class: "icon-btn", type: "button", "aria-label": t("common.close"), html: icon("close") });
    const titleEl = el("h2", { class: "modal__title" }, title);
    const d = el("aside", { class: `drawer ${side === "left" ? "drawer--left" : ""}`, "aria-hidden": "true", "aria-label": title }, el("div", { class: "drawer__head" }, titleEl, closeBtn), body, footer ? foot : null);
    document.body.append(back, d);
    const api = {
      el: d,
      body,
      foot,
      titleEl,
      isOpen: false,
      open() {
        api.isOpen = true;
        d.classList.add("is-open");
        back.classList.add("is-open");
        d.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        onOpen && onOpen();
      },
      close() {
        api.isOpen = false;
        d.classList.remove("is-open");
        back.classList.remove("is-open");
        d.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        onClose && onClose();
      },
      toggle() {
        api.isOpen ? api.close() : api.open();
      }
    };
    closeBtn.addEventListener("click", api.close);
    back.addEventListener("click", api.close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && api.isOpen) api.close();
    });
    return api;
  }
  function initRipple() {
    document.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".btn, .ripple-host");
      if (!b || b.disabled) return;
      const r = b.getBoundingClientRect();
      const s = Math.max(r.width, r.height);
      const sp = el("span", { class: "ripple" });
      sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
      if (getComputedStyle(b).position === "static") b.style.position = "relative";
      b.append(sp);
      setTimeout(() => sp.remove(), 720);
    });
  }
  function initMagnetic(root = document) {
    if (!isFinePointer() || reducedMotion()) return;
    $$("[data-magnetic]", root).forEach((n) => {
      if (n.dataset.magInit) return;
      n.dataset.magInit = "1";
      n.addEventListener("pointermove", (e) => {
        const r = n.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.28;
        const y = (e.clientY - r.top - r.height / 2) * 0.35;
        n.style.transform = `translate(${x}px,${y}px)`;
      });
      n.addEventListener("pointerleave", () => {
        n.style.transition = "transform .6s var(--ease-spring)";
        n.style.transform = "";
        setTimeout(() => n.style.transition = "", 600);
      });
    });
  }
  function initTilt(root = document) {
    if (!isFinePointer() || reducedMotion()) return;
    $$("[data-tilt]", root).forEach((n) => {
      if (n.dataset.tiltInit) return;
      n.dataset.tiltInit = "1";
      n.addEventListener("pointermove", (e) => {
        const r = n.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        n.style.transform = `perspective(900px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateZ(0)`;
      });
      n.addEventListener("pointerleave", () => {
        n.style.transition = "transform .6s var(--ease)";
        n.style.transform = "";
        setTimeout(() => n.style.transition = "", 600);
      });
    });
  }
  var io;
  function initReveal(root = document) {
    const targets = $$("[data-reveal]:not(.is-in), [data-split]:not(.split-in)", root);
    $$("[data-stagger]", root).forEach((p) => Array.from(p.children).forEach((c, i) => {
      if (!c.style.getPropertyValue("--i")) c.style.setProperty("--i", i);
      if (!c.hasAttribute("data-reveal")) c.setAttribute("data-reveal", p.dataset.stagger || "up");
    }));
    const all = $$("[data-reveal]:not(.is-in), [data-split]:not(.split-in)", root);
    if (!("IntersectionObserver" in window) || reducedMotion()) {
      all.forEach((n) => n.classList.add("is-in", "split-in"));
      return;
    }
    io || (io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("is-in", "split-in");
        io.unobserve(en.target);
      }
    }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }));
    all.forEach((n) => io.observe(n));
    void targets;
  }
  function splitWords(root = document) {
    $$("[data-split]", root).forEach((n) => {
      if (n.dataset.splitDone) return;
      n.dataset.splitDone = "1";
      const text = n.textContent;
      n.setAttribute("aria-label", text);
      n.textContent = "";
      text.split(/(\s+)/).forEach((w, i) => {
        if (/^\s+$/.test(w)) return n.append(" ");
        const o = el("span", { class: "w", "aria-hidden": "true" }, el("span", { class: "w__i", style: `--wi:${i / 2}` }, w));
        n.append(o);
      });
    });
  }
  function initParallax(root = document) {
    if (reducedMotion()) return;
    const items = $$("[data-parallax]", root).map((n) => ({ n, f: parseFloat(n.dataset.parallax) || 0.15, vis: true }));
    if (!items.length) return;
    const io2 = new IntersectionObserver((es) => es.forEach((e) => {
      const it = items.find((i) => i.n === e.target);
      if (it) it.vis = e.isIntersecting;
    }));
    items.forEach((i) => io2.observe(i.n));
    const upd = throttleRaf(() => items.forEach((i) => {
      if (!i.vis) return;
      const r = i.n.getBoundingClientRect();
      const c = r.top + r.height / 2 - innerHeight / 2;
      i.n.style.transform = `translate3d(0,${(-c * i.f).toFixed(1)}px,0)`;
    }));
    addEventListener("scroll", upd, { passive: true });
    upd();
  }
  function initCounters(root = document) {
    const nodes = $$("[data-count]:not([data-counted])", root);
    if (!nodes.length) return;
    const run = (n) => {
      n.dataset.counted = "1";
      countTo(n, parseFloat(n.dataset.count), { suffix: n.dataset.suffix || "", decimals: Number(n.dataset.decimals || 0) });
    };
    if (!("IntersectionObserver" in window) || reducedMotion()) return nodes.forEach((n) => {
      n.textContent = Number(n.dataset.count).toLocaleString("en-IN") + (n.dataset.suffix || "");
    });
    const o = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) {
        run(e.target);
        o.unobserve(e.target);
      }
    }), { threshold: 0.4 });
    nodes.forEach((n) => o.observe(n));
  }
  function countTo(node, to, { dur = 1400, suffix = "", decimals = 0, prefix = "" } = {}) {
    const from = parseFloat(node.dataset.cur ?? "0") || 0;
    node.dataset.cur = to;
    if (reducedMotion()) {
      node.textContent = prefix + to.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      return;
    }
    const t0 = performance.now();
    (function tick(now) {
      const p = clamp((now - t0) / dur, 0, 1);
      const e = 1 - Math.pow(1 - p, 4);
      const v = from + (to - from) * e;
      node.textContent = prefix + v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  function initScrollProgress() {
    const bar = $(".scroll-progress") || document.body.appendChild(el("div", { class: "scroll-progress", "aria-hidden": "true" }));
    const upd = throttleRaf(() => {
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
    });
    addEventListener("scroll", upd, { passive: true });
    upd();
  }
  function initTabs(container, { onChange } = {}) {
    let ind = $(".tabs__indicator", container);
    if (!ind) {
      ind = el("i", { class: "tabs__indicator" });
      container.append(ind);
    }
    const tabs = () => $$(".tabs__tab", container);
    const place = (tab) => {
      if (!tab) return;
      ind.style.setProperty("--w", tab.offsetWidth + "px");
      ind.style.setProperty("--x", tab.offsetLeft + "px");
    };
    const select = (tab, fire2 = true) => {
      tabs().forEach((x) => {
        const on = x === tab;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-selected", on);
      });
      place(tab);
      container.scrollTo({ left: tab.offsetLeft - (container.clientWidth - tab.offsetWidth) / 2, behavior: reducedMotion() ? "auto" : "smooth" });
      fire2 && onChange && onChange(tab.dataset.id);
    };
    container.addEventListener("click", (e) => {
      const tab = e.target.closest(".tabs__tab");
      if (tab) select(tab);
    });
    const cur = () => tabs().find((x) => x.classList.contains("is-active")) || tabs()[0];
    addEventListener("resize", () => place(cur()));
    requestAnimationFrame(() => place(cur()));
    document.fonts && document.fonts.ready.then(() => place(cur()));
    return { select: (id) => {
      const tab = tabs().find((x) => x.dataset.id === id);
      tab && select(tab, false);
    }, refresh: () => place(cur()) };
  }
  function flip(container, mutate) {
    const first = new Map($$("[data-key]", container).map((n) => [n.dataset.key, n.getBoundingClientRect()]));
    mutate();
    if (reducedMotion()) return;
    $$("[data-key]", container).forEach((n, i) => {
      const f = first.get(n.dataset.key);
      const l = n.getBoundingClientRect();
      if (!f) {
        n.animate([{ opacity: 0, transform: "scale(.92) translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: Math.min(i * 22, 300), easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" });
        return;
      }
      const dx = f.left - l.left;
      const dy = f.top - l.top;
      if (!dx && !dy) return;
      n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" });
    });
  }
  function flyToCart(fromEl, toEl) {
    if (!fromEl || !toEl) return;
    const bump = () => {
      const b2 = $(".cart-badge", toEl) || toEl;
      b2.classList.remove("bounce");
      void b2.offsetWidth;
      b2.classList.add("bounce");
    };
    if (reducedMotion()) return bump();
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const s = 18;
    const dot = el("div", { class: "fly-clone" });
    dot.style.cssText = `left:${a.left + a.width / 2 - s / 2}px;top:${a.top + a.height / 2 - s / 2}px;width:${s}px;height:${s}px`;
    document.body.append(dot);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    dot.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy - 80}px) scale(1.3)`, offset: 0.45 }, { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0.8 }], { duration: 750, easing: "cubic-bezier(.5,0,.3,1)" }).onfinish = () => {
      dot.remove();
      bump();
    };
  }
  function confetti(n = 70) {
    if (reducedMotion()) return;
    const cols = ["#e1201a", "#ffffff", "#ff4d45", "#a8120e"];
    for (let i = 0; i < n; i++) {
      const c = el("i", { class: "confetti" });
      c.style.cssText = `left:${Math.random() * 100}vw;background:${cols[i % cols.length]};--dx:${(Math.random() - 0.5) * 240}px;--r:${Math.random() * 1080}deg;--t:${1.6 + Math.random() * 1.6}s;animation-delay:${Math.random() * 0.4}s;border-radius:${Math.random() > 0.5 ? "50%" : "2px"}`;
      document.body.append(c);
      setTimeout(() => c.remove(), 3800);
    }
  }
  var checkDrawSVG = (size = 96) => `<svg class="check-draw" width="${size}" height="${size}" viewBox="0 0 52 52" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg>`;
  var skeletonHTML = (n = 3, h = "120px") => Array.from({ length: n }, () => `<div class="skeleton" style="height:${h}"></div>`).join("");
  function emptyState({ icon: ic = "search", title = "", text = "", action = "" } = {}) {
    return `<div class="empty">${icon(ic)}<div class="empty__title">${title}</div><p>${text}</p>${action}</div>`;
  }
  function pageReady() {
    document.body.classList.add("page-enter");
  }
  function initCommonUI() {
    initRipple();
    initMagnetic();
    initTilt();
    splitWords();
    initReveal();
    initCounters();
    initParallax();
  }

  // js/layout.js
  var NAV = [
    { id: "home", key: "nav.home", href: "index.html" },
    { id: "menu", key: "nav.menu", href: "menu.html" },
    { id: "offers", key: "nav.offers", href: "index.html#offers" },
    { id: "gallery", key: "nav.gallery", href: "gallery.html" },
    { id: "about", key: "nav.about", href: "about.html" },
    { id: "contact", key: "nav.contact", href: "index.html#contact" }
  ];
  function mountPublicLayout({ active = "", preloader = true, nav = true, footer = true, floating = true } = {}) {
    const r = db.get("restaurant") || {};
    const phoneDigits = String(r.phone || "").replace(/\D/g, "");
    const root = document.body;
    root.classList.add("public");
    root.prepend(el("a", { class: "skip-link", href: "#main", "data-i18n": "common.skip" }, "Skip to content"));
    initScrollProgress();
    if (preloader && !session.get("bbc:preloaded") && !store.get("bbc:preloaded")) {
      session.set("bbc:preloaded", 1);
      store.set("bbc:preloaded", 1);
      const pre = el("div", { class: "preloader dark", "aria-hidden": "true", html: `<img class="preloader__logo" src="${url("assets/logo/logo.png")}" alt=""><div class="preloader__bar"></div>` });
      root.prepend(pre);
      const hide = () => {
        pre.classList.add("is-done");
        document.documentElement.classList.add("is-loaded");
        setTimeout(() => pre.remove(), 1200);
      };
      setTimeout(hide, 500);
    } else document.documentElement.classList.add("is-loaded");
    if (nav) {
      const links = NAV.map((n, i) => `<a class="nav__link ${n.id === active ? "is-active" : ""}" href="${url(n.href)}" data-i18n="${n.key}"></a>`).join("");
      const sheetLinks = NAV.map((n, i) => `<a class="sheet-link ${n.id === active ? "is-active" : ""}" style="--i:${i}" href="${url(n.href)}"><span data-i18n="${n.key}"></span></a>`).join("");
      const header = el("header", { class: "nav dark", html: `
      <div class="nav__inner">
        <a class="nav__brand" href="${url("index.html")}" aria-label="Billy Belly Chicken">
          <img src="${url("assets/logo/logo-mark-160.png")}" alt="" width="60" height="50"><span>Billy Belly<em>Chicken</em></span>
        </a>
        <nav class="nav__links" aria-label="Primary">${links}</nav>
        <div class="nav__actions">
          <span data-lang-mount></span>
          <a class="btn btn--primary btn--sm nav__cta" href="${url("parcel.html")}" data-magnetic>${icon("bag")}<span data-i18n="nav.parcel"></span></a>
          <button class="nav__burger" type="button" aria-expanded="false" aria-controls="nav-sheet" data-i18n-aria="nav.menuToggle"><i></i><i></i><i></i></button>
        </div>
      </div>` });
      const sheet = el("div", { class: "nav-sheet dark", id: "nav-sheet", html: `<nav aria-label="Mobile">${sheetLinks}</nav>
      <div class="stack" style="--stack:1rem"><a class="btn btn--primary btn--block btn--lg" href="${url("parcel.html")}">${icon("bag")}<span data-i18n="nav.parcel"></span></a>
      <a class="btn btn--ghost btn--block" href="tel:+91${phoneDigits}">${icon("phone")}<span>${r.phone || ""}</span></a></div>` });
      root.prepend(sheet);
      root.prepend(header);
      mountLangToggle($("[data-lang-mount]", header));
      const burger = $(".nav__burger", header);
      const toggle = (open) => {
        burger.setAttribute("aria-expanded", open);
        sheet.classList.toggle("is-open", open);
        root.style.overflow = open ? "hidden" : "";
      };
      burger.addEventListener("click", () => toggle(burger.getAttribute("aria-expanded") !== "true"));
      $$("a", sheet).forEach((a) => a.addEventListener("click", () => toggle(false)));
      const sc = throttleRaf(() => header.classList.toggle("is-scrolled", scrollY > 24));
      addEventListener("scroll", sc, { passive: true });
      sc();
    }
    if (footer) {
      const f = el("footer", { class: "footer dark", html: `
      <div class="footer__flame divider-flame divider-flame--flip" aria-hidden="true"></div>
      <div class="container">
        <div class="footer__big" aria-hidden="true">Billy Belly Chicken</div>
        <div class="footer__grid">
          <div class="footer__brand"><img src="${url("assets/logo/logo-420.png")}" alt="Billy Belly Chicken logo" loading="lazy">
            <p class="text-muted" data-js="tagline"></p>
            <div class="footer__social">
              <a href="${r.instagramUrl || "#"}" target="_blank" rel="noopener" aria-label="Instagram">${icon("instagram")}</a>
              <a href="https://wa.me/91${phoneDigits}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon("whatsapp")}</a>
              <a href="mailto:${r.email || ""}" aria-label="Email">${icon("mail")}</a>
            </div></div>
          <div><h4 data-i18n="footer.explore"></h4><ul>
            <li><a href="${url("menu.html")}" data-i18n="nav.menu"></a></li><li><a href="${url("index.html#offers")}" data-i18n="nav.offers"></a></li>
            <li><a href="${url("gallery.html")}" data-i18n="nav.gallery"></a></li><li><a href="${url("about.html")}" data-i18n="nav.about"></a></li>
            <li><a href="${url("review.html")}" data-i18n="nav.review"></a></li></ul></div>
          <div><h4 data-i18n="footer.visit"></h4><ul class="text-muted">
            <li data-js="address"></li><li><span data-i18n="footer.hours"></span>: <span data-js="hours"></span></li>
            <li><a href="${r.mapUrl || "#"}" target="_blank" rel="noopener" class="link" data-i18n="footer.directions"></a></li></ul></div>
          <div><h4 data-i18n="footer.talk"></h4><ul>
            <li><a href="tel:+91${phoneDigits}">${r.phone || ""}</a></li><li><a href="mailto:${r.email || ""}">${r.email || ""}</a></li>
            <li><a href="https://wa.me/91${phoneDigits}" target="_blank" rel="noopener">WhatsApp</a></li>
            <li class="footer-staff"><a href="${url("waiter/login.html")}" data-i18n="footer.staff"></a> \xB7 <a href="${url("admin/login.html")}" data-i18n="footer.admin"></a></li></ul></div>
        </div>
        <div class="footer__bar"><span>\xA9 <span data-js="year"></span> Billy Belly Chicken. <span data-i18n="footer.rights"></span></span><span data-i18n="footer.payNote"></span></div>
      </div>` });
      root.append(f);
      const fill = () => {
        $('[data-js="tagline"]', f).textContent = tr(r.tagline);
        $('[data-js="address"]', f).textContent = tr(r.address);
        $('[data-js="hours"]', f).textContent = tr(r.hours);
        $('[data-js="year"]', f).textContent = (/* @__PURE__ */ new Date()).getFullYear();
      };
      fill();
      onLangChange(fill);
    }
    if (floating) {
      root.append(el("div", { class: "float-actions no-print", html: `<a href="https://wa.me/91${phoneDigits}" target="_blank" rel="noopener" data-i18n-aria="footer.whatsapp">${icon("whatsapp")}</a><a href="tel:+91${phoneDigits}" data-i18n-aria="footer.call">${icon("phone")}</a>` }));
    }
    if (!$("main#main")) {
      const m = $("main");
      if (m) m.id = "main";
    }
    hydrateIcons();
    applyI18n();
    initCommonUI();
    pageReady();
    onLangChange(() => applyI18n());
  }

  // js/orderSync.js
  var CH = "bbc-orders";
  var KEY = "bbc:evt";
  var bc2 = null;
  try {
    bc2 = new BroadcastChannel(CH);
  } catch {
  }
  var subs = /* @__PURE__ */ new Set();
  function fire(msg) {
    subs.forEach((cb) => {
      try {
        cb(msg);
      } catch (e) {
        console.error(e);
      }
    });
  }
  if (bc2) bc2.onmessage = (e) => fire({ ...e.data, remote: true });
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue && !bc2) {
      try {
        fire({ ...JSON.parse(e.newValue), remote: true });
      } catch {
      }
    }
  });
  function publish(type, payload = {}) {
    const msg = { type, payload, at: Date.now() };
    if (bc2) bc2.postMessage(msg);
    else {
      try {
        localStorage.setItem(KEY, JSON.stringify(msg));
      } catch {
      }
    }
    fire({ ...msg, remote: false });
  }
  function subscribe(typeOrCb, maybeCb) {
    const cb = typeof typeOrCb === "function" ? typeOrCb : (m) => {
      if (m.type === typeOrCb) maybeCb(m);
    };
    subs.add(cb);
    return () => subs.delete(cb);
  }

  // js/orderService.js
  var DINE_FLOW = ["placed", "confirmed", "served", "completed"];
  var round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  function resolveItem(id) {
    const m = db.get("menu", id);
    if (m) return m;
    const sp = db.get("specials", id);
    if (sp) return { id: sp.id, name: sp.title, description: sp.description, price: sp.price, image: sp.image, isVeg: !!sp.isVeg, available: sp.active !== false, categoryId: "special", isSpecial: true };
    return null;
  }
  function activeOffers(on = /* @__PURE__ */ new Date()) {
    const d = todayStr(on);
    return db.list("offers", (o) => o.active !== false && (!o.validFrom || o.validFrom <= d) && (!o.validTo || o.validTo >= d));
  }
  function offerApplies(offer, item) {
    const ids = offer.itemIds || [];
    const cats = offer.categoryIds || [];
    if (!ids.length && !cats.length) return true;
    return ids.includes(item.id) || cats.includes(item.categoryId);
  }
  function priceLines(lines) {
    const settings = db.get("settings") || {};
    const offers = activeOffers();
    const taxPct = Number(settings.taxPercent ?? 5);
    const items = [];
    let subtotal = 0;
    let discount = 0;
    for (const l of lines) {
      const it = resolveItem(l.itemId);
      if (!it) continue;
      const qty = Math.max(1, Number(l.qty) || 1);
      const lineTotal = it.price * qty;
      let best = { amt: 0, id: null };
      if (!it.isSpecial) for (const o of offers) {
        if (!offerApplies(o, it)) continue;
        const amt = o.discountType === "flat" ? Math.min(lineTotal, o.value * qty) : lineTotal * (o.value / 100);
        if (amt > best.amt) best = { amt, id: o.id };
      }
      subtotal += lineTotal;
      discount += best.amt;
      items.push({ itemId: it.id, name: it.name, price: it.price, qty, note: l.note || "", isVeg: !!it.isVeg, image: it.image, lineTotal, lineDiscount: round2(best.amt), offerId: best.id });
    }
    subtotal = round2(subtotal);
    discount = round2(discount);
    const tax = round2((subtotal - discount) * taxPct / 100);
    return { items, subtotal, discount, tax, taxPct, total: round2(subtotal - discount + tax) };
  }
  function isOpenNow(settings = db.get("settings")) {
    const t2 = settings.timings || {};
    const [oh, om] = (t2.open || "11:00").split(":").map(Number);
    const [ch, cm] = (t2.close || "22:00").split(":").map(Number);
    const n = /* @__PURE__ */ new Date();
    const mins = n.getHours() * 60 + n.getMinutes();
    return mins >= oh * 60 + om && mins < ch * 60 + cm;
  }
  function acceptingStatus() {
    const s = db.get("settings");
    if (s.acceptingOrders === false) return { ok: false, code: "SWITCH_OFF" };
    if (s.enforceTimings && !isOpenNow(s)) return { ok: false, code: "OUTSIDE_HOURS" };
    return { ok: true };
  }
  var getTableByNumber = (no) => db.find("tables", (t2) => String(t2.number) === String(no) && t2.active !== false);
  var getSession = (tableNo) => db.find("tableSessions", (s) => String(s.tableNo) === String(tableNo) && !s.closedAt);
  function ensureSession(tableNo) {
    let s = getSession(tableNo);
    if (!s) s = db.create("tableSessions", { tableNo: Number(tableNo), token: uid("tk"), openedAt: (/* @__PURE__ */ new Date()).toISOString(), closedAt: null, guests: 0, callWaiter: null, billRequested: null, payment: null });
    return s;
  }
  var deviceToken = (tableNo) => session.get(`bbc:tk:${tableNo}`);
  function claimSession(tableNo) {
    const s = ensureSession(tableNo);
    session.set(`bbc:tk:${tableNo}`, s.token);
    return s;
  }
  function tokenValid(tableNo) {
    const s = getSession(tableNo);
    return !!s && deviceToken(tableNo) === s.token;
  }
  var cooldownKey = (k) => `bbc:last:${k}`;
  function cooldownLeft(key) {
    const secs = Number((db.get("settings") || {}).orderCooldownSeconds ?? 20);
    const last = store.get(cooldownKey(key), 0);
    return Math.max(0, Math.ceil((last + secs * 1e3 - Date.now()) / 1e3));
  }
  var sigOf = (lines) => lines.map((l) => `${l.itemId}x${l.qty}`).sort().join("|");
  function isDuplicate(key, lines) {
    const prev = store.get(`bbc:sig:${key}`);
    return !!prev && prev.sig === sigOf(lines) && Date.now() - prev.at < 3 * 6e4;
  }
  function validateLines(lines) {
    if (!lines || !lines.length) {
      const e = new Error("EMPTY");
      e.code = "EMPTY";
      throw e;
    }
    for (const l of lines) {
      const it = resolveItem(l.itemId);
      if (!it || it.available === false) {
        const e = new Error("SOLD_OUT");
        e.code = "SOLD_OUT";
        e.itemId = l.itemId;
        throw e;
      }
    }
  }
  function fail(code, extra = {}) {
    const e = new Error(code);
    e.code = code;
    Object.assign(e, extra);
    throw e;
  }
  function placeDineIn({ tableNo, customer = {}, lines, force = false }) {
    const st = acceptingStatus();
    if (!st.ok) fail(st.code);
    const table = getTableByNumber(tableNo);
    if (!table) fail("BAD_TABLE");
    if (!tokenValid(tableNo)) fail("BAD_TOKEN");
    const key = `table-${tableNo}`;
    const left = cooldownLeft(key);
    if (left > 0) fail("COOLDOWN", { seconds: left });
    validateLines(lines);
    if (!force && isDuplicate(key, lines)) fail("DUPLICATE");
    const sess = getSession(tableNo);
    const priced = priceLines(lines);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const order = db.create("orders", {
      type: "dine-in",
      tableNo: Number(tableNo),
      sessionId: sess.id,
      parcelToken: null,
      customer: { name: customer.name || "", guests: Number(customer.guests) || 1, phone: "" },
      items: priced.items.map(({ itemId, name, price, qty, note, isVeg }) => ({ itemId, name, price, qty, note, isVeg })),
      status: "placed",
      statusHistory: [{ status: "placed", at: now, by: "customer" }],
      waiterId: table.waiterId || null,
      subtotal: priced.subtotal,
      discount: priced.discount,
      tax: priced.tax,
      total: priced.total,
      createdAt: now,
      payment: null
    });
    db.update("tableSessions", sess.id, { guests: Math.max(sess.guests || 0, Number(customer.guests) || 1) });
    store.set(cooldownKey(key), Date.now());
    store.set(`bbc:sig:${key}`, { sig: sigOf(lines), at: Date.now() });
    publish("order:new", { orderId: order.id, tableNo: Number(tableNo), waiterId: order.waiterId });
    return order;
  }
  function setStatus(orderId, status, { by = "staff", waiterId, reason } = {}) {
    const o = db.get("orders", orderId);
    if (!o) fail("NOT_FOUND");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const patch = { status, statusHistory: [...o.statusHistory, { status, at: now, by, ...reason ? { reason } : {} }] };
    if (status === "cancelled") patch.cancelReason = reason || "";
    if (waiterId && !o.waiterId) patch.waiterId = waiterId;
    const out = db.update("orders", orderId, patch);
    publish("order:status", { orderId, status, tableNo: o.tableNo, token: o.parcelToken });
    return out;
  }
  function cancelByCustomer(orderId) {
    const o = db.get("orders", orderId);
    if (!o) fail("NOT_FOUND");
    if (o.status !== "placed") fail("NOT_CANCELLABLE");
    return setStatus(orderId, "cancelled", { by: "customer", reason: "Cancelled by customer" });
  }
  var sessionOrders = (tableNo) => {
    const s = getSession(tableNo);
    return s ? db.list("orders", (o) => o.sessionId === s.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
  };
  function tabForTable(tableNo) {
    const orders = sessionOrders(tableNo);
    const live = orders.filter((o) => o.status !== "cancelled");
    const sum = (k) => round2(live.reduce((a, o) => a + (o[k] || 0), 0));
    return { orders, live, subtotal: sum("subtotal"), discount: sum("discount"), tax: sum("tax"), total: sum("total") };
  }
  function callWaiter(tableNo) {
    const s = ensureSession(tableNo);
    const at = (/* @__PURE__ */ new Date()).toISOString();
    db.update("tableSessions", s.id, { callWaiter: at });
    const t2 = getTableByNumber(tableNo);
    publish("alert:call", { tableNo: Number(tableNo), waiterId: t2 && t2.waiterId });
    return at;
  }
  function requestBill(tableNo) {
    const s = ensureSession(tableNo);
    const at = (/* @__PURE__ */ new Date()).toISOString();
    db.update("tableSessions", s.id, { billRequested: at });
    const t2 = getTableByNumber(tableNo);
    publish("alert:bill", { tableNo: Number(tableNo), waiterId: t2 && t2.waiterId });
    return at;
  }

  // js/cart.js
  function createCart(key) {
    const K = `bbc:cart:${key}`;
    let lines = store.get(K, []);
    const subs2 = /* @__PURE__ */ new Set();
    const save = () => {
      store.set(K, lines);
      subs2.forEach((cb) => cb(api));
    };
    const api = {
      key,
      lines: () => lines.map((l) => ({ ...l })),
      count: () => lines.reduce((n, l) => n + l.qty, 0),
      qtyOf: (id) => (lines.find((l) => l.itemId === id) || {}).qty || 0,
      /** add(itemId, qty=1, note='') - ignores sold-out / unknown items */
      add(itemId, qty = 1, note = "") {
        const it = resolveItem(itemId);
        if (!it || it.available === false) return false;
        const l = lines.find((x) => x.itemId === itemId);
        if (l) {
          l.qty = Math.min(99, l.qty + qty);
          if (note) l.note = note;
        } else lines.push({ itemId, qty, note });
        save();
        return true;
      },
      setQty(itemId, qty) {
        const l = lines.find((x) => x.itemId === itemId);
        if (!l) return;
        if (qty <= 0) lines = lines.filter((x) => x !== l);
        else l.qty = Math.min(99, qty);
        save();
      },
      setNote(itemId, note) {
        const l = lines.find((x) => x.itemId === itemId);
        if (l) {
          l.note = note;
          save();
        }
      },
      remove(itemId) {
        lines = lines.filter((x) => x.itemId !== itemId);
        save();
      },
      clear() {
        lines = [];
        save();
      },
      /** drop lines that became sold-out/deleted; returns removed ids */
      prune() {
        const bad = lines.filter((l) => {
          const it = resolveItem(l.itemId);
          return !it || it.available === false;
        }).map((l) => l.itemId);
        if (bad.length) {
          lines = lines.filter((l) => !bad.includes(l.itemId));
          save();
        }
        return bad;
      },
      pricing: () => priceLines(lines),
      onChange(cb) {
        subs2.add(cb);
        return () => subs2.delete(cb);
      }
    };
    return api;
  }

  // js/components/menuBrowser.js
  function createMenuBrowser({ container, mode = "browse", cart = null, onAdd = null }) {
    const st = { cat: "all", q: "", diet: "all", spice: "all", sort: "default", chef: false, best: false };
    const ordering = mode === "order" && cart;
    let tabsApi = null;
    container.innerHTML = `
    <div class="mb__bar">
      <div class="mb__tools">
        <label class="input-group mb__search">${icon("search")}<input class="input" type="search" data-i18n-placeholder="menu.search" autocomplete="off" aria-label="${t("menu.search")}"></label>
        <div class="chip-row mb__chips" role="group" aria-label="${t("menu.filters")}">
          <button type="button" class="chip" data-diet="all" aria-pressed="true" data-i18n="menu.all"></button>
          <button type="button" class="chip" data-diet="veg" aria-pressed="false">${vegMark(true)}<span data-i18n="food.veg"></span></button>
          <button type="button" class="chip" data-diet="non" aria-pressed="false">${vegMark(false)}<span data-i18n="food.nonveg"></span></button>
          <button type="button" class="chip" data-flag="chef" aria-pressed="false">${icon("chef")}<span data-i18n="tag.chefs-pick"></span></button>
          <button type="button" class="chip" data-flag="best" aria-pressed="false">${icon("award")}<span data-i18n="tag.bestseller"></span></button>
        </div>
        <div class="mb__selects">
          <select class="select" data-spice aria-label="${t("menu.spice")}"><option value="all" data-i18n="menu.anySpice"></option><option value="0" data-i18n="food.spice.0"></option><option value="1" data-i18n="food.spice.1"></option><option value="2" data-i18n="food.spice.2"></option><option value="3" data-i18n="food.spice.3"></option></select>
          <select class="select" data-sort aria-label="${t("menu.sort")}"><option value="default" data-i18n="menu.sortDefault"></option><option value="asc" data-i18n="menu.sortAsc"></option><option value="desc" data-i18n="menu.sortDesc"></option></select>
        </div>
      </div>
      <div class="tabs mb__tabs" role="tablist" aria-label="${t("menu.categories")}"></div>
    </div>
    <div class="mb__special" hidden></div>
    <div class="mb__grid" aria-live="polite">${skeletonHTML(6, "300px")}</div>
    <div class="mb__empty" hidden></div>`;
    const $q = (s) => container.querySelector(s);
    const grid = $q(".mb__grid");
    const tabsEl = $q(".mb__tabs");
    const specialEl = $q(".mb__special");
    const emptyEl = $q(".mb__empty");
    const cats = () => db.list("categories", (c) => c.active !== false).sort((a, b) => a.order - b.order);
    function drawTabs() {
      tabsEl.innerHTML = [{ id: "all", name: { en: "All", ta: "\u0B85\u0BA9\u0BC8\u0BA4\u0BCD\u0BA4\u0BC1\u0BAE\u0BCD" } }, ...cats()].map((c) => `<button type="button" role="tab" class="tabs__tab ${c.id === st.cat ? "is-active" : ""}" data-id="${c.id}" aria-selected="${c.id === st.cat}">${esc(tr(c.name))}</button>`).join("");
      tabsApi = initTabs(tabsEl, { onChange: (id) => {
        st.cat = id;
        paint(true);
      } });
      tabsApi.select(st.cat);
    }
    function offerInfo(item) {
      const p = priceLines([{ itemId: item.id, qty: 1 }]);
      const l = p.items[0];
      return l && l.lineDiscount > 0 ? { now: item.price - l.lineDiscount, off: l.lineDiscount } : null;
    }
    function visible() {
      let list = db.list("menu");
      if (st.cat !== "all") list = list.filter((m) => m.categoryId === st.cat);
      if (st.diet === "veg") list = list.filter((m) => m.isVeg);
      if (st.diet === "non") list = list.filter((m) => !m.isVeg);
      if (st.spice !== "all") list = list.filter((m) => m.spiceLevel === Number(st.spice));
      if (st.chef) list = list.filter((m) => (m.tags || []).includes("chefs-pick"));
      if (st.best) list = list.filter((m) => (m.tags || []).includes("bestseller"));
      const q = st.q.trim().toLowerCase();
      if (q) list = list.filter((m) => `${m.name.en} ${m.name.ta} ${m.description.en} ${m.description.ta}`.toLowerCase().includes(q));
      const catOrder = Object.fromEntries(cats().map((c, i) => [c.id, i]));
      list.sort((a, b) => st.sort === "asc" ? a.price - b.price : st.sort === "desc" ? b.price - a.price : catOrder[a.categoryId] - catOrder[b.categoryId] || a.order - b.order);
      return list;
    }
    function cardHTML(m) {
      const o = offerInfo(m);
      const sold = m.available === false;
      const qty = ordering ? cart.qtyOf(m.id) : 0;
      const tags = (m.tags || []).map((g) => `<span class="badge ${g === "new" ? "badge--red" : ""}">${esc(t("tag." + g))}</span>`).join("");
      const action = !ordering ? "" : sold ? `<span class="badge">${t("food.soldOut")}</span>` : qty ? `<div class="stepper" data-stepper><button type="button" data-dec aria-label="-">${icon("minus")}</button><span class="stepper__val">${qty}</span><button type="button" data-inc aria-label="+">${icon("plus")}</button></div>` : `<button type="button" class="btn btn--primary btn--sm" data-add>${icon("plus")}<span>${t("food.add")}</span></button>`;
      return `<article class="mcard ${sold ? "is-sold" : ""}" data-key="${m.id}" data-id="${m.id}" ${sold ? "" : "data-tilt"}>
      <div class="media mcard__media"><img src="${imgSrc(m.image)}" alt="${esc(tr(m.name))}" loading="lazy" width="800" height="600">
        <div class="mcard__tags">${tags}</div>${o ? `<span class="mcard__off badge badge--red">${t("menu.save", { n: money(o.off) })}</span>` : ""}${sold ? `<div class="mcard__sold"><span>${t("food.soldOut")}</span></div>` : ""}</div>
      <div class="mcard__body"><div class="mcard__top">${vegMark(m.isVeg)}<h3 class="mcard__name">${esc(tr(m.name))}</h3></div>
        <p class="mcard__desc">${esc(tr(m.description))}</p>
        <div class="mcard__foot"><div class="mcard__price"><span class="price" data-cur="\u20B9">${o ? o.now : m.price}</span>${o ? `<s>${money(m.price)}</s>` : ""}${spiceHTML(m.spiceLevel)}</div>${action}</div></div></article>`;
    }
    function paint(animate) {
      const list = visible();
      const run = () => {
        grid.innerHTML = list.map(cardHTML).join("");
        emptyEl.hidden = list.length > 0;
        grid.hidden = !list.length;
        if (!list.length) emptyEl.innerHTML = emptyState({ icon: "search", title: t("common.noResults"), text: t("common.noResultsHint") });
        initTilt(grid);
      };
      animate && grid.children.length ? flip(grid, run) : run();
    }
    function drawSpecial() {
      const sp = db.list("specials", (s) => s.active !== false).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
      if (!sp) {
        specialEl.hidden = true;
        return;
      }
      const sold = false;
      const qty = ordering ? cart.qtyOf(sp.id) : 0;
      specialEl.hidden = false;
      specialEl.innerHTML = `<div class="mspecial dark"><img src="${imgSrc(sp.image)}" alt="" loading="lazy"><div class="mspecial__txt"><span class="badge badge--red badge--live">${t("menu.todaySpecial")}</span><h3 class="display display--lg">${esc(tr(sp.title))}</h3><p class="text-muted">${esc(tr(sp.description))}</p>
      <div class="mspecial__foot"><span class="price" data-cur="\u20B9">${sp.price}</span>${sp.originalPrice ? `<s>${money(sp.originalPrice)}</s>` : ""}${ordering && !sold ? qty ? `<div class="stepper" data-stepper data-sp="${sp.id}"><button type="button" data-dec>${icon("minus")}</button><span class="stepper__val">${qty}</span><button type="button" data-inc>${icon("plus")}</button></div>` : `<button type="button" class="btn btn--primary" data-add data-sp="${sp.id}">${icon("plus")}<span>${t("food.add")}</span></button>` : ""}</div></div></div>`;
    }
    const onSearch = debounce((v) => {
      st.q = v;
      paint(true);
    }, 180);
    $q(".mb__search input").addEventListener("input", (e) => onSearch(e.target.value));
    container.querySelectorAll("[data-diet]").forEach((b) => b.addEventListener("click", () => {
      st.diet = b.dataset.diet;
      container.querySelectorAll("[data-diet]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      container.querySelectorAll("[data-diet]").forEach((x) => x.classList.toggle("is-active", x === b));
      paint(true);
    }));
    container.querySelectorAll("[data-flag]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.flag;
      st[k] = !st[k];
      b.setAttribute("aria-pressed", st[k]);
      b.classList.toggle("is-active", st[k]);
      paint(true);
    }));
    $q("[data-spice]").addEventListener("change", (e) => {
      st.spice = e.target.value;
      paint(true);
    });
    $q("[data-sort]").addEventListener("change", (e) => {
      st.sort = e.target.value;
      paint(true);
    });
    container.querySelector('[data-diet="all"]').classList.add("is-active");
    const act = (e) => {
      if (!ordering) return;
      const btn = e.target.closest("[data-add],[data-inc],[data-dec]");
      if (!btn) return;
      const host = btn.closest("[data-id],[data-sp]");
      const id = host.dataset.id || host.dataset.sp || btn.dataset.sp;
      const item = resolveItem(id);
      if (!item) return;
      if (btn.hasAttribute("data-dec")) cart.setQty(id, cart.qtyOf(id) - 1);
      else {
        if (!cart.add(id, 1)) return;
        onAdd && onAdd(item, btn);
      }
      refreshQty();
    };
    container.addEventListener("click", act);
    function refreshQty() {
      container.querySelectorAll(".mcard").forEach((card) => {
        const m = db.get("menu", card.dataset.id);
        if (!m) return;
        const foot = card.querySelector(".mcard__foot");
        const old = foot.lastElementChild;
        const tmp = el("div", { html: cardHTML(m) });
        const nw = tmp.querySelector(".mcard__foot").lastElementChild;
        if (old && nw && old.outerHTML !== nw.outerHTML) {
          old.replaceWith(nw);
          const v = nw.querySelector(".stepper__val");
          v && v.classList.add("bump");
        }
      });
      drawSpecial();
    }
    function render() {
      drawTabs();
      drawSpecial();
      paint(false);
      applyText();
      initReveal(container);
    }
    const applyText = () => {
      container.querySelectorAll("[data-i18n]").forEach((n) => {
        n.textContent = t(n.dataset.i18n);
      });
      container.querySelectorAll("[data-i18n-placeholder]").forEach((n) => n.setAttribute("placeholder", t(n.dataset.i18nPlaceholder)));
    };
    const off = onLangChange(render);
    const offDb = db.onChange((c) => {
      if (["menu", "offers", "specials", "categories"].includes(c)) {
        drawTabs();
        drawSpecial();
        paint(false);
      }
    });
    setTimeout(render, 450);
    return { render, refresh: refreshQty, destroy() {
      off();
      offDb();
    } };
  }

  // js/pages/__entry_order.js
  (async () => {
    await init();
    await initI18n(["menu", "order"]);
    mountPublicLayout({ active: "", footer: false, floating: false, preloader: false });
    hydrateIcons();
    const settings = db.get("settings");
    setCurrency(settings.currency);
    const tableNo = Number(param("table"));
    const table = getTableByNumber(tableNo);
    const state = $("#state");
    const showState = (icn, title, text, extra = "") => {
      $("#view-menu").hidden = true;
      $("#view-orders").hidden = true;
      $(".bottomnav").hidden = true;
      $("#cartbar").hidden = true;
      state.hidden = false;
      state.innerHTML = `${icon(icn, { cls: "big" })}<h2>${title}</h2><p class="text-muted">${text}</p>${extra}`;
    };
    if (!table) {
      $("#table-no").textContent = "?";
      showState("alert", t("order.invalidTitle"), t("order.invalidText"), `<a class="btn btn--primary" href="menu.html">${t("order.backMenu")}</a>`);
    } else if (!acceptingStatus().ok) {
      $("#table-no").textContent = table.number;
      const s = acceptingStatus();
      const tm = settings.timings || {};
      showState("clock", t("order.closedTitle"), s.code === "OUTSIDE_HOURS" ? t("order.closedHours", { open: tm.open, close: tm.close }) : t("order.closedText"), `<a class="btn btn--ghost" href="menu.html">${t("order.backMenu")}</a>`);
    } else start();
    function start() {
      $("#table-no").textContent = table.number;
      $("#table-area").textContent = `${table.area} \xB7 ${table.seats} ${t("order.seats")}`;
      claimSession(tableNo);
      const cart = createCart(`table-${tableNo}`);
      cart.prune();
      let view = "menu";
      const browser = createMenuBrowser({ container: $("#menu-root"), mode: "order", cart, onAdd: (item, src) => {
        flyToCart(src, $("#open-cart"));
      } });
      function paintBar() {
        const n = cart.count();
        const bar = $("#cartbar");
        bar.hidden = n === 0 || view !== "menu";
        $("#cart-count").textContent = n;
        $("#cart-total").textContent = money(cart.pricing().total);
      }
      cart.onChange(() => {
        paintBar();
        if (drawer.isOpen) paintCart();
      });
      const drawer = createDrawer({ title: t("order.cart") });
      let placing = false;
      let cdTimer = null;
      function paintCart() {
        const p = cart.pricing();
        drawer.titleEl.textContent = t("order.cart");
        if (!p.items.length) {
          drawer.body.innerHTML = `<div class="empty">${icon("cart")}<p>${t("order.cartEmpty")}</p></div>`;
          drawer.foot.innerHTML = "";
          return;
        }
        const keep = { name: $("#cust-name", drawer.body)?.value || store.get("bbc:custName", ""), guests: $("#cust-guests", drawer.body)?.value || store.get("bbc:custGuests", 2) };
        drawer.body.innerHTML = p.items.map((l) => `<div class="cart-line" data-id="${l.itemId}"><div class="cart-line__top"><img src="${imgSrc(l.image)}" alt=""><div class="cart-line__name">${esc(tr(l.name))}${l.lineDiscount ? `<div class="text-faint" style="font-size:var(--fs-xs)">${t("order.offer")}: -${money(l.lineDiscount)}</div>` : ""}</div><div class="cart-line__price">${money(l.lineTotal)}</div></div>
      <div class="cart-line__bar"><div class="stepper"><button type="button" data-dec aria-label="-">${icon("minus")}</button><span class="stepper__val">${l.qty}</span><button type="button" data-inc aria-label="+">${icon("plus")}</button></div><button type="button" class="btn btn--sm btn--ghost" data-rm>${icon("trash")}<span>${t("order.remove")}</span></button></div>
      <input class="input" data-note maxlength="80" placeholder="${esc(t("order.notePh"))}" value="${esc(cart.lines().find((x) => x.itemId === l.itemId)?.note || "")}" aria-label="${esc(t("order.notePh"))}"></div>`).join("") + `<div class="cart-form"><label class="field"><span class="field__label">${t("order.nameLbl")}</span><input class="input" id="cust-name" maxlength="40" value="${esc(keep.name)}"></label><label class="field"><span class="field__label">${t("order.guestsLbl")}</span><input class="input" id="cust-guests" type="number" min="1" max="20" value="${keep.guests}"></label></div>
      <div class="cart-sum"><div class="kv"><span>${t("order.subtotal")}</span><span>${money(p.subtotal)}</span></div>${p.discount ? `<div class="kv"><span>${t("order.offer")}</span><span>-${money(p.discount)}</span></div>` : ""}<div class="kv"><span>${esc(settings.taxName || "GST")} (${p.taxPct}%)</span><span>${money(p.tax)}</span></div><div class="kv kv--total"><span>${t("order.total")}</span><span>${money(p.total)}</span></div></div>
      <div class="bill__pay">${icon("money")}<span>${t("order.payAtCounter")}</span></div>`;
        drawer.foot.innerHTML = `<button type="button" class="btn btn--primary btn--lg btn--block" id="place">${icon("check")}<span>${t("order.place")}</span></button>`;
        updatePlaceBtn();
      }
      function updatePlaceBtn() {
        const b = $("#place", drawer.foot);
        if (!b) return;
        clearInterval(cdTimer);
        const tick = () => {
          const left = cooldownLeft(`table-${tableNo}`);
          b.disabled = left > 0 || placing;
          $("span", b).textContent = left > 0 ? t("order.wait", { n: left }) : placing ? t("order.placing") : t("order.place");
          if (left <= 0) clearInterval(cdTimer);
        };
        tick();
        cdTimer = setInterval(tick, 500);
      }
      drawer.body.addEventListener("click", (e) => {
        const line = e.target.closest(".cart-line");
        if (!line) return;
        const id = line.dataset.id;
        const q = cart.qtyOf(id);
        if (e.target.closest("[data-inc]")) cart.setQty(id, q + 1);
        else if (e.target.closest("[data-dec]")) cart.setQty(id, q - 1);
        else if (e.target.closest("[data-rm]")) cart.remove(id);
        browser.refresh();
      });
      drawer.body.addEventListener("change", (e) => {
        if (e.target.matches("[data-note]")) cart.setNote(e.target.closest(".cart-line").dataset.id, e.target.value.trim());
      });
      $("#open-cart").addEventListener("click", () => {
        paintCart();
        drawer.open();
      });
      async function place(force = false) {
        if (placing) return;
        const name = ($("#cust-name", drawer.body)?.value || "").trim();
        const guests = Number($("#cust-guests", drawer.body)?.value) || 1;
        $$("[data-note]", drawer.body).forEach((n) => cart.setNote(n.closest(".cart-line").dataset.id, n.value.trim()));
        store.set("bbc:custName", name);
        store.set("bbc:custGuests", guests);
        placing = true;
        updatePlaceBtn();
        await new Promise((r) => setTimeout(r, 450));
        try {
          const order = placeDineIn({ tableNo, customer: { name, guests }, lines: cart.lines(), force });
          cart.clear();
          drawer.close();
          browser.refresh();
          placing = false;
          setView("orders");
          showConfirm(order);
        } catch (e) {
          placing = false;
          if (e.code === "DUPLICATE") {
            const ok = await confirmDialog({ title: t("order.dupTitle"), message: t("order.dupText"), confirmText: t("order.sendAgain") });
            if (ok) return place(true);
          } else if (e.code === "COOLDOWN") toast(t("order.cooldown", { n: e.seconds }), { type: "warn" });
          else if (e.code === "SOLD_OUT") {
            cart.prune();
            browser.refresh();
            toast(t("order.soldOut"), { type: "warn" });
          } else if (e.code === "EMPTY") toast(t("order.emptyCart"), { type: "warn" });
          else if (e.code === "BAD_TOKEN") {
            drawer.close();
            badToken();
          } else if (e.code === "SWITCH_OFF" || e.code === "OUTSIDE_HOURS") location.reload();
          else toast(t("common.error"), { type: "error" });
          updatePlaceBtn();
        }
      }
      drawer.foot.addEventListener("click", (e) => {
        if (e.target.closest("#place")) place();
      });
      function badToken() {
        const m = openModal({ title: t("order.badToken"), size: "sm", body: `<p class="text-muted">${t("order.badTokenText")}</p>`, footer: [el("button", { class: "btn btn--primary", type: "button", onclick: () => {
          claimSession(tableNo);
          m.close();
          toast(t("common.ok"));
        } }, t("order.newSession"))] });
      }
      function showConfirm(order) {
        const m = openModal({ size: "sm", dismissible: true, body: `<div class="confirm-pop">${checkDrawSVG(96)}<h2 class="display display--lg">${t("order.placedTitle")}</h2><div class="confirm-pop__id">${order.id}</div><p class="text-muted">${t("order.table")} ${tableNo} \xB7 ${t("order.placedText")}</p></div>`, footer: [el("button", { class: "btn btn--primary", type: "button", onclick: () => m.close() }, t("order.viewOrders"))] });
        confetti(80);
      }
      const FLOW = DINE_FLOW;
      const STEP_ICO = { placed: "receipt", confirmed: "checkcircle", served: "utensils", completed: "star" };
      function tracker(o) {
        const idx = FLOW.indexOf(o.status);
        return `<div class="tracker" style="--steps:${FLOW.length};--prog:${Math.max(0, idx) / (FLOW.length - 1)}" role="list">${FLOW.map((s, i) => `<div class="tracker__step ${i < idx || o.status === "completed" ? "is-done" : ""} ${i === idx && o.status !== "completed" ? "is-current" : ""}" role="listitem"><span class="tracker__dot">${icon(i < idx || o.status === "completed" ? "check" : STEP_ICO[s])}</span><span>${t("order.status." + s)}</span></div>`).join("")}</div>`;
      }
      function paintOrders() {
        const host = $("#view-orders");
        const tab = tabForTable(tableNo);
        const active = tab.orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length;
        const dot = $("#orders-dot");
        dot.hidden = !active;
        dot.textContent = active;
        let html = `<h2 class="display display--xl" style="margin-top:var(--sp-6)">${t("order.yourOrders")}</h2>`;
        if (!tab.orders.length) html += `<div class="empty empty-orders">${icon("receipt")}<p>${t("order.noOrders")}</p><button class="btn btn--primary" type="button" data-view="menu">${t("order.navMenu")}</button></div>`;
        tab.orders.forEach((o, i) => {
          html += `<article class="round card" data-id="${o.id}"><div class="round__head"><div><div class="round__id">${o.id}</div><div class="text-faint" style="font-size:var(--fs-xs)">${t("order.round", { n: i + 1 })} \xB7 ${fmtTime(o.createdAt)}</div></div>${o.status === "cancelled" ? `<span class="badge badge--outline">${t("order.cancelledBadge")}</span>` : o.status === "placed" ? `<button type="button" class="btn btn--sm btn--danger" data-cancel="${o.id}">${icon("close")}<span>${t("order.cancel")}</span></button>` : ""}</div>
        ${o.status === "cancelled" ? "" : tracker(o)}
        <ul class="round__items">${o.items.map((it) => `<li><span>${it.qty} \xD7 ${esc(tr(it.name))}${it.note ? `<span class="round__note">${esc(it.note)}</span>` : ""}</span><span>${money(it.price * it.qty)}</span></li>`).join("")}</ul>
        ${o.status === "placed" ? `<p class="text-faint" style="font-size:var(--fs-xs)">${t("order.cancelHint")}</p>` : ""}</article>`;
        });
        if (tab.live.length) html += `<section class="bill card" aria-label="${t("order.billTitle")}"><h2>${t("order.billTitle")}</h2><div class="kv"><span>${t("order.subtotal")}</span><span>${money(tab.subtotal)}</span></div>${tab.discount ? `<div class="kv"><span>${t("order.offer")}</span><span>-${money(tab.discount)}</span></div>` : ""}<div class="kv"><span>${esc(settings.taxName || "GST")}</span><span>${money(tab.tax)}</span></div><div class="kv kv--total"><span>${t("order.total")}</span><span>${money(tab.total)}</span></div><div class="bill__pay">${icon("money")}<span>${t("order.payAtCounter")}</span></div><div class="cluster" style="margin-top:var(--sp-4)"><button type="button" class="btn btn--ghost" id="b2">${icon("hand")}<span>${t("order.callWaiter")}</span></button><button type="button" class="btn btn--primary" id="b3">${icon("bill")}<span>${t("order.requestBill")}</span></button></div></section>`;
        host.innerHTML = html;
        hydrateIcons(host);
        $("#b2")?.addEventListener("click", callWaiter2);
        $("#b3")?.addEventListener("click", askBill);
      }
      $("#view-orders").addEventListener("click", async (e) => {
        const c = e.target.closest("[data-cancel]");
        if (c) {
          if (!await confirmDialog({ title: t("order.cancel"), message: t("order.cancelConfirm"), danger: true })) return;
          try {
            cancelByCustomer(c.dataset.cancel);
            toast(t("order.cancelled"));
          } catch {
            toast(t("order.cancelFail"), { type: "warn" });
          }
          paintOrders();
        }
        const v = e.target.closest("[data-view]");
        if (v) setView(v.dataset.view);
      });
      function setView(v) {
        view = v;
        $("#view-menu").hidden = v !== "menu";
        $("#view-orders").hidden = v !== "orders";
        $$(".bottomnav__btn[data-view]").forEach((b) => b.classList.toggle("is-active", b.dataset.view === v));
        if (v === "orders") paintOrders();
        paintBar();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      $$(".bottomnav__btn[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
      function callWaiter2() {
        const s = getSession(tableNo);
        if (s && s.callWaiter && Date.now() - new Date(s.callWaiter).getTime() < 6e4) return toast(t("order.callCooldown"), { type: "warn" });
        callWaiter(tableNo);
        toast(t("order.called"), { type: "ok" });
      }
      function askBill() {
        requestBill(tableNo);
        toast(t("order.billAsked"), { type: "ok" });
        setView("orders");
      }
      $("#btn-call").addEventListener("click", callWaiter2);
      $("#btn-bill").addEventListener("click", askBill);
      db.onChange((col) => {
        if (["orders", "tableSessions"].includes(col) && view === "orders") paintOrders();
        if (col === "settings" && !acceptingStatus().ok) location.reload();
        if (col === "menu") {
          cart.prune();
          browser.refresh();
          paintBar();
        }
      });
      subscribe("table:closed", (m) => {
        if (Number(m.payload.tableNo) === tableNo) thanks();
      });
      subscribe("order:status", () => {
        if (view === "orders") paintOrders();
      });
      function thanks() {
        cart.clear();
        $("#view-menu").hidden = true;
        $("#view-orders").hidden = true;
        $(".bottomnav").hidden = true;
        $("#cartbar").hidden = true;
        drawer.close();
        state.hidden = false;
        state.innerHTML = `${checkDrawSVG(96)}<h2>${t("order.thanksTitle")}</h2><p class="text-muted">${t("order.thanksText")}</p><div class="cluster"><a class="btn btn--primary" href="review.html?table=${tableNo}">${icon("star")}<span>${t("order.leaveReview")}</span></a><button class="btn btn--ghost" type="button" onclick="location.reload()">${t("order.freshStart")}</button></div>`;
        confetti(60);
      }
      onLangChange(() => {
        paintBar();
        if (drawer.isOpen) paintCart();
        if (view === "orders") paintOrders();
        $("#table-area").textContent = `${table.area} \xB7 ${table.seats} ${t("order.seats")}`;
      });
      setInterval(() => {
        if (view === "orders" && !document.hidden) paintOrders();
      }, 5e3);
      paintBar();
      applyText();
      function applyText() {
        applyI18n();
      }
    }
  })();
})();
