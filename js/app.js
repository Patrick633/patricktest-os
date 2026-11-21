/* Life OS — hábitos, humor, tarefas e metas num só lugar.
   Vanilla JS, sem build. Dados ficam no localStorage do navegador. */
(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const pad = (n) => String(n).padStart(2, "0");
  const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
  const WD_LONG = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const icon = {
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    arrow: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg>',
    arrowSm: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    habits: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M15 17.5l2 2 4-4"/></svg>',
    mood: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/></svg>',
    goals: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  };

  // ---------- Data ----------
  const MOODS = [
    { e: "😫", l: "Exausto" },
    { e: "🙁", l: "Pra baixo" },
    { e: "😐", l: "Neutro" },
    { e: "🙂", l: "Bem" },
    { e: "😂", l: "Feliz" },
  ];

  const AREAS = [
    { id: "saude", e: "🏃", n: "Saúde", d: "Corpo e energia", bg: "#ffe4d4", rot: -4 },
    { id: "mente", e: "🧘", n: "Mente", d: "Calma e foco", bg: "#e6e3ff", rot: 3 },
    { id: "trabalho", e: "💼", n: "Trabalho", d: "Produtividade", bg: "#fdf1c7", rot: 2 },
    { id: "financas", e: "💰", n: "Finanças", d: "Dinheiro em dia", bg: "#dff5e1", rot: -3 },
    { id: "estudos", e: "📚", n: "Estudos", d: "Aprender sempre", bg: "#dbeefe", rot: -2 },
    { id: "relacoes", e: "❤️", n: "Relações", d: "Pessoas queridas", bg: "#ffe0e6", rot: 4 },
  ];

  const SUGGEST = {
    saude: [["💧", "Beber 2L de água"], ["🏃", "Treinar 30 min"]],
    mente: [["🧘", "Meditar 10 min"], ["📓", "Escrever no diário"]],
    trabalho: [["🎯", "Definir 3 prioridades"], ["⏱️", "Bloco de foco 90 min"]],
    financas: [["💰", "Registrar gastos"]],
    estudos: [["📚", "Ler 20 páginas"]],
    relacoes: [["💬", "Falar com alguém querido"]],
  };

  const EMOJIS = ["💧", "🏃", "🧘", "📚", "🎯", "💰", "😴", "🥗", "📓", "🎸", "🚀", "🔥", "💬", "🌿", "☀️", "🧠"];

  // ---------- State ----------
  const STORE = "lifeos.v1";
  const defaults = () => ({
    onboarded: false,
    step: 0,
    name: "",
    areas: [],
    habits: [],
    moods: {},
    tasks: [],
    goals: [],
    tab: "home",
  });
  const load = () => {
    try {
      const raw = localStorage.getItem(STORE);
      return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
    } catch { return defaults(); }
  };
  let state = load();
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* sem storage: segue em memória */ } };

  // estado transitório de UI (não persistido)
  const ui = { mood: 3, newEmoji: "🔥", trayOpen: false, goalEmoji: "🚀" };

  // ---------- Derived ----------
  const today = () => dkey();
  const isDone = (h, k = today()) => !!h.log[k];
  const streak = (h) => {
    let d = new Date();
    if (!isDone(h, dkey(d))) d = addDays(d, -1);
    let n = 0;
    while (isDone(h, dkey(d))) { n++; d = addDays(d, -1); }
    return n;
  };
  const dayRatio = (k) => {
    if (!state.habits.length) return 0;
    return state.habits.filter((h) => isDone(h, k)).length / state.habits.length;
  };

  // ---------- Toast ----------
  let toastT;
  const toast = (msg) => {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 1800);
  };

  // ---------- Reusable pieces ----------
  const goButton = (progress, action, disabled = false) => {
    const r = 39, c = 2 * Math.PI * r;
    return `
      <button class="go" data-action="${action}" ${disabled ? "disabled" : ""} aria-label="Continuar">
        <svg class="ring" width="84" height="84" viewBox="0 0 84 84">
          <defs><linearGradient id="goGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5f76b"/><stop offset="1" stop-color="#f2b84a"/></linearGradient></defs>
          <circle class="track" cx="42" cy="42" r="${r}"/>
          <circle class="gbar" cx="42" cy="42" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - progress)}"/>
        </svg>
        <span class="core">${icon.arrow}</span>
      </button>`;
  };

  const onbHead = (step, total) => `
    <div class="onb-head">
      <button class="icon-btn" data-action="onb-back" aria-label="Voltar">${icon.back}</button>
      <span class="count">${step} de ${total}</span>
      <button class="pill-btn" data-action="onb-skip">Pular</button>
    </div>`;

  // Mood dial (semicircle) ------------------------------------------
  const DIAL = { cx: 170, cy: 182, R: 140 };
  const polar = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [DIAL.cx + r * Math.cos(a), DIAL.cy - r * Math.sin(a)];
  };
  const valToDeg = (v) => 180 - v * 45;
  const arcPath = (fromDeg, toDeg, r) => {
    const [x1, y1] = polar(fromDeg, r), [x2, y2] = polar(toDeg, r);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const dial = (v) => {
    let ticks = "";
    for (let i = 0; i <= 40; i++) {
      const deg = 180 - i * 4.5, long = i % 5 === 0;
      const [x1, y1] = polar(deg, 152), [x2, y2] = polar(deg, long ? 166 : 160);
      ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#f2804a" stroke-opacity="${(0.25 + (i / 40) * 0.75).toFixed(2)}" stroke-width="${long ? 2.4 : 1.6}" stroke-linecap="round"/>`;
    }
    const [kx, ky] = polar(valToDeg(v), DIAL.R);
    return `
      <div class="dial" id="dial">
        <svg viewBox="0 0 340 196" aria-label="Seletor de humor" role="slider" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${v}" tabindex="0">
          <defs>
            <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#ffe4d4"/><stop offset="1" stop-color="#f2804a"/>
            </linearGradient>
          </defs>
          ${ticks}
          <path d="${arcPath(180, 0, DIAL.R)}" stroke="#f5f5f4" stroke-width="16" fill="none" stroke-linecap="round"/>
          <path class="fill" d="${arcPath(180, Math.min(valToDeg(v), 179.5), DIAL.R)}" stroke="url(#dialGrad)" stroke-width="16" fill="none" stroke-linecap="round"/>
          <circle class="knob" cx="${kx}" cy="${ky}" r="12" fill="#f2804a" stroke="#fff" stroke-width="4"/>
          <circle cx="${DIAL.cx}" cy="${DIAL.cy}" r="4" fill="#f2804a"/>
        </svg>
      </div>`;
  };
  const moodStage = (v) => `
    <div class="mood-stage" id="moodStage">
      ${MOODS.map((m, i) => `<span class="mood-emo" data-action="mood-pick" data-v="${i}">${m.e}</span>`).join("")}
    </div>
    <span class="mood-label" id="moodLabel">${MOODS[v].l}</span>`;

  const paintMood = (v) => {
    ui.mood = v;
    document.querySelectorAll(".mood-emo").forEach((el, i) => {
      const off = i - v, dist = Math.abs(off);
      el.style.transform = `translate(calc(-50% + ${off * 78}px), calc(-50% + ${dist * 14}px)) scale(${dist === 0 ? 1 : 0.55})`;
      el.style.opacity = dist > 2 ? 0 : dist === 0 ? 1 : 0.75;
      el.style.filter = dist === 0 ? "none" : "saturate(0.8)";
    });
    const lbl = $("#moodLabel");
    if (lbl) lbl.textContent = MOODS[v].l;
    const svg = $("#dial svg");
    if (svg) {
      const deg = valToDeg(v), [kx, ky] = polar(deg, DIAL.R);
      $(".knob", svg).setAttribute("cx", kx);
      $(".knob", svg).setAttribute("cy", ky);
      $(".fill", svg).setAttribute("d", arcPath(180, Math.min(deg, 179.5), DIAL.R));
      svg.setAttribute("aria-valuenow", v);
    }
  };

  const bindDial = () => {
    const wrap = $("#dial");
    if (!wrap) return;
    const svg = $("svg", wrap);
    const fromEvent = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      let deg = (Math.atan2(DIAL.cy - p.y, p.x - DIAL.cx) * 180) / Math.PI;
      if (deg < 0) deg = p.x < DIAL.cx ? 180 : 0;
      return Math.max(0, Math.min(4, Math.round((180 - deg) / 45)));
    };
    svg.addEventListener("pointerdown", (e) => {
      wrap.classList.add("dragging");
      svg.setPointerCapture(e.pointerId);
      paintMood(fromEvent(e));
    });
    svg.addEventListener("pointermove", (e) => {
      if (!wrap.classList.contains("dragging")) return;
      const v = fromEvent(e);
      if (v !== ui.mood) paintMood(v);
    });
    const end = () => wrap.classList.remove("dragging");
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") paintMood(Math.max(0, ui.mood - 1));
      if (e.key === "ArrowRight" || e.key === "ArrowUp") paintMood(Math.min(4, ui.mood + 1));
    });
  };

  // ---------- Onboarding screens ----------
  const TOTAL = 3;

  const welcome = () => `
    <section class="screen onb">
      <div class="hero" aria-hidden="true">
        <div class="col" style="left:8%;height:230px"></div>
        <div class="col" style="left:31%;height:320px"></div>
        <div class="col" style="left:54%;height:200px"></div>
        <div class="col" style="left:77%;height:300px"></div>
        <svg class="wave" viewBox="0 0 400 120" preserveAspectRatio="none">
          <defs><linearGradient id="waveGrad" x1="0" x2="1"><stop offset="0" stop-color="#f6c08a"/><stop offset=".5" stop-color="#f2804a"/><stop offset="1" stop-color="#ef4b45"/></linearGradient></defs>
          <path d="M0 95 C 70 20, 140 10, 210 55 S 340 110, 400 20"/>
        </svg>
        <div class="bubble" style="left:6%;top:70px;width:56px;height:56px;background:#ffe4d4;font-size:26px">🧑🏻</div>
        <div class="bubble" style="left:30%;top:120px;width:52px;height:52px;background:#dbeefe;font-size:24px;animation-delay:.6s,.15s">👩🏽</div>
        <div class="bubble" style="left:52%;top:250px;width:50px;height:50px;background:#fdf1c7;font-size:24px;animation-delay:1.1s,.3s">🧔🏾</div>
        <div class="bubble" style="left:76%;top:270px;width:44px;height:44px;background:#e6e3ff;font-size:20px;animation-delay:.3s,.45s">👱🏼‍♀️</div>
        <span class="floaty" style="left:28%;top:56px;animation-delay:.2s,.5s">😍</span>
        <span class="floaty" style="left:66%;top:60px;animation-delay:1.2s,.6s">💬</span>
        <span class="floaty" style="left:82%;top:150px;animation-delay:.7s,.7s">🚀</span>
        <span class="floaty" style="left:12%;top:225px;animation-delay:1.5s,.8s">🔥</span>
        <span class="floaty" style="left:40%;top:210px;animation-delay:.4s,.9s">🥰</span>
        <span class="tag l" style="--c:var(--blue);background:var(--blue);left:22%;top:40px">Foco</span>
        <span class="tag r" style="--c:var(--orange);background:var(--orange);left:68%;top:110px">Treino</span>
        <span class="tag l" style="--c:var(--red);background:var(--red);left:44%;top:315px;animation-delay:1s,1s">Leitura</span>
        <span class="tag r" style="--c:var(--purple);background:var(--purple);left:8%;top:330px;animation-delay:.5s,1.1s">Sono</span>
      </div>
      <div class="welcome-text">
        <h1>Bem-vindo ao<br>seu Life OS</h1>
        <p>Hábitos, humor, tarefas e metas<br>num só lugar, no seu ritmo.</p>
      </div>
      <div class="welcome-foot">
        <button class="cta" data-action="onb-next">Começar <span class="ring-ico">${icon.arrowSm}</span></button>
      </div>
    </section>`;

  const stepName = () => `
    <section class="screen onb">
      ${onbHead(1, TOTAL)}
      <div class="onb-body">
        <h1 class="title">Como podemos<br>te chamar?</h1>
        <p class="subtitle">Vamos personalizar sua rotina a partir daqui.</p>
        <input class="big-input" id="nameInput" maxlength="24" placeholder="Seu nome" value="${esc(state.name)}" autocomplete="given-name" />
      </div>
      <div class="onb-foot">${goButton(1 / TOTAL, "onb-next")}</div>
    </section>`;

  const stepAreas = () => `
    <section class="screen onb">
      ${onbHead(2, TOTAL)}
      <div class="onb-body">
        <h1 class="title">Escolha suas<br>áreas de foco</h1>
        <p class="subtitle">Selecione quantas quiser, sugerimos hábitos para cada uma.</p>
        <div class="areas">
          ${AREAS.map((a) => `
            <button class="area ${state.areas.includes(a.id) ? "on" : ""}" style="--rot:${a.rot}deg;--bg:${a.bg}" data-action="toggle-area" data-id="${a.id}">
              <span class="emo">${a.e}</span>
              <span><b>${a.n}</b><br><span class="d">${a.d}</span></span>
              <span class="check">${icon.check}</span>
            </button>`).join("")}
        </div>
      </div>
      <div class="onb-foot">${goButton(2 / TOTAL, "onb-next", !state.areas.length)}</div>
    </section>`;

  const stepMood = () => `
    <section class="screen onb">
      ${onbHead(3, TOTAL)}
      <div class="onb-body">
        <h1 class="title">Como você está<br>se sentindo hoje?</h1>
        <p class="subtitle">O registro de humor ajuda você a entender<br>seu estado de espírito ao longo do tempo.</p>
        ${moodStage(ui.mood)}
        ${dial(ui.mood)}
      </div>
      <div class="onb-foot">${goButton(1, "onb-finish")}</div>
    </section>`;

  // ---------- App screens ----------
  const nav = () => `
    <nav class="nav" aria-label="Navegação">
      ${[["home", "Hoje"], ["habits", "Hábitos"], ["mood", "Humor"], ["goals", "Metas"]]
        .map(([t, l]) => `<button class="${state.tab === t ? "on" : ""}" data-action="tab" data-tab="${t}" aria-label="${l}">${icon[t]}</button>`).join("")}
    </nav>`;

  const weekStrip = () => {
    const now = new Date();
    const start = addDays(now, -now.getDay());
    let out = "";
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i), k = dkey(d), r = dayRatio(k);
      const isToday = k === today();
      out += `<div class="day ${isToday ? "today" : ""}">${WD[i]}<b>${d.getDate()}</b><span class="dot ${r >= 1 ? "full" : r > 0 ? "some" : ""}"></span></div>`;
    }
    return `<div class="week">${out}</div>`;
  };

  const habitRow = (h) => {
    const done = isDone(h), s = streak(h);
    return `
      <div class="card habit ${done ? "done" : ""}">
        <span class="emo">${h.emoji}</span>
        <div class="info"><b>${esc(h.name)}</b><small>${s ? `🔥 ${s} ${s === 1 ? "dia" : "dias"} seguidos` : "Comece hoje"}</small></div>
        <button class="tick ${done ? "on" : ""}" data-action="toggle-habit" data-id="${h.id}" aria-label="Marcar ${esc(h.name)}">${icon.check}</button>
      </div>`;
  };

  const taskRow = (t) => `
    <div class="card task ${t.done ? "done" : ""}">
      <button class="box" data-action="toggle-task" data-id="${t.id}" aria-label="Concluir tarefa">${icon.check}</button>
      <span>${esc(t.text)}</span>
      <button class="del" data-action="del-task" data-id="${t.id}" aria-label="Remover">${icon.x}</button>
    </div>`;

  const homeScreen = () => {
    const total = state.habits.length;
    const done = state.habits.filter((h) => isDone(h)).length;
    const ratio = total ? done / total : 0;
    const r = 36, c = 2 * Math.PI * r;
    const m = state.moods[today()];
    const tasks = state.tasks.filter((t) => t.date === today() || !t.done);
    const openTasks = state.tasks.filter((t) => !t.done).length;
    const dateStr = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    const headline = ratio >= 1 ? "Dia completo! 🎉" : ratio >= 0.5 ? "Quase lá, continue!" : "Bora começar o dia";
    return `
      <section class="screen stagger">
        <div class="top">
          <div class="avatar">${esc((state.name || "?")[0].toUpperCase())}</div>
          <div class="hello"><small>${dateStr}</small><h2>${greet}, ${esc(state.name || "você")}</h2></div>
        </div>
        ${weekStrip()}
        <div class="today-card">
          <div class="prog">
            <svg width="84" height="84" viewBox="0 0 84 84"><circle class="t" cx="42" cy="42" r="${r}"/><circle class="b" cx="42" cy="42" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - ratio)}"/></svg>
            <span>${Math.round(ratio * 100)}%</span>
          </div>
          <div><h3>${headline}</h3><p>${done} de ${total} hábitos concluídos hoje</p></div>
        </div>
        <div class="mini-row">
          <button class="card mini" data-action="tab" data-tab="mood">
            <span class="e">${m ? MOODS[m.v].e : "🫥"}</span>
            <span><b>${m ? MOODS[m.v].l : "Registrar humor"}</b><br><small>${m ? "Humor de hoje" : "Como você está?"}</small></span>
          </button>
          <button class="mini dark" data-action="tab" data-tab="goals">
            <span class="e">🎯</span>
            <span><b>${state.goals.length} ${state.goals.length === 1 ? "meta" : "metas"}</b><br><small>${openTasks} tarefas abertas</small></span>
          </button>
        </div>
        <div class="section-title">Hábitos de hoje <small>${done}/${total}</small></div>
        <div class="list">
          ${total ? state.habits.map(habitRow).join("") : `<div class="empty">Nenhum hábito ainda. Crie um na aba Hábitos.</div>`}
        </div>
        <div class="section-title">Tarefas <small>${openTasks} abertas</small></div>
        <form class="add" data-form="task">
          <input name="text" placeholder="Adicionar tarefa…" maxlength="80" autocomplete="off" />
          <button class="plus" aria-label="Adicionar">${icon.plus}</button>
        </form>
        <div class="list" style="margin-top:10px">${tasks.map(taskRow).join("")}</div>
      </section>`;
  };

  const habitsScreen = () => {
    const now = new Date();
    const days = [...Array(7)].map((_, i) => addDays(now, i - 6));
    return `
      <section class="screen stagger">
        <div class="page-head"><h1>Hábitos</h1><span class="pill-btn">${state.habits.length} ativos</span></div>
        <div class="section-title">Novo hábito</div>
        <div>
          <form class="add" data-form="habit">
            <button type="button" class="emo-pick" data-action="tray">${ui.newEmoji}</button>
            <input name="name" placeholder="Ex.: Caminhar 20 min" maxlength="40" autocomplete="off" />
            <button class="plus" aria-label="Criar hábito">${icon.plus}</button>
          </form>
          ${ui.trayOpen ? `<div class="emoji-tray">${EMOJIS.map((e) => `<button class="${e === ui.newEmoji ? "on" : ""}" data-action="pick-emoji" data-e="${e}">${e}</button>`).join("")}</div>` : ""}
        </div>
        <div class="section-title">Últimos 7 dias</div>
        <div class="list">
          ${state.habits.length ? state.habits.map((h) => `
            <div class="card habit">
              <span class="emo">${h.emoji}</span>
              <div class="info">
                <b>${esc(h.name)}</b>
                <small>🔥 ${streak(h)} · ${days.filter((d) => isDone(h, dkey(d))).length}/7 na semana</small>
                <div class="grid7">${days.map((d) => {
                  const k = dkey(d);
                  return `<i class="${isDone(h, k) ? "on" : ""} ${k === today() ? "today" : ""}" title="${WD_LONG[d.getDay()]}">${WD[d.getDay()]}</i>`;
                }).join("")}</div>
              </div>
              <button class="del" data-action="del-habit" data-id="${h.id}" aria-label="Remover hábito">${icon.x}</button>
            </div>`).join("") : `<div class="empty">Crie seu primeiro hábito acima ✨</div>`}
        </div>
      </section>`;
  };

  const moodScreen = () => {
    const existing = state.moods[today()];
    if (existing && ui.moodInit !== today()) { ui.mood = existing.v; ui.moodInit = today(); }
    const now = new Date();
    const days = [...Array(14)].map((_, i) => addDays(now, i - 13));
    return `
      <section class="screen stagger">
        <div>
          <h1 class="title" style="margin-top:8px">Como você está<br>se sentindo hoje?</h1>
          <p class="subtitle">Arraste no arco ou toque num emoji.</p>
        </div>
        <div>${moodStage(ui.mood)}${dial(ui.mood)}</div>
        <textarea class="note" id="moodNote" maxlength="200" placeholder="Quer anotar algo sobre o seu dia? (opcional)">${esc(existing?.note || "")}</textarea>
        <div style="margin-top:18px">${goButton(existing ? 1 : 0.5, "save-mood")}</div>
        <div class="section-title">Últimos 14 dias</div>
        <div class="card history">
          ${days.map((d) => {
            const m = state.moods[dkey(d)];
            return `<div class="h"><em>${m ? MOODS[m.v].e : ""}</em><i class="${m ? "" : "none"}" style="height:${m ? 14 + m.v * 14 : 8}px"></i><span>${d.getDate()}</span></div>`;
          }).join("")}
        </div>
      </section>`;
  };

  const goalsScreen = () => `
    <section class="screen stagger">
      <div class="page-head"><h1>Metas</h1><span class="pill-btn">${state.goals.filter((g) => g.progress >= 100).length}/${state.goals.length} concluídas</span></div>
      <div class="section-title">Nova meta</div>
      <form class="add" data-form="goal">
        <button type="button" class="emo-pick" data-action="cycle-goal-emoji">${ui.goalEmoji}</button>
        <input name="title" placeholder="Ex.: Correr 5 km" maxlength="40" autocomplete="off" />
        <button class="plus" aria-label="Criar meta">${icon.plus}</button>
      </form>
      <div class="section-title">Em andamento</div>
      <div class="list">
        ${state.goals.length ? state.goals.map((g) => `
          <div class="card goal">
            <div class="goal-top">
              <span class="emo">${g.emoji}</span>
              <div><b>${esc(g.title)}</b><small>${g.progress >= 100 ? "Concluída 🎉" : "Em progresso"}</small></div>
              <span class="pct">${g.progress}%</span>
            </div>
            <div class="bar"><i style="width:${g.progress}%"></i></div>
            <div class="goal-actions">
              <button class="pill-btn" data-action="goal-step" data-id="${g.id}" data-d="-10">−10%</button>
              <button class="pill-btn" data-action="goal-step" data-id="${g.id}" data-d="10" style="background:var(--lime)">+10%</button>
              <button class="del" data-action="del-goal" data-id="${g.id}" aria-label="Remover meta">${icon.x}</button>
            </div>
          </div>`).join("") : `<div class="empty">Defina uma meta para acompanhar 🎯</div>`}
      </div>
    </section>`;

  // ---------- Render ----------
  let lastView = null;
  const render = () => {
    const app = $("#app");
    let html;
    if (!state.onboarded) {
      html = [welcome, stepName, stepAreas, stepMood][state.step]();
    } else {
      html = { home: homeScreen, habits: habitsScreen, mood: moodScreen, goals: goalsScreen }[state.tab]() + nav();
    }
    const view = state.onboarded ? state.tab : `onb${state.step}`;
    const same = view === lastView;
    const scroll = same ? ($(".screen")?.scrollTop || 0) : 0;
    app.innerHTML = html;
    if (same) { const sc = $(".screen"); sc.classList.add("static"); sc.scrollTop = scroll; }
    lastView = view;
    if ($("#moodStage")) { paintMood(ui.mood); bindDial(); }
    const ni = $("#nameInput");
    if (ni) {
      ni.focus();
      ni.addEventListener("keydown", (e) => { if (e.key === "Enter") act("onb-next"); });
    }
  };

  // ---------- Actions ----------
  const finishOnboarding = () => {
    if (!state.name) state.name = "você";
    if (!state.habits.length) {
      const areas = state.areas.length ? state.areas : ["saude", "mente"];
      areas.forEach((a) => (SUGGEST[a] || []).forEach(([e, n]) => state.habits.push({ id: uid(), emoji: e, name: n, log: {} })));
    }
    if (!state.goals.length) state.goals.push({ id: uid(), emoji: "🚀", title: "Manter a rotina por 30 dias", progress: 0 });
    state.moods[today()] = { v: ui.mood, note: "" };
    ui.moodInit = today();
    state.onboarded = true;
    state.tab = "home";
    save();
    render();
    toast(`Tudo pronto, ${state.name}! ✨`);
  };

  const act = (action, el) => {
    const id = el?.dataset.id;
    switch (action) {
      case "onb-next":
        if (state.step === 1) {
          const v = $("#nameInput").value.trim();
          if (!v) { toast("Digite seu nome 🙂"); return; }
          state.name = v;
        }
        state.step = Math.min(3, state.step + 1);
        break;
      case "onb-back":
        state.step = Math.max(0, state.step - 1);
        break;
      case "onb-skip":
      case "onb-finish":
        finishOnboarding();
        return;
      case "toggle-area": {
        const i = state.areas.indexOf(id);
        i >= 0 ? state.areas.splice(i, 1) : state.areas.push(id);
        // atualização local para preservar a animação
        el.classList.toggle("on");
        const go = $(".go");
        if (go) go.toggleAttribute("disabled", !state.areas.length);
        save();
        return;
      }
      case "mood-pick":
        paintMood(Number(el.dataset.v));
        return;
      case "tab":
        state.tab = el.dataset.tab;
        ui.trayOpen = false;
        break;
      case "toggle-habit": {
        const h = state.habits.find((x) => x.id === id);
        if (!h) return;
        const k = today();
        h.log[k] ? delete h.log[k] : (h.log[k] = true);
        if (h.log[k]) {
          const allDone = state.habits.every((x) => isDone(x));
          toast(allDone ? "Todos os hábitos de hoje feitos! 🎉" : `${h.emoji} Feito! Sequência de ${streak(h)} 🔥`);
        }
        break;
      }
      case "del-habit":
        state.habits = state.habits.filter((x) => x.id !== id);
        toast("Hábito removido");
        break;
      case "tray":
        ui.trayOpen = !ui.trayOpen;
        break;
      case "pick-emoji":
        ui.newEmoji = el.dataset.e;
        ui.trayOpen = false;
        break;
      case "toggle-task": {
        const t = state.tasks.find((x) => x.id === id);
        if (t) { t.done = !t.done; t.date = today(); }
        break;
      }
      case "del-task":
        state.tasks = state.tasks.filter((x) => x.id !== id);
        break;
      case "save-mood":
        state.moods[today()] = { v: ui.mood, note: ($("#moodNote")?.value || "").trim() };
        toast(`Humor salvo: ${MOODS[ui.mood].e} ${MOODS[ui.mood].l}`);
        break;
      case "cycle-goal-emoji": {
        const list = ["🚀", "🎯", "🏆", "💪", "📈", "🌱", "✈️", "🏠"];
        ui.goalEmoji = list[(list.indexOf(ui.goalEmoji) + 1) % list.length];
        el.textContent = ui.goalEmoji;
        return;
      }
      case "goal-step": {
        const g = state.goals.find((x) => x.id === id);
        if (g) {
          g.progress = Math.max(0, Math.min(100, g.progress + Number(el.dataset.d)));
          if (g.progress === 100) toast(`Meta concluída: ${g.title} 🏆`);
        }
        break;
      }
      case "del-goal":
        state.goals = state.goals.filter((x) => x.id !== id);
        break;
      default:
        return;
    }
    save();
    render();
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (el && !el.disabled) act(el.dataset.action, el);
  });

  document.addEventListener("submit", (e) => {
    const f = e.target.closest("form[data-form]");
    if (!f) return;
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    const kind = f.dataset.form;
    if (kind === "task" && data.text.trim()) {
      state.tasks.unshift({ id: uid(), text: data.text.trim(), done: false, date: today() });
    } else if (kind === "habit" && data.name.trim()) {
      state.habits.push({ id: uid(), emoji: ui.newEmoji, name: data.name.trim(), log: {} });
      toast(`${ui.newEmoji} Hábito criado`);
    } else if (kind === "goal" && data.title.trim()) {
      state.goals.push({ id: uid(), emoji: ui.goalEmoji, title: data.title.trim(), progress: 0 });
      toast("Meta criada 🎯");
    } else return;
    save();
    render();
    const inp = $(`form[data-form="${kind}"] input`);
    if (inp) inp.focus();
  });

  render();
})();
