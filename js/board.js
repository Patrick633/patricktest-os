/* Life OS — Board: move your brain dump around.
   Columns by status (Inbox → Today → Ready → Planned → Whenever → Done) or by life area.
   Drag with the mouse, or press-and-hold then drag with your finger. Tap a card to move it with one tap instead. */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  const { esc, store, sel, today, dkey, AREAS, MAX_TOP, makePlan, planLabel, planArrived, fmtDur } = window.LOS;
  const S = () => store.state;
  const app = () => window.LOS.app;
  const ui = { moveFor: null, justDragged: 0 };

  const group = () => S().settings.boardGroup || "status";

  const statusCols = () => [
    { key: "inbox", title: "📥 Inbox", hint: "raw thoughts", match: (t) => t.status === "inbox" && t.topDate !== today() },
    { key: "today", title: "★ Today", hint: `max ${MAX_TOP}`, match: (t) => t.topDate === today() && t.status !== "done" },
    { key: "ready", title: "✅ Ready", hint: "could do", match: (t) => t.status === "ready" && t.topDate !== today() && planArrived(t.plan) },
    { key: "planned", title: "📅 Planned", hint: "arrives later", match: (t) => t.status !== "done" && t.status !== "whenever" && t.topDate !== today() && t.plan && !planArrived(t.plan) },
    { key: "whenever", title: "🌙 Whenever", hint: "no pressure", match: (t) => t.status === "whenever" },
    { key: "done", title: "🎉 Done", hint: "today", match: (t) => t.status === "done" && t.doneAt && dkey(new Date(t.doneAt)) === today() },
  ];
  const areaCols = () => [
    ...Object.entries(AREAS).map(([id, a]) => ({ key: id, title: `${esc(a.emoji)} ${esc(a.name)}`, color: a.color, match: (t) => t.area === id && t.status !== "done" })),
    { key: "none", title: "No area", hint: "drag into an area", match: (t) => (!t.area || !AREAS[t.area]) && t.status !== "done" },
  ];
  const cols = () => (group() === "area" ? areaCols() : statusCols());

  // ---------------------------------------------------------------- moving
  const move = (id, col) => {
    const A = app();
    const t = sel.task(id);
    if (!t) return;
    if (group() === "area") {
      const v = col === "none" ? null : col;
      if (t.area === v) return;
      t.area = v;
      A.save(); A.render();
      A.toast(v ? `→ ${esc(AREAS[v].emoji)} ${esc(AREAS[v].name)}` : "→ No area");
      return;
    }
    if (t.status === "done" && col !== "done") A.uncomplete(id);
    switch (col) {
      case "inbox": t.status = "inbox"; t.topDate = null; t.plan = null; A.toast("→ Inbox"); break;
      case "today": if (!A.makeTop(id)) { A.render(); return; } A.toast("★ Today"); break;
      case "ready": t.status = "ready"; t.topDate = null; t.plan = null; A.toast("→ Ready"); break;
      case "planned": A.setPlan(t, makePlan("tomorrow")); break;
      case "whenever": A.later(id); break;
      case "done": A.completeTask(id); return;
      default: return;
    }
    A.save(); A.render();
  };

  // ---------------------------------------------------------------- drag & drop (mouse + touch)
  let drag = null;
  const colAt = (x, y) => {
    if (drag && drag.ghost) drag.ghost.style.visibility = "hidden";
    const el = document.elementFromPoint(x, y);
    if (drag && drag.ghost) drag.ghost.style.visibility = "";
    return el && el.closest("[data-col]");
  };
  const begin = (x, y) => {
    const r = drag.el.getBoundingClientRect();
    const g = drag.el.cloneNode(true);
    g.classList.add("bghost");
    Object.assign(g.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
    document.body.appendChild(g);
    Object.assign(drag, { started: true, ghost: g, dx: x - r.left, dy: y - r.top });
    drag.el.classList.add("dragging");
    document.body.classList.add("is-dragging");
    if (navigator.vibrate) navigator.vibrate(12);
  };
  const follow = (x, y) => {
    drag.ghost.style.left = `${x - drag.dx}px`;
    drag.ghost.style.top = `${y - drag.dy}px`;
    const c = colAt(x, y);
    document.querySelectorAll(".bcol.over").forEach((el) => { if (el !== c) el.classList.remove("over"); });
    if (c) c.classList.add("over");
    // auto-scroll the board sideways and the page up/down near the edges
    const board = document.querySelector(".board");
    if (board) { const b = board.getBoundingClientRect(); if (x < b.left + 48) board.scrollLeft -= 16; else if (x > b.right - 48) board.scrollLeft += 16; }
    if (y < 70) window.scrollBy(0, -14); else if (y > innerHeight - 90) window.scrollBy(0, 14);
  };
  const finish = (x, y) => {
    const d = drag;
    drag = null;
    clearTimeout(d.timer);
    if (!d.started) return;
    const c = colAt(x, y);
    if (d.ghost) d.ghost.remove();
    d.el.classList.remove("dragging");
    document.body.classList.remove("is-dragging");
    document.querySelectorAll(".bcol.over").forEach((el) => el.classList.remove("over"));
    ui.justDragged = Date.now();
    if (c && c.dataset.col !== d.from) move(d.id, c.dataset.col);
  };
  const cardFrom = (e) => { const el = e.target.closest && e.target.closest(".bcard"); return el && !e.target.closest("button, input, a, textarea") ? el : null; };

  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const el = cardFrom(e);
    if (!el) return;
    drag = { el, id: el.dataset.card, from: el.closest("[data-col]").dataset.col, x0: e.clientX, y0: e.clientY, started: false };
  });
  document.addEventListener("mousemove", (e) => {
    if (!drag || drag.touch) return;
    if (!drag.started && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) begin(e.clientX, e.clientY);
    if (drag && drag.started) { e.preventDefault(); follow(e.clientX, e.clientY); }
  });
  document.addEventListener("mouseup", (e) => { if (drag && !drag.touch) finish(e.clientX, e.clientY); });

  // touch: press and hold ~0.25s to pick up (so normal swiping still scrolls)
  document.addEventListener("touchstart", (e) => {
    const el = cardFrom(e);
    if (!el || e.touches.length > 1) return;
    const t = e.touches[0];
    drag = { el, id: el.dataset.card, from: el.closest("[data-col]").dataset.col, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, started: false, touch: true };
    drag.timer = setTimeout(() => { if (drag && !drag.started) begin(drag.x, drag.y); }, 250);
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!drag || !drag.touch) return;
    const t = e.touches[0];
    drag.x = t.clientX; drag.y = t.clientY;
    if (!drag.started) {
      if (Math.hypot(t.clientX - drag.x0, t.clientY - drag.y0) > 10) { clearTimeout(drag.timer); drag = null; } // it's a scroll
      return;
    }
    e.preventDefault();
    follow(t.clientX, t.clientY);
  }, { passive: false });
  document.addEventListener("touchend", () => { if (drag && drag.touch) finish(drag.x, drag.y); });
  document.addEventListener("touchcancel", () => { if (drag && drag.touch) finish(-1, -1); });

  // ---------------------------------------------------------------- view
  const card = (t) => {
    const a = AREAS[t.area];
    const meta = [
      a && group() !== "area" ? `<span class="dot" style="background:${a.color}"></span>${esc(a.name)}` : "",
      t.est ? `⏱ ${fmtDur(t.est)}` : "",
      t.plan && group() !== "status" ? `📅 ${planLabel(t.plan)}` : t.plan && !planArrived(t.plan) ? `📅 ${planLabel(t.plan)}` : "",
      t.steps && t.steps.length ? `${t.steps.filter((x) => x.done).length}/${t.steps.length} steps` : "",
    ].filter(Boolean);
    return `
      <div class="bcard ${t.status === "done" ? "done" : ""}" data-card="${t.id}" data-action="board-tap" data-id="${t.id}" tabindex="0" style="--ac:${a ? a.color : "var(--line-2)"}">
        <span class="bt">${esc(t.title)}</span>
        ${meta.length ? `<span class="bmeta">${meta.join(" · ")}</span>` : ""}
        ${ui.moveFor === t.id ? `
          <div class="bmove">
            <span class="mut" style="font-size:11px;width:100%">Move to</span>
            ${cols().filter((c) => !c.match(t)).map((c) => `<button class="chip" data-action="board-move" data-id="${t.id}" data-col="${c.key}">${c.title}</button>`).join("")}
            <button class="chip" data-action="board-rename" data-id="${t.id}">✎ Rename</button>
            <button class="chip" data-action="stuck" data-id="${t.id}">Break down</button>
            ${window.LOS.calendar && window.LOS.calendar.remindersOn() ? `<button class="chip" data-action="rem-send" data-id="${t.id}">→ Reminders</button>` : ""}
          </div>` : ""}
      </div>`;
  };

  const view = () => {
    const list = S().tasks;
    return `
      <div class="board-tools">
        <form class="capture-inline" data-form="board-add">
          <input class="field" name="text" placeholder="Brain dump… (Enter to add to Inbox)" autocomplete="off" maxlength="140" />
          <button class="btn sm primary">Add</button>
        </form>
        <div class="seg"><button class="${group() === "status" ? "on" : ""}" data-action="board-group" data-v="status">By status</button><button class="${group() === "area" ? "on" : ""}" data-action="board-group" data-v="area">By area</button></div>
      </div>
      <p class="mut board-hint">${matchMedia("(hover: none)").matches ? "Press and hold a card, then drag it. Or tap it to move." : "Drag cards between columns, or click a card to move it."}</p>
      <div class="board">
        ${cols().map((c) => {
          const items = list.filter(c.match);
          return `
            <div class="bcol" data-col="${c.key}" ${c.color ? `style="--cc:${c.color}"` : ""}>
              <div class="bcol-h"><span>${c.title}</span><span class="mono mut">${items.length}${c.key === "today" ? `/${MAX_TOP}` : ""}</span></div>
              ${c.hint ? `<div class="bcol-hint">${c.hint}</div>` : ""}
              <div class="bcol-list">${items.map(card).join("") || `<div class="bempty">Drop here</div>`}</div>
            </div>`;
        }).join("")}
      </div>`;
  };

  const act = (a, el) => {
    if (!a.startsWith("board-")) return false;
    const A = app();
    switch (a) {
      case "board-tap":
        if (Date.now() - ui.justDragged < 400) return true; // that was a drag, not a tap
        ui.moveFor = ui.moveFor === el.dataset.id ? null : el.dataset.id;
        A.render();
        return true;
      case "board-move": ui.moveFor = null; move(el.dataset.id, el.dataset.col); return true;
      case "board-rename": {
        const t = sel.task(el.dataset.id);
        const v = t && window.prompt("Rename task", t.title);
        if (t && v && v.trim()) { t.title = v.trim().slice(0, 140); ui.moveFor = null; A.save(); A.render(); A.toast("Renamed ✓"); }
        return true;
      }
      case "board-group": S().settings.boardGroup = el.dataset.v; ui.moveFor = null; A.save(); A.render(); return true;
      default: return false;
    }
  };
  const submit = (form, d) => {
    if (form.dataset.form !== "board-add") return false;
    if (d.text && d.text.trim()) app().capture(d.text);
    setTimeout(() => document.querySelector('form[data-form="board-add"] input')?.focus(), 30);
    return true;
  };

  window.LOS.board = { view, act, submit, move };
})();
