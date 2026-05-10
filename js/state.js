/**
 * Shared state for admin ↔ tablet ↔ projector sync.
 * Prefers the shared backend (`/api/state`) so multiple devices can see the same
 * data. Falls back to localStorage for local prototyping if the backend is absent.
 */

const STORAGE_KEY = 'thread-installation-options';
const CONFIG_KEY = 'thread-installation-config';
const STATE_EVENT = 'woven:state-changed';
/** Fired when admin/server requests a full projector repaint (`detail.nonce`). */
export const PROJECTION_REDRAW_EVENT = 'woven:projection-redraw';

export const DEFAULT_OPTIONS = {
  selectedNodes: [],
  connections: [],
  connectionMode: 'selected',
  participantSelections: { countries: [], ethnicBackgrounds: [], goodExperiences: [], badExperiences: [] },
  submittedThreads: [],
  threadColor: '#c49bff',
  threadThickness: 2,
  glow: true,
  threadStyle: 'solid',
  density: 0.6,
  animation: 'pulse',
  animationSpeed: 0.5,
};

export const DEFAULT_CONFIG = {
  countries: [],
  ethnicBackgrounds: [],
  goodExperiences: [],
  badExperiences: [],
  threadThickness: 2,
  glow: true,
  threadStyle: 'solid',
  density: 0.6,
  animation: 'pulse',
  animationSpeed: 0.5,
  comboColors: [],
};

export const INSTALLATION_BACKUP_VERSION = 1;

const state = {
  options: readLocalOptions(),
  config: readLocalConfig(),
};

let initPromise = null;
let backendMode = false;
let eventSource = null;
/** Reconnect after SSE drops (proxies, sleep, flaky LAN). */
let sseReconnectTimer = null;
let sseReconnectAttempt = 0;
/** Poll GET /api/state as fallback when SSE misses an update. */
let statePollTimer = null;
let backendSyncHooksInstalled = false;
/** Latest redraw nonce from server; used to avoid spurious redraw on first hydrate. */
let lastProjectionRedrawNonce = null;

function mergeOptions(raw) {
  return { ...DEFAULT_OPTIONS, ...(raw || {}) };
}

function mergeConfig(raw) {
  return { ...DEFAULT_CONFIG, ...(raw || {}) };
}

function emitStateChange() {
  window.dispatchEvent(
    new CustomEvent(STATE_EVENT, { detail: { options: state.options, config: state.config } })
  );
}

function persistLocalCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.options));
    localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));
  } catch (_) {}
}

function readLocalJson(key, defaults) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch (_) {
    return { ...defaults };
  }
}

function readLocalOptions() {
  return readLocalJson(STORAGE_KEY, DEFAULT_OPTIONS);
}

function readLocalConfig() {
  return readLocalJson(CONFIG_KEY, DEFAULT_CONFIG);
}

async function requestJson(path, options) {
  const res = await fetch(path, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function applyRemoteState(payload) {
  state.options = mergeOptions(payload?.options);
  state.config = mergeConfig(payload?.config);
  persistLocalCache();
  emitStateChange();
  const n = payload?.projectionRedrawNonce;
  if (typeof n !== 'number') return;
  if (lastProjectionRedrawNonce === null) {
    lastProjectionRedrawNonce = n;
    return;
  }
  if (n > lastProjectionRedrawNonce) {
    lastProjectionRedrawNonce = n;
    window.dispatchEvent(new CustomEvent(PROJECTION_REDRAW_EVENT, { detail: { nonce: n } }));
  }
}

function comparableInstallationPayload(payload) {
  return JSON.stringify({
    options: mergeOptions(payload?.options),
    config: mergeConfig(payload?.config),
  });
}

function comparableLocalInstallation() {
  return JSON.stringify({
    options: mergeOptions(state.options),
    config: mergeConfig(state.config),
  });
}

async function fetchAndApplyStateIfDrifted() {
  if (!backendMode) return;
  try {
    const payload = await requestJson('/api/state');
    const sameInstall = comparableInstallationPayload(payload) === comparableLocalInstallation();
    const n = payload?.projectionRedrawNonce;
    const nonceAdvances =
      typeof n === 'number' && lastProjectionRedrawNonce !== null && n > lastProjectionRedrawNonce;
    if (sameInstall && !nonceAdvances) return;
    applyRemoteState(payload);
  } catch (_) {}
}

function scheduleSseReconnect() {
  if (!backendMode || typeof EventSource === 'undefined') return;
  if (sseReconnectTimer) return;
  const exp = Math.min(5, sseReconnectAttempt);
  const delay = Math.min(30_000, 400 + Math.random() * 600 + 900 * 2 ** exp);
  sseReconnectTimer = setTimeout(() => {
    sseReconnectTimer = null;
    connectEventSource();
  }, delay);
  sseReconnectAttempt += 1;
}

function connectEventSource() {
  if (!backendMode || typeof EventSource === 'undefined') return;
  if (eventSource) return;
  try {
    eventSource = new EventSource('/api/events');
  } catch (_) {
    scheduleSseReconnect();
    return;
  }
  eventSource.onopen = () => {
    sseReconnectAttempt = 0;
  };
  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload?.type === 'state') applyRemoteState(payload);
    } catch (_) {}
  };
  eventSource.onerror = () => {
    try {
      eventSource?.close();
    } catch (_) {}
    eventSource = null;
    scheduleSseReconnect();
  };
}

