# Capstone Sandbox

## Thread installation (P5.js)

Digital translation of a physical thread installation: **tablet** UI for options → **projector** view with threads connecting according to choices.

### Quick start

1. Serve the project over HTTP (ES modules require it):
   ```bash
   python3 -m http.server 3333
   ```
2. **Tablet:** open `http://localhost:3333/tablet.html` on a tablet (or browser tab).
3. **Projector:** open `http://localhost:3333/projector.html` in another tab or on the projector device.
4. Choose nodes and style on the tablet; the projector updates live via `localStorage` + `storage` events (same machine, different tabs).

### Flow

- **Tablet:** touch-friendly options — which nodes to connect (Self, Family, Work, Nature, etc.), thread color, thickness, glow, style (solid/dashed/gradient), animation (static/pulse/flow), speed, density. “Open projector” opens the fullscreen view in a new tab.
- **Projector:** fullscreen P5.js canvas. Nodes are arranged in a circle; threads are drawn as bezier curves between selected nodes. Press **F** for fullscreen.

### Files

- `tablet.html` + `js/tablet.js` — tablet controller UI
- `projector.html` + `js/projector.js` + `js/thread-sketch.js` — projector P5 sketch
- `js/state.js` — shared options (localStorage sync)
- `style-installation.css` — styles for tablet & projector

### Multi-device (tablet + projector on different machines)`localStorage` sync only works across tabs on the same origin. For separate devices, you’d add a small backend (e.g. WebSockets or a sync API) and have the tablet push options and the projector poll or subscribe.
