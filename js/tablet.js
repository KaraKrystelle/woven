/**
 * Tablet UI: touch-friendly options that sync to shared state (localStorage).
 * Projector tab listens via storage events and redraws.
 */

import { loadOptions, saveOptions, DEFAULT_OPTIONS } from './state.js';
import { NODES } from './thread-sketch.js';

const ids = {
  nodes: 'nodes',
  threadColor: 'threadColor',
  threadThickness: 'threadThickness',
  glow: 'glow',
  threadStyle: 'threadStyle',
  animation: 'animation',
  animationSpeed: 'animationSpeed',
  density: 'density',
  reset: 'reset',
  openProjector: 'openProjector',
};

function $(id) {
  return document.getElementById(id);
}

function renderNodes(container, selected) {
  const sel = new Set(selected || []);
  container.innerHTML = '';
  for (const n of NODES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tablet-node' + (sel.has(n.id) ? ' tablet-node--on' : '');
    btn.textContent = n.label;
    btn.dataset.id = n.id;
    btn.setAttribute('aria-pressed', sel.has(n.id));
    container.appendChild(btn);
  }
}

function collectOptions() {
  const color = $(ids.threadColor);
  const thickness = $(ids.threadThickness);
  const glow = $(ids.glow);
  const style = $(ids.threadStyle);
  const animation = $(ids.animation);
  const speed = $(ids.animationSpeed);
  const density = $(ids.density);
  const nodesContainer = $(ids.nodes);

  const selectedNodes = [];
  if (nodesContainer) {
    nodesContainer.querySelectorAll('.tablet-node--on').forEach((el) => {
      if (el.dataset.id) selectedNodes.push(el.dataset.id);
    });
  }

  const sp = parseFloat(speed?.value);
  const den = parseFloat(density?.value);
  return {
    threadColor: color?.value ?? DEFAULT_OPTIONS.threadColor,
    threadThickness: thickness?.valueAsNumber ?? DEFAULT_OPTIONS.threadThickness,
    glow: glow?.checked ?? DEFAULT_OPTIONS.glow,
    threadStyle: style?.value ?? DEFAULT_OPTIONS.threadStyle,
    animation: animation?.value ?? DEFAULT_OPTIONS.animation,
    animationSpeed: Number.isFinite(sp) ? sp : DEFAULT_OPTIONS.animationSpeed,
    density: Number.isFinite(den) ? den : DEFAULT_OPTIONS.density,
    selectedNodes,
  };
}

function applyOptions(opts) {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const color = $(ids.threadColor);
  const thickness = $(ids.threadThickness);
  const glow = $(ids.glow);
  const style = $(ids.threadStyle);
  const animation = $(ids.animation);
  const speed = $(ids.animationSpeed);
  const density = $(ids.density);
  const nodesContainer = $(ids.nodes);

  if (color) color.value = o.threadColor ?? '#c49bff';
  if (thickness) thickness.value = o.threadThickness ?? 2;
  if (glow) glow.checked = o.glow !== false;
  if (style) style.value = o.threadStyle ?? 'solid';
  if (animation) animation.value = o.animation ?? 'pulse';
  if (speed) speed.value = o.animationSpeed ?? 0.5;
  if (density) density.value = o.density ?? 0.6;
  if (nodesContainer) renderNodes(nodesContainer, o.selectedNodes || []);
}

function persist() {
  saveOptions(collectOptions());
}

function setupListeners() {
  const nodesContainer = $(ids.nodes);
  if (nodesContainer) {
    nodesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tablet-node');
      if (!btn) return;
      btn.classList.toggle('tablet-node--on');
      btn.setAttribute('aria-pressed', btn.classList.contains('tablet-node--on'));
      persist();
    });
  }

  const inputs = [
    ids.threadColor,
    ids.threadThickness,
    ids.glow,
    ids.threadStyle,
    ids.animation,
    ids.animationSpeed,
    ids.density,
  ];
  for (const id of inputs) {
    const el = $(id);
    if (!el) continue;
    const ev = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, persist);
  }

  const reset = $(ids.reset);
  if (reset) {
    reset.addEventListener('click', () => {
      applyOptions(DEFAULT_OPTIONS);
      persist();
    });
  }
}

function init() {
  applyOptions(loadOptions());
  setupListeners();
}

init();
