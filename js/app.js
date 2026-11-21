/* Life OS — ADHD-friendly personal operating system.
   Views: Onboarding, Now, Today, Inbox, Habits, Check-in, Review + Focus mode and modals.
   Vanilla JS; state lives in LOS.store (localStorage). */
(() => {
  "use strict";
  const { dkey, addDays, uid, esc, today, nowMin, toMin, fmtDur, AREAS, HABIT_TEMPLATES, MOODS, ENERGY, MAX_TOP, store, sel, fx } = window.LOS;
  const S = () => store.state;
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const save = () => store.save();

  // ---------------------------------------------------------------- icons
  const sv = (d, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const I = {
    now: sv('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>', 20),
    today: sv('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>', 20),
    inbox: sv('<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1 3h6l1-3h5"/>', 20),
    habits: sv('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M15 17.5l2 2 4-4"/>', 20),
    checkin: sv('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>', 20),
    review: sv('<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/>', 20),
    gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 14),
    x: sv('<path d="M6 6l12 12M18 6L6 18"/>', 14),
    play: sv('<path d="M7 5l12 7-12 7z" fill="currentColor"/>', 14),
    plus: sv('<path d="M12 5v14M5 12h14"/>', 16),
  };

  // ---------------------------------------------------------------- UI state (not persisted)
  const ui = {
    onbStep: 0, onbName: "", onbAreas: [], onbDump: "", onbPicks: [],
    inboxTab: "inbox", inboxEnergy: 0,
    habitEmoji: "💧",
    modal: null,
    focusOpen: false,
    lastView: null,
  };
  const TABS = [["now", "Now"], ["today", "Today"], ["inbox", "Inbox"], ["habits", "Habits"], ["checkin", "Check-in"], ["review", "Review"]];
  const EST_STEPS = [null, 5, 15, 25, 45, 60, 90];
  const HABIT_EMOJIS = ["💧", "🏃", "🧘", "📓", "📚", "🎯", "💰", "💬", "😴", "🥗", "💊", "🌿", "☀️", "🎸", "🧹", "🦷"];

  // ---------------------------------------------------------------- small helpers
  const areaOf = (id) => AREAS[id] || null;
  const areaColor = (id) => areaOf(id)?.color || "var(--mut)";
  const relMin = (m) => (m <= 0 ? "now" : `in ${fmtDur(m)}`);
  const energyOf = (n) => ENERGY.find((e) => e.id === n);
  const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
  const weekday = () => new Date().toLocaleDateString("en-US", { weekday: "long" });
  const firstName = () => esc(S().name || "friend");

  const toast = (html, { bonus = false, action = null, ms = 2600 } = {}) => {
    const el = document.createElement("div");
    el.className = `toast${bonus ? " bonus" : ""}`;
    el.innerHTML = `<span>${html}</span>`;
    if (action) {
      const b = document.createElement("button");
      b.textContent = action.label;
      b.onclick = () => { action.fn(); el.remove(); };
      el.appendChild(b);
    }
    const box = $("#toasts");
    while (box.children.length >= 2) box.firstChild.remove(); // never more than 2 at once
    box.appendChild(el);
    setTimeout(() => el.remove(), action ? ms + 2000 : ms);
  };

  const notify = (title, body) => {
    try {
      if (S().settings.alerts && "Notification" in window && Notification.permission === "granted" && document.hidden) new Notification(title, { body });
    } catch { /* ignore */ }
  };

  const NORMAL = ["Done. That counts. ✓", "Nice: one less thing in your head.", "Progress! ✓", "Look at you go.", "Boom. Ready for the next tiny thing?"];
  const BONUS = ["✨ Bonus: you're on a roll today!", "✨ Your future self says thanks.", "✨ Legendary. Take a 2-minute victory lap.", "✨ That's momentum. Feel it?"];
  const reward = (msg) => {
    const bonus = Math.random() < 0.25; // variable rewards keep it interesting
    if (S().settings.sound) fx.chime(bonus);
    if (!S().settings.reduceMotion) fx.confetti(bonus ? 110 : 45);
    const wins = sel.winsToday();
    toast(bonus ? BONUS[(Math.random() * BONUS.length) | 0] : `${msg || NORMAL[(Math.random() * NORMAL.length) | 0]} <span class="mut">· ${wins} ${wins === 1 ? "win" : "wins"} today</span>`, { bonus });
  };

  // ---------------------------------------------------------------- task actions
  const addTask = (title, extra = {}) => {
    const t = { id: uid(), title: title.trim(), area: null, energy: null, est: null, status: "inbox", topDate: null, steps: [], note: "", doneAt: null, spent: 0, created: Date.now(), ...extra };
    S().tasks.unshift(t);
    return t;
  };
  const capture = (text) => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const made = lines.map((l) => addTask(l));
    save();
    render();
    toast(`Captured ${made.length > 1 ? `${made.length} items` : `"${esc(made[0].title)}"`} to Inbox`, {
      action: { label: "Undo", fn: () => { S().tasks = S().tasks.filter((t) => !made.includes(t)); save(); render(); } },
    });
  };
  const makeTop = (id) => {
    const t = sel.task(id);
    if (!t) return false;
    if (t.topDate === today()) return true;
    if (sel.topToday().length >= MAX_TOP) {
      toast(`You already have ${MAX_TOP} for today. Finish or drop one first. Less is more.`);
      return false;
    }
    t.topDate = today();
    if (t.status === "inbox" || t.status === "whenever") t.status = "ready";
    if (!S().currentId || !sel.task(S().currentId) || sel.task(S().currentId).status === "done") S().currentId = t.id;
    return true;
  };
  const completeTask = (id) => {
    const t = sel.task(id);
    if (!t) return;
    if (S().focus?.taskId === id) endFocus({ silent: true });
    t.status = "done";
    t.doneAt = Date.now();
    t.steps.forEach((s) => (s.done = true));
    if (S().currentId === id) S().currentId = sel.topToday()[0]?.id || null;
    save();
    render();
    reward();
  };
  const uncomplete = (id) => {
    const t = sel.task(id);
    if (!t) return;
    t.status = "ready";
    t.doneAt = null;
  };
  const later = (id) => {
    const t = sel.task(id);
    if (!t) return;
    t.status = "whenever";
    t.topDate = null;
    if (S().currentId === id) S().currentId = null;
    toast("Moved to Whenever. No guilt, it'll wait.");
  };

  // ---------------------------------------------------------------- focus sessions
  const focusElapsed = () => (S().focus ? (Date.now() - S().focus.start) / 60000 : 0);
  const startFocus = (taskId, minutes, mode) => {
    if (S().focus) endFocus({ silent: true });
    S().focus = { taskId, start: Date.now(), dur: minutes, mode, ended: false, nudged: false };
    S().currentId = taskId;
    ui.focusOpen = true;
    save();
    render();
  };
  const endFocus = ({ silent = false } = {}) => {
    const f = S().focus;
    if (!f) return;
    const min = Math.max(1, Math.round(focusElapsed()));
    const t = sel.task(f.taskId);
    if (t) {
      t.spent = (t.spent || 0) + min;
      const note = $("#focusNote");
      if (note) t.note = note.value.trim();
    }
    S().sessions.push({ taskId: f.taskId, date: today(), min });
    S().focus = null;
    ui.focusOpen = false;
    fx.noiseOff();
    document.title = "Life OS";
    save();
    if (!silent) {
      render();
      toast(`Session saved · ${fmtDur(min)}${t?.note ? ". Your note is waiting for next time." : ""}`);
    }
  };

  // ---------------------------------------------------------------- timers
  const disc = (size, stroke, key) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return `<div class="disc" style="width:${size}px;height:${size}px" data-disc="${key}" data-c="${c}">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--card-3)" stroke-width="${stroke}"/>
        <circle class="rem" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--lime)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="0" style="transition:stroke-dashoffset 1s linear"/>
      </svg>
      <div class="lbl"><div><b data-left-short></b><small>left</small></div></div>
    </div>`;
  };
  const timeLeftText = () => {
    const f = S().focus;
    if (!f) return "";
    const left = f.dur - focusElapsed();
    if (left > 0) return left < 1 ? "less than a minute left" : `${fmtDur(Math.ceil(left))} left`;
    return `Time's up · +${fmtDur(Math.floor(-left))} over`;
  };

  const dayInfo = () => {
    const start = 7 * 60, end = (S().settings.dayEnds || 22) * 60, n = nowMin();
    const pct = Math.max(0, Math.min(1, (n - start) / (end - start)));
    return { pct, left: end - n, end: S().settings.dayEnds || 22 };
  };

  const tick = () => {
    // day bar
    const d = dayInfo();
    const dbi = $(".daybar .track i");
    if (dbi) dbi.style.width = `${d.pct * 100}%`;
    const dbt = $("[data-daytext]");
    if (dbt) dbt.innerHTML = dayText();

    const f = S().focus;
    if (!f) return;
    const el = focusElapsed(), left = f.dur - el, frac = Math.max(0, left / f.dur);
    $$("[data-disc]").forEach((dEl) => {
      const c = Number(dEl.dataset.c);
      const circ = $(".rem", dEl);
      circ.setAttribute("stroke-dashoffset", String(c * (1 - frac)));
      circ.setAttribute("stroke", left > 0 ? "var(--lime)" : "var(--pink)");
      const s = $("[data-left-short]", dEl);
      if (s) s.textContent = left > 0 ? (left < 1 ? "<1m" : fmtDur(Math.ceil(left)).replace(" min", "m")) : "0m";
    });
    $$("[data-left]").forEach((e) => { e.textContent = timeLeftText(); e.classList.toggle("over", left <= 0); });
    $$("[data-bar]").forEach((e) => (e.style.width = `${frac * 100}%`));
    const t = sel.task(f.taskId);
    document.title = `${left > 0 ? fmtDur(Math.ceil(left)) : "Time's up"} · ${t?.title || "Focus"}`;

    if (left <= 0 && !f.ended) {
      f.ended = true;
      save();
      if (S().settings.sound) fx.bell();
      notify("Time's up", t ? `"${t.title}": keep going, take a break, or mark it done.` : "");
      toast(f.mode === "5" ? "5 minutes done. You started! Keep going?" : "Time's up. Keep going, break, or done?", {
        action: { label: f.mode === "5" ? "+20 min" : "+10 min", fn: () => { f.dur += f.mode === "5" ? 20 : 10; f.ended = false; f.mode = "full"; save(); render(); } },
        ms: 6000,
      });
      if (!ui.focusOpen) render();
    }
    const hf = S().settings.hyperfocusMin;
    if (hf && el >= (f.nudgeAt || hf) && !f.nudged) {
      f.nudged = true;
      save();
      if (S().settings.sound) fx.bell();
      notify("Time for a check", `You've been focused for ${fmtDur(el)}. Water, stretch, bathroom?`);
      render();
    }
  };
  setInterval(tick, 1000);
  // refresh relative times every minute when the user isn't typing
  setInterval(() => {
    const a = document.activeElement;
    if (!ui.modal && !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) render();
  }, 60000);

  const dayText = () => {
    const d = dayInfo();
    if (d.left <= 0) return `Day's done. Rest counts too. 🌙`;
    if (nowMin() < 7 * 60) return `Early start · your day plan begins at <b>7:00</b>`;
    return `<b>${Math.round(d.pct * 100)}%</b> of your day gone · <b>${fmtDur(d.left)}</b> left until ${d.end}:00`;
  };

  // ---------------------------------------------------------------- schedule helpers
  const todaySchedule = () => S().schedule.filter((e) => e.date === today()).sort((a, b) => a.time.localeCompare(b.time));
  const nextEvent = () => {
    const n = nowMin();
    return todaySchedule().find((e) => toMin(e.time) + (e.dur || 30) > n) || null;
  };

  // ================================================================= ONBOARDING
  const onboarding = () => {
    const st = ui.onbStep, total = 4;
    const dots = `<div class="progress-dots">${[...Array(total)].map((_, i) => `<i class="${i <= st ? "on" : ""}"></i>`).join("")}</div>`;
    const dumpLines = ui.onbDump.split("\n").map((l) => l.trim()).filter(Boolean);
    let body = "";
    if (st === 0) {
      body = `
        <span class="count">01 / 04</span>
        <h1>Hey. This is your <span>Life OS.</span></h1>
        <p class="lead">Built for brains that juggle a lot. One thing at a time, no guilt, and no streaks that reset to zero. Setup takes 30 seconds.</p>
        <input class="field" id="onbName" placeholder="What should we call you?" maxlength="24" value="${esc(ui.onbName)}" autocomplete="given-name" />`;
    } else if (st === 1) {
      body = `
        <span class="count">02 / 04</span>
        <h1>What matters <span>right now?</span></h1>
        <p class="lead">Pick a few. We'll add tiny starter habits, each with a "mini" version for low-energy days. You can change everything later.</p>
        <div class="areas">${Object.entries(AREAS).map(([id, a]) => `
          <button class="area ${ui.onbAreas.includes(id) ? "on" : ""}" style="--ac:${a.color}" data-action="onb-area" data-id="${id}">
            <span class="e">${a.emoji}</span><b>${a.name}</b>
            <small>${HABIT_TEMPLATES[id].map((h) => h[1]).join(" · ")}</small>
          </button>`).join("")}</div>`;
    } else if (st === 2) {
      body = `
        <span class="count">03 / 04</span>
        <h1>Brain dump. <span>Everything.</span></h1>
        <p class="lead">Type whatever's on your mind, one thing per line. Don't organize, just get it out of your head.</p>
        <textarea class="field" id="onbDump" placeholder="Reply to Ana's email&#10;Book dentist&#10;Finish the proposal&#10;Buy cat food">${esc(ui.onbDump)}</textarea>`;
    } else {
      body = `
        <span class="count">04 / 04</span>
        <h1>Pick up to <span>3</span> for today.</h1>
        <p class="lead">Only three. Everything else waits safely in your Inbox.</p>
        ${dumpLines.length ? `<div class="pick-list">${dumpLines.map((l, i) => `
          <button class="trow ${ui.onbPicks.includes(i) ? "cur" : ""}" data-action="onb-pick" data-i="${i}">
            <span class="check ${ui.onbPicks.includes(i) ? "on" : ""}">${I.check}</span><span class="t"><span>${esc(l)}</span></span>
          </button>`).join("")}</div>` : `<div class="c empty" style="margin-top:24px">Nothing dumped, and that's fine. Capture anytime with <span class="mono">⌘K</span> or <span class="mono">/</span>.</div>`}`;
    }
    return `
      <div class="onb"><div class="onb-card view">
        ${body}
        <div class="onb-foot">
          ${dots}
          <div class="row">
            ${st > 0 ? `<button class="btn quiet" data-action="onb-back">Back</button>` : `<button class="btn quiet" data-action="onb-skip">Skip setup</button>`}
            <button class="btn primary big" data-action="onb-next">${st === 3 ? "Start my day →" : st === 0 ? "Let's go →" : "Next →"}</button>
          </div>
        </div>
      </div></div>`;
  };

  const finishOnboarding = () => {
    const s = S();
    s.name = ui.onbName.trim() || s.name || "";
    s.areas = [...ui.onbAreas];
    ui.onbAreas.forEach((a) => HABIT_TEMPLATES[a].forEach(([e, n, m]) => s.habits.push({ id: uid(), emoji: e, name: n, mini: m, area: a, log: {} })));
    const lines = ui.onbDump.split("\n").map((l) => l.trim()).filter(Boolean);
    const byIndex = {};
    // addTask prepends, so add in reverse to keep the typed order
    for (let i = lines.length - 1; i >= 0; i--) byIndex[i] = addTask(lines[i]);
    ui.onbPicks.forEach((i) => byIndex[i] && makeTop(byIndex[i].id));
    s.onboarded = true;
    s.view = "now";
    save();
    render();
    toast(`Welcome${s.name ? `, ${esc(s.name)}` : ""}. One thing at a time. ✨`);
  };

  // ================================================================= SHELL
  const shell = (inner) => {
    const inboxN = sel.inbox().length;
    return `
      <div class="shell">
        <header class="topbar">
          <div class="logo"><i></i>life/os</div>
          <nav class="tabs" aria-label="Main">
            ${TABS.map(([id, l]) => `<button class="${S().view === id ? "on" : ""}" data-action="nav" data-view="${id}">${I[id]}<span>${l}</span>${id === "inbox" && inboxN ? `<span class="badge">${inboxN}</span>` : ""}</button>`).join("")}
          </nav>
          <form class="capture" data-form="capture" role="search">
            <span class="mut">＋</span>
            <input id="capture" name="text" placeholder="Capture anything… (Enter to save)" autocomplete="off" maxlength="140" aria-label="Quick capture" />
            <kbd>⌘K</kbd>
          </form>
          <button class="icon-btn" data-action="settings" aria-label="Settings">${I.gear}</button>
        </header>
        <div class="daybar"><span data-daytext>${dayText()}</span><div class="track"><i style="width:${dayInfo().pct * 100}%"></i></div></div>
        ${inner}
      </div>`;
  };

  // shared: top 3 card
  const top3Card = () => {
    const active = sel.topToday();
    const doneTop = S().tasks.filter((t) => t.topDate === today() && t.status === "done");
    const cur = sel.current();
    const free = MAX_TOP - active.length;
    return `
      <div class="c">
        <h3>Today's top ${MAX_TOP} <span class="r mono">${doneTop.length}/${active.length + doneTop.length || MAX_TOP}</span></h3>
        <div class="top3">
          ${active.map((t) => `
            <div class="trow ${cur?.id === t.id ? "cur" : ""}">
              <button class="check" data-action="done" data-id="${t.id}" aria-label="Mark done">${I.check}</button>
              <button class="t" data-action="set-current" data-id="${t.id}">
                <span>${esc(t.title)}</span>
                <small>${[t.area ? `<span class="dot" style="background:${areaColor(t.area)}"></span> ${areaOf(t.area).name}` : "", t.est ? `~${fmtDur(t.est)}` : "", t.steps.length ? `${t.steps.filter((s) => s.done).length}/${t.steps.length} steps` : ""].filter(Boolean).join(" · ") || "Tap to focus on this"}</small>
              </button>
              <button class="tiny" data-action="drop-top" data-id="${t.id}" title="Remove from today">${I.x}</button>
            </div>`).join("")}
          ${doneTop.map((t) => `
            <div class="trow done">
              <button class="check on" data-action="undone" data-id="${t.id}" aria-label="Mark not done">${I.check}</button>
              <span class="t"><span>${esc(t.title)}</span></span>
            </div>`).join("")}
          ${free > 0 ? [...Array(free)].map(() => `<button class="slot-empty" data-action="pick">+ Add a priority <span class="mono">(${free} left)</span></button>`).slice(0, 1).join("") : ""}
        </div>
      </div>`;
  };

  const energyCard = () => {
    const e = sel.energy();
    if (!e) {
      return `
        <div class="c">
          <h3>Energy check <span class="r pill vio">10 sec</span></h3>
          <p style="margin-bottom:12px">How's your energy right now?</p>
          <div class="energy-pick">${ENERGY.map((x) => `<button data-action="energy" data-v="${x.id}"><span class="e">${x.e}</span><b>${x.l}</b><small>${x.hint}</small></button>`).join("")}</div>
        </div>`;
    }
    const fit = sel.energyFit();
    const en = energyOf(e);
    return `
      <div class="c">
        <h3>Good fit for your energy <button class="r tagbtn" data-action="energy-reset">${en.e} ${en.l} · change</button></h3>
        ${fit.length ? `<div class="mini-list">${fit.map((t) => `
          <button class="mini-item" data-action="add-top" data-id="${t.id}">
            <span class="dot" style="background:${areaColor(t.area)}"></span>
            <span class="t">${esc(t.title)}</span>
            ${t.est ? `<span class="mut mono" style="font-size:12px">${t.est}m</span>` : ""}
            <span class="add">+ Today</span>
          </button>`).join("")}</div>`
          : `<div class="empty">${e === 1 ? "Low energy is okay. Try one habit's <b>mini</b> version, or just rest." : "Nothing waiting. Capture something with ⌘K."}</div>`}
      </div>`;
  };

  const nextUpCard = () => {
    const ev = nextEvent();
    const n = nowMin();
    return `
      <div class="c">
        <h3>Next up <button class="r tagbtn" data-action="nav" data-view="today">Plan</button></h3>
        ${ev ? `<div class="next-up"><span class="when">${relMin(toMin(ev.time) - n)}</span><div><b style="font-weight:500">${esc(ev.label)}</b><br><small class="mut mono">${ev.time} · ${fmtDur(ev.dur || 30)}</small></div></div>`
          : `<div class="empty" style="padding:8px">Nothing scheduled. <button class="tagbtn" data-action="nav" data-view="today">Add a block</button></div>`}
      </div>`;
  };

  const winsCard = () => {
    const w = sel.winsToday();
    const done = sel.doneToday();
    return `
      <div class="c">
        <h3>Wins today</h3>
        <div class="wins"><b>${w}</b><span class="mut">${w ? "things done. That counts." : "Every tiny thing counts. Even a mini habit."}</span></div>
        ${done.length ? `<div class="mini-list" style="margin-top:12px">${done.slice(0, 4).map((t) => `<div class="mini-item"><span style="color:var(--lime)">${I.check}</span><span class="t">${esc(t.title)}</span></div>`).join("")}</div>` : ""}
      </div>`;
  };

  // ================================================================= NOW
  const nowView = () => {
    const t = sel.current();
    const f = S().focus;
    const ev = nextEvent();
    const top = sel.topToday();
    const sub = [`${sel.winsToday()} wins today`, `${top.length} of ${MAX_TOP} priorities left`, ev ? `next: ${esc(ev.label)} ${relMin(toMin(ev.time) - nowMin())}` : ""].filter(Boolean).join(" · ");
    const nudge = f && f.nudged ? `
      <div class="nudge">🧠 <span class="sp">You've been focused for <b>${fmtDur(focusElapsed())}</b>. Water, stretch, bathroom? Hyperfocus is a superpower, but bodies need breaks.</span>
        <button class="btn sm ghost" data-action="focus-stop">Take a break</button>
        <button class="btn sm quiet" data-action="nudge-ok">Keep going</button></div>` : "";

    let card;
    if (!t) {
      card = `
        <div class="c now-card">
          <div class="meta"><span class="pill">Right now</span></div>
          <div class="now-title">Nothing picked for right now.</div>
          <p class="mut" style="margin-top:10px">Choose one thing. Just one. Everything else can wait.</p>
          <div class="now-actions">
            <button class="btn primary big" data-action="pick">Pick one thing</button>
            <button class="btn ghost" data-action="focus-capture">Capture a thought</button>
          </div>
        </div>`;
    } else {
      const step = t.steps.find((s) => !s.done);
      const stepIdx = step ? t.steps.indexOf(step) + 1 : 0;
      const running = f && f.taskId === t.id;
      const area = areaOf(t.area);
      card = `
        <div class="c now-card" style="--area:${area ? area.color : "var(--lime)"}">
          <div class="meta">
            <span class="pill">Right now</span>
            ${area ? `<span class="pill gray"><span class="dot" style="background:${area.color}"></span> ${area.name}</span>` : ""}
            ${t.est ? `<span class="pill gray">~${fmtDur(t.est)}</span>` : ""}
            ${t.energy ? `<span class="pill gray">${energyOf(t.energy).e} ${energyOf(t.energy).l} energy</span>` : ""}
          </div>
          <div class="now-title">${esc(t.title)}</div>
          <div class="next-step">
            ${step ? `
              <button class="check sq" data-action="step-done" data-id="${t.id}" data-step="${step.id}" aria-label="Step done">${I.check}</button>
              <div class="grow"><div class="lbl">Next tiny step · ${stepIdx} of ${t.steps.length}</div><div class="txt">${esc(step.text)}</div></div>`
            : `<div class="grow"><div class="lbl">First tiny step</div><div class="txt mut">${t.steps.length ? "All steps done. Finish it off?" : "Not sure where to start? Make it tiny."}</div></div>
               ${t.steps.length ? "" : `<button class="btn sm ghost" data-action="stuck" data-id="${t.id}">Break it down</button>`}`}
          </div>
          ${running ? `
            <div class="running">
              ${disc(64, 7, "now")}
              <div class="grow"><b data-left>${timeLeftText()}</b><span class="mut"> · ${f.mode === "5" ? "just 5 minutes" : "focus session"}</span><div class="bar"><i data-bar style="width:100%"></i></div></div>
              <button class="btn sm ghost" data-action="focus-open">Open</button>
              <button class="btn sm quiet" data-action="focus-stop">Stop</button>
            </div>` : ""}
          <label class="leftoff">📌 <span style="white-space:nowrap">Where I left off:</span>
            <input data-note="${t.id}" value="${esc(t.note)}" placeholder="A quick note for future you…" maxlength="140" /></label>
          <div class="now-actions">
            ${running ? `<button class="btn primary big" data-action="done" data-id="${t.id}">✓ Done</button>`
              : `<button class="btn primary big" data-action="focus-5" data-id="${t.id}">${I.play} Just 5 minutes</button>
                 <button class="btn ghost" data-action="focus-full" data-id="${t.id}">Focus ${fmtDur(t.est || 25)}</button>`}
            <button class="btn ghost" data-action="stuck" data-id="${t.id}">😵‍💫 I'm stuck</button>
            <span class="sp"></span>
            <button class="btn quiet" data-action="later" data-id="${t.id}">Not now</button>
            ${running ? "" : `<button class="btn ghost" data-action="done" data-id="${t.id}">✓ Done</button>`}
          </div>
        </div>`;
    }
    return `
      <section class="view" data-view="now">
        <div class="hero"><div><h1>${greeting()}, ${firstName()}. <span>One thing</span> at a time.</h1><p>${sub}</p></div></div>
        ${nudge}
        <div class="grid g-now">
          <div class="stack">${card}${top3Card()}</div>
          <div class="stack">${energyCard()}${nextUpCard()}${winsCard()}
            <button class="btn quiet" data-action="reset-day" style="align-self:flex-start">↺ Reset my day</button>
          </div>
        </div>
      </section>`;
  };

  // ================================================================= TODAY
  const habitRow = (h, compact = false) => {
    const v = sel.habitDone(h);
    const n = sel.habitCount(h, 7);
    const days = [...Array(7)].map((_, i) => addDays(new Date(), i - 6));
    return `
      <div class="habit ${compact ? "compact" : ""}">
        <span class="emo">${h.emoji}</span>
        <div class="info">
          <b>${esc(h.name)}</b>
          <small>${n} of last 7 days${h.mini && !compact ? ` · mini: ${esc(h.mini)}` : ""}</small>
          ${compact ? "" : `<div class="week7">${days.map((d) => { const k = dkey(d); return `<i class="${h.log[k] || ""} ${k === today() ? "today" : ""}" title="${d.toLocaleDateString("en-US", { weekday: "short" })}"></i>`; }).join("")}</div>`}
        </div>
        <div class="hbtns">
          <button class="hbtn ${v === "full" ? "on" : ""}" data-action="habit" data-id="${h.id}" data-v="full">${v === "full" ? "✓ Done" : "Done"}</button>
          ${h.mini ? `<button class="hbtn mini ${v === "mini" ? "on" : ""}" data-action="habit" data-id="${h.id}" data-v="mini" title="${esc(h.mini)}">${v === "mini" ? "✓ Mini" : "Mini"}</button>` : ""}
          ${compact ? "" : `<button class="tiny" data-action="del-habit" data-id="${h.id}" aria-label="Delete habit">${I.x}</button>`}
        </div>
      </div>`;
  };

  const todayView = () => {
    const topAll = S().tasks.filter((t) => t.topDate === today());
    const topDone = topAll.filter((t) => t.status === "done").length;
    const hs = S().habits;
    const hDone = hs.filter((h) => h.log[today()]).length;
    const denom = topAll.length + hs.length;
    const pct = denom ? Math.round(((topDone + hDone) / denom) * 100) : 0;
    const focusMin = S().sessions.filter((s) => s.date === today()).reduce((a, s) => a + s.min, 0) + (S().focus ? Math.round(focusElapsed()) : 0);
    const week = [...Array(7)].map((_, i) => dkey(addDays(new Date(), -i)));
    const cons = hs.length ? Math.round((week.reduce((a, k) => a + sel.dayHabitRatio(k), 0) / 7) * 100) : 0;
    const moods = week.map((k) => S().checkins[k]?.mood).filter((m) => m != null);
    const moodAvg = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length + 1).toFixed(1) : "–";

    const n = nowMin();
    const items = todaySchedule();
    let placedNow = false, tl = "";
    items.forEach((e) => {
      const st = toMin(e.time), en = st + (e.dur || 30);
      if (!placedNow && st > n) { tl += `<div class="nowline">now · ${new Date().toTimeString().slice(0, 5)}</div>`; placedNow = true; }
      const past = en <= n, live = st <= n && en > n;
      tl += `<div class="ev ${past ? "past" : ""}" style="--c:${areaColor(e.area)}">
        <span class="time">${e.time}</span>
        <span class="t">${esc(e.label)}<small>${fmtDur(e.dur || 30)}${e.area ? ` · ${areaOf(e.area).name}` : ""}</small></span>
        ${past ? "" : `<span class="rel">${live ? "now" : relMin(st - n)}</span>`}
        <button class="tiny x" data-action="del-event" data-id="${e.id}" aria-label="Remove">${I.x}</button>
      </div>`;
    });
    if (!placedNow) tl += `<div class="nowline">now · ${new Date().toTimeString().slice(0, 5)}</div>`;

    return `
      <section class="view" data-view="today">
        <div class="hero">
          <div><h1>${weekday()}. <span>${pct}%</span> of today's plan done.</h1>
            <p>${topDone}/${topAll.length || 0} priorities · ${hDone}/${hs.length} habits · ${sel.inbox().length} in inbox</p></div>
          <div class="row" style="gap:28px">
            <div class="stat"><small>Habit consistency (7d)</small><b>${cons}%</b></div>
            <div class="stat"><small>Mood (7d)</small><b>${moodAvg}<span class="mut" style="font-size:16px">/5</span></b></div>
            <div class="stat"><small>Focus today</small><b class="mono">${fmtDur(focusMin)}</b></div>
          </div>
        </div>
        <div class="grid g-3">
          <div class="stack">
            ${top3Card()}
            <div class="c">
              <h3>Time blocks <span class="r mut">see time, not just a list</span></h3>
              <div class="timeline">${tl}</div>
              ${items.length ? "" : `<p class="mut" style="font-size:13px;margin-top:4px">Add a few blocks so time feels real.</p>`}
              <form class="inline-form" data-form="event">
                <input class="field" type="time" name="time" required value="${String(Math.min(23, new Date().getHours() + 1)).padStart(2, "0")}:00" />
                <input class="field" name="label" placeholder="What?" required maxlength="60" />
                <select class="field" name="dur">${[15, 30, 45, 60, 90, 120].map((d) => `<option value="${d}" ${d === 30 ? "selected" : ""}>${fmtDur(d)}</option>`).join("")}</select>
                <select class="field" name="area"><option value="">Area</option>${Object.entries(AREAS).map(([id, a]) => `<option value="${id}">${a.name}</option>`).join("")}</select>
                <button class="btn sm primary">Add</button>
              </form>
            </div>
          </div>
          <div class="c">
            <h3>Habits <span class="r mono">${hDone}/${hs.length}</span></h3>
            ${hs.length ? hs.map((h) => habitRow(h, true)).join("") : `<div class="empty">No habits yet. <button class="tagbtn" data-action="nav" data-view="habits">Add one</button></div>`}
            <p class="mut" style="font-size:12px;margin-top:6px">Mini counts. Missing a day never resets anything.</p>
          </div>
          <div class="stack">${energyCard()}${winsCard()}
            <button class="btn quiet" data-action="reset-day" style="align-self:flex-start">↺ Reset my day</button></div>
        </div>
      </section>`;
  };

  // ================================================================= INBOX
  const cycleLabel = {
    area: (t) => (t.area ? `<span class="dot" style="background:${areaColor(t.area)}"></span>${areaOf(t.area).name}` : "+ area"),
    energy: (t) => (t.energy ? `${energyOf(t.energy).e} ${energyOf(t.energy).l}` : "+ energy"),
    est: (t) => (t.est ? `⏱ ${fmtDur(t.est)}` : "+ time"),
  };
  const inboxView = () => {
    const tab = ui.inboxTab;
    let list = tab === "inbox" ? sel.inbox() : tab === "ready" ? S().tasks.filter((t) => t.status === "ready") : tab === "whenever" ? sel.whenever() : S().tasks.filter((t) => t.status === "done").sort((a, b) => b.doneAt - a.doneAt).slice(0, 40);
    if (ui.inboxEnergy) list = list.filter((t) => t.energy === ui.inboxEnergy);
    const counts = { inbox: sel.inbox().length, ready: S().tasks.filter((t) => t.status === "ready").length, whenever: sel.whenever().length };
    return `
      <section class="view" data-view="inbox">
        <div class="hero"><div><h1>Inbox. <span>Out of your head.</span></h1><p>Capture without thinking. Sort later, or never. Nothing here is "overdue".</p></div></div>
        <div class="grid g-now">
          <div class="c">
            <div class="row" style="justify-content:space-between;flex-wrap:wrap;margin-bottom:16px">
              <div class="seg">
                ${[["inbox", "Inbox"], ["ready", "Ready"], ["whenever", "Whenever"], ["done", "Done"]].map(([id, l]) => `<button class="${tab === id ? "on" : ""}" data-action="inbox-tab" data-v="${id}">${l}${counts[id] != null ? ` <span class="mono mut">${counts[id]}</span>` : ""}</button>`).join("")}
              </div>
              <div class="seg">
                <button class="${!ui.inboxEnergy ? "on" : ""}" data-action="inbox-energy" data-v="0">Any</button>
                ${ENERGY.map((e) => `<button class="${ui.inboxEnergy === e.id ? "on" : ""}" data-action="inbox-energy" data-v="${e.id}" title="${e.l} energy">${e.e}</button>`).join("")}
              </div>
            </div>
            ${list.length ? list.map((t) => `
              <div class="task-card">
                ${tab === "done" ? `<button class="check on" data-action="undone" data-id="${t.id}">${I.check}</button>` : `<button class="check" data-action="done" data-id="${t.id}" aria-label="Done">${I.check}</button>`}
                <div class="t">
                  <b>${esc(t.title)}</b>
                  <div class="tags">
                    ${t.topDate === today() && t.status !== "done" ? `<span class="pill">★ Today</span>` : ""}
                    ${tab === "done" ? "" : `
                    <button class="tagbtn" data-action="cycle" data-k="area" data-id="${t.id}">${cycleLabel.area(t)}</button>
                    <button class="tagbtn" data-action="cycle" data-k="energy" data-id="${t.id}">${cycleLabel.energy(t)}</button>
                    <button class="tagbtn" data-action="cycle" data-k="est" data-id="${t.id}">${cycleLabel.est(t)}</button>`}
                    ${t.steps.length ? `<span class="pill gray">${t.steps.filter((s) => s.done).length}/${t.steps.length} steps</span>` : ""}
                  </div>
                </div>
                ${tab === "done" ? "" : `<div class="acts">
                  ${t.topDate === today() ? "" : `<button class="tiny lime" data-action="add-top" data-id="${t.id}">★ Today</button>`}
                  <button class="tiny" data-action="stuck" data-id="${t.id}">Break down</button>
                  ${t.status === "inbox" ? `<button class="tiny" data-action="ready" data-id="${t.id}">Ready</button>` : ""}
                  ${t.status !== "whenever" ? `<button class="tiny" data-action="later" data-id="${t.id}">Whenever</button>` : ""}
                  <button class="tiny" data-action="del-task" data-id="${t.id}" aria-label="Delete">${I.x}</button>
                </div>`}
              </div>`).join("") : `<div class="empty">${tab === "inbox" ? "Inbox zero. Your head should feel lighter. 🌬️" : "Nothing here."}</div>`}
          </div>
          <div class="stack">
            <div class="c">
              <h3>Brain dump</h3>
              <form data-form="dump">
                <textarea class="field" name="text" placeholder="One thing per line…&#10;Call mom&#10;Renew passport&#10;Idea: weekend trip" style="min-height:160px"></textarea>
                <button class="btn primary" style="margin-top:10px;width:100%">Add all to Inbox</button>
              </form>
            </div>
            <div class="c">
              <h3>How this works</h3>
              <p class="mut" style="font-size:14px;line-height:1.6"><b style="color:var(--ink-2)">Inbox</b>: raw thoughts.<br><b style="color:var(--ink-2)">Ready</b>: things you could do.<br><b style="color:var(--ink-2)">Whenever</b>: no pressure, no date.<br>Tag energy so low-energy days still have wins.</p>
            </div>
          </div>
        </div>
      </section>`;
  };

  // ================================================================= HABITS
  const habitsView = () => {
    const hs = S().habits;
    const cols = ["#1f1f29", "#3b4a1a", "#6f9a22", "#a6d93a", "#c8ff4d"];
    const start = addDays(new Date(), -(26 * 7 - 1) - new Date().getDay() + 6);
    let cells = "";
    for (let i = 0; i < 26 * 7; i++) {
      const d = addDays(start, i);
      if (d > new Date()) { cells += `<i style="opacity:.25"></i>`; continue; }
      const r = sel.dayHabitRatio(dkey(d));
      const lvl = r === 0 ? 0 : r < 0.34 ? 1 : r < 0.67 ? 2 : r < 1 ? 3 : 4;
      cells += `<i style="background:${cols[lvl]}" title="${d.toDateString()}: ${Math.round(r * 100)}%"></i>`;
    }
    return `
      <section class="view" data-view="habits">
        <div class="hero"><div><h1>Habits. <span>Progress, not perfection.</span></h1><p>Missing a day never resets anything. On hard days, the mini version counts.</p></div></div>
        <div class="grid g-now">
          <div class="c">
            <h3>Your habits <span class="r mono">${hs.filter((h) => h.log[today()]).length}/${hs.length} today</span></h3>
            ${hs.length ? hs.map((h) => habitRow(h)).join("") : `<div class="empty">Start with one tiny habit. Just one.</div>`}
            <div class="legend" style="margin-top:10px"><i style="background:var(--lime)"></i> full <i style="background:var(--vio);margin-left:8px"></i> mini</div>
          </div>
          <div class="stack">
            <div class="c">
              <h3>Consistency · 26 weeks</h3>
              <div class="heat">${cells}</div>
              <div class="legend">less ${cols.map((c) => `<i style="background:${c}"></i>`).join("")} more</div>
            </div>
            <div class="c">
              <h3>New habit</h3>
              <form class="form-grid" data-form="habit">
                <div class="emoji-row">${HABIT_EMOJIS.map((e) => `<button type="button" class="${ui.habitEmoji === e ? "on" : ""}" data-action="habit-emoji" data-e="${e}">${e}</button>`).join("")}</div>
                <input class="field" name="name" placeholder="Habit (e.g. Walk 20 min)" required maxlength="40" />
                <input class="field" name="mini" placeholder="Mini version for hard days (e.g. Walk to the corner)" maxlength="40" />
                <select class="field" name="area"><option value="">Area (optional)</option>${Object.entries(AREAS).map(([id, a]) => `<option value="${id}">${a.name}</option>`).join("")}</select>
                <button class="btn primary">Add habit</button>
              </form>
            </div>
          </div>
        </div>
      </section>`;
  };

  // ================================================================= CHECK-IN
  const checkinView = () => {
    const c = S().checkins[today()] || {};
    const days = [...Array(30)].map((_, i) => addDays(new Date(), i - 29));
    const W = 600, H = 170, px = (i) => (i / 29) * W;
    const line = (key, max, color, dash = "") => {
      const pts = days.map((d, i) => { const v = S().checkins[dkey(d)]?.[key]; return v == null ? null : [px(i), H - 10 - (v / max) * (H - 30)]; });
      let dStr = "", started = false;
      pts.forEach((p) => { if (!p) { started = false; return; } dStr += `${started ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)} `; started = true; });
      const dots = pts.filter(Boolean).map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${color}"/>`).join("");
      return `<path d="${dStr}" fill="none" stroke="${color}" stroke-width="${dash ? 1.8 : 2.8}" stroke-dasharray="${dash}" stroke-opacity="${dash ? 0.75 : 1}" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    };
    // insight: wins on high vs low energy days
    const winsOn = (k) => S().tasks.filter((t) => t.doneAt && dkey(new Date(t.doneAt)) === k).length + S().habits.filter((h) => h.log[k]).length;
    const byE = { 1: [], 3: [] };
    days.forEach((d) => { const k = dkey(d), e = S().checkins[k]?.energy; if (e === 1 || e === 3) byE[e].push(winsOn(k)); });
    const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null);
    const insight = avg(byE[1]) && avg(byE[3])
      ? `On low-energy days you still average <b>${avg(byE[1])}</b> wins (vs. <b>${avg(byE[3])}</b> on high-energy days). Low days aren't zero days.`
      : "Check in a few days in a row and patterns will show up here.";
    const recent = Object.entries(S().checkins).filter(([, v]) => v.note).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5);
    return `
      <section class="view" data-view="checkin">
        <div class="hero"><div><h1>Check-in. <span>How are you, really?</span></h1><p>10 seconds. It helps the app suggest tasks that fit your energy.</p></div></div>
        <div class="grid g-2">
          <div class="c">
            <h3>Mood</h3>
            <div class="mood-pick">${MOODS.map((m, i) => `<button class="${c.mood === i ? "on" : ""}" data-action="mood" data-v="${i}" title="${m.l}">${m.e}</button>`).join("")}</div>
            <h3 style="margin-top:22px">Energy</h3>
            <div class="energy-pick">${ENERGY.map((x) => `<button class="${c.energy === x.id ? "on" : ""}" data-action="energy" data-v="${x.id}"><span class="e">${x.e}</span><b>${x.l}</b><small>${x.hint}</small></button>`).join("")}</div>
            <h3 style="margin-top:22px">Note <span class="r mut">optional</span></h3>
            <form data-form="checkin-note"><textarea class="field" name="note" placeholder="Anything on your mind? Sleep, meds, stress, wins…" maxlength="280">${esc(c.note || "")}</textarea>
            <button class="btn ghost" style="margin-top:10px">Save note</button></form>
          </div>
          <div class="stack">
            <div class="c chart">
              <h3>Last 30 days</h3>
              <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
                ${[0.25, 0.5, 0.75].map((g) => `<line x1="0" x2="${W}" y1="${H * g}" y2="${H * g}" stroke="#22222c"/>`).join("")}
                ${line("energy", 3, "#c8ff4d", "5 5")}${line("mood", 4, "#8b7cff")}
              </svg>
              <div class="legend"><i style="background:var(--vio)"></i> mood <i style="background:var(--lime);margin-left:8px"></i> energy</div>
            </div>
            <div class="c"><h3>Insight</h3><p style="line-height:1.6;color:var(--ink-2)">${insight}</p></div>
            ${recent.length ? `<div class="c"><h3>Recent notes</h3>${recent.map(([k, v]) => `<div class="past-review"><small>${k} · ${v.mood != null ? MOODS[v.mood].e : ""} ${v.energy ? energyOf(v.energy).e : ""}</small><p>${esc(v.note)}</p></div>`).join("")}</div>` : ""}
          </div>
        </div>
      </section>`;
  };

  // ================================================================= REVIEW
  const reviewView = () => {
    const week = [...Array(7)].map((_, i) => dkey(addDays(new Date(), -i)));
    const doneW = S().tasks.filter((t) => t.doneAt && week.includes(dkey(new Date(t.doneAt))));
    const hs = S().habits;
    const cons = hs.length ? Math.round((week.reduce((a, k) => a + sel.dayHabitRatio(k), 0) / 7) * 100) : 0;
    const focusW = S().sessions.filter((s) => week.includes(s.date)).reduce((a, s) => a + s.min, 0);
    const moods = week.map((k) => S().checkins[k]?.mood).filter((m) => m != null);
    const moodAvg = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length + 1).toFixed(1) : "–";
    const est = S().tasks.filter((t) => t.status === "done" && t.est && t.spent);
    const ratio = est.length ? est.reduce((a, t) => a + t.spent, 0) / est.reduce((a, t) => a + t.est, 0) : null;
    const estText = ratio == null
      ? "Add time estimates and use focus sessions. Life OS will learn how long things <i>really</i> take you."
      : ratio > 1.15 ? `Things take you about <b>${ratio.toFixed(1)}×</b> your estimates. Totally normal: try padding estimates a bit.`
      : ratio < 0.85 ? `You finish faster than you think: about <b>${ratio.toFixed(1)}×</b> your estimates.`
      : "Your estimates are spot on. Nice calibration.";
    return `
      <section class="view" data-view="review">
        <div class="hero"><div><h1>Weekly review. <span>5 minutes.</span></h1><p>Look back without judging. Pick one thing to try next week.</p></div></div>
        <div class="c" style="margin-bottom:16px">
          <div class="stats">
            <div class="stat"><small>Things done (7d)</small><b>${doneW.length}</b></div>
            <div class="stat"><small>Habit consistency</small><b>${cons}%</b></div>
            <div class="stat"><small>Average mood</small><b>${moodAvg}<span class="mut" style="font-size:16px">/5</span></b></div>
            <div class="stat"><small>Focus time</small><b class="mono">${fmtDur(focusW)}</b></div>
          </div>
          <p style="margin-top:16px;color:var(--ink-2);font-size:14px">⏱ ${estText}</p>
        </div>
        <div class="grid g-2">
          <div class="c">
            <h3>Three questions</h3>
            <form data-form="review">
              <div class="q"><label>🌟 What went well this week, even something small?</label><textarea class="field" name="a1" required></textarea></div>
              <div class="q"><label>🧱 What got in the way?</label><textarea class="field" name="a2"></textarea></div>
              <div class="q"><label>🎯 One thing to try next week?</label><textarea class="field" name="a3"></textarea></div>
              <button class="btn primary">Save review</button>
            </form>
          </div>
          <div class="c">
            <h3>Past reviews</h3>
            ${S().reviews.length ? S().reviews.slice(0, 6).map((r) => `<div class="past-review"><small>${new Date(r.at).toDateString()}</small><p>🌟 ${esc(r.a1)}</p>${r.a2 ? `<p>🧱 ${esc(r.a2)}</p>` : ""}${r.a3 ? `<p>🎯 ${esc(r.a3)}</p>` : ""}</div>`).join("") : `<div class="empty">Your first review will show up here.</div>`}
          </div>
        </div>
      </section>`;
  };

  // ================================================================= FOCUS OVERLAY
  const focusOverlay = () => {
    const f = S().focus;
    const t = sel.task(f.taskId);
    const step = t?.steps.find((s) => !s.done);
    return `
      <div class="focus" role="dialog" aria-label="Focus mode">
        <div class="kicker">${f.mode === "5" ? "Just 5 minutes · you can stop after" : "Focus session"}</div>
        <div class="task-name">${esc(t?.title || "Focus")}</div>
        ${step ? `<div class="step-now">Next tiny step: <span>${esc(step.text)}</span> <button class="tagbtn" data-action="step-done" data-id="${t.id}" data-step="${step.id}">✓ done</button></div>` : ""}
        ${disc(240, 16, "focus")}
        <div class="remaining" data-left>${timeLeftText()}</div>
        <div class="ctrls">
          <button class="btn primary big" data-action="done" data-id="${t?.id}">✓ Done</button>
          <button class="btn ghost" data-action="focus-extend">+5 min</button>
          <button class="btn ghost" data-action="noise">${fx.noisePlaying() ? "🔇 Stop brown noise" : "🎧 Brown noise"}</button>
          <button class="btn ghost" data-action="focus-stop">Stop &amp; save</button>
          <button class="btn quiet" data-action="focus-min">Minimize</button>
        </div>
        <label class="leftoff" style="width:min(520px,100%)">📌 <span style="white-space:nowrap">Where I left off:</span>
          <input id="focusNote" data-note="${t?.id}" value="${esc(t?.note || "")}" placeholder="So future you can pick it up fast…" maxlength="140" /></label>
      </div>`;
  };

  // ================================================================= MODALS
  const STUCK_BASE = ["Open the file or app", "Write just the title", "Gather what I need", "Write 3 messy bullet points", "Do the easiest part first", "Ask someone one question", "Set it up, don't do it yet"];
  const STUCK_KEYS = [
    [/mail|email|reply|message|text|slack/i, ["Open the conversation", "Write one sentence", "Send a rough version"]],
    [/clean|tidy|laundry|dishes|organi[sz]e/i, ["Pick up 5 things", "Clear one surface", "Start one load"]],
    [/call|phone|book|appointment|dentist|doctor/i, ["Find the number", "Write what to say", "Check my calendar"]],
    [/write|report|proposal|essay|doc|post/i, ["Open a blank doc", "Write the headline", "Dump ideas as bullets"]],
    [/pay|bill|budget|tax|invoice|bank/i, ["Open the banking app", "Find the bill", "Note the amount"]],
    [/study|read|learn|course|exam/i, ["Open to the right page", "Read one paragraph", "Write one question"]],
    [/gym|run|workout|exercise|walk|train/i, ["Put on shoes", "Fill a water bottle", "Do 1 minute"]],
    [/cook|meal|groceries|shop|buy/i, ["Write the list", "Check the fridge", "Take out one ingredient"]],
  ];
  const stuckSuggestions = (title) => {
    const hit = STUCK_KEYS.find(([re]) => re.test(title));
    return [...(hit ? hit[1] : []), ...STUCK_BASE].slice(0, 8);
  };

  const modalHTML = () => {
    const m = ui.modal;
    if (!m) return "";
    let inner = "";
    if (m.type === "stuck") {
      const t = sel.task(m.id);
      if (!t) return "";
      inner = `
        <h2>Let's make it tiny.</h2>
        <p class="sub">“${esc(t.title)}” is too big to start. What's the very first <b>physical</b> action? Something under 2 minutes.</p>
        <div class="steps">${t.steps.map((s, i) => `
          <div class="step ${s.done ? "done" : ""}">
            <button class="check ${s.done ? "on" : ""}" data-action="step-toggle" data-id="${t.id}" data-step="${s.id}">${I.check}</button>
            <span class="n">${i + 1}</span><span class="t">${esc(s.text)}</span>
            <button class="tiny" data-action="step-del" data-id="${t.id}" data-step="${s.id}">${I.x}</button>
          </div>`).join("")}</div>
        <form class="inline-form" data-form="step" data-id="${t.id}">
          <input class="field" name="text" id="stepInput" placeholder="${t.steps.length ? "Then what?" : "First tiny step…"}" maxlength="80" autocomplete="off" />
          <button class="btn sm primary">Add</button>
        </form>
        <div class="label" style="margin-top:18px;margin-bottom:0">Ideas</div>
        <div class="chips">${stuckSuggestions(t.title).map((s) => `<button class="chip" data-action="step-chip" data-id="${t.id}" data-text="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <div class="foot">
          <button class="btn quiet" data-action="close">Close</button>
          <button class="btn primary" data-action="stuck-start" data-id="${t.id}" ${t.steps.some((s) => !s.done) ? "" : "disabled"}>${I.play} Start step 1 · 5 min</button>
        </div>`;
    } else if (m.type === "pick") {
      const free = MAX_TOP - sel.topToday().length;
      const pool = [...S().tasks.filter((t) => t.status === "ready" && t.topDate !== today()), ...sel.inbox(), ...sel.whenever()];
      inner = `
        <h2>Pick ${free === 1 ? "one more" : `up to ${free}`}.</h2>
        <p class="sub">${free ? `${free} of ${MAX_TOP} slots free today. Choose what matters, not what's loudest.` : "All 3 slots are full. Finish or drop one first."}</p>
        <form class="inline-form" data-form="new-top"><input class="field" name="title" id="pickInput" placeholder="Something new…" maxlength="100" autocomplete="off" /><button class="btn sm primary" ${free ? "" : "disabled"}>Add to today</button></form>
        <div class="mini-list" style="margin-top:16px;max-height:320px;overflow:auto">
          ${pool.length ? pool.map((t) => `
            <button class="mini-item" data-action="add-top" data-id="${t.id}" ${free ? "" : "disabled"}>
              <span class="dot" style="background:${areaColor(t.area)}"></span><span class="t">${esc(t.title)}</span>
              ${t.energy ? `<span>${energyOf(t.energy).e}</span>` : ""}${t.est ? `<span class="mut mono" style="font-size:12px">${t.est}m</span>` : ""}
              <span class="add">+ Today</span>
            </button>`).join("") : `<div class="empty">Nothing in your lists yet. Type above.</div>`}
        </div>
        <div class="foot"><button class="btn ghost" data-action="close">Done</button></div>`;
    } else if (m.type === "reset") {
      inner = `
        <h2>Reset your day?</h2>
        <p class="sub">Today's priorities go back to your list and the energy check-in clears. Nothing is deleted. Fresh start, zero guilt.</p>
        <div class="foot"><button class="btn quiet" data-action="close">Cancel</button><button class="btn primary" data-action="reset-confirm">↺ Fresh start</button></div>`;
    } else if (m.type === "settings") {
      const st = S().settings;
      const sw = (k, label, hint) => `<div class="set-row"><div><b>${label}</b><small>${hint}</small></div><button class="switch ${st[k] ? "on" : ""}" data-action="toggle-setting" data-k="${k}" role="switch" aria-checked="${!!st[k]}" aria-label="${label}"></button></div>`;
      inner = `
        <h2>Settings</h2>
        <div style="margin-top:12px">
          <div class="set-row"><div><b>Name</b><small>How Life OS greets you</small></div><input class="field" style="width:180px" data-setting-name value="${esc(S().name)}" maxlength="24" /></div>
          ${sw("sound", "Sounds", "A short chime when you finish things")}
          ${sw("reduceMotion", "Calm mode", "Fewer animations and no confetti")}
          ${sw("alerts", "Desktop alerts", "Notify when a timer ends or you've hyperfocused")}
          <div class="set-row"><div><b>Hyperfocus check</b><small>Gentle nudge after focusing this long</small></div>
            <select class="field" style="width:130px" data-setting="hyperfocusMin">${[[0, "Off"], [45, "45 min"], [60, "1h"], [90, "1h 30m"], [120, "2h"]].map(([v, l]) => `<option value="${v}" ${st.hyperfocusMin === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
          <div class="set-row"><div><b>My day ends at</b><small>Used for the "time left today" bar</small></div>
            <select class="field" style="width:130px" data-setting="dayEnds">${[19, 20, 21, 22, 23, 24].map((v) => `<option value="${v}" ${st.dayEnds === v ? "selected" : ""}>${v}:00</option>`).join("")}</select></div>
          <div class="set-row"><div><b>Your data</b><small>Stored only in this browser</small></div>
            <div class="row"><button class="btn sm ghost" data-action="export">Export</button><label class="btn sm ghost">Import<input type="file" accept="application/json" data-import hidden /></label></div></div>
          <div class="set-row"><div><b>Start over</b><small>Deletes everything in this browser</small></div><button class="btn sm ghost" style="color:var(--pink)" data-action="wipe">Delete all</button></div>
        </div>
        <div class="foot"><button class="btn primary" data-action="close">Done</button></div>`;
    } else if (m.type === "wipe") {
      inner = `<h2>Delete everything?</h2><p class="sub">This removes all tasks, habits and check-ins from this browser. Consider exporting first.</p>
        <div class="foot"><button class="btn quiet" data-action="close">Cancel</button><button class="btn primary" style="background:var(--pink)" data-action="wipe-confirm">Delete all</button></div>`;
    }
    return `<div class="overlay" data-action="overlay"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
  };
  const openModal = (m) => { ui.modal = m; renderModal(); };
  const closeModal = () => { ui.modal = null; renderModal(); render(); };
  const renderModal = () => {
    $("#modal-root").innerHTML = modalHTML();
    const inp = $("#stepInput") || $("#pickInput");
    if (inp) inp.focus();
  };

  // ================================================================= RENDER
  const render = () => {
    document.documentElement.classList.toggle("calm", !!S().settings.reduceMotion);
    const app = $("#app");
    const cap = $("#capture");
    const capVal = cap ? cap.value : "";
    const capFocused = cap && document.activeElement === cap;
    const y = window.scrollY;

    if (!S().onboarded) {
      app.innerHTML = onboarding();
      const n = $("#onbName") || $("#onbDump");
      if (n) n.focus();
      return;
    }
    const views = { now: nowView, today: todayView, inbox: inboxView, habits: habitsView, checkin: checkinView, review: reviewView };
    const v = views[S().view] ? S().view : "now";
    app.innerHTML = shell(views[v]()) + (S().focus && ui.focusOpen ? focusOverlay() : "");
    const same = ui.lastView === v;
    if (same) { $(".view")?.classList.add("static"); window.scrollTo(0, y); }
    ui.lastView = v;
    const c2 = $("#capture");
    if (c2) { c2.value = capVal; if (capFocused) c2.focus(); }
    tick();
  };

  // ================================================================= EVENTS
  const act = (a, el, e) => {
    const s = S();
    const id = el.dataset.id;
    const t = id ? sel.task(id) : null;
    switch (a) {
      // onboarding
      case "onb-next": {
        if (ui.onbStep === 0) ui.onbName = $("#onbName").value;
        if (ui.onbStep === 2) ui.onbDump = $("#onbDump").value;
        if (ui.onbStep === 3) return finishOnboarding();
        ui.onbStep++;
        return render();
      }
      case "onb-back":
        if (ui.onbStep === 2) ui.onbDump = $("#onbDump").value;
        ui.onbStep = Math.max(0, ui.onbStep - 1);
        return render();
      case "onb-skip":
        ui.onbName = $("#onbName")?.value || "";
        return finishOnboarding();
      case "onb-area": {
        const i = ui.onbAreas.indexOf(id);
        i >= 0 ? ui.onbAreas.splice(i, 1) : ui.onbAreas.push(id);
        el.classList.toggle("on");
        return;
      }
      case "onb-pick": {
        const i = Number(el.dataset.i);
        const k = ui.onbPicks.indexOf(i);
        if (k >= 0) ui.onbPicks.splice(k, 1);
        else if (ui.onbPicks.length >= MAX_TOP) { toast("Three is plenty. Unpick one first."); return; }
        else ui.onbPicks.push(i);
        return render();
      }

      // navigation
      case "nav": s.view = el.dataset.view; save(); window.scrollTo(0, 0); return render();
      case "settings": return openModal({ type: "settings" });
      case "focus-capture": $("#capture")?.focus(); return;

      // tasks
      case "done": if (t) completeTask(id); return;
      case "undone": uncomplete(id); break;
      case "set-current": s.currentId = id; s.view = "now"; break;
      case "drop-top": if (t) { t.topDate = null; if (s.currentId === id) s.currentId = null; } break;
      case "add-top": if (!makeTop(id)) return; if (ui.modal) { save(); renderModal(); render(); return; } toast("Added to today ★"); break;
      case "ready": if (t) t.status = "ready"; break;
      case "later": later(id); break;
      case "del-task": {
        const idx = s.tasks.indexOf(t);
        s.tasks.splice(idx, 1);
        if (s.currentId === id) s.currentId = null;
        toast("Deleted", { action: { label: "Undo", fn: () => { s.tasks.splice(idx, 0, t); save(); render(); } } });
        break;
      }
      case "cycle": {
        const k = el.dataset.k;
        if (k === "area") { const keys = [null, ...Object.keys(AREAS)]; t.area = keys[(keys.indexOf(t.area) + 1) % keys.length]; }
        if (k === "energy") t.energy = t.energy === 3 ? null : (t.energy || 0) + 1;
        if (k === "est") t.est = EST_STEPS[(EST_STEPS.indexOf(t.est) + 1) % EST_STEPS.length];
        break;
      }
      case "inbox-tab": ui.inboxTab = el.dataset.v; return render();
      case "inbox-energy": ui.inboxEnergy = Number(el.dataset.v); return render();
      case "pick": return openModal({ type: "pick" });
      case "reset-day": return openModal({ type: "reset" });
      case "reset-confirm":
        sel.topToday().forEach((x) => (x.topDate = null));
        s.currentId = null;
        if (s.checkins[today()]) delete s.checkins[today()].energy;
        save();
        closeModal();
        toast("Fresh start. ✨ What's one thing?");
        return;

      // steps / stuck
      case "stuck": return openModal({ type: "stuck", id });
      case "step-chip":
        t.steps.push({ id: uid(), text: el.dataset.text, done: false });
        save(); renderModal(); render();
        return;
      case "step-toggle": {
        const st = t.steps.find((x) => x.id === el.dataset.step);
        st.done = !st.done;
        save(); renderModal(); render();
        return;
      }
      case "step-del":
        t.steps = t.steps.filter((x) => x.id !== el.dataset.step);
        save(); renderModal(); render();
        return;
      case "step-done": {
        const st = t.steps.find((x) => x.id === el.dataset.step);
        st.done = true;
        if (s.settings.sound) fx.chime();
        const left = t.steps.filter((x) => !x.done).length;
        toast(left ? `Step done ✓ ${left} to go.` : "All steps done! Mark the task as done?", left ? {} : { action: { label: "Done", fn: () => completeTask(t.id) } });
        break;
      }
      case "stuck-start":
        ui.modal = null;
        renderModal();
        return startFocus(id, 5, "5");

      // focus
      case "focus-5": return startFocus(id, 5, "5");
      case "focus-full": return startFocus(id, t.est || 25, "full");
      case "focus-open": ui.focusOpen = true; return render();
      case "focus-min": ui.focusOpen = false; return render();
      case "focus-stop": return endFocus();
      case "focus-extend": s.focus.dur += 5; s.focus.ended = false; break;
      case "nudge-ok": s.focus.nudged = false; s.focus.nudgeAt = focusElapsed() + 30; toast("Okay! I'll check again in 30 min."); break;
      case "noise": fx.noisePlaying() ? fx.noiseOff() : fx.noiseOn(); setTimeout(render, 30); return;

      // habits
      case "habit": {
        const h = s.habits.find((x) => x.id === id);
        const v = el.dataset.v;
        if (h.log[today()] === v) { delete h.log[today()]; break; }
        h.log[today()] = v;
        save(); render();
        reward(v === "mini" ? "Mini counts. Still showed up. ✓" : `${h.emoji} ${esc(h.name)} ✓`);
        return;
      }
      case "del-habit": {
        const h = s.habits.find((x) => x.id === id);
        const idx = s.habits.indexOf(h);
        s.habits.splice(idx, 1);
        toast("Habit removed", { action: { label: "Undo", fn: () => { s.habits.splice(idx, 0, h); save(); render(); } } });
        break;
      }
      case "habit-emoji": ui.habitEmoji = el.dataset.e; $$(".emoji-row button").forEach((b) => b.classList.toggle("on", b === el)); return;

      // check-in
      case "energy": s.checkins[today()] = { ...(s.checkins[today()] || {}), energy: Number(el.dataset.v) }; toast(`${energyOf(Number(el.dataset.v)).e} Got it. Suggestions adjusted.`); break;
      case "energy-reset": if (s.checkins[today()]) delete s.checkins[today()].energy; break;
      case "mood": s.checkins[today()] = { ...(s.checkins[today()] || {}), mood: Number(el.dataset.v) }; toast(`${MOODS[Number(el.dataset.v)].e} Logged. Thanks for checking in.`); break;

      // schedule
      case "del-event": s.schedule = s.schedule.filter((x) => x.id !== id); break;

      // settings & modals
      case "toggle-setting": {
        const k = el.dataset.k;
        s.settings[k] = !s.settings[k];
        if (k === "alerts" && s.settings.alerts && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
        save(); renderModal(); render();
        return;
      }
      case "export": {
        const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
        const a2 = document.createElement("a");
        a2.href = URL.createObjectURL(blob);
        a2.download = `life-os-${today()}.json`;
        a2.click();
        URL.revokeObjectURL(a2.href);
        return;
      }
      case "wipe": return openModal({ type: "wipe" });
      case "wipe-confirm": store.reset(); ui.modal = null; renderModal(); ui.onbStep = 0; return render();
      case "close": return closeModal();
      case "overlay": if (e.target === el) closeModal(); return;
      default: return;
    }
    save();
    render();
    if (ui.modal) renderModal();
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    if (el.dataset.action !== "overlay") e.stopPropagation();
    act(el.dataset.action, el, e);
  });

  document.addEventListener("submit", (e) => {
    const f = e.target.closest("form[data-form]");
    if (!f) return;
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const s = S();
    switch (f.dataset.form) {
      case "capture":
        if (d.text.trim()) { f.reset(); $("#capture").value = ""; capture(d.text); }
        return;
      case "dump":
        if (d.text.trim()) capture(d.text);
        return;
      case "event":
        s.schedule.push({ id: uid(), date: today(), time: d.time, label: d.label.trim(), dur: Number(d.dur), area: d.area || null });
        toast("Block added");
        break;
      case "habit":
        s.habits.push({ id: uid(), emoji: ui.habitEmoji, name: d.name.trim(), mini: d.mini.trim(), area: d.area || null, log: {} });
        toast(`${ui.habitEmoji} Habit added. Start tiny.`);
        break;
      case "checkin-note":
        s.checkins[today()] = { ...(s.checkins[today()] || {}), note: d.note.trim() };
        toast("Note saved");
        break;
      case "review":
        s.reviews.unshift({ at: Date.now(), a1: d.a1.trim(), a2: d.a2.trim(), a3: d.a3.trim() });
        save(); render();
        reward("Review saved. That's real self-awareness. ✓");
        return;
      case "step": {
        const t = sel.task(f.dataset.id);
        if (d.text.trim()) t.steps.push({ id: uid(), text: d.text.trim(), done: false });
        save(); renderModal(); render();
        return;
      }
      case "new-top": {
        if (!d.title.trim()) return;
        const t = addTask(d.title);
        if (!makeTop(t.id)) t.status = "ready";
        save(); renderModal(); render();
        return;
      }
      default: return;
    }
    save();
    render();
  });

  // "where I left off" notes + settings inputs save on change
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.note) { const t = sel.task(el.dataset.note); if (t) { t.note = el.value.trim(); save(); toast("📌 Saved for future you"); } }
    if (el.dataset.setting) { S().settings[el.dataset.setting] = Number(el.value); save(); render(); }
    if (el.hasAttribute("data-setting-name")) { S().name = el.value.trim(); save(); render(); }
    if (el.hasAttribute("data-import") && el.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        try { store.replace(JSON.parse(r.result)); ui.modal = null; renderModal(); render(); toast("Imported ✓"); }
        catch { toast("That file doesn't look like a Life OS export."); }
      };
      r.readAsText(el.files[0]);
    }
  });

  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#capture")?.focus(); return; }
    if (e.key === "/" && !typing && S().onboarded) { e.preventDefault(); $("#capture")?.focus(); return; }
    if (e.key === "Escape") {
      if (ui.modal) return closeModal();
      if (ui.focusOpen) { ui.focusOpen = false; return render(); }
      if (typing) document.activeElement.blur();
    }
    if (e.key === "Enter" && document.activeElement?.id === "onbName") act("onb-next", document.activeElement, e);
  });

  render();
  window.LOS.render = render;
})();
