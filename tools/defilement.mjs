/* Audit du defilement — INTERCEPTOR (by NeoZ)
 *
 *   node tools/defilement.mjs              20 000 lignes
 *   node tools/defilement.mjs --lignes=5000
 *
 * Le README affirme que le tableau reste fluide a des dizaines de milliers de
 * lignes. Rien ne le verifiait : la scene de demonstration en compte une
 * vingtaine, soit moins d un ecran. Ce qui se passe QUAND ON DESCEND — trous
 * entre deux lots, lignes qui se chevauchent ou se repetent, hauteur qui bouge
 * sous la molette, liste qui cesse de se charger — n avait jamais ete regarde.
 *
 * Cet outil descend pour de bon, dans un vrai navigateur, et verifie a chaque
 * palier quatre choses :
 *
 *   1. les lignes dessinees se suivent sans trou ni doublon d indice ;
 *   2. elles couvrent toute la zone visible, du haut au bas de l ecran ;
 *   3. `scrollHeight` ne bouge pas d une image a l autre — c est lui qui fait
 *      sauter la barre de defilement quand il change ;
 *   4. les listes rendues par lots finissent par tout poser, sans se bloquer.
 *
 * Il ne produit aucune image : il rend un verdict, et un code de sortie.
 */
import { ouvrirScene } from './scene.mjs';
import { ouvrirChrome, patienter } from './chrome.mjs';

const ARGS = process.argv.slice(2);
const LIGNES = Number((ARGS.find(a => a.startsWith('--lignes=')) || '--lignes=20000').slice(9));
const LARGEUR = 1600;
const HAUTEUR = 1000;

const scene = await ouvrirScene({ langue: 'en', volume: LIGNES });
const navigateur = await ouvrirChrome({ largeur: LARGEUR, hauteur: HAUTEUR });
const page = navigateur.page;

await page('Page.addScriptToEvaluateOnNewDocument', {
  source: scene.scriptDeDemarrage(JSON.stringify(scene.instantane))
});
await page('Page.navigate', { url: 'http://127.0.0.1:' + scene.port + '/ui/console.html' });
await patienter(2500);

const ennuis = [];
function noter(quoi, detail) { ennuis.push(quoi + ' — ' + detail); }

/** Evalue une expression dans la page et rend sa valeur. */
async function dans(expression) {
  const { result, exceptionDetails } = await page('Runtime.evaluate', {
    expression: '(() => {' + expression + '})()', returnByValue: true, awaitPromise: true
  });
  if (exceptionDetails) {
    throw new Error(String(exceptionDetails.exception && exceptionDetails.exception.description
      || exceptionDetails.text).split('\n')[0]);
  }
  return result.value;
}

/* ======================= 1. Le tableau des requetes ======================== */
await dans('window.__vue("requests"); return true;');
await patienter(800);

/* Le perimetre par defaut est l onglet actif : on regarde tout, sinon le
   volume ajoute reste invisible. */
await dans(`
  const s = document.getElementById('scope');
  if (s) { s.value = 'all'; s.dispatchEvent(new Event('change', { bubbles: true })); }
  return true;
`);
await patienter(1200);

const etatTableau = () => dans(`
  const wrap = document.getElementById('tablewrap');
  const body = document.getElementById('tbody');
  if (!wrap || !body) return null;
  const lignes = [...body.querySelectorAll('.trow')];
  const indices = lignes.map(l => Number(l.dataset.index));
  const rects = lignes.map(l => l.getBoundingClientRect());
  const cadre = wrap.getBoundingClientRect();
  /* L en-tete est colle en haut du cadre : les lignes commencent SOUS lui.
     Mesurer depuis le haut du cadre comptait sa hauteur comme un trou. */
  const tete = document.getElementById('thead');
  const plafond = tete ? tete.getBoundingClientRect().bottom : cadre.top;
  return {
    scrollTop: wrap.scrollTop,
    scrollHeight: wrap.scrollHeight,
    clientHeight: wrap.clientHeight,
    dessinees: lignes.length,
    premier: indices.length ? Math.min(...indices) : null,
    dernier: indices.length ? Math.max(...indices) : null,
    doublons: indices.length - new Set(indices).size,
    trous: indices.length ? (Math.max(...indices) - Math.min(...indices) + 1) - indices.length : 0,
    hautVide: rects.length ? Math.round(rects[0].top - plafond) : null,
    basVide: rects.length ? Math.round(cadre.bottom - rects[rects.length - 1].bottom) : null,
    chevauchement: rects.some((r, i) => i > 0 && r.top < rects[i - 1].bottom - 1),
    compteur: (document.getElementById('count') || {}).textContent || ''
  };
`);

const depart = await etatTableau();
if (!depart) {
  noter('tableau', 'introuvable dans la page');
} else {
  console.log('Tableau : ' + depart.scrollHeight + ' px de contenu, '
    + depart.dessinees + ' lignes dessinees, ' + depart.clientHeight + ' px visibles');
  if (depart.scrollHeight < LIGNES * 10) {
    noter('tableau', 'contenu trop court pour ' + LIGNES + ' lignes : '
      + depart.scrollHeight + ' px');
  }
}

/* On descend par paliers d un ecran, comme le fait la molette. */
const PAS = Math.max(1, Math.floor(HAUTEUR * 0.8));
const paliers = [];
let hauteurReference = depart ? depart.scrollHeight : 0;
let position = 0;
let mesures = 0;

