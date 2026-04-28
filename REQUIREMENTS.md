# Requirements

## Vision

Translate a physical thread-based art installation to a digital one in P5.js: participants choose options on a tablet; a projector shows threads being digitally connected according to those choices (replacing physical threads).

**Original prompt:**

> Start to initialise how I can translate this art installation to P5js, I want them to choose their options on a tablet, which will then translate to the projector that shows the threads being digitally connected according to their options, digitally instead of the physical threads from the art installation.

---

## Admin screen

- An **admin screen** is used to define the content shown to participants at the exhibit.
- The admin defines **four categories**, each as a list of options (add/remove items):
  1. **Countries where you are from**
  2. **Your Ethnic Background**
  3. **Good Experiences**
  4. **Bad Experiences**
- These lists are stored in shared exhibit state on the local server, with browser cache as a fallback during local-only testing.

---

## Tablet (participant experience)

- When participants approach the exhibit, they use the **tablet**.
- The tablet presents the **four admin-defined categories** (“Your choices”) so participants can make their choices (multi-select within each category).
- **Thread colour** is derived from the first selected **country + ethnic background** (same pair → same hue by default). On **`admin-combos.html`**, staff can assign a **fixed colour per pair**; that overrides the automatic hue.
- **Style and motion** for the projector (thickness, glow, thread style, density, background animation, speed) are set on the **admin** screen, not the tablet.
- The tablet must be **touch-friendly** and include a link to open the projector view (e.g. “Open projector”).
- **Submit:** A **Submit** button adds the current participant’s thread to the projection and then **resets the tablet** (clears choices and resets color) for the next participant. Threads **accumulate** over time; each submission adds one thread to the projection.
- **Reset:** Clears the current participant’s choices and style only; does **not** remove already-submitted threads. Submit requires at least one country and one ethnicity selected.

---

## Projector

- The **projector** displays the digital thread visualization (P5.js canvas).
- **Layout:** Nodes are arranged in a circle. **Countries** sit on one side of the perimeter (left arc), **ethnicities** on the opposite side (right arc). **Good and bad experiences** sit inside the circle.
- **One person, one thread:** Each participant’s thread is a **single path** with no loops: **country → experiences (in nearest order) → ethnicity**. Experiences are ordered by nearest-neighbor from country, then from the last chosen experience.
- **Drawing:** Threads **draw slowly** (animated growth). Each thread’s colour comes from **country + ethnic background** (stable hash → hue). Submitted threads also animate in when first added; threads that have finished drawing remain fully visible.
- **Labels:** Node labels appear **briefly** (fade in / fade out) only as the thread passes that node during the draw. Labels are centered above or below the node and are relatively small.
- The view supports **fullscreen** (e.g. F key) for installation use.
- The projector updates **live** when the tablet changes (shared state / storage events on the same origin). Multiple threads are shown; each submitted thread is drawn from its stored selections (colour recomputed from country + ethnicity) and path.

---

## Persistence and backup

- The exhibit uses a small shared server so **admin**, **tablet**, and **projector** on separate devices can all read the same state.
- The server persists session/options and exhibit config in a JSON file on disk. Browsers may also cache the latest state locally for fallback.
- **Admin — Backup & restore:** export a JSON file with both options and config; import replaces the saved exhibit data (with confirmation).

## Sync and technical constraints

- **Same machine:** Admin, tablet, and projector can run in separate tabs and all connect to the same local server.
- **Multi-device:** Tablet and projector can run on different machines/browsers as long as they can reach the host machine over the same network.
- The app is served over HTTP by a lightweight Node server that also provides the shared state API and live event stream; no build step is required for the current setup.
