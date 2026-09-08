/* Chargement de l interface — INTERCEPTOR (cree par D4RK)
 *
 * Un module d interface qui ne se charge pas laisse une vue vide, sans erreur
 * visible ailleurs que dans la console du navigateur. Ce test importe TOUS les
 * modules de `ui/` sous le harnais et echoue au premier qui refuse de se
 * charger, ainsi qu au premier export annonce mais absent.
 *
 * Il verifie aussi que le graphe de modules est complet : aucun import ne
 * pointe dans le vide, et aucun fichier n est laisse en dehors du graphe (un
 * module que plus personne n importe est du code mort qui ne s execute jamais).
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
import { installerTout, egal, proche, verifier, bilan } from './harnais.mjs';

installerTout();

const racine = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const relatif = p => path.relative(racine, p).split(path.sep).join('/');

function fichiersJs(dossier) {
  const out = [];
  (function parcourir(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const rel = relatif(p);
      if (rel.startsWith('dist') || rel.startsWith('.git') || rel.startsWith('node_modules')
        || rel.startsWith('tests')) continue;
      if (e.isDirectory()) parcourir(p);
      else if (e.name.endsWith('.js')) out.push(rel);
    }
  })(dossier);
  return out;
}

/* Les deux points d entree demarrent des leur import : ils construisent la
   page et appellent le noyau. Ils sont couverts par le graphe ci-dessous et
   par la verification des surfaces du script de construction. */
const POINTS_D_ENTREE = ['ui/console.js', 'ui/popup.js'];

/* -------------------------- 1. Chargement effectif ------------------------ */
const modulesUi = fichiersJs(path.join(racine, 'ui')).filter(f => !POINTS_D_ENTREE.includes(f));
let charges = 0;
for (const rel of modulesUi) {
  try {
    const mod = await import(url.pathToFileURL(path.join(racine, rel)).href);
    verifier('le module ' + rel + ' expose au moins un nom', Object.keys(mod).length > 0);
    charges++;
  } catch (e) {
    verifier('le module ' + rel + ' se charge', false, String(e.message).split('\n')[0]);
  }
}
verifier('tous les modules d interface se chargent', charges === modulesUi.length,
  charges + ' / ' + modulesUi.length);
verifier('l interface compte plus de cent modules', modulesUi.length > 100);

/* ------------------------- 2. Graphe complet ------------------------------ */
/* Reconstruit le graphe depuis les points d entree reels de l extension, tels
   que le manifest et les pages HTML les declarent. */
const ENTREES = [
  'background/background.js', 'ui/console.js', 'ui/popup.js',
  'content/bridge.js', 'content/hooks.js'
];

function specificateurs(source) {
  const out = [];
  const re = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(source))) out.push(m[1] || m[2]);
  return out;
}

const atteints = new Set();
const introuvables = [];
function suivre(rel) {
  if (atteints.has(rel)) return;
  atteints.add(rel);
  const abs = path.join(racine, rel);
  if (!fs.existsSync(abs)) { introuvables.push(rel); return; }
  for (const spec of specificateurs(fs.readFileSync(abs, 'utf8'))) {
    if (!spec.startsWith('.')) continue;
    suivre(relatif(path.resolve(path.dirname(abs), spec)));
  }
}
for (const entree of ENTREES) suivre(entree);

egal('aucun import ne pointe dans le vide', introuvables.join(', '), '');

const tousLesJs = fichiersJs(racine);
const orphelins = tousLesJs.filter(f => !atteints.has(f));
egal('aucun module hors du graphe', orphelins.join(', '), '');
verifier('le graphe couvre tous les fichiers JavaScript', atteints.size === tousLesJs.length,
  atteints.size + ' atteints pour ' + tousLesJs.length + ' fichiers');

