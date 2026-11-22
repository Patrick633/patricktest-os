// Life OS · news proxy (Supabase Edge Function)
// Security news sites only publish RSS feeds that browsers can't read directly (no CORS),
// so this function fetches a FIXED list of feeds plus CISA's Known Exploited Vulnerabilities
// and returns them to the Life OS app. It never fetches anything else and stores nothing.

const FEEDS: Record<string, string> = {
  thn: "https://feeds.feedburner.com/TheHackersNews",
  bleeping: "https://www.bleepingcomputer.com/feed/",
  krebs: "https://krebsonsecurity.com/feed/",
  securityweek: "https://www.securityweek.com/feed/",
  darkreading: "https://www.darkreading.com/rss.xml",
};
const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const ALLOWED_ORIGINS = ["https://patrick633.github.io", "http://localhost:8000", "http://127.0.0.1:8000"];
const TTL = 10 * 60 * 1000; // reuse results for 10 minutes

let cache: { at: number; body: string } | null = null;

const getText = async (url: string, ms = 9000): Promise<string | null> => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "LifeOS-NewsProxy/1.0", Accept: "application/rss+xml, application/xml, application/json, */*" } });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
};

const build = async (): Promise<string> => {
  const keys = Object.keys(FEEDS);
  const [texts, kevText] = await Promise.all([Promise.all(keys.map((k) => getText(FEEDS[k]))), getText(KEV_URL, 12000)]);
  const feeds: Record<string, string | null> = {};
  // keep payloads small: feeds are trimmed to ~120 KB each
  keys.forEach((k, i) => { feeds[k] = texts[i] ? texts[i]!.slice(0, 120_000) : null; });
  let kev: string | null = null;
  if (kevText) {
    try {
      const j = JSON.parse(kevText);
      j.vulnerabilities = (j.vulnerabilities || [])
        .sort((a: { dateAdded?: string }, b: { dateAdded?: string }) => (b.dateAdded || "").localeCompare(a.dateAdded || ""))
        .slice(0, 25);
      kev = JSON.stringify(j);
    } catch { kev = null; }
  }
  return JSON.stringify({ feeds, kev, at: Date.now() });
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: cors });
  if (!cache || Date.now() - cache.at > TTL) cache = { at: Date.now(), body: await build() };
  return new Response(cache.body, { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
});
