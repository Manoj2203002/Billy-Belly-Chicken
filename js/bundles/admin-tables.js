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
  var pad = (n, l = 2) => String(n).padStart(l, "0");
  var todayStr = (d = /* @__PURE__ */ new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function download(filename, content, type = "text/csv;charset=utf-8") {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = el("a", { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2e3);
  }
  function readFileAsDataURL(file, maxW = 900) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const s = Math.min(1, maxW / img.width);
          const c = document.createElement("canvas");
          c.width = img.width * s;
          c.height = img.height * s;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => resolve(fr.result);
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  var imgSrc = (p) => !p ? url("assets/images/misc/placeholder.svg") : /^(data:|https?:|blob:)/.test(p) ? p : url(p);

  // js/dataService.js
  var SEED_VERSION = "2026.10.1";
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
  function emptyState({ icon: ic = "search", title = "", text = "", action = "" } = {}) {
    return `<div class="empty">${icon(ic)}<div class="empty__title">${title}</div><p>${text}</p>${action}</div>`;
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

  // js/components/crud.js
  var L = (s) => {
    if (s == null) return "";
    if (typeof s === "function") return s();
    const v = t(s);
    return v === s ? s : v;
  };
  function buildForm({ fields, values = {} }) {
    const form = el("form", { class: "form-grid", novalidate: true });
    const state = structuredClone(values);
    const refs = {};
    const get = (name) => state[name];
    fields.forEach((f) => {
      if (state[f.name] === void 0) state[f.name] = f.default !== void 0 ? f.default : f.type === "switch" ? false : f.type === "multicheck" ? [] : f.type?.startsWith("bilingual") ? { en: "", ta: "" } : f.type === "number" ? "" : "";
      const wrap = el("div", { class: `field ${f.span || f.type === "textarea" || f.type?.startsWith("bilingual") || f.type === "image" || f.type === "multicheck" ? "span-all" : ""}`, dataset: { name: f.name } });
      const label = el("label", { class: "field__label" }, L(f.label), f.required ? el("span", { class: "req", "aria-hidden": "true" }, "*") : null);
      const err = el("div", { class: "field__error", role: "alert" });
      const id = `f_${f.name}_${Math.random().toString(36).slice(2, 6)}`;
      label.htmlFor = id;
      let control;
      const base = { id, name: f.name, placeholder: f.placeholder ? L(f.placeholder) : null, readonly: f.readonly ? "" : null };
      if (["text", "number", "tel", "email", "password", "date", "time", "color"].includes(f.type || "text")) {
        control = el("input", { class: "input", type: f.type || "text", ...base, min: f.min, max: f.max, step: f.step, autocomplete: f.type === "password" ? "new-password" : "off" });
        control.value = state[f.name] ?? "";
        control.addEventListener("input", () => {
          state[f.name] = f.type === "number" ? control.value === "" ? "" : Number(control.value) : control.value;
        });
      } else if (f.type === "textarea") {
        control = el("textarea", { class: "textarea", rows: f.rows || 3, ...base });
        control.value = state[f.name] ?? "";
        control.addEventListener("input", () => {
          state[f.name] = control.value;
        });
      } else if (f.type === "select") {
        control = el("select", { class: "select", ...base }, ...(f.options || []).map((o) => el("option", { value: o.value }, L(o.label))));
        control.value = state[f.name] ?? "";
        control.addEventListener("change", () => {
          state[f.name] = control.value;
          runShowIf();
        });
      } else if (f.type === "switch") {
        const inp = el("input", { type: "checkbox", id, name: f.name });
        inp.checked = !!state[f.name];
        inp.addEventListener("change", () => {
          state[f.name] = inp.checked;
          runShowIf();
        });
        control = el("label", { class: "switch", for: id }, inp, el("span", { class: "switch__track" }), el("span", {}, L(f.label)));
        label.style.display = "none";
      } else if (f.type === "bilingual" || f.type === "bilingual-textarea") {
        const multi = f.type === "bilingual-textarea";
        const en = el(multi ? "textarea" : "input", { class: multi ? "textarea" : "input", id, lang: "en", rows: 3 });
        en.value = state[f.name].en || "";
        en.addEventListener("input", () => {
          state[f.name].en = en.value;
        });
        control = en;
        refs[f.name + ".en"] = en;
      } else if (f.type === "image") {
        const prev = el("img", { class: "media", alt: "", style: "width:96px;height:96px;object-fit:cover;border-radius:12px;background:var(--surface-3)" });
        const urlIn = el("input", { class: "input", id, type: "text", placeholder: "assets/images/... or https://..." });
        const file = el("input", { type: "file", accept: "image/*", class: "input" });
        const sync = () => {
          prev.src = imgSrc(state[f.name]);
          urlIn.value = (state[f.name] || "").startsWith("data:") ? "(uploaded image)" : state[f.name] || "";
        };
        urlIn.addEventListener("change", () => {
          state[f.name] = urlIn.value.trim();
          sync();
        });
        file.addEventListener("change", async () => {
          if (file.files[0]) {
            state[f.name] = await readFileAsDataURL(file.files[0]);
            sync();
          }
        });
        sync();
        control = el("div", { class: "cluster", style: "align-items:flex-start;flex-wrap:nowrap" }, prev, el("div", { class: "stack", style: "--stack:.5rem;flex:1;min-width:0" }, urlIn, file));
      } else if (f.type === "multicheck") {
        control = el("div", { class: "cluster", style: "--gap:.4rem 1rem" }, ...(f.options || []).map((o) => {
          const c = el("input", { type: "checkbox", value: o.value });
          c.checked = (state[f.name] || []).includes(o.value);
          c.addEventListener("change", () => {
            const s = new Set(state[f.name]);
            c.checked ? s.add(o.value) : s.delete(o.value);
            state[f.name] = [...s];
          });
          return el("label", { class: "check" }, c, L(o.label));
        }));
      }
      wrap.append(...[label, control, f.hint ? el("div", { class: "field__hint" }, L(f.hint)) : null, err].filter(Boolean));
      refs[f.name] = { wrap, err, control };
      form.append(wrap);
    });
    const runShowIf = () => fields.forEach((f) => {
      if (f.showIf) refs[f.name].wrap.hidden = !f.showIf(state);
    });
    runShowIf();
    function validate() {
      let ok = true;
      let first = null;
      fields.forEach((f) => {
        const r = refs[f.name];
        if (!r || r.wrap.hidden) return;
        let msg = "";
        const v = state[f.name];
        if (f.required) {
          if (f.type?.startsWith("bilingual")) {
            if (!String(v.en || "").trim()) msg = t("common.required");
          } else if (v === "" || v == null || Array.isArray(v) && !v.length) msg = t("common.required");
        }
        if (!msg && v !== "" && v != null) {
          if (f.type === "number") {
            if (Number.isNaN(Number(v))) msg = t("common.invalid");
            else if (f.min != null && v < f.min) msg = t("common.minValue", { n: f.min });
            else if (f.max != null && v > f.max) msg = t("common.maxValue", { n: f.max });
          }
          if (f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg = t("common.invalidEmail");
          if (f.type === "tel" && !/^[6-9]\d{9}$/.test(String(v).replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))) msg = t("common.invalidPhone");
          if (f.pattern && !new RegExp(f.pattern).test(v)) msg = f.patternMsg ? L(f.patternMsg) : t("common.invalid");
          if (f.minLength && String(v).length < f.minLength) msg = t("common.minLength", { n: f.minLength });
        }
        if (!msg && f.validate) msg = f.validate(v, state) || "";
        r.wrap.classList.toggle("has-error", !!msg);
        r.err.textContent = msg;
        if (msg) {
          ok = false;
          first || (first = r.wrap);
        }
      });
      if (first) {
        first.scrollIntoView({ block: "center", behavior: "smooth" });
        const i = first.querySelector("input,select,textarea");
        i && i.focus({ preventScroll: true });
      }
      return ok;
    }
    return { el: form, getValues: () => structuredClone(state), validate, setValue(n, v) {
      state[n] = v;
    }, refs };
  }
  function createCrud(cfg) {
    const { container, collection } = cfg;
    const state = { q: "", filters: {}, sortKey: null, dir: 1 };
    const searchIn = el("input", { class: "input", type: "search", placeholder: t("common.search"), "aria-label": t("common.search") });
    const add = cfg.readOnly ? null : el("button", { class: "btn btn--primary", type: "button" }, el("span", { html: icon("plus") }), t("common.add"));
    const filterEls = (cfg.filters || []).map((f) => {
      const s = el("select", { class: "select", "aria-label": L(f.label) }, el("option", { value: "" }, L(f.label)), ...f.options.map((o) => el("option", { value: o.value }, L(o.label))));
      s.addEventListener("change", () => {
        state.filters[f.name] = s.value;
        render();
      });
      return s;
    });
    const toolbar = el("div", { class: "toolbar" }, el("div", { class: "grow input-group", html: icon("search") }, searchIn), ...filterEls, ...cfg.toolbarExtra || [], add);
    const wrap = el("div", { class: "table-wrap" });
    const countEl = el("div", { class: "text-faint", style: "margin-top:.8rem;font-size:var(--fs-xs)" });
    container.replaceChildren(toolbar, wrap, countEl);
    const nameOf = (it) => cfg.nameOf ? cfg.nameOf(it) : typeof it.name === "object" ? tr(it.name) : it.name || it.title && tr(it.title) || it.id;
    function rows() {
      let list = db.list(collection);
      const q = state.q.trim().toLowerCase();
      if (q) list = list.filter((it) => (cfg.searchText ? cfg.searchText(it) : JSON.stringify(it)).toLowerCase().includes(q));
      (cfg.filters || []).forEach((f) => {
        const v = state.filters[f.name];
        if (v) list = list.filter((it) => f.test(it, v));
      });
      if (state.sortKey) {
        const c = cfg.columns.find((x) => x.key === state.sortKey);
        list.sort((a, b) => {
          const va = c.sortValue ? c.sortValue(a) : a[c.key];
          const vb = c.sortValue ? c.sortValue(b) : b[c.key];
          return (va > vb ? 1 : va < vb ? -1 : 0) * state.dir;
        });
      } else if (cfg.sort) list.sort(cfg.sort);
      return list;
    }
    function render(flashId) {
      const list = rows();
      if (!list.length) {
        wrap.innerHTML = emptyState({ icon: "search", title: t("common.noResults"), text: t("common.noResultsHint") });
        countEl.textContent = "";
        return;
      }
      const tbl = el("table", { class: "table table--cards" });
      tbl.append(el("thead", {}, el("tr", {}, ...cfg.columns.map((c) => {
        const th = el("th", { scope: "col", style: c.sortable ? "cursor:pointer" : null }, L(c.label), state.sortKey === c.key ? state.dir > 0 ? " \u25B2" : " \u25BC" : "");
        if (c.sortable) th.addEventListener("click", () => {
          state.dir = state.sortKey === c.key ? -state.dir : 1;
          state.sortKey = c.key;
          render();
        });
        return th;
      }), el("th", { class: "text-right" }, ""))));
      const tb = el("tbody");
      list.forEach((it) => {
        const tr_ = el("tr", { class: it.id === flashId ? "row-in" : "", dataset: { id: it.id } });
        cfg.columns.forEach((c) => {
          const v = c.render ? c.render(it) : esc(it[c.key] ?? "");
          const td = el("td", { "data-label": L(c.label), class: c.cls || "" });
          v instanceof Node ? td.append(v) : td.innerHTML = v ?? "";
          tr_.append(td);
        });
        const act = el("td", { class: "actions-cell" }, el(
          "div",
          { class: "actions" },
          ...cfg.rowActions ? cfg.rowActions(it, api) : [],
          cfg.readOnly ? null : el("button", { class: "icon-btn", type: "button", "aria-label": t("common.edit"), title: t("common.edit"), html: icon("edit"), onclick: () => api.openEdit(it.id) }),
          cfg.readOnly ? null : el("button", { class: "icon-btn icon-btn--danger", type: "button", "aria-label": t("common.delete"), title: t("common.delete"), html: icon("trash"), onclick: () => api.remove(it.id) })
        ));
        tr_.append(act);
        tb.append(tr_);
      });
      tbl.append(tb);
      wrap.replaceChildren(tbl);
      countEl.textContent = t("common.showing", { n: list.length });
    }
    function openForm(existing) {
      const isEdit = !!existing;
      const values = existing ? existing : cfg.newItem ? cfg.newItem() : {};
      const form = buildForm({ fields: cfg.fields, values });
      const cancel = el("button", { class: "btn btn--ghost", type: "button" }, t("common.cancel"));
      const save = el("button", { class: "btn btn--primary", type: "submit" }, t("common.save"));
      const extra = cfg.formExtra ? cfg.formExtra(form, { isEdit, existing }) : null;
      const m = openModal({ title: `${isEdit ? t("common.edit") : t("common.add")} ${cfg.entity ? L(cfg.entity) : ""}`, size: cfg.modalSize || "lg", body: extra ? el("div", { class: "stack" }, form.el, extra) : form.el, footer: [cancel, save] });
      cancel.addEventListener("click", m.close);
      const submit = (e) => {
        e && e.preventDefault();
        if (!form.validate()) return;
        let v = form.getValues();
        if (cfg.beforeSave) {
          v = cfg.beforeSave(v, existing);
          if (v === false) return;
        }
        if (isEdit) {
          db.update(collection, existing.id, v);
          db.audit(`${collection}:update`, nameOf({ ...existing, ...v }));
        } else {
          const c = db.create(collection, v);
          v.id = c.id;
          db.audit(`${collection}:create`, nameOf(c));
          existing = c;
        }
        m.close();
        toast(isEdit ? t("common.saved") : t("common.created"), { type: "ok" });
        render(isEdit ? existing.id : v.id);
        cfg.afterChange && cfg.afterChange();
      };
      form.el.addEventListener("submit", submit);
      save.addEventListener("click", submit);
    }
    const api = {
      refresh: () => render(),
      openCreate: () => openForm(null),
      openEdit: (id) => {
        const it = db.get(collection, id);
        it && openForm(it);
      },
      async remove(id) {
        const it = db.get(collection, id);
        if (!it) return;
        const block = cfg.canDelete ? cfg.canDelete(it) : true;
        if (block !== true && block !== void 0) return toast(typeof block === "string" ? block : t("common.cannotDelete"), { type: "warn" });
        const ok = await confirmDialog({ title: t("common.confirmDelete"), message: cfg.deleteMessage ? cfg.deleteMessage(it) : t("common.deleteMsg", { name: nameOf(it) }), confirmText: t("common.delete"), danger: true });
        if (!ok) return;
        const row = wrap.querySelector(`tr[data-id="${id}"]`);
        if (row) {
          row.classList.add("row-out");
          await new Promise((r) => setTimeout(r, 380));
        }
        db.remove(collection, id);
        db.audit(`${collection}:delete`, nameOf(it));
        toast(t("common.deleted"), { type: "ok" });
        render();
        cfg.afterChange && cfg.afterChange();
      }
    };
    searchIn.addEventListener("input", debounce(() => {
      state.q = searchIn.value;
      render();
    }, 150));
    add && add.addEventListener("click", () => openForm(null));
    onLangChange(() => {
      searchIn.placeholder = t("common.search");
      searchIn.setAttribute("aria-label", t("common.search"));
      if (add && add.lastChild) add.lastChild.textContent = t("common.add");
      (cfg.filters || []).forEach((f, i) => {
        const s = filterEls[i];
        s.setAttribute("aria-label", L(f.label));
        s.options[0].textContent = L(f.label);
        f.options.forEach((o, j) => {
          if (s.options[j + 1]) s.options[j + 1].textContent = L(o.label);
        });
      });
      render();
    });
    render();
    return api;
  }

  // js/vendor/qrcode.esm.js
  var qrcode = (function() {
    var qrcode2 = function(typeNumber, errorCorrectionLevel) {
      var PAD0 = 236;
      var PAD1 = 17;
      var _typeNumber = typeNumber;
      var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
      var _modules = null;
      var _moduleCount = 0;
      var _dataCache = null;
      var _dataList = [];
      var _this = {};
      var makeImpl = function(test, maskPattern) {
        _moduleCount = _typeNumber * 4 + 17;
        _modules = (function(moduleCount) {
          var modules = new Array(moduleCount);
          for (var row = 0; row < moduleCount; row += 1) {
            modules[row] = new Array(moduleCount);
            for (var col = 0; col < moduleCount; col += 1) {
              modules[row][col] = null;
            }
          }
          return modules;
        })(_moduleCount);
        setupPositionProbePattern(0, 0);
        setupPositionProbePattern(_moduleCount - 7, 0);
        setupPositionProbePattern(0, _moduleCount - 7);
        setupPositionAdjustPattern();
        setupTimingPattern();
        setupTypeInfo(test, maskPattern);
        if (_typeNumber >= 7) {
          setupTypeNumber(test);
        }
        if (_dataCache == null) {
          _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
        }
        mapData(_dataCache, maskPattern);
      };
      var setupPositionProbePattern = function(row, col) {
        for (var r = -1; r <= 7; r += 1) {
          if (row + r <= -1 || _moduleCount <= row + r) continue;
          for (var c = -1; c <= 7; c += 1) {
            if (col + c <= -1 || _moduleCount <= col + c) continue;
            if (0 <= r && r <= 6 && (c == 0 || c == 6) || 0 <= c && c <= 6 && (r == 0 || r == 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4) {
              _modules[row + r][col + c] = true;
            } else {
              _modules[row + r][col + c] = false;
            }
          }
        }
      };
      var getBestMaskPattern = function() {
        var minLostPoint = 0;
        var pattern = 0;
        for (var i = 0; i < 8; i += 1) {
          makeImpl(true, i);
          var lostPoint = QRUtil.getLostPoint(_this);
          if (i == 0 || minLostPoint > lostPoint) {
            minLostPoint = lostPoint;
            pattern = i;
          }
        }
        return pattern;
      };
      var setupTimingPattern = function() {
        for (var r = 8; r < _moduleCount - 8; r += 1) {
          if (_modules[r][6] != null) {
            continue;
          }
          _modules[r][6] = r % 2 == 0;
        }
        for (var c = 8; c < _moduleCount - 8; c += 1) {
          if (_modules[6][c] != null) {
            continue;
          }
          _modules[6][c] = c % 2 == 0;
        }
      };
      var setupPositionAdjustPattern = function() {
        var pos = QRUtil.getPatternPosition(_typeNumber);
        for (var i = 0; i < pos.length; i += 1) {
          for (var j = 0; j < pos.length; j += 1) {
            var row = pos[i];
            var col = pos[j];
            if (_modules[row][col] != null) {
              continue;
            }
            for (var r = -2; r <= 2; r += 1) {
              for (var c = -2; c <= 2; c += 1) {
                if (r == -2 || r == 2 || c == -2 || c == 2 || r == 0 && c == 0) {
                  _modules[row + r][col + c] = true;
                } else {
                  _modules[row + r][col + c] = false;
                }
              }
            }
          }
        }
      };
      var setupTypeNumber = function(test) {
        var bits = QRUtil.getBCHTypeNumber(_typeNumber);
        for (var i = 0; i < 18; i += 1) {
          var mod = !test && (bits >> i & 1) == 1;
          _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
        }
        for (var i = 0; i < 18; i += 1) {
          var mod = !test && (bits >> i & 1) == 1;
          _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
        }
      };
      var setupTypeInfo = function(test, maskPattern) {
        var data = _errorCorrectionLevel << 3 | maskPattern;
        var bits = QRUtil.getBCHTypeInfo(data);
        for (var i = 0; i < 15; i += 1) {
          var mod = !test && (bits >> i & 1) == 1;
          if (i < 6) {
            _modules[i][8] = mod;
          } else if (i < 8) {
            _modules[i + 1][8] = mod;
          } else {
            _modules[_moduleCount - 15 + i][8] = mod;
          }
        }
        for (var i = 0; i < 15; i += 1) {
          var mod = !test && (bits >> i & 1) == 1;
          if (i < 8) {
            _modules[8][_moduleCount - i - 1] = mod;
          } else if (i < 9) {
            _modules[8][15 - i - 1 + 1] = mod;
          } else {
            _modules[8][15 - i - 1] = mod;
          }
        }
        _modules[_moduleCount - 8][8] = !test;
      };
      var mapData = function(data, maskPattern) {
        var inc = -1;
        var row = _moduleCount - 1;
        var bitIndex = 7;
        var byteIndex = 0;
        var maskFunc = QRUtil.getMaskFunction(maskPattern);
        for (var col = _moduleCount - 1; col > 0; col -= 2) {
          if (col == 6) col -= 1;
          while (true) {
            for (var c = 0; c < 2; c += 1) {
              if (_modules[row][col - c] == null) {
                var dark = false;
                if (byteIndex < data.length) {
                  dark = (data[byteIndex] >>> bitIndex & 1) == 1;
                }
                var mask = maskFunc(row, col - c);
                if (mask) {
                  dark = !dark;
                }
                _modules[row][col - c] = dark;
                bitIndex -= 1;
                if (bitIndex == -1) {
                  byteIndex += 1;
                  bitIndex = 7;
                }
              }
            }
            row += inc;
            if (row < 0 || _moduleCount <= row) {
              row -= inc;
              inc = -inc;
              break;
            }
          }
        }
      };
      var createBytes = function(buffer, rsBlocks) {
        var offset = 0;
        var maxDcCount = 0;
        var maxEcCount = 0;
        var dcdata = new Array(rsBlocks.length);
        var ecdata = new Array(rsBlocks.length);
        for (var r = 0; r < rsBlocks.length; r += 1) {
          var dcCount = rsBlocks[r].dataCount;
          var ecCount = rsBlocks[r].totalCount - dcCount;
          maxDcCount = Math.max(maxDcCount, dcCount);
          maxEcCount = Math.max(maxEcCount, ecCount);
          dcdata[r] = new Array(dcCount);
          for (var i = 0; i < dcdata[r].length; i += 1) {
            dcdata[r][i] = 255 & buffer.getBuffer()[i + offset];
          }
          offset += dcCount;
          var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
          var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
          var modPoly = rawPoly.mod(rsPoly);
          ecdata[r] = new Array(rsPoly.getLength() - 1);
          for (var i = 0; i < ecdata[r].length; i += 1) {
            var modIndex = i + modPoly.getLength() - ecdata[r].length;
            ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
          }
        }
        var totalCodeCount = 0;
        for (var i = 0; i < rsBlocks.length; i += 1) {
          totalCodeCount += rsBlocks[i].totalCount;
        }
        var data = new Array(totalCodeCount);
        var index = 0;
        for (var i = 0; i < maxDcCount; i += 1) {
          for (var r = 0; r < rsBlocks.length; r += 1) {
            if (i < dcdata[r].length) {
              data[index] = dcdata[r][i];
              index += 1;
            }
          }
        }
        for (var i = 0; i < maxEcCount; i += 1) {
          for (var r = 0; r < rsBlocks.length; r += 1) {
            if (i < ecdata[r].length) {
              data[index] = ecdata[r][i];
              index += 1;
            }
          }
        }
        return data;
      };
      var createData = function(typeNumber2, errorCorrectionLevel2, dataList) {
        var rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, errorCorrectionLevel2);
        var buffer = qrBitBuffer();
        for (var i = 0; i < dataList.length; i += 1) {
          var data = dataList[i];
          buffer.put(data.getMode(), 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
          data.write(buffer);
        }
        var totalDataCount = 0;
        for (var i = 0; i < rsBlocks.length; i += 1) {
          totalDataCount += rsBlocks[i].dataCount;
        }
        if (buffer.getLengthInBits() > totalDataCount * 8) {
          throw "code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")";
        }
        if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
          buffer.put(0, 4);
        }
        while (buffer.getLengthInBits() % 8 != 0) {
          buffer.putBit(false);
        }
        while (true) {
          if (buffer.getLengthInBits() >= totalDataCount * 8) {
            break;
          }
          buffer.put(PAD0, 8);
          if (buffer.getLengthInBits() >= totalDataCount * 8) {
            break;
          }
          buffer.put(PAD1, 8);
        }
        return createBytes(buffer, rsBlocks);
      };
      _this.addData = function(data, mode) {
        mode = mode || "Byte";
        var newData = null;
        switch (mode) {
          case "Numeric":
            newData = qrNumber(data);
            break;
          case "Alphanumeric":
            newData = qrAlphaNum(data);
            break;
          case "Byte":
            newData = qr8BitByte(data);
            break;
          case "Kanji":
            newData = qrKanji(data);
            break;
          default:
            throw "mode:" + mode;
        }
        _dataList.push(newData);
        _dataCache = null;
      };
      _this.isDark = function(row, col) {
        if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
          throw row + "," + col;
        }
        return _modules[row][col];
      };
      _this.getModuleCount = function() {
        return _moduleCount;
      };
      _this.make = function() {
        if (_typeNumber < 1) {
          var typeNumber2 = 1;
          for (; typeNumber2 < 40; typeNumber2++) {
            var rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, _errorCorrectionLevel);
            var buffer = qrBitBuffer();
            for (var i = 0; i < _dataList.length; i++) {
              var data = _dataList[i];
              buffer.put(data.getMode(), 4);
              buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
              data.write(buffer);
            }
            var totalDataCount = 0;
            for (var i = 0; i < rsBlocks.length; i++) {
              totalDataCount += rsBlocks[i].dataCount;
            }
            if (buffer.getLengthInBits() <= totalDataCount * 8) {
              break;
            }
          }
          _typeNumber = typeNumber2;
        }
        makeImpl(false, getBestMaskPattern());
      };
      _this.createTableTag = function(cellSize, margin) {
        cellSize = cellSize || 2;
        margin = typeof margin == "undefined" ? cellSize * 4 : margin;
        var qrHtml = "";
        qrHtml += '<table style="';
        qrHtml += " border-width: 0px; border-style: none;";
        qrHtml += " border-collapse: collapse;";
        qrHtml += " padding: 0px; margin: " + margin + "px;";
        qrHtml += '">';
        qrHtml += "<tbody>";
        for (var r = 0; r < _this.getModuleCount(); r += 1) {
          qrHtml += "<tr>";
          for (var c = 0; c < _this.getModuleCount(); c += 1) {
            qrHtml += '<td style="';
            qrHtml += " border-width: 0px; border-style: none;";
            qrHtml += " border-collapse: collapse;";
            qrHtml += " padding: 0px; margin: 0px;";
            qrHtml += " width: " + cellSize + "px;";
            qrHtml += " height: " + cellSize + "px;";
            qrHtml += " background-color: ";
            qrHtml += _this.isDark(r, c) ? "#000000" : "#ffffff";
            qrHtml += ";";
            qrHtml += '"/>';
          }
          qrHtml += "</tr>";
        }
        qrHtml += "</tbody>";
        qrHtml += "</table>";
        return qrHtml;
      };
      _this.createSvgTag = function(cellSize, margin, alt, title) {
        var opts = {};
        if (typeof arguments[0] == "object") {
          opts = arguments[0];
          cellSize = opts.cellSize;
          margin = opts.margin;
          alt = opts.alt;
          title = opts.title;
        }
        cellSize = cellSize || 2;
        margin = typeof margin == "undefined" ? cellSize * 4 : margin;
        alt = typeof alt === "string" ? { text: alt } : alt || {};
        alt.text = alt.text || null;
        alt.id = alt.text ? alt.id || "qrcode-description" : null;
        title = typeof title === "string" ? { text: title } : title || {};
        title.text = title.text || null;
        title.id = title.text ? title.id || "qrcode-title" : null;
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var c, mc, r, mr, qrSvg = "", rect;
        rect = "l" + cellSize + ",0 0," + cellSize + " -" + cellSize + ",0 0,-" + cellSize + "z ";
        qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
        qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : "";
        qrSvg += ' viewBox="0 0 ' + size + " " + size + '" ';
        qrSvg += ' preserveAspectRatio="xMinYMin meet"';
        qrSvg += title.text || alt.text ? ' role="img" aria-labelledby="' + escapeXml([title.id, alt.id].join(" ").trim()) + '"' : "";
        qrSvg += ">";
        qrSvg += title.text ? '<title id="' + escapeXml(title.id) + '">' + escapeXml(title.text) + "</title>" : "";
        qrSvg += alt.text ? '<description id="' + escapeXml(alt.id) + '">' + escapeXml(alt.text) + "</description>" : "";
        qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
        qrSvg += '<path d="';
        for (r = 0; r < _this.getModuleCount(); r += 1) {
          mr = r * cellSize + margin;
          for (c = 0; c < _this.getModuleCount(); c += 1) {
            if (_this.isDark(r, c)) {
              mc = c * cellSize + margin;
              qrSvg += "M" + mc + "," + mr + rect;
            }
          }
        }
        qrSvg += '" stroke="transparent" fill="black"/>';
        qrSvg += "</svg>";
        return qrSvg;
      };
      _this.createDataURL = function(cellSize, margin) {
        cellSize = cellSize || 2;
        margin = typeof margin == "undefined" ? cellSize * 4 : margin;
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var min = margin;
        var max = size - margin;
        return createDataURL(size, size, function(x, y) {
          if (min <= x && x < max && min <= y && y < max) {
            var c = Math.floor((x - min) / cellSize);
            var r = Math.floor((y - min) / cellSize);
            return _this.isDark(r, c) ? 0 : 1;
          } else {
            return 1;
          }
        });
      };
      _this.createImgTag = function(cellSize, margin, alt) {
        cellSize = cellSize || 2;
        margin = typeof margin == "undefined" ? cellSize * 4 : margin;
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var img = "";
        img += "<img";
        img += ' src="';
        img += _this.createDataURL(cellSize, margin);
        img += '"';
        img += ' width="';
        img += size;
        img += '"';
        img += ' height="';
        img += size;
        img += '"';
        if (alt) {
          img += ' alt="';
          img += escapeXml(alt);
          img += '"';
        }
        img += "/>";
        return img;
      };
      var escapeXml = function(s) {
        var escaped = "";
        for (var i = 0; i < s.length; i += 1) {
          var c = s.charAt(i);
          switch (c) {
            case "<":
              escaped += "&lt;";
              break;
            case ">":
              escaped += "&gt;";
              break;
            case "&":
              escaped += "&amp;";
              break;
            case '"':
              escaped += "&quot;";
              break;
            default:
              escaped += c;
              break;
          }
        }
        return escaped;
      };
      var _createHalfASCII = function(margin) {
        var cellSize = 1;
        margin = typeof margin == "undefined" ? cellSize * 2 : margin;
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var min = margin;
        var max = size - margin;
        var y, x, r1, r2, p;
        var blocks = {
          "\u2588\u2588": "\u2588",
          "\u2588 ": "\u2580",
          " \u2588": "\u2584",
          "  ": " "
        };
        var blocksLastLineNoMargin = {
          "\u2588\u2588": "\u2580",
          "\u2588 ": "\u2580",
          " \u2588": " ",
          "  ": " "
        };
        var ascii = "";
        for (y = 0; y < size; y += 2) {
          r1 = Math.floor((y - min) / cellSize);
          r2 = Math.floor((y + 1 - min) / cellSize);
          for (x = 0; x < size; x += 1) {
            p = "\u2588";
            if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
              p = " ";
            }
            if (min <= x && x < max && min <= y + 1 && y + 1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
              p += " ";
            } else {
              p += "\u2588";
            }
            ascii += margin < 1 && y + 1 >= max ? blocksLastLineNoMargin[p] : blocks[p];
          }
          ascii += "\n";
        }
        if (size % 2 && margin > 0) {
          return ascii.substring(0, ascii.length - size - 1) + Array(size + 1).join("\u2580");
        }
        return ascii.substring(0, ascii.length - 1);
      };
      _this.createASCII = function(cellSize, margin) {
        cellSize = cellSize || 1;
        if (cellSize < 2) {
          return _createHalfASCII(margin);
        }
        cellSize -= 1;
        margin = typeof margin == "undefined" ? cellSize * 2 : margin;
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var min = margin;
        var max = size - margin;
        var y, x, r, p;
        var white = Array(cellSize + 1).join("\u2588\u2588");
        var black = Array(cellSize + 1).join("  ");
        var ascii = "";
        var line = "";
        for (y = 0; y < size; y += 1) {
          r = Math.floor((y - min) / cellSize);
          line = "";
          for (x = 0; x < size; x += 1) {
            p = 1;
            if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
              p = 0;
            }
            line += p ? white : black;
          }
          for (r = 0; r < cellSize; r += 1) {
            ascii += line + "\n";
          }
        }
        return ascii.substring(0, ascii.length - 1);
      };
      _this.renderTo2dContext = function(context, cellSize) {
        cellSize = cellSize || 2;
        var length = _this.getModuleCount();
        for (var row = 0; row < length; row++) {
          for (var col = 0; col < length; col++) {
            context.fillStyle = _this.isDark(row, col) ? "black" : "white";
            context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
          }
        }
      };
      return _this;
    };
    qrcode2.stringToBytesFuncs = {
      "default": function(s) {
        var bytes = [];
        for (var i = 0; i < s.length; i += 1) {
          var c = s.charCodeAt(i);
          bytes.push(c & 255);
        }
        return bytes;
      }
    };
    qrcode2.stringToBytes = qrcode2.stringToBytesFuncs["default"];
    qrcode2.createStringToBytes = function(unicodeData, numChars) {
      var unicodeMap = (function() {
        var bin = base64DecodeInputStream(unicodeData);
        var read = function() {
          var b = bin.read();
          if (b == -1) throw "eof";
          return b;
        };
        var count = 0;
        var unicodeMap2 = {};
        while (true) {
          var b0 = bin.read();
          if (b0 == -1) break;
          var b1 = read();
          var b2 = read();
          var b3 = read();
          var k = String.fromCharCode(b0 << 8 | b1);
          var v = b2 << 8 | b3;
          unicodeMap2[k] = v;
          count += 1;
        }
        if (count != numChars) {
          throw count + " != " + numChars;
        }
        return unicodeMap2;
      })();
      var unknownChar = "?".charCodeAt(0);
      return function(s) {
        var bytes = [];
        for (var i = 0; i < s.length; i += 1) {
          var c = s.charCodeAt(i);
          if (c < 128) {
            bytes.push(c);
          } else {
            var b = unicodeMap[s.charAt(i)];
            if (typeof b == "number") {
              if ((b & 255) == b) {
                bytes.push(b);
              } else {
                bytes.push(b >>> 8);
                bytes.push(b & 255);
              }
            } else {
              bytes.push(unknownChar);
            }
          }
        }
        return bytes;
      };
    };
    var QRMode = {
      MODE_NUMBER: 1 << 0,
      MODE_ALPHA_NUM: 1 << 1,
      MODE_8BIT_BYTE: 1 << 2,
      MODE_KANJI: 1 << 3
    };
    var QRErrorCorrectionLevel = {
      L: 1,
      M: 0,
      Q: 3,
      H: 2
    };
    var QRMaskPattern = {
      PATTERN000: 0,
      PATTERN001: 1,
      PATTERN010: 2,
      PATTERN011: 3,
      PATTERN100: 4,
      PATTERN101: 5,
      PATTERN110: 6,
      PATTERN111: 7
    };
    var QRUtil = (function() {
      var PATTERN_POSITION_TABLE = [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
      ];
      var G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
      var G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
      var G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
      var _this = {};
      var getBCHDigit = function(data) {
        var digit = 0;
        while (data != 0) {
          digit += 1;
          data >>>= 1;
        }
        return digit;
      };
      _this.getBCHTypeInfo = function(data) {
        var d = data << 10;
        while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
          d ^= G15 << getBCHDigit(d) - getBCHDigit(G15);
        }
        return (data << 10 | d) ^ G15_MASK;
      };
      _this.getBCHTypeNumber = function(data) {
        var d = data << 12;
        while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
          d ^= G18 << getBCHDigit(d) - getBCHDigit(G18);
        }
        return data << 12 | d;
      };
      _this.getPatternPosition = function(typeNumber) {
        return PATTERN_POSITION_TABLE[typeNumber - 1];
      };
      _this.getMaskFunction = function(maskPattern) {
        switch (maskPattern) {
          case QRMaskPattern.PATTERN000:
            return function(i, j) {
              return (i + j) % 2 == 0;
            };
          case QRMaskPattern.PATTERN001:
            return function(i, j) {
              return i % 2 == 0;
            };
          case QRMaskPattern.PATTERN010:
            return function(i, j) {
              return j % 3 == 0;
            };
          case QRMaskPattern.PATTERN011:
            return function(i, j) {
              return (i + j) % 3 == 0;
            };
          case QRMaskPattern.PATTERN100:
            return function(i, j) {
              return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
            };
          case QRMaskPattern.PATTERN101:
            return function(i, j) {
              return i * j % 2 + i * j % 3 == 0;
            };
          case QRMaskPattern.PATTERN110:
            return function(i, j) {
              return (i * j % 2 + i * j % 3) % 2 == 0;
            };
          case QRMaskPattern.PATTERN111:
            return function(i, j) {
              return (i * j % 3 + (i + j) % 2) % 2 == 0;
            };
          default:
            throw "bad maskPattern:" + maskPattern;
        }
      };
      _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
        var a = qrPolynomial([1], 0);
        for (var i = 0; i < errorCorrectLength; i += 1) {
          a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
        }
        return a;
      };
      _this.getLengthInBits = function(mode, type) {
        if (1 <= type && type < 10) {
          switch (mode) {
            case QRMode.MODE_NUMBER:
              return 10;
            case QRMode.MODE_ALPHA_NUM:
              return 9;
            case QRMode.MODE_8BIT_BYTE:
              return 8;
            case QRMode.MODE_KANJI:
              return 8;
            default:
              throw "mode:" + mode;
          }
        } else if (type < 27) {
          switch (mode) {
            case QRMode.MODE_NUMBER:
              return 12;
            case QRMode.MODE_ALPHA_NUM:
              return 11;
            case QRMode.MODE_8BIT_BYTE:
              return 16;
            case QRMode.MODE_KANJI:
              return 10;
            default:
              throw "mode:" + mode;
          }
        } else if (type < 41) {
          switch (mode) {
            case QRMode.MODE_NUMBER:
              return 14;
            case QRMode.MODE_ALPHA_NUM:
              return 13;
            case QRMode.MODE_8BIT_BYTE:
              return 16;
            case QRMode.MODE_KANJI:
              return 12;
            default:
              throw "mode:" + mode;
          }
        } else {
          throw "type:" + type;
        }
      };
      _this.getLostPoint = function(qrcode3) {
        var moduleCount = qrcode3.getModuleCount();
        var lostPoint = 0;
        for (var row = 0; row < moduleCount; row += 1) {
          for (var col = 0; col < moduleCount; col += 1) {
            var sameCount = 0;
            var dark = qrcode3.isDark(row, col);
            for (var r = -1; r <= 1; r += 1) {
              if (row + r < 0 || moduleCount <= row + r) {
                continue;
              }
              for (var c = -1; c <= 1; c += 1) {
                if (col + c < 0 || moduleCount <= col + c) {
                  continue;
                }
                if (r == 0 && c == 0) {
                  continue;
                }
                if (dark == qrcode3.isDark(row + r, col + c)) {
                  sameCount += 1;
                }
              }
            }
            if (sameCount > 5) {
              lostPoint += 3 + sameCount - 5;
            }
          }
        }
        ;
        for (var row = 0; row < moduleCount - 1; row += 1) {
          for (var col = 0; col < moduleCount - 1; col += 1) {
            var count = 0;
            if (qrcode3.isDark(row, col)) count += 1;
            if (qrcode3.isDark(row + 1, col)) count += 1;
            if (qrcode3.isDark(row, col + 1)) count += 1;
            if (qrcode3.isDark(row + 1, col + 1)) count += 1;
            if (count == 0 || count == 4) {
              lostPoint += 3;
            }
          }
        }
        for (var row = 0; row < moduleCount; row += 1) {
          for (var col = 0; col < moduleCount - 6; col += 1) {
            if (qrcode3.isDark(row, col) && !qrcode3.isDark(row, col + 1) && qrcode3.isDark(row, col + 2) && qrcode3.isDark(row, col + 3) && qrcode3.isDark(row, col + 4) && !qrcode3.isDark(row, col + 5) && qrcode3.isDark(row, col + 6)) {
              lostPoint += 40;
            }
          }
        }
        for (var col = 0; col < moduleCount; col += 1) {
          for (var row = 0; row < moduleCount - 6; row += 1) {
            if (qrcode3.isDark(row, col) && !qrcode3.isDark(row + 1, col) && qrcode3.isDark(row + 2, col) && qrcode3.isDark(row + 3, col) && qrcode3.isDark(row + 4, col) && !qrcode3.isDark(row + 5, col) && qrcode3.isDark(row + 6, col)) {
              lostPoint += 40;
            }
          }
        }
        var darkCount = 0;
        for (var col = 0; col < moduleCount; col += 1) {
          for (var row = 0; row < moduleCount; row += 1) {
            if (qrcode3.isDark(row, col)) {
              darkCount += 1;
            }
          }
        }
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;
        return lostPoint;
      };
      return _this;
    })();
    var QRMath = (function() {
      var EXP_TABLE = new Array(256);
      var LOG_TABLE = new Array(256);
      for (var i = 0; i < 8; i += 1) {
        EXP_TABLE[i] = 1 << i;
      }
      for (var i = 8; i < 256; i += 1) {
        EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
      }
      for (var i = 0; i < 255; i += 1) {
        LOG_TABLE[EXP_TABLE[i]] = i;
      }
      var _this = {};
      _this.glog = function(n) {
        if (n < 1) {
          throw "glog(" + n + ")";
        }
        return LOG_TABLE[n];
      };
      _this.gexp = function(n) {
        while (n < 0) {
          n += 255;
        }
        while (n >= 256) {
          n -= 255;
        }
        return EXP_TABLE[n];
      };
      return _this;
    })();
    function qrPolynomial(num, shift) {
      if (typeof num.length == "undefined") {
        throw num.length + "/" + shift;
      }
      var _num = (function() {
        var offset = 0;
        while (offset < num.length && num[offset] == 0) {
          offset += 1;
        }
        var _num2 = new Array(num.length - offset + shift);
        for (var i = 0; i < num.length - offset; i += 1) {
          _num2[i] = num[i + offset];
        }
        return _num2;
      })();
      var _this = {};
      _this.getAt = function(index) {
        return _num[index];
      };
      _this.getLength = function() {
        return _num.length;
      };
      _this.multiply = function(e) {
        var num2 = new Array(_this.getLength() + e.getLength() - 1);
        for (var i = 0; i < _this.getLength(); i += 1) {
          for (var j = 0; j < e.getLength(); j += 1) {
            num2[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
          }
        }
        return qrPolynomial(num2, 0);
      };
      _this.mod = function(e) {
        if (_this.getLength() - e.getLength() < 0) {
          return _this;
        }
        var ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
        var num2 = new Array(_this.getLength());
        for (var i = 0; i < _this.getLength(); i += 1) {
          num2[i] = _this.getAt(i);
        }
        for (var i = 0; i < e.getLength(); i += 1) {
          num2[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
        }
        return qrPolynomial(num2, 0).mod(e);
      };
      return _this;
    }
    ;
    var QRRSBlock = (function() {
      var RS_BLOCK_TABLE = [
        // L
        // M
        // Q
        // H
        // 1
        [1, 26, 19],
        [1, 26, 16],
        [1, 26, 13],
        [1, 26, 9],
        // 2
        [1, 44, 34],
        [1, 44, 28],
        [1, 44, 22],
        [1, 44, 16],
        // 3
        [1, 70, 55],
        [1, 70, 44],
        [2, 35, 17],
        [2, 35, 13],
        // 4
        [1, 100, 80],
        [2, 50, 32],
        [2, 50, 24],
        [4, 25, 9],
        // 5
        [1, 134, 108],
        [2, 67, 43],
        [2, 33, 15, 2, 34, 16],
        [2, 33, 11, 2, 34, 12],
        // 6
        [2, 86, 68],
        [4, 43, 27],
        [4, 43, 19],
        [4, 43, 15],
        // 7
        [2, 98, 78],
        [4, 49, 31],
        [2, 32, 14, 4, 33, 15],
        [4, 39, 13, 1, 40, 14],
        // 8
        [2, 121, 97],
        [2, 60, 38, 2, 61, 39],
        [4, 40, 18, 2, 41, 19],
        [4, 40, 14, 2, 41, 15],
        // 9
        [2, 146, 116],
        [3, 58, 36, 2, 59, 37],
        [4, 36, 16, 4, 37, 17],
        [4, 36, 12, 4, 37, 13],
        // 10
        [2, 86, 68, 2, 87, 69],
        [4, 69, 43, 1, 70, 44],
        [6, 43, 19, 2, 44, 20],
        [6, 43, 15, 2, 44, 16],
        // 11
        [4, 101, 81],
        [1, 80, 50, 4, 81, 51],
        [4, 50, 22, 4, 51, 23],
        [3, 36, 12, 8, 37, 13],
        // 12
        [2, 116, 92, 2, 117, 93],
        [6, 58, 36, 2, 59, 37],
        [4, 46, 20, 6, 47, 21],
        [7, 42, 14, 4, 43, 15],
        // 13
        [4, 133, 107],
        [8, 59, 37, 1, 60, 38],
        [8, 44, 20, 4, 45, 21],
        [12, 33, 11, 4, 34, 12],
        // 14
        [3, 145, 115, 1, 146, 116],
        [4, 64, 40, 5, 65, 41],
        [11, 36, 16, 5, 37, 17],
        [11, 36, 12, 5, 37, 13],
        // 15
        [5, 109, 87, 1, 110, 88],
        [5, 65, 41, 5, 66, 42],
        [5, 54, 24, 7, 55, 25],
        [11, 36, 12, 7, 37, 13],
        // 16
        [5, 122, 98, 1, 123, 99],
        [7, 73, 45, 3, 74, 46],
        [15, 43, 19, 2, 44, 20],
        [3, 45, 15, 13, 46, 16],
        // 17
        [1, 135, 107, 5, 136, 108],
        [10, 74, 46, 1, 75, 47],
        [1, 50, 22, 15, 51, 23],
        [2, 42, 14, 17, 43, 15],
        // 18
        [5, 150, 120, 1, 151, 121],
        [9, 69, 43, 4, 70, 44],
        [17, 50, 22, 1, 51, 23],
        [2, 42, 14, 19, 43, 15],
        // 19
        [3, 141, 113, 4, 142, 114],
        [3, 70, 44, 11, 71, 45],
        [17, 47, 21, 4, 48, 22],
        [9, 39, 13, 16, 40, 14],
        // 20
        [3, 135, 107, 5, 136, 108],
        [3, 67, 41, 13, 68, 42],
        [15, 54, 24, 5, 55, 25],
        [15, 43, 15, 10, 44, 16],
        // 21
        [4, 144, 116, 4, 145, 117],
        [17, 68, 42],
        [17, 50, 22, 6, 51, 23],
        [19, 46, 16, 6, 47, 17],
        // 22
        [2, 139, 111, 7, 140, 112],
        [17, 74, 46],
        [7, 54, 24, 16, 55, 25],
        [34, 37, 13],
        // 23
        [4, 151, 121, 5, 152, 122],
        [4, 75, 47, 14, 76, 48],
        [11, 54, 24, 14, 55, 25],
        [16, 45, 15, 14, 46, 16],
        // 24
        [6, 147, 117, 4, 148, 118],
        [6, 73, 45, 14, 74, 46],
        [11, 54, 24, 16, 55, 25],
        [30, 46, 16, 2, 47, 17],
        // 25
        [8, 132, 106, 4, 133, 107],
        [8, 75, 47, 13, 76, 48],
        [7, 54, 24, 22, 55, 25],
        [22, 45, 15, 13, 46, 16],
        // 26
        [10, 142, 114, 2, 143, 115],
        [19, 74, 46, 4, 75, 47],
        [28, 50, 22, 6, 51, 23],
        [33, 46, 16, 4, 47, 17],
        // 27
        [8, 152, 122, 4, 153, 123],
        [22, 73, 45, 3, 74, 46],
        [8, 53, 23, 26, 54, 24],
        [12, 45, 15, 28, 46, 16],
        // 28
        [3, 147, 117, 10, 148, 118],
        [3, 73, 45, 23, 74, 46],
        [4, 54, 24, 31, 55, 25],
        [11, 45, 15, 31, 46, 16],
        // 29
        [7, 146, 116, 7, 147, 117],
        [21, 73, 45, 7, 74, 46],
        [1, 53, 23, 37, 54, 24],
        [19, 45, 15, 26, 46, 16],
        // 30
        [5, 145, 115, 10, 146, 116],
        [19, 75, 47, 10, 76, 48],
        [15, 54, 24, 25, 55, 25],
        [23, 45, 15, 25, 46, 16],
        // 31
        [13, 145, 115, 3, 146, 116],
        [2, 74, 46, 29, 75, 47],
        [42, 54, 24, 1, 55, 25],
        [23, 45, 15, 28, 46, 16],
        // 32
        [17, 145, 115],
        [10, 74, 46, 23, 75, 47],
        [10, 54, 24, 35, 55, 25],
        [19, 45, 15, 35, 46, 16],
        // 33
        [17, 145, 115, 1, 146, 116],
        [14, 74, 46, 21, 75, 47],
        [29, 54, 24, 19, 55, 25],
        [11, 45, 15, 46, 46, 16],
        // 34
        [13, 145, 115, 6, 146, 116],
        [14, 74, 46, 23, 75, 47],
        [44, 54, 24, 7, 55, 25],
        [59, 46, 16, 1, 47, 17],
        // 35
        [12, 151, 121, 7, 152, 122],
        [12, 75, 47, 26, 76, 48],
        [39, 54, 24, 14, 55, 25],
        [22, 45, 15, 41, 46, 16],
        // 36
        [6, 151, 121, 14, 152, 122],
        [6, 75, 47, 34, 76, 48],
        [46, 54, 24, 10, 55, 25],
        [2, 45, 15, 64, 46, 16],
        // 37
        [17, 152, 122, 4, 153, 123],
        [29, 74, 46, 14, 75, 47],
        [49, 54, 24, 10, 55, 25],
        [24, 45, 15, 46, 46, 16],
        // 38
        [4, 152, 122, 18, 153, 123],
        [13, 74, 46, 32, 75, 47],
        [48, 54, 24, 14, 55, 25],
        [42, 45, 15, 32, 46, 16],
        // 39
        [20, 147, 117, 4, 148, 118],
        [40, 75, 47, 7, 76, 48],
        [43, 54, 24, 22, 55, 25],
        [10, 45, 15, 67, 46, 16],
        // 40
        [19, 148, 118, 6, 149, 119],
        [18, 75, 47, 31, 76, 48],
        [34, 54, 24, 34, 55, 25],
        [20, 45, 15, 61, 46, 16]
      ];
      var qrRSBlock = function(totalCount, dataCount) {
        var _this2 = {};
        _this2.totalCount = totalCount;
        _this2.dataCount = dataCount;
        return _this2;
      };
      var _this = {};
      var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
        switch (errorCorrectionLevel) {
          case QRErrorCorrectionLevel.L:
            return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
          case QRErrorCorrectionLevel.M:
            return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
          case QRErrorCorrectionLevel.Q:
            return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
          case QRErrorCorrectionLevel.H:
            return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
          default:
            return void 0;
        }
      };
      _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
        var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
        if (typeof rsBlock == "undefined") {
          throw "bad rs block @ typeNumber:" + typeNumber + "/errorCorrectionLevel:" + errorCorrectionLevel;
        }
        var length = rsBlock.length / 3;
        var list = [];
        for (var i = 0; i < length; i += 1) {
          var count = rsBlock[i * 3 + 0];
          var totalCount = rsBlock[i * 3 + 1];
          var dataCount = rsBlock[i * 3 + 2];
          for (var j = 0; j < count; j += 1) {
            list.push(qrRSBlock(totalCount, dataCount));
          }
        }
        return list;
      };
      return _this;
    })();
    var qrBitBuffer = function() {
      var _buffer = [];
      var _length = 0;
      var _this = {};
      _this.getBuffer = function() {
        return _buffer;
      };
      _this.getAt = function(index) {
        var bufIndex = Math.floor(index / 8);
        return (_buffer[bufIndex] >>> 7 - index % 8 & 1) == 1;
      };
      _this.put = function(num, length) {
        for (var i = 0; i < length; i += 1) {
          _this.putBit((num >>> length - i - 1 & 1) == 1);
        }
      };
      _this.getLengthInBits = function() {
        return _length;
      };
      _this.putBit = function(bit) {
        var bufIndex = Math.floor(_length / 8);
        if (_buffer.length <= bufIndex) {
          _buffer.push(0);
        }
        if (bit) {
          _buffer[bufIndex] |= 128 >>> _length % 8;
        }
        _length += 1;
      };
      return _this;
    };
    var qrNumber = function(data) {
      var _mode = QRMode.MODE_NUMBER;
      var _data = data;
      var _this = {};
      _this.getMode = function() {
        return _mode;
      };
      _this.getLength = function(buffer) {
        return _data.length;
      };
      _this.write = function(buffer) {
        var data2 = _data;
        var i = 0;
        while (i + 2 < data2.length) {
          buffer.put(strToNum(data2.substring(i, i + 3)), 10);
          i += 3;
        }
        if (i < data2.length) {
          if (data2.length - i == 1) {
            buffer.put(strToNum(data2.substring(i, i + 1)), 4);
          } else if (data2.length - i == 2) {
            buffer.put(strToNum(data2.substring(i, i + 2)), 7);
          }
        }
      };
      var strToNum = function(s) {
        var num = 0;
        for (var i = 0; i < s.length; i += 1) {
          num = num * 10 + chatToNum(s.charAt(i));
        }
        return num;
      };
      var chatToNum = function(c) {
        if ("0" <= c && c <= "9") {
          return c.charCodeAt(0) - "0".charCodeAt(0);
        }
        throw "illegal char :" + c;
      };
      return _this;
    };
    var qrAlphaNum = function(data) {
      var _mode = QRMode.MODE_ALPHA_NUM;
      var _data = data;
      var _this = {};
      _this.getMode = function() {
        return _mode;
      };
      _this.getLength = function(buffer) {
        return _data.length;
      };
      _this.write = function(buffer) {
        var s = _data;
        var i = 0;
        while (i + 1 < s.length) {
          buffer.put(
            getCode(s.charAt(i)) * 45 + getCode(s.charAt(i + 1)),
            11
          );
          i += 2;
        }
        if (i < s.length) {
          buffer.put(getCode(s.charAt(i)), 6);
        }
      };
      var getCode = function(c) {
        if ("0" <= c && c <= "9") {
          return c.charCodeAt(0) - "0".charCodeAt(0);
        } else if ("A" <= c && c <= "Z") {
          return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
        } else {
          switch (c) {
            case " ":
              return 36;
            case "$":
              return 37;
            case "%":
              return 38;
            case "*":
              return 39;
            case "+":
              return 40;
            case "-":
              return 41;
            case ".":
              return 42;
            case "/":
              return 43;
            case ":":
              return 44;
            default:
              throw "illegal char :" + c;
          }
        }
      };
      return _this;
    };
    var qr8BitByte = function(data) {
      var _mode = QRMode.MODE_8BIT_BYTE;
      var _data = data;
      var _bytes = qrcode2.stringToBytes(data);
      var _this = {};
      _this.getMode = function() {
        return _mode;
      };
      _this.getLength = function(buffer) {
        return _bytes.length;
      };
      _this.write = function(buffer) {
        for (var i = 0; i < _bytes.length; i += 1) {
          buffer.put(_bytes[i], 8);
        }
      };
      return _this;
    };
    var qrKanji = function(data) {
      var _mode = QRMode.MODE_KANJI;
      var _data = data;
      var stringToBytes = qrcode2.stringToBytesFuncs["SJIS"];
      if (!stringToBytes) {
        throw "sjis not supported.";
      }
      !(function(c, code) {
        var test = stringToBytes(c);
        if (test.length != 2 || (test[0] << 8 | test[1]) != code) {
          throw "sjis not supported.";
        }
      })("\u53CB", 38726);
      var _bytes = stringToBytes(data);
      var _this = {};
      _this.getMode = function() {
        return _mode;
      };
      _this.getLength = function(buffer) {
        return ~~(_bytes.length / 2);
      };
      _this.write = function(buffer) {
        var data2 = _bytes;
        var i = 0;
        while (i + 1 < data2.length) {
          var c = (255 & data2[i]) << 8 | 255 & data2[i + 1];
          if (33088 <= c && c <= 40956) {
            c -= 33088;
          } else if (57408 <= c && c <= 60351) {
            c -= 49472;
          } else {
            throw "illegal char at " + (i + 1) + "/" + c;
          }
          c = (c >>> 8 & 255) * 192 + (c & 255);
          buffer.put(c, 13);
          i += 2;
        }
        if (i < data2.length) {
          throw "illegal char at " + (i + 1);
        }
      };
      return _this;
    };
    var byteArrayOutputStream = function() {
      var _bytes = [];
      var _this = {};
      _this.writeByte = function(b) {
        _bytes.push(b & 255);
      };
      _this.writeShort = function(i) {
        _this.writeByte(i);
        _this.writeByte(i >>> 8);
      };
      _this.writeBytes = function(b, off, len) {
        off = off || 0;
        len = len || b.length;
        for (var i = 0; i < len; i += 1) {
          _this.writeByte(b[i + off]);
        }
      };
      _this.writeString = function(s) {
        for (var i = 0; i < s.length; i += 1) {
          _this.writeByte(s.charCodeAt(i));
        }
      };
      _this.toByteArray = function() {
        return _bytes;
      };
      _this.toString = function() {
        var s = "";
        s += "[";
        for (var i = 0; i < _bytes.length; i += 1) {
          if (i > 0) {
            s += ",";
          }
          s += _bytes[i];
        }
        s += "]";
        return s;
      };
      return _this;
    };
    var base64EncodeOutputStream = function() {
      var _buffer = 0;
      var _buflen = 0;
      var _length = 0;
      var _base64 = "";
      var _this = {};
      var writeEncoded = function(b) {
        _base64 += String.fromCharCode(encode(b & 63));
      };
      var encode = function(n) {
        if (n < 0) {
        } else if (n < 26) {
          return 65 + n;
        } else if (n < 52) {
          return 97 + (n - 26);
        } else if (n < 62) {
          return 48 + (n - 52);
        } else if (n == 62) {
          return 43;
        } else if (n == 63) {
          return 47;
        }
        throw "n:" + n;
      };
      _this.writeByte = function(n) {
        _buffer = _buffer << 8 | n & 255;
        _buflen += 8;
        _length += 1;
        while (_buflen >= 6) {
          writeEncoded(_buffer >>> _buflen - 6);
          _buflen -= 6;
        }
      };
      _this.flush = function() {
        if (_buflen > 0) {
          writeEncoded(_buffer << 6 - _buflen);
          _buffer = 0;
          _buflen = 0;
        }
        if (_length % 3 != 0) {
          var padlen = 3 - _length % 3;
          for (var i = 0; i < padlen; i += 1) {
            _base64 += "=";
          }
        }
      };
      _this.toString = function() {
        return _base64;
      };
      return _this;
    };
    var base64DecodeInputStream = function(str) {
      var _str = str;
      var _pos = 0;
      var _buffer = 0;
      var _buflen = 0;
      var _this = {};
      _this.read = function() {
        while (_buflen < 8) {
          if (_pos >= _str.length) {
            if (_buflen == 0) {
              return -1;
            }
            throw "unexpected end of file./" + _buflen;
          }
          var c = _str.charAt(_pos);
          _pos += 1;
          if (c == "=") {
            _buflen = 0;
            return -1;
          } else if (c.match(/^\s$/)) {
            continue;
          }
          _buffer = _buffer << 6 | decode(c.charCodeAt(0));
          _buflen += 6;
        }
        var n = _buffer >>> _buflen - 8 & 255;
        _buflen -= 8;
        return n;
      };
      var decode = function(c) {
        if (65 <= c && c <= 90) {
          return c - 65;
        } else if (97 <= c && c <= 122) {
          return c - 97 + 26;
        } else if (48 <= c && c <= 57) {
          return c - 48 + 52;
        } else if (c == 43) {
          return 62;
        } else if (c == 47) {
          return 63;
        } else {
          throw "c:" + c;
        }
      };
      return _this;
    };
    var gifImage = function(width, height) {
      var _width = width;
      var _height = height;
      var _data = new Array(width * height);
      var _this = {};
      _this.setPixel = function(x, y, pixel) {
        _data[y * _width + x] = pixel;
      };
      _this.write = function(out) {
        out.writeString("GIF87a");
        out.writeShort(_width);
        out.writeShort(_height);
        out.writeByte(128);
        out.writeByte(0);
        out.writeByte(0);
        out.writeByte(0);
        out.writeByte(0);
        out.writeByte(0);
        out.writeByte(255);
        out.writeByte(255);
        out.writeByte(255);
        out.writeString(",");
        out.writeShort(0);
        out.writeShort(0);
        out.writeShort(_width);
        out.writeShort(_height);
        out.writeByte(0);
        var lzwMinCodeSize = 2;
        var raster = getLZWRaster(lzwMinCodeSize);
        out.writeByte(lzwMinCodeSize);
        var offset = 0;
        while (raster.length - offset > 255) {
          out.writeByte(255);
          out.writeBytes(raster, offset, 255);
          offset += 255;
        }
        out.writeByte(raster.length - offset);
        out.writeBytes(raster, offset, raster.length - offset);
        out.writeByte(0);
        out.writeString(";");
      };
      var bitOutputStream = function(out) {
        var _out = out;
        var _bitLength = 0;
        var _bitBuffer = 0;
        var _this2 = {};
        _this2.write = function(data, length) {
          if (data >>> length != 0) {
            throw "length over";
          }
          while (_bitLength + length >= 8) {
            _out.writeByte(255 & (data << _bitLength | _bitBuffer));
            length -= 8 - _bitLength;
            data >>>= 8 - _bitLength;
            _bitBuffer = 0;
            _bitLength = 0;
          }
          _bitBuffer = data << _bitLength | _bitBuffer;
          _bitLength = _bitLength + length;
        };
        _this2.flush = function() {
          if (_bitLength > 0) {
            _out.writeByte(_bitBuffer);
          }
        };
        return _this2;
      };
      var getLZWRaster = function(lzwMinCodeSize) {
        var clearCode = 1 << lzwMinCodeSize;
        var endCode = (1 << lzwMinCodeSize) + 1;
        var bitLength = lzwMinCodeSize + 1;
        var table = lzwTable();
        for (var i = 0; i < clearCode; i += 1) {
          table.add(String.fromCharCode(i));
        }
        table.add(String.fromCharCode(clearCode));
        table.add(String.fromCharCode(endCode));
        var byteOut = byteArrayOutputStream();
        var bitOut = bitOutputStream(byteOut);
        bitOut.write(clearCode, bitLength);
        var dataIndex = 0;
        var s = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;
        while (dataIndex < _data.length) {
          var c = String.fromCharCode(_data[dataIndex]);
          dataIndex += 1;
          if (table.contains(s + c)) {
            s = s + c;
          } else {
            bitOut.write(table.indexOf(s), bitLength);
            if (table.size() < 4095) {
              if (table.size() == 1 << bitLength) {
                bitLength += 1;
              }
              table.add(s + c);
            }
            s = c;
          }
        }
        bitOut.write(table.indexOf(s), bitLength);
        bitOut.write(endCode, bitLength);
        bitOut.flush();
        return byteOut.toByteArray();
      };
      var lzwTable = function() {
        var _map = {};
        var _size = 0;
        var _this2 = {};
        _this2.add = function(key2) {
          if (_this2.contains(key2)) {
            throw "dup key:" + key2;
          }
          _map[key2] = _size;
          _size += 1;
        };
        _this2.size = function() {
          return _size;
        };
        _this2.indexOf = function(key2) {
          return _map[key2];
        };
        _this2.contains = function(key2) {
          return typeof _map[key2] != "undefined";
        };
        return _this2;
      };
      return _this;
    };
    var createDataURL = function(width, height, getPixel) {
      var gif = gifImage(width, height);
      for (var y = 0; y < height; y += 1) {
        for (var x = 0; x < width; x += 1) {
          gif.setPixel(x, y, getPixel(x, y));
        }
      }
      var b = byteArrayOutputStream();
      gif.write(b);
      var base64 = base64EncodeOutputStream();
      var bytes = b.toByteArray();
      for (var i = 0; i < bytes.length; i += 1) {
        base64.writeByte(bytes[i]);
      }
      base64.flush();
      return "data:image/gif;base64," + base64;
    };
    return qrcode2;
  })();
  !(function() {
    qrcode.stringToBytesFuncs["UTF-8"] = function(s) {
      function toUTF8Array(str) {
        var utf8 = [];
        for (var i = 0; i < str.length; i++) {
          var charcode = str.charCodeAt(i);
          if (charcode < 128) utf8.push(charcode);
          else if (charcode < 2048) {
            utf8.push(
              192 | charcode >> 6,
              128 | charcode & 63
            );
          } else if (charcode < 55296 || charcode >= 57344) {
            utf8.push(
              224 | charcode >> 12,
              128 | charcode >> 6 & 63,
              128 | charcode & 63
            );
          } else {
            i++;
            charcode = 65536 + ((charcode & 1023) << 10 | str.charCodeAt(i) & 1023);
            utf8.push(
              240 | charcode >> 18,
              128 | charcode >> 12 & 63,
              128 | charcode >> 6 & 63,
              128 | charcode & 63
            );
          }
        }
        return utf8;
      }
      return toUTF8Array(s);
    };
  })();
  (function(factory) {
    if (typeof define === "function" && define.amd) {
      define([], factory);
    } else if (typeof exports === "object") {
      module.exports = factory();
    }
  })(function() {
    return qrcode;
  });
  var qrcode_esm_default = qrcode;

  // js/qr.js
  function baseUrl() {
    const s = db.get("settings") || {};
    let b = (s.baseUrl || new URL(ROOT, location.href).href).trim().replace(/\/+$/, "");
    return b;
  }
  var urls = {
    table: (no) => `${baseUrl()}/order.html?table=${no}`,
    parcel: () => `${baseUrl()}/parcel.html`,
    review: () => `${baseUrl()}/review.html`,
    menu: () => `${baseUrl()}/menu.html`
  };
  function qrSVG(text, { size = 220, margin = 2, dark = "#0a0909", light = "#ffffff" } = {}) {
    const qr = qrcode_esm_default(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const total = n + margin * 2;
    let path = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${text}"><rect width="${total}" height="${total}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
  }
  function qrPNG(text, { px = 1024, logo } = {}) {
    return new Promise((resolve) => {
      const svg = qrSVG(text, { size: px, margin: 3 });
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = px;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, px, px);
        const done = () => c.toBlob((b) => resolve(b), "image/png");
        if (!logo) return done();
        const l = new Image();
        l.onload = () => {
          const s = px * 0.2;
          g.fillStyle = "#fff";
          g.fillRect((px - s) / 2 - 6, (px - s) / 2 - 6, s + 12, s + 12);
          g.drawImage(l, (px - s) / 2, (px - s) / 2, s, s * (l.height / l.width));
          done();
        };
        l.onerror = done;
        l.src = logo;
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }

  // js/auth.js
  var key = (role) => `bbc:session:${role}`;
  var currentUser = (role) => session.get(key(role));
  function logout(role) {
    session.del(key(role));
    location.href = url(`${role}/login.html`);
  }
  function guard(role) {
    const u = currentUser(role);
    const fresh = u ? db.get("staff", u.id) : null;
    if (!u || !fresh || fresh.active === false) {
      session.del(key(role));
      location.replace(`${url(role + "/login.html")}?next=${encodeURIComponent(location.pathname.split("/").pop())}`);
      return null;
    }
    return u;
  }

  // js/portal.js
  var ADMIN_NAV = [
    { group: "admin.nav.overview", items: [
      { id: "dashboard", icon: "dashboard", key: "admin.nav.dashboard", href: "dashboard.html" },
      { id: "orders", icon: "receipt", key: "admin.nav.orders", href: "orders.html" },
      { id: "reports", icon: "chart", key: "admin.nav.reports", href: "reports.html" }
    ] },
    { group: "admin.nav.content", items: [
      { id: "menu", icon: "utensils", key: "admin.nav.menu", href: "menu.html" },
      { id: "specials", icon: "sparkle", key: "admin.nav.specials", href: "specials.html" },
      { id: "offers", icon: "tag", key: "admin.nav.offers", href: "offers.html" },
      { id: "gallery", icon: "image", key: "admin.nav.gallery", href: "gallery.html" },
      { id: "reviews", icon: "star", key: "admin.nav.reviews", href: "reviews.html" }
    ] },
    { group: "admin.nav.operations", items: [
      { id: "staff", icon: "users", key: "admin.nav.staff", href: "staff.html" },
      { id: "tables", icon: "qr", key: "admin.nav.tables", href: "tables.html" },
      { id: "settings", icon: "settings", key: "admin.nav.settings", href: "settings.html" }
    ] }
  ];
  var WAITER_NAV = [
    { group: null, items: [
      { id: "dashboard", icon: "table", key: "waiter.nav.tables", href: "dashboard.html" },
      { id: "orders", icon: "receipt", key: "waiter.nav.orders", href: "orders.html" },
      { id: "parcels", icon: "bag", key: "waiter.nav.parcels", href: "parcels.html" },
      { id: "stats", icon: "trending", key: "waiter.nav.stats", href: "stats.html" }
    ] }
  ];
  function mountPortal({ role, active, titleKey }) {
    const user = guard(role);
    if (!user) return null;
    const nav = role === "admin" ? ADMIN_NAV : WAITER_NAV;
    document.body.classList.add("portal", `portal--${role}`);
    const app = $("#app") || $("main");
    const shell = el("div", { class: "portal-shell" });
    const groups = nav.map((g) => `${g.group ? `<div class="sidebar__group" data-i18n="${g.group}"></div>` : ""}${g.items.map((i) => `<a class="sidebar__link ${i.id === active ? "is-active" : ""}" href="${i.href}" ${i.id === active ? 'aria-current="page"' : ""}>${icon(i.icon)}<span data-i18n="${i.key}"></span><span class="count" data-count-for="${i.id}"></span></a>`).join("")}`).join("");
    const side = el("aside", { class: "sidebar dark", id: "sidebar", html: `
    <div class="sidebar__brand"><img src="${url("assets/logo/logo-mark-160.png")}" alt=""><b>Billy Belly<br>Chicken<small data-i18n="${role === "admin" ? "admin.portal" : "waiter.portal"}"></small></b></div>
    <nav class="sidebar__nav" aria-label="Portal">${groups}</nav>
    <div class="sidebar__foot"><div class="user-chip"><img src="${imgSrc(user.photo)}" alt=""><div><b>${user.name}</b><small>${role === "admin" ? "Admin" : user.empId || "Waiter"}</small></div></div>
      <span data-lang-mount></span>
      <a class="btn btn--ghost btn--sm btn--block" href="${url("index.html")}" target="_blank" rel="noopener">${icon("globe")}<span data-i18n="portal.viewSite"></span></a>
      <button class="btn btn--dark btn--sm btn--block" type="button" data-logout>${icon("logout")}<span data-i18n="portal.logout"></span></button></div>` });
    const back = el("div", { class: "sidebar-backdrop" });
    const main = el("div", { class: "portal-main" });
    const top = el("header", { class: "topbar", html: `<button class="icon-btn menu-btn" type="button" aria-controls="sidebar" aria-expanded="false" data-i18n-aria="nav.menuToggle">${icon("menu")}</button><div class="topbar__title" data-i18n="${titleKey || ""}"></div><div class="topbar__spacer"></div><div data-topbar-slot class="cluster"></div>` });
    app.replaceWith(shell);
    main.append(top, app);
    shell.append(side, back, main);
    const set = (open) => {
      side.classList.toggle("is-open", open);
      back.classList.toggle("is-open", open);
      $(".menu-btn", top).setAttribute("aria-expanded", open);
    };
    $(".menu-btn", top).addEventListener("click", () => set(!side.classList.contains("is-open")));
    back.addEventListener("click", () => set(false));
    $$(".sidebar__link", side).forEach((a) => a.addEventListener("click", () => set(false)));
    $("[data-logout]", side).addEventListener("click", () => logout(role));
    mountLangToggle($("[data-lang-mount]", side));
    const s = db.get("settings");
    void s;
    hydrateIcons();
    applyI18n();
    initCommonUI();
    onLangChange(() => applyI18n());
    document.body.classList.add("page-enter");
    return user;
  }

  // js/components/adminPage.js
  async function bootAdmin(name, run) {
    await init();
    await initI18n(["admin-common", `admin-${name}`]);
    const user = mountPortal({ role: "admin", active: name, titleKey: `admin-${name}.title` });
    if (!user) return;
    const settings = db.get("settings");
    setCurrency(settings.currency);
    hydrateIcons();
    await run({ user, app: $(".portal-main .page") || $("#app"), settings });
    hydrateIcons();
  }

  // js/pages/__entry_admin-tables.js
  (async () => {
    bootAdmin("tables", () => {
      const T = (k) => () => t("admin-tables." + k);
      const C = (k) => () => t("admin-common." + k);
      const waiters = () => db.list("staff", (s) => s.role === "waiter").map((s) => ({ value: s.id, label: s.name }));
      const crud = createCrud({
        container: $("#crud"),
        collection: "tables",
        entity: T("entity"),
        modalSize: "md",
        sort: (a, b) => a.number - b.number,
        searchText: (x) => `${x.number} ${x.area}`,
        columns: [
          { key: "number", label: T("no"), sortable: true, render: (x) => `<b>${x.number}</b>` },
          { key: "seats", label: T("seats") },
          { key: "area", label: T("area"), render: (x) => esc(x.area || "") },
          { key: "waiterId", label: T("waiter"), render: (x) => esc(db.get("staff", x.waiterId)?.name || t("admin-tables.none")) },
          { key: "active", label: C("active"), render: (x) => t(x.active !== false ? "admin-common.yes" : "admin-common.no") }
        ],
        fields: [
          { name: "number", label: T("no"), type: "number", min: 1, max: 999, required: true, validate: (v, st) => db.find("tables", (x) => Number(x.number) === Number(v) && x.id !== st.id) ? t("admin-tables.dup") : "" },
          { name: "seats", label: T("seats"), type: "number", min: 1, max: 30, default: 4 },
          { name: "area", label: T("area"), type: "text", default: "AC Hall" },
          { name: "waiterId", label: T("waiter"), type: "select", get options() {
            return [{ value: "", label: t("admin-tables.none") }, ...waiters()];
          } },
          { name: "active", label: C("active"), type: "switch", default: true }
        ],
        newItem: () => ({ number: Math.max(0, ...db.list("tables").map((x) => x.number)) + 1, seats: 4, area: "AC Hall", waiterId: "", active: true }),
        beforeSave: (v) => ({ ...v, number: Number(v.number), seats: Number(v.seats), waiterId: v.waiterId || null }),
        canDelete: (x) => os_open(x.number) ? t("admin-tables.inUse") : true,
        afterChange: drawQR
      });
      function os_open(no) {
        return db.list("tableSessions", (s) => String(s.tableNo) === String(no) && !s.closedAt).length > 0;
      }
      const grid = $("#qr-grid");
      const base = $("#base");
      base.value = db.get("settings").baseUrl || "";
      $("#base-save").addEventListener("click", () => {
        const v = base.value.trim();
        if (v && !/^https?:\/\/[^\s/]+\.?[^\s]*$/i.test(v)) return toast(t("admin-tables.invalidUrl"), { type: "warn" });
        db.update("settings", { baseUrl: v.replace(/\/+$/, "") });
        db.audit("settings:baseUrl", v || "(site address)");
        toast(t("admin-tables.baseSaved"), { type: "ok" });
        drawQR();
      });
      function card(label, sub, link, file) {
        const n = el("article", { class: "qr-card" });
        n.innerHTML = `<div class="qr-card__brand"><img src="${url("assets/logo/logo-mark-160.png")}" alt=""><b>Billy Belly Chicken</b></div><h3 class="qr-card__t">${esc(label)}</h3><div class="qr-card__qr">${qrSVG(link, { size: 200 })}</div><p class="qr-card__s">${esc(sub)}</p><code class="qr-card__u">${esc(link)}</code>
      <div class="qr-card__a"><button class="btn btn--ghost btn--sm" data-png type="button">${icon("download")}<span>${t("admin-tables.png")}</span></button><button class="btn btn--ghost btn--sm" data-copy type="button">${icon("copy")}<span>${t("admin-tables.copy")}</span></button></div>`;
        n.querySelector("[data-png]").onclick = async () => download(file, await qrPNG(link), "image/png");
        n.querySelector("[data-copy]").onclick = async () => {
          try {
            await navigator.clipboard.writeText(link);
          } catch {
          }
          toast(t("admin-tables.copied"));
        };
        return n;
      }
      function drawQR() {
        grid.replaceChildren(
          ...db.list("tables", (x) => x.active !== false).sort((a, b) => a.number - b.number).map((x) => card(`${t("common.table")} ${x.number}`, t("admin-tables.scan"), urls.table(x.number), `table-${x.number}.png`)),
          card(t("admin-tables.parcelQr"), t("admin-tables.scanParcel"), urls.parcel(), "parcel.png"),
          card(t("admin-tables.reviewQr"), t("admin-tables.scanReview"), urls.review(), "review.png")
        );
      }
      $("#print").addEventListener("click", () => {
        document.body.classList.add("printing-qr");
        window.print();
        setTimeout(() => document.body.classList.remove("printing-qr"), 600);
      });
      onLangChange(drawQR);
      drawQR();
    });
  })();
})();
