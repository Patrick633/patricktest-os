/* Life OS — Screen time & video history.
   Sources:
   1. Manual daily log (iPhone + Mac Screen Time). Apple doesn't let apps read these numbers.
   2. Imports: YouTube watch history (Google Takeout, JSON or HTML) and Netflix viewing activity (CSV).
   3. "Life OS Companion" browser extension: time per site + YouTube titles, sent via postMessage.
   Everything stays in this browser. */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  const { dkey, addDays, uid, esc, today, fmtDur, store } = window.LOS;
  const S = () => store.state;
  const SC = () => S().screen;
  const app = () => window.LOS.app; // toast, render, save (set by app.js)

  // ================================================================ parsing helpers
  const MONTHS_PT = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
  const parseLooseDate = (raw) => {
    if (!raw) return NaN;
    let s = raw.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
    let t = Date.parse(s);
    if (!isNaN(t)) return t;
    const noTz = s.replace(/\s(?:GMT|UTC)?[A-Z]{0,5}[+-]?\d{0,2}:?\d{0,2}$/, "").replace(" at ", " ");
    t = Date.parse(noTz);
    if (!isNaN(t)) return t;
    // Portuguese: "20 de nov. de 2026 22:15:32 BRT"
    const m = s.match(/(\d{1,2}) de ([a-zç]{3})[a-zç.]* de (\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
    if (m && MONTHS_PT[m[2].toLowerCase()] != null) return new Date(+m[3], MONTHS_PT[m[2].toLowerCase()], +m[1], +m[4], +m[5], +(m[6] || 0)).getTime();
    return NaN;
  };
  const ytId = (url) => { const m = String(url || "").match(/[?&]v=([\w-]{6,})/); return m ? m[1] : null; };
  const stripWatched = (title) => String(title || "").replace(/^(Watched|Assistiu a|Assistiu|Viste|Has visto|Vu|A regardé|Angesehen:?)\s+/i, "").trim();

  const parseCSV = (text) => {
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  };

  /** YouTube Takeout watch-history.json */
  const fromTakeoutJSON = (arr) => arr
    .filter((e) => e && e.titleUrl && ytId(e.titleUrl) && !(e.details || []).some((d) => /ads/i.test(d.name || "")))
    .map((e) => ({ src: "youtube", id: ytId(e.titleUrl), title: stripWatched(e.title), channel: e.subtitles?.[0]?.name || null, url: e.titleUrl, at: Date.parse(e.time) }))
    .filter((v) => !isNaN(v.at));

  /** YouTube Takeout watch-history.html (default Takeout format) */
  const fromTakeoutHTML = (text) => {
    const doc = new DOMParser().parseFromString(text, "text/html");
    const out = [];
    doc.querySelectorAll(".content-cell").forEach((cell) => {
      const links = cell.querySelectorAll("a");
      if (!links.length || !ytId(links[0].getAttribute("href"))) return;
      const parts = cell.innerHTML.split(/<br\s*\/?>/i);
      const tmp = document.createElement("div");
      tmp.innerHTML = parts[parts.length - 1];
      const at = parseLooseDate(tmp.textContent);
      if (isNaN(at)) return;
      out.push({ src: "youtube", id: ytId(links[0].getAttribute("href")), title: links[0].textContent.trim(), channel: links[1]?.textContent.trim() || null, url: links[0].getAttribute("href"), at });
    });
    return out;
  };

  /** Netflix: full export (ViewingActivity.csv) or simple viewing-history CSV (Title, Date) */
  const fromNetflixCSV = (text) => {
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const h = rows[0].map((x) => x.trim().toLowerCase());
    const col = (name) => h.indexOf(name);
    const out = [];
    if (col("start time") >= 0 && col("title") >= 0) {
      const iS = col("start time"), iD = col("duration"), iT = col("title"), iSup = col("supplemental video type");
      rows.slice(1).forEach((r) => {
        if (iSup >= 0 && (r[iSup] || "").trim()) return; // trailers, hooks…
        const [hh, mm, ss] = (r[iD] || "0:0:0").split(":").map(Number);
        const dur = (hh || 0) * 60 + (mm || 0) + (ss || 0) / 60;
        if (dur < 1) return;
        const at = Date.parse(r[iS].trim().replace(" ", "T") + "Z");
        if (isNaN(at)) return;
        const title = r[iT].trim();
        out.push({ src: "netflix", id: null, title, channel: title.split(":")[0].trim(), url: null, at, dur: Math.round(dur) });
      });
    } else if (col("title") >= 0 && col("date") >= 0) {
      const iT = col("title"), iD = col("date");
      rows.slice(1).forEach((r) => {
        const ds = (r[iD] || "").trim();
        let at = Date.parse(ds);
        const p = ds.split(/[/.-]/).map(Number);
        if ((isNaN(at) || p[0] > 12) && p.length === 3) at = new Date(p[2] < 100 ? 2000 + p[2] : p[2], p[1] - 1, p[0]).getTime(); // D/M/Y
        if (isNaN(at)) return;
        const d = new Date(at); d.setHours(12, 0, 0, 0);
        const title = r[iT].trim();
        out.push({ src: "netflix", id: null, title, channel: title.split(":")[0].trim(), url: null, at: d.getTime(), dur: null });
      });
    }
    return out;
  };

  const vKey = (v) => `${v.src}|${v.id || v.title}|${Math.floor(v.at / 60000)}`;
  const mergeVideos = (list) => {
    const have = new Set(SC().videos.map(vKey));
    let added = 0;
    list.forEach((v) => {
      const k = vKey(v);
      if (have.has(k)) return;
      have.add(k);
      SC().videos.push({ uid: uid(), ...v });
      added++;
    });
    SC().videos.sort((a, b) => a.at - b.at);
    // keep it light: last 365 days
    const cut = Date.now() - 365 * 864e5;
    SC().videos = SC().videos.filter((v) => v.at >= cut);
    return added;
  };

  const importFiles = async (files) => {
    let added = 0, unknown = 0;
    for (const f of files) {
      const text = await f.text();
      let list = [];
      try {
        if (/\.json$/i.test(f.name)) list = fromTakeoutJSON(JSON.parse(text));
        else if (/\.html?$/i.test(f.name)) list = fromTakeoutHTML(text);
        else if (/\.csv$/i.test(f.name)) list = fromNetflixCSV(text);
      } catch { list = []; }
      if (!list.length) unknown++;
      added += mergeVideos(list);
    }
    app().save();
    app().render();
    app().toast(added ? `Imported ${added} videos ✓` : unknown ? "Couldn't find videos in that file. Check the steps below." : "Nothing new: already imported.");
  };

  // ================================================================ extension bridge
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "lifeos-companion") return;
    const p = e.data.payload || {};
    if (p.sites) Object.assign(SC().sites, p.sites); // extension is the source of truth per day
    if (Array.isArray(p.videos)) {
      p.videos.forEach((v) => {
        const at = v.at;
        const existing = SC().videos.find((x) => x.src === "ext" && x.id === v.id && dkey(new Date(x.at)) === dkey(new Date(at)));
        if (existing) { existing.dur = Math.round((v.sec || 0) / 60); existing.title = v.title || existing.title; }
        else SC().videos.push({ uid: uid(), src: "ext", id: v.id, title: v.title, channel: v.channel || null, url: v.url, at, dur: Math.round((v.sec || 0) / 60) });
      });
      SC().videos.sort((a, b) => a.at - b.at);
    }
    SC().extSync = Date.now();
    store.save();
    if (window.LOS.app && S().view === "screen") window.LOS.app.render();
  });
  // ask the extension for fresh data when the page opens
  setTimeout(() => window.postMessage({ source: "lifeos-page", type: "sync-request" }, "*"), 300);

  // ================================================================ analytics
  const days = (n) => [...Array(n)].map((_, i) => dkey(addDays(new Date(), i - n + 1)));
  const siteMin = (k) => Math.round(Object.values(SC().sites[k] || {}).reduce((a, b) => a + b, 0) / 60);
  const dayTotals = (k) => {
    const l = SC().log[k] || {};
    const phone = l.phone ?? null;
    const comp = l.mac ?? (siteMin(k) || null);
    const compSrc = l.mac != null ? "mac" : siteMin(k) ? "browser" : null;
    const total = phone == null && comp == null ? null : (phone || 0) + (comp || 0);
    return { phone, comp, compSrc, total, pickups: l.pickups ?? null };
  };

  /** estimate YouTube durations by the gap to the next video (Takeout has no durations) */
  const withDur = () => {
    const vs = SC().videos.filter((v) => v.src !== "netflix" || v.dur != null);
    return SC().videos.map((v) => {
      if (v.dur != null && v.dur > 0) return { ...v, est: v.dur, guessed: false };
      if (v.src === "netflix") return { ...v, est: 30, guessed: true };
      const i = vs.indexOf(v), next = vs[i + 1];
      const gap = next ? (next.at - v.at) / 60000 : 99;
      return { ...v, est: gap <= 20 ? Math.max(1, Math.round(gap)) : 8, guessed: true };
    });
  };
  const videoMinOn = (k, vids) => vids.filter((v) => dkey(new Date(v.at)) === k).reduce((a, v) => a + v.est, 0);

  /** a "rabbit hole" = 5+ videos back to back (≤20 min apart) */
  const rabbitHoles = (vids, sinceMs) => {
    const yt = vids.filter((v) => v.src !== "netflix" && v.at >= sinceMs);
    const holes = [];
    let run = [];
    yt.forEach((v, i) => {
      if (run.length && (v.at - run[run.length - 1].at) / 60000 > 20) { if (run.length >= 5) holes.push(run); run = []; }
      run.push(v);
      if (i === yt.length - 1 && run.length >= 5) holes.push(run);
    });
    return holes;
  };
  const winsOn = (k) => S().tasks.filter((t) => t.doneAt && dkey(new Date(t.doneAt)) === k).length + S().habits.filter((h) => h.log[k]).length;
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  const insights = (vids) => {
    const out = [];
    const ks = days(30).filter((k) => k !== today());
    const withTotal = ks.map((k) => ({ k, t: dayTotals(k).total })).filter((x) => x.t != null);
    if (withTotal.length >= 4) {
      const sorted = [...withTotal].sort((a, b) => a.t - b.t);
      const med = sorted[Math.floor(sorted.length / 2)].t;
      const lo = avg(withTotal.filter((x) => x.t < med).map((x) => winsOn(x.k)));
      const hi = avg(withTotal.filter((x) => x.t >= med).map((x) => winsOn(x.k)));
      if (lo != null && hi != null && Math.abs(lo - hi) >= 0.3) {
        out.push(lo > hi
          ? `📈 On days under <b>${fmtDur(med)}</b> of screen time you averaged <b>${lo.toFixed(1)}</b> wins, vs <b>${hi.toFixed(1)}</b> on heavier days.`
          : `🤔 Interesting: your heavier screen days (${fmtDur(med)}+) still averaged <b>${hi.toFixed(1)}</b> wins. Not all screen time is the same.`);
      }
    }
    const since14 = Date.now() - 14 * 864e5;
    const late = vids.filter((v) => v.at >= since14 && (new Date(v.at).getHours() >= 23 || new Date(v.at).getHours() < 4));
    if (late.length) {
      const lateDays = new Set(late.map((v) => dkey(addDays(new Date(v.at), new Date(v.at).getHours() < 4 ? 0 : 1)))); // the morning after
      const eAfter = avg([...lateDays].map((k) => S().checkins[k]?.energy).filter(Boolean));
      const eOther = avg(days(14).filter((k) => !lateDays.has(k)).map((k) => S().checkins[k]?.energy).filter(Boolean));
      out.push(eAfter != null && eOther != null && eOther - eAfter >= 0.3
        ? `🌙 <b>${late.length}</b> videos after 11pm in 2 weeks. The mornings after, your energy averaged <b>${eAfter.toFixed(1)}</b>/3 vs <b>${eOther.toFixed(1)}</b> otherwise.`
        : `🌙 <b>${late.length}</b> videos watched after 11pm in the last 2 weeks.`);
    }
    const holes = rabbitHoles(vids, since14);
    if (holes.length) {
      const big = holes.reduce((a, b) => (b.length > a.length ? b : a));
      const mins = big.reduce((a, v) => a + v.est, 0);
      out.push(`🕳️ <b>${holes.length}</b> YouTube rabbit hole${holes.length > 1 ? "s" : ""} in 2 weeks (5+ videos back to back). Longest: <b>${big.length} videos</b>, ~${fmtDur(mins)} on ${new Date(big[0].at).toLocaleDateString("en-US", { weekday: "long" })}.`);
    }
    if (!out.length) out.push("Log a few days and import your history. Patterns will show up here, without judgment.");
    return out;
  };

  // ================================================================ view pieces
  const hm = (min) => (min == null ? "" : { h: Math.floor(min / 60), m: min % 60 });
  const logCard = (compact = false) => {
    const l = SC().log[today()] || {};
    const p = hm(l.phone ?? null), m = hm(l.mac ?? null);
    const tracked = siteMin(today());
    return `
      <div class="c">
        <h3>Screen time today <span class="r pill vio">10 sec</span></h3>
        <form class="screen-log" data-form="screen-log">
          <div class="sl-row"><span class="sl-dev">📱 iPhone</span>
            <input class="field" type="number" min="0" max="24" name="ph" placeholder="h" value="${p === "" ? "" : p.h}" aria-label="iPhone hours" />
            <input class="field" type="number" min="0" max="59" name="pm" placeholder="min" value="${p === "" ? "" : p.m}" aria-label="iPhone minutes" /></div>
          <div class="sl-row"><span class="sl-dev">💻 Mac</span>
            <input class="field" type="number" min="0" max="24" name="mh" placeholder="h" value="${m === "" ? "" : m.h}" aria-label="Mac hours" />
            <input class="field" type="number" min="0" max="59" name="mm" placeholder="min" value="${m === "" ? "" : m.m}" aria-label="Mac minutes" /></div>
          ${compact ? "" : `<div class="sl-row"><span class="sl-dev">👆 Pickups</span>
            <input class="field" type="number" min="0" max="999" name="pk" placeholder="optional" value="${l.pickups ?? ""}" aria-label="Pickups" /><span></span></div>`}
          <button class="btn sm primary" style="margin-top:4px">Save</button>
        </form>
        <p class="mut" style="font-size:12px;margin-top:10px;line-height:1.5">iPhone: Settings → Screen Time → See All Activity<br>Mac: System Settings → Screen Time${tracked ? `<br>Browser tracked today: <b style="color:var(--ink-2)">${fmtDur(tracked)}</b>` : ""}</p>
      </div>`;
  };

  /** small evening reminder for the Now screen */
  const nowNudge = () => {
    if (new Date().getHours() < 19 || SC().log[today()]) return "";
    return `<button class="c mini-item" data-action="nav" data-view="screen" style="padding:16px 20px">📱 <span class="t">Log today's screen time · 10 sec</span><span class="add">Open →</span></button>`;
  };

  const chart14 = (vids) => {
    const ks = days(14);
    const data = ks.map((k) => ({ k, ...dayTotals(k), vid: videoMinOn(k, vids) }));
    const max = Math.max(60, ...data.map((d) => Math.max(d.total || 0, d.vid)), SC().softLimit || 0);
    const W = 600, H = 170, bw = W / 14;
    const y = (v) => H - 18 - (v / max) * (H - 30);
    let bars = "";
    data.forEach((d, i) => {
      const x = i * bw + bw * 0.2, w = bw * 0.6;
      if (d.total == null) bars += `<rect x="${x}" y="${H - 22}" width="${w}" height="4" rx="2" fill="#22222c"/>`;
      else {
        const ph = d.phone || 0, cp = d.comp || 0;
        bars += `<rect x="${x}" y="${y(ph + cp)}" width="${w}" height="${Math.max(0, y(ph) - y(ph + cp))}" rx="3" fill="#4dd8ff" fill-opacity="${d.compSrc === "browser" ? 0.5 : 0.9}"/>`;
        bars += `<rect x="${x}" y="${y(ph)}" width="${w}" height="${Math.max(0, H - 18 - y(ph))}" rx="3" fill="#8b7cff"/>`;
      }
      bars += `<text x="${x + w / 2}" y="${H - 4}" text-anchor="middle" font-size="10" fill="#74748a" font-family="JetBrains Mono">${new Date(d.k + "T12:00").getDate()}</text>`;
    });
    const vline = data.map((d, i) => `${i ? "L" : "M"}${(i * bw + bw / 2).toFixed(1)} ${y(d.vid).toFixed(1)}`).join(" ");
    const lim = SC().softLimit ? `<line x1="0" x2="${W}" y1="${y(SC().softLimit)}" y2="${y(SC().softLimit)}" stroke="#c8ff4d" stroke-opacity=".45" stroke-dasharray="4 5"/>` : "";
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:190px;display:block;overflow:visible">${lim}${bars}
      ${vids.length ? `<path d="${vline}" fill="none" stroke="#ff5c8a" stroke-width="2" stroke-linejoin="round"/>` : ""}</svg>
      <div class="legend"><i style="background:var(--vio)"></i> iPhone <i style="background:var(--cyan);margin-left:8px"></i> Mac / browser <i style="background:var(--pink);margin-left:8px"></i> videos (est.)${SC().softLimit ? `<i style="background:none;border-top:2px dashed var(--lime);border-radius:0;height:0;width:14px;margin-left:8px"></i> soft limit` : ""}</div>`;
  };

  const hourChart = (vids) => {
    const since = Date.now() - 30 * 864e5;
    const hrs = Array(24).fill(0);
    vids.filter((v) => v.at >= since).forEach((v) => { hrs[new Date(v.at).getHours()]++; });
    const mx = Math.max(1, ...hrs);
    const peak = hrs.indexOf(Math.max(...hrs));
    return `
      <div class="hours">${hrs.map((n, h) => `<div title="${h}:00 · ${n} videos"><i style="height:${Math.round((n / mx) * 100)}%;${h >= 23 || h < 5 ? "background:var(--pink)" : ""}"></i></div>`).join("")}</div>
      <div class="hours-x mono"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
      ${hrs.some(Boolean) ? `<p class="mut" style="font-size:12px;margin-top:8px">Peak: around <b style="color:var(--ink-2)">${peak}:00</b> · pink = late night</p>` : ""}`;
  };

  const srcPill = (v) => (v.src === "netflix" ? `<span class="src nf">N</span>` : `<span class="src yt">▶</span>`);

  const view = () => {
    const vids = withDur();
    const t = dayTotals(today());
    const last7 = days(7).map((k) => dayTotals(k).total).filter((x) => x != null);
    const prev7 = days(14).slice(0, 7).map((k) => dayTotals(k).total).filter((x) => x != null);
    const a7 = avg(last7), p7 = avg(prev7);
    const delta = a7 != null && p7 != null ? Math.round(a7 - p7) : null;
    const weekVid = days(7).reduce((a, k) => a + videoMinOn(k, vids), 0);
    const lim = SC().softLimit;
    const over = lim && t.total != null && t.total > lim;
    const recent = [...vids].reverse().slice(0, 25);
    const since14 = Date.now() - 14 * 864e5;
    const chans = {};
    vids.filter((v) => v.at >= since14 && v.channel).forEach((v) => { chans[v.channel] = (chans[v.channel] || 0) + v.est; });
    const topCh = Object.entries(chans).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const chMax = topCh[0]?.[1] || 1;
    const sites = Object.entries(SC().sites[today()] || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const siteMax = sites[0]?.[1] || 1;
    const extOn = SC().extSync && Date.now() - SC().extSync < 15 * 60000;

    return `
      <section class="view" data-view="screen">
        <div class="hero">
          <div><h1>Screen. <span>Notice, don't judge.</span></h1><p>Screens aren't the enemy. This is just data to help you choose.</p></div>
          <div class="row" style="gap:28px">
            <div class="stat"><small>Today</small><b class="mono">${t.total != null ? fmtDur(t.total) : "–"}</b></div>
            <div class="stat"><small>7-day average</small><b class="mono">${a7 != null ? fmtDur(a7) : "–"}</b></div>
            <div class="stat"><small>vs last week</small><b class="mono" style="font-size:22px">${delta == null ? "–" : delta === 0 ? "same" : `${delta < 0 ? "↓" : "↑"} ${fmtDur(Math.abs(delta))}`}</b></div>
            <div class="stat"><small>Videos (7d)</small><b class="mono">${weekVid ? fmtDur(weekVid) : "–"}</b></div>
          </div>
        </div>
        ${over ? `<div class="nudge">🫧 <span class="sp">You're past your soft limit of <b>${fmtDur(lim)}</b> today. No big deal. Want a 5-minute reset? Stand up, water, look out a window.</span><button class="btn sm ghost" data-action="nav" data-view="now">Back to one thing</button></div>` : ""}
        <div class="grid g-now">
          <div class="stack">
            <div class="c"><h3>Last 14 days</h3>${chart14(vids)}</div>
            <div class="c"><h3>Insights <span class="r mut">last 2–4 weeks</span></h3>
              <div class="insights">${insights(vids).map((s) => `<p>${s}</p>`).join("")}</div></div>
            <div class="c">
              <h3>Videos you watched <span class="r mono">${vids.length}</span></h3>
              ${recent.length ? `<div class="vlist">${recent.map((v) => `
                <div class="vrow">
                  ${srcPill(v)}
                  <div class="t">${v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)}</a>` : esc(v.title)}
                    <small>${v.channel ? esc(v.channel) + " · " : ""}${new Date(v.at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</small></div>
                  <span class="mono mut" style="font-size:12px">${v.guessed ? "~" : ""}${fmtDur(v.est)}</span>
                </div>`).join("")}</div>`
                : `<div class="empty">No videos yet. Import your YouTube or Netflix history, or install the browser companion.</div>`}
            </div>
          </div>
          <div class="stack">
            ${logCard()}
            <div class="c">
              <h3>Soft limit <span class="r mut">optional</span></h3>
              <div class="seg">${[[0, "None"], [120, "2h"], [180, "3h"], [240, "4h"], [360, "6h"]].map(([v, l]) => `<button class="${(lim || 0) === v ? "on" : ""}" data-action="screen-limit" data-v="${v}">${l}</button>`).join("")}</div>
              ${lim ? `<div class="bar-soft"><i style="width:${Math.min(100, ((t.total || 0) / lim) * 100)}%;${over ? "background:var(--vio)" : ""}"></i></div><p class="mut" style="font-size:12px;margin-top:8px">${t.total != null ? `${fmtDur(t.total)} of ${fmtDur(lim)}` : "Log today to see progress"} · iPhone + Mac</p>` : `<p class="mut" style="font-size:12px;margin-top:10px">A gentle line on the chart. Going over is information, not failure.</p>`}
            </div>
            <div class="c"><h3>When you watch <span class="r mut">30 days</span></h3>${hourChart(vids)}</div>
            ${topCh.length ? `<div class="c"><h3>Top channels & shows <span class="r mut">14 days</span></h3>${topCh.map(([n, m]) => `<div class="hbar"><span class="t">${esc(n)}</span><span class="mono mut">${fmtDur(m)}</span><i style="width:${(m / chMax) * 100}%"></i></div>`).join("")}</div>` : ""}
            <div class="c">
              <h3>Browser companion <span class="r pill ${extOn ? "" : "gray"}">${extOn ? "● connected" : SC().extSync ? "last sync " + new Date(SC().extSync).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "not installed"}</span></h3>
              ${sites.length ? sites.map(([d, s]) => `<div class="hbar"><span class="t">${esc(d)}</span><span class="mono mut">${fmtDur(Math.round(s / 60))}</span><i style="width:${(s / siteMax) * 100}%;background:var(--cyan)"></i></div>`).join("") : ""}
              <details class="how"${SC().extSync ? "" : " open"}><summary>How to install (Chrome, Arc, Brave, Edge)</summary>
                <ol>
                  <li>Open <span class="mono">chrome://extensions</span> and turn on <b>Developer mode</b>.</li>
                  <li>Click <b>Load unpacked</b> and choose the <span class="mono">extension</span> folder of this project.</li>
                  <li>Open Life OS at <span class="mono">http://localhost:8000</span> (run <span class="mono">python3 -m http.server 8000</span>). If you open the file directly, enable <b>Allow access to file URLs</b> in the extension's details.</li>
                </ol>
                <p>It counts time on the active tab only (pauses when you're idle) and saves YouTube titles. Data never leaves your Mac. Safari needs an Xcode build: ask if you want it.</p>
              </details>
            </div>
            <div class="c">
              <h3>Import history</h3>
              <label class="btn ghost" style="width:100%">⬆ Choose files<input type="file" accept=".json,.html,.htm,.csv" multiple data-screen-import hidden /></label>
              <details class="how"><summary>YouTube (Google Takeout)</summary><ol>
                <li>Go to <span class="mono">takeout.google.com</span> → <b>Deselect all</b> → check <b>YouTube and YouTube Music</b>.</li>
                <li><b>All YouTube data included</b> → keep only <b>history</b>. Under <b>Multiple formats</b>, set history to <b>JSON</b> (HTML works too).</li>
                <li>Export, download the zip, and pick <span class="mono">watch-history.json</span> here.</li></ol></details>
              <details class="how"><summary>Netflix</summary><ol>
                <li>Netflix → Account → <b>Profiles</b> → your profile → <b>Viewing activity</b> → <b>Download all</b> (CSV).</li>
                <li>Or Account → <b>Download your personal information</b> → use <span class="mono">ViewingActivity.csv</span> (includes real durations).</li></ol></details>
              ${SC().videos.length ? `<button class="btn quiet sm" data-action="screen-clear" style="margin-top:8px;color:var(--pink)">Clear video history</button>` : ""}
            </div>
          </div>
        </div>
      </section>`;
  };

  // ================================================================ actions
  const act = (a, el) => {
    if (a === "screen-limit") { SC().softLimit = Number(el.dataset.v) || null; app().save(); app().render(); return true; }
    if (a === "screen-clear") {
      const backup = SC().videos;
      SC().videos = [];
      app().save(); app().render();
      app().toast("Video history cleared", { action: { label: "Undo", fn: () => { SC().videos = backup; app().save(); app().render(); } } });
      return true;
    }
    return false;
  };
  const submit = (form, d) => {
    if (form.dataset.form !== "screen-log") return false;
    const toM = (h, m) => (h === "" && m === "" ? null : (Number(h) || 0) * 60 + (Number(m) || 0));
    const phone = toM(d.ph, d.pm), mac = toM(d.mh, d.mm);
    const prev = SC().log[today()] || {};
    SC().log[today()] = { ...prev, phone, mac, ...(d.pk !== undefined ? { pickups: d.pk === "" ? null : Number(d.pk) } : {}) };
    app().save();
    app().render();
    const total = (phone || 0) + (mac || 0);
    app().toast(`Logged ${fmtDur(total)} 📱 Thanks for noticing.`);
    return true;
  };

  window.LOS.screen = { view, act, submit, logCard, nowNudge, importFiles, _parse: { fromTakeoutJSON, fromTakeoutHTML, fromNetflixCSV, parseLooseDate } };
})();
