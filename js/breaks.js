/* Life OS — Breaks: rest is part of focus.
   After a focus session the app offers a short break (a long one every few sessions),
   suggests breaks that don't turn into a rabbit hole, and gently brings you back.
   Breaks are logged in the time log as ☕ Break, so rest counts too. */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  const { esc, store, today, fmtDur } = window.LOS;
  const S = () => store.state;
  const app = () => window.LOS.app;

  const IDEAS = [
    ["💧", "Drink a glass of water"], ["🧍", "Stand up and stretch"], ["🚶", "Walk around the house"],
    ["🌬️", "5 slow breaths"], ["🪟", "Look out a window (far away)"], ["🍎", "Have a small snack"],
    ["🚻", "Bathroom break"], ["🧹", "Tidy one small thing"], ["☀️", "Step outside for a minute"],
    ["🎵", "One song, eyes closed"], ["🙆", "Roll your shoulders and neck"], ["🙏", "A short prayer"],
  ];
  const settings = () => ({ short: S().settings.breakMin || 5, long: S().settings.longBreakMin || 15, every: S().settings.longEvery || 4 });
  const sessionsToday = () => (S().sessions || []).filter((x) => x.date === today()).length;
  /** a long break after every Nth focus session today */
  const suggested = () => {
    const n = sessionsToday(), st = settings();
    return n > 0 && n % st.every === 0 ? { min: st.long, kind: "long" } : { min: st.short, kind: "short" };
  };
  const left = () => { const b = S().breakRun; return b ? b.dur * 60 - (Date.now() - b.start) / 1000 : 0; };
  const mmss = (sec) => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };

  // ---------------------------------------------------------------- start / end
  const start = (min, kind = "short", returnTo = null) => {
    const A = app();
    if (S().focus) A.endFocusQuiet();
    const tl = S().timelog;
    const prev = tl && tl.current && tl.current.label !== "Break" ? { label: tl.current.label, emoji: tl.current.emoji, cat: tl.current.cat } : null;
    window.LOS.timelog._start("Break", "☕", "rest");
    const ideas = [...IDEAS].sort(() => Math.random() - 0.5).slice(0, 3);
    S().breakRun = { start: Date.now(), dur: min, kind, returnTo: returnTo || S().currentId || null, prev, ideas, done: [] };
    A.save(); A.render();
  };
  const end = ({ resume = true, focus = false } = {}) => {
    const A = app();
    const b = S().breakRun;
    if (!b) return;
    const mins = Math.max(1, Math.round((Date.now() - b.start) / 60000));
    window.LOS.timelog._stop();
    if (resume && b.prev) window.LOS.timelog._start(b.prev.label, b.prev.emoji, b.prev.cat);
    S().breakRun = null;
    window.LOS.fx.noiseOff();
    A.save(); A.render();
    if (focus && b.returnTo && window.LOS.sel.task(b.returnTo)) A.startFocus(b.returnTo, 5, "5");
    else A.toast(`☕ ${fmtDur(mins)} break logged. Rest counts.`);
  };

  // ---------------------------------------------------------------- timer
  setInterval(() => {
    const b = S().breakRun;
    if (!b) return;
    const l = left();
    const el = document.querySelector("[data-break-left]");
    if (el) el.textContent = l > 0 ? mmss(l) : "0:00";
    const ring = document.querySelector("[data-break-ring]");
    if (ring) ring.setAttribute("stroke-dashoffset", String(Number(ring.dataset.c) * (1 - Math.max(0, l) / (b.dur * 60))));
    document.title = l > 0 ? `☕ ${mmss(l)} · Break` : "Break's over · Life OS";
    if (l <= 0 && !b.ended) {
      b.ended = true;
      app().save();
      if (S().settings.sound) window.LOS.fx.bell();
      app().notify("☕ Break's over", "Ready for one thing?");
      app().render();
    }
  }, 1000);

  // ---------------------------------------------------------------- UI
  const ring = (size = 220) => {
    const b = S().breakRun, r = (size - 16) / 2, c = 2 * Math.PI * r;
    const frac = Math.max(0, left()) / (b.dur * 60);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--card-3)" stroke-width="14"/>
      <circle data-break-ring data-c="${c}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:#5cffb0;transition:stroke-dashoffset 1s linear" stroke-width="14" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}"/></svg>`;
  };

  const overlay = () => {
    const b = S().breakRun;
    if (!b) return "";
    const t = b.returnTo && window.LOS.sel.task(b.returnTo);
    const over = left() <= 0;
    return `
      <div class="focus break" role="dialog" aria-label="Break">
        <div class="kicker">${b.kind === "long" ? "Long break · you earned it" : "Short break"}</div>
        ${over ? `<div class="task-name">Break's over. Ready for one thing?</div>`
          : `<div class="task-name">Rest. Your brain is filing what you just did.</div>`}
        <div class="break-disc">${ring()}<div class="bl"><b data-break-left>${mmss(left())}</b><small>${over ? "done" : "left"}</small></div></div>
        ${over ? `
          <div class="ctrls">
            ${t ? `<button class="btn primary big" data-action="break-back" title="${esc(t.title)}">▶ Back to “${esc(t.title.length > 28 ? t.title.slice(0, 27) + "…" : t.title)}” · 5 min</button>` : `<button class="btn primary big" data-action="break-end">▶ Back to one thing</button>`}
            <button class="btn ghost" data-action="break-more">+5 min, I need it</button>
          </div>`
        : `
          <div class="ideas">
            <div class="label" style="justify-content:center;margin-bottom:8px">Pick one</div>
            ${b.ideas.map(([e, l], i) => `<button class="idea ${b.done.includes(i) ? "on" : ""}" data-action="break-idea" data-i="${i}"><span>${e}</span>${esc(l)}${b.done.includes(i) ? " ✓" : ""}</button>`).join("")}
          </div>
          <p class="mut" style="font-size:13px;max-width:440px">📵 Try not to open videos or social feeds. That's how 5 minutes turns into 50.</p>
          <div class="ctrls">
            <button class="btn ghost" data-action="break-more">+5 min</button>
            <button class="btn ghost" data-action="noise">${window.LOS.fx.noisePlaying() ? "🔇 Sound off" : "🎧 Calm sound"}</button>
            <button class="btn quiet" data-action="break-end">I'm back</button>
          </div>`}
      </div>`;
  };

  /** choices shown right after a focus session ends */
  const offerHTML = () => {
    const s = suggested();
    return `<button class="btn sm ghost" data-action="break-start" data-m="${s.min}" data-k="${s.kind}">☕ ${s.min}-min ${s.kind === "long" ? "long " : ""}break</button>`;
  };

  const settingsHTML = () => {
    const st = settings();
    const sel = (name, val, opts) => `<select class="field" style="width:110px" data-setting="${name}">${opts.map((v) => `<option value="${v}" ${val === v ? "selected" : ""}>${v} min</option>`).join("")}</select>`;
    return `
      <div class="set-row"><div><b>☕ Break length</b><small>Offered after each focus session</small></div>${sel("breakMin", st.short, [3, 5, 10, 15])}</div>
      <div class="set-row"><div><b>Long break</b><small>Every ${st.every} focus sessions in a day</small></div>${sel("longBreakMin", st.long, [10, 15, 20, 30])}</div>`;
  };

  const act = (a, el) => {
    if (!a.startsWith("break-")) return false;
    const A = app();
    switch (a) {
      case "break-start": start(Number(el.dataset.m) || settings().short, el.dataset.k || "short"); return true;
      case "break-now": { const s = suggested(); start(s.min, s.kind); return true; }
      case "break-more": {
        const b = S().breakRun;
        b.dur = b.ended ? (Date.now() - b.start) / 60000 + 5 : b.dur + 5; // over? 5 more minutes from now
        b.ended = false;
        A.save(); A.render();
        return true;
      }
      case "break-idea": { const b = S().breakRun, i = Number(el.dataset.i); b.done = b.done.includes(i) ? b.done.filter((x) => x !== i) : [...b.done, i]; A.save(); A.render(); return true; }
      case "break-end": end(); return true;
      case "break-back": end({ focus: true }); return true;
      default: return false;
    }
  };

  window.LOS.breaks = { overlay, offerHTML, settingsHTML, act, start, end, suggested };
})();
