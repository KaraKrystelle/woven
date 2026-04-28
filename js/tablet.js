/**
 * Tablet UI: touch-friendly participant choices that sync to shared state (localStorage).
 * Style and motion for the projector are set on the admin screen (config).
 */

import {
  initState,
  loadOptions,
  saveOptions,
  loadConfig,
  DEFAULT_OPTIONS,
  threadColorFromCountryEthnicCombo,
  subscribeConfig,
} from './state.js';

const PARTICIPANT_KEYS = [
  { key: 'countries', label: 'Countries where you are from' },
  { key: 'ethnicBackgrounds', label: 'Your Ethnic Background' },
  { key: 'goodExperiences', label: 'Good Experiences' },
  { key: 'badExperiences', label: 'Bad Experiences' },
];

const ids = {
  participantCategories: 'participant-categories',
  reset: 'reset',
  submit: 'submit',
  openProjector: 'openProjector',
  version: 'tablet-version',
};
const TABLET_VERSION = 'v2026.04.28.2';

let draftSelections = {
  countries: [],
  ethnicBackgrounds: [],
  goodExperiences: [],
  badExperiences: [],
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
  return {
    countries: [...(draftSelections.countries || [])],
    ethnicBackgrounds: [...(draftSelections.ethnicBackgrounds || [])],
    goodExperiences: [...(draftSelections.goodExperiences || [])],
    badExperiences: [...(draftSelections.badExperiences || [])],
  };
}

function collectOptions() {
  const sel = collectParticipantSelections();
  const comboColor = threadColorFromCountryEthnicCombo(sel, loadConfig());
  return {
    participantSelections: sel,
    selectedNodes: [],
    threadColor: comboColor ?? DEFAULT_OPTIONS.threadColor,
  };
}

function applyOptions(opts) {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  draftSelections = {
    countries: [...(o.participantSelections?.countries || [])],
    ethnicBackgrounds: [...(o.participantSelections?.ethnicBackgrounds || [])],
    goodExperiences: [...(o.participantSelections?.goodExperiences || [])],
    badExperiences: [...(o.participantSelections?.badExperiences || [])],
  };
  const config = loadConfig();
  const partContainer = $(ids.participantCategories);
  if (partContainer) renderParticipantCategories(partContainer, config, draftSelections);
}

function setupListeners() {
  let lastTouchToggleAt = 0;
  let lastTouchToggleKey = '';

  const getButtonFromEvent = (e) => {
    const target = e.target instanceof Element ? e.target : null;
    return target?.closest('.tablet-node') || null;
  };

  const buttonKey = (btn) => `${btn.dataset.category || ''}:${btn.dataset.option || ''}`;

  const toggleButton = (btn) => {
    if (!btn) return;
    const cat = btn.dataset.category;
    const opt = btn.dataset.option;
    if (!cat || !opt || !draftSelections[cat]) return;
    const list = draftSelections[cat];
    const idx = list.indexOf(opt);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(opt);
    const isOn = idx < 0;
    btn.classList.toggle('tablet-node--on', isOn);
    btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    btn.blur();
  };
  const container = $(ids.participantCategories);
  if (window.PointerEvent) {
    container?.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      const btn = getButtonFromEvent(e);
      if (!btn) return;
      lastTouchToggleAt = Date.now();
      lastTouchToggleKey = buttonKey(btn);
      toggleButton(btn);
      e.preventDefault();
    });
  } else {
    container?.addEventListener(
      'touchstart',
      (e) => {
        const btn = getButtonFromEvent(e);
        if (!btn) return;
        lastTouchToggleAt = Date.now();
        lastTouchToggleKey = buttonKey(btn);
        toggleButton(btn);
        e.preventDefault();
      },
      { passive: false }
    );
  }
  container?.addEventListener('click', (e) => {
    const btn = getButtonFromEvent(e);
    if (!btn) return;
    const now = Date.now();
    if (now - lastTouchToggleAt < 700 && buttonKey(btn) === lastTouchToggleKey) return;
    // Mouse clicks and keyboard activation (Enter/Space) toggle here.
    toggleButton(btn);
  });

  const reset = $(ids.reset);
  if (reset) {
    reset.addEventListener('click', () => {
      saveOptions({
        participantSelections: DEFAULT_OPTIONS.participantSelections,
        threadColor: DEFAULT_OPTIONS.threadColor,
      }).catch(() => {});
      applyOptions(loadOptions());
    });
  }

  const submit = $(ids.submit);
  if (submit) {
    submit.addEventListener('click', () => {
      const opts = loadOptions();
      const sel = collectParticipantSelections();
      const hasCountry = (sel.countries || []).length > 0;
      const hasEthnicity = (sel.ethnicBackgrounds || []).length > 0;
      if (hasCountry && hasEthnicity) {
        const savedColor =
          threadColorFromCountryEthnicCombo(sel, loadConfig()) ??
          opts.threadColor ??
          DEFAULT_OPTIONS.threadColor;
        const submitted = [
          ...(opts.submittedThreads || []),
          { participantSelections: { ...sel }, threadColor: savedColor },
        ];
        saveOptions({
          submittedThreads: submitted,
          participantSelections: DEFAULT_OPTIONS.participantSelections,
          threadColor: DEFAULT_OPTIONS.threadColor,
          selectedNodes: [],
        }).catch(() => {});
        applyOptions(loadOptions());
      }
    });
  }
}

async function init() {
  await initState();
  const v = $(ids.version);
  if (v) v.textContent = `Version ${TABLET_VERSION}`;
  const opts = loadOptions();
  applyOptions(opts);
  setupListeners();
  subscribeConfig(() => {
    applyOptions(loadOptions());
  });
}

init();
