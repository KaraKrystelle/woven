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
 * Same first country + first ethnicity → same thread colour.
 * If exhibit config includes a matching entry in comboColors, that colour wins (3b); else stable hash (3a).
 * @param {{ countries?: string[], ethnicBackgrounds?: string[] }} sel
 * @param {ReturnType<typeof loadConfig> | null | undefined} exhibitConfig — pass loadConfig() or sketch config; omit to load internally (avoid in hot loops).
 * @returns {string | null} CSS colour or null if either choice is missing
 */
export function threadColorFromCountryEthnicCombo(sel, exhibitConfig) {
  const country = (sel?.countries || [])[0];
  const ethnic = (sel?.ethnicBackgrounds || [])[0];
  if (!country || !ethnic) return null;
  const cfg = exhibitConfig !== undefined && exhibitConfig !== null ? exhibitConfig : loadConfig();
  const list = cfg.comboColors || [];
  const override = list.find((o) => o.country === country && o.ethnicBackground === ethnic);
  if (override?.color) return override.color;
  const key = `${country}\0${ethnic}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue}, 72%, 58%)`;
}

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
  /** Projector thread appearance & motion (admin). */
  threadThickness: 2,
  glow: true,
  threadStyle: 'solid',
  density: 0.6,
  animation: 'pulse',
  animationSpeed: 0.5,
  /** Admin overrides: { country, ethnicBackground, color } per pair (hex or any CSS colour). */
  comboColors: [],
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
