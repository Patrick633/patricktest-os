"use strict";
const pad = (n) => String(n).padStart(2, "0");
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (sec) => { const m = Math.round(sec / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

(async () => {
  try { await chrome.runtime.sendMessage({ type: "flush" }); } catch { /* ignore */ }
  const { sites = {}, videos = [] } = await chrome.storage.local.get(["sites", "videos"]);
  const today = sites[dkey()] || {};
  const list = Object.entries(today).sort((a, b) => b[1] - a[1]);
  const total = list.reduce((a, [, s]) => a + s, 0);
  document.getElementById("total").textContent = fmt(total);
  const max = list[0]?.[1] || 1;
  const sitesEl = document.getElementById("sites");
  if (!list.length) sitesEl.appendChild(el("div", "mut", "Nothing yet today."));
  list.slice(0, 6).forEach(([d, s]) => {
    const r = el("div", "row");
    r.append(el("span", "", d), el("span", "mut", fmt(s)));
    const bar = el("i");
    bar.style.width = `${(s / max) * 100}%`;
    r.appendChild(bar);
    sitesEl.appendChild(r);
  });
  const vEl = document.getElementById("videos");
  const vs = videos.filter((v) => v.day === dkey()).reverse().slice(0, 5);
  if (!vs.length) vEl.appendChild(el("div", "mut", "No videos today."));
  vs.forEach((v) => vEl.appendChild(el("div", "v", `${v.title || "Untitled"} · ${fmt(v.sec)}`)));
})();
