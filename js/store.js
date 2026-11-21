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
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

  /** "40 min", "1h 20m", "2h" */
  const fmtDur = (min) => {
    min = Math.max(0, Math.round(min));
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  const AREAS = {
    health: { name: "Health", color: "#ff5c8a", emoji: "🏃" },
    mind: { name: "Mind", color: "#8b7cff", emoji: "🧘" },
    work: { name: "Work", color: "#4dd8ff", emoji: "💼" },
    money: { name: "Money", color: "#5cffb0", emoji: "💰" },
    learning: { name: "Learning", color: "#ffd84d", emoji: "📚" },
    people: { name: "People", color: "#ffa24d", emoji: "💬" },
  };

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
    settings: { sound: true, reduceMotion: false, hyperfocusMin: 90, dayEnds: 22, alerts: false },
    tasks: [],
    habits: [],
    checkins: {},
    schedule: [],
    reviews: [],
    sessions: [],
    focus: null,
    currentId: null,
    view: "now",
  });

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const s = JSON.parse(raw);
      const d = defaults();
      return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
    } catch { return defaults(); }
  };

  const store = {
    state: load(),
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage unavailable: keep in memory */ } },
    reset() { this.state = defaults(); this.save(); },
    replace(obj) { const d = defaults(); this.state = { ...d, ...obj, settings: { ...d.settings, ...(obj.settings || {}) } }; this.save(); },
  };

  // ---------- Derived selectors ----------
  const sel = {
    task: (id) => store.state.tasks.find((t) => t.id === id),
    topToday: () => store.state.tasks.filter((t) => t.topDate === today() && t.status !== "done"),
    doneToday: () => store.state.tasks.filter((t) => t.status === "done" && t.doneAt && dkey(new Date(t.doneAt)) === today()),
    inbox: () => store.state.tasks.filter((t) => t.status === "inbox"),
    ready: () => store.state.tasks.filter((t) => t.status === "ready" && t.topDate !== today()),
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
      const pool = [...sel.ready(), ...sel.inbox()];
      if (!e) return pool.slice(0, 4);
      return pool.filter((t) => (t.energy || 2) <= e).sort((a, b) => (a.est || 99) - (b.est || 99)).slice(0, 4);
    },
    winsToday: () => sel.doneToday().length + store.state.habits.filter((h) => h.log[today()]).length,
  };

  Object.assign(window.LOS, { pad, dkey, addDays, uid, esc, today, nowMin, toMin, fmtDur, AREAS, HABIT_TEMPLATES, MOODS, ENERGY, MAX_TOP, store, sel });
})();