/* --------------------- 3. Coherence avec les pages HTML ------------------- */
/* Un `<script src>` qui pointe a cote donne une page blanche. */
for (const page of ['ui/console.html', 'ui/popup.html', 'background/background.html']) {
  const html = fs.readFileSync(path.join(racine, page), 'utf8');
  for (const m of html.matchAll(/src="([^"]+)"/g)) {
    const cible = path.resolve(path.dirname(path.join(racine, page)), m[1]);
    verifier(page + ' reference ' + m[1], fs.existsSync(cible));
  }
  for (const m of html.matchAll(/href="([^"]+\.css)"/g)) {
    const cible = path.resolve(path.dirname(path.join(racine, page)), m[1]);
    verifier(page + ' reference la feuille ' + m[1], fs.existsSync(cible));
  }
}

/* --------------------- 4. Coherence avec le manifest ---------------------- */
const manifest = JSON.parse(fs.readFileSync(path.join(racine, 'manifest.json'), 'utf8'));
const surfaces = [
  manifest.background && manifest.background.page,
  manifest.browser_action && manifest.browser_action.default_popup,
  manifest.sidebar_action && manifest.sidebar_action.default_panel,
  manifest.options_ui && manifest.options_ui.page
].filter(Boolean);
for (const surface of surfaces) {
  verifier('la surface « ' + surface + ' » existe sur le disque',
    fs.existsSync(path.join(racine, surface)));
}
for (const script of (manifest.content_scripts || []).flatMap(c => c.js || [])) {
  verifier('le script de contenu ' + script + ' existe', fs.existsSync(path.join(racine, script)));
}
for (const ressource of manifest.web_accessible_resources || []) {
  verifier('la ressource accessible ' + ressource + ' existe',
    fs.existsSync(path.join(racine, ressource)));
}
verifier('la version du manifest est renseignee', /^\d+\.\d+\.\d+$/.test(manifest.version));

/* ------------------- 5. Lisibilite : contraste mesure -------------------- */
/* Une interface sombre a neons est vite jolie et illisible. Chaque paire
   couleur / fond declaree dans le theme est mesuree selon la formule du
   WCAG 2.1 : la construction s arrete si l une passe sous le seuil. */
const { mesurerTheme, contraste, lireCouleur, aplatir, luminance } =
  await import('./contraste.mjs');

const themes = mesurerTheme(path.join(racine, 'ui/theme.css'));
for (const [nom, paires] of Object.entries(themes)) {
  verifier('le theme ' + nom + ' declare assez de paires a controler', paires.length >= 30,
    paires.length + ' paires');
  for (const p of paires) {
    if (p.ratio >= p.seuil) continue;
    verifier('theme ' + nom + ' : ' + p.quoi, false,
      'contraste ' + p.ratio.toFixed(2) + ', seuil ' + p.seuil);
  }
  const sousLeSeuil = paires.filter(p => p.ratio < p.seuil).length;
  egal('theme ' + nom + ' : aucune paire sous le seuil de lecture', sousLeSeuil, 0);
}

/* La formule elle-meme, verifiee sur les deux extremes connus : le noir sur
   blanc vaut 21, une couleur sur elle-meme vaut 1. */
proche('contraste du noir sur blanc', contraste('#000000', '#FFFFFF'), 21, 0.01);
proche('contraste d une couleur sur elle-meme', contraste('#8A7BFF', '#8A7BFF'), 1, 0.001);
proche('luminance du blanc', luminance(lireCouleur('#FFFFFF')), 1, 0.001);
proche('luminance du noir', luminance(lireCouleur('#000000')), 0, 0.001);
/* Une couleur translucide posee sur un fond doit donner le melange exact. */
const melange = aplatir(lireCouleur('rgba(255, 255, 255, .5)'), lireCouleur('#000000'));
proche('aplatissement d une couleur a demi transparente', melange.r, 127.5, 0.01);

