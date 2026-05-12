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
};
const CONTINUE_BTN_ID = 'tablet-step-continue';
const LOOK_UP_MS = 5000;
/** One selection at a time (tap again to clear). */
const SINGLE_SELECT_KEYS = new Set(['countries', 'ethnicBackgrounds']);
const EXPERIENCES_SELECTION_MAX = 2;
const PAGES = [
  { type: 'start', title: 'Start' },
  { type: 'choices', key: 'countries', title: 'Where were you born?' },
  { type: 'choices', key: 'ethnicBackgrounds', title: 'Which ethnic background do you identify best with?' },
  { type: 'choices', key: 'goodExperiences', title: 'Choose up to 2 Good Experiences' },
  { type: 'choices', key: 'badExperiences', title: 'Choose up to 2 Bad Experiences', submit: true },
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
let tabletRenderedOnce = false;
let fadeGeneration = 0;
/** Exit phase duration (matches CSS); enter uses same ease/duration on #tablet-page */
const PAGE_TRANSITION_MS = 340;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

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

function syncContinueButtonState() {
  const btn = document.getElementById(CONTINUE_BTN_ID);
  if (!btn || !(btn instanceof HTMLButtonElement)) return;
  const page = PAGES[pageIndex];
  if (!page || page.type !== 'choices' || !page.key) {
    btn.disabled = false;
    return;
  }
  if (SINGLE_SELECT_KEYS.has(page.key)) {
    const sel = draftSelections[page.key];
    btn.disabled = !sel || sel.length === 0;
  } else if (page.key === 'goodExperiences' || page.key === 'badExperiences') {
    const sel = draftSelections[page.key] || [];
    btn.disabled = sel.length === 0;
  } else {
    btn.disabled = false;
  }
}

/** Builds DOM for current step (instant swap). */
function renderPageCore() {
  const root = $(ids.page);
  if (!root) return;
  const page = PAGES[pageIndex] || PAGES[0];
  const config = loadConfig();
  root.innerHTML = '';

  const main = root.closest('.tablet-main');
  if (main) main.classList.toggle('tablet-main--start', page.type === 'start');

  const section = document.createElement('section');
  section.className = `tablet-page-card tablet-page-card--${page.type}`;

  if (page.type === 'start') {
    const intro = document.createElement('p');
    intro.className = 'tablet-start-intro';
    intro.textContent = 'Start the experience to join the WOVEN world';

    const begin = createActionButton('Begin', 'secondary');
    begin.classList.add('tablet-btn--hero');
    begin.addEventListener('click', () => {
      resetDraftSelections();
      pageIndex = 1;
      renderPage();
    });
    section.append(intro, begin);
    root.appendChild(section);
    return;
  }

  if (page.type === 'lookUp') {
    const title = document.createElement('h2');
    title.className = 'tablet-look-up';
    title.textContent = 'Look Up';
    const message = document.createElement('p');
    message.className = 'tablet-look-up-message';
    message.textContent = 'What your threads connect';
    section.append(title, message);
    root.appendChild(section);
    return;
  }

  const title = document.createElement('h2');
  title.className = 'tablet-page-title';
  title.textContent = page.title;

  const headerRow = document.createElement('div');
  headerRow.className = 'tablet-page-header-row';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'tablet-back-btn';
  back.setAttribute('aria-label', 'Previous step');
  back.textContent = '\u2190';
  back.addEventListener('click', () => {
    pageIndex = pageIndex <= 1 ? 0 : pageIndex - 1;
    renderPage();
  });

  const headerTrail = document.createElement('div');
  headerTrail.className = 'tablet-page-header-trail';
  headerTrail.setAttribute('aria-hidden', 'true');

  headerRow.append(back, title, headerTrail);

  const hint = document.createElement('p');
  hint.className = 'tablet-page-hint';
  if (page.key && SINGLE_SELECT_KEYS.has(page.key)) {
    hint.textContent = 'Tap one option (tap again to clear).';
  } else if (page.key === 'goodExperiences' || page.key === 'badExperiences') {
    hint.textContent = 'Tap up to 2 options (tap again to deselect).';
  } else {
    hint.textContent = 'Tap one or more options.';
  }
  const nodes = document.createElement('div');
  nodes.className = 'tablet-nodes tablet-page-nodes';
  if (page.key === 'goodExperiences' && draftSelections.goodExperiences.length > EXPERIENCES_SELECTION_MAX) {
    draftSelections.goodExperiences = draftSelections.goodExperiences.slice(0, EXPERIENCES_SELECTION_MAX);
  }
  if (page.key === 'badExperiences' && draftSelections.badExperiences.length > EXPERIENCES_SELECTION_MAX) {
    draftSelections.badExperiences = draftSelections.badExperiences.slice(0, EXPERIENCES_SELECTION_MAX);
  }
  renderChoiceButtons(nodes, page.key, config[page.key] || []);
  const actions = document.createElement('div');
  actions.className = 'tablet-actions';
  const next = createActionButton(page.submit ? 'Submit' : 'Continue');
  next.id = CONTINUE_BTN_ID;
  next.addEventListener('click', () => {
    if (next.disabled) return;
    if (page.submit) submitSelections();
    else {
      pageIndex += 1;
      renderPage();
    }
  });
  actions.appendChild(next);

  section.append(headerRow, hint, nodes, actions);
  root.appendChild(section);
  syncContinueButtonState();
}

/**
 * Rebuilds the current step. Optional motion: outgoing screen fades/zooms/blurs out, swap,
 * then incoming fades/zooms/blurs in (“ghost zoom”). Skipped on first paint, config refresh,
 * or prefers-reduced-motion.
 * @param {{ skipTransition?: boolean }} opts
 */
function renderPage(opts = {}) {
  const root = $(ids.page);
  if (!root) return;

  const skipTransition =
    opts.skipTransition === true ||
    !tabletRenderedOnce ||
    prefersReducedMotion();

  if (skipTransition) {
    fadeGeneration += 1;
    root.classList.remove('tablet-page--leave', 'tablet-page--enter-from');
    renderPageCore();
    tabletRenderedOnce = true;
    root.scrollTop = 0;
    return;
  }

  const gen = ++fadeGeneration;
  root.classList.remove('tablet-page--enter-from');
  root.classList.add('tablet-page--leave');

  let settled = false;
  const settle = () => {
    if (settled || gen !== fadeGeneration) return;
    settled = true;
    clearTimeout(exitTimer);
    renderPageCore();
    tabletRenderedOnce = true;
    root.scrollTop = 0;
    root.classList.remove('tablet-page--leave');
    root.classList.add('tablet-page--enter-from');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (gen !== fadeGeneration) return;
        root.classList.remove('tablet-page--enter-from');
      });
    });
  };

  const exitTimer = setTimeout(settle, PAGE_TRANSITION_MS + 60);
}

