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

const ids = {
  page: 'tablet-page',
  version: 'tablet-version',
};
const TABLET_VERSION = 'v2026.04.28.3';
const LOOK_UP_MS = 5000;
const PAGES = [
  { type: 'start', title: 'Start' },
  { type: 'choices', key: 'countries', title: 'Country' },
  { type: 'choices', key: 'ethnicBackgrounds', title: 'Ethnic background' },
  { type: 'choices', key: 'goodExperiences', title: 'Good experiences' },
  { type: 'choices', key: 'badExperiences', title: 'Bad experiences', submit: true },
  { type: 'lookUp', title: 'Look Up' },
];

let draftSelections = {
  countries: [],
  ethnicBackgrounds: [],
  goodExperiences: [],
  badExperiences: [],
};
let pageIndex = 0;
let lookUpTimer = null;

function $(id) {
  return document.getElementById(id);
}

function resetDraftSelections() {
  draftSelections = {
    countries: [],
    ethnicBackgrounds: [],
    goodExperiences: [],
    badExperiences: [],
  };
}

function createActionButton(label, variant = 'primary') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `tablet-btn tablet-btn--${variant}`;
  btn.textContent = label;
  return btn;
}

function renderChoiceButtons(container, category, options) {
  if (!container) return;
  container.innerHTML = '';
  const set = new Set(draftSelections[category] || []);
  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tablet-node' + (set.has(opt) ? ' tablet-node--on' : '');
    btn.textContent = opt;
    btn.dataset.category = category;
    btn.dataset.option = opt;
    btn.setAttribute('aria-pressed', set.has(opt) ? 'true' : 'false');
    container.appendChild(btn);
  });
}

function collectParticipantSelections() {
  return {
    countries: [...(draftSelections.countries || [])],
    ethnicBackgrounds: [...(draftSelections.ethnicBackgrounds || [])],
    goodExperiences: [...(draftSelections.goodExperiences || [])],
    badExperiences: [...(draftSelections.badExperiences || [])],
  };
}

function renderPage() {
  const root = $(ids.page);
  if (!root) return;
  const page = PAGES[pageIndex] || PAGES[0];
  const config = loadConfig();
  root.innerHTML = '';

  const section = document.createElement('section');
  section.className = `tablet-page-card tablet-page-card--${page.type}`;

  if (page.type === 'start') {
    const begin = createActionButton('Begin');
    begin.classList.add('tablet-btn--hero');
    begin.addEventListener('click', () => {
      resetDraftSelections();
      pageIndex = 1;
      renderPage();
    });
    section.appendChild(begin);
    root.appendChild(section);
    return;
  }

  if (page.type === 'lookUp') {
    const title = document.createElement('h2');
    title.className = 'tablet-look-up';
    title.textContent = 'Look Up';
    const message = document.createElement('p');
    message.className = 'tablet-look-up-message';
    message.textContent = 'Your thread is now appearing on the projector.';
    section.append(title, message);
    root.appendChild(section);
    return;
  }

  const title = document.createElement('h2');
  title.className = 'tablet-page-title';
  title.textContent = page.title;
  const hint = document.createElement('p');
  hint.className = 'tablet-page-hint';
  hint.textContent = 'Tap one or more options.';
  const nodes = document.createElement('div');
  nodes.className = 'tablet-nodes tablet-page-nodes';
  renderChoiceButtons(nodes, page.key, config[page.key] || []);
  const actions = document.createElement('div');
  actions.className = 'tablet-actions';
  const next = createActionButton(page.submit ? 'Submit' : 'Continue');
  next.addEventListener('click', () => {
    if (page.submit) submitSelections();
    else {
      pageIndex += 1;
      renderPage();
    }
  });
  actions.appendChild(next);
  section.append(title, hint, nodes, actions);
  root.appendChild(section);
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
  const container = $(ids.page);
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
}

function submitSelections() {
  const opts = loadOptions();
  const sel = collectParticipantSelections();
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

  resetDraftSelections();
  pageIndex = 5;
  renderPage();
  if (lookUpTimer) clearTimeout(lookUpTimer);
  lookUpTimer = setTimeout(() => {
    pageIndex = 0;
    renderPage();
  }, LOOK_UP_MS);
}

async function init() {
  await initState();
  const v = $(ids.version);
  if (v) v.textContent = `Version ${TABLET_VERSION}`;
  resetDraftSelections();
  renderPage();
  setupListeners();
  subscribeConfig(() => {
    renderPage();
  });
}

init();
