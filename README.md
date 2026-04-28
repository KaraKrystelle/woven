# woven

Digital translation of a physical thread installation: **tablet** UI for options → **projector** view with threads connecting according to choices.

## Original prompt

> Start to initialise how I can translate this art installation to P5js, I want them to choose their options on a tablet, which will then translate to the projector that shows the threads being digitally connected according to their options, digitally instead of the physical threads from the art installation.

## Quick start

1. Serve the project over HTTP (ES modules require it):
   ```bash
   python3 -m http.server 3333
   ```
2. **Tablet:** open `http://localhost:3333/tablet.html` on a tablet (or browser tab).
3. **Projector:** open `http://localhost:3333/projector.html` in another tab or on the projector device.
4. Set **Style** and **Motion** on **Admin** if you like. On the tablet, make choices and **Submit** to add to the projection; the projector stays in sync via `localStorage`, cross-tab `storage` events, and `BroadcastChannel` (same origin).

## Get updates from GitHub

If you already cloned this repo and want the latest changes:

```bash
cd /path/to/woven
git pull
```

That fetches and merges updates from the default remote branch (usually `main`). If you have local edits that conflict, Git will tell you; resolve conflicts or stash changes first (`git stash`) if you only want to pull cleanly.

## Flow

- **Admin** (`admin.html`): categories, style/motion, **Export / Import JSON** (full backup of `localStorage` options + config). **`admin-combos.html`** — colour overrides per pair. Data persists in the browser until cleared; export for an off-device copy.
- **Tablet:** "Your choices" only — **Submit**, Reset, Open projector. Thread colour: hash by country + ethnic background, or admin override from **Colours by combo**.
- **Projector:** fullscreen P5.js canvas; country → experiences → ethnicity path; threads draw slowly and accumulate. Press **F** for fullscreen.

## Files

- `admin.html` + `js/admin.js` + `style-admin.css` — main admin (categories, style, motion)
- `admin-combos.html` + `js/admin-combos.js` — colour overrides per country + ethnic background pair
- `tablet.html` + `js/tablet.js` — tablet: participant choices only
- `projector.html` + `js/projector.js` + `js/thread-sketch.js` — projector P5 sketch
- `js/state.js` — shared options + config (localStorage)
- `style-installation.css` — styles for tablet & projector

## Multi-device (tablet + projector on different machines)

Tab sync requires the **same origin** (same URL host/port). For separate physical devices, add a backend (e.g. WebSockets) to push options and config.
