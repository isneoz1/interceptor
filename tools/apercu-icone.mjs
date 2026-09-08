/* Apercu de l icone aux tailles reelles — INTERCEPTOR (by NeoZ)
 *
 * Une icone se juge a 16 px dans une barre d outils, pas a 128 px dans un
 * editeur. Ce rendu la pose cote a cote aux tailles ou Firefox l affiche
 * vraiment, sur fond sombre et sur fond clair.
 *
 *   node tools/apercu-icone.mjs
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
import { spawn } from 'child_process';

const RACINE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(RACINE, 'docs', 'images', 'icone-apercu.png');
const TAILLES = [16, 24, 32, 48, 64, 96, 128];

const icone = 'data:image/svg+xml;base64,' +
  fs.readFileSync(path.join(RACINE, 'icons', 'icon.svg')).toString('base64');

const rangee = fond => `
  <div class="rangee" style="background:${fond}">
    ${TAILLES.map(t => `<div class="case">
      <img src="${icone}" width="${t}" height="${t}">
      <span style="color:${fond === '#06060F' ? '#AEB4E8' : '#555'}">${t}</span>
    </div>`).join('')}
  </div>`;

const PAGE = `<!doctype html><meta charset="utf-8"><style>
  body { margin:0; font-family: "Segoe UI", system-ui, sans-serif; }
  .rangee { display:flex; align-items:flex-end; gap:34px; padding:34px 40px; }
  .case { display:flex; flex-direction:column; align-items:center; gap:10px; }
  .case span { font-size:11px; letter-spacing:.5px; }
</style>${rangee('#06060F')}${rangee('#F4F4F8')}`;

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
  candidats.push('/usr/bin/google-chrome', '/usr/bin/chromium');
  return candidats.find(c => fs.existsSync(c)) || null;
}

const chrome = trouverChrome();
if (!chrome) { console.error('Aucun Chrome trouve.'); process.exit(1); }

const profil = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'interceptor-icone-'));
const navigateur = spawn(chrome, [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--disable-gpu',
  '--hide-scrollbars', '--force-color-profile=srgb',
  '--user-data-dir=' + profil, '--window-size=900,380', 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const adresseCdp = await new Promise((resolve, reject) => {
  let tampon = '';
  const minuteur = setTimeout(() => reject(new Error('port de debogage absent')), 30000);
  navigateur.stderr.on('data', b => {
    tampon += b.toString();
    const m = /ws:\/\/[^\s]+/.exec(tampon);
    if (m) { clearTimeout(minuteur); resolve(m[0]); }
  });
});

const ws = new WebSocket(adresseCdp);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let sequence = 0;
const attentes = new Map();
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && attentes.has(m.id)) {
    const { resoudre, rejeter } = attentes.get(m.id);
    attentes.delete(m.id);
    m.error ? rejeter(new Error(m.error.message)) : resoudre(m.result);
  }
};
const envoyer = (method, params = {}, sessionId) => {
  const id = ++sequence;
  return new Promise((resoudre, rejeter) => {
    attentes.set(id, { resoudre, rejeter });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });
};

const cibles = await envoyer('Target.getTargets');
const page = cibles.targetInfos.find(t => t.type === 'page');
const { sessionId } = await envoyer('Target.attachToTarget', { targetId: page.targetId, flatten: true });
await envoyer('Page.enable', {}, sessionId);
await envoyer('Emulation.setDeviceMetricsOverride',
  { width: 900, height: 380, deviceScaleFactor: 2, mobile: false }, sessionId);
await envoyer('Page.navigate',
  { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(PAGE) }, sessionId);
await new Promise(r => setTimeout(r, 1200));

const { data } = await envoyer('Page.captureScreenshot', { format: 'png' }, sessionId);
fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, Buffer.from(data, 'base64'));
console.log('  ' + path.relative(RACINE, SORTIE).replace(/\\/g, '/'));

ws.close();
navigateur.kill();
try { fs.rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
