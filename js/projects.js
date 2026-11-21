/* Life OS — Projects: long goals (e.g. "a 6-month study plan") split into phases
   on a timeline, with small steps that flow into Today. Only the current phase is
   expanded, so the big picture never becomes overwhelming. */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  const { dkey, uid, esc, today, fmtDur, store, AREAS, weekStart } = window.LOS;
  const S = () => store.state;
  const P = () => S().projects;
  const app = () => window.LOS.app;

  const ui = { open: null, showAll: false, phaseOpen: null, edit: null, draft: { emoji: "🚀", months: 6, phases: 4, hours: 5, title: "", why: "", start: null, area: "learning" } };
  const EMOJIS = ["🚀", "📚", "💻", "🛡️", "🎓", "🧠", "🔐", "🎸", "🏋️", "✍️", "🌍", "💼"];
  const PHASE_NAMES = { 3: ["Foundations", "Build", "Ship"], 4: ["Foundations", "Build", "Deepen", "Ship"], 6: ["Foundations", "Practice", "Build", "Deepen", "Polish", "Ship"] };
  const KICKOFF = ["Write down what \"done\" looks like", "Pick your main resource (course, book, docs)", "Block 2 sessions on your calendar this week"];

  // ---------------------------------------------------------------- date helpers
  const toDate = (k) => new Date(k + "T12:00");
  const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
  const plusDays = (k, n) => { const x = toDate(k); x.setDate(x.getDate() + n); return dkey(x); };
  const plusMonths = (k, n) => { const x = toDate(k); x.setMonth(x.getMonth() + n); return dkey(x); };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const fmtD = (k) => toDate(k).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtDY = (k) => toDate(k).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // ---------------------------------------------------------------- lookups & metrics
  const byId = (id) => P().find((p) => p.id === id);
  const findPhase = (id) => { for (const p of P()) { const ph = p.phases.find((x) => x.id === id); if (ph) return [p, ph]; } return [null, null]; };
  const findStep = (id) => { for (const p of P()) for (const ph of p.phases) { const st = ph.steps.find((x) => x.id === id); if (st) return [p, ph, st]; } return [null, null, null]; };
  const phaseProg = (ph) => (ph.done ? 1 : ph.steps.length ? ph.steps.filter((s) => s.done).length / ph.steps.length : 0);
  const progress = (p) => (p.phases.length ? p.phases.reduce((a, ph) => a + phaseProg(ph), 0) / p.phases.length : 0);
  const timePct = (p) => clamp01(diffDays(p.start, today()) / Math.max(1, diffDays(p.start, p.end)));
  const current = (p) => p.phases.find((ph) => !ph.done) || null;
  const nextStep = (p) => { const ph = current(p); return ph ? ph.steps.find((s) => !s.done) || null : null; };
  const weekNo = (p) => Math.min(weeksTotal(p), Math.max(1, Math.floor(diffDays(p.start, today()) / 7) + 1));
  const weeksTotal = (p) => Math.max(1, Math.ceil(diffDays(p.start, p.end) / 7));
  const weekMinutes = (p) => {
    const ws = weekStart();
    const ids = new Set(S().tasks.filter((t) => t.projectId === p.id).map((t) => t.id));
    const sess = S().sessions.filter((s) => s.date >= ws && ids.has(s.taskId)).reduce((a, s) => a + s.min, 0);
    const manual = Object.entries(p.log || {}).filter(([k]) => k >= ws).reduce((a, [, m]) => a + m, 0);
    return sess + manual;
  };
  const pace = (p) => {
    if (p.status === "done") return { soft: false, txt: "Completed 🎉" };
    if (p.status === "paused") return { soft: false, txt: "Paused. It'll be here when you're ready." };
    if (today() < p.start) return { soft: false, txt: `Starts ${fmtD(p.start)}` };
    const d = progress(p) - timePct(p);
    if (d > 0.1) return { soft: false, txt: "Ahead of plan 🚀" };
    if (d >= -0.08) return { soft: false, txt: "On pace ✓" };
    return { soft: true, txt: "A bit behind the plan. Totally normal: plans are guesses. Just do the next tiny step, or move the dates." };
  };
  const active = () => P().filter((p) => p.status === "active");

  // ---------------------------------------------------------------- creation
  const createProject = (d) => {
    const start = d.start || today();
    const end = d.end || plusMonths(start, Number(d.months) || 6);
    const n = Number(d.phases) || 4;
    const len = Math.max(n, diffDays(start, end) + 1);
    const names = PHASE_NAMES[n] || [...Array(n)].map((_, i) => `Phase ${i + 1}`);
    const phases = names.map((title, i) => ({
      id: uid(), title, done: false,
      start: plusDays(start, Math.round((i * len) / n)),
      end: i === n - 1 ? end : plusDays(start, Math.round(((i + 1) * len) / n) - 1),
      steps: i === 0 ? KICKOFF.map((text) => ({ id: uid(), text, done: false })) : [],
    }));
    const p = { id: uid(), title: d.title.trim(), emoji: d.emoji || "🚀", why: (d.why || "").trim(), area: d.area || null, start, end, weeklyHours: Number(d.hours) || null, phases, status: "active", log: {}, created: Date.now() };
    P().unshift(p);
    return p;
  };

  // ---------------------------------------------------------------- linking steps ↔ tasks
  const stepToTask = (p, st) => {
    let t = st.taskId && S().tasks.find((x) => x.id === st.taskId && x.status !== "done");
    if (!t) {
      t = app().addTask(st.text, { projectId: p.id, stepId: st.id, area: p.area, status: "ready" });
      st.taskId = t.id;
    }
    return t;
  };
  /** called by app.js when a task is completed / un-completed */
  const onTask = (t, done) => {
    if (!t.stepId) return;
    const [, , st] = findStep(t.stepId);
    if (st) st.done = done;
  };
  const setStep = (p, st, done) => {
    st.done = done;
    const t = st.taskId && S().tasks.find((x) => x.id === st.taskId);
    if (t) { t.status = done ? "done" : "ready"; t.doneAt = done ? Date.now() : null; }
  };

  // ---------------------------------------------------------------- inline editing
  const pedit = (k, id, text, cls, placeholder = "") => (ui.edit && ui.edit.k === k && ui.edit.id === id
    ? `<input class="edit-input ${cls}" data-pedit="${k}:${id}" value="${esc(text)}" maxlength="140" placeholder="${esc(placeholder)}" />`
    : `<button class="title-btn ${cls}" data-action="p-edit" data-k="${k}" data-id="${id}" title="Click to edit">${text ? esc(text) : `<span class="mut">${esc(placeholder)}</span>`}<span class="pen" aria-hidden="true">✎</span></button>`);
  const saveEdit = (inp, keep = true) => {
    const [k, id] = inp.dataset.pedit.split(":");
    if (!ui.edit || ui.edit.id !== id) return;
    ui.edit = null;
    const v = inp.value.trim();
    if (keep) {
      if (k === "project" && v) byId(id).title = v;
      if (k === "why") byId(id).why = v;
      if (k === "phase" && v) findPhase(id)[1].title = v;
      if (k === "step" && v) { const [, , st] = findStep(id); st.text = v; const t = st.taskId && S().tasks.find((x) => x.id === st.taskId); if (t) t.title = v; }
      app().save();
    }
    app().render();
  };
  document.addEventListener("keydown", (e) => {
    if (!e.target.dataset || !e.target.dataset.pedit) return;
    if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); saveEdit(e.target); }
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); saveEdit(e.target, false); }
  });
  document.addEventListener("focusout", (e) => { if (e.target.dataset && e.target.dataset.pedit) saveEdit(e.target); });
  document.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.draft != null) ui.draft[e.target.name] = e.target.value; });

  // ---------------------------------------------------------------- views
  const bars = (p) => {
    const pr = progress(p), tp = timePct(p);
    return `
      <div class="pbars">
        <div class="pbar"><span>Progress</span><div class="trk"><i style="width:${pr * 100}%"></i></div><b class="mono">${Math.round(pr * 100)}%</b></div>
        <div class="pbar time"><span>Time</span><div class="trk"><i style="width:${tp * 100}%"></i></div><b class="mono">${Math.round(tp * 100)}%</b></div>
      </div>`;
  };

  const card = (p) => {
    const ph = current(p), st = nextStep(p), wm = weekMinutes(p);
    return `
      <div class="c pcard" data-action="p-open" data-id="${p.id}" role="button" tabindex="0">
        <div class="pc-top"><span class="pc-emo">${p.emoji}</span>
          <div class="grow"><b>${esc(p.title)}</b><small>${fmtD(p.start)} → ${fmtDY(p.end)} · week ${weekNo(p)} of ${weeksTotal(p)}</small></div>
          ${p.status !== "active" ? `<span class="pill gray">${p.status}</span>` : ""}</div>
        ${p.why ? `<p class="pc-why">“${esc(p.why)}”</p>` : ""}
        ${bars(p)}
        <div class="pc-now">${ph ? `<span class="pill vio">${esc(ph.title)}</span>` : `<span class="pill">All phases done</span>`}
          <span class="t">${st ? `Next: ${esc(st.text)}` : ph ? "Add the next tiny step" : ""}</span></div>
        ${p.weeklyHours ? `<div class="pc-hours mut">This week: <b>${fmtDur(wm)}</b> of ${p.weeklyHours}h</div>` : ""}
      </div>`;
  };

  const listView = () => {
    const ps = P();
    const order = { active: 0, paused: 1, done: 2 };
    return `
      <section class="view" data-view="projects">
        <div class="hero"><div><h1>Projects. <span>Big goals, tiny steps.</span></h1><p>Long plans split into phases. You only need to think about this week.</p></div>
          <button class="btn primary" data-action="p-new">+ New project</button></div>
        ${ps.length ? `<div class="pgrid">${[...ps].sort((a, b) => order[a.status] - order[b.status]).map(card).join("")}</div>`
          : `<div class="c empty" style="padding:48px 20px">
              <div style="font-size:40px">🗺️</div>
              <p style="margin-top:10px;color:var(--ink-2);font-size:16px">No projects yet.</p>
              <p>Examples: “Get Security+ certified · 6 months”, “Build my portfolio · 3 months”, “Learn Python · 12 months”.</p>
              <button class="btn primary" style="margin-top:16px" data-action="p-new">+ Create your first project</button></div>`}
      </section>`;
  };

  const timeline = (p) => {
    const total = Math.max(1, diffDays(p.start, p.end));
    const pos = (k) => clamp01(diffDays(p.start, k) / total) * 100;
    const months = [];
    const m = toDate(p.start); m.setDate(1); m.setMonth(m.getMonth() + 1);
    while (dkey(m) <= p.end && months.length < 24) { months.push(dkey(m)); m.setMonth(m.getMonth() + 1); }
    const step = Math.ceil(months.length / 8);
    const tp = pos(today());
    const cur = current(p);
    return `
      <div class="tl">
        <div class="tl-row tl-head"><span class="tl-name"></span><div class="tl-track">
          ${months.filter((_, i) => i % step === 0).map((k) => `<span class="tl-month" style="left:${pos(k)}%">${toDate(k).toLocaleDateString("en-US", { month: "short" })}</span>`).join("")}</div></div>
        ${p.phases.map((ph) => `
          <div class="tl-row"><span class="tl-name">${esc(ph.title)}</span>
            <div class="tl-track">
              <i class="tl-bar ${ph.done ? "done" : ph === cur ? "cur" : ""}" style="left:${pos(ph.start)}%;width:${Math.max(1.5, pos(ph.end) - pos(ph.start))}%"><b style="width:${phaseProg(ph) * 100}%"></b></i>
              ${today() >= p.start && today() <= p.end ? `<span class="tl-today" style="left:${tp}%"></span>` : ""}
            </div></div>`).join("")}
        <div class="legend" style="margin-top:10px"><i style="background:var(--lime)"></i> current phase <i style="background:var(--vio);margin-left:8px"></i> done <i style="background:var(--pink);width:2px;margin-left:8px"></i> today</div>
      </div>`;
  };

  const phaseBlock = (p, ph, i) => {
    const cur = current(p);
    const open = ph === cur || ui.showAll || ui.phaseOpen === ph.id;
    const done = ph.steps.filter((s) => s.done).length;
    return `
      <div class="phase ${ph.done ? "done" : ""} ${ph === cur ? "cur" : ""}">
        <div class="ph-head">
          <button class="check ${ph.done ? "on" : ""}" data-action="p-phase-done" data-id="${ph.id}" aria-label="Phase done">${window.LOS.icons.check}</button>
          <div class="t">${pedit("phase", ph.id, ph.title, "ph-title")}
            <small>${i + 1}/${p.phases.length} · ${fmtD(ph.start)} → ${fmtD(ph.end)}${ph.steps.length ? ` · ${done}/${ph.steps.length} steps` : ""}${!ph.done && ph.end < today() ? " · past its dates (fine, adjust if you want)" : ""}</small></div>
          ${ph === cur ? `<span class="pill">Now</span>` : `<button class="tiny" data-action="p-phase-toggle" data-id="${ph.id}">${open ? "Hide" : "Open"}</button>`}
        </div>
        ${open ? `
          <div class="ph-body">
            ${ph.steps.map((st) => `
              <div class="step ${st.done ? "done" : ""}">
                <button class="check ${st.done ? "on" : ""}" data-action="p-step-done" data-id="${st.id}" aria-label="Step done">${window.LOS.icons.check}</button>
                <span class="t">${pedit("step", st.id, st.text, "st-title")}</span>
                ${st.done ? "" : `<button class="tiny lime" data-action="p-step-today" data-id="${st.id}">★ Today</button>`}
                <button class="tiny" data-action="p-step-del" data-id="${st.id}" aria-label="Delete step">${window.LOS.icons.x}</button>
              </div>`).join("")}
            <form class="inline-form" data-form="p-step" data-id="${ph.id}">
              <input class="field" name="text" placeholder="${ph.steps.length ? "Add a step (small enough for one sitting)" : "First tiny step…"}" maxlength="120" autocomplete="off" />
              <button class="btn sm primary">Add</button>
            </form>
            <div class="ph-dates">
              <label>Start <input class="field" type="date" data-pdate="${ph.id}:start" value="${ph.start}" /></label>
              <label>End <input class="field" type="date" data-pdate="${ph.id}:end" value="${ph.end}" /></label>
              <button class="btn quiet sm" data-action="p-phase-del" data-id="${ph.id}">Delete phase</button>
            </div>
          </div>` : ""}
      </div>`;
  };

  const detailView = (p) => {
    const st = nextStep(p), ph = current(p), pc = pace(p), wm = weekMinutes(p);
    const target = p.weeklyHours ? p.weeklyHours * 60 : null;
    return `
      <section class="view" data-view="projects">
        <button class="btn quiet sm" data-action="p-back" style="margin:-8px 0 8px -10px">← All projects</button>
        <div class="hero">
          <div style="min-width:0">
            <h1 class="p-h1"><span class="p-emo">${p.emoji}</span> ${pedit("project", p.id, p.title, "p-title")}</h1>
            <div class="p-why">${pedit("why", p.id, p.why, "why-title", "Why does this matter to you? Click to write it")}</div>
          </div>
          <div class="row" style="gap:28px">
            <div class="stat"><small>Progress</small><b>${Math.round(progress(p) * 100)}%</b></div>
            <div class="stat"><small>Time elapsed</small><b>${Math.round(timePct(p) * 100)}%</b></div>
            <div class="stat"><small>Week</small><b class="mono">${weekNo(p)}<span class="mut" style="font-size:16px">/${weeksTotal(p)}</span></b></div>
          </div>
        </div>
        <div class="${pc.soft ? "nudge" : "pace-ok"}">${pc.soft ? "🧭 " : ""}<span class="sp">${pc.txt}</span></div>
        <div class="grid g-now">
          <div class="stack">
            <div class="c"><h3>Timeline <span class="r mut">${fmtDY(p.start)} → ${fmtDY(p.end)}</span></h3>${timeline(p)}</div>
            <div class="c">
              <h3>Phases <button class="r tagbtn" data-action="p-show-all">${ui.showAll ? "Focus on current" : "Show all phases"}</button></h3>
              ${p.phases.map((x, i) => phaseBlock(p, x, i)).join("")}
              <button class="slot-empty" style="width:100%;margin-top:6px" data-action="p-add-phase" data-id="${p.id}">+ Add phase</button>
            </div>
          </div>
          <div class="stack">
            <div class="c next-card">
              <h3>Next tiny step ${ph ? `<span class="r pill vio">${esc(ph.title)}</span>` : ""}</h3>
              ${st ? `<div class="next-txt">${esc(st.text)}</div>
                <div class="now-actions" style="margin-top:16px">
                  <button class="btn primary" data-action="p-next-5" data-id="${st.id}">▶ Just 5 minutes</button>
                  <button class="btn ghost" data-action="p-step-today" data-id="${st.id}">★ Today</button>
                  <button class="btn ghost" data-action="p-step-done" data-id="${st.id}">✓ Done</button>
                </div>`
              : `<p class="mut" style="line-height:1.6">${ph ? `No steps in <b>${esc(ph.title)}</b> yet. Add one small enough to finish in one sitting.` : "Every phase is done. Mark the project complete? 🎉"}</p>`}
            </div>
            <div class="c">
              <h3>Study time this week ${target ? `<span class="r mono">${fmtDur(wm)} / ${p.weeklyHours}h</span>` : ""}</h3>
              ${target ? `<div class="bar-soft"><i style="width:${Math.min(100, (wm / target) * 100)}%"></i></div>` : `<div class="wins"><b style="font-size:32px">${fmtDur(wm)}</b></div>`}
              <p class="mut" style="font-size:12px;margin:10px 0">Focus sessions on this project's tasks count automatically. Studied elsewhere? Log it:</p>
              <div class="row" style="flex-wrap:wrap;gap:6px">${[15, 30, 60, 90].map((m) => `<button class="chip" data-action="p-log" data-id="${p.id}" data-m="${m}">+ ${fmtDur(m)}</button>`).join("")}</div>
              <div class="label" style="margin:16px 0 8px">Weekly target</div>
              <div class="seg">${[[0, "None"], [2, "2h"], [5, "5h"], [8, "8h"], [10, "10h"]].map(([v, l]) => `<button class="${(p.weeklyHours || 0) === v ? "on" : ""}" data-action="p-target" data-id="${p.id}" data-v="${v}">${l}</button>`).join("")}</div>
            </div>
            <div class="c">
              <h3>Project</h3>
              <div class="ph-dates" style="margin-top:0">
                <label>Start <input class="field" type="date" data-pdate-proj="${p.id}:start" value="${p.start}" /></label>
                <label>End <input class="field" type="date" data-pdate-proj="${p.id}:end" value="${p.end}" /></label>
              </div>
              <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px">
                ${p.status === "active" ? `<button class="btn sm ghost" data-action="p-status" data-id="${p.id}" data-v="paused">Pause</button>` : `<button class="btn sm ghost" data-action="p-status" data-id="${p.id}" data-v="active">Resume</button>`}
                ${p.status !== "done" ? `<button class="btn sm ghost" data-action="p-status" data-id="${p.id}" data-v="done">Mark complete 🎉</button>` : ""}
                <button class="btn sm quiet" style="color:var(--pink)" data-action="p-del" data-id="${p.id}">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </section>`;
  };

  const view = () => {
    const p = ui.open && byId(ui.open);
    return p ? detailView(p) : listView();
  };

  /** small card for the Now screen: next step of each active project */
  const nowCard = () => {
    const ps = active().filter((p) => today() >= p.start).slice(0, 2);
    if (!ps.length) return "";
    return `
      <div class="c">
        <h3>Project steps <button class="r tagbtn" data-action="nav" data-view="projects">All</button></h3>
        <div class="mini-list">${ps.map((p) => { const st = nextStep(p); return `
          <div class="mini-item">
            <span>${p.emoji}</span>
            <span class="t"><b style="font-weight:500">${esc(p.title)}</b><br><small class="mut">${st ? esc(st.text) : "Add the next step"}</small></span>
            ${st ? `<button class="add" data-action="p-step-today" data-id="${st.id}">+ Today</button>` : `<button class="add" data-action="p-open" data-id="${p.id}">Open</button>`}
          </div>`; }).join("")}</div>
      </div>`;
  };

  const newModal = () => {
    const d = ui.draft;
    const startVal = d.start || today();
    return `
      <h2>New project</h2>
      <p class="sub">A big goal, split into phases on a timeline. You'll only need to think about this week.</p>
      <form class="form-grid" data-form="new-project" style="margin-top:18px">
        <div class="emoji-row">${EMOJIS.map((e) => `<button type="button" class="${d.emoji === e ? "on" : ""}" data-action="p-draft" data-k="emoji" data-v="${e}">${e}</button>`).join("")}</div>
        <input class="field" name="title" data-draft value="${esc(d.title)}" placeholder="e.g. Get Security+ certified" required maxlength="80" />
        <textarea class="field" name="why" data-draft placeholder="Why does this matter to you? Future you will need this reminder." style="min-height:64px">${esc(d.why)}</textarea>
        <div><div class="label" style="margin-bottom:6px">How long?</div>
          <div class="seg">${[1, 3, 6, 12].map((m) => `<button type="button" class="${Number(d.months) === m ? "on" : ""}" data-action="p-draft" data-k="months" data-v="${m}">${m} month${m > 1 ? "s" : ""}</button>`).join("")}</div></div>
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <label class="mut" style="font-size:13px">Starts <input class="field" type="date" name="start" data-draft value="${startVal}" style="width:auto;margin-left:6px" /></label>
          <span class="mut" style="font-size:13px">→ ends ${fmtDY(plusMonths(startVal, Number(d.months)))}</span>
        </div>
        <div><div class="label" style="margin-bottom:6px">Phases</div>
          <div class="seg">${[3, 4, 6].map((n) => `<button type="button" class="${Number(d.phases) === n ? "on" : ""}" data-action="p-draft" data-k="phases" data-v="${n}">${n}</button>`).join("")}</div>
          <p class="mut" style="font-size:12px;margin-top:6px">${(PHASE_NAMES[d.phases] || []).join(" → ")} · rename anytime</p></div>
        <div><div class="label" style="margin-bottom:6px">Weekly study time</div>
          <div class="seg">${[[0, "None"], [2, "2h"], [5, "5h"], [8, "8h"], [10, "10h"]].map(([v, l]) => `<button type="button" class="${Number(d.hours) === v ? "on" : ""}" data-action="p-draft" data-k="hours" data-v="${v}">${l}</button>`).join("")}</div></div>
        <select class="field" name="area" data-draft>${Object.entries(AREAS).map(([id, a]) => `<option value="${id}" ${d.area === id ? "selected" : ""}>${a.emoji} ${a.name}</option>`).join("")}</select>
        <div class="foot"><button type="button" class="btn quiet" data-action="close">Cancel</button><button class="btn primary">Create project</button></div>
      </form>`;
  };

  // ---------------------------------------------------------------- actions
  const act = (a, el) => {
    if (!a.startsWith("p-")) return false;
    const id = el.dataset.id;
    const A = app();
    switch (a) {
      case "p-new": ui.draft = { emoji: "🚀", months: 6, phases: 4, hours: 5, title: "", why: "", start: null, area: "learning" }; A.openModal({ type: "new-project" }); return true;
      case "p-draft": ui.draft[el.dataset.k] = el.dataset.k === "emoji" ? el.dataset.v : Number(el.dataset.v); A.renderModal(); return true;
      case "p-open": ui.open = id; ui.edit = null; ui.phaseOpen = null; S().view = "projects"; A.save(); A.render(); window.scrollTo(0, 0); return true;
      case "p-back": ui.open = null; ui.edit = null; A.render(); return true;
      case "p-edit": ui.edit = { k: el.dataset.k, id }; A.render(); return true;
      case "p-show-all": ui.showAll = !ui.showAll; A.render(); return true;
      case "p-phase-toggle": ui.phaseOpen = ui.phaseOpen === id ? null : id; A.render(); return true;
      case "p-phase-done": {
        const [p, ph] = findPhase(id);
        ph.done = !ph.done;
        A.save(); A.render();
        if (ph.done) A.reward(current(p) ? `Phase “${esc(ph.title)}” complete! On to ${esc(current(p).title)} 🚀` : "Every phase done! 🎉", () => { ph.done = false; });
        return true;
      }
      case "p-step-done": {
        const [p, , st] = findStep(id);
        const was = st.done;
        setStep(p, st, !was);
        A.save(); A.render();
        if (!was) A.reward(null, () => setStep(p, st, false));
        return true;
      }
      case "p-step-today": {
        const [p, , st] = findStep(id);
        const t = stepToTask(p, st);
        if (A.makeTop(t.id)) A.toast("Added to today ★");
        A.save(); A.render();
        return true;
      }
      case "p-next-5": {
        const [p, , st] = findStep(id);
        const t = stepToTask(p, st);
        A.makeTop(t.id);
        A.save();
        A.startFocus(t.id, 5, "5");
        return true;
      }
      case "p-step-del": {
        const [, ph, st] = findStep(id);
        const i = ph.steps.indexOf(st);
        ph.steps.splice(i, 1);
        A.save(); A.render();
        A.toast("Step deleted", { action: { label: "Undo", fn: () => { ph.steps.splice(i, 0, st); A.save(); A.render(); } } });
        return true;
      }
      case "p-add-phase": {
        const p = byId(id);
        const last = p.phases[p.phases.length - 1];
        const start = last ? plusDays(last.end, 1) : p.start;
        const ph = { id: uid(), title: `Phase ${p.phases.length + 1}`, done: false, start, end: plusDays(start, 29), steps: [] };
        p.phases.push(ph);
        if (ph.end > p.end) p.end = ph.end;
        ui.edit = { k: "phase", id: ph.id };
        A.save(); A.render();
        return true;
      }
      case "p-phase-del": {
        const [p, ph] = findPhase(id);
        const i = p.phases.indexOf(ph);
        p.phases.splice(i, 1);
        A.save(); A.render();
        A.toast("Phase deleted", { action: { label: "Undo", fn: () => { p.phases.splice(i, 0, ph); A.save(); A.render(); } } });
        return true;
      }
      case "p-log": {
        const p = byId(id), m = Number(el.dataset.m);
        p.log = p.log || {};
        p.log[today()] = (p.log[today()] || 0) + m;
        A.save(); A.render();
        A.toast(`Logged ${fmtDur(m)} for ${esc(p.title)} 📚`, { action: { label: "Undo", fn: () => { p.log[today()] -= m; A.save(); A.render(); } } });
        return true;
      }
      case "p-target": byId(id).weeklyHours = Number(el.dataset.v) || null; A.save(); A.render(); return true;
      case "p-status": {
        const p = byId(id);
        p.status = el.dataset.v;
        A.save(); A.render();
        if (p.status === "done") A.reward(`${p.emoji} ${esc(p.title)} complete! That's huge. 🏆`);
        else A.toast(p.status === "paused" ? "Paused. No guilt." : "Welcome back ✨");
        return true;
      }
      case "p-del": {
        const p = byId(id), i = P().indexOf(p);
        P().splice(i, 1);
        ui.open = null;
        A.save(); A.render();
        A.toast("Project deleted", { action: { label: "Undo", fn: () => { P().splice(i, 0, p); A.save(); A.render(); } } });
        return true;
      }
      default: return false;
    }
  };

  const submit = (form, d) => {
    const A = app();
    if (form.dataset.form === "new-project") {
      if (!d.title || !d.title.trim()) return true;
      const p = createProject({ ...ui.draft, ...d, emoji: ui.draft.emoji, months: ui.draft.months, phases: ui.draft.phases, hours: ui.draft.hours });
      ui.open = p.id;
      S().view = "projects";
      A.save();
      A.closeModal();
      A.toast(`${p.emoji} Project created. Start with the first tiny step.`);
      return true;
    }
    if (form.dataset.form === "p-step") {
      const [, ph] = findPhase(form.dataset.id);
      if (d.text && d.text.trim()) ph.steps.push({ id: uid(), text: d.text.trim(), done: false });
      A.save(); A.render();
      const inp = document.querySelector(`form[data-form="p-step"][data-id="${form.dataset.id}"] input`);
      if (inp) inp.focus();
      return true;
    }
    return false;
  };

  const change = (el) => {
    const A = app();
    if (el.dataset.pdate && el.value) {
      const [id, which] = el.dataset.pdate.split(":");
      const [p, ph] = findPhase(id);
      ph[which] = el.value;
      if (ph.end < ph.start) ph[which === "start" ? "end" : "start"] = el.value;
      if (ph.end > p.end) p.end = ph.end;
      if (ph.start < p.start) p.start = ph.start;
      A.save(); A.render();
      return true;
    }
    if (el.dataset.pdateProj && el.value) {
      const [id, which] = el.dataset.pdateProj.split(":");
      const p = byId(id);
      p[which] = el.value;
      if (p.end < p.start) p.end = p.start;
      A.save(); A.render();
      return true;
    }
    return false;
  };

  const projectOf = (t) => (t && t.projectId ? byId(t.projectId) : null);

  window.LOS.projects = { view, act, submit, change, newModal, nowCard, onTask, projectOf, _create: createProject };
})();
