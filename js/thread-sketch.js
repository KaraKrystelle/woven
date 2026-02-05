/**
 * P5.js sketch: digital threads between nodes.
 * Reads options from shared state (localStorage) and redraws when they change.
 */

import { loadOptions, subscribe, DEFAULT_OPTIONS } from './state.js';

const NODES = [
  { id: 'self', label: 'Self', angle: 0 },
  { id: 'family', label: 'Family', angle: 0.25 },
  { id: 'work', label: 'Work', angle: 0.5 },
  { id: 'nature', label: 'Nature', angle: 0.75 },
  { id: 'community', label: 'Community', angle: 1 },
  { id: 'creativity', label: 'Creativity', angle: 0.125 },
  { id: 'health', label: 'Health', angle: 0.375 },
  { id: 'learning', label: 'Learning', angle: 0.625 },
  { id: 'place', label: 'Place', angle: 0.875 },
];

/**
 * Returns a p5 sketch function for instance mode.
 * @param {string} containerId
 */
export function createThreadSketch(containerId) {
  let options = { ...DEFAULT_OPTIONS };
  let unsub = null;
  let nodes = [];

  function getNodePositions(p) {
    const w = p.width || p.windowWidth || 1920;
    const h = p.height || p.windowHeight || 1080;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) * 0.38;
    return NODES.map((n) => ({
      ...n,
      x: cx + r * Math.cos(n.angle * Math.PI * 2),
      y: cy + r * Math.sin(n.angle * Math.PI * 2),
    }));
  }

  function getActiveNodes() {
    const active = options.selectedNodes?.length
      ? nodes.filter((n) => options.selectedNodes.includes(n.id))
      : nodes;
    return active;
  }

  function getPairs() {
    const active = getActiveNodes();
    if (active.length < 2) return [];
    if (options.connectionMode === 'custom' && options.connections?.length) {
      return options.connections
        .map(([a, b]) => {
          const na = nodes.find((n) => n.id === a);
          const nb = nodes.find((n) => n.id === b);
          return na && nb ? [na, nb] : null;
        })
        .filter(Boolean);
    }
    const pairs = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        pairs.push([active[i], active[j]]);
      }
    }
    return pairs;
  }

  function drawThread(p, a, b) {
    const ctx = p.drawingContext;
    const color = options.threadColor || '#c49bff';
    const thick = Math.max(1, (options.threadThickness || 2) * (options.density ?? 0.6));
    const glow = options.glow !== false;

    if (glow && ctx) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18 + thick * 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    p.stroke(color);
    p.strokeWeight(thick);
    p.noFill();

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const sag = len * 0.08 * (0.7 + 0.3 * Math.sin(p.frameCount * 0.02));
    const cx = midX + perpX * sag;
    const cy = midY + perpY * sag;

    if (options.threadStyle === 'dashed' && ctx) {
      ctx.setLineDash([8, 12]);
    } else if (ctx) {
      ctx.setLineDash([]);
    }

    if (options.threadStyle === 'gradient') {
      const n = 6;
      const base = p.color(color);
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const x0 = (1 - t0) * (1 - t0) * a.x + 2 * (1 - t0) * t0 * cx + t0 * t0 * b.x;
        const y0 = (1 - t0) * (1 - t0) * a.y + 2 * (1 - t0) * t0 * cy + t0 * t0 * b.y;
        const x1 = (1 - t1) * (1 - t1) * a.x + 2 * (1 - t1) * t1 * cx + t1 * t1 * b.x;
        const y1 = (1 - t1) * (1 - t1) * a.y + 2 * (1 - t1) * t1 * cy + t1 * t1 * b.y;
        const alpha = 80 + 175 * (0.3 + 0.7 * (1 - i / n));
        p.stroke(p.red(base), p.green(base), p.blue(base), alpha);
        p.line(x0, y0, x1, y1);
      }
      p.stroke(color);
    } else {
      p.bezier(a.x, a.y, cx, cy, cx, cy, b.x, b.y);
    }

    if (ctx) {
      ctx.setLineDash([]);
      if (glow) ctx.shadowBlur = 0;
    }
  }

  function drawNode(p, n, isActive) {
    const size = isActive ? 14 : 8;
    p.noStroke();
    p.fill(options.threadColor || '#c49bff');
    const ctx = p.drawingContext;
    if (options.glow && ctx) {
      ctx.shadowColor = options.threadColor || '#c49bff';
      ctx.shadowBlur = isActive ? 24 : 12;
    }
    p.circle(n.x, n.y, size);
    if (ctx && options.glow) ctx.shadowBlur = 0;
  }

  return function sketch(p) {
    p.setup = function () {
      const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
      const el = document.getElementById(containerId);
      if (el) cnv.parent(el);
      p.pixelDensity(1);
      p.frameRate(60);
      options = loadOptions();
      nodes = getNodePositions(p);
      unsub = subscribe((opts) => {
        options = opts;
        nodes = getNodePositions(p);
      });
    };

    p.draw = function () {
      const spd = 0.3 + (options.animationSpeed ?? 0.5) * 0.4;
      if (options.animation === 'pulse') {
        const glow = 0.5 + 0.5 * Math.sin(p.frameCount * 0.03 * spd);
        p.background(8, 10, 18, 20 + 8 * glow);
      } else if (options.animation === 'flow') {
        p.background(8, 10, 18, 18);
      } else {
        p.background(8, 10, 18, 28);
      }

      nodes = getNodePositions(p);
      const active = getActiveNodes();
      const activeIds = new Set(active.map((n) => n.id));
      const pairs = getPairs();

      for (const pair of pairs) drawThread(p, pair[0], pair[1]);
      for (const n of nodes) drawNode(p, n, activeIds.has(n.id));
    };

    p.windowResized = function () {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
      nodes = getNodePositions(p);
    };

    p.keyPressed = function () {
      if (p.key === 'f' || p.key === 'F') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
        return false;
      }
    };
  };
}

export { NODES };
