/* Life OS Companion — bridge. Runs on local pages and only talks to a page that is Life OS. */
(() => {
  "use strict";
  if (!document.querySelector('meta[name="lifeos"]')) return;

  chrome.runtime.sendMessage({ type: "lifeos-tab" }).catch(() => {});

  const send = async () => {
    try { await chrome.runtime.sendMessage({ type: "flush" }); } catch { /* worker asleep: fine */ }
    const cutoff = Date.now() - 30 * 864e5;
    const { sites = {}, videos = [] } = await chrome.storage.local.get(["sites", "videos"]);
    window.postMessage({ source: "lifeos-companion", payload: { sites, videos: videos.filter((v) => v.at >= cutoff) } }, window.location.origin === "null" ? "*" : window.location.origin);
  };

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "lifeos-page") return;
    if (e.data.type === "sync-request") send();
    if (e.data.type === "news-request") {
      chrome.runtime.sendMessage({ type: "news-fetch" })
        .then((payload) => window.postMessage({ source: "lifeos-companion", type: "news", payload }, window.location.origin === "null" ? "*" : window.location.origin))
        .catch(() => {});
    }
  });
  send();
  setInterval(send, 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) send(); });
})();
