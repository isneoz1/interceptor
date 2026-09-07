/* Captures d ecran de la documentation - INTERCEPTOR (cree par D4RK)
 *
 *   node tools/captures.mjs
 *
 * Rend la vraie console dans un Chromium sans interface, alimentee par un jeu
 * de trafic passe dans le VRAI noyau : meme magasin, meme analyseur, memes
 * statistiques que dans Firefox. Les images de `docs/images/` sont donc des
 * copies d ecran de l outil, pas des maquettes.
 *
 * Aucune dependance : un petit serveur de fichiers, puis Chrome pilote par le
 * protocole DevTools via le WebSocket natif de Node.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import url from 'url';
import { spawn } from 'child_process';
import { installerTout } from '../tests/harnais.mjs';

const RACINE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(RACINE, 'docs', 'images');
const LARGEUR = 1600;
const HAUTEUR = 1000;

/* Les vues a photographier : identifiant interne, nom de fichier, et le temps
   laisse a la vue pour se dessiner quand elle calcule beaucoup. */
const VUES = [
  ['requests', 'console-requetes'],
  ['alerts', 'console-securite'],
  ['summary', 'console-synthese'],
  ['sitemap', 'console-sites'],
  ['tools', 'console-outils'],
  ['rules', 'console-regles'],
  ['stats', 'console-etat'],
  ['settings', 'console-reglages'],
  ['help', 'console-aide']
];

/* ======================= 1. Trafic passe dans le noyau ===================== */
installerTout();

const { config } = await import('../background/core/config.js');
const { store } = await import('../background/core/store.js');
const { analyze } = await import('../background/core/analyzer.js');
const { collectStats, capabilities } = await import('../background/api/status.js');

await config.ready;

const T0 = Date.now() - 45000;
let horloge = T0;

/** Ajoute une requete au magasin comme le ferait la couche de capture. */
function requete({ methode = 'GET', url: adresse, type = 'xmlhttprequest', statut = 200,
  mime = 'application/json', taille = 0, duree = 80, entetesReq = [], entetesRep = [],
  corpsReq = null, corpsRep = null, ip = '203.0.113.10', cookies = null, erreur = null,
  onglet = 3, ecart = 120 } = {}) {
  horloge += ecart;
  const rec = store.create({
    url: adresse, finalUrl: adresse, method: methode, type, tabId: onglet, frameId: 0,
    windowId: 1, startTime: horloge, sources: ['webRequest'],
    requestHeaders: [{ name: 'Host', value: new URL(adresse).host }, ...entetesReq],
    responseHeaders: statut ? [{ name: 'Content-Type', value: mime }, ...entetesRep] : [],
    statusCode: statut, statusLine: statut ? 'HTTP/2 ' + statut : null,
    mime, ip, size: taille, wireResponseSize: taille, error: erreur,
    requestBody: corpsReq, responseBody: corpsRep,
    cookies: cookies || { set: [], changed: [] },
    perf: { nextHopProtocol: 'h2' }
  });
  rec.endTime = rec.startTime + duree;
  rec.duration = duree;
  rec.state = erreur ? 'error' : 'complete';
  analyze(rec, { force: true });
  return rec;
}

const API = 'https://api.example.com';
const SITE = 'https://shop.example.com';
const CDN = 'https://cdn.example.com';