while (depart && position < depart.scrollHeight) {
  await dans(`document.getElementById('tablewrap').scrollTop = ${position}; return true;`);
  await patienter(60);
  const etat = await etatTableau();
  mesures++;

  if (etat.doublons) noter('defilement a ' + position, etat.doublons + ' indice(s) en double');
  if (etat.trous) noter('defilement a ' + position, etat.trous + ' ligne(s) manquante(s) dans la fenetre');
  if (etat.chevauchement) noter('defilement a ' + position, 'des lignes se chevauchent');
  if (etat.hautVide > 2) noter('defilement a ' + position, 'bande vide de ' + etat.hautVide + ' px en haut');
  if (etat.basVide > 2 && etat.scrollTop + etat.clientHeight < etat.scrollHeight - 2) {
    noter('defilement a ' + position, 'bande vide de ' + etat.basVide + ' px en bas');
  }
  if (Math.abs(etat.scrollHeight - hauteurReference) > 1) {
    noter('defilement a ' + position, 'la hauteur du contenu a change de '
      + (etat.scrollHeight - hauteurReference) + ' px');
    hauteurReference = etat.scrollHeight;
  }
  paliers.push(etat.dessinees);
  position += PAS;
}

/* Et on remonte : le chemin inverse revele les fenetres mal bornees. */
while (depart && position > 0) {
  position -= PAS * 3;
  if (position < 0) position = 0;
  await dans(`document.getElementById('tablewrap').scrollTop = ${position}; return true;`);
  await patienter(60);
  const etat = await etatTableau();
  mesures++;
  if (etat.doublons) noter('remontee a ' + position, etat.doublons + ' indice(s) en double');
  if (etat.trous) noter('remontee a ' + position, etat.trous + ' ligne(s) manquante(s)');
  if (etat.chevauchement) noter('remontee a ' + position, 'des lignes se chevauchent');
  if (etat.hautVide > 2) noter('remontee a ' + position, 'bande vide de ' + etat.hautVide + ' px en haut');
}

console.log('  ' + mesures + ' paliers mesures, '
  + Math.min(...paliers) + ' a ' + Math.max(...paliers) + ' lignes dessinees a la fois');

/* ==================== 2. Le temps que met un palier ======================= */
if (depart) {
  const duree = await dans(`
    const wrap = document.getElementById('tablewrap');
    const debut = performance.now();
    for (let i = 0; i < 40; i++) {
      wrap.scrollTop = (i * 997) % Math.max(1, wrap.scrollHeight - wrap.clientHeight);
      wrap.dispatchEvent(new Event('scroll'));
    }
    return performance.now() - debut;
  `);
  const parPalier = duree / 40;
  console.log('  ' + parPalier.toFixed(2) + ' ms par palier de defilement');
  if (parPalier > 16) noter('fluidite', parPalier.toFixed(1) + ' ms par palier (au-dela d une image a 60 Hz)');
}

/* ============== 3. Les listes rendues par lots, en descendant ============= */
/* Cinq vues rendent par lots. La carte des sites est la seule a recevoir du
   volume ici : un hote frequente y porte des milliers de requetes, et c est
   exactement le cas ou un chargement qui se bloque se verrait. */
await dans('window.__vue("sitemap"); return true;');
await patienter(1500);

/* On deplie tout : la liste par lots vit dans les noeuds ouverts. */
const deplies = await dans(`
  const vue = document.getElementById('view-sitemap');
  if (!vue) return -1;
  let n = 0;
  for (const d of vue.querySelectorAll('details')) { if (!d.open) { d.open = true; n++; } }
  return n;
`);
console.log('  carte des sites : ' + deplies + ' noeud(s) deplie(s)');
await patienter(1200);

const compter = () => dans(`
  const vue = document.getElementById('view-sitemap');
  return {
    elements: vue.querySelectorAll('.kv.copyable').length,
    sentinelles: vue.querySelectorAll('.sentinelle').length
  };
`);

let avant = await compter();
let apres = avant;
let bloque = 0;
for (let i = 0; i < 30 && apres.sentinelles; i++) {
  const precedent = apres.elements;
  await dans(`
    const vue = document.getElementById('view-sitemap');
    const defilant = vue.closest('.view') || vue;
    defilant.scrollTop = defilant.scrollHeight;
    for (const s of vue.querySelectorAll('.sentinelle')) {
      s.scrollIntoView({ block: 'end' });
    }
    return true;
  `);
  await patienter(260);
  apres = await compter();
  if (apres.elements === precedent) bloque++; else bloque = 0;
  /* Trois passages sans un seul element de plus, alors que des sentinelles
     restent en place : la liste ne pose plus rien. */
  if (bloque >= 3) {
    noter('carte des sites', 'la liste s arrete a ' + apres.elements
      + ' elements avec ' + apres.sentinelles + ' sentinelle(s) encore en place');
    break;
  }
}
console.log('  carte des sites : ' + avant.elements + ' elements au depart, '
  + apres.elements + ' apres defilement, ' + apres.sentinelles + ' sentinelle(s) restante(s)');

navigateur.fermer();
scene.fermer();

console.log('');
if (!ennuis.length) {
  console.log('Defilement : rien a signaler.');
  process.exit(0);
}
console.log('Defilement : ' + ennuis.length + ' anomalie(s)');
const vus = new Set();
for (const e of ennuis) {
  const cle = e.replace(/\d+/g, 'N');
  if (vus.has(cle)) continue;
  vus.add(cle);
  console.log('  ' + e);
}
process.exit(1);
