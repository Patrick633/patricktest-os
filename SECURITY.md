# Security

Life OS is a static web app. There is no Life OS server, and your data is never stored in this repository.

## Where data lives

| Data | Where | Who can read it |
| --- | --- | --- |
| Everything you type in the app | Your browser's `localStorage` on each device | Only that browser |
| Cloud sync (optional) | Your own Supabase project, table `lifeos_state` | Only your signed-in account (row-level security) |
| Browser companion (sites, YouTube titles) | `chrome.storage.local` on your computer | Only the extension and the Life OS page |
| Backups | The file you export / `localStorage` (`lifeos.backups`) | You |

The public repository only contains code. `sync-config.js` holds the Supabase URL and *anon* key, which are designed to be public; access is enforced by the policies in `supabase/schema.sql`.

## Protections

- **Content Security Policy** (`index.html`): only the app's own scripts run. Inline scripts, injected event handlers and `javascript:` links are blocked. Network access is limited to Supabase, Hacker News (Algolia) and DEV.to.
- **Escaping**: all text from you, imports, the cloud, news feeds and the extension is HTML-escaped before display.
- **Input cleaning** (`js/store.js` → `clean` / `repair`): data from storage, file imports, cloud sync and the extension is cleaned before use. Ids, numbers, dates and object keys are validated, prototype-pollution keys are dropped, and broken records are discarded instead of crashing the app.
- **Safe links**: only `http(s)` links from news, video history and the extension can be opened.
- **Imports**: YouTube Takeout HTML is parsed in an inert document, so images and scripts inside the file never load.
- **No framing**: the app refuses to run inside another site's frame (clickjacking).
- **Sync**: sign-in uses one-time email codes; tokens refresh automatically; a sync conflict never silently drops data (the other version becomes a restorable backup).
- **Browser companion**: shares data only with `https://patrick633.github.io/patricktest-os/` and `http://localhost:8000`. It fetches only a fixed list of news feeds. Web pages cannot message it directly.
- **Service worker**: caches only the app's own files and fonts, never API or sync responses.
- **No third-party JavaScript libraries.**

## Recommended Supabase settings

1. After you create your account, turn off **Allow new users to sign up** (Authentication → Sign In / Providers).
2. Keep the email OTP expiry short (Authentication → Emails, default 1 hour is fine).
3. Never put the **service_role** key anywhere in this repository.

## Known limits

- Session tokens for sync live in `localStorage`, like most single-page apps. The Content Security Policy and escaping are what keep scripts from reading them.
- GitHub Pages can't send custom security headers, so the policy is set with a `<meta>` tag (which can't set `frame-ancestors`; the app's own frame check covers that).
- If you use a custom Supabase domain (not `*.supabase.co`), add it to `connect-src` in `index.html`.
