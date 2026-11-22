/* Life OS — Areas: create your own life areas (name, emoji, color) and see everything in each one. */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  const { esc, store, AREAS, DEFAULT_AREAS, AREA_COLORS, applyAreas, uid, today, fmtDur } = window.LOS;
  const S = () => store.state;
  const app = () => window.LOS.app;
  const ui = { editId: null, newColor: AREA_COLORS[0], newEmoji: "✨" };
  const EMOJIS = ["✨", "🏃", "🧘", "💼", "💰", "📚", "💬", "⛪", "🏠", "❤️", "🎸", "🛡️", "🎮", "🍳", "🌱", "✈️", "🎓", "🧹", "👨‍👩‍👧", "💻"];

  /** the editable list; the first edit turns the defaults into your own list */
  const defs = () => {
    if (!Array.isArray(S().areaDefs)) S().areaDefs = DEFAULT_AREAS.map((a) => ({ ...a }));
    return S().areaDefs;
  };
  const commit = () => { applyAreas(S()); app().save(); app().render(); };

  const stats = (id) => {
    const open = S().tasks.filter((t) => t.area === id && t.status !== "done");
    return {
      open,
      done7: S().tasks.filter((t) => t.area === id && t.status === "done" && t.doneAt && Date.now() - t.doneAt < 7 * 864e5).length,
      habits: S().habits.filter((h) => h.area === id),
      projects: (S().projects || []).filter((p) => p.area === id && p.status !== "done"),
      blocks: S().schedule.filter((e) => e.area === id && e.date === today()).length,
    };
  };

  const form = (a = {}) => `
    <form class="area-form" data-form="${a.id ? "area-edit" : "area-new"}" ${a.id ? `data-id="${a.id}"` : ""}>
      <div class="emoji-row">${EMOJIS.map((e) => `<button type="button" class="${(a.emoji || ui.newEmoji) === e ? "on" : ""}" data-action="area-emoji" data-e="${e}" data-id="${a.id || ""}">${e}</button>`).join("")}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
        <input class="field" name="emoji" value="${esc(a.emoji || ui.newEmoji)}" maxlength="4" style="width:64px;text-align:center" aria-label="Emoji" />
        <input class="field" name="name" value="${esc(a.name || "")}" placeholder="Area name (e.g. Church, Family, Side hustle)" maxlength="30" required style="flex:1;min-width:180px" />
      </div>
      <div class="swatches">${AREA_COLORS.map((c) => `<button type="button" class="sw-dot ${(a.color || ui.newColor) === c ? "on" : ""}" style="background:${c}" data-action="area-color" data-c="${c}" data-id="${a.id || ""}" aria-label="Color ${c}"></button>`).join("")}
        <input type="hidden" name="color" value="${a.color || ui.newColor}" /></div>
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn sm primary">${a.id ? "Save" : "+ Create area"}</button>
        ${a.id ? `<button type="button" class="btn sm quiet" data-action="area-cancel">Cancel</button>` : ""}
      </div>
    </form>`;

  const view = () => {
    const list = Object.entries(AREAS);
    return `
      <section class="view" data-view="areas">
        <div class="hero"><div><h1>Areas. <span>Your life, your buckets.</span></h1><p>Make the areas that fit your life. Tasks, habits, projects and time blocks can each belong to one.</p></div></div>
        <div class="grid g-now">
          <div class="area-grid">
            ${list.map(([id, a]) => {
              const st = stats(id);
              if (ui.editId === id) return `<div class="c area-card" style="--ac:${a.color}">${form({ id, ...a })}</div>`;
              return `
                <div class="c area-card" style="--ac:${a.color}">
                  <div class="ac-top">
                    <span class="ac-emo">${esc(a.emoji)}</span>
                    <div class="grow"><b>${esc(a.name)}</b><small>${st.open.length} open · ${st.done7} done this week${st.habits.length ? ` · ${st.habits.length} habit${st.habits.length > 1 ? "s" : ""}` : ""}${st.projects.length ? ` · ${st.projects.length} project${st.projects.length > 1 ? "s" : ""}` : ""}</small></div>
                    <button class="tiny" data-action="area-edit" data-id="${id}" aria-label="Edit area">✎</button>
                    <button class="tiny" data-action="area-del" data-id="${id}" aria-label="Delete area">${window.LOS.icons.x}</button>
                  </div>
                  ${st.open.length ? `<div class="mini-list">${st.open.slice(0, 4).map((t) => `
                    <div class="mini-item"><span class="t">${esc(t.title)}</span>
                      ${t.topDate === today() ? `<span class="pill">★ Today</span>` : `<button class="add" data-action="add-top" data-id="${t.id}">+ Today</button>`}</div>`).join("")}
                    ${st.open.length > 4 ? `<button class="tagbtn" data-action="area-board" data-id="${id}">See all ${st.open.length} on the board →</button>` : ""}</div>`
                  : `<p class="mut" style="font-size:13px">Nothing open here. That's fine.</p>`}
                  ${st.projects.length ? `<div class="ac-projects">${st.projects.map((p) => `<button class="tagbtn" data-action="p-open" data-id="${p.id}">${esc(p.emoji)} ${esc(p.title)}</button>`).join("")}</div>` : ""}
                </div>`;
            }).join("")}
          </div>
          <div class="stack">
            <div class="c"><h3>New area</h3>${form()}</div>
            <div class="c">
              <h3>Tips</h3>
              <p class="mut" style="font-size:13px;line-height:1.6">Fewer areas = less to think about. 5–7 is plenty.<br>Drag brain-dump items into areas on the <button class="tagbtn" data-action="area-board" data-id="">Board</button>.<br>Deleting an area never deletes tasks; they just become “No area”.</p>
              ${Array.isArray(S().areaDefs) ? `<button class="btn quiet sm" data-action="area-reset" style="margin-top:8px">Reset to default areas</button>` : ""}
            </div>
          </div>
        </div>
      </section>`;
  };

  const act = (a, el) => {
    if (!a.startsWith("area-")) return false;
    const A = app();
    const id = el.dataset.id;
    switch (a) {
      case "area-edit": ui.editId = id; A.render(); return true;
      case "area-cancel": ui.editId = null; A.render(); return true;
      case "area-emoji": {
        const f = el.closest("form");
        f.querySelector('[name="emoji"]').value = el.dataset.e;
        f.querySelectorAll(".emoji-row button").forEach((b) => b.classList.toggle("on", b === el));
        if (!id) ui.newEmoji = el.dataset.e;
        return true;
      }
      case "area-color": {
        const f = el.closest("form");
        f.querySelector('[name="color"]').value = el.dataset.c;
        f.querySelectorAll(".sw-dot").forEach((b) => b.classList.toggle("on", b === el));
        if (!id) ui.newColor = el.dataset.c;
        return true;
      }
      case "area-del": {
        const list = defs();
        const i = list.findIndex((x) => x.id === id);
        if (i < 0) return true;
        const [gone] = list.splice(i, 1);
        commit();
        A.toast(`Removed ${esc(gone.emoji)} ${esc(gone.name)}. Its tasks are kept.`, { action: { label: "Undo", fn: () => { defs().splice(i, 0, gone); commit(); } } });
        return true;
      }
      case "area-reset": S().areaDefs = null; ui.editId = null; commit(); A.toast("Default areas back"); return true;
      case "area-board": A.openBoard(id ? "area" : "status"); return true;
      default: return false;
    }
  };

  const submit = (form, d) => {
    const kind = form.dataset.form;
    if (kind !== "area-new" && kind !== "area-edit") return false;
    const name = (d.name || "").trim();
    if (!name) return true;
    const entry = { name: name.slice(0, 30), emoji: (d.emoji || "").trim().slice(0, 8), color: AREA_COLORS.includes(d.color) ? d.color : AREA_COLORS[0] };
    if (kind === "area-new") {
      const slug = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "area";
      defs().push({ id: `${slug}-${uid().slice(0, 4)}`, ...entry });
      ui.newEmoji = "✨";
      app().toast(`${esc(entry.emoji)} ${esc(entry.name)} created`);
    } else {
      const a = defs().find((x) => x.id === form.dataset.id);
      if (a) Object.assign(a, entry);
      ui.editId = null;
    }
    commit();
    return true;
  };

  window.LOS.areas = { view, act, submit };
})();
