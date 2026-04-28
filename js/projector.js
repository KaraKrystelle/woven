/**
 * Projector entry: mounts the P5 thread sketch into #projector-canvas.
 * Load p5 via <script> tag, then this module.
 */

import { createThreadSketch } from './thread-sketch.js';
import { initState } from './state.js';

const containerId = 'projector-canvas';
const container = document.getElementById(containerId) || document.body;

initState().finally(() => {
  const sketch = createThreadSketch(containerId);
  new p5(sketch, container);
});