/* --------------------- 6. Invariante du defilement ----------------------- */
/* Le tableau ne dessine que les lignes visibles ; deux cales tiennent la place
   des autres. Si leur somme avec les lignes dessinees ne vaut pas exactement la
   hauteur totale, `scrollHeight` change a chaque image et le defilement saute.
   On le verifie sur des hauteurs fractionnaires, celles que produit la mise a
   l echelle : c est precisement la ou l ancien arrondi derivait. */
const { fenetreVirtuelle, memeFenetre } = await import('../ui/lib/fenetre-virtuelle.js');

const HAUTEURS = [28, 29.96, 30.8, 32.2, 34.16, 23, 26.22];
let derives = 0;
let horsBornes = 0;
for (const h of HAUTEURS) {
  for (const total of [1, 7, 100, 5000, 250000]) {
    const hauteurTotale = total * h;
    for (let pas = 0; pas <= 40; pas++) {
      const scrollTop = (hauteurTotale * pas) / 40;
      const f = fenetreVirtuelle(scrollTop, 800, h, total, 12);
      const somme = f.haut + (f.derniere - f.premiere) * h + f.bas;
      if (Math.abs(somme - hauteurTotale) > 1e-6) derives++;
      if (f.premiere < 0 || f.derniere > total || f.premiere > f.derniere) horsBornes++;
    }
  }
}
egal('la somme des cales et des lignes vaut toujours la hauteur totale', derives, 0);
egal('la fenetre reste dans les bornes du tableau', horsBornes, 0);

/* Une position au-dela du contenu ne doit jamais donner une page vide : c est
   ce qui arrive juste apres un filtrage ou une suppression. */
const trop = fenetreVirtuelle(1e9, 800, 30, 50, 12);
verifier('une position hors contenu affiche quand meme des lignes',
  trop.derniere > trop.premiere);
egal('la derniere ligne reste la derniere', trop.derniere, 50);

const vide = fenetreVirtuelle(0, 800, 30, 0, 12);
egal('aucun contenu : aucune ligne', vide.derniere, 0);
egal('aucun contenu : aucune cale', vide.haut + vide.bas, 0);

/* La marge doit reellement dessiner au-dela de l ecran, dans les deux sens. */
const milieu = fenetreVirtuelle(300 * 30, 600, 30, 1000, 12);
egal('marge appliquee avant la premiere ligne visible', milieu.premiere, 300 - 12);
verifier('marge appliquee apres la derniere ligne visible', milieu.derniere >= 300 + 20 + 12);

/* Des valeurs absurdes ne doivent pas produire NaN ni Infinity. */
for (const [st, vp, h, n] of [[NaN, 800, 30, 10], [-100, 800, 30, 10], [0, 0, 30, 10],
  [0, 800, 0, 10], [0, 800, 30, -5]]) {
  const f = fenetreVirtuelle(st, vp, h, n, 12);
  verifier('entree absurde traitee sans NaN (' + st + ',' + vp + ',' + h + ',' + n + ')',
    Number.isFinite(f.haut) && Number.isFinite(f.bas)
    && Number.isFinite(f.premiere) && Number.isFinite(f.derniere));
}

verifier('deux fenetres identiques sont reconnues',
  memeFenetre({ premiere: 3, derniere: 9 }, { premiere: 3, derniere: 9 }) === true);
verifier('deux fenetres differentes sont distinguees',
  memeFenetre({ premiere: 3, derniere: 9 }, { premiere: 4, derniere: 9 }) === false);
verifier('une fenetre absente n est jamais identique', memeFenetre(null, { premiere: 0, derniere: 0 }) === false);

/* --------------------- 7. Couverture de la traduction -------------------- */
/* Le francais est la langue source : la cle de traduction EST le texte
   francais. Une chaine passee a `t`, `kv`, `sec` ou `button` sans entree au
   dictionnaire reste donc en francais quand l interface est en anglais — sans
   erreur, sans trace, simplement une etiquette qui ne bascule pas.
   Ce test rend cet oubli impossible. */
