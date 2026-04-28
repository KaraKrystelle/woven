# woven

Digital translation of a physical thread installation: **tablet** UI for options → **projector** view with threads connecting according to choices.

## Original prompt

> Start to initialise how I can translate this art installation to P5js, I want them to choose their options on a tablet, which will then translate to the projector that shows the threads being digitally connected according to their options, digitally instead of the physical threads from the art installation.

## Quick start

1. Start the shared server:
   ```bash
   npm start
   ```
   or:
   ```bash
   node server.js
   ```
2. On the main machine, open `http://localhost:3333/admin.html`.
3. On the projector machine/browser, open `http://localhost:3333/projector.html`.
4. On the tablet, open `http://YOUR-COMPUTER-IP:3333/tablet.html` using the same Wi-Fi/network.
5. Set **Style** and **Motion** on **Admin**. On the tablet, make choices and **Submit** to add to the projection; admin, tablet, and projector stay in sync through the shared server.

## Get updates from GitHub

If you already cloned this repo and want the latest changes:

```bash
cd /path/to/woven
git pull
```

That fetches and merges updates from the default remote branch (usually `main`). If you have local edits that conflict, Git will tell you; resolve conflicts or stash changes first (`git stash`) if you only want to pull cleanly.

## Flow

- **Admin** (`admin.html`): categories, style/motion, **Export / Import JSON** (full backup of shared state + config). **`admin-combos.html`** — colour overrides per pair. The server keeps the shared exhibit state in `data/state.json`; browsers also keep a local cache so the UI can still fall back during local prototyping.
- **Tablet:** "Your choices" only — **Submit**, Reset, Open projector. Thread colour: hash by country + ethnic background, or admin override from **Colours by combo**.
- **Projector:** fullscreen P5.js canvas; country → experiences → ethnicity path; threads draw slowly and accumulate. Press **F** for fullscreen.

## Files

- `admin.html` + `js/admin.js` + `style-admin.css` — main admin (categories, style, motion)
- `admin-combos.html` + `js/admin-combos.js` — colour overrides per country + ethnic background pair
- `tablet.html` + `js/tablet.js` — tablet: participant choices only
- `projector.html` + `js/projector.js` + `js/thread-sketch.js` — projector P5 sketch
- `js/state.js` — shared client state layer (server first, local fallback)
- `server.js` — tiny shared server + event stream for admin/tablet/projector sync
- `style-installation.css` — styles for tablet & projector

## Multi-device

Run `server.js` on the main machine, then open the pages from that machine's network IP. Example:

```bash
node server.js
```

- Admin: `http://192.168.1.23:3333/admin.html`
- Tablet: `http://192.168.1.23:3333/tablet.html`
- Projector: `http://192.168.1.23:3333/projector.html`

All three clients connect to the same shared state API and live event stream.
