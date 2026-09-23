/* Audit d interaction — INTERCEPTOR (by NeoZ)
 *
 *   node tools/interaction.mjs
 *
 * Deux gestes que rien ne verifiait, parce qu il faut un vrai navigateur et
 * un vrai clavier pour les voir echouer :
 *
 *   1. TAPER dans un champ de filtre. Plusieurs vues filtrent pendant qu on
 *      tape, et se redessinent pour cela. Un redessin qui reconstruit le champ
 *      lui retirait le focus : la deuxieme lettre ne partait plus nulle part.
 *      L outil tape touche par touche et verifie que le champ a garde le focus
 *      et tout ce qui a ete tape.
 *
 *   2. LIRE pendant que la vue se redessine. Le « Flux direct » se redessine a
 *      chaque changement du trafic et, en suivi automatique, a chaque lecture
 *      de la session ; le panneau qui defile etait recree a chaque fois, et le
 *      lecteur renvoye en haut. L outil descend dans une longue session, fait
 *      redessiner la vue comme le fait l application, et verifie qu il est
 *      toujours au meme endroit.
 *
 * Il ne produit aucune image : un verdict, et un code de sortie.
 */
import { ouvrirScene } from './scene.mjs';
import { ouvrirChrome, patienter } from './chrome.mjs';

const TRAMES = 3000;
const scene = await ouvrirScene({ langue: 'fr', volume: 400, trames: TRAMES });
const navigateur = await ouvrirChrome({ largeur: 1400, hauteur: 900, echelle: 1 });
const page = navigateur.page;

await page('Page.addScriptToEvaluateOnNewDocument', {
  source: scene.scriptDeDemarrage(JSON.stringify(scene.instantane))
});
await page('Page.navigate', { url: 'http://127.0.0.1:' + scene.port + '/ui/console.html' });
await patienter(2500);

async function dans(expression) {
  const { result, exceptionDetails } = await page('Runtime.evaluate', {
    expression: '(async () => {' + expression + '})()', returnByValue: true, awaitPromise: true
  });
  if (exceptionDetails) {
    throw new Error(String(exceptionDetails.exception && exceptionDetails.exception.description
      || exceptionDetails.text).split('\n')[0]);
  }
  return result.value;
}

const ennuis = [];

/* La tuile de la longue session : celle qui compte TRAMES trames. */
const CHOISIR_SESSION = `
  const tuile = [...document.querySelectorAll('#view-streams .tile')]
    .find(t => t.querySelector('b') && t.querySelector('b').textContent.trim() === '${TRAMES}');
  if (!tuile) return false;
  tuile.click();
  await new Promise(r => setTimeout(r, 1200));
  return true;
`;

/* ============================== 1. Taper ================================== */
const CHAMPS = [
  { vue: 'streams', libelle: 'Flux direct — messages', indice: 'Filtrer les messages', avant: CHOISIR_SESSION },
  { vue: 'cookies', libelle: 'Journal des cookies', indice: 'Filtrer ce journal' },
  { vue: 'navigation', libelle: 'Journal de navigation', indice: 'Filtrer ce journal' },
  { vue: 'context', libelle: 'Workers et WebRTC', indice: 'Filtrer ce journal' },
  { vue: 'sitemap', libelle: 'Sites et chemins', indice: 'Filtrer par hote' },
  { vue: 'debug', libelle: 'Journal interne', indice: 'Chercher dans le journal' },
  { vue: 'tools', libelle: 'Boite a outils — reference', indice: 'chercher un code',
    avant: `[...document.querySelectorAll('#view-tools button')].find(b => b.textContent.trim() === 'Reference').click();
            await new Promise(r => setTimeout(r, 300)); return true;` }
];
const TEXTE = 'abc';
const TROUVER_CHAMP = indice => `
  const vue = document.querySelector('.view:not([hidden])');
  const champ = vue && [...vue.querySelectorAll('input')]
    .find(i => (i.placeholder || '').includes(${JSON.stringify(indice)}));`;

