/**
 * P5.js sketch: digital threads from participant choices.
 * Nodes from config: countries (top band), ethnicities (bottom band), experiences (middle band),
 * each spread by seeded relaxation within the mapped projection aspect.
 * Threads animate in slowly; labels fade in/out briefly as thread passes each node.
 */

import {
  loadOptions,
  subscribeInstallation,
  loadConfig,
  DEFAULT_OPTIONS,
  DEFAULT_CONFIG,
  threadColorFromCountryEthnicCombo,
  PROJECTION_REDRAW_EVENT,
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

const THREAD_GROW_SPEED = 0.0055;
const LABEL_FADE_SPAN = 0.28;
const LABEL_FONT_SIZE = 12;
const LABEL_OFFSET = 14;
const MAP_EDGE_HIT_PX = 30;
const MAP_EDGE_STROKE = 6;
/** Square layout resolution; mapping scales this uniformly into the projection rect. */
const DESIGN_LAYOUT_SIZE = 1000;
const MAPPING_STORAGE_KEY = 'woven-projector-mapping';

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Deterministic [0, 1) from string + salt (FNV-1a style). */
function hash01(str, salt) {
  let h = 2166136261 >>> 0;
  const key = `${salt}\0${str}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 2 ** 32;
}

function clampToRect(x, y, xMin, yMin, xMax, yMax) {
  return {
    x: Math.min(xMax, Math.max(xMin, x)),
    y: Math.min(yMax, Math.max(yMin, y)),
  };
}

/** Deterministic seed inside axis-aligned rectangle (layout space). */
function seedRectFromId(id, xMin, yMin, xMax, yMax) {
  const u = hash01(id, 'rx');
  const v = hash01(id, 'ry');
  return {
    x: xMin + u * (xMax - xMin),
    y: yMin + v * (yMax - yMin),
  };
}

const BAND_RELAX_ITERATIONS = 96;

/**
 * Hash-seeded positions then repulsion for roughly even spacing within a band rectangle.
 * @param {string[]} nodeIds
 */
function relaxNodesInRect(nodeIds, xMin, yMin, xMax, yMax) {
  const ids = [...new Set(nodeIds)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  /** @type {Map<string, { x: number, y: number }>} */
  const pos = new Map();
  const rw = Math.max(1e-6, xMax - xMin);
  const rh = Math.max(1e-6, yMax - yMin);

  for (const id of ids) {
    pos.set(id, seedRectFromId(id, xMin, yMin, xMax, yMax));
  }

  const k = ids.length;
  if (k <= 1) return pos;

  const area = rw * rh;
  const ideal = Math.sqrt(area / k);
  const restDist = Math.min(Math.min(rw, rh) * 0.2, ideal * 1.06);
  const influence = restDist * 2.9;
  const scaleStep = Math.min(rw, rh) * 0.095;

  for (let iter = 0; iter < BAND_RELAX_ITERATIONS; iter++) {
    const phase = iter / Math.max(BAND_RELAX_ITERATIONS - 1, 1);
    const damp = 0.74 * (1 - phase) + 0.26 * phase;
    /** @type {Map<string, { x: number, y: number }>} */
    const next = new Map();

    for (const id of ids) {
      const p = /** @type {{ x: number, y: number }} */ (pos.get(id));
      let fx = 0;
      let fy = 0;

      for (const jid of ids) {
        if (jid === id) continue;
        const q = /** @type {{ x: number, y: number }} */ (pos.get(jid));
        let dx = p.x - q.x;
        let dy = p.y - q.y;
        let d = Math.hypot(dx, dy);

        if (d < 1e-10) {
          const sx = (hash01(id, '|split') - 0.5) * 2;
          const sy = (hash01(jid, '|split') - 0.5) * 2;
          dx = sx || 1e-6;
          dy = sy || 1e-6;
          d = Math.hypot(dx, dy);
        }

        if (d >= influence) continue;

        const overlap = Math.max(0, restDist - d);
        const soft = Math.max(0, influence - d) / influence;
        const mag = (overlap / restDist) ** 2 + soft ** 3 * 0.45;

        fx += (dx / d) * mag;
        fy += (dy / d) * mag;
      }

      const step = scaleStep * damp;
      next.set(id, clampToRect(p.x + fx * step, p.y + fy * step, xMin, yMin, xMax, yMax));
    }

    for (const id of ids) pos.set(id, /** @type {{ x: number, y: number }} */ (next.get(id)));
  }

  return pos;
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

/**
 * Wide-friendly layout: countries in the top band, ethnicities in the bottom band,
 * good/bad experiences in the middle; hash-seeded jitter + repulsion for even spread per band.
 */
function getNodePositionsLayoutSpace(nodes, w, h) {
  const padX = Math.max(2, w * 0.005);
  const padY = Math.max(2, h * 0.004);
  const topFrac = 0.25;
  const botFrac = 0.25;

  const xMin = padX;
  const xMax = w - padX;
  const topY0 = padY;
  let topY1 = h * topFrac - padY * 0.12;
  let botY0 = h * (1 - botFrac) + padY * 0.12;
  const botY1 = h - padY;
  let midY0 = h * topFrac + padY * 0.28;
  let midY1 = h * (1 - botFrac) - padY * 0.28;

  const minMid = Math.min(w, h) * 0.18;
  if (midY1 - midY0 < minMid) {
    const mid = h / 2;
    const half = Math.max(minMid / 2, (midY1 - midY0) / 2 + minMid / 4);
    midY0 = mid - half;
    midY1 = mid + half;
    topY1 = Math.min(topY1, midY0 - padY);
    botY0 = Math.max(botY0, midY1 + padY);
  }

  topY1 = Math.max(topY0 + 2, topY1);
  midY1 = Math.max(midY0 + 2, midY1);
  botY0 = Math.min(botY1 - 2, botY0);

  const countryNodes = nodes.filter((n) => n.group === 'countries');
  const ethnicNodes = nodes.filter((n) => n.group === 'ethnicBackgrounds');
  const expNodes = nodes.filter((n) => n.group === 'goodExperiences' || n.group === 'badExperiences');

  const topMap = relaxNodesInRect(
    countryNodes.map((n) => n.id),
    xMin,
    topY0,
    xMax,
    topY1
  );
  const botMap = relaxNodesInRect(ethnicNodes.map((n) => n.id), xMin, botY0, xMax, botY1);
  const midMap = relaxNodesInRect(expNodes.map((n) => n.id), xMin, midY0, xMax, midY1);

  return nodes.map((n) => {
    let pt = null;
    if (n.group === 'countries') pt = topMap.get(n.id);
    else if (n.group === 'ethnicBackgrounds') pt = botMap.get(n.id);
    else pt = midMap.get(n.id);
    if (!pt) {
      if (n.group === 'countries') pt = seedRectFromId(n.id, xMin, topY0, xMax, topY1);
      else if (n.group === 'ethnicBackgrounds') pt = seedRectFromId(n.id, xMin, botY0, xMax, botY1);
      else pt = seedRectFromId(n.id, xMin, midY0, xMax, midY1);
    }
    return { ...n, x: pt.x, y: pt.y };
  });
}

function layoutBounds(layoutNodes, fallbackW, fallbackH) {
  if (!layoutNodes.length) {
    const fw = fallbackW ?? DESIGN_LAYOUT_SIZE;
    const fh = fallbackH ?? DESIGN_LAYOUT_SIZE;
    return { minX: 0, minY: 0, maxX: fw, maxY: fh };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of layoutNodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  }
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const pad = span * 0.015;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

/** Map layout-space nodes into pixel rect (pw, ph) using uniform scale (geometry preserved). */
function mapLayoutToPixels(layoutNodes, bounds, pw, ph, px0, py0) {
  const bw = bounds.maxX - bounds.minX || 1;
  const bh = bounds.maxY - bounds.minY || 1;
  const scale = Math.min(pw / bw, ph / bh);
  const ox = px0 + (pw - scale * bw) / 2 - scale * bounds.minX;
  const oy = py0 + (ph - scale * bh) / 2 - scale * bounds.minY;
  return layoutNodes.map((n) => ({
    ...n,
    x: ox + scale * n.x,
    y: oy + scale * n.y,
  }));
}

function clampMapping(m, minSpan = 0.05) {
  let l = Math.max(0, Math.min(1, m.l));
  let t = Math.max(0, Math.min(1, m.t));
  let r = Math.max(0, Math.min(1, m.r));
  let b = Math.max(0, Math.min(1, m.b));
  if (r <= l) r = Math.min(1, l + minSpan);
  if (b <= t) b = Math.min(1, t + minSpan);
  if (r - l < minSpan) {
    const mid = (l + r) / 2;
    l = Math.max(0, mid - minSpan / 2);
    r = Math.min(1, l + minSpan);
    l = Math.max(0, r - minSpan);
  }
  if (b - t < minSpan) {
    const mid = (t + b) / 2;
    t = Math.max(0, mid - minSpan / 2);
    b = Math.min(1, t + minSpan);
    t = Math.max(0, b - minSpan);
  }
  return { l, t, r, b };
}

function loadMappingRect() {
  try {
    const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
    if (!raw) return { l: 0, t: 0, r: 1, b: 1 };
    const o = JSON.parse(raw);
    return clampMapping({
      l: Number(o.l) || 0,
      t: Number(o.t) || 0,
      r: o.r !== undefined && o.r !== null ? Number(o.r) : 1,
      b: o.b !== undefined && o.b !== null ? Number(o.b) : 1,
    });
  } catch (_) {
    return { l: 0, t: 0, r: 1, b: 1 };
  }
}

function saveMappingRect(m) {
  try {
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(clampMapping(m)));
  } catch (_) {}
}

function pixelRectFromMapping(p, mapNorm) {
  const w = p.width;
  const h = p.height;
  return {
    x: mapNorm.l * w,
    y: mapNorm.t * h,
    w: (mapNorm.r - mapNorm.l) * w,
    h: (mapNorm.b - mapNorm.t) * h,
  };
}

/** @returns {'left'|'right'|'top'|'bottom'|null} */
function pickProjectionEdge(mx, my, pr, tol) {
  const { x, y, w, h } = pr;
  /** @type {Array<[string, number]>} */
  const candidates = [];
  const dL = Math.abs(mx - x);
  if (dL <= tol && my >= y - tol && my <= y + h + tol) candidates.push(['left', dL]);
  const dR = Math.abs(mx - (x + w));
  if (dR <= tol && my >= y - tol && my <= y + h + tol) candidates.push(['right', dR]);
  const dT = Math.abs(my - y);
  if (dT <= tol && mx >= x - tol && mx <= x + w + tol) candidates.push(['top', dT]);
  const dB = Math.abs(my - (y + h));
  if (dB <= tol && mx >= x - tol && mx <= x + w + tol) candidates.push(['bottom', dB]);
  if (!candidates.length) return null;
  candidates.sort((a, b) => a[1] - b[1]);
  return /** @type {'left'|'right'|'top'|'bottom'} */ (candidates[0][0]);
}

function drawMappingEditOverlay(p, pr) {
  const W = p.width;
  const H = p.height;
  p.push();
  p.fill(0, 0, 0, 110);
  p.noStroke();
  p.rect(0, 0, W, pr.y);
  p.rect(0, pr.y + pr.h, W, Math.max(0, H - pr.y - pr.h));
  p.rect(0, pr.y, pr.x, pr.h);
  p.rect(pr.x + pr.w, pr.y, Math.max(0, W - pr.x - pr.w), pr.h);
  p.noFill();
  p.stroke(255);
  p.strokeWeight(MAP_EDGE_STROKE);
  p.rect(pr.x, pr.y, pr.w, pr.h);
  p.pop();
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
  let nodeById = new Map();
  let pathProgress = 0;
  let lastPathKey = '';
  const submittedProgress = [];
  const submittedCache = [];
  let vis = resolveVisual(config, options);
  let nodesVersion = 0;
  let nodesDirty = true;
  let layerDirty = true;
  let completedLayer = null;
  let lastConfigSnapshot = JSON.stringify(config);
  let lastSubmittedSnapshot = JSON.stringify(options.submittedThreads || []);
  let debugMode = false;
  let mappingEditMode = false;
  let mappingNorm = loadMappingRect();
  /** Vertical center of projection area (for label placement). */
  let projectionMidY = 0;
  /** @type {'left'|'right'|'top'|'bottom'|null} */
  let dragEdge = null;
  /** Opaque clears for a few frames after admin “redraw” to drop translucent trail buildup. */
  let solidBackgroundFramesRemaining = 0;

  function syncProjectorDebugChrome() {
    document.body.classList.toggle('projector-debug', debugMode);
    const help = document.querySelector('.projector-help');
    if (help) help.setAttribute('aria-hidden', debugMode ? 'false' : 'true');
  }

  function markLayerDirty() {
    layerDirty = true;
  }

  /** Full visual refresh after mapping rectangle changes (paths + raster cache use node coords). */
  function invalidateAfterMappingEdit() {
    nodesDirty = true;
    layerDirty = true;
    submittedCache.length = 0;
    pathProgress = 0;
    lastPathKey = '';
    if (completedLayer) {
      completedLayer.clear();
    }
  }

  function forceFullProjectionRedraw() {
    invalidateAfterMappingEdit();
    solidBackgroundFramesRemaining = 4;
  }

  function refreshNodes(p) {
    if (!nodesDirty) return;
    const raw = buildNodesFromConfig(config);
    const pr = pixelRectFromMapping(p, mappingNorm);
    const lw = Math.max(1, pr.w);
    const lh = Math.max(1, pr.h);
    const layoutNodes = getNodePositionsLayoutSpace(raw, lw, lh);
    const bounds = layoutBounds(layoutNodes, lw, lh);
    nodes = mapLayoutToPixels(layoutNodes, bounds, pr.w, pr.h, pr.x, pr.y);
    projectionMidY = pr.y + pr.h / 2;
    nodeById = new Map(nodes.map((n) => [n.id, n]));
    nodesVersion += 1;
    nodesDirty = false;
    markLayerDirty();
  }

  function getBezierControl(a, b) {
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const sag = len * 0.08;
    return { cx: midX + perpX * sag, cy: midY + perpY * sag };
  }

  function drawThreadPartial(target, a, b, color, progress, p) {
    const ctx = target.drawingContext;
    const col = color || options.threadColor || '#c49bff';
    const thick = Math.max(1, (vis.threadThickness || 2) * (vis.density ?? 0.6));
    const glow = vis.glow !== false;
    const { cx, cy } = getBezierControl(a, b);

    if (glow && ctx) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 3 + thick * 2.2;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    target.stroke(col);
    target.strokeWeight(thick);
    target.noFill();

    if (vis.threadStyle === 'dashed' && ctx) ctx.setLineDash([8, 12]);
    else if (ctx) ctx.setLineDash([]);

    const steps = Math.max(2, Math.ceil(progress * 24));
    for (let i = 0; i < steps; i++) {
      const t0 = (i / steps) * progress;
      const t1 = ((i + 1) / steps) * progress;
      const pt0 = bezierPoint(t0, a.x, a.y, cx, cy, b.x, b.y);
      const pt1 = bezierPoint(t1, a.x, a.y, cx, cy, b.x, b.y);
      target.line(pt0.x, pt0.y, pt1.x, pt1.y);
    }

    if (ctx) {
      ctx.setLineDash([]);
      if (glow) ctx.shadowBlur = 0;
    }
  }

  function getCachedPath(sel) {
    const country = (sel.countries || [])[0];
    const ethnicity = (sel.ethnicBackgrounds || [])[0];
    const countryNode = country ? nodeById.get(`countries:${country}`) : null;
    const ethnicityNode = ethnicity ? nodeById.get(`ethnicBackgrounds:${ethnicity}`) : null;
    if (!countryNode || !ethnicityNode) return [];

    const good = (sel.goodExperiences || [])
      .map((l) => nodeById.get(`goodExperiences:${l}`))
      .filter(Boolean);
    const bad = (sel.badExperiences || [])
      .map((l) => nodeById.get(`badExperiences:${l}`))
      .filter(Boolean);
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

  function getSubmittedEntry(item, idx) {
    const sel = item.participantSelections || {};
    const key = JSON.stringify(sel);
    const cached = submittedCache[idx];
    if (cached && cached.key === key && cached.nodesVersion === nodesVersion) return cached;
    const entry = {
      key,
      nodesVersion,
      path: getCachedPath(sel),
    };
    submittedCache[idx] = entry;
    return entry;
  }

  function ensureCompletedLayer(p) {
    if (!completedLayer) {
      completedLayer = p.createGraphics(p.width, p.height);
      completedLayer.pixelDensity(1);
      markLayerDirty();
      return;
    }
    if (completedLayer.width !== p.width || completedLayer.height !== p.height) {
      completedLayer.resizeCanvas(p.width, p.height);
      markLayerDirty();
    }
  }

  function redrawCompletedLayer(p, submitted, currentThreadColor) {
    ensureCompletedLayer(p);
    if (!completedLayer || !layerDirty) return;
    completedLayer.clear();
    submitted.forEach((item, idx) => {
      if ((submittedProgress[idx] ?? 0) < 1) return;
      const entry = getSubmittedEntry(item, idx);
      const col =
        threadColorFromCountryEthnicCombo(item.participantSelections || {}, config) ||
        item.threadColor ||
        currentThreadColor;
      const numSeg = entry.path.length - 1;
      for (let i = 0; i < numSeg; i++) {
        drawThreadPartial(completedLayer, entry.path[i], entry.path[i + 1], col, 1, p);
      }
    });
    layerDirty = false;
  }

  function drawNode(p, n, isSelected, accentColor) {
    const accent = accentColor || options.threadColor || '#c49bff';
    const size = isSelected ? 12 : 6;
    const thick = Math.max(1, (vis.threadThickness || 2) * (vis.density ?? 0.6));
    p.noStroke();
    p.fill(isSelected ? accent : 'rgba(255,255,255,0.25)');
    const ctx = p.drawingContext;
    if (vis.glow && isSelected && ctx) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = Math.min(12, 3 + thick * 1.6);
    }
    p.circle(n.x, n.y, size);
    if (ctx && vis.glow) ctx.shadowBlur = 0;
  }

  function drawLabel(p, n, opacity, midY) {
    if (opacity <= 0) return;
    const cyRef = midY ?? p.height / 2;
    const ty = n.y < cyRef ? n.y + LABEL_OFFSET : n.y - LABEL_OFFSET;
    p.textSize(LABEL_FONT_SIZE);
    p.textAlign(p.CENTER, n.y < cyRef ? p.TOP : p.BOTTOM);
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
      unsub = subscribeInstallation(() => {
        const nextOptions = loadOptions();
        const nextConfig = loadConfig();
        const configChanged = JSON.stringify(nextConfig) !== lastConfigSnapshot;
        const submittedChanged =
          JSON.stringify(nextOptions.submittedThreads || []) !== lastSubmittedSnapshot;

        options = nextOptions;
        config = nextConfig;
        lastConfigSnapshot = JSON.stringify(config);
        lastSubmittedSnapshot = JSON.stringify(options.submittedThreads || []);
        vis = resolveVisual(config, options);
        if (configChanged) nodesDirty = true;
        if (configChanged || submittedChanged) markLayerDirty();
      });
      const onProjectionRedraw = () => forceFullProjectionRedraw();
      window.addEventListener(PROJECTION_REDRAW_EVENT, onProjectionRedraw);
      syncProjectorDebugChrome();
    };

    p.draw = function () {
      refreshNodes(p);
      vis = resolveVisual(config, options);
      const spd = 0.3 + (vis.animationSpeed ?? 0.5) * 0.4;
      if (solidBackgroundFramesRemaining > 0) {
        p.background(8, 10, 18);
        solidBackgroundFramesRemaining -= 1;
      } else if (vis.animation === 'pulse') {
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
      submittedCache.length = submitted.length;

      redrawCompletedLayer(p, submitted, threadColor);
      if (completedLayer) p.image(completedLayer, 0, 0, p.width, p.height);

      const labelOpacity = new Map();

      submitted.forEach((item, idx) => {
        const entry = getSubmittedEntry(item, idx);
        const subPath = entry.path;
        const col =
          threadColorFromCountryEthnicCombo(item.participantSelections || {}, config) ||
          item.threadColor ||
          threadColor;
        let prog = submittedProgress[idx] ?? 0;
        prog = Math.min(1, prog + THREAD_GROW_SPEED);
        const wasComplete = (submittedProgress[idx] ?? 0) >= 1;
        submittedProgress[idx] = prog;
        if (!wasComplete && prog >= 1) markLayerDirty();
        if (prog >= 1) return;

        const numSeg = subPath.length - 1;
        const position = prog * numSeg;
        for (let i = 0; i < numSeg; i++) {
          if (position <= i) continue;
          const segProg = position - i;
          const full = segProg >= 1;
          const partial = full ? 1 : segProg;
          const a = subPath[i];
          const b = subPath[i + 1];
          drawThreadPartial(p, a, b, col, partial, p);
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
        drawThreadPartial(p, a, b, threadColor, full ? 1 : partial, p);

        const oStart = labelOpacityAtProgress(partial, true);
        const oEnd = labelOpacityAtProgress(partial, false);
        labelOpacity.set(a.id, Math.max(labelOpacity.get(a.id) ?? 0, oStart));
        labelOpacity.set(b.id, Math.max(labelOpacity.get(b.id) ?? 0, oEnd));
      }

      for (const n of nodes) drawNode(p, n, selectedIds.has(n.id), threadColor);
      labelOpacity.forEach((opacity, nodeId) => {
        const n = nodes.find((nn) => nn.id === nodeId);
        if (n) drawLabel(p, n, opacity, projectionMidY);
      });

      if (debugMode && mappingEditMode) {
        drawMappingEditOverlay(p, pixelRectFromMapping(p, mappingNorm));
      }
      if (debugMode) {
        p.push();
        p.fill(200, 230, 255);
        p.noStroke();
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(13);
        const mo = mappingNorm;
        const lines = [
          'Debug ON — D hide · F fullscreen',
          `FPS ~${p.frameRate().toFixed(0)}`,
          `Map L ${mo.l.toFixed(3)} T ${mo.t.toFixed(3)} R ${mo.r.toFixed(3)} B ${mo.b.toFixed(3)}`,
          mappingEditMode ? 'Mapping edit ON — M off · drag edges · arrows move rect' : 'M — mapping edit',
        ];
        let ly = 10;
        for (const line of lines) {
          p.text(line, 12, ly);
          ly += 18;
        }
        p.pop();
      }
    };

    p.mousePressed = function () {
      if (!debugMode || !mappingEditMode) return;
      const pr = pixelRectFromMapping(p, mappingNorm);
      dragEdge = pickProjectionEdge(p.mouseX, p.mouseY, pr, MAP_EDGE_HIT_PX);
    };

    p.mouseReleased = function () {
      const hadDrag = !!dragEdge;
      if (dragEdge) saveMappingRect(mappingNorm);
      dragEdge = null;
      if (hadDrag) invalidateAfterMappingEdit();
    };

    p.mouseDragged = function () {
      if (!mappingEditMode || !dragEdge) return;
      const dx = (p.mouseX - p.pmouseX) / p.width;
      const dy = (p.mouseY - p.pmouseY) / p.height;
      const m = { ...mappingNorm };
      if (dragEdge === 'left') m.l += dx;
      if (dragEdge === 'right') m.r += dx;
      if (dragEdge === 'top') m.t += dy;
      if (dragEdge === 'bottom') m.b += dy;
      mappingNorm = clampMapping(m);
      nodesDirty = true;
      markLayerDirty();
    };

    p.windowResized = function () {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
      nodesDirty = true;
      refreshNodes(p);
    };

    p.keyPressed = function () {
      if (p.key === 'f' || p.key === 'F') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
        return false;
      }
      if (p.key === 'd' || p.key === 'D') {
        debugMode = !debugMode;
        if (!debugMode) {
          mappingEditMode = false;
          dragEdge = null;
        }
        syncProjectorDebugChrome();
        return false;
      }
      if ((p.key === 'm' || p.key === 'M') && debugMode) {
        const wasEditing = mappingEditMode;
        mappingEditMode = !mappingEditMode;
        if (!mappingEditMode) dragEdge = null;
        if (wasEditing && !mappingEditMode) invalidateAfterMappingEdit();
        return false;
      }
      if (debugMode && mappingEditMode) {
        let dh = 0;
        let dv = 0;
        if (p.keyCode === p.LEFT_ARROW) dh = -1;
        else if (p.keyCode === p.RIGHT_ARROW) dh = 1;
        else if (p.keyCode === p.UP_ARROW) dv = -1;
        else if (p.keyCode === p.DOWN_ARROW) dv = 1;
        if (dh !== 0 || dv !== 0) {
          const stepX = 4 / Math.max(1, p.width);
          const stepY = 4 / Math.max(1, p.height);
          const m = { ...mappingNorm };
          m.l += dh * stepX;
          m.r += dh * stepX;
          m.t += dv * stepY;
          m.b += dv * stepY;
          mappingNorm = clampMapping(m);
          invalidateAfterMappingEdit();
          saveMappingRect(mappingNorm);
          return false;
        }
      }
    };
  };
}
