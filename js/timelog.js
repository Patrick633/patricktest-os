/* Life OS — Time log: "what am I doing right now?" with one tap.
   Dates, church, family, commute, rest… real life counts, not only tasks.
   Shows where the day went so a day without checked tasks never looks "empty". */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  const { dkey, uid, esc, today, fmtDur, store, addDays, weekStart } = window.LOS;
  const S = () => store.state;
  const TL = () => S().timelog;
  const app = () => window.LOS.app;

  const CATS = {
    work: { name: "Work", color: "#4dd8ff" },
    study: { name: "Study", color: "#ffd84d" },
    health: { name: "Health", color: "#ff5c8a" },
    people: { name: "People", color: "#ffa24d" },
    spirit: { name: "Spirit", color: "#8b7cff" },
    rest: { name: "Rest", color: "#5cffb0" },
    fun: { name: "Fun", color: "#c8ff4d" },
    life: { name: "Life admin", color: "#9a9aae" },
    screen: { name: "Screens", color: "#ff7ad9" },
  };
  const PRESETS = [
    ["💼", "Work", "work"], ["📚", "Study", "study"], ["🏃", "Workout", "health"], ["🤍", "Quality time with my wife", "people"],
    ["👨‍👩‍👧", "Family", "people"], ["🫂", "Friends", "people"], ["⛪", "Church", "spirit"], ["🙏", "Prayer", "spirit"],
    ["🍽️", "Meal", "rest"], ["😴", "Rest", "rest"], ["🚗", "Commute", "life"], ["🧹", "Chores", "life"],
    ["🛒", "Errands", "life"], ["🎮", "Fun", "fun"], ["🎬", "Movie", "fun"], ["📱", "Phone", "screen"],
  ];
  // time-block areas → categories (for "▶ Track" on the schedule)
  const AREA_CAT = { health: "health", mind: "spirit", work: "work", money: "life", learning: "study", people: "people" };
  const ui = { showPast: false, showOther: false, editId: null, editPresets: false };
  /** the activity chips: the defaults until you edit them, then your own list */
  const presets = () => TL().presets || [...TL().custom, ...PRESETS];
  const materialize = () => { if (!TL().presets) { TL().presets = presets().map((p) => [...p]); TL().custom = []; } return TL().presets; };

  const fmtT = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const mins = (a, b) => Math.max(0, Math.round((b - a) / 60000));
  const presetFor = (label) => presets().find((p) => p[1].toLowerCase() === String(label).trim().toLowerCase());

  // ---------------------------------------------------------------- core
  const stop = (at = Date.now()) => {
    const c = TL().current;
    if (!c) return null;
    TL().current = null;
    if (at - c.start < 60000) return null; // under a minute: ignore
    const e = { id: uid(), label: c.label, emoji: c.emoji, cat: c.cat, start: c.start, end: at };
    TL().entries.push(e);
    TL().entries.sort((a, b) => a.start - b.start);
    // keep ~120 days
    const cut = Date.now() - 120 * 864e5;
    TL().entries = TL().entries.filter((x) => x.end >= cut);
    return e;
  };
  const start = (label, emoji, cat, at = Date.now()) => {
    stop(at);
    TL().current = { label, emoji: emoji || "", cat: CATS[cat] ? cat : "life", start: at };
  };

  /** entries that overlap the given day (plus the running one, ending now) */
  const entriesOn = (k) => {
    const d0 = new Date(k + "T00:00").getTime(), d1 = d0 + 864e5;
    const list = TL().entries.filter((e) => e.end > d0 && e.start < d1).map((e) => ({ ...e, s: Math.max(e.start, d0), e2: Math.min(e.end, d1) }));
    const c = TL().current;
    if (c && Date.now() > d0 && c.start < d1) list.push({ ...c, id: "current", live: true, end: Date.now(), s: Math.max(c.start, d0), e2: Math.min(Date.now(), d1) });
    return list.sort((a, b) => a.s - b.s);
  };
  const totals = (keys) => {
    const t = {};
    keys.forEach((k) => entriesOn(k).forEach((e) => { t[e.cat] = (t[e.cat] || 0) + mins(e.s, e.e2); }));
    return Object.entries(t).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  };
  const loggedMin = (k = today()) => entriesOn(k).reduce((a, e) => a + mins(e.s, e.e2), 0);

  // ---------------------------------------------------------------- live elapsed text
  const elapsedText = () => {
    const c = TL().current;
    return c ? `since ${fmtT(c.start)} · ${fmtDur(mins(c.start, Date.now()))}` : "";
  };
  setInterval(() => {
    const el = document.querySelector("[data-tl-elapsed]");
    if (el) el.textContent = elapsedText();
  }, 15000);

  // ---------------------------------------------------------------- views
  const chip = (p, cls = "") => `<button class="chip tl-chip ${cls}" data-action="tl-start" data-l="${esc(p[1])}" data-e="${esc(p[0])}" data-c="${esc(p[2])}" style="--cc:${(CATS[p[2]] || CATS.life).color}">${p[0] ? `${esc(p[0])} ` : ""}${esc(p[1])}</button>`;
  const catOptions = (sel = "life") => Object.entries(CATS).map(([id, c]) => `<option value="${id}" ${sel === id ? "selected" : ""}>${c.name}</option>`).join("");

  /** recent/most-used first, so the chips you need are always near */
  const ordered = () => {
    const seen = new Map();
    [...TL().entries].reverse().slice(0, 80).forEach((e) => { if (!seen.has(e.label)) seen.set(e.label, [e.emoji, e.label, e.cat]); });
    const list = presets();
    // recently used first, but only activities that are still in your list (renamed/removed ones disappear)
    const out = [...seen.values()].map((r) => list.find((p) => p[1] === r[1])).filter(Boolean);
    list.forEach((p) => { if (!out.some((x) => x[1] === p[1])) out.push(p); });
    return out;
  };

  const pastForm = () => `
    <form class="tl-past" data-form="tl-past">
      <input class="field" name="label" list="tl-labels" placeholder="What? (e.g. Church)" required maxlength="40" autocomplete="off" />
      <datalist id="tl-labels">${ordered().map((p) => `<option value="${esc(p[1])}">`).join("")}</datalist>
      <select class="field" name="cat">${catOptions()}</select>
      <input class="field" type="time" name="from" required aria-label="From" />
      <input class="field" type="time" name="to" required aria-label="To" />
      <button class="btn sm primary">Add</button>
    </form>`;

  /** the "Doing now" card for the Now screen */
  const nowCard = () => {
    const c = TL().current;
    const chips = ordered();
    const long = c && Date.now() - c.start > 8 * 3600e3;
    return `
      <div class="c doing">
        <h3>Doing now <span class="r mut">life counts, not just tasks</span></h3>
        ${c ? `
          <div class="doing-cur" style="--cc:${CATS[c.cat].color}">
            <span class="emo">${esc(c.emoji)}</span>
            <div class="grow"><b>${esc(c.label)}</b><small data-tl-elapsed>${elapsedText()}</small></div>
            <button class="btn sm ghost" data-action="tl-stop">■ Stop</button>
          </div>
          ${long ? `<div class="tl-long">Still on <b>${esc(c.label)}</b>? It's been ${fmtDur(mins(c.start, Date.now()))}. <label>It ended at <input class="field" type="time" data-tl-endcur /></label></div>` : ""}
          <div class="label" style="margin:14px 0 8px">Switch to</div>`
        : `<p style="margin-bottom:10px">What are you doing right now?</p>`}
        <div class="tl-chips">${chips.filter((p) => !c || p[1] !== c.label).slice(0, c ? 8 : 12).map((p) => chip(p)).join("")}
          <button class="chip" data-action="tl-other">+ Other</button></div>
        ${ui.showOther ? `
          <form class="inline-form" data-form="tl-other">
            <input class="field" name="label" placeholder="Activity (e.g. Small group)" required maxlength="40" autocomplete="off" />
            <input class="field" name="emoji" placeholder="🙂" maxlength="4" style="flex:0 0 64px;text-align:center" />
            <select class="field" name="cat">${catOptions()}</select>
            <button class="btn sm primary">Start</button>
          </form>` : ""}
        <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="tagbtn" data-action="tl-past-toggle">${ui.showPast ? "Close" : "＋ Log something earlier"}</button>
          <button class="tagbtn" data-action="tl-edit-presets">${ui.editPresets ? "Done editing" : "✎ Edit activities"}</button>
        </div>
        ${ui.showPast ? pastForm() : ""}
        ${ui.editPresets ? presetEditor() : ""}
      </div>`;
  };

  const presetEditor = () => `
    <div class="tlp-edit">
      <p class="mut" style="font-size:12px;margin-bottom:8px">Rename, change or clear the emoji, pick a category, or remove. Renaming also updates what you already logged.</p>
      ${presets().map((p, i) => `
        <div class="tlp-row">
          <input class="field tlp-emo" value="${esc(p[0])}" maxlength="4" placeholder="—" data-tlp="${i}:0" aria-label="Emoji (optional)" />
          <input class="field" value="${esc(p[1])}" maxlength="40" data-tlp="${i}:1" aria-label="Name" />
          <select class="field" data-tlp="${i}:2" aria-label="Category">${catOptions(p[2])}</select>
          <button class="tiny" data-action="tl-preset-del" data-i="${i}" aria-label="Remove">${window.LOS.icons.x}</button>
        </div>`).join("")}
      <form class="tlp-row" data-form="tl-preset-add">
        <input class="field tlp-emo" name="emoji" maxlength="4" placeholder="🙂" aria-label="Emoji (optional)" />
        <input class="field" name="label" maxlength="40" placeholder="New activity" required />
        <select class="field" name="cat">${catOptions("people")}</select>
        <button class="tiny lime">Add</button>
      </form>
      <button class="btn quiet sm" data-action="tl-preset-reset" style="margin-top:6px">Reset to defaults</button>
    </div>`;

  const dayBar = (k) => {
    const d0 = new Date(k + "T00:00").getTime();
    const es = entriesOn(k);
    const pct = (ms) => ((ms - d0) / 864e5) * 100;
    const nowPct = k === today() ? pct(Date.now()) : null;
    return `
      <div class="tl-day">
        ${es.map((e) => `<i class="${e.live ? "live" : ""}" title="${esc(e.emoji + " " + e.label)} · ${fmtT(e.s)}–${e.live ? "now" : fmtT(e.e2)}" style="left:${pct(e.s)}%;width:${Math.max(0.4, pct(e.e2) - pct(e.s))}%;background:${CATS[e.cat].color}"></i>`).join("")}
        ${nowPct != null ? `<span class="tl-now" style="left:${nowPct}%"></span>` : ""}
      </div>
      <div class="tl-hours mono"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span></div>`;
  };

  /** "Where today went" card for the Today screen */
  const todayCard = () => {
    const k = today();
    const es = entriesOn(k);
    const tot = totals([k]);
    return `
      <div class="c">
        <h3>Where today went <span class="r mono">${fmtDur(loggedMin(k))} logged</span></h3>
        ${dayBar(k)}
        ${tot.length ? `<div class="tl-tot">${tot.map(([c, m]) => `<span><i class="dot" style="background:${CATS[c].color}"></i>${CATS[c].name} <b class="mono">${fmtDur(m)}</b></span>`).join("")}</div>` : ""}
        <div class="tl-list">${es.length ? es.map((e) => ui.editId === e.id ? `
          <div class="tl-row editing">
            <span class="emo">${esc(e.emoji)}</span><span class="t">${esc(e.label)}</span>
            <input class="field" type="time" value="${new Date(e.start).toTimeString().slice(0, 5)}" data-tl-time="${e.id}:start" aria-label="Start" />
            <input class="field" type="time" value="${new Date(e.end).toTimeString().slice(0, 5)}" data-tl-time="${e.id}:end" aria-label="End" />
            <button class="tiny" data-action="tl-edit" data-id="">Done</button>
          </div>` : `
          <div class="tl-row ${e.live ? "live" : ""}">
            <span class="emo">${esc(e.emoji)}</span>
            <span class="t">${esc(e.label)}<small>${fmtT(e.start)} – ${e.live ? "now" : fmtT(e.end)}</small></span>
            <span class="mono mut" style="font-size:12px">${fmtDur(mins(e.s, e.e2))}</span>
            ${e.live ? `<button class="tiny" data-action="tl-stop">Stop</button>` : `<button class="tiny" data-action="tl-edit" data-id="${e.id}" title="Edit times">✎</button><button class="tiny" data-action="tl-del" data-id="${e.id}" aria-label="Delete">${window.LOS.icons.x}</button>`}
          </div>`).join("") : `<p class="mut" style="font-size:13px;margin-top:10px">Nothing logged yet. Tap what you're doing on the Now screen, or log something earlier.</p>`}</div>
        <button class="tagbtn" style="margin-top:12px" data-action="tl-past-toggle">${ui.showPast ? "Close" : "＋ Log something earlier"}</button>
        ${ui.showPast ? pastForm() : ""}
      </div>`;
  };

  /** "Also today: ❤️ Date 2h · ⛪ Church 1h30" for the Wins card */
  const winsLine = () => {
    const by = {};
    entriesOn(today()).forEach((e) => { const k = (e.emoji ? e.emoji + " " : "") + e.label; by[k] = (by[k] || 0) + mins(e.s, e.e2); });
    const items = Object.entries(by).filter(([, m]) => m >= 5).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return items.length ? `<p class="also">Also today: ${items.map(([l, m]) => `<span>${esc(l)} <b>${fmtDur(m)}</b></span>`).join(" · ")}</p>` : "";
  };

  /** weekly breakdown for the Review screen */
  const weekCard = () => {
    const keys = [...Array(7)].map((_, i) => dkey(addDays(new Date(), -i)));
    const tot = totals(keys);
    if (!tot.length) return "";
    const max = tot[0][1];
    return `
      <div class="c" style="margin-bottom:16px">
        <h3>Where your week went <span class="r mono">${fmtDur(tot.reduce((a, [, m]) => a + m, 0))} logged</span></h3>
        ${tot.map(([c, m]) => `<div class="hbar"><span class="t"><i class="dot" style="background:${CATS[c].color}"></i> ${CATS[c].name}</span><span class="mono mut">${fmtDur(m)}</span><i style="width:${(m / max) * 100}%;background:${CATS[c].color}"></i></div>`).join("")}
      </div>`;
  };

  /** "▶ Track" for a time block happening now */
  const trackButton = (ev) => `<button class="btn sm ghost" data-action="tl-track" data-l="${esc(ev.label)}" data-c="${AREA_CAT[ev.area] || "life"}">▶ Track</button>`;

  // ---------------------------------------------------------------- actions
  const act = (a, el) => {
    if (!a.startsWith("tl-")) return false;
    const A = app();
    switch (a) {
      case "tl-start": {
        const prev = TL().current;
        start(el.dataset.l, el.dataset.e, el.dataset.c);
        ui.showOther = false;
        A.toast(`${esc(el.dataset.e)} ${esc(el.dataset.l)}${prev ? ` · ${esc(prev.label)} saved` : ""}`);
        break;
      }
      case "tl-track": {
        const p = presetFor(el.dataset.l);
        start(el.dataset.l, p ? p[0] : "", p ? p[2] : el.dataset.c);
        A.toast(`▶ Tracking ${esc(el.dataset.l)}`);
        break;
      }
      case "tl-stop": {
        const e = stop();
        A.toast(e ? `${esc(e.emoji)} ${esc(e.label)} · ${fmtDur(mins(e.start, e.end))} logged` : "Stopped");
        break;
      }
      case "tl-other": ui.showOther = !ui.showOther; break;
      case "tl-edit-presets": ui.editPresets = !ui.editPresets; ui.showPast = false; break;
      case "tl-preset-del": {
        const list = materialize();
        const i = Number(el.dataset.i);
        const [p] = list.splice(i, 1);
        A.toast(`Removed ${esc(p[1])}`, { action: { label: "Undo", fn: () => { list.splice(i, 0, p); A.save(); A.render(); } } });
        break;
      }
      case "tl-preset-reset": TL().presets = null; TL().custom = []; A.toast("Activities reset"); break;
      case "tl-past-toggle": ui.showPast = !ui.showPast; break;
      case "tl-edit": ui.editId = el.dataset.id || null; break;
      case "tl-del": {
        const i = TL().entries.findIndex((x) => x.id === el.dataset.id);
        const [e] = TL().entries.splice(i, 1);
        A.toast("Removed", { action: { label: "Undo", fn: () => { TL().entries.splice(i, 0, e); A.save(); A.render(); } } });
        break;
      }
      default: return false;
    }
    A.save(); A.render();
    return true;
  };

  const timeOn = (k, hhmm) => new Date(`${k}T${hhmm}`).getTime();

  const submit = (form, d) => {
    const A = app();
    if (form.dataset.form === "tl-other") {
      const label = d.label.trim();
      if (!label) return true;
      const emoji = (d.emoji || "").trim();
      if (!presetFor(label)) { TL().custom.unshift([emoji, label, d.cat]); TL().custom = TL().custom.slice(0, 8); }
      start(label, emoji, d.cat);
      ui.showOther = false;
      A.save(); A.render(); A.toast(`${esc(emoji)} ${esc(label)}`);
      return true;
    }
    if (form.dataset.form === "tl-preset-add") {
      const label = (d.label || "").trim();
      if (!label) return true;
      materialize().unshift([(d.emoji || "").trim(), label, d.cat]);
      A.save(); A.render();
      return true;
    }
    if (form.dataset.form === "tl-past") {
      const label = d.label.trim();
      const p = presetFor(label);
      const s = timeOn(today(), d.from);
      let e = timeOn(today(), d.to);
      if (e <= s) e += 864e5;
      if (s > Date.now()) { A.toast("That's in the future. Use a time block on Today instead."); return true; }
      TL().entries.push({ id: uid(), label, emoji: p ? p[0] : "", cat: p ? p[2] : d.cat, start: s, end: Math.min(e, Date.now()) });
      TL().entries.sort((a, b) => a.start - b.start);
      ui.showPast = false;
      A.save(); A.render();
      A.toast(`${p ? esc(p[0]) : ""} ${esc(label)} · ${fmtDur(mins(s, Math.min(e, Date.now())))} logged`);
      return true;
    }
    return false;
  };

  const change = (el) => {
    const A = app();
    if (el.dataset.tlp) {
      const [i, f] = el.dataset.tlp.split(":").map(Number);
      const list = materialize();
      const p = list[i];
      if (!p) return true;
      const v = el.value.trim();
      if (f === 1) {
        if (!v) { A.render(); return true; }
        const old = p[1];
        // rename what's already logged too, so history matches
        TL().entries.forEach((e) => { if (e.label === old) e.label = v; });
        if (TL().current && TL().current.label === old) TL().current.label = v;
        p[1] = v;
      } else if (f === 0) {
        p[0] = v;
        TL().entries.forEach((e) => { if (e.label === p[1]) e.emoji = v; });
        if (TL().current && TL().current.label === p[1]) TL().current.emoji = v;
      } else p[2] = el.value;
      A.save(); A.render();
      return true;
    }
    if (el.dataset.tlTime && el.value) {
      const [id, which] = el.dataset.tlTime.split(":");
      const e = TL().entries.find((x) => x.id === id);
      if (!e) return true;
      const k = dkey(new Date(e.start));
      e[which] = timeOn(k, el.value);
      if (e.end <= e.start) e.end += 864e5;
      TL().entries.sort((a, b) => a.start - b.start);
      A.save(); A.render();
      return true;
    }
    if (el.hasAttribute("data-tl-endcur") && el.value) {
      const c = TL().current;
      if (!c) return true;
      let end = timeOn(dkey(new Date()), el.value);
      if (end > Date.now()) end -= 864e5;
      if (end > c.start) stop(end); else TL().current = null;
      A.save(); A.render(); A.toast("Fixed ✓");
      return true;
    }
    return false;
  };

  window.LOS.timelog = { nowCard, todayCard, winsLine, weekCard, trackButton, loggedMin, act, submit, change, _start: start, _stop: stop };
})();
