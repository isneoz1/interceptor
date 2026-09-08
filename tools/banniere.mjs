/* Banniere de partage social — INTERCEPTOR (by NeoZ)
 *
 * C est l image qu affichent X, Reddit, Discord, LinkedIn et Slack quand
 * quelqu un colle le lien du depot. Sans elle, GitHub sert une vignette
 * generique : un octochat gris et le nom du depot. Elle vaut donc davantage
 * que tout ce qu on peut ecrire dans le README, puisqu elle passe en premier.
 *
 * GitHub attend 1280x640. On rend au double puis on laisse GitHub reduire :
 * le texte reste net sur les ecrans a forte densite.
 *
 * Comme pour les captures, rien n est maquette : la vignette de console
 * incrustee est le fichier produit par tools/captures.mjs, donc le vrai
 * noyau, les vraies requetes, le vrai analyseur.
 *
 *   node tools/banniere.mjs
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
import { spawn } from 'child_process';

const RACINE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const LARGEUR = 1280;
const HAUTEUR = 640;
const ECHELLE = 2;

const SORTIE = path.join(RACINE, 'docs', 'images', 'social-preview.png');
const CONSOLE = path.join(RACINE, 'docs', 'images', 'console-requetes.png');

/* ------------------------- Les chiffres, recomptes ------------------------ */
/* Une banniere qui annonce un chiffre faux est pire qu une banniere sans
   chiffre. Le nombre d assertions se relit donc dans le badge du README, que
   build.ps1 confronte lui-meme au total reel des cinq suites. */
const readme = fs.readFileSync(path.join(RACINE, 'README.md'), 'utf8');
const assertions = (readme.match(/Assertions-([0-9]+)-/) || [])[1];
if (!assertions) throw new Error('badge d assertions introuvable dans le README');

const CHIFFRES = [
  ['8', 'capture layers'],
  ['0', 'duplicated rows'],
  ['0', 'dependencies'],
  [assertions, 'assertions']
];

/* ------------------------------ Le gabarit -------------------------------- */
function dataUri(fichier) {
  return 'data:image/png;base64,' + fs.readFileSync(fichier).toString('base64');
}