console.log('Taper, touche par touche :');
for (const champ of CHAMPS) {
  await dans(`window.__vue(${JSON.stringify(champ.vue)}); return true;`);
  await patienter(500);
  if (champ.avant) await dans(champ.avant);

  const trouve = await dans(TROUVER_CHAMP(champ.indice) + `
    if (!champ) return false;
    champ.value = '';
    champ.focus();
    return document.activeElement === champ;`);
  if (!trouve) { ennuis.push(champ.libelle + ' — champ introuvable'); continue; }

  for (const lettre of TEXTE) {
    await page('Input.insertText', { text: lettre });
    await patienter(80);
  }
  await patienter(500);          // les champs temporises attendent 220 ms

  const etat = await dans(TROUVER_CHAMP(champ.indice) + `
    return { valeur: champ ? champ.value : null, focus: !!champ && document.activeElement === champ };`);
  const ok = etat.focus && etat.valeur === TEXTE;
  console.log('  ' + champ.libelle.padEnd(30) + (ok ? 'ok'
    : 'valeur « ' + etat.valeur + ' », focus ' + (etat.focus ? 'garde' : 'PERDU')));
  if (!ok) {
    ennuis.push(champ.libelle + ' — apres « ' + TEXTE + ' » tape touche par touche, le champ contient « '
      + etat.valeur + ' » et ' + (etat.focus ? 'garde' : 'a perdu') + ' le focus');
  }
  /* On vide le filtre pour ne pas fausser la suite. */
  await dans(TROUVER_CHAMP(champ.indice) + `
    if (champ) { champ.value = ''; champ.dispatchEvent(new Event('input')); }
    return true;`);
  await patienter(400);
}

/* ============================== 2. Lire =================================== */
/* On descend dans la vue, on la fait redessiner comme le fait l application —
   un changement du trafic appelle le meme rendu — et on mesure ou l on est. */
const PANNEAU = vue => `document.querySelector('#view-${vue} .pane')`;
async function lecture(vue, libelle, preparer, profondeur) {
  await dans(`window.__vue('${vue}'); return true;`);
  await patienter(600);
  if (preparer && !(await dans(preparer))) { ennuis.push(libelle + ' — preparation impossible'); return; }

  /* Descendre par paliers, comme une molette : les lots suivants se posent. */
  const avant = await dans(`
    const p = ${PANNEAU(vue)};
    if (!p) return null;
    for (let i = 0; i < 30 && p.scrollTop < ${profondeur}; i++) {
      p.scrollTop = Math.min(${profondeur}, p.scrollTop + 400);
      await new Promise(r => setTimeout(r, 60));
    }
    return { haut: p.scrollTop, hauteur: p.scrollHeight };`);
  if (!avant || avant.haut < profondeur * 0.9) {
    ennuis.push(libelle + ' — impossible de descendre a ' + profondeur + ' px (' + JSON.stringify(avant) + ')');
    return;
  }

  await dans(`window.__vue('${vue}'); return true;`);      // le rendu que declenche le trafic
  await patienter(700);
  const apres = await dans(`const p = ${PANNEAU(vue)}; return p ? { haut: p.scrollTop } : null;`);
  const ecart = apres ? Math.abs(apres.haut - avant.haut) : Infinity;
  const ok = ecart <= 2;
  console.log('  ' + libelle.padEnd(30) + (ok ? 'ok (' + Math.round(apres.haut) + ' px)'
    : 'a ' + Math.round(avant.haut) + ' px avant, ' + (apres ? Math.round(apres.haut) : '?') + ' px apres'));
  if (!ok) {
    ennuis.push(libelle + ' — le lecteur etait a ' + Math.round(avant.haut) + ' px ; apres un redessin il est a '
      + (apres ? Math.round(apres.haut) : '?') + ' px');
  }
}

console.log('\nLire pendant un redessin :');
await lecture('streams', 'Flux direct — longue session', CHOISIR_SESSION, 6000);
/* Un cadre sans liste par lots : l arbre des sites, tout deplie. */
await lecture('sitemap', 'Sites et chemins — tout deplie', `
  const bouton = [...document.querySelectorAll('#view-sitemap button')]
    .find(b => b.textContent.trim() === 'Tout deplier');
  if (!bouton) return false;
  bouton.click();
  await new Promise(r => setTimeout(r, 500));
  return true;`, 2500);

navigateur.fermer();
scene.fermer();

console.log('');
if (!ennuis.length) {
  console.log('Interaction : chaque champ garde ce qui est tape, et le lecteur reste ou il est.');
  process.exit(0);
}
console.log('Interaction : ' + ennuis.length + ' defaut(s)');
for (const e of ennuis) console.log('  ' + e);
process.exit(1);