/* --- Navigation initiale --- */
requete({ url: SITE + '/', type: 'main_frame', mime: 'text/html', taille: 48213, duree: 214,
  entetesRep: [
    { name: 'Cache-Control', value: 'max-age=300, must-revalidate' },
    { name: 'Date', value: new Date(horloge).toUTCString() },
    { name: 'ETag', value: '"7f3a91"' },
    { name: 'Content-Security-Policy',
      value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example.com; img-src *" },
    { name: 'Strict-Transport-Security', value: 'max-age=31536000' }
  ],
  cookies: { set: [{ name: 'session', value: 'a1b2c3', secure: true, httpOnly: true, path: '/' }], changed: [] } });

for (const [nom, taille] of [['app.js', 184320], ['vendor.js', 512000], ['style.css', 41200]]) {
  requete({ url: CDN + '/' + nom, type: nom.endsWith('css') ? 'stylesheet' : 'script',
    mime: nom.endsWith('css') ? 'text/css' : 'application/javascript', taille,
    duree: Math.round(60 + taille / 8000),
    entetesRep: [{ name: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] });
}
for (const nom of ['banner.webp', 'product-01.webp', 'product-02.webp', 'logo.svg']) {
  requete({ url: CDN + '/img/' + nom, type: 'image', mime: 'image/webp', taille: 24000 + nom.length * 900, duree: 40 });
}

/* --- Appels applicatifs --- */
requete({ methode: 'POST', url: API + '/v2/cart', taille: 312, duree: 168,
  entetesReq: [{ name: 'Content-Type', value: 'application/json' },
    { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJyb2xlIjoiY2xpZW50In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' }],
  corpsReq: { size: 58, kind: 'texte', source: 'webRequest', contentType: 'application/json',
    text: '{"item":"REF-8842","quantity":2,"shipping":"express"}' },
  corpsRep: { size: 312, kind: 'texte', source: 'streamFilter', mime: 'application/json',
    text: '{"cart":{"lines":2,"total":12840,"currency":"USD"},"promo":null}' } });

requete({ url: API + '/v2/catalog?page=1&sort=price', taille: 18422, duree: 92,
  corpsRep: { size: 18422, kind: 'texte', source: 'streamFilter', mime: 'application/json',
    text: '{"items":[{"ref":"REF-8842","price":6420},{"ref":"REF-1130","price":2990}],"total":248}' } });

requete({ url: API + '/v2/stock/REF-8842', statut: 404, taille: 74, duree: 41,
  corpsRep: { size: 74, kind: 'texte', source: 'streamFilter', mime: 'application/json',
    text: '{"error":"unknown reference","code":"STOCK_404"}' } });

requete({ methode: 'PUT', url: API + '/v2/profile', statut: 500, taille: 128, duree: 3120,
  entetesReq: [{ name: 'Content-Type', value: 'application/json' }],
  corpsRep: { size: 128, kind: 'texte', source: 'streamFilter', mime: 'application/json',
    text: '{"error":"internal","trace":"db timeout"}' } });

/* --- Ce que l analyseur doit voir : chaque cas est demontrable --- */
requete({ url: 'http://legacy.example.com/api/session', scheme: 'http', statut: 200, taille: 96,
  mime: 'application/json', ip: '198.51.100.7',
  entetesReq: [{ name: 'Authorization', value: 'Basic bWFyaWU6bW90ZGVwYXNzZQ==' }] });

requete({ url: API + '/v2/callback?access_token=aZ3kD9fLpQ2sVx7yTr4WbN1mHc8Jg', taille: 42 });

requete({ url: API + '/v2/public', taille: 220,
  entetesReq: [{ name: 'Origin', value: 'https://unknown-third-party.example' }],
  entetesRep: [{ name: 'Access-Control-Allow-Origin', value: 'https://unknown-third-party.example' },
    { name: 'Access-Control-Allow-Credentials', value: 'true' }] });

requete({ url: API + '/v2/tracking', taille: 60,
  cookies: { set: [{ name: 'trace', value: 'x9', sameSite: 'None', secure: false, path: '/' }], changed: [] } });

requete({ url: 'https://pixel.tracker.net/collect?uid=8f21c', type: 'image', mime: 'image/gif',
  taille: 43, ip: '192.0.2.200' });

requete({ url: CDN + '/missing.js', type: 'script', statut: null, mime: '', erreur: 'NS_ERROR_NET_RESET', duree: 5010 });

/* --- Flux temps reel --- */
const flux = requete({ url: 'wss://realtime.example.com/socket', type: 'websocket', statut: 101,
  mime: '', taille: 0, duree: 0 });
flux.ws = {
  frames: [
    { dir: 'out', opcode: 1, ts: horloge + 200, size: 38, text: '{"type":"subscribe","channel":"stock"}' },
    { dir: 'in', opcode: 1, ts: horloge + 420, size: 64, text: '{"channel":"stock","ref":"REF-8842","remaining":7}' },
    { dir: 'in', opcode: 1, ts: horloge + 1900, size: 63, text: '{"channel":"stock","ref":"REF-1130","remaining":0}' },
    { dir: 'out', opcode: 9, ts: horloge + 3000, size: 0, text: '' }
  ]
};
store.touch(flux.id);

const sse = requete({ url: API + '/v2/events', type: 'other', mime: 'text/event-stream',
  taille: 512, duree: 0 });
sse.sse = {
  messages: [
    { event: 'order', data: '{"id":"ORD-77","state":"paid"}', ts: horloge + 800 },
    { event: 'order', data: '{"id":"ORD-78","state":"preparing"}', ts: horloge + 4200 }
  ]
};
store.touch(sse.id);

/* --- Une regle d exemple, pour que la vue « Regles » montre quelque chose --- */
/* Les captures illustrent un depot anglophone : l interface est rendue dans sa
   langue anglaise, celle que le dictionnaire produit a partir des memes
   sources francaises. */
await config.set({
  lang: 'en',
  rulesEnabled: false,
  rules: [
    { id: 'r-trackers', enabled: true, name: 'Block known trackers',
      match: { urlRegex: 'tracker\\.net|doubleclick\\.net|google-analytics\\.com' }, action: 'block' },
    { id: 'r-slow', enabled: true, name: 'Simulate a slow network on the API',
      match: { host: 'api.example.com' }, action: 'delay', delayMs: 750 },
    { id: 'r-stock', enabled: false, name: 'Answer 200 on stock lookups',
      match: { urlRegex: '/v2/stock/' }, action: 'mock',
      mock: { body: '{"remaining":42}', contentType: 'application/json' } }
  ]
});

/* Le vrai service de commandes du noyau, celui que la console interroge dans
   Firefox. La demo ne reimplemente rien : elle lui parle. */
const { startRpc } = await import('../background/api/rpc.js');
startRpc();

const EXPEDITEUR = { url: browser.runtime.getURL('ui/console.html'), id: browser.runtime.id };

/** Passe un message a la vraie table de commandes et rend sa reponse. */
async function appelerNoyau(message) {
  for (const ecouteur of browser.runtime.onMessage.ecouteurs) {
    const reponse = ecouteur(message, EXPEDITEUR);
    if (reponse !== undefined) return await reponse;
  }
  return { error: 'aucune reponse du noyau' };
}

const premier = await appelerNoyau({ t: 'cmd', cmd: 'snapshot', args: {} });
console.log('Trafic prepare : ' + premier.records.length + ' requetes, '
  + premier.stats.analyzer.findings + ' alertes.');

/* ============================ 2. Serveur local ============================ */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json' };

const serveur = http.createServer((req, res) => {
  /* Pont vers le noyau : la page envoie ici ce qu elle enverrait a
     `runtime.sendMessage` dans Firefox. */
  if (req.url === '/__noyau') {
    let corps = '';
    req.on('data', bloc => { corps += bloc; });
    req.on('end', async () => {
      let sortie;
      try { sortie = await appelerNoyau(JSON.parse(corps)); }
      catch (e) { sortie = { error: String(e && e.message || e) }; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sortie === undefined ? {} : sortie));
    });
    return;
  }
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const abs = path.join(RACINE, rel);
  if (!abs.startsWith(RACINE) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    res.writeHead(404); res.end('introuvable'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(abs)] || 'application/octet-stream' });
  res.end(fs.readFileSync(abs));
});
const port = await new Promise(resolve => {
  serveur.listen(0, '127.0.0.1', () => resolve(serveur.address().port));
});

/* ===================== 3. Le noyau, imite dans la page ==================== */
/* La console parle au noyau par `runtime.connect` et `runtime.sendMessage`.
   On rejoue exactement ce protocole avec l instantane calcule plus haut. */
function scriptDeDemarrage(instantaneJson) {
  return `
(() => {
  const SNAP = ${instantaneJson};
  const ecouteurs = () => { const l = []; return {
    addListener: f => l.push(f), removeListener: () => {}, emettre: (...a) => l.forEach(f => f(...a)) }; };
  const port = { onMessage: ecouteurs(), onDisconnect: ecouteurs(), postMessage() {}, disconnect() {} };

  /* Toute commande part vers le vrai noyau, qui tourne dans le processus
     Node qui pilote ce navigateur. */
  const envoyer = async message => {
    const reponse = await fetch('/__noyau', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    return reponse.json();
  };

  const api = {
    runtime: {
      id: 'interceptor@demo',
      getURL: p => '/' + String(p).replace(/^\\//, ''),
      getManifest: () => ({ version: SNAP.version }),
      sendMessage: envoyer,
      connect: () => { setTimeout(() => port.onMessage.emettre({
        t: 'hello', stats: SNAP.stats, config: SNAP.config, capabilities: SNAP.capabilities }), 0); return port; },
      onMessage: ecouteurs(), onConnect: ecouteurs(), onInstalled: ecouteurs()
    },
    tabs: { query: async () => [{ id: 3, title: 'shop.example.com', url: 'https://shop.example.com/' }],
            create: async () => ({}), update: async () => ({}) },
    windows: { getCurrent: async () => ({ id: 1 }), onRemoved: ecouteurs(), onBoundsChanged: ecouteurs() },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
    permissions: { contains: async () => false, request: async () => false },
    downloads: { download: async () => 1, onChanged: ecouteurs() },
    browserAction: { setBadgeText() {}, setBadgeBackgroundColor() {}, setBadgeTextColor() {}, setPopup() {} },
    sidebarAction: { open: async () => {} },
    extension: { getURL: p => '/' + p }
  };
  window.browser = api;
  window.chrome = api;
  window.__vue = (nom) => document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: nom } }));
})();`;
}

/* ============================== 4. Chrome ================================= */
function trouverChrome() {
  const candidats = [];
  const pw = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(pw)) {
    for (const d of fs.readdirSync(pw).filter(n => n.startsWith('chromium-')).sort().reverse()) {
      candidats.push(path.join(pw, d, 'chrome-win64', 'chrome.exe'));
      candidats.push(path.join(pw, d, 'chrome-linux', 'chrome'));
    }
  }
  candidats.push('C:/Program Files/Google/Chrome/Application/chrome.exe');
  candidats.push('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe');
  candidats.push('/usr/bin/google-chrome', '/usr/bin/chromium');
  return candidats.find(c => fs.existsSync(c)) || null;
}

const chrome = trouverChrome();
if (!chrome) {
  console.error('Aucun Chrome ou Chromium trouve : captures impossibles.');
  serveur.close();
  process.exit(1);
}

const profil = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'interceptor-shot-'));
const navigateur = spawn(chrome, [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
  '--user-data-dir=' + profil, '--window-size=' + LARGEUR + ',' + HAUTEUR, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const adresseCdp = await new Promise((resolve, reject) => {
  let tampon = '';
  const minuteur = setTimeout(() => reject(new Error('Chrome n a pas annonce son port de debogage')), 30000);
  navigateur.stderr.on('data', bloc => {
    tampon += bloc.toString();
    const m = /ws:\/\/[^\s]+/.exec(tampon);
    if (m) { clearTimeout(minuteur); resolve(m[0]); }
  });
});

/* --------------------------- Client CDP minimal --------------------------- */
const ws = new WebSocket(adresseCdp);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let sequence = 0;
const attentes = new Map();
const evenements = new Map();
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && attentes.has(msg.id)) {
    const { resoudre, rejeter } = attentes.get(msg.id);
    attentes.delete(msg.id);
    msg.error ? rejeter(new Error(msg.error.message)) : resoudre(msg.result);
  } else if (msg.method && evenements.has(msg.method)) {
    evenements.get(msg.method).forEach(f => f(msg.params));
  }
};
function envoyer(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resoudre, rejeter) => {
    attentes.set(id, { resoudre, rejeter });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const { targetId } = await envoyer('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await envoyer('Target.attachToTarget', { targetId, flatten: true });
const page = (m, p) => envoyer(m, p, sessionId);

await page('Page.enable');
await page('Runtime.enable');
await page('Emulation.setDeviceMetricsOverride', {
  width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 2, mobile: false
});
await page('Page.addScriptToEvaluateOnNewDocument', {
  source: scriptDeDemarrage(JSON.stringify({
    stats: premier.stats, config: premier.config,
    capabilities: premier.capabilities, version: '3.0.0'
  }))
});

const chargee = new Promise(resolve => evenements.set('Page.loadEventFired', [resolve]));
await page('Page.navigate', { url: 'http://127.0.0.1:' + port + '/ui/console.html' });
await chargee;

const patienter = ms => new Promise(r => setTimeout(r, ms));
await patienter(1500);

fs.mkdirSync(SORTIE, { recursive: true });
for (const [vue, fichier] of VUES) {
  await page('Runtime.evaluate', { expression: 'window.__vue(' + JSON.stringify(vue) + ')' });
  await patienter(700);
  const { data } = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const chemin = path.join(SORTIE, fichier + '.png');
  fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
  console.log('  ' + path.relative(RACINE, chemin).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(chemin).size / 1024) + ' Ko)');
}

/* Le panneau de detail, ouvert sur la requete la plus parlante. */
const cible = premier.records.find(r => r.method === 'POST');
if (cible) {
  await page('Runtime.evaluate', { expression: 'window.__vue("requests")' });
  await patienter(400);
  await page('Runtime.evaluate', {
    expression: 'document.dispatchEvent(new CustomEvent("ic:goto",'
      + '{ detail: { view: "requests", id: ' + cible.id + ' } }))'
  });
  await patienter(900);
  const { data } = await page('Page.captureScreenshot', { format: 'png' });
  const chemin = path.join(SORTIE, 'console-detail.png');
  fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
  console.log('  ' + path.relative(RACINE, chemin).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(chemin).size / 1024) + ' Ko)');
}

