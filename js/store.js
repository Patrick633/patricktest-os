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

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const s = JSON.parse(raw);
      const d = defaults();
      return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, screen: { ...d.screen, ...(s.screen || {}) }, spirit: { ...d.spirit, ...(s.spirit || {}) }, news: { ...d.news, ...(s.news || {}) }, timelog: { ...d.timelog, ...(s.timelog || {}) } };
    } catch { return defaults(); }
  };

  const store = {
    state: load(),
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage unavailable: keep in memory */ } },
    reset() { this.state = defaults(); this.save(); },
    replace(obj) { const d = defaults(); this.state = { ...d, ...obj, settings: { ...d.settings, ...(obj.settings || {}) }, screen: { ...d.screen, ...(obj.screen || {}) }, spirit: { ...d.spirit, ...(obj.spirit || {}) }, news: { ...d.news, ...(obj.news || {}) }, timelog: { ...d.timelog, ...(obj.timelog || {}) } }; this.save(); },
  };

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

  Object.assign(window.LOS, { weekStart, monthKey, makePlan, planLabel, planArrived, pad, dkey, addDays, uid, esc, today, nowMin, toMin, fmtDur, AREAS, HABIT_TEMPLATES, MOODS, ENERGY, MAX_TOP, store, sel });
})();
