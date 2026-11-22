// Life OS · vulnerability alerts (Supabase Edge Function)
// - Scheduled (every 2 hours, header x-cron-secret): checks CISA's Known Exploited Vulnerabilities
//   catalog and sends a push notification to subscribed devices when new entries appear.
// - Signed-in user (Authorization: Bearer <user token>, body {"test": true}): sends a test alert
//   only to that user's own devices.
import webpush from "npm:web-push@3.6.7";

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = ["https://patrick633.github.io", "http://localhost:8000", "http://127.0.0.1:8000"];

webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

// database access with the service key (server only; never sent to browsers)
const db = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`db ${path}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};

type Sub = { endpoint: string; p256dh: string; auth: string; user_id: string };

const send = async (subs: Sub[], payload: Record<string, unknown>) => {
  let sent = 0, removed = 0, failed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 24 * 3600, urgency: "normal" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { // device unsubscribed or app removed
        await db(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" }).catch(() => {});
        removed++;
      } else failed++;
    }
  }));
  return { sent, removed, failed };
};

const checkKev = async () => {
  const r = await fetch(KEV_URL, { headers: { "User-Agent": "LifeOS-Alerts/1.0" } });
  if (!r.ok) throw new Error(`CISA ${r.status}`);
  const j = await r.json();
  const vulns = (j.vulnerabilities || []).sort((a: { dateAdded: string }, b: { dateAdded: string }) => (b.dateAdded || "").localeCompare(a.dateAdded || "")).slice(0, 150);
  const ids: string[] = vulns.map((v: { cveID: string }) => v.cveID);
  const row = (await db("lifeos_meta?key=eq.kev_seen&select=value"))?.[0];
  const seen = new Set<string>(row ? JSON.parse(row.value) : []);
  await db("lifeos_meta?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key: "kev_seen", value: JSON.stringify(ids), updated_at: new Date().toISOString() }) });
  if (!row) return { first_run: true, new: 0 }; // first run: remember, don't alert about old entries
  const fresh = vulns.filter((v: { cveID: string }) => !seen.has(v.cveID));
  if (!fresh.length) return { new: 0 };
  const subs: Sub[] = await db("push_subscriptions?kev=eq.true&select=endpoint,p256dh,auth,user_id");
  const top = fresh.slice(0, 2).map((v: { cveID: string; vendorProject: string; product: string; knownRansomwareCampaignUse: string }) =>
    `${v.cveID} · ${v.vendorProject} ${v.product}${v.knownRansomwareCampaignUse === "Known" ? " (ransomware)" : ""}`).join("\n");
  const result = await send(subs, {
    title: `🛡️ ${fresh.length} new exploited ${fresh.length === 1 ? "vulnerability" : "vulnerabilities"}`,
    body: top + (fresh.length > 2 ? `\n+${fresh.length - 2} more` : ""),
    tag: "kev", url: "./#news",
  });
  return { new: fresh.length, ...result };
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const json = (status: number, obj: unknown) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  try {
    // 1) scheduled run
    const cron = req.headers.get("x-cron-secret");
    if (cron) {
      if (cron !== Deno.env.get("CRON_SECRET")) return json(401, { error: "bad secret" });
      return json(200, await checkKev());
    }
    // 2) signed-in user asking for a test alert on their own devices
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SERVICE, Authorization: `Bearer ${token}` } });
    if (!u.ok) return json(401, { error: "sign in first" });
    const user = await u.json();
    const subs: Sub[] = await db(`push_subscriptions?user_id=eq.${user.id}&select=endpoint,p256dh,auth,user_id`);
    if (!subs.length) return json(200, { sent: 0, note: "no devices subscribed" });
    return json(200, await send(subs, { title: "🛡️ Life OS alerts are on", body: "You'll get a notification when CISA adds newly exploited vulnerabilities.", tag: "kev-test", url: "./#news" }));
  } catch (e) {
    return json(500, { error: String((e as Error).message || e) });
  }
});