const { EN } = await import('../ui/lib/dict-en.js');
verifier('le dictionnaire anglais est charge', Object.keys(EN).length > 1500,
  Object.keys(EN).length + ' entrees');

/* Les quatre fonctions qui traduisent leur premier argument. */
const APPELS_TRADUITS = /\b(?:t|tp|kv|sec|button)\(\s*'((?:[^'\\]|\\.)*)'/g;

/* Ce qui n a pas a etre traduit : symboles, syntaxe de filtre, noms propres. */
const SANS_TRADUCTION = new Set([
  'INTERCEPTOR', 'D4RK', 'JSON', 'HTTP', 'URL', 'IP', 'TLS', 'DNS', 'CSP', 'JWT',
  'HMAC-', 'Vary', 'Opcode', 'CORS', 'HAR', 'UUID', 'ULID', 'MIME'
]);

const sansEntree = new Map();
for (const rel of fichiersJs(path.join(racine, 'ui'))) {
  if (rel.includes('/dict-en')) continue;          // le dictionnaire lui-meme
  // i18n.js definit `t` et `tp` : les seules chaines qu il contient sont les
  // exemples de leurs commentaires, jamais du texte affiche.
  if (rel === 'ui/lib/i18n.js') continue;
  const source = fs.readFileSync(path.join(racine, rel), 'utf8');
  for (const m of source.matchAll(APPELS_TRADUITS)) {
    const texte = m[1].replace(/\\'/g, "'");
    if (!texte.trim() || !/[a-zA-Z]/.test(texte)) continue;   // symboles seuls
    if (SANS_TRADUCTION.has(texte)) continue;
    if (EN[texte] !== undefined) continue;
    if (!sansEntree.has(texte)) sansEntree.set(texte, rel);
  }
}

for (const [texte, ou] of sansEntree) {
  verifier('la chaine ' + JSON.stringify(texte.slice(0, 60)) + ' a une traduction', false, ou);
}
egal('aucune chaine visible sans traduction anglaise', sansEntree.size, 0);

/* Une cle definie deux fois est un piege silencieux : la derniere ecrase la
   precedente selon l ordre de fusion, sans erreur ni trace. C est ainsi que la
   colonne « Duree » s est retrouvee traduite par « Lifetime » au lieu de
   « Duration ». Toute redefinition est desormais un echec. */
const CLE_DICT = /^\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*:/;
const definitions = new Map();
for (const rel of fichiersJs(path.join(racine, 'ui/lib'))) {
  if (!/\/dict-en/.test(rel)) continue;
  const source = fs.readFileSync(path.join(racine, rel), 'utf8');
  for (const ligne of source.split('\n')) {
    const m = CLE_DICT.exec(ligne);
    if (!m) continue;
    const cle = m[1].slice(1, -1);
    if (!definitions.has(cle)) definitions.set(cle, []);
    definitions.get(cle).push(rel);
  }
}
const redefinies = [...definitions.entries()].filter(([, ou]) => ou.length > 1);
for (const [cle, ou] of redefinies) {
  verifier('la cle ' + JSON.stringify(cle.slice(0, 40)) + ' n est definie qu une fois',
    false, ou.join(' et '));
}
egal('aucune cle de traduction definie deux fois', redefinies.length, 0);
verifier('le dictionnaire couvre plus de deux mille chaines', definitions.size > 2000,
  definitions.size + ' cles');

/* Le dictionnaire ne doit pas non plus se contredire : une cle traduite par
   elle-meme est soit un mot identique dans les deux langues, soit un oubli. */
const identiques = Object.entries(EN).filter(([cle, valeur]) => cle === valeur);
verifier('les traductions identiques a leur cle restent rares',
  identiques.length < Object.keys(EN).length * 0.2,
  identiques.length + ' entrees identiques sur ' + Object.keys(EN).length);

bilan('Chargement de l interface');
