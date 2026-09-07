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
import { installerTout, egal, verifier, bilan } from './harnais.mjs';

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

bilan('Chargement de l interface');
