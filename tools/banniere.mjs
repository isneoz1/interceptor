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
import { rendrePages } from './chrome.mjs';

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
    background: #0D1117;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #E6EDF3;
    position: relative;
  }
  /* La lueur reste derriere l image, jamais derriere le texte : c est ce qui
     garde les lettres lisibles a la taille d une vignette. */
  .lueur {
    position: absolute; border-radius: 50%; filter: blur(90px); opacity: .38;
  }
  .l1 { width: 720px; height: 720px; right: -220px; top: -300px; background: #1E5FB8; }
  .l2 { width: 520px; height: 520px; left: -220px; bottom: -280px; background: #17394F; opacity: .5; }
  .cadre { position: relative; height: 100%; display: flex; align-items: center; padding: 0 64px; gap: 52px; }
  .gauche { width: 560px; flex: none; }
  .marque { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; }
  .marque svg { width: 60px; height: 60px; }
  .nom { font-size: 50px; font-weight: 800; letter-spacing: 3px; line-height: 1; }
  .par { font-size: 17px; color: #7C8794; letter-spacing: 4px; margin-top: 7px; }
  h1 {
    font-size: 33px; font-weight: 700; line-height: 1.25; letter-spacing: -.4px;
    margin-bottom: 16px;
  }
  h1 em { font-style: normal; color: #8DBDF5; }
  p.sous { font-size: 19px; line-height: 1.55; color: #9BA7B4; margin-bottom: 30px; }
  .chiffres { display: flex; gap: 34px; }
  .chiffre .n { font-size: 33px; font-weight: 800; color: #3FB950; line-height: 1; }
  .chiffre .q { font-size: 13.5px; color: #7C8794; margin-top: 7px; letter-spacing: .3px; }
  .droite { flex: 1; display: flex; justify-content: flex-end; }
  /* La console est inclinee et rognee : on montre qu il y a un vrai outil
     derriere sans pretendre qu on peut le lire a cette taille. */
  .ecran {
    width: 660px; border-radius: 8px; overflow: hidden;
    border: 1px solid #30373F;
    box-shadow: 0 34px 90px rgba(0,0,0,.72), 0 0 0 1px rgba(255,255,255,.05) inset;
    transform: perspective(1500px) rotateY(-15deg) rotateX(3deg) scale(1.1);
  }
  .ecran img { display: block; width: 100%; }
  .pied {
    position: absolute; left: 64px; bottom: 30px;
    font-size: 15px; color: #6E7781; letter-spacing: .4px;
  }
  .pied b { color: #9BA7B4; font-weight: 600; }
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

/* --------------------------------- Le rendu ------------------------------- */
const [image] = await rendrePages([{ html: PAGE, fichier: SORTIE }],
  { largeur: LARGEUR, hauteur: HAUTEUR, echelle: ECHELLE, attendreMs: 2500 });

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, image.octets);

console.log('  ' + path.relative(RACINE, SORTIE).replace(/\\/g, '/')
  + '  (' + LARGEUR * ECHELLE + 'x' + HAUTEUR * ECHELLE + ', '
  + Math.round(fs.statSync(SORTIE).size / 1024) + ' Ko)');
console.log('Banniere terminee. A deposer dans Settings > General > Social preview.');