/* L onglet « En-tetes » de la page principale : c est la que se lisent la
   politique CSP et la fraicheur de cache, calculees a partir des entetes. */
const page1 = premier.records.find(r => r.type === 'main_frame');
if (page1) {
  await page('Runtime.evaluate', {
    expression: 'document.dispatchEvent(new CustomEvent("ic:goto",'
      + '{ detail: { view: "requests", id: ' + page1.id + ' } }))'
  });
  await patienter(800);
  await page('Runtime.evaluate', {
    expression: '(() => { const b = [...document.querySelectorAll("#dtabs .dtab")]'
      + '.find(x => /Headers|En-tetes/.test(x.textContent)); if (b) b.click(); })()'
  });
  await patienter(500);
  /* Le corps du panneau est defile jusqu aux blocs d analyse. */
  await page('Runtime.evaluate', {
    expression: '(() => { const c = document.querySelector("#dbody");'
      + ' if (c) c.scrollTop = c.scrollHeight; })()'
  });
  await patienter(400);
  const { data } = await page('Page.captureScreenshot', { format: 'png' });
  const chemin = path.join(SORTIE, 'console-entetes.png');
  fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
  console.log('  ' + path.relative(RACINE, chemin).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(chemin).size / 1024) + ' Ko)');
}

/* La popup, dans sa taille reelle. */
await page('Emulation.setDeviceMetricsOverride', {
  width: 380, height: 560, deviceScaleFactor: 2, mobile: false
});
const popupChargee = new Promise(resolve => evenements.set('Page.loadEventFired', [resolve]));
await page('Page.navigate', { url: 'http://127.0.0.1:' + port + '/ui/popup.html' });
await popupChargee;
await patienter(1200);
const popup = await page('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(SORTIE, 'popup.png'), Buffer.from(popup.data, 'base64'));
console.log('  docs/images/popup.png');

ws.close();
navigateur.kill();
serveur.close();
console.log('Captures terminees.');
process.exit(0);
