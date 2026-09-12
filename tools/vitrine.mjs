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
import { rendrePages } from './chrome.mjs';

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
    phrase: 'Seventeen views, twenty-three tools, every action and the 691 reference lines, '
      + 'reachable by name. Ask where a screen is, or what a header means — same box. '
      + 'Commands still come first.',
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

/* --------------------------------- Le rendu ------------------------------- */
/* Une capture source absente n est pas une erreur de ce fichier : c est que
   tools/captures.mjs n a pas encore tourne. On le dit et on passe. */
const aRendre = [];
for (const v of VITRINES) {
  if (!fs.existsSync(path.join(SORTIE, v.source))) {
    console.error('  capture source absente : ' + v.source
      + ' — lancez d abord tools/captures.mjs');
    continue;
  }
  aRendre.push({ html: page(v), fichier: path.join(SORTIE, v.fichier + '.png') });
}

const images = await rendrePages(aRendre,
  { largeur: LARGEUR, hauteur: HAUTEUR, echelle: ECHELLE, attendreMs: 1600 });

for (const { fichier, octets } of images) {
  fs.writeFileSync(fichier, octets);
  console.log('  ' + path.relative(RACINE, fichier).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(fichier).size / 1024) + ' Ko)');
}
console.log('Vitrines terminees.');
