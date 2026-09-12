/* Audit d affichage — INTERCEPTOR (by NeoZ)
 *
 *   node tools/affichage.mjs
 *   node tools/affichage.mjs --largeurs=360,1600
 *
 * La meme page sert d onglet plein ecran, de panneau lateral et de page
 * d options. Un panneau lateral fait 350 px de large : ce qui tient dans
 * 1600 px n y tient pas forcement, et personne ne l avait regarde.
 *
 * Cet outil ouvre chaque vue a plusieurs largeurs et cherche quatre choses
 * qui se voient toutes a l oeil nu, mais qu il faut avoir l idee de regarder :
 *
 *   1. un debordement horizontal de la page — la barre du bas qui apparait ;
 *   2. un element plus large que son parent, donc coupe ;
 *   3. deux elements qui se chevauchent alors qu ils devraient s empiler ;
 *   4. un texte tronque sans que rien ne l annonce.
 *
 * Il ne produit aucune image : un verdict, et un code de sortie.
 */
import { ouvrirScene } from './scene.mjs';
import { ouvrirChrome, patienter } from './chrome.mjs';

const ARGS = process.argv.slice(2);
const LARGEURS = (ARGS.find(a => a.startsWith('--largeurs=')) || '--largeurs=350,700,1100,1600')
  .slice(11).split(',').map(Number).filter(n => n > 0);
const HAUTEUR = 900;

/* Les vues, telles que la barre laterale les nomme. */
const VUES = ['requests', 'alerts', 'summary', 'streams', 'sitemap', 'stats',
  'rules', 'intercept', 'tools', 'settings', 'debug', 'tutorial', 'help'];

const scene = await ouvrirScene({ langue: 'en', volume: 400 });
const navigateur = await ouvrirChrome({ largeur: Math.max(...LARGEURS), hauteur: HAUTEUR, echelle: 1 });
const page = navigateur.page;

await page('Page.addScriptToEvaluateOnNewDocument', {
  source: scene.scriptDeDemarrage(JSON.stringify(scene.instantane))
});
await page('Page.navigate', { url: 'http://127.0.0.1:' + scene.port + '/ui/console.html' });
await patienter(2500);

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

const ennuis = [];
const noter = (ou, quoi) => ennuis.push(ou + ' — ' + quoi);

/* Tout regarder d un coup : une seule traversee du document par vue. */
const INSPECTION = `
  const vue = document.querySelector('.view:not([hidden])');
  if (!vue) return { absente: true };

  const doc = document.documentElement;
  const debordePage = doc.scrollWidth - doc.clientWidth;

  const trop = [];
  const coupes = [];
  const chevauchements = [];

  const visible = el => {
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.01;
  };
  const nom = el => el.tagName.toLowerCase()
    + (el.id ? '#' + el.id : '')
    + (el.className && typeof el.className === 'string' && el.className.trim()
       ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');

  const elements = [...vue.querySelectorAll('*')].filter(visible);
  for (const el of elements) {
    const parent = el.parentElement;
    if (!parent || parent === vue) continue;
    /* Un contenu plus large que son cadre est legitime des qu un ANCETRE
       defile horizontalement : les colonnes du tableau debordent de leur
       grille, mais « #tablewrap » les ramene sous les yeux. Regarder le seul
       parent direct faisait crier au loup a chaque colonne. */
    let defilant = false;
    for (let a = parent; a && a !== document.body; a = a.parentElement) {
      const sa = getComputedStyle(a);
      if (sa.overflowX === 'auto' || sa.overflowX === 'scroll') { defilant = true; break; }
    }
    if (defilant) continue;
    const r = el.getBoundingClientRect();
    const rp = parent.getBoundingClientRect();
    if (r.width > 1 && rp.width > 1 && r.right > rp.right + 2) {
      trop.push(nom(el) + ' depasse ' + nom(parent) + ' de '
        + Math.round(r.right - rp.right) + ' px');
    }
    /* Un texte coupe sans ellipse ni defilement : personne ne saura qu il
       manque quelque chose. */
    /* Un champ de saisie defile en lui-meme : un texte plus long que sa
       boite y est normal, pas coupe. */
    const balise = el.tagName;
    if (balise === 'INPUT' || balise === 'TEXTAREA' || balise === 'SELECT') continue;
    if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2) {
      const st = getComputedStyle(el);
      if (st.textOverflow !== 'ellipsis' && st.overflowX !== 'auto'
        && st.overflowX !== 'scroll' && st.whiteSpace !== 'nowrap') {
        coupes.push(nom(el) + ' tronque de ' + (el.scrollWidth - el.clientWidth) + ' px');
      }
    }
  }

  /* Chevauchements entre freres qui devraient s empiler. */
  for (const parent of [...vue.querySelectorAll('*')].filter(visible)) {
    const s = getComputedStyle(parent);
    if (s.display !== 'block' && s.display !== 'flex') continue;
    if (s.display === 'flex' && s.flexDirection.indexOf('row') === 0) continue;
    if (s.position === 'absolute' || s.position === 'fixed') continue;
    const freres = [...parent.children].filter(visible).filter(c => {
      const cs = getComputedStyle(c);
      return cs.position !== 'absolute' && cs.position !== 'fixed' && cs.position !== 'sticky';
    });
    for (let i = 1; i < freres.length; i++) {
      const a = freres[i - 1].getBoundingClientRect();
      const b = freres[i].getBoundingClientRect();
      if (a.height < 1 || b.height < 1) continue;
      if (b.top < a.bottom - 2 && b.left < a.right - 2 && b.right > a.left + 2) {
        chevauchements.push(nom(freres[i]) + ' recouvre ' + nom(freres[i - 1]));
        break;
      }
    }
  }

  return {
    debordePage,
    examines: elements.length,
    trop: [...new Set(trop)].slice(0, 6),
    coupes: [...new Set(coupes)].slice(0, 6),
    chevauchements: [...new Set(chevauchements)].slice(0, 6)
  };
`;

for (const largeur of LARGEURS) {
  await page('Emulation.setDeviceMetricsOverride',
    { width: largeur, height: HAUTEUR, deviceScaleFactor: 1, mobile: false });
  await patienter(400);
  console.log('\n=== ' + largeur + ' px ===');

  for (const vue of VUES) {
    await dans(`window.__vue(${JSON.stringify(vue)}); return true;`);
    await patienter(450);
    const r = await dans(INSPECTION);
    if (!r || r.absente) { noter(vue + ' @' + largeur, 'aucune vue visible'); continue; }

    const ou = vue + ' @' + largeur + 'px';
    if (r.debordePage > 2) noter(ou, 'la page deborde de ' + r.debordePage + ' px en largeur');
    for (const d of r.trop) noter(ou, d);
    for (const c of r.coupes) noter(ou, c);
    for (const c of r.chevauchements) noter(ou, c);

    const compte = r.trop.length + r.coupes.length + r.chevauchements.length
      + (r.debordePage > 2 ? 1 : 0);
    console.log('  ' + vue.padEnd(10) + String(r.examines).padStart(5) + ' elements'
      + (compte ? '   ' + compte + ' anomalie(s)' : ''));
  }
}

navigateur.fermer();
scene.fermer();

console.log('');
if (!ennuis.length) {
  console.log('Affichage : rien a signaler.');
  process.exit(0);
}
console.log('Affichage : ' + ennuis.length + ' anomalie(s)');
for (const e of ennuis) console.log('  ' + e);
process.exit(1);
