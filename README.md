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
4. Choose nodes and style on the tablet; the projector updates live via `localStorage` + `storage` events (same machine, different tabs).

## Flow

- **Admin** (`admin.html`): define the four participant categories — Countries where you are from, Your Ethnic Background, Good Experiences, Bad Experiences. Each category is a list of options (add/remove). Stored in `localStorage`; tablet reads this config.
- **Tablet:** shows "Your choices" first (the four admin-defined categories; participants tap to select). Then Connect (nodes), Style, Motion, and "Open projector".
- **Projector:** fullscreen P5.js canvas. Nodes in a circle; threads as bezier curves between selected nodes. Press **F** for fullscreen.

## Files

- `admin.html` + `js/admin.js` + `style-admin.css` — admin: define exhibit options for participants
- `tablet.html` + `js/tablet.js` — tablet controller UI (participant choices + thread controls)
- `projector.html` + `js/projector.js` + `js/thread-sketch.js` — projector P5 sketch
- `js/state.js` — shared options + config (localStorage)
- `style-installation.css` — styles for tablet & projector

## Multi-device (tablet + projector on different machines)

`localStorage` sync only works across tabs on the same origin. For separate devices, you'd add a small backend (e.g. WebSockets or a sync API) and have the tablet push options and the projector poll or subscribe.
