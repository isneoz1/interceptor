/* Audit d interaction — SWIFT (by D4RK)
 *
 *   node tools/interaction.mjs
 *
 * Trois gestes que rien ne verifiait, parce qu il faut un vrai navigateur, un
 * vrai clavier et une vraie souris pour les voir echouer :
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
 *   3. CLIQUER apres avoir tape, ou pendant qu une vue se redessine. Un champ
 *      s enregistre en perdant le focus, a l appui sur le bouton suivant, et
 *      sa vue se redessinait entre l appui et le relachement : le bouton etait
 *      remplace, le premier clic perdu. L outil tape puis clique avec une
 *      vraie souris (JSON Patch, Comparer), ouvre une ligne du tableau pendant
 *      un redessin, confirme une purge malgre les redessins des Statistiques,
 *      et verifie que ce qui est tape survit au redessin de sa vue.
 *
 * Il ne produit aucune image : un verdict, et un code de sortie.
 */
import { ouvrirScene } from './scene.mjs';
import { ouvrirChrome, patienter } from './chrome.mjs';
import { ouvrirFirefox, trouverFirefox } from './firefox.mjs';

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

/* ================ 3. Cliquer apres avoir tape, et pendant un redessin ======== */
/* Le geste le plus courant : taper dans un champ, puis cliquer ailleurs. Le
   champ s enregistre en perdant le focus — a l appui — et sa vue se
   redessinait aussitot, entre l appui et le relachement : le bouton vise
   etait remplace et le premier clic se perdait. De meme pour une vue qui se
   redessine d elle-meme pendant qu on clique. Tout est rejoue avec une vraie
   souris (appui, puis relachement), dans Chrome puis dans Firefox.

   Firefox sans fenetre active deplace le focus sans emettre blur ni change :
   les gestes qui reposent sur un champ valide en perdant le focus n y sont
   pas mesurables, et sont annonces comme tels plutot que comptes reussis. */
const BOUTON = (vue, libelle) => `[...document.querySelectorAll('#view-${vue} button')].find(b => b.textContent.trim() === ${JSON.stringify(libelle)})`;
const CHAMP = nom => `[...document.querySelectorAll('[data-champ]')].find(n => n.dataset.champ === ${JSON.stringify(nom)})`;

