/* Life OS — cloud sync (Supabase).
   - Sign in with a 6-digit code sent by email (works inside the iPhone home-screen app).
   - The whole Life OS state is one row per user, protected by row-level security.
   - Changes push a few seconds after you stop editing; the app pulls on open, on focus and every minute.
   - Never loses data silently: if two devices changed things, the newest wins and the other
     version is kept as a backup you can restore (Settings → Sync).
   Talks to Supabase's REST API directly (no extra library). */
window.LOS = window.LOS || {};
(() => {
  "use strict";
  const { store, esc } = window.LOS;
  const CFG_KEY = "lifeos.sync";
  const BK_KEY = "lifeos.backups";
  const LOCAL_ONLY = ["view", "news"]; // per-device UI / cache, never synced

  // ---------------------------------------------------------------- config & session
  const readCfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { return {}; } };
  const setCfg = (patch) => { const c = { ...readCfg(), ...patch }; try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch { /* ignore */ } return c; };
  const conf = () => {
    const g = window.LOS_SYNC_CONFIG || {}, c = readCfg();
    return { url: (g.url || c.url || "").replace(/\/+$/, ""), key: g.anonKey || c.anonKey || "" };
  };
  const configured = () => { const c = conf(); return !!(c.url && c.key); };
  const session = () => readCfg().session || null;
  const signedIn = () => configured() && !!session();
  const deviceName = () => {
    let d = readCfg().device;
    if (!d) {
      const ua = navigator.userAgent;
      d = `${/iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Mac/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : "Device"}-${Math.random().toString(36).slice(2, 6)}`;
      setCfg({ device: d });
    }
    return d;
  };

  const status = { state: "off", error: "", busy: false, codeSentTo: null };
  const app = () => window.LOS.app;
  const refreshUI = () => { if (app()) { app().render(); if (document.querySelector(".modal")) app().renderModal(); } };

  // ---------------------------------------------------------------- HTTP
  const api = async (path, { method = "GET", body, headers = {}, auth = true } = {}) => {
    const c = conf();
    const h = { apikey: c.key, "Content-Type": "application/json", ...headers };
    if (auth && session()) h.Authorization = `Bearer ${session().access_token}`;
    const r = await fetch(c.url + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      const msg = (data && (data.msg || data.message || data.error_description || data.error)) || `HTTP ${r.status}`;
      const err = new Error(msg); err.status = r.status; throw err;
    }
    return data;
  };

  const saveSession = (d) => setCfg({ session: { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, user_id: d.user && d.user.id, email: d.user && d.user.email } });

  const ensureToken = async () => {
    const s = session();
    if (!s) throw new Error("Not signed in");
    if (s.expires_at - Date.now() > 90 * 1000) return;
    try {
      const d = await api("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh_token }, auth: false });
      saveSession({ ...d, user: d.user || { id: s.user_id, email: s.email } });
    } catch (e) {
      if (e.status === 400 || e.status === 401) { setCfg({ session: null }); status.state = "off"; }
      throw e;
    }
  };

  // ---------------------------------------------------------------- auth flow
  const sendCode = async (email) => {
    await api("/auth/v1/otp", { method: "POST", body: { email, create_user: true }, auth: false });
    status.codeSentTo = email;
  };
  const verifyCode = async (email, code) => {
    const d = await api("/auth/v1/verify", { method: "POST", body: { type: "email", email, token: code.trim() }, auth: false });
    saveSession(d);
    status.codeSentTo = null;
    setCfg({ lastRemoteAt: 0, lastPushedAt: 0, firstSync: true });
  };
  const signOut = () => { setCfg({ session: null, lastRemoteAt: 0, lastPushedAt: 0 }); status.state = "off"; };

  // ---------------------------------------------------------------- data
  const strip = (s) => { const o = { ...s }; LOCAL_ONLY.forEach((k) => delete o[k]); return o; };
  const meaningful = (s) => s && s.onboarded && ((s.tasks || []).length || (s.habits || []).length || (s.projects || []).length || ((s.timelog || {}).entries || []).length);

  const backup = (data, reason) => {
    try {
      const list = JSON.parse(localStorage.getItem(BK_KEY) || "[]");
      list.unshift({ at: Date.now(), reason, data });
      localStorage.setItem(BK_KEY, JSON.stringify(list.slice(0, 5)));
    } catch {
      try { // too big for storage: keep just the latest one
        localStorage.setItem(BK_KEY, JSON.stringify([{ at: Date.now(), reason, data }]));
      } catch { /* give up quietly */ }
    }
  };
  const backups = () => { try { return JSON.parse(localStorage.getItem(BK_KEY) || "[]"); } catch { return []; } };

  const pull = async () => {
    const uid = session().user_id;
    const rows = await api(`/rest/v1/lifeos_state?select=data,updated_at,device&user_id=eq.${uid}`);
    return rows && rows[0] ? { data: rows[0].data, at: Date.parse(rows[0].updated_at), device: rows[0].device } : null;
  };
  const push = async () => {
    const st = store.state;
    const at = st._updatedAt || Date.now();
    await api("/rest/v1/lifeos_state?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: { user_id: session().user_id, data: strip(st), updated_at: new Date(at).toISOString(), device: deviceName() },
    });
    // only clear "dirty" if nothing changed while we were uploading
    setCfg({ lastPushedAt: at, lastRemoteAt: at, dirty: (store.state._updatedAt || 0) !== at });
  };
  const applyRemote = (remote) => {
    const keep = {}; LOCAL_ONLY.forEach((k) => { keep[k] = store.state[k]; });
    store.state = store.merge({ ...remote.data, ...keep });
    store.state._updatedAt = remote.at;
    store.write();
    setCfg({ lastRemoteAt: remote.at, lastPushedAt: remote.at, dirty: false });
  };

  /** the heart of it: pull, compare, then push or apply */
  const syncNow = async ({ quiet = true } = {}) => {
    if (!signedIn() || status.busy) return;
    if (!navigator.onLine) { status.state = "offline"; return; }
    status.busy = true; status.state = "syncing"; status.error = "";
    try {
      await ensureToken();
      const remote = await pull();
      const c = readCfg();
      const local = store.state;
      const localAt = local._updatedAt || 0;
      // a flag set on every local save; independent of device clocks
      const localDirty = !!c.dirty;
      const remoteNew = remote && remote.at > (c.lastRemoteAt || 0);

      if (c.firstSync) {
        setCfg({ firstSync: false });
        if (remote && meaningful(remote.data) && meaningful(local) && JSON.stringify(strip(remote.data)) !== JSON.stringify(strip(local))) {
          status.busy = false; status.state = "choose";
          pending = remote;
          app().openModal({ type: "sync-choose" });
          return;
        }
        if (remote && meaningful(remote.data)) { if (meaningful(local)) backup(strip(local), "before first sync"); applyRemote(remote); app().toast("☁️ Your data is here. Synced from the cloud."); }
        else await push();
      } else if (!remote) {
        await push();
      } else if (remoteNew && !localDirty) {
        applyRemote(remote);
        if (!quiet) app().toast("☁️ Updated from your other device");
      } else if (!remoteNew && localDirty) {
        await push();
      } else if (remoteNew && localDirty) {
        // both changed: newest wins, the other is kept as a backup
        if (remote.at >= localAt) { backup(strip(local), "replaced by newer changes from " + (remote.device || "another device")); applyRemote(remote); app().toast("☁️ Synced newer changes from your other device. This device's version was backed up.", { ms: 5000 }); }
        else { backup(remote.data, "older version from " + (remote.device || "another device")); await push(); }
      }
      setCfg({ lastSync: Date.now() });
      status.state = "ok";
    } catch (e) {
      status.state = "error";
      status.error = e.message || String(e);
      if (!quiet) app().toast(`Sync problem: ${esc(status.error)}`);
    } finally {
      status.busy = false;
      refreshUI();
    }
  };
  let pending = null;

  // push a few seconds after the last change
  let pushTimer = null;
  window.LOS.onSave = () => {
    if (!signedIn()) return;
    setCfg({ dirty: true });
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => syncNow(), 3000);
  };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncNow(); });
  window.addEventListener("online", () => syncNow());
  setInterval(() => { if (!document.hidden) syncNow(); }, 60 * 1000);
  setTimeout(() => syncNow(), 800);

  // ---------------------------------------------------------------- UI (Settings section + modals)
  const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)}h ago`; };

  const settingsHTML = () => {
    const s = session();
    const c = readCfg();
    let body;
    if (!configured()) {
      body = `
        <p class="mut" style="font-size:13px;line-height:1.5;margin-bottom:10px">Keep Mac and iPhone in sync and never lose your data. Needs a free Supabase project (see the setup guide). Paste its details here, or put them in <span class="mono">sync-config.js</span> so every device gets them.</p>
        <form class="form-grid" data-form="sync-config">
          <input class="field" name="url" placeholder="Project URL · https://xxxx.supabase.co" required />
          <input class="field" name="anonKey" placeholder="anon public key" required />
          <button class="btn sm primary" style="justify-self:start">Save</button>
        </form>`;
    } else if (!s) {
      body = status.codeSentTo ? `
        <p class="mut" style="font-size:13px;margin-bottom:10px">We emailed a 6-digit code to <b style="color:var(--ink-2)">${esc(status.codeSentTo)}</b>.</p>
        <form class="inline-form" data-form="sync-code" style="margin-top:0">
          <input class="field" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" maxlength="10" required style="letter-spacing:.2em;font-family:var(--mono)" />
          <button class="btn sm primary" ${status.busy ? "disabled" : ""}>Verify</button>
        </form>
        <button class="tagbtn" style="margin-top:8px" data-action="sync-restart">Use a different email</button>`
      : `
        <p class="mut" style="font-size:13px;margin-bottom:10px">Sign in with your email. Use the same email on every device.</p>
        <form class="inline-form" data-form="sync-email" style="margin-top:0">
          <input class="field" type="email" name="email" placeholder="you@email.com" required autocomplete="email" value="${esc(c.lastEmail || "")}" />
          <button class="btn sm primary" ${status.busy ? "disabled" : ""}>Send code</button>
        </form>`;
    } else {
      const label = { ok: "● Synced", syncing: "Syncing…", error: "⚠ Problem", offline: "Offline", off: "Not synced yet", choose: "Waiting for you" }[status.state] || "";
      body = `
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><b style="font-weight:500">${esc(s.email || "Signed in")}</b><br><small class="mut">${label}${c.lastSync ? ` · ${ago(c.lastSync)}` : ""} · this device: ${esc(deviceName())}</small></div>
          <div class="row" style="gap:6px"><button class="btn sm ghost" data-action="sync-now">↻ Sync now</button><button class="btn sm quiet" data-action="sync-signout">Sign out</button></div>
        </div>
        ${status.state === "error" ? `<p style="color:var(--pink);font-size:12px;margin-top:8px">${esc(status.error)}</p>` : ""}`;
    }
    const bks = backups();
    return `
      <div class="set-row" style="display:block">
        <div style="margin-bottom:10px"><b>☁️ Sync across devices</b><small>Mac, iPhone and anywhere else, with the same data</small></div>
        ${body}
        ${status.error && !s ? `<p style="color:var(--pink);font-size:12px;margin-top:8px">${esc(status.error)}</p>` : ""}
        ${bks.length ? `<details class="how"><summary>Backups (${bks.length})</summary>${bks.map((b, i) => `
          <div class="row" style="justify-content:space-between;gap:8px;padding:6px 0"><span style="font-size:12px">${new Date(b.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · <span class="mut">${esc(b.reason)}</span></span>
          <button class="tiny" data-action="sync-restore" data-i="${i}">Restore</button></div>`).join("")}</details>` : ""}
      </div>`;
  };

  const chooseHTML = () => {
    const r = pending;
    const count = (d) => `${(d.tasks || []).length} tasks · ${(d.habits || []).length} habits · ${(d.projects || []).length} projects`;
    return `
      <h2>Which data do you want to keep?</h2>
      <p class="sub">This device and the cloud both have Life OS data. Pick one. The other is saved as a backup, so nothing is lost.</p>
      <div class="mini-list" style="margin-top:16px">
        <button class="mini-item" data-action="sync-use-cloud"><span>☁️</span><span class="t"><b style="font-weight:500">Use the cloud version</b><br><small class="mut">${r ? `from ${esc(r.device || "another device")}, ${ago(r.at)} · ${count(r.data)}` : ""}</small></span></button>
        <button class="mini-item" data-action="sync-use-local"><span>📱</span><span class="t"><b style="font-weight:500">Use this device's version</b><br><small class="mut">${count(store.state)}</small></span></button>
      </div>`;
  };

  const act = (a, el) => {
    if (!a.startsWith("sync-")) return false;
    const A = app();
    switch (a) {
      case "sync-now": syncNow({ quiet: false }); return true;
      case "sync-signout": signOut(); A.toast("Signed out. Data stays on this device."); refreshUI(); return true;
      case "sync-restart": status.codeSentTo = null; refreshUI(); return true;
      case "sync-use-cloud":
        backup(strip(store.state), "this device, before using the cloud version");
        applyRemote(pending); pending = null; status.state = "ok";
        A.closeModal(); A.toast("☁️ Using the cloud version. Your old data is in Backups.");
        return true;
      case "sync-use-local":
        backup(pending.data, "cloud version, replaced by this device");
        pending = null;
        push().then(() => { status.state = "ok"; refreshUI(); }).catch((e) => { status.state = "error"; status.error = e.message; refreshUI(); });
        A.closeModal(); A.toast("☁️ Uploading this device's data. The cloud version is in Backups.");
        return true;
      case "sync-restore": {
        const b = backups()[Number(el.dataset.i)];
        if (!b) return true;
        backup(strip(store.state), "before restoring a backup");
        const keep = {}; LOCAL_ONLY.forEach((k) => { keep[k] = store.state[k]; });
        store.replace({ ...b.data, ...keep }); // save() marks it changed, so it syncs out
        A.closeModal(); A.toast("Backup restored ✓");
        return true;
      }
      default: return false;
    }
  };

  const submit = (form, d) => {
    const A = app();
    const kind = form.dataset.form;
    if (kind === "sync-config") {
      setCfg({ url: d.url.trim(), anonKey: d.anonKey.trim() });
      refreshUI();
      return true;
    }
    if (kind === "sync-email") {
      status.busy = true; status.error = ""; refreshUI();
      setCfg({ lastEmail: d.email.trim() });
      sendCode(d.email.trim())
        .then(() => A.toast("📧 Code sent. Check your email."))
        .catch((e) => { status.error = e.message; })
        .finally(() => { status.busy = false; refreshUI(); document.querySelector('[name="code"]')?.focus(); });
      return true;
    }
    if (kind === "sync-code") {
      status.busy = true; status.error = ""; refreshUI();
      verifyCode(status.codeSentTo, d.code)
        .then(() => { A.toast("✓ Signed in. Syncing…"); status.busy = false; return syncNow({ quiet: false }); })
        .catch((e) => { status.error = e.status === 403 || /expired|invalid/i.test(e.message) ? "That code didn't work or expired. Try again or resend." : e.message; })
        .finally(() => { status.busy = false; refreshUI(); });
      return true;
    }
    return false;
  };

  /** small dot by the logo: lime = synced, pink = problem */
  const dotClass = () => (!signedIn() ? "" : status.state === "error" ? "sync-err" : status.state === "syncing" ? "sync-busy" : "sync-ok");

  window.LOS.sync = { settingsHTML, chooseHTML, act, submit, syncNow, dotClass, signedIn, _status: status };
})();
