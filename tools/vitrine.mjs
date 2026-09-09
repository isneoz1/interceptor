/* Vitrines pour le depot — INTERCEPTOR (by NeoZ)
 *
 *   node tools/vitrine.mjs
 *
 * Un tableau de requetes est dense : c est ce qui fait sa valeur a l usage, et
 * ce qui le rend illisible en vignette. Quelqu un qui decouvre le depot voit
 * d abord une image de 200 pixels de large sur un telephone.
 *
 * Ces vitrines repondent a cela : une capture reelle, cadree sur ce qui compte,
 * accompagnee d une phrase qui dit ce qu on regarde. Rien n est maquette — les
 * images source viennent de tools/captures.mjs, donc du vrai noyau.
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
import { spawn } from 'child_process';

const RACINE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(RACINE, 'docs', 'images');
const ECHELLE = 2;

/* Chaque vitrine : le fichier produit, la capture source, le cadrage, et ce
   qu on affirme. Le cadrage est exprime en pourcentage de l image source. */
const VITRINES = [
  {
    fichier: 'vitrine-capture',
    source: 'console-requetes.png',
    titre: 'One request, one row',
    phrase: 'Eight capture layers observe the same call. A correlator merges them, so you '
      + 'never see it twice — and two identical polling GETs stay two rows, because they are '
      + 'two requests.',
    cadre: { x: 12, y: 0, largeur: 88, hauteur: 62 }
  },
  {
    fichier: 'vitrine-securite',
    source: 'console-securite.png',
    titre: 'Findings it can prove',
    phrase: 'Every finished request is audited on its own: exposed secrets, credentials sent '
      + 'in clear, exploitable CORS, cookies that will be rejected and why. Nothing is '
      + 'reported that cannot be demonstrated from the captured data.',
    cadre: { x: 12, y: 0, largeur: 88, hauteur: 62 }
  },
  {
    fichier: 'vitrine-palette',
    source: 'console-palette.png',
    titre: 'Ctrl+K, then type',
    phrase: 'Seventeen views, twenty-three tools and every action, reachable by name. Three '
      + 'letters are usually enough, and the ranking never changes under you.',
    cadre: { x: 24, y: 6, largeur: 52, hauteur: 58 }
  },
  {
    fichier: 'vitrine-outils',
    source: 'console-outils.png',
    titre: '134 transformations, all local',
    phrase: 'Encodings, digests, JWT, OTP, timestamps, identifiers, structured headers, '
      + 'HPACK. Nothing is uploaded anywhere to be decoded — there is no server to upload to.',
    cadre: { x: 12, y: 0, largeur: 88, hauteur: 62 }
  }
];

const LARGEUR = 1200;
const HAUTEUR = 630;

function dataUri(fichier) {
  return 'data:image/png;base64,'
    + fs.readFileSync(path.join(SORTIE, fichier)).toString('base64');
}

function page(v) {
  const { x, y, largeur, hauteur } = v.cadre;
  /* Le cadrage se fait en agrandissant l image puis en la decalant : la
     fenetre visible correspond alors a la zone demandee. */
  const zoom = 100 / largeur;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${LARGEUR}px; height: ${HAUTEUR}px; overflow: hidden; }
  body {
    background: #0D1117; color: #E6EDF3; position: relative;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  }
  /* Un degrade tres sourd, pas un halo colore : la lumiere doit venir de
     la capture elle-meme, pas d un effet pose derriere le titre. */
  .fond {
    position: absolute; inset: 0;
    background: radial-gradient(120% 80% at 78% -10%, #1A222E 0%, #0D1117 62%);
  }

  .texte { position: relative; padding: 44px 56px 0; }
  h1 { font-size: 38px; font-weight: 800; letter-spacing: -.5px; line-height: 1.1; }
  p { margin-top: 14px; font-size: 17px; line-height: 1.55; color: #9BA7B4; max-width: 900px; }

  /* La capture, cadree sur la zone qui porte le propos et posee en bas :
     elle deborde volontairement, pour donner la sensation d un outil plus
     grand que le cadre. */
  .ecran {
    position: absolute; left: 56px; right: 56px; top: 212px; bottom: -22px;
    border-radius: 8px 8px 0 0; overflow: hidden;
    border: 1px solid #30373F; border-bottom: 0;
    box-shadow: 0 -20px 60px rgba(0,0,0,.55);
  }
  .ecran img {
    position: absolute; width: ${zoom * 100}%;
    left: ${-x * zoom}%; top: ${-y * zoom * (LARGEUR / HAUTEUR) / (1600 / 1000)}%;
  }
  .pied {
    position: absolute; right: 56px; top: 46px;
    font-size: 12px; letter-spacing: 3.4px; color: #6E7781; font-weight: 600;
  }
</style></head><body>
  <div class="fond"></div>
  <div class="pied">INTERCEPTOR</div>
  <div class="texte"><h1>${v.titre}</h1><p>${v.phrase}</p></div>
  <div class="ecran"><img src="${dataUri(v.source)}"></div>
</body></html>`;
}

/* ------------------------------- Chromium --------------------------------- */
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
if (!chrome) { console.error('Aucun Chrome trouve : vitrines impossibles.'); process.exit(1); }

const profil = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'interceptor-vitrine-'));
const navigateur = spawn(chrome, [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--disable-gpu',
  '--hide-scrollbars', '--force-color-profile=srgb',
  '--user-data-dir=' + profil, '--window-size=' + LARGEUR + ',' + HAUTEUR, 'about:blank'
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
const cible = cibles.targetInfos.find(t => t.type === 'page');
const { sessionId } = await envoyer('Target.attachToTarget',
  { targetId: cible.targetId, flatten: true });
await envoyer('Page.enable', {}, sessionId);
await envoyer('Emulation.setDeviceMetricsOverride',
  { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: ECHELLE, mobile: false }, sessionId);

for (const v of VITRINES) {
  const source = path.join(SORTIE, v.source);
  if (!fs.existsSync(source)) {
    console.error('  capture source absente : ' + v.source + ' — lancez d abord tools/captures.mjs');
    continue;
  }
  await envoyer('Page.navigate',
    { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(page(v)) }, sessionId);
  await new Promise(r => setTimeout(r, 1600));
  const { data } = await envoyer('Page.captureScreenshot', { format: 'png' }, sessionId);
  const chemin = path.join(SORTIE, v.fichier + '.png');
  fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
  console.log('  ' + path.relative(RACINE, chemin).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(chemin).size / 1024) + ' Ko)');
}

ws.close();
navigateur.kill();
try { fs.rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
console.log('Vitrines terminees.');