async function gestes(nav) {
  const constater = (libelle, ok, sinon) => {
    console.log('  ' + libelle.padEnd(62) + (ok ? 'ok' : 'ECHEC'));
    if (!ok) ennuis.push(nav.nom + ' · ' + libelle + ' — ' + sinon);
  };
  const nonMesurable = libelle => console.log('  ' + libelle.padEnd(62) + 'non mesurable sans fenetre active');
  const centre = selecteurJs => nav.dans(`const e = ${selecteurJs}; if (!e) return null; e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
  const cliquer = async selecteurJs => {
    const c = await centre(selecteurJs);
    if (!c) return false;
    await nav.appuyer(c);
    await patienter(80);
    await nav.lacher(c);
    await patienter(300);
    return true;
  };
  const taper = async texte => { await nav.taper(texte); await patienter(120); };

  console.log('\nCliquer apres avoir tape, et pendant un redessin — ' + nav.nom + ' :');
  if (nav.focusMesurable) {
    await nav.dans(`window.__vue('tools'); return true;`);
    await patienter(500);
    await nav.dans(`${BOUTON('tools', 'JSON Patch')}.click(); return true;`);
    await patienter(400);
    await cliquer(CHAMP('outils-entree'));
    await taper('{"a":1}');
    await cliquer(CHAMP('patch-autre'));
    const focusSecond = await nav.dans(`return document.activeElement === ${CHAMP('patch-autre')};`);
    constater('JSON Patch : un clic dans le second champ y met le focus', focusSecond,
      'apres avoir tape dans le texte de travail, le clic dans le second champ n y a pas mis le focus');
    if (!focusSecond) await cliquer(CHAMP('patch-autre'));
    await taper('[{"op":"add","path":"/b","value":2}]');
    await cliquer(BOUTON('tools', 'Appliquer le JSON Patch'));
    const patche = await nav.dans(`return document.querySelector('#view-tools').textContent;`);
    constater('JSON Patch : un seul clic applique le patch tape', patche.includes('Document patche') && patche.includes('"b": 2'),
      'apres avoir tape le patch, un clic sur « Appliquer le JSON Patch » n a rien produit');

    await nav.dans(`${BOUTON('tools', 'Comparer')}.click(); return true;`);
    await patienter(400);
    await cliquer(CHAMP('comparer-autre'));
    await taper('autre texte');
    /* Le « Vider » du panneau, dans la barre qui suit son champ : celui du
       texte de travail porte le meme libelle. */
    await cliquer(`[...${CHAMP('comparer-autre')}.nextElementSibling.querySelectorAll('button')].find(b => b.textContent.trim() === 'Vider')`);
    const vide = await nav.dans(`const z = ${CHAMP('comparer-autre')}; return z ? z.value : null;`);
    constater('Comparer : un seul clic sur « Vider » apres avoir tape', vide === '',
      'le second champ contient encore « ' + vide + ' »');
  } else {
    nonMesurable('JSON Patch : taper, puis un clic dans le second champ');
    nonMesurable('JSON Patch : un seul clic applique le patch tape');
    nonMesurable('Comparer : un seul clic sur « Vider » apres avoir tape');
  }

  /* Une ligne du tableau cliquee pendant que le tableau se redessine. */
  await nav.dans(`window.__vue('requests'); return true;`);
  await patienter(800);
  const ligne = await centre(`document.querySelector('#tbody .trow')`);
  if (!ligne) ennuis.push(nav.nom + ' · Tableau — aucune ligne a cliquer');
  else {
    await nav.appuyer(ligne);
    await nav.dans(`window.__vue('requests'); return true;`);       // le rendu que declenche le trafic
    await patienter(60);
    await nav.lacher(ligne);
    await patienter(700);
    const ouvert = await nav.dans(`return !document.querySelector('#detail').hidden;`);
    constater('Tableau : une ligne cliquee pendant un redessin s ouvre', ouvert,
      'le tableau s est redessine entre l appui et le relachement, et le detail ne s est pas ouvert');
    await nav.dans(`const b = document.querySelector('#d-close'); if (b) b.click(); return true;`);
    await patienter(300);
  }

  /* Un bouton a deux temps dans une vue redessinee chaque seconde. */
  await nav.dans(`window.__vue('stats'); return true;`);
  await patienter(600);
  await cliquer(BOUTON('stats', 'Purger le stockage'));
  for (let i = 0; i < 2; i++) { await nav.dans(`window.__vue('stats'); return true;`); await patienter(250); }
  const arme = await nav.dans(`return !!${BOUTON('stats', 'Confirmer la purge ?')};`);
  constater('Statistiques : la purge reste armee malgre les redessins', arme,
    'apres deux redessins, le bouton est revenu a « Purger le stockage » : le second clic ne ferait que rearmer');
  if (arme) {
    await cliquer(BOUTON('stats', 'Confirmer la purge ?'));
    const fini = await nav.dans(`return !!${BOUTON('stats', 'Purger le stockage')} && !!document.querySelector('#view-stats p.note.ok, #view-stats p.note.ko');`);
    constater('Statistiques : le second clic purge', fini, 'le second clic n a pas lance la purge');
  }

  /* Ce qui est tape sans etre valide survit a un redessin de sa vue. Chrome
     valide un champ retire de la page ; Firefox non — c est la que la reprise
     de la saisie compte. */
  for (const [vue, champ, libelle] of [
    ['settings', 'reglage-interceptFilter', 'Reglages'],
    ['intercept', 'intercept-filtre', 'Interception']
  ]) {
    await nav.dans(`window.__vue('${vue}'); return true;`);
    await patienter(600);
    await nav.dans(`const z = ${CHAMP(champ)}; if (z) z.value = ''; return true;`);
    await cliquer(CHAMP(champ));
    await taper('ap');
    await nav.dans(`window.__vue('${vue}'); return true;`);            // la configuration diffusee, la file relue
    await patienter(300);
    await taper('i');
    const etat = await nav.dans(`const z = ${CHAMP(champ)}; return { valeur: z ? z.value : null, focus: !!z && document.activeElement === z };`);
    constater(libelle + ' : la frappe survit a un redessin', etat.valeur === 'api' && etat.focus,
      'apres « ap », un redessin, puis « i » : le champ contient « ' + etat.valeur + ' », focus ' + (etat.focus ? 'garde' : 'perdu'));
  }
  if (!nav.focusMesurable) {
    nonMesurable('Interception : la frappe reprise est enregistree en quittant');
    return;
  }
  /* Valide en quittant le champ, la frappe reprise est bien enregistree. */
  await cliquer(`document.querySelector('#view-intercept h2, #view-intercept .sec, #view-intercept p')`);
  await patienter(500);
  await nav.dans(`window.__vue('intercept'); return true;`);
  await patienter(400);
  const garde = await nav.dans(`const z = ${CHAMP('intercept-filtre')}; return z ? z.value : null;`);
  constater('Interception : la frappe reprise est enregistree en quittant', garde === 'api',
    'apres avoir quitte le champ et redessine, le filtre vaut « ' + garde + ' »');
}

await gestes({
  nom: 'Chrome', focusMesurable: true, dans,
  appuyer: async c => {
    await page('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
    await page('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  },
  lacher: c => page('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 }),
  taper: texte => page('Input.insertText', { text: texte })
});
navigateur.fermer();

/* Le meme parcours dans Firefox, le navigateur de l extension. */
if (trouverFirefox()) {
  const firefox = await ouvrirFirefox({ largeur: 1400, hauteur: 900 });
  await firefox.precharger(scene.scriptDeDemarrage(JSON.stringify(scene.instantane)));
  await firefox.naviguer('http://127.0.0.1:' + scene.port + '/ui/console.html');
  await patienter(2500);
  const focusMesurable = await firefox.dans(`return document.hasFocus();`);
  await gestes({ nom: 'Firefox', focusMesurable, dans: firefox.dans,
    appuyer: firefox.appuyer, lacher: () => firefox.lacher(), taper: firefox.taper });
  firefox.fermer();
} else {
  console.log('\n  (Firefox absent : le parcours n est rejoue que dans Chrome)');
}
scene.fermer();

console.log('');
if (!ennuis.length) {
  console.log('Interaction : chaque champ garde ce qui est tape, le lecteur reste ou il est, et aucun clic ne se perd.');
  process.exit(0);
}
console.log('Interaction : ' + ennuis.length + ' defaut(s)');
for (const e of ennuis) console.log('  ' + e);
process.exit(1);
