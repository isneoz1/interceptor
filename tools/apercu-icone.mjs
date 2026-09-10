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
import { rendrePages } from './chrome.mjs';

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

/* --------------------------------- Le rendu ------------------------------- */
const [image] = await rendrePages([{ html: PAGE, fichier: SORTIE }],
  { largeur: 900, hauteur: 380, echelle: 2, attendreMs: 1200 });

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, image.octets);
console.log('  ' + path.relative(RACINE, SORTIE).replace(/\\/g, '/'));
