/**
 * Tablet UI: touch-friendly options that sync to shared state (localStorage).
 * Shows admin-defined participant categories (countries, ethnic background, experiences).
 * Projector tab listens via storage events and redraws.
 */

import { loadOptions, saveOptions, loadConfig, DEFAULT_OPTIONS } from './state.js';

const PARTICIPANT_KEYS = [
  { key: 'countries', label: 'Countries where you are from' },
  { key: 'ethnicBackgrounds', label: 'Your Ethnic Background' },
  { key: 'goodExperiences', label: 'Good Experiences' },
  { key: 'badExperiences', label: 'Bad Experiences' },
];

const ids = {
  participantCategories: 'participant-categories',
  threadColor: 'threadColor',
  threadThickness: 'threadThickness',
  glow: 'glow',
  threadStyle: 'threadStyle',
  animation: 'animation',
  animationSpeed: 'animationSpeed',
  density: 'density',
  reset: 'reset',
  submit: 'submit',
  openProjector: 'openProjector',
};

function $(id) {
  return document.getElementById(id);
}

function renderParticipantCategories(container, config, selected) {
  if (!container) return;
  container.innerHTML = '';
  const sel = selected || DEFAULT_OPTIONS.participantSelections;
  for (const { key, label } of PARTICIPANT_KEYS) {
    const options = config[key] || [];
    if (options.length === 0) continue;
    const set = new Set(sel[key] || []);
    const section = document.createElement('div');
    section.className = 'tablet-participant-section';
    const title = document.createElement('h3');
    title.className = 'tablet-participant-title';
    title.textContent = label;
    section.appendChild(title);
    const wrap = document.createElement('div');
    wrap.className = 'tablet-nodes';
    wrap.setAttribute('data-category', key);
    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tablet-node' + (set.has(opt) ? ' tablet-node--on' : '');
      btn.textContent = opt;
      btn.dataset.category = key;
      btn.dataset.option = opt;
      btn.setAttribute('aria-pressed', set.has(opt));
      wrap.appendChild(btn);
    });
    section.appendChild(wrap);
    container.appendChild(section);
  }
}

function collectParticipantSelections() {
  const container = $(ids.participantCategories);
  const out = { countries: [], ethnicBackgrounds: [], goodExperiences: [], badExperiences: [] };
  if (!container) return out;
  container.querySelectorAll('.tablet-node--on[data-category][data-option]').forEach((el) => {
    const cat = el.dataset.category;
    const opt = el.dataset.option;
    if (cat && out[cat] && opt) out[cat].push(opt);
  });
  return out;
}

function collectOptions() {
  const color = $(ids.threadColor);
  const thickness = $(ids.threadThickness);
  const glow = $(ids.glow);
  const style = $(ids.threadStyle);
  const animation = $(ids.animation);
  const speed = $(ids.animationSpeed);
  const density = $(ids.density);
  const sp = parseFloat(speed?.value);
  const den = parseFloat(density?.value);
  return {
    participantSelections: collectParticipantSelections(),
    selectedNodes: [],
    threadColor: color?.value ?? DEFAULT_OPTIONS.threadColor,
    threadThickness: thickness?.valueAsNumber ?? DEFAULT_OPTIONS.threadThickness,
    glow: glow?.checked ?? DEFAULT_OPTIONS.glow,
    threadStyle: style?.value ?? DEFAULT_OPTIONS.threadStyle,
    animation: animation?.value ?? DEFAULT_OPTIONS.animation,
    animationSpeed: Number.isFinite(sp) ? sp : DEFAULT_OPTIONS.animationSpeed,
    density: Number.isFinite(den) ? den : DEFAULT_OPTIONS.density,
  };
}

function applyOptions(opts) {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const config = loadConfig();
  const partContainer = $(ids.participantCategories);
  if (partContainer) renderParticipantCategories(partContainer, config, o.participantSelections);
  const color = $(ids.threadColor);
  const thickness = $(ids.threadThickness);
  const glow = $(ids.glow);
  const style = $(ids.threadStyle);
  const animation = $(ids.animation);
  const speed = $(ids.animationSpeed);
  const density = $(ids.density);

  if (color) color.value = o.threadColor ?? '#c49bff';
  if (thickness) thickness.value = o.threadThickness ?? 2;
  if (glow) glow.checked = o.glow !== false;
  if (style) style.value = o.threadStyle ?? 'solid';
  if (animation) animation.value = o.animation ?? 'pulse';
  if (speed) speed.value = o.animationSpeed ?? 0.5;
  if (density) density.value = o.density ?? 0.6;
}

function persist() {
  saveOptions(collectOptions());
}

function setupListeners() {
  const delegate = (e) => {
    const btn = e.target.closest('.tablet-node');
    if (!btn) return;
    btn.classList.toggle('tablet-node--on');
    btn.setAttribute('aria-pressed', btn.classList.contains('tablet-node--on'));
    persist();
  };
  $(ids.participantCategories)?.addEventListener('click', delegate);

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
      saveOptions({
        participantSelections: DEFAULT_OPTIONS.participantSelections,
        threadColor: DEFAULT_OPTIONS.threadColor,
      });
      applyOptions(loadOptions());
    });
  }

  const submit = $(ids.submit);
  if (submit) {
    submit.addEventListener('click', () => {
      const opts = loadOptions();
      const sel = opts.participantSelections || DEFAULT_OPTIONS.participantSelections;
      const hasCountry = (sel.countries || []).length > 0;
      const hasEthnicity = (sel.ethnicBackgrounds || []).length > 0;
      if (hasCountry && hasEthnicity) {
        const submitted = [...(opts.submittedThreads || []), { participantSelections: { ...sel }, threadColor: opts.threadColor ?? DEFAULT_OPTIONS.threadColor }];
        saveOptions({
          submittedThreads: submitted,
          participantSelections: DEFAULT_OPTIONS.participantSelections,
          threadColor: DEFAULT_OPTIONS.threadColor,
        });
        applyOptions(loadOptions());
      }
    });
  }
}

function init() {
  const opts = loadOptions();
  applyOptions(opts);
  setupListeners();
}

init();
