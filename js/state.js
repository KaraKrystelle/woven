/**
 * Shared state for tablet ↔ projector sync.
 * Uses localStorage + storage events so tablet (one tab) and projector
 * (another tab) stay in sync on the same machine.
 */

const STORAGE_KEY = 'thread-installation-options';

export const DEFAULT_OPTIONS = {
  /** Which nodes to include (ids). Empty = all. */
  selectedNodes: [],
  /** Which pairs are connected. [[a,b],[b,c]] or empty = auto from selected. */
  connections: [],
  /** 'all' | 'selected' | 'custom' */
  connectionMode: 'selected',
  /** Participant choices from admin-defined categories (shown on tablet). */
  participantSelections: { countries: [], ethnicBackgrounds: [], goodExperiences: [], badExperiences: [] },
  /** Submitted threads (each adds to projection); reset tablet after submit. */
  submittedThreads: [],
  /** Thread visuals */
  threadColor: '#c49bff',
  threadThickness: 2,
  glow: true,
  /** 'solid' | 'dashed' | 'gradient' */
  threadStyle: 'solid',
  /** 0–1 */
  density: 0.6,
  /** 'static' | 'pulse' | 'flow' */
  animation: 'pulse',
  /** 0–1 */
  animationSpeed: 0.5,
};

const fallback = () => ({ ...DEFAULT_OPTIONS });

/**
 * @returns {typeof DEFAULT_OPTIONS}
 */
export function loadOptions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OPTIONS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_OPTIONS, ...parsed };
  } catch (_) {
    return fallback();
  }
}

/**
 * @param {Partial<typeof DEFAULT_OPTIONS>} next
 */
export function saveOptions(next) {
  const prev = loadOptions();
  const merged = { ...prev, ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (_) {}
  return merged;
}

/**
 * Subscribe to options changes (e.g. from tablet in another tab).
 * @param {(opts: typeof DEFAULT_OPTIONS) => void} cb
 * @returns {() => void} unsubscribe
 */
export function subscribe(cb) {
  const handler = (e) => {
    if (e.key !== STORAGE_KEY || e.storageArea !== localStorage) return;
    cb(loadOptions());
  };
  window.addEventListener('storage', handler);
  cb(loadOptions());
  return () => window.removeEventListener('storage', handler);
}

/* ----- Admin config (exhibit content for tablet) ----- */

const CONFIG_KEY = 'thread-installation-config';

export const DEFAULT_CONFIG = {
  countries: [],
  ethnicBackgrounds: [],
  goodExperiences: [],
  badExperiences: [],
};

/**
 * @returns {typeof DEFAULT_CONFIG}
 */
export function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (_) {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * @param {Partial<typeof DEFAULT_CONFIG>} next
 */
export function saveConfig(next) {
  const merged = { ...loadConfig(), ...next };
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
  } catch (_) {}
  return merged;
}
