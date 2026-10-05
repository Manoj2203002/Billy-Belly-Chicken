(() => {
  // js/utils.js
  var ROOT = typeof document !== "undefined" && document.body && document.body.dataset.root || "";
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
  var clamp = (n, a, b) => Math.min(b, Math.max(a, n));
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
  var pad = (n, l = 2) => String(n).padStart(l, "0");
  var todayStr = (d = /* @__PURE__ */ new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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
  var namespaces = [];
  var flatten = (o, p = "", out = {}) => {
    for (const [k, v] of Object.entries(o)) {
      const key2 = p ? `${p}.${k}` : k;
      if (v && typeof v === "object") flatten(v, key2, out);
      else out[key2] = v;
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
  function t(key2, vars) {
    let s = dict[lang][key2] ?? dict.en[key2] ?? key2;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
    return s;
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

  // js/ui.js
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
  function initCommonUI() {
    initRipple();
    initMagnetic();
    initTilt();
    splitWords();
    initReveal();
    initCounters();
    initParallax();
  }

  // js/auth.js
  var key = (role) => `bbc:session:${role}`;
  function login(role, username, password) {
    const u = db.find("staff", (s2) => s2.role === role && s2.username.toLowerCase() === String(username).trim().toLowerCase());
    if (!u || u.password !== password) return { ok: false, error: "INVALID" };
    if (u.active === false) return { ok: false, error: "INACTIVE" };
    const s = { id: u.id, role: u.role, name: u.name, username: u.username, photo: u.photo, empId: u.employeeId, shift: u.shift, at: Date.now() };
    session.set(key(role), s);
    return { ok: true, user: s };
  }
  var currentUser = (role) => session.get(key(role));

  // js/pages/__entry_waiter-login.js
  (async () => {
    await init();
    await initI18n(["waiter-login"]);
    mountLangToggle($("[data-lang-mount]"));
    hydrateIcons();
    initCommonUI();
    if (currentUser("waiter")) location.replace("dashboard.html");
    const form = $("#form"), err = $("#err"), pw = $("#p");
    $("#eye").addEventListener("click", () => {
      pw.type = pw.type === "password" ? "text" : "password";
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      err.hidden = true;
      const u = $("#u").value.trim(), p = pw.value;
      const show = (k) => {
        err.textContent = t(k);
        err.hidden = false;
        form.classList.remove("shake");
        void form.offsetWidth;
        form.classList.add("shake");
      };
      if (!u || !p) return show("waiter-login.req");
      const r = login("waiter", u, p);
      if (!r.ok) return show(r.error === "INACTIVE" ? "waiter-login.off" : "waiter-login.bad");
      const next = param("next");
      location.replace(next && /^[a-z]+\.html$/.test(next) ? next : "dashboard.html");
    });
  })();
})();
