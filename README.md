# Life OS

An **ADHD-friendly personal operating system** for focus, habits, energy and tasks.
Dark "command center" look. It runs entirely in the browser: no build step, no account.

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
- **Review**: weekly stats, estimate accuracy ("things take you 1.4× your estimates") and 3 guided questions.
- **Focus mode**: full-screen shrinking timer, next step, +5 min, generated brown noise, stop and save a note.
- **Settings**: name, sounds, calm mode, desktop alerts, hyperfocus check, when the day ends, export/import, delete all.

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
js/app.js         views, focus mode, modals, events
concepts/         earlier visual explorations (A bento, B dark, C editorial)
```
