/* Life OS — reminders through the phone's own Calendar (.ics files).
   iPhone/Mac Calendar shows real notifications even when Life OS is closed, with no server.
   - Daily/weekly reminders (check-in, screen time, Bible reading, weekly review…)
   - Today's time blocks and tasks planned for a specific day */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  const { store, esc, today, toMin } = window.LOS;
  const S = () => store.state;
  const app = () => window.LOS.app;

  const REMINDERS = [
    { id: "checkin", title: "Life OS · Morning check-in", body: "Energy, mood and your one thing for today.", time: "08:00", freq: "DAILY", on: true },
    { id: "bible", title: "Life OS · Bible reading", body: "Today's reading is waiting in Spirit.", time: "07:00", freq: "DAILY", on: false },
    { id: "screen", title: "Life OS · Log screen time", body: "10 seconds: iPhone + Mac totals.", time: "21:00", freq: "DAILY", on: true },
    { id: "plan", title: "Life OS · Plan tomorrow", body: "Pick up to 3 things for tomorrow.", time: "21:30", freq: "DAILY", on: false },
    { id: "review", title: "Life OS · Weekly review", body: "5 minutes, 3 questions.", time: "18:00", freq: "WEEKLY;BYDAY=SU", on: true },
  ];
  const reminders = () => {
    const saved = S().settings.reminders || {};
    return REMINDERS.map((r) => ({ ...r, ...(saved[r.id] || {}) }));
  };

  // ---------------------------------------------------------------- .ics building
  const pad = (n) => String(n).padStart(2, "0");
  const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; // floating = device time zone
  const utc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const txt = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const appUrl = () => location.href.split("#")[0].split("?")[0];

  const ics = (events) => [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Life OS//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}@lifeos`,
      `DTSTAMP:${utc(new Date())}`,
      `DTSTART:${local(e.start)}`,
      `DTEND:${local(new Date(e.start.getTime() + (e.dur || 15) * 60000))}`,
      `SUMMARY:${txt(e.title)}`,
      e.body ? `DESCRIPTION:${txt(e.body + (appUrl().startsWith("http") ? `\n${appUrl()}` : ""))}` : null,
      appUrl().startsWith("http") ? `URL:${appUrl()}` : null,
      e.rrule ? `RRULE:FREQ=${e.rrule}` : null,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${txt(e.title)}`, `TRIGGER:-PT${e.alarm || 0}M`, "END:VALARM",
      "END:VEVENT",
    ].filter(Boolean)),
    "END:VCALENDAR",
  ].join("\r\n");

  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const open = (name, text) => {
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    if (isIOS()) window.location.href = url; // iOS shows "Add All to Calendar"
    else { const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // ---------------------------------------------------------------- exports
  const at = (dateKey, hhmm) => new Date(`${dateKey}T${hhmm}:00`);

  const exportReminders = () => {
    const on = reminders().filter((r) => r.on);
    if (!on.length) { app().toast("Turn on at least one reminder first."); return; }
    const events = on.map((r) => {
      let start = at(today(), r.time);
      if (r.freq.startsWith("WEEKLY")) { while (start.getDay() !== 0) start = new Date(start.getTime() + 864e5); } // next Sunday
      return { uid: `reminder-${r.id}-${r.time.replace(":", "")}`, title: r.title, body: r.body, start, dur: 10, rrule: r.freq, alarm: 0 };
    });
    open("life-os-reminders.ics", ics(events));
    app().toast("📅 Open the file and tap “Add All” to add the reminders.", { ms: 5000 });
  };

  const exportDay = () => {
    const blocks = S().schedule.filter((e) => e.date >= today()).map((e) => ({
      uid: `block-${e.id}`, title: e.label, body: "Time block from Life OS", start: at(e.date, e.time), dur: e.dur || 30, alarm: 10,
    }));
    const planned = S().tasks.filter((t) => t.status !== "done" && t.plan && t.plan.scope === "day" && t.plan.key >= today()).map((t) => ({
      uid: `task-${t.id}`, title: `☐ ${t.title}`, body: "Planned in Life OS", start: at(t.plan.key, "09:00"), dur: 15, alarm: 0,
    }));
    const events = [...blocks, ...planned];
    if (!events.length) { app().toast("Nothing to add yet: add time blocks on Today or plan tasks for a day."); return; }
    open("life-os-plan.ics", ics(events));
    app().toast(`📅 ${events.length} item${events.length > 1 ? "s" : ""} ready. Tap “Add All”.`, { ms: 5000 });
  };

  // ---------------------------------------------------------------- iPhone Reminders (through the Shortcuts app)
  // A web app can't open the Reminders database directly, so two small Shortcuts act as the bridge:
  //  · "Life OS to Reminders" receives a task from Life OS and adds it to Reminders.
  //  · "Reminders to Life OS" copies your open reminders; Life OS pastes them into the Inbox.
  const SHORTCUT_TO = "Life OS to Reminders";
  const remindersOn = () => !!S().settings.remindersBridge;
  const sendToReminders = (t) => {
    const due = t.plan && t.plan.scope === "day" ? `${t.plan.key} 09:00` : t.topDate === today() ? `${today()} 18:00` : "";
    const text = [t.title, due].filter(Boolean).join("\n"); // line 1: title, line 2: due date (optional)
    window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_TO)}&input=text&text=${encodeURIComponent(text)}`;
  };
  const pasteFromReminders = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { app().toast("Couldn't read the clipboard. Allow paste when asked, or paste into Brain dump."); return; }
    const lines = String(text).split(/\r?\n/).map((l) => l.replace(/^\s*([-*•◦▪︎]|\[ ?\]|☐|\d+[.)])\s*/, "").trim()).filter((l) => l && l.length <= 140);
    if (!lines.length) { app().toast("Clipboard is empty. Run the “Reminders to Life OS” shortcut first."); return; }
    app().capture(lines.join("\n"));
  };
  const remindersHTML = () => `
    <div class="set-row" style="display:block">
      <div class="row" style="justify-content:space-between;gap:12px">
        <div><b>📝 iPhone Reminders</b><small>Send tasks to Reminders and bring reminders into Life OS, through the Shortcuts app.</small></div>
        <button class="switch ${remindersOn() ? "on" : ""}" data-action="rem-toggle" role="switch" aria-checked="${remindersOn()}" aria-label="Reminders bridge"></button>
      </div>
      <details class="how"${remindersOn() ? "" : " open"}><summary>Set up the 2 shortcuts (once, ~3 min)</summary>
        <p><b>1 · “${SHORTCUT_TO}”</b> (Life OS → Reminders)</p>
        <ol>
          <li>Open <b>Shortcuts</b> → <b>+</b> → name it exactly <span class="mono">${SHORTCUT_TO}</span>.</li>
          <li>Tap the <b>ⓘ</b> → turn on <b>Show in Share Sheet</b> → Receive <b>Text</b>.</li>
          <li>Add action <b>Split Text</b> (Shortcut Input, by <b>New Lines</b>).</li>
          <li>Add <b>Get Item from List</b> → <b>First Item</b>. Then <b>Get Item from List</b> → <b>Last Item</b> (from Split Text).</li>
          <li>Add <b>Add New Reminder</b>: title = <i>First Item</i>, list = your choice, turn on <b>Remind Me</b> on a day/time = <i>Last Item</i>.</li>
        </ol>
        <p><b>2 · “Reminders to Life OS”</b> (Reminders → Life OS)</p>
        <ol>
          <li>New shortcut → <b>Find Reminders</b> where <b>Is Not Completed</b> (and List = the one you use as an inbox).</li>
          <li>Add <b>Get Details of Reminders</b> → <b>Title</b>, then <b>Combine Text</b> with <b>New Lines</b>.</li>
          <li>Add <b>Copy to Clipboard</b>. Optional: <b>Show Notification</b> “Copied, open Life OS”.</li>
          <li>Run it, open Life OS → Inbox → <b>📋 Paste from Reminders</b>.</li>
        </ol>
        <p class="mut">Then turn on the switch above: each task gets a “→ Reminders” button.</p>
      </details>
    </div>`;

  // ---------------------------------------------------------------- settings UI
  const settingsHTML = () => {
    const perm = "Notification" in window ? Notification.permission : "unsupported";
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    return `
      <div class="set-row" style="display:block">
        <div style="margin-bottom:8px"><b>🔔 Notifications on this device</b><small>Timer ends, hyperfocus check, quiet time. Work while Life OS is open or recently used.</small></div>
        ${perm === "granted" ? `<p class="mut" style="font-size:13px">✓ Enabled${S().settings.alerts ? "" : " (turn on “Desktop alerts” below)"} · <button class="tagbtn" data-action="cal-test">Send a test</button></p>`
          : perm === "unsupported" ? `<p class="mut" style="font-size:13px;line-height:1.5">${isIOS() && !standalone ? "On iPhone: open Life OS in Safari → Share → <b>Add to Home Screen</b>, open it from there, then enable here." : "This browser doesn't support notifications."}</p>`
          : perm === "denied" ? `<p class="mut" style="font-size:13px">Blocked. Allow notifications for Life OS in your device settings.</p>`
          : `<button class="btn sm primary" data-action="cal-perm">Enable notifications</button>`}
      </div>
      <div class="set-row" style="display:block">
        <div style="margin-bottom:10px"><b>⏰ Daily reminders</b><small>Added to your Calendar, so they ring even when Life OS is closed. Add once; to change a time later, delete the old ones in Calendar.</small></div>
        ${reminders().map((r) => `
          <div class="rem-row">
            <button class="switch ${r.on ? "on" : ""}" data-action="cal-toggle" data-id="${r.id}" role="switch" aria-checked="${r.on}" aria-label="${esc(r.title)}"></button>
            <span class="t">${esc(r.title.replace("Life OS · ", ""))}<small>${r.freq === "DAILY" ? "every day" : "Sundays"}</small></span>
            <input class="field" type="time" value="${r.time}" data-rem-time="${r.id}" aria-label="Time" />
          </div>`).join("")}
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn sm primary" data-action="cal-reminders">📅 Add reminders to Calendar</button>
          <button class="btn sm ghost" data-action="cal-plan">📅 Add time blocks & planned tasks</button>
        </div>
      </div>
      ${remindersHTML()}`;
  };

  const act = (a, el) => {
    if (a === "rem-toggle") { S().settings.remindersBridge = !remindersOn(); app().save(); app().renderModal(); app().render(); return true; }
    if (a === "rem-send") { const t = window.LOS.sel.task(el.dataset.id); if (t) sendToReminders(t); return true; }
    if (a === "rem-paste") { pasteFromReminders(); return true; }
    if (!a.startsWith("cal-")) return false;
    const A = app();
    switch (a) {
      case "cal-reminders": exportReminders(); return true;
      case "cal-plan": exportDay(); return true;
      case "cal-toggle": {
        const s = S().settings;
        s.reminders = s.reminders || {};
        const cur = reminders().find((r) => r.id === el.dataset.id);
        s.reminders[cur.id] = { ...(s.reminders[cur.id] || {}), on: !cur.on };
        A.save(); A.renderModal();
        return true;
      }
      case "cal-perm":
        Notification.requestPermission().then((p) => {
          if (p === "granted") { S().settings.alerts = true; A.save(); A.toast("🔔 Notifications on"); }
          A.renderModal();
        });
        return true;
      case "cal-test": A.notify("Life OS", "Notifications work ✓", true); return true;
      default: return false;
    }
  };
  const change = (el) => {
    if (!el.dataset.remTime || !el.value) return false;
    const s = S().settings;
    s.reminders = s.reminders || {};
    s.reminders[el.dataset.remTime] = { ...(s.reminders[el.dataset.remTime] || {}), time: el.value };
    app().save();
    return true;
  };

  window.LOS.calendar = { remindersOn, settingsHTML, act, change, exportDay, exportReminders, _ics: ics, _reminders: reminders };
})();
