/**
 * P5.js sketch: digital threads from participant choices.
 * Nodes from config: countries (left arc), ethnicities (right arc), experiences (inside).
 * Threads animate in slowly; labels fade in/out briefly as thread passes each node.
 */

import {
  loadOptions,
  subscribe,
  loadConfig,
  DEFAULT_OPTIONS,
  DEFAULT_CONFIG,
  threadColorFromCountryEthnicCombo,
} from './state.js';

function resolveVisual(cfg, opts) {
  return {
    threadThickness: cfg.threadThickness ?? opts.threadThickness ?? DEFAULT_CONFIG.threadThickness,
    glow: cfg.glow !== undefined && cfg.glow !== null ? cfg.glow : opts.glow !== false,
    threadStyle: cfg.threadStyle ?? opts.threadStyle ?? DEFAULT_CONFIG.threadStyle,
    density: cfg.density ?? opts.density ?? DEFAULT_CONFIG.density,
    animation: cfg.animation ?? opts.animation ?? DEFAULT_CONFIG.animation,
    animationSpeed: cfg.animationSpeed ?? opts.animationSpeed ?? DEFAULT_CONFIG.animationSpeed,
  };
}

const THREAD_GROW_SPEED = 0.007;
const LABEL_FADE_SPAN = 0.2;
const LABEL_FONT_SIZE = 12;
const LABEL_OFFSET = 14;

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** One path per person: country → experiences (nearest order) → ethnicity. No loops. */
function getThreadPath(nodes, sel) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const country = (sel.countries || [])[0];
  const ethnicity = (sel.ethnicBackgrounds || [])[0];
  const countryNode = country ? byId.get(`countries:${country}`) : null;
  const ethnicityNode = ethnicity ? byId.get(`ethnicBackgrounds:${ethnicity}`) : null;
  if (!countryNode || !ethnicityNode) return [];

  const good = (sel.goodExperiences || []).map((l) => byId.get(`goodExperiences:${l}`)).filter(Boolean);
  const bad = (sel.badExperiences || []).map((l) => byId.get(`badExperiences:${l}`)).filter(Boolean);
  const experiences = [...good, ...bad];

  const path = [countryNode];
  let current = countryNode;
  const remaining = [...experiences];

  while (remaining.length > 0) {
    let best = 0;
    let bestD = dist(current, remaining[0]);
    for (let i = 1; i < remaining.length; i++) {
      const d = dist(current, remaining[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    current = remaining[best];
    path.push(current);
    remaining.splice(best, 1);
  }

  path.push(ethnicityNode);
  return path;
}

function pathKey(path) {
  return path.map((n) => n.id).join('|');
}

function bezierPoint(t, x0, y0, cx, cy, x1, y1) {
  const u = 1 - t;
  const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
  const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
  return { x, y };
}

function labelOpacityAtProgress(progress, atStart) {
  if (atStart) {
    if (progress <= 0) return 0;
    if (progress >= LABEL_FADE_SPAN) return 0;
    const mid = LABEL_FADE_SPAN / 2;
    return progress <= mid ? progress / mid : (LABEL_FADE_SPAN - progress) / mid;
  } else {
    if (progress <= 1 - LABEL_FADE_SPAN) return 0;
    if (progress >= 1) return 0;
    const start = 1 - LABEL_FADE_SPAN;
    const mid = start + LABEL_FADE_SPAN / 2;
    return progress <= mid ? (progress - start) / (mid - start) : (1 - progress) / (1 - mid);
  }
}

function buildNodesFromConfig(config) {
  const nodes = [];
  const push = (group, list, key) => {
    (list || []).forEach((label, i) => {
      nodes.push({ id: `${group}:${label}`, group, label, index: i, total: list.length });
    });
  };
  push('countries', config.countries, 'countries');
  push('ethnicBackgrounds', config.ethnicBackgrounds, 'ethnicBackgrounds');
  push('goodExperiences', config.goodExperiences, 'goodExperiences');
  push('badExperiences', config.badExperiences, 'badExperiences');
  return nodes;
}

function getNodePositions(p, nodes, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const rOuter = Math.min(cx, cy) * 0.42;
  const rInner = Math.min(cx, cy) * 0.28;

  return nodes.map((n) => {
    let angle, r;
    if (n.group === 'countries') {
      const t = n.total > 1 ? n.index / (n.total - 1) : 0.5;
      angle = 0.25 + t * 0.5;
      r = rOuter;
    } else if (n.group === 'ethnicBackgrounds') {
      const t = n.total > 1 ? n.index / (n.total - 1) : 0.5;
      angle = 0.75 + t * 0.5;
      r = rOuter;
    } else if (n.group === 'goodExperiences') {
      const t = n.total > 1 ? n.index / (n.total - 1) : 0.5;
      angle = 0.35 + t * 0.2;
      r = rInner;
    } else {
      const t = n.total > 1 ? n.index / (n.total - 1) : 0.5;
      angle = 0.55 + t * 0.2;
      r = rInner;
    }
    const x = cx + r * Math.cos(angle * Math.PI * 2);
    const y = cy + r * Math.sin(angle * Math.PI * 2);
    return { ...n, x, y };
  });
}

function getSelectedIds(sel) {
  const ids = new Set();
  (sel.countries || []).forEach((l) => ids.add(`countries:${l}`));
  (sel.ethnicBackgrounds || []).forEach((l) => ids.add(`ethnicBackgrounds:${l}`));
  (sel.goodExperiences || []).forEach((l) => ids.add(`goodExperiences:${l}`));
  (sel.badExperiences || []).forEach((l) => ids.add(`badExperiences:${l}`));
  return ids;
}

/**
 * Returns a p5 sketch function for instance mode.
 * @param {string} containerId
 */
export function createThreadSketch(containerId) {
  let options = { ...DEFAULT_OPTIONS };
  let config = loadConfig();
  let unsub = null;
  let nodes = [];
  let pathProgress = 0;
  let lastPathKey = '';
  const submittedProgress = [];
  let vis = resolveVisual(config, options);

  function refreshNodes(p) {
    config = loadConfig();
    const raw = buildNodesFromConfig(config);
    const w = p.width || p.windowWidth || 1920;
    const h = p.height || p.windowHeight || 1080;
    nodes = getNodePositions(p, raw, w, h);
  }

  function getBezierControl(p, a, b) {
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const sag = len * 0.08 * (0.7 + 0.3 * Math.sin(p.frameCount * 0.02));
    return { cx: midX + perpX * sag, cy: midY + perpY * sag };
  }

  function drawThreadPartial(p, a, b, color, progress) {
    const ctx = p.drawingContext;
    const col = color || options.threadColor || '#c49bff';
    const thick = Math.max(1, (vis.threadThickness || 2) * (vis.density ?? 0.6));
    const glow = vis.glow !== false;
    const { cx, cy } = getBezierControl(p, a, b);

    if (glow && ctx) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 18 + thick * 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    p.stroke(col);
    p.strokeWeight(thick);
    p.noFill();

    if (vis.threadStyle === 'dashed' && ctx) ctx.setLineDash([8, 12]);
    else if (ctx) ctx.setLineDash([]);

    const steps = Math.max(2, Math.ceil(progress * 24));
    for (let i = 0; i < steps; i++) {
      const t0 = (i / steps) * progress;
      const t1 = ((i + 1) / steps) * progress;
      const pt0 = bezierPoint(t0, a.x, a.y, cx, cy, b.x, b.y);
      const pt1 = bezierPoint(t1, a.x, a.y, cx, cy, b.x, b.y);
      p.line(pt0.x, pt0.y, pt1.x, pt1.y);
    }

    if (ctx) {
      ctx.setLineDash([]);
      if (glow) ctx.shadowBlur = 0;
    }
  }

  function drawNode(p, n, isSelected, accentColor) {
    const accent = accentColor || options.threadColor || '#c49bff';
    const size = isSelected ? 12 : 6;
    p.noStroke();
    p.fill(isSelected ? accent : 'rgba(255,255,255,0.25)');
    const ctx = p.drawingContext;
    if (vis.glow && isSelected && ctx) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 16;
    }
    p.circle(n.x, n.y, size);
    if (ctx && options.glow) ctx.shadowBlur = 0;
  }

  function drawLabel(p, n, opacity) {
    if (opacity <= 0) return;
    const cy = p.height / 2;
    const ty = n.y < cy ? n.y + LABEL_OFFSET : n.y - LABEL_OFFSET;
    p.textSize(LABEL_FONT_SIZE);
    p.textAlign(p.CENTER, n.y < cy ? p.TOP : p.BOTTOM);
    p.fill(255, 255, 255);
    p.drawingContext.globalAlpha = opacity;
    p.noStroke();
    p.text(n.label, n.x, ty);
    p.drawingContext.globalAlpha = 1;
  }

  return function sketch(p) {
    p.setup = function () {
      const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
      const el = document.getElementById(containerId);
      if (el) cnv.parent(el);
      p.pixelDensity(1);
      p.frameRate(60);
      options = loadOptions();
      config = loadConfig();
      refreshNodes(p);
      vis = resolveVisual(config, options);
      unsub = subscribe((opts) => {
        options = opts;
        vis = resolveVisual(config, options);
        refreshNodes(p);
      });
    };

    p.draw = function () {
      refreshNodes(p);
      vis = resolveVisual(config, options);
      const spd = 0.3 + (vis.animationSpeed ?? 0.5) * 0.4;
      if (vis.animation === 'pulse') {
        const glow = 0.5 + 0.5 * Math.sin(p.frameCount * 0.03 * spd);
        p.background(8, 10, 18, 20 + 8 * glow);
      } else if (vis.animation === 'flow') {
        p.background(8, 10, 18, 18);
      } else {
        p.background(8, 10, 18, 28);
      }
      const submitted = options.submittedThreads || [];
      const sel = options.participantSelections || DEFAULT_OPTIONS.participantSelections;
      const threadColor =
        threadColorFromCountryEthnicCombo(sel, config) || options.threadColor || '#c49bff';
      const selectedIds = getSelectedIds(sel);

      while (submittedProgress.length < submitted.length) submittedProgress.push(0);
      submittedProgress.length = submitted.length;

      const labelOpacity = new Map();

      submitted.forEach((item, idx) => {
        const subPath = getThreadPath(nodes, item.participantSelections || {});
        const col =
          threadColorFromCountryEthnicCombo(item.participantSelections || {}, config) ||
          item.threadColor ||
          threadColor;
        let prog = submittedProgress[idx] ?? 0;
        prog = Math.min(1, prog + THREAD_GROW_SPEED);
        submittedProgress[idx] = prog;

        const numSeg = subPath.length - 1;
        const position = prog * numSeg;
        for (let i = 0; i < numSeg; i++) {
          if (position <= i) continue;
          const segProg = position - i;
          const full = segProg >= 1;
          const partial = full ? 1 : segProg;
          const a = subPath[i];
          const b = subPath[i + 1];
          drawThreadPartial(p, a, b, col, partial);
          const oStart = labelOpacityAtProgress(partial, true);
          const oEnd = labelOpacityAtProgress(partial, false);
          labelOpacity.set(a.id, Math.max(labelOpacity.get(a.id) ?? 0, oStart));
          labelOpacity.set(b.id, Math.max(labelOpacity.get(b.id) ?? 0, oEnd));
        }
      });

      const path = getThreadPath(nodes, sel);
      const key = pathKey(path);
      if (key !== lastPathKey) {
        lastPathKey = key;
        pathProgress = 0;
      }
      if (path.length > 1) {
        pathProgress = Math.min(1, pathProgress + THREAD_GROW_SPEED);
      }

      const numSegments = path.length - 1;
      const position = pathProgress * numSegments;

      for (let i = 0; i < numSegments; i++) {
        const a = path[i];
        const b = path[i + 1];
        if (position <= i) continue;
        const segmentProgress = position - i;
        const full = segmentProgress >= 1;
        const partial = full ? 1 : segmentProgress;
        drawThreadPartial(p, a, b, threadColor, full ? 1 : partial);

        const oStart = labelOpacityAtProgress(partial, true);
        const oEnd = labelOpacityAtProgress(partial, false);
        labelOpacity.set(a.id, Math.max(labelOpacity.get(a.id) ?? 0, oStart));
        labelOpacity.set(b.id, Math.max(labelOpacity.get(b.id) ?? 0, oEnd));
      }

      for (const n of nodes) drawNode(p, n, selectedIds.has(n.id), threadColor);
      labelOpacity.forEach((opacity, nodeId) => {
        const n = nodes.find((nn) => nn.id === nodeId);
        if (n) drawLabel(p, n, opacity);
      });
    };

    p.windowResized = function () {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
      refreshNodes(p);
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
