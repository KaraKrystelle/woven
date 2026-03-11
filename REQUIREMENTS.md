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
- These lists are stored (e.g. in `localStorage`) and read by the tablet so the same origin can present the configured options.

---

## Tablet (participant experience)

- When participants approach the exhibit, they use the **tablet**.
- The tablet must present the **four admin-defined categories** so participants can make their choices (e.g. multi-select within each category).
- Participant selections are saved and can drive or complement the thread visualization.
- The tablet also provides **thread controls**: which nodes to connect, style (color, thickness, glow, solid/dashed/gradient), and motion (static/pulse/flow, speed, density). These control how the projector renders the threads.
- The tablet must be **touch-friendly** and support opening or linking to the projector view (e.g. “Open projector”).

---

## Projector

- The **projector** displays the digital thread visualization (P5.js canvas).
- Threads are drawn between nodes according to the options set on the tablet (e.g. selected nodes, style, animation).
- The view should support **fullscreen** (e.g. F key) for installation use.
- The projector updates **live** when the tablet changes options (e.g. via shared state / storage events when on the same origin).

---

## Sync and technical constraints

- **Same machine:** Tablet and projector can run in different tabs; options are synced via shared state (e.g. `localStorage` + `storage` events).
- **Multi-device:** If the tablet and projector are on different machines, a backend (e.g. WebSockets or sync API) is required to push options from the tablet and have the projector subscribe or poll.
- The app is served over HTTP (ES modules); no build step is required for the current setup.
