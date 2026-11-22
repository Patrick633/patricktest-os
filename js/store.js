/* Life OS — state, persistence and date helpers.
   Everything is stored in this browser's localStorage. */
window.LOS = window.LOS || {};
(() => {
  "use strict";

  const pad = (n) => String(n).padStart(2, "0");
  const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => dkey();
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const toMin = (hhmm) => { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };

  // ---------- planning (no hard deadlines: things "arrive", they never become overdue) ----------
  const weekStart = (d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dkey(x); }; // Monday
  const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const shortDate = (k) => new Date(k + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const makePlan = (kind, date) => {
    const now = new Date();
    if (kind === "tomorrow") return { scope: "day", key: dkey(addDays(now, 1)) };
    if (kind === "week") return { scope: "week", key: weekStart(now) };
    if (kind === "nextweek") return { scope: "week", key: weekStart(addDays(now, 7)) };
    if (kind === "month") return { scope: "month", key: monthKey(now) };
    if (kind === "nextmonth") return { scope: "month", key: monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1)) };
    if (kind === "date" && date) return { scope: "day", key: date };
    return null;
  };
  const planLabel = (p) => {
    if (!p) return "";
    const now = new Date();
    if (p.scope === "day") {
      if (p.key === dkey(now)) return "Today";
      if (p.key === dkey(addDays(now, 1))) return "Tomorrow";
      if (p.key < dkey(now)) return `Since ${shortDate(p.key)}`;
      return shortDate(p.key);
    }
    if (p.scope === "week") {
      const ws = weekStart(now);
      if (p.key === ws) return "This week";
      if (p.key === weekStart(addDays(now, 7))) return "Next week";
      if (p.key < ws) return "Since last week";
      return `Week of ${new Date(p.key + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    const mk = monthKey(now);
    if (p.key === mk) return "This month";
    if (p.key < mk) return "Since last month";
    return new Date(p.key + "-15T12:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  /** has the planned time arrived? (today, this week or this month) */
  const planArrived = (p) => {
    if (!p) return true;
    if (p.scope === "day") return p.key <= dkey();
    if (p.scope === "week") return p.key <= weekStart();
    return p.key <= monthKey();
  };
  const planSort = (p) => (p.scope === "month" ? `${p.key}-32` : p.key);

  /** "40 min", "1h 20m", "2h" */
  const fmtDur = (min) => {
    min = Math.max(0, Math.round(min));
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  const DEFAULT_AREAS = [
    { id: "health", name: "Health", color: "#ff5c8a", emoji: "🏃" },
    { id: "mind", name: "Mind", color: "#8b7cff", emoji: "🧘" },
    { id: "work", name: "Work", color: "#4dd8ff", emoji: "💼" },
    { id: "money", name: "Money", color: "#5cffb0", emoji: "💰" },
    { id: "learning", name: "Learning", color: "#ffd84d", emoji: "📚" },
    { id: "people", name: "People", color: "#ffa24d", emoji: "💬" },
  ];
  const AREA_COLORS = ["#ff5c8a", "#8b7cff", "#4dd8ff", "#5cffb0", "#ffd84d", "#ffa24d", "#ff7ad9", "#c8ff4d", "#9a9aae", "#4d9fff"];
  /** Live map of life areas. The same object is updated in place, so every module always sees the current areas. */
  const AREAS = {};
  const applyAreas = (st) => {
    Object.keys(AREAS).forEach((k) => delete AREAS[k]);
    const list = st && Array.isArray(st.areaDefs) ? st.areaDefs : DEFAULT_AREAS;
    list.forEach((a) => {
      if (!a || !/^[\w-]{1,40}$/.test(String(a.id))) return;
      AREAS[a.id] = {
        name: String(a.name || "Area").slice(0, 30),
        emoji: String(a.emoji || "").slice(0, 8),
        color: /^#[0-9a-f]{6}$/i.test(String(a.color)) ? a.color : "#9a9aae",
      };
    });
    return st;
  };
  applyAreas(null);

  const HABIT_TEMPLATES = {
    health: [["💧", "Drink 2L of water", "One glass"], ["🏃", "Move for 30 min", "10-min walk"]],
    mind: [["🧘", "Meditate 10 min", "3 deep breaths"], ["📓", "Journal", "One sentence"]],
    work: [["🎯", "Plan my top 3", "Pick just 1"]],
    money: [["💰", "Log expenses", "Log one"]],
    learning: [["📚", "Read 20 pages", "Read 1 page"]],
    people: [["💬", "Reach out to someone", "Send one message"]],
  };

  const MOODS = [
    { e: "😫", l: "Drained" },
    { e: "🙁", l: "Low" },
    { e: "😐", l: "Okay" },
    { e: "🙂", l: "Good" },
    { e: "😄", l: "Great" },
  ];
  const ENERGY = [
    { id: 1, e: "🪫", l: "Low", hint: "Small, easy wins" },
    { id: 2, e: "🔋", l: "Medium", hint: "Normal tasks" },
    { id: 3, e: "⚡", l: "High", hint: "Hard, deep work" },
  ];

  const MAX_TOP = 3;
  const KEY = "lifeos.v2";

  const defaults = () => ({
    v: 2,
    onboarded: false,
    name: "",
    areas: [],
    settings: { sound: true, reduceMotion: false, hyperfocusMin: 90, dayEnds: 22, alerts: false, theme: "dark" },
    tasks: [],
    habits: [],
    checkins: {},
    schedule: [],
    reviews: [],
    sessions: [],
    screen: { log: {}, videos: [], sites: {}, softLimit: null, extSync: null },
    projects: [],
    timelog: { current: null, entries: [], custom: [] },
    spirit: { tradition: null, showOnNow: true, plan: { id: null, day: 0, log: {} }, gratitude: {}, prayers: [], quiet: {}, quietRun: null },
    news: { items: [], kev: [], fetchedAt: 0, read: {}, status: {}, filter: "all", timerEnd: null },
    focus: null,
    currentId: null,
    view: "now",
  });

  // ---------- security: clean any data that comes from outside (storage, import, cloud, extension) ----------
  // Text is always HTML-escaped when shown; this also makes ids, numbers, dates and object keys safe
  // so nothing can break out of an HTML attribute.
  const NUM_KEYS = new Set(["est", "energy", "mood", "spent", "dur", "day", "weeklyHours", "pickups", "phone", "mac", "progress", "min", "sec", "doneAt", "created", "softLimit", "hyperfocusMin", "dayEnds", "_updatedAt", "score", "comments"]);
  const DATEISH_KEYS = new Set(["start", "end", "at", "date", "key", "time", "answeredAt", "topDate", "added"]);
  const SAFE_ID = /^[\w-]{1,80}$/;
  const SAFE_DATEISH = /^[0-9T:.+\-Z ]{2,32}$/;
  const BAD_KEY = /[<>"'`&\\=\s]/;
  const clean = (v, k = "") => {
    if (Array.isArray(v)) return v.map((x) => clean(x, k));
    if (v && typeof v === "object") {
      const o = {};
      for (const [kk, vv] of Object.entries(v)) {
        if (kk === "__proto__" || kk === "constructor" || kk === "prototype" || (BAD_KEY.test(kk) && k !== "sites" && k !== "read")) continue;
        o[kk] = clean(vv, kk);
      }
      return o;
    }
    if (v === null || v === undefined) return v;
    if (NUM_KEYS.has(k)) { const n = Number(v); return v === "" ? null : Number.isFinite(n) ? n : null; }
    if (DATEISH_KEYS.has(k)) { if (typeof v === "number") return Number.isFinite(v) ? v : null; return typeof v === "string" && SAFE_DATEISH.test(v) ? v : null; }
    if ((k === "id" || /Id$/.test(k)) && typeof v === "string" && !SAFE_ID.test(v)) return k === "id" ? uid() : null;
    if (typeof v === "string" && v.length > 20000) return v.slice(0, 20000);
    return v;
  };
  /** drop records that are missing what the app needs (a bad file must never crash the app) */
  const isDay = (x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const arr = (x) => (Array.isArray(x) ? x : []);
  const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
  const str = (x) => (typeof x === "string" ? x : x == null ? "" : String(x));
  const repair = (st) => {
    st.tasks = arr(st.tasks).filter((t) => t && t.id).map((t) => ({ ...t, title: str(t.title), note: str(t.note), steps: arr(t.steps).filter((x) => x && x.id).map((x) => ({ ...x, text: str(x.text) })) }));
    st.habits = arr(st.habits).filter((h) => h && h.id).map((h) => ({ ...h, name: str(h.name), emoji: str(h.emoji), mini: str(h.mini), log: obj(h.log) }));
    st.schedule = arr(st.schedule).filter((e) => e && e.id && isDay(e.date) && /^\d{2}:\d{2}$/.test(str(e.time))).map((e) => ({ ...e, label: str(e.label) }));
    st.projects = arr(st.projects).filter((p) => p && p.id && isDay(p.start) && isDay(p.end)).map((p) => ({
      ...p, title: str(p.title), emoji: str(p.emoji), why: str(p.why), log: obj(p.log),
      phases: arr(p.phases).filter((ph) => ph && ph.id && isDay(ph.start) && isDay(ph.end)).map((ph) => ({ ...ph, title: str(ph.title), steps: arr(ph.steps).filter((x) => x && x.id).map((x) => ({ ...x, text: str(x.text) })) })),
    }));
    st.checkins = obj(st.checkins);
    st.reviews = arr(st.reviews).filter(Boolean);
    st.sessions = arr(st.sessions).filter((x) => x && isDay(x.date));
    if (st.timelog) {
      const tl = st.timelog;
      tl.entries = arr(tl.entries).filter((e) => e && e.id && Number.isFinite(e.start) && Number.isFinite(e.end)).map((e) => ({ ...e, label: str(e.label), emoji: str(e.emoji) }));
      if (tl.current && !Number.isFinite(tl.current.start)) tl.current = null;
      if (tl.current) tl.current = { ...tl.current, label: str(tl.current.label), emoji: str(tl.current.emoji) };
      tl.custom = arr(tl.custom).filter((p) => Array.isArray(p) && p.length >= 3).map((p) => [str(p[0]), str(p[1]), str(p[2])]);
      if (tl.presets) tl.presets = arr(tl.presets).filter((p) => Array.isArray(p) && p.length >= 3).map((p) => [str(p[0]), str(p[1]), str(p[2])]);
    }
    if (st.spirit) {
      st.spirit.prayers = arr(st.spirit.prayers).filter((x) => x && x.id).map((x) => ({ ...x, text: str(x.text) }));
      st.spirit.gratitude = obj(st.spirit.gratitude);
      st.spirit.quiet = obj(st.spirit.quiet);
      st.spirit.plan = { id: null, day: 0, log: {}, ...obj(st.spirit.plan) };
    }
    if (st.screen) { st.screen.videos = arr(st.screen.videos).filter((v) => v && Number.isFinite(v.at)); st.screen.log = obj(st.screen.log); st.screen.sites = obj(st.screen.sites); }
    return st;
  };

  /** only http(s) links can be opened (blocks javascript: and data: links) */
  const safeUrl = (u) => { try { const x = new URL(String(u)); return x.protocol === "https:" || x.protocol === "http:" ? x.href : "#"; } catch { return "#"; } };

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      return store.merge(JSON.parse(raw));
    } catch { return defaults(); }
  };

  const store = {
    state: null,
    /** save + mark as changed (cloud sync pushes it) */
    save() {
      this.state._updatedAt = Date.now();
      this.write();
      if (typeof window.LOS.onSave === "function") window.LOS.onSave();
    },
    /** write without marking as changed (used when applying data from the cloud) */
    write() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage unavailable: keep in memory */ } },
    reset() { this.state = defaults(); this.save(); },
    merge(o) { o = clean(o && typeof o === "object" ? o : {}); const d = defaults(); return applyAreas(repair({ ...d, ...o, settings: { ...d.settings, ...obj(o.settings) }, screen: { ...d.screen, ...obj(o.screen) }, spirit: { ...d.spirit, ...obj(o.spirit) }, news: { ...d.news, ...obj(o.news) }, timelog: { ...d.timelog, ...obj(o.timelog) } })); },
    replace(obj) { this.state = this.merge(obj); this.save(); },
  };

  store.state = load();

  // ---------- Derived selectors ----------
  const sel = {
    task: (id) => store.state.tasks.find((t) => t.id === id),
    topToday: () => store.state.tasks.filter((t) => t.topDate === today() && t.status !== "done"),
    doneToday: () => store.state.tasks.filter((t) => t.status === "done" && t.doneAt && dkey(new Date(t.doneAt)) === today()),
    inbox: () => store.state.tasks.filter((t) => t.status === "inbox"),
    ready: () => store.state.tasks.filter((t) => t.status === "ready" && t.topDate !== today() && planArrived(t.plan)),
    /** planned for later (hasn't arrived yet) */
    planned: () => store.state.tasks.filter((t) => t.plan && t.status !== "done" && t.status !== "whenever" && t.topDate !== today() && !planArrived(t.plan))
      .sort((a, b) => planSort(a.plan).localeCompare(planSort(b.plan))),
    /** planned things whose time has come (shown as gentle suggestions, never "overdue") */
    arrived: () => store.state.tasks.filter((t) => t.plan && t.status !== "done" && t.status !== "whenever" && t.topDate !== today() && planArrived(t.plan))
      .sort((a, b) => ({ day: 0, week: 1, month: 2 }[a.plan.scope] - { day: 0, week: 1, month: 2 }[b.plan.scope])),
    whenever: () => store.state.tasks.filter((t) => t.status === "whenever"),
    checkin: (k = today()) => store.state.checkins[k],
    energy: () => store.state.checkins[today()]?.energy ?? null,
    habitDone: (h, k = today()) => h.log[k] || null,
    /** consistency: days done in the last n days (no streak that resets to zero) */
    habitCount: (h, n = 7) => {
      let c = 0;
      for (let i = 0; i < n; i++) if (h.log[dkey(addDays(new Date(), -i))]) c++;
      return c;
    },
    dayHabitRatio: (k) => {
      const hs = store.state.habits;
      if (!hs.length) return 0;
      return hs.filter((h) => h.log[k]).length / hs.length;
    },
    /** current task for the Now card */
    current: () => {
      const s = store.state;
      const top = sel.topToday();
      let t = s.currentId && sel.task(s.currentId);
      if (t && t.status !== "done" && t.status !== "whenever") return t;
      if (top.length) return top[0];
      return null;
    },
    /** tasks that fit today's energy (low energy → only low tasks) */
    energyFit: () => {
      const e = sel.energy();
      const pool = [...sel.ready().filter((t) => !t.plan), ...sel.inbox()];
      if (!e) return pool.slice(0, 4);
      return pool.filter((t) => (t.energy || 2) <= e).sort((a, b) => (a.est || 99) - (b.est || 99)).slice(0, 4);
    },
    winsToday: () => sel.doneToday().length + store.state.habits.filter((h) => h.log[today()]).length,
  };

  Object.assign(window.LOS, { applyAreas, DEFAULT_AREAS, AREA_COLORS, clean, safeUrl, weekStart, monthKey, makePlan, planLabel, planArrived, pad, dkey, addDays, uid, esc, today, nowMin, toMin, fmtDur, AREAS, HABIT_TEMPLATES, MOODS, ENERGY, MAX_TOP, store, sel });
})();
