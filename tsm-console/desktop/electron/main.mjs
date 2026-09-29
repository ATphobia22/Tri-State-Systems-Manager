/**
 * main.mjs — Tri-State Systems Manager desktop shell (Windows 11 portable).
 *
 * Local-first, loopback-only by construction:
 *  - Spawns the TSM Node API (tsm-console/server/token-proxy.mjs) as a child
 *    process running as plain Node (ELECTRON_RUN_AS_NODE=1), bound to
 *    127.0.0.1 only, with TSM_AUTH_MODE=disabled + TSM_LOCAL_MODE=1 +
 *    TSM_OFFLINE=1. Single-user local operator; no login, no live river data.
 *    (The API child binds loopback-only; live hydrologic routes are
 *    short-circuited by TSM_OFFLINE=1. Other upstream-fetching server routes
 *    must be audited before calling this fully air-gapped.)
 *  - Serves the built Vite SPA (tsm-console/dist) over HTTP on 127.0.0.1 with
 *    an SPA fallback, injecting window.__TSM_CONFIG__ (API base URL) at load.
 *  - Renderer hardening: context isolation, no Node integration, sandbox,
 *    no external navigation, and a webRequest filter that only permits
 *    loopback http(s) plus data:/blob: for renderer traffic.
 *  - Evidence writes go to the per-user app-data directory (TSM_EVIDENCE_DIR),
 *    never into the read-only application bundle — USB-deployable.
 */
import { app, BrowserWindow, session } from 'electron';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packaged = app.isPackaged;
// Packaged layout (electron-builder):
//   resources/app.asar/{electron,stage/dist,assets,package.json}  +  resources/{server,data} (extraResources, unpacked)
const RESOURCES = process.resourcesPath;
const DIST_DIR = packaged ? path.join(RESOURCES, 'app.asar', 'stage', 'dist') : path.join(here, '..', '..', 'dist');
const SERVER_DIR = packaged ? path.join(RESOURCES, 'server') : path.join(here, '..', '..', 'server');
const DATA_DIR = packaged ? path.join(RESOURCES, 'data') : path.join(here, '..', '..', '..', 'data');
const EVIDENCE_DIR = path.join(app.getPath('userData'), 'evidence');

function findFreePort(from = 18791, tries = 40) {
  return new Promise((resolve, reject) => {
    let port = from;
    const attempt = () => {
      const probe = net.createServer();
      probe.once('error', () => {
        port += 1;
        if (port >= from + tries) reject(new Error('no free loopback port'));
        else attempt();
      });
      probe.once('listening', () => probe.close(() => resolve(port)));
      probe.listen(port, '127.0.0.1');
    };
    attempt();
  });
}

function waitForReady(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      http
        .get(url, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (parsed && parsed.ready === true) return resolve(parsed);
            } catch { /* keep polling */ }
            if (Date.now() - start > timeoutMs) return reject(new Error('API readiness timeout'));
            setTimeout(poll, 250);
          });
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) return reject(new Error('API readiness timeout'));
          setTimeout(poll, 250);
        });
    };
    poll();
  });
}

let apiChild = null;

async function startLocalApi() {
  const serverEntry = path.join(SERVER_DIR, 'token-proxy.mjs');
  if (!fs.existsSync(serverEntry)) throw new Error(`API entry missing: ${serverEntry}`);
  if (!fs.existsSync(DATA_DIR)) console.warn(`[tsm-desktop] data dir missing: ${DATA_DIR}`);
  const port = await findFreePort();
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  apiChild = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      TSM_AUTH_MODE: 'disabled',
      TSM_LOCAL_MODE: '1',
      TSM_HOST: '127.0.0.1',
      TSM_OFFLINE: '1',
      TSM_EVIDENCE_DIR: EVIDENCE_DIR,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  apiChild.stdout.on('data', (d) => console.log(`[tsm-api] ${String(d).trimEnd()}`));
  apiChild.stderr.on('data', (d) => console.error(`[tsm-api:err] ${String(d).trimEnd()}`));
  apiChild.on('exit', (code, signal) => {
    console.error(`[tsm-desktop] local API exited code=${code} signal=${signal}`);
    if (!app.isQuitting) app.quit();
  });
  const ready = await waitForReady(`http://127.0.0.1:${port}/ready`);
  console.log(`[tsm-desktop] local API ready (auth_disabled=${ready.auth_disabled} local_mode=${ready.local_mode} offline=${ready.offline_mode})`);
  return port;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

function serveSpa(apiBaseUrl) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
        let filePath = path.normalize(path.join(DIST_DIR, urlPath));
        if (!filePath.startsWith(DIST_DIR)) {
          res.writeHead(403); res.end('forbidden'); return;
        }
        if (urlPath.endsWith('/') || !path.extname(filePath)) filePath = path.join(DIST_DIR, 'index.html');
        if (!fs.existsSync(filePath)) filePath = path.join(DIST_DIR, 'index.html');
        let body = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        // Inject the runtime API base before the bundle evaluates.
        if (filePath.endsWith('index.html')) {
          const inject = `<script>window.__TSM_CONFIG__=${JSON.stringify({ apiBaseUrl })};</script>`;
          const html = body.toString('utf8').replace(/<head[^>]*>/i, (m) => `${m}${inject}`);
          body = Buffer.from(html, 'utf8');
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(body);
      } catch (error) {
        res.writeHead(500); res.end('internal error');
      }
    });
    findFreePort(18821).then((port) => {
      server.listen(port, '127.0.0.1', () => resolve({ server, port }));
    }, reject);
  });
}

function isLoopbackHttp(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return u.hostname === '127.0.0.1' || u.hostname === '::1' || u.hostname === 'localhost';
  } catch {
    return false;
  }
}

function hardenSession() {
  const ses = session.defaultSession;
  // Loopback-only renderer traffic: only loopback http(s) may traverse the
  // network from the renderer. data:/blob: are same-document constructs and
  // stay allowed. (This filter covers the renderer only, not the API child
  // process — see the header note.)
  ses.webRequest.onBeforeRequest((details, callback) => {
    const u = details.url;
    if (u.startsWith('data:') || u.startsWith('blob:')) return callback({});
    if (isLoopbackHttp(u)) return callback({});
    console.warn(`[tsm-desktop] blocked non-loopback request: ${u.slice(0, 120)}`);
    return callback({ cancel: true });
  });
}

async function createWindow(spaPort) {
  const preload = path.join(here, 'preload.mjs');
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Tri-State Systems Manager',
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!isLoopbackHttp(url)) event.preventDefault();
  });
  await win.loadURL(`http://127.0.0.1:${spaPort}/`);
  return win;
}

async function boot() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  hardenSession();
  const apiPort = await startLocalApi();
  const { port: spaPort } = await serveSpa(`http://127.0.0.1:${apiPort}`);
  await createWindow(spaPort);
  console.log(`[tsm-desktop] running: SPA http://127.0.0.1:${spaPort}/ API http://127.0.0.1:${apiPort}/`);
}

app.on('before-quit', () => {
  app.isQuitting = true;
  if (apiChild && !apiChild.killed) apiChild.kill();
});
app.on('window-all-closed', () => app.quit());
app.whenReady().then(boot).catch((error) => {
  console.error('[tsm-desktop] boot failed:', error);
  app.quit();
});