function toggleTabletFullscreen() {
  const doc = document;
  const root = document.documentElement;
  const fullscreenEl = doc.fullscreenElement || doc.webkitFullscreenElement;
  if (!fullscreenEl) {
    const req = root.requestFullscreen?.bind(root) || root.webkitRequestFullscreen?.bind(root);
    if (req) req().catch(() => {});
  } else {
    const exit = doc.exitFullscreen?.bind(doc) || doc.webkitExitFullscreen?.bind(doc);
    if (exit) exit().catch(() => {});
  }
}

/** Double-tap top-right corner (touch / pen) toggles fullscreen kiosk-style. */
function setupFullscreenCornerGesture() {
  let cornerTap = { t: 0, x: 0, y: 0 };
  const DOUBLE_MS = 450;
  const MOVE_TOL = 56;

  function cornerInset() {
    return Math.min(112, Math.min(window.innerWidth, window.innerHeight) * 0.22);
  }

  function isTopRightCorner(x, y) {
    const inset = cornerInset();
    return x >= window.innerWidth - inset && y <= inset;
  }

  function handleEnd(clientX, clientY) {
    if (!isTopRightCorner(clientX, clientY)) {
      cornerTap.t = 0;
      return;
    }
    const now = Date.now();
    if (
      cornerTap.t &&
      now - cornerTap.t < DOUBLE_MS &&
      Math.hypot(clientX - cornerTap.x, clientY - cornerTap.y) < MOVE_TOL
    ) {
      toggleTabletFullscreen();
      cornerTap.t = 0;
    } else {
      cornerTap = { t: now, x: clientX, y: clientY };
    }
  }

  if (window.PointerEvent) {
    document.addEventListener(
      'pointerup',
      (e) => {
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        handleEnd(e.clientX, e.clientY);
      },
      { passive: true }
    );
  } else {
    document.addEventListener(
      'touchend',
      (e) => {
        const t = e.changedTouches[0];
        if (!t) return;
        handleEnd(t.clientX, t.clientY);
      },
      { passive: true }
    );
  }
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

    if (SINGLE_SELECT_KEYS.has(cat)) {
      const idx = list.indexOf(opt);
      if (idx >= 0) list.splice(idx, 1);
      else {
        list.length = 0;
        list.push(opt);
      }
      const wrap = btn.closest('.tablet-nodes');
      if (wrap) {
        wrap.querySelectorAll('.tablet-node').forEach((b) => {
          const o = b.dataset.option;
          const on = list.indexOf(o) >= 0;
          b.classList.toggle('tablet-node--on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      btn.blur();
      syncContinueButtonState();
      return;
    }

    const idx = list.indexOf(opt);
    if (idx >= 0) list.splice(idx, 1);
    else {
      if (
        (cat === 'goodExperiences' || cat === 'badExperiences') &&
        list.length >= EXPERIENCES_SELECTION_MAX
      )
        return;
      list.push(opt);
    }
    const isOn = idx < 0;
    btn.classList.toggle('tablet-node--on', isOn);
    btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    btn.blur();
    syncContinueButtonState();
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
  resetDraftSelections();
  renderPage({ skipTransition: true });
  setupListeners();
  setupFullscreenCornerGesture();
  subscribeConfig(() => {
    renderPage({ skipTransition: true });
  });
}

init();
