const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3333);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');

const DEFAULT_OPTIONS = {
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

const DEFAULT_CONFIG = {
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

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

let installationState = loadStateFromDisk();
const clients = new Set();

function mergeState(raw) {
  return {
    options: { ...DEFAULT_OPTIONS, ...(raw?.options || {}) },
    config: { ...DEFAULT_CONFIG, ...(raw?.config || {}) },
  };
}

function loadStateFromDisk() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return mergeState(JSON.parse(raw));
  } catch (_) {
    return mergeState({});
  }
}

function saveStateToDisk() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(installationState, null, 2));
}

function json(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
}

function sendEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastState() {
  const payload = { type: 'state', ...installationState };
  for (const client of clients) {
    sendEvent(client, payload);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (_) {
        reject(new Error('Invalid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function updateOptions(nextOptions) {
  installationState = mergeState({ ...installationState, options: nextOptions });
  saveStateToDisk();
  broadcastState();
  return installationState;
}

function updateConfig(nextConfig) {
  installationState = mergeState({ ...installationState, config: nextConfig });
  saveStateToDisk();
  broadcastState();
  return installationState;
}

function safePathFromUrl(requestUrl) {
  const parsed = new URL(requestUrl, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === '/') pathname = '/admin.html';
  const filePath = path.normalize(path.join(ROOT_DIR, pathname));
  if (!filePath.startsWith(ROOT_DIR)) return null;
  return filePath;
}

function serveStatic(req, res) {
  const filePath = safePathFromUrl(req.url);
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && parsed.pathname === '/api/state') {
    json(res, 200, installationState);
    return;
  }

  if (req.method === 'PUT' && parsed.pathname === '/api/options') {
    try {
      const body = await readBody(req);
      json(res, 200, updateOptions(body));
    } catch (err) {
      json(res, 400, { error: err.message || String(err) });
    }
    return;
  }

  if (req.method === 'PUT' && parsed.pathname === '/api/config') {
    try {
      const body = await readBody(req);
      json(res, 200, updateConfig(body));
    } catch (err) {
      json(res, 400, { error: err.message || String(err) });
    }
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/api/events') {
    res.writeHead(200, {
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
    });
    res.write('\n');
    clients.add(res);
    sendEvent(res, { type: 'state', ...installationState });
    req.on('close', () => {
      clients.delete(res);
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`woven server running on http://localhost:${PORT}`);
});