function installBackendSyncHooksOnce() {
  if (!backendMode || backendSyncHooksInstalled) return;
  backendSyncHooksInstalled = true;
  const pollMs = 7000;
  statePollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') fetchAndApplyStateIfDrifted();
  }, pollMs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && backendMode) fetchAndApplyStateIfDrifted();
  });
}

function ensureEventStream() {
  connectEventSource();
  installBackendSyncHooksOnce();
}

export async function initState() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const payload = await requestJson('/api/state');
        backendMode = true;
        applyRemoteState(payload);
        ensureEventStream();
      } catch (_) {
        backendMode = false;
        state.options = readLocalOptions();
        state.config = readLocalConfig();
        emitStateChange();
      }
      return { options: state.options, config: state.config };
    })();
  }
  return initPromise;
}

export function isBackendMode() {
  return backendMode;
}

/**
 * Same first country + first ethnicity -> same thread colour.
 * Matching admin combo override wins; otherwise a stable hue is derived.
 * @param {{ countries?: string[], ethnicBackgrounds?: string[] }} sel
 * @param {ReturnType<typeof loadConfig> | null | undefined} exhibitConfig
 * @returns {string | null}
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
  return `hsl(${h % 360}, 72%, 58%)`;
}

export function loadOptions() {
  return mergeOptions(state.options);
}

export async function saveOptions(next) {
  state.options = mergeOptions({ ...state.options, ...next });
  persistLocalCache();
  emitStateChange();
  if (backendMode) {
    const payload = await requestJson('/api/options', {
      method: 'PUT',
      body: JSON.stringify(state.options),
    });
    applyRemoteState(payload);
  }
  return state.options;
}

/**
 * Subscribe to options changes.
 * @param {(opts: typeof DEFAULT_OPTIONS) => void} cb
 * @returns {() => void}
 */
export function subscribe(cb) {
  const onLocal = (e) => cb(e.detail?.options || loadOptions());
  const onStorage = (e) => {
    if (backendMode) return;
    if (e.key !== STORAGE_KEY || e.storageArea !== localStorage) return;
    state.options = readLocalOptions();
    cb(loadOptions());
  };
  window.addEventListener(STATE_EVENT, onLocal);
  window.addEventListener('storage', onStorage);
  cb(loadOptions());
  ensureEventStream();
  return () => {
    window.removeEventListener(STATE_EVENT, onLocal);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Subscribe to any installation state changes (options/config).
 * Useful for projector and tablet views that depend on both.
 * @param {() => void} cb
 * @returns {() => void}
 */
export function subscribeInstallation(cb) {
  const onLocal = () => cb();
  const onStorage = (e) => {
    if (backendMode) return;
    if (e.storageArea !== localStorage) return;
    if (e.key !== STORAGE_KEY && e.key !== CONFIG_KEY) return;
    state.options = readLocalOptions();
    state.config = readLocalConfig();
    cb();
  };
  window.addEventListener(STATE_EVENT, onLocal);
  window.addEventListener('storage', onStorage);
  cb();
  ensureEventStream();
  return () => {
    window.removeEventListener(STATE_EVENT, onLocal);
    window.removeEventListener('storage', onStorage);
  };
}
export function loadConfig() {
  return mergeConfig(state.config);
}

export async function saveConfig(next) {
  state.config = mergeConfig({ ...state.config, ...next });
  persistLocalCache();
  emitStateChange();
  if (backendMode) {
    const payload = await requestJson('/api/config', {
      method: 'PUT',
      body: JSON.stringify(state.config),
    });
    applyRemoteState(payload);
  }
  return state.config;
}

export function subscribeConfig(cb) {
  const onLocal = (e) => cb(e.detail?.config || loadConfig());
  const onStorage = (e) => {
    if (backendMode) return;
    if (e.key !== CONFIG_KEY || e.storageArea !== localStorage) return;
    state.config = readLocalConfig();
    cb(loadConfig());
  };
  window.addEventListener(STATE_EVENT, onLocal);
  window.addEventListener('storage', onStorage);
  cb(loadConfig());
  ensureEventStream();
  return () => {
    window.removeEventListener(STATE_EVENT, onLocal);
    window.removeEventListener('storage', onStorage);
  };
}

export function buildInstallationBackup() {
  return {
    version: INSTALLATION_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'woven',
    options: loadOptions(),
    config: loadConfig(),
  };
}

/**
 * Replace saved state from a backup object.
 * @param {unknown} data
 */
export async function applyInstallationBackup(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid file: expected a JSON object.');
  const d = /** @type {Record<string, unknown>} */ (data);
  if (d.version !== undefined && d.version !== INSTALLATION_BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${d.version}`);
  }
  if (d.options !== undefined && (typeof d.options !== 'object' || d.options === null)) {
    throw new Error('Invalid options in backup.');
  }
  if (d.config !== undefined && (typeof d.config !== 'object' || d.config === null)) {
    throw new Error('Invalid config in backup.');
  }
  if (!d.options && !d.config) {
    throw new Error('Backup must include "options" and/or "config".');
  }
  if (d.options) state.options = mergeOptions(d.options);
  if (d.config) state.config = mergeConfig(d.config);
  persistLocalCache();
  emitStateChange();
  if (backendMode) {
    if (d.config) {
      const payload = await requestJson('/api/config', {
        method: 'PUT',
        body: JSON.stringify(state.config),
      });
      applyRemoteState(payload);
    }
    if (d.options) {
      const payload = await requestJson('/api/options', {
        method: 'PUT',
        body: JSON.stringify(state.options),
      });
      applyRemoteState(payload);
    }
  }
}
