/* Life OS Companion — background service worker.
   Tracks seconds on the active tab per site per day (paused when idle or the browser isn't focused)
   and records YouTube videos you watch. Everything is kept in chrome.storage.local. */
"use strict";

const KEEP_DAYS = 60;
const pad = (n) => String(n).padStart(2, "0");
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const ytId = (url) => {
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const s = u.pathname.match(/^\/shorts\/([\w-]+)/);
    return s ? s[1] : null;
  } catch { return null; }
};
const cleanTitle = (t) => String(t || "").replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "").trim();
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } };

// Serialize all work so overlapping events can't double count.
let chain = Promise.resolve();
const queue = (fn) => (chain = chain.then(fn).catch((e) => console.warn("[Life OS]", e)));

const getCur = async () => (await chrome.storage.session.get("cur")).cur || null;
const setCur = (cur) => chrome.storage.session.set({ cur });
const lifeTabs = async () => (await chrome.storage.session.get("lifeTabs")).lifeTabs || [];

/** Close the running segment and add its seconds to storage. */
async function commit() {
  const c = await getCur();
  if (!c) return;
  await setCur(null);
  const sec = Math.round((Date.now() - c.start) / 1000);
  if (sec <= 0 || sec > 3 * 3600) return; // ignore clock jumps / sleep
  const day = dkey(new Date(c.start));
  const { sites = {}, videos = [] } = await chrome.storage.local.get(["sites", "videos"]);
  sites[day] = sites[day] || {};
  sites[day][c.domain] = (sites[day][c.domain] || 0) + sec;
  if (c.videoId) {
    const v = videos.find((x) => x.id === c.videoId && x.day === day);
    if (v) v.sec += sec;
  }
  await chrome.storage.local.set({ sites, videos });
}

/** Start a new segment for this tab. */
async function begin(tab) {
  if (!tab || !tab.url || !/^https?:/.test(tab.url)) return;
  if ((await lifeTabs()).includes(tab.id)) return; // don't count Life OS itself
  const domain = domainOf(tab.url);
  if (!domain) return;
  const videoId = ytId(tab.url);
  if (videoId) {
    const day = dkey();
    const { videos = [] } = await chrome.storage.local.get("videos");
    if (!videos.some((x) => x.id === videoId && x.day === day)) {
      videos.push({ id: videoId, day, title: cleanTitle(tab.title), url: `https://www.youtube.com/watch?v=${videoId}`, at: Date.now(), sec: 0 });
      await chrome.storage.local.set({ videos });
    }
  }
  await setCur({ tabId: tab.id, domain, videoId, start: Date.now() });
}

/** Re-evaluate what the user is looking at right now. */
async function refresh() {
  await commit();
  const state = await chrome.idle.queryState(60);
  if (state !== "active") return;
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win || !win.focused) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  await begin(tab);
}

async function prune() {
  const cutoff = dkey(new Date(Date.now() - KEEP_DAYS * 864e5));
  const { sites = {}, videos = [] } = await chrome.storage.local.get(["sites", "videos"]);
  Object.keys(sites).forEach((k) => { if (k < cutoff) delete sites[k]; });
  await chrome.storage.local.set({ sites, videos: videos.filter((v) => v.day >= cutoff) });
}

chrome.tabs.onActivated.addListener(() => queue(refresh));
chrome.windows.onFocusChanged.addListener(() => queue(refresh));
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(() => queue(refresh));
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!tab.active) return;
  if (info.url) return queue(refresh);
  if (info.title) {
    // YouTube changes the title after navigation; fix the stored title.
    queue(async () => {
      const id = ytId(tab.url);
      if (!id) return;
      const { videos = [] } = await chrome.storage.local.get("videos");
      const v = videos.find((x) => x.id === id && x.day === dkey());
      const t = cleanTitle(info.title);
      if (v && t && t !== "YouTube") { v.title = t; await chrome.storage.local.set({ videos }); }
    });
  }
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const lt = await lifeTabs();
  if (lt.includes(tabId)) chrome.storage.session.set({ lifeTabs: lt.filter((x) => x !== tabId) });
  queue(refresh);
});

chrome.alarms.create("tick", { periodInMinutes: 1 });
chrome.alarms.create("prune", { periodInMinutes: 360 });
chrome.alarms.onAlarm.addListener((a) => queue(a.name === "prune" ? prune : refresh));
chrome.runtime.onStartup.addListener(() => queue(refresh));
chrome.runtime.onInstalled.addListener(() => queue(refresh));

// The bridge script tells us which tabs are Life OS (so we don't count them).
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === "lifeos-tab" && sender.tab) {
    queue(async () => {
      const lt = await lifeTabs();
      if (!lt.includes(sender.tab.id)) await chrome.storage.session.set({ lifeTabs: [...lt, sender.tab.id] });
      await refresh();
    });
  }
  if (msg?.type === "flush") queue(refresh).then(() => reply({ ok: true }));
  return msg?.type === "flush";
});
