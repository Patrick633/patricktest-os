/* Life OS — Cyber news: a short daily cybersecurity brief.
   Direct (works in any browser): Hacker News (security search) and DEV.to (#cybersecurity, #security).
   Through the Life OS Companion extension: The Hacker News, BleepingComputer, Krebs on Security,
   SecurityWeek, Dark Reading (RSS) and CISA's Known Exploited Vulnerabilities catalog.
   Built to be time-boxed: a 5-minute timer, then back to one thing. */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  const { esc, store } = window.LOS;
  const S = () => store.state;
  const NW = () => S().news;
  const app = () => window.LOS.app;

  const SOURCES = {
    thn: { name: "The Hacker News", color: "#ff5c8a", via: "ext" },
    bleeping: { name: "BleepingComputer", color: "#4dd8ff", via: "ext" },
    krebs: { name: "Krebs on Security", color: "#ffd84d", via: "ext" },
    securityweek: { name: "SecurityWeek", color: "#8b7cff", via: "ext" },
    darkreading: { name: "Dark Reading", color: "#ffa24d", via: "ext" },
    hn: { name: "Hacker News", color: "#ff8a3d", via: "direct" },
    dev: { name: "DEV", color: "#5cffb0", via: "direct" },
  };
  const HN_TERMS = ["security", "vulnerability", "ransomware", "breach", "malware", "exploit", "CVE", "zero-day"];
  const ui = { loading: false, more: false, timerWarned: false };

  const ago = (ms) => {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 60) return `${Math.max(1, m)}m ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  };
  const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  // ---------------------------------------------------------------- fetchers
  const getJSON = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };

  const fetchHN = async () => {
    const since = Math.floor(Date.now() / 1000) - 3 * 86400;
    const res = await Promise.allSettled(HN_TERMS.map((q) => getJSON(`https://hn.algolia.com/api/v1/search?tags=story&query=${encodeURIComponent(q)}&numericFilters=created_at_i>${since},points>15&hitsPerPage=12`)));
    if (res.every((r) => r.status === "rejected")) throw new Error("hn");
    const out = [];
    res.forEach((r) => r.status === "fulfilled" && r.value.hits.forEach((h) => out.push({
      id: `hn-${h.objectID}`, src: "hn", title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      discuss: `https://news.ycombinator.com/item?id=${h.objectID}`, at: h.created_at_i * 1000, score: h.points, comments: h.num_comments,
    })));
    return out;
  };

  const fetchDEV = async () => {
    const res = await Promise.allSettled(["cybersecurity", "security", "infosec"].map((t) => getJSON(`https://dev.to/api/articles?tag=${t}&top=3&per_page=12`)));
    if (res.every((r) => r.status === "rejected")) throw new Error("dev");
    const out = [];
    res.forEach((r) => r.status === "fulfilled" && r.value.forEach((a) => out.push({
      id: `dev-${a.id}`, src: "dev", title: a.title, url: a.url, at: Date.parse(a.published_at), score: a.positive_reactions_count, tags: a.tag_list,
    })));
    return out;
  };

  /** ask the browser extension (it can read RSS feeds a web page can't) */
  const viaExtension = () => new Promise((resolve) => {
    let done = false;
    const on = (e) => {
      if (e.source !== window || !e.data || e.data.source !== "lifeos-companion" || e.data.type !== "news") return;
      done = true;
      window.removeEventListener("message", on);
      resolve(e.data.payload || null);
    };
    window.addEventListener("message", on);
    window.postMessage({ source: "lifeos-page", type: "news-request" }, "*");
    setTimeout(() => { if (!done) { window.removeEventListener("message", on); resolve(null); } }, 15000);
  });

  const parseFeed = (key, text) => {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const txt = (el, sel) => el.querySelector(sel)?.textContent?.trim() || "";
    let items = [...doc.querySelectorAll("item")].map((it) => ({ title: txt(it, "title"), url: txt(it, "link"), at: Date.parse(txt(it, "pubDate") || it.getElementsByTagName("dc:date")[0]?.textContent || "") }));
    if (!items.length) items = [...doc.querySelectorAll("entry")].map((it) => ({ title: txt(it, "title"), url: it.querySelector("link")?.getAttribute("href") || "", at: Date.parse(txt(it, "updated") || txt(it, "published")) }));
    return items.filter((i) => i.title && i.url && !isNaN(i.at)).slice(0, 15).map((i) => ({ id: `${key}-${i.url}`, src: key, ...i }));
  };

  const parseKEV = (text) => {
    const j = JSON.parse(text);
    return (j.vulnerabilities || []).sort((a, b) => (b.dateAdded || "").localeCompare(a.dateAdded || "")).slice(0, 8).map((v) => ({
      id: v.cveID, vendor: v.vendorProject, product: v.product, name: v.vulnerabilityName, added: v.dateAdded, desc: v.shortDescription, ransomware: v.knownRansomwareCampaignUse === "Known",
    }));
  };

  const refresh = async () => {
    if (ui.loading) return;
    ui.loading = true;
    app().render();
    const status = {};
    const [hn, dev, ext] = await Promise.all([fetchHN().catch(() => null), fetchDEV().catch(() => null), viaExtension()]);
    status.hn = hn ? "ok" : "error";
    status.dev = dev ? "ok" : "error";
    let items = [...(hn || []), ...(dev || [])];
    if (ext && ext.feeds) {
      status.ext = "ok";
      Object.entries(ext.feeds).forEach(([k, text]) => {
        try { const parsed = text ? parseFeed(k, text) : []; status[k] = parsed.length ? "ok" : "error"; items.push(...parsed); } catch { status[k] = "error"; }
      });
      try { if (ext.kev) NW().kev = parseKEV(ext.kev); status.kev = ext.kev ? "ok" : "error"; } catch { status.kev = "error"; }
    } else status.ext = "missing";
    // de-duplicate the same story across sources, newest first
    const seen = new Set();
    items = items.sort((a, b) => b.at - a.at).filter((i) => { const k = norm(i.title); if (seen.has(k)) return false; seen.add(k); return true; });
    if (items.length || !NW().items.length) NW().items = items.slice(0, 80);
    NW().fetchedAt = Date.now();
    NW().status = status;
    // forget "read" marks for stories that are gone
    const ids = new Set(NW().items.map((i) => i.id));
    Object.keys(NW().read).forEach((k) => { if (!ids.has(k)) delete NW().read[k]; });
    ui.loading = false;
    app().save();
    app().render();
  };

  // ---------------------------------------------------------------- 5-minute timer
  setInterval(() => {
    const end = NW().timerEnd;
    if (!end) return;
    const left = end - Date.now();
    const el = document.querySelector("[data-news-left]");
    if (el) el.textContent = left > 0 ? `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")} left` : "Time's up";
    if (left <= 0 && !ui.timerWarned) {
      ui.timerWarned = true;
      NW().timerEnd = null;
      app().save();
      if (S().settings.sound) window.LOS.fx.bell();
      app().toast("⏱ 5 minutes of news. Back to one thing?", { action: { label: "Go to Now", fn: () => { S().view = "now"; app().save(); app().render(); } }, ms: 7000 });
      app().render();
    }
  }, 1000);

  // ---------------------------------------------------------------- view
  const view = () => {
    const n = NW();
    if (!ui.loading && Date.now() - (n.fetchedAt || 0) > 2 * 3600e3) setTimeout(refresh, 50); // auto refresh every 2h
    const fresh = n.items.filter((i) => Date.now() - i.at < 4 * 86400e3);
    const list = n.filter === "all" ? fresh : fresh.filter((i) => i.src === n.filter);
    const shown = list.slice(0, ui.more ? 40 : 10);
    const unread = fresh.filter((i) => !n.read[i.id]).length;
    const present = [...new Set(fresh.map((i) => i.src))];
    const st = n.status || {};
    const extOk = st.ext === "ok";
    return `
      <section class="view" data-view="news">
        <div class="hero">
          <div><h1>Cyber news. <span>5 minutes, then back.</span></h1>
            <p>${n.fetchedAt ? `Updated ${ago(n.fetchedAt)} · ${unread} unread` : "Your daily cybersecurity brief"}${ui.loading ? " · refreshing…" : ""}</p></div>
          <div class="row" style="gap:8px">
            ${n.timerEnd ? `<span class="pill vio mono" data-news-left>…</span>` : `<button class="btn ghost" data-action="news-timer">⏱ 5-min timer</button>`}
            <button class="btn ghost" data-action="news-refresh" ${ui.loading ? "disabled" : ""}>${ui.loading ? "Loading…" : "↻ Refresh"}</button>
          </div>
        </div>
        <div class="grid g-now">
          <div class="c">
            <div class="seg" style="margin-bottom:14px;flex-wrap:wrap">
              <button class="${n.filter === "all" ? "on" : ""}" data-action="news-filter" data-v="all">All</button>
              ${present.map((k) => `<button class="${n.filter === k ? "on" : ""}" data-action="news-filter" data-v="${k}"><span class="dot" style="background:${SOURCES[k].color}"></span> ${SOURCES[k].name}</button>`).join("")}
            </div>
            ${shown.length ? `<div class="nlist">${shown.map((i) => `
              <div class="nrow ${n.read[i.id] ? "read" : ""}">
                <span class="nsrc" style="--sc:${SOURCES[i.src].color}">${SOURCES[i.src].name}</span>
                <div class="t">
                  <a href="${esc(i.url)}" target="_blank" rel="noopener" data-action="news-open" data-id="${esc(i.id)}">${esc(i.title)}</a>
                  <small>${ago(i.at)}${i.score ? ` · ${i.score} ${i.src === "hn" ? "points" : "reactions"}` : ""}${i.discuss ? ` · <a href="${esc(i.discuss)}" target="_blank" rel="noopener">${i.comments || 0} comments</a>` : ""}</small>
                </div>
                <button class="tiny" data-action="news-save" data-id="${esc(i.id)}" title="Save to Inbox to read later">Save</button>
                <button class="tiny" data-action="news-read" data-id="${esc(i.id)}" title="${n.read[i.id] ? "Mark unread" : "Mark read"}">${n.read[i.id] ? "↺" : "✓"}</button>
              </div>`).join("")}</div>
              ${list.length > 10 ? `<button class="btn quiet sm" data-action="news-more" style="margin-top:8px">${ui.more ? "Show less" : `Show ${Math.min(40, list.length) - 10} more`}</button>` : ""}`
            : `<div class="empty">${ui.loading ? "Fetching the latest security news…" : n.fetchedAt ? "Couldn't load news right now. Check your connection and hit Refresh." : "Loading…"}</div>`}
          </div>
          <div class="stack">
            <div class="c">
              <h3>Actively exploited <span class="r mut">CISA KEV</span></h3>
              ${n.kev.length ? `<div class="kev">${n.kev.map((v) => `
                <a class="kev-row" href="https://nvd.nist.gov/vuln/detail/${esc(v.id)}" target="_blank" rel="noopener">
                  <span class="mono kev-id">${esc(v.id)}</span>
                  <span class="t">${esc(v.vendor)} ${esc(v.product)}<small>${esc(v.name)}</small></span>
                  <span class="kev-meta mono">${esc(v.added)}${v.ransomware ? `<i class="pill" style="background:rgba(255,92,138,.15);color:var(--pink)">ransomware</i>` : ""}</span>
                </a>`).join("")}</div>`
              : `<p class="mut" style="font-size:13px;line-height:1.6">Vulnerabilities attackers are exploiting right now (from CISA). ${extOk ? "Nothing loaded yet." : "Needs the Life OS Companion extension."}</p>`}
            </div>
            <div class="c">
              <h3>Sources</h3>
              <div class="srcs">${Object.entries(SOURCES).map(([k, s]) => {
                const v = s.via === "ext" && !extOk ? "needs extension" : st[k] === "ok" ? "✓" : st[k] === "error" ? "unavailable" : "–";
                return `<div class="src-row"><span class="dot" style="background:${s.color}"></span><span class="t">${s.name}</span><span class="mut mono" style="font-size:11px">${v}</span></div>`;
              }).join("")}</div>
              ${extOk ? "" : `<details class="how"><summary>Get all sources with the browser companion</summary>
                <p>Security news sites only publish RSS feeds, which web pages can't read directly. The Life OS Companion extension reads them for you.</p>
                <ol><li>Install it from the <span class="mono">extension</span> folder (see the Screen tab).</li>
                <li>Already installed? Open <span class="mono">chrome://extensions</span> and click <b>↻ reload</b> on Life OS Companion to grant the news permissions.</li>
                <li>Come back here and hit Refresh.</li></ol></details>`}
            </div>
          </div>
        </div>
      </section>`;
  };

  // ---------------------------------------------------------------- actions
  const act = (a, el) => {
    if (!a.startsWith("news-")) return false;
    const A = app(), n = NW(), id = el.dataset.id;
    switch (a) {
      case "news-refresh": refresh(); return true;
      case "news-filter": n.filter = el.dataset.v; ui.more = false; break;
      case "news-more": ui.more = !ui.more; break;
      case "news-open": n.read[id] = 1; A.save(); setTimeout(A.render, 50); return true;
      case "news-read": if (n.read[id]) delete n.read[id]; else n.read[id] = 1; break;
      case "news-save": {
        const i = n.items.find((x) => x.id === id);
        if (!i) return true;
        A.addTask(`Read: ${i.title}`, { note: i.url, est: 10, energy: 1 });
        n.read[id] = 1;
        A.toast("Saved to Inbox for later 📌");
        break;
      }
      case "news-timer": n.timerEnd = Date.now() + 5 * 60000; ui.timerWarned = false; A.toast("⏱ 5 minutes. Skim, save, move on."); break;
      default: return false;
    }
    A.save(); A.render();
    return true;
  };

  window.LOS.news = { view, act, refresh, _parseFeed: parseFeed, _parseKEV: parseKEV };
})();
