/**
 * Admin UI: participant categories + projector style/motion (saved in config).
 */

import {
  loadConfig,
  saveConfig,
  DEFAULT_CONFIG,
  buildInstallationBackup,
  applyInstallationBackup,
} from './state.js';

const KEYS = ['countries', 'ethnicBackgrounds', 'goodExperiences', 'badExperiences'];

const VISUAL_IDS = [
  'threadThickness',
  'glow',
  'threadStyle',
  'density',
  'animation',
  'animationSpeed',
];

function $(id) {
  return document.getElementById(id);
}

function applyVisualFromConfig(cfg) {
  const c = { ...DEFAULT_CONFIG, ...cfg };
  const thickness = $('threadThickness');
  const glow = $('glow');
  const style = $('threadStyle');
  const density = $('density');
  const animation = $('animation');
  const speed = $('animationSpeed');
  if (thickness) thickness.value = c.threadThickness ?? 2;
  if (glow) glow.checked = c.glow !== false;
  if (style) style.value = c.threadStyle ?? 'solid';
  if (density) density.value = c.density ?? 0.6;
  if (animation) animation.value = c.animation ?? 'pulse';
  if (speed) speed.value = c.animationSpeed ?? 0.5;
}

function collectVisualFromForm() {
  const thickness = $('threadThickness');
  const glow = $('glow');
  const style = $('threadStyle');
  const density = $('density');
  const animation = $('animation');
  const speed = $('animationSpeed');
  const sp = parseFloat(speed?.value);
  const den = parseFloat(density?.value);
  return {
    threadThickness: thickness?.valueAsNumber ?? DEFAULT_CONFIG.threadThickness,
    glow: glow?.checked ?? DEFAULT_CONFIG.glow,
    threadStyle: style?.value ?? DEFAULT_CONFIG.threadStyle,
    density: Number.isFinite(den) ? den : DEFAULT_CONFIG.density,
    animation: animation?.value ?? DEFAULT_CONFIG.animation,
    animationSpeed: Number.isFinite(sp) ? sp : DEFAULT_CONFIG.animationSpeed,
  };
}

function persistVisual() {
  saveConfig(collectVisualFromForm());
}

function renderList(container, items, key) {
  if (!container) return;
  container.innerHTML = '';
  (items || []).forEach((label, i) => {
    const tag = document.createElement('span');
    tag.className = 'admin-tag';
    tag.textContent = label;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-tag__remove';
    remove.setAttribute('aria-label', 'Remove');
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      const config = loadConfig();
      const list = [...(config[key] || [])];
      list.splice(i, 1);
      saveConfig({ [key]: list });
      renderList(container, list, key);
    });
    tag.appendChild(remove);
    container.appendChild(tag);
  });
}

function addItem(key, inputEl) {
  const val = (inputEl?.value || '').trim();
  if (!val) return;
  const config = loadConfig();
  const list = [...(config[key] || []), val];
  saveConfig({ [key]: list });
  const listEl = document.getElementById(`${key}-list`);
  renderList(listEl, list, key);
  if (inputEl) inputEl.value = '';
}

function init() {
  const config = loadConfig();
  applyVisualFromConfig(config);

  VISUAL_IDS.forEach((id) => {
    const el = $(id);
    if (!el) return;
    const ev = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, persistVisual);
  });

  KEYS.forEach((key) => {
    const listEl = document.getElementById(`${key}-list`);
    const inputEl = document.getElementById(`${key}-input`);
    const btn = document.querySelector(`.admin-btn-add[data-key="${key}"]`);
    renderList(listEl, config[key] || [], key);

    const doAdd = () => addItem(key, inputEl);
    btn?.addEventListener('click', doAdd);
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doAdd();
      }
    });
  });

  const statusEl = $('backupStatus');
  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg || '';
  };

  $('exportBackup')?.addEventListener('click', () => {
    try {
      const payload = buildInstallationBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `woven-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Export downloaded.');
    } catch (e) {
      setStatus(`Export failed: ${e?.message || e}`);
    }
  });

  $('importBackup')?.addEventListener('change', async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setStatus('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm('Replace saved data on this browser with this file? This cannot be undone.')) {
        input.value = '';
        return;
      }
      applyInstallationBackup(data);
      setStatus('Import complete. Reloading…');
      setTimeout(() => location.reload(), 400);
    } catch (err) {
      setStatus(`Import failed: ${err?.message || err}`);
      input.value = '';
    }
  });
}

init();
