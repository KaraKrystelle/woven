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
- These lists are stored in `localStorage` and read by the tablet so the same origin can present the configured options.

---

## Tablet (participant experience)

- When participants approach the exhibit, they use the **tablet**.
- The tablet presents the **four admin-defined categories** (“Your choices”) so participants can make their choices (multi-select within each category).
- The tablet provides **style controls**: thread color, thickness, glow, style (solid/dashed/gradient), and **motion** (animation, speed, density). These affect how the participant’s thread is drawn on the projector.
- The tablet must be **touch-friendly** and include a link to open the projector view (e.g. “Open projector”).
- **Submit:** A **Submit** button adds the current participant’s thread to the projection and then **resets the tablet** (clears choices and resets color) for the next participant. Threads **accumulate** over time; each submission adds one thread to the projection.
- **Reset:** Clears the current participant’s choices and style only; does **not** remove already-submitted threads. Submit requires at least one country and one ethnicity selected.

---

## Projector

- The **projector** displays the digital thread visualization (P5.js canvas).
- **Layout:** Nodes are arranged in a circle. **Countries** sit on one side of the perimeter (left arc), **ethnicities** on the opposite side (right arc). **Good and bad experiences** sit inside the circle.
- **One person, one thread:** Each participant’s thread is a **single path** with no loops: **country → experiences (in nearest order) → ethnicity**. Experiences are ordered by nearest-neighbor from country, then from the last chosen experience.
- **Drawing:** Threads **draw slowly** (animated growth). Each thread uses the participant’s chosen **color**. Submitted threads also animate in when first added; threads that have finished drawing remain fully visible.
- **Labels:** Node labels appear **briefly** (fade in / fade out) only as the thread passes that node during the draw. Labels are centered above or below the node and are relatively small.
- The view supports **fullscreen** (e.g. F key) for installation use.
- The projector updates **live** when the tablet changes (shared state / storage events on the same origin). Multiple threads are shown; each submitted thread is drawn with its stored color and path.

---

## Sync and technical constraints

- **Same machine:** Tablet and projector can run in different tabs; options and submitted threads are synced via `localStorage` and `storage` events.
- **Multi-device:** If the tablet and projector are on different machines, a backend (e.g. WebSockets or sync API) is required to push options and submitted threads from the tablet and have the projector subscribe or poll.
- The app is served over HTTP (ES modules); no build step is required for the current setup.
