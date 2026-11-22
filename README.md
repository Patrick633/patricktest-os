# Life OS

An **ADHD-friendly personal operating system** for focus, habits, energy and tasks.
Dark "command center" look, with a warm off-white Morning theme. It runs entirely in the browser: no build step, no account.

## Design principles

| Problem | What Life OS does |
| --- | --- |
| Overwhelm from busy dashboards | **Now** screen shows *one* task, its next tiny step and one big button. |
| Too many priorities | Max **3 priorities per day**; add a 4th only after finishing or dropping one. |
| Hard to start | **Just 5 minutes** timer and an **I'm stuck** helper that breaks tasks into tiny steps, with suggestions. |
| Losing context | **Where I left off** note on every task, asked again when a focus session ends. |
| Time blindness | Shrinking **visual timers**, a "time left today" bar, time blocks with a *now* line, and "in 40 min" labels. |
| Hyperfocus | Gentle **hyperfocus check** after 90 min (configurable). |
| Guilt and shame | No streaks that reset, no red "overdue". **Whenever** list, **Reset my day** and "Not now" without penalty. Habits count as "5 of last 7 days". |
| Low-energy days | Energy check-in suggests tasks that fit. Every habit has a **mini version** that still counts. |
| Racing thoughts | **Quick capture** everywhere (`⌘K`, `Ctrl+K` or `/`) plus a brain dump that sends one item per line to the Inbox. |
| Motivation | Immediate rewards: chime, confetti and occasional surprise bonuses. Win counter focused on what *was* done. |
| Sensory load | **Calm mode** (no animations or confetti), sounds toggle, colour-coded areas. |

## Screens

- **Now**: the single current task, next tiny step, focus timer, top 3, energy-fit suggestions, next time block, wins.
- **Today**: plan progress, top 3, time blocks with a now line, habits (full/mini), energy suggestions.
- **Inbox**: Inbox / Ready / Whenever / Done lists, energy filter, one-tap tags (area, energy, time estimate), brain dump.
- **Habits**: full or mini check-ins, 7-day row, 26-week consistency heatmap.
- **Check-in**: mood and energy, notes, 30-day chart and an insight.
- **Time log** ("Doing now"): one tap to say what you're doing (work, quality time with your wife, church, commute, rest…). Switching closes the previous activity. Log things afterwards, edit times, and rename, re-emoji or remove any activity. Today shows a day bar and totals by category, Wins shows "Also today…", Review shows where your week went, and a time block happening now gets a ▶ Track button.
- **Projects**: long goals (e.g. a 6-month study plan) split into phases on a timeline. Only the current phase is open; steps go to Today with one tap and get checked off when you finish the task. Shows progress vs time elapsed and weekly study hours.
- **Spirit**: verse of the day (KJV or Almeida ARC) or stoic/mindful reflections, Bible reading plans that move forward when you read (never by the calendar), gratitude, prayer list with answered prayers, quiet-time timer.
- **News**: a 5-minute cybersecurity brief. Hacker News and DEV.to work directly; The Hacker News, BleepingComputer, Krebs on Security, SecurityWeek, Dark Reading and CISA's actively exploited vulnerabilities come through the browser companion.
- **Screen**: screen time and video history, without judgment (see below).
- **Review**: weekly stats, estimate accuracy ("things take you 1.4× your estimates") and 3 guided questions.
- **Focus mode**: full-screen shrinking timer, next step, +5 min, generated brown noise, stop and save a note.
- **Themes**: 🌙 Night (dark), ☀️ Morning (warm off-white) or 🌗 Auto (Morning 6:00–17:59). Toggle from the top bar or Settings.
- **Settings**: name, theme, sounds, calm mode, desktop alerts, hyperfocus check, when the day ends, export/import, delete all.

## Screen time & videos (Mac + iPhone)

Apple doesn't let apps (let alone websites) read Screen Time, and YouTube/Netflix have no API for watch history, so Life OS combines three sources:

1. **Daily log (10 sec)**: type your iPhone and Mac totals from *Settings → Screen Time* in **Screen** or **Check-in**. After 7pm the Now screen reminds you once.
2. **Import history**: YouTube via Google Takeout (`watch-history.json` or `.html`, English or Portuguese) and Netflix (`ViewingActivity.csv` with real durations, or the simple viewing-history CSV). Re-importing never duplicates. YouTube durations are estimated from the gap between videos.
3. **Browser companion** (`extension/`, for Chrome, Arc, Brave or Edge on the Mac): counts time on the active tab per site (paused when idle or unfocused) and saves YouTube titles. Life OS syncs with it automatically while open.

The Screen tab shows a 14-day chart (iPhone, Mac/browser, videos), an optional soft limit, a 24-hour "when you watch" chart, top channels and shows, a list of watched videos, and insights such as screen time vs. wins, late-night videos vs. next-morning energy, and YouTube rabbit holes (5+ videos back to back).

### Install the browser companion

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension` folder.
3. Open Life OS at `http://localhost:8000` (see below). If you open `index.html` directly, enable **Allow access to file URLs** in the extension's details.

## iPhone, sync and notifications

- **Install on iPhone**: published with GitHub Pages, then Safari → Share → *Add to Home Screen*. Works offline (service worker).
- **Cloud sync** (Supabase, free): sign in with a 6-digit email code on each device. Changes upload a few seconds after you stop editing; the app pulls on open, on focus and every minute. If two devices changed things, the newest wins and the other version is kept as a restorable backup.
- **Notifications**: timer end, hyperfocus check and quiet time (iOS 16.4+, home-screen app).
- **Reminders through Calendar**: daily/weekly reminders and time blocks export as `.ics`, so they ring even with the app closed.

Step-by-step setup (Portuguese): [`docs/SETUP-IPHONE.md`](docs/SETUP-IPHONE.md). Database script: [`supabase/schema.sql`](supabase/schema.sql).

See [`SECURITY.md`](SECURITY.md) for where data lives and how the app is protected.

## Run

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Data is stored in this browser's `localStorage` (key `lifeos.v2`). Use **Settings → Export** to back it up.

## Structure

```
index.html        app shell
css/style.css     design tokens + components (dark theme)
js/store.js       state, persistence, selectors, date helpers
js/fx.js          chime, brown noise, confetti
js/timelog.js     time log: doing now, day bar, totals, editable activities
js/projects.js    projects: phases, timeline, steps, study hours
js/spirit.js      verse/reflection, reading plans, gratitude, prayer, quiet time
js/news.js        cybersecurity news brief and CISA KEV
js/screen.js      screen time: log, Takeout/Netflix import, extension bridge, insights
js/sync.js        cloud sync (Supabase REST, email-code login, backups)
js/calendar.js    .ics reminders and time blocks for the phone's Calendar
js/app.js         views, focus mode, modals, events
sw.js             service worker: offline, notifications, push
sync-config.js    Supabase URL + anon key (public by design)
extension/        Life OS Companion browser extension (Manifest V3)
concepts/         earlier visual explorations (A bento, B dark, C editorial)
```