const icone = fs.readFileSync(path.join(RACINE, 'icons', 'icon.svg'), 'utf8');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${LARGEUR}px; height: ${HAUTEUR}px; overflow: hidden; }
  body {
    background: #06060F;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #EEF0FF;
    position: relative;
  }
  /* La lueur reste derriere l image, jamais derriere le texte : c est ce qui
     garde les lettres lisibles a la taille d une vignette. */
  .lueur {
    position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55;
  }
  .l1 { width: 620px; height: 620px; right: -180px; top: -220px; background: #8A7BFF; }
  .l2 { width: 520px; height: 520px; left: -200px; bottom: -260px; background: #54C8FF; opacity: .35; }
  .cadre { position: relative; height: 100%; display: flex; align-items: center; padding: 0 64px; gap: 52px; }
  .gauche { width: 560px; flex: none; }
  .marque { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; }
  .marque svg { width: 60px; height: 60px; }
  .nom { font-size: 50px; font-weight: 800; letter-spacing: 3px; line-height: 1; }
  .par { font-size: 17px; color: #AEB4E8; letter-spacing: 4px; margin-top: 7px; }
  h1 {
    font-size: 33px; font-weight: 700; line-height: 1.25; letter-spacing: -.4px;
    margin-bottom: 16px;
  }
  h1 em { font-style: normal; color: #C9BEFF; }
  p.sous { font-size: 19px; line-height: 1.55; color: #C3C8F0; margin-bottom: 30px; }
  .chiffres { display: flex; gap: 34px; }
  .chiffre .n { font-size: 33px; font-weight: 800; color: #3DF5A5; line-height: 1; }
  .chiffre .q { font-size: 13.5px; color: #AEB4E8; margin-top: 7px; letter-spacing: .3px; }
  .droite { flex: 1; display: flex; justify-content: flex-end; }
  /* La console est inclinee et rognee : on montre qu il y a un vrai outil
     derriere sans pretendre qu on peut le lire a cette taille. */
  .ecran {
    width: 660px; border-radius: 14px; overflow: hidden;
    border: 1px solid rgba(138,123,255,.45);
    box-shadow: 0 34px 90px rgba(0,0,0,.72), 0 0 0 1px rgba(255,255,255,.05) inset;
    transform: perspective(1500px) rotateY(-15deg) rotateX(3deg) scale(1.1);
  }
  .ecran img { display: block; width: 100%; }
  .pied {
    position: absolute; left: 64px; bottom: 30px;
    font-size: 15px; color: #868CC6; letter-spacing: .4px;
  }
  .pied b { color: #AEB4E8; font-weight: 600; }
</style></head><body>
  <div class="lueur l1"></div><div class="lueur l2"></div>
  <div class="cadre">
    <div class="gauche">
      <div class="marque">
        ${icone}
        <div>
          <div class="nom">INTERCEPTOR</div>
          <div class="par">BY NEOZ</div>
        </div>
      </div>
      <h1>Every request Firefox makes —<br><em>captured, explained, rewritable.</em></h1>
      <p class="sous">Response bodies off the wire, the JavaScript stack behind
      each call, the TLS suite that carried it. Block it, rewrite it, replay it.</p>
      <div class="chiffres">
        ${CHIFFRES.map(([n, q]) => `<div class="chiffre"><div class="n">${n}</div><div class="q">${q}</div></div>`).join('')}
      </div>
    </div>
    <div class="droite"><div class="ecran"><img src="${dataUri(CONSOLE)}"></div></div>
  </div>
  <div class="pied">Open source · MIT · no telemetry · <b>github.com/isneoz1/interceptor</b></div>
</body></html>`;

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
  candidats.push('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe');
  candidats.push('/usr/bin/google-chrome', '/usr/bin/chromium');
  return candidats.find(c => fs.existsSync(c)) || null;
}

const chrome = trouverChrome();
if (!chrome) {
  console.error('Aucun Chrome ou Chromium trouve : banniere impossible.');
  process.exit(1);
}

const profil = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'interceptor-banniere-'));
const navigateur = spawn(chrome, [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
  '--user-data-dir=' + profil, '--window-size=' + LARGEUR + ',' + HAUTEUR, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const adresseCdp = await new Promise((resolve, reject) => {
  let tampon = '';
  const minuteur = setTimeout(() => reject(new Error('Chrome n a pas annonce son port')), 30000);
  navigateur.stderr.on('data', bloc => {
    tampon += bloc.toString();
    const m = /ws:\/\/[^\s]+/.exec(tampon);
    if (m) { clearTimeout(minuteur); resolve(m[0]); }
  });
});

const ws = new WebSocket(adresseCdp);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let sequence = 0;
const attentes = new Map();
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && attentes.has(msg.id)) {
    const { resoudre, rejeter } = attentes.get(msg.id);
    attentes.delete(msg.id);
    msg.error ? rejeter(new Error(msg.error.message)) : resoudre(msg.result);
  }
};
function envoyer(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resoudre, rejeter) => {
    attentes.set(id, { resoudre, rejeter });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });
}

const cibles = await envoyer('Target.getTargets');
const page = cibles.targetInfos.find(t => t.type === 'page');
const { sessionId } = await envoyer('Target.attachToTarget', { targetId: page.targetId, flatten: true });

await envoyer('Page.enable', {}, sessionId);
await envoyer('Emulation.setDeviceMetricsOverride', {
  width: LARGEUR, height: HAUTEUR, deviceScaleFactor: ECHELLE, mobile: false
}, sessionId);

await envoyer('Page.navigate', {
  url: 'data:text/html;charset=utf-8,' + encodeURIComponent(PAGE)
}, sessionId);

/* On attend que la page ait fini de peindre : l image incrustee pese
   plusieurs centaines de kilo-octets, elle n est pas prete des le navigate. */
await new Promise(resolve => setTimeout(resolve, 2500));

const { data } = await envoyer('Page.captureScreenshot', { format: 'png' }, sessionId);
fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, Buffer.from(data, 'base64'));

const ko = Math.round(fs.statSync(SORTIE).size / 1024);
console.log('  ' + path.relative(RACINE, SORTIE).replace(/\\/g, '/') +
            '  (' + LARGEUR * ECHELLE + 'x' + HAUTEUR * ECHELLE + ', ' + ko + ' Ko)');

ws.close();
navigateur.kill();

/* Windows garde le profil verrouille un instant apres kill() : un echec de
   menage ne doit pas faire echouer une banniere deja ecrite sur le disque. */
try {
  fs.rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
} catch {
  console.log('  (profil temporaire laisse a Windows : ' + profil + ')');
}
console.log('Banniere terminee. A deposer dans Settings > General > Social preview.');
