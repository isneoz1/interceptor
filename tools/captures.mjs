/* Captures d ecran de la documentation — INTERCEPTOR (by NeoZ)
 *
 *   node tools/captures.mjs                     les images
 *   node tools/captures.mjs --texte --lang=fr   le texte rendu, pour le
 *                                               controle de traduction
 *
 * Rend la vraie console dans un Chromium sans interface, alimentee par un jeu
 * de trafic passe dans le VRAI noyau : meme magasin, meme analyseur, memes
 * statistiques que dans Firefox. Les images de `docs/images/` sont donc des
 * copies d ecran de l outil, pas des maquettes.
 *
 * La mise en place vit dans tools/scene.mjs, le pilotage du navigateur dans
 * tools/chrome.mjs : les vitrines et la video s appuient sur les memes.
 */
import fs from 'fs';
import path from 'path';
import { ouvrirScene } from './scene.mjs';
import { ouvrirChrome, patienter } from './chrome.mjs';

const ARGS = process.argv.slice(2);
const MODE_TEXTE = ARGS.includes('--texte');
const LANGUE = (ARGS.find(a => a.startsWith('--lang=')) || '--lang=en').slice(7);

const LARGEUR = 1600;
const HAUTEUR = 1000;

/* Les vues a photographier : identifiant interne, puis nom de fichier. */
const VUES = [
  ['requests', 'console-requetes'],
  ['alerts', 'console-securite'],
  ['summary', 'console-synthese'],
  ['sitemap', 'console-sites'],
  ['tools', 'console-outils'],
  ['rules', 'console-regles'],
  ['stats', 'console-etat'],
  ['settings', 'console-reglages'],
  ['help', 'console-aide']
];

const scene = await ouvrirScene({ langue: LANGUE });
const RACINE = scene.RACINE;
const SORTIE = path.join(RACINE, 'docs', 'images');
const premier = scene.instantane;

const navigateur = await ouvrirChrome({ largeur: LARGEUR, hauteur: HAUTEUR, echelle: 2 });
const page = navigateur.page;

await page('Page.addScriptToEvaluateOnNewDocument', {
  source: scene.scriptDeDemarrage(JSON.stringify({
    stats: premier.stats, config: premier.config,
    capabilities: premier.capabilities, version: scene.VERSION
  }))
});

const chargee = new Promise(resolve => navigateur.surEvenement('Page.loadEventFired', resolve));
await page('Page.navigate', { url: 'http://127.0.0.1:' + scene.port + '/ui/console.html' });
await chargee;
await patienter(900);

/* Le texte visible d une vue, fragment par fragment. */
const EXTRAIRE_TEXTE = `(() => {
  const vus = [];
  const parcours = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = parcours.nextNode())) {
    const t = (n.textContent || '').trim();
    if (t) vus.push(t);
  }
  return JSON.stringify(vus);
})()`;

const texteParVue = {};
for (const [vue, fichier] of VUES) {
  await page('Runtime.evaluate', { expression: 'window.__vue(' + JSON.stringify(vue) + ')' });
  await patienter(700);

  if (MODE_TEXTE) {
    const { result } = await page('Runtime.evaluate',
      { expression: EXTRAIRE_TEXTE, returnByValue: true });
    texteParVue[vue] = JSON.parse(result.value);
    continue;
  }

  const { data } = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const chemin = path.join(SORTIE, fichier + '.png');
  fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
  console.log('  ' + path.relative(RACINE, chemin).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(chemin).size / 1024) + ' Ko)');
}

if (MODE_TEXTE) {
  const cible = path.join(RACINE, 'dist', 'texte-' + LANGUE + '.json');
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, JSON.stringify(texteParVue, null, 1));
  console.log('  ' + path.relative(RACINE, cible).replace(/\\/g, '/') + '  ('
    + Object.values(texteParVue).reduce((n, l) => n + l.length, 0) + ' fragments)');
}

/* La reference, cherchee dans les quatorze tables a la fois. « timeout »
   ramene 408, 504, l en-tete Timeout, SETTINGS_TIMEOUT et
   NS_ERROR_NET_TIMEOUT : quatre tables dans une seule image. */
if (!MODE_TEXTE) {
  await page('Runtime.evaluate', { expression: 'window.__vue("tools")' });
  await patienter(400);

  const ouverture = await page('Runtime.evaluate', {
    expression: '(() => {'
      + ' const onglet = [...document.querySelectorAll("#view-tools .dtab")]'
      + '   .find(b => /^(Reference|Référence)$/i.test(b.textContent.trim()));'
      + ' if (!onglet) throw new Error("onglet Reference introuvable");'
      + ' onglet.click();'
      + '})()'
  });
  if (ouverture.exceptionDetails) {
    throw new Error('reference : ' + (ouverture.exceptionDetails.exception
      && ouverture.exceptionDetails.exception.description));
  }
  await patienter(400);

  const frappe = await page('Runtime.evaluate', {
    expression: '(() => {'
      + ' const champ = [...document.querySelectorAll("#view-tools input.field")]'
      + '   .find(i => /chercher|search/i.test(i.placeholder || ""));'
      + ' if (!champ) throw new Error("champ de recherche introuvable");'
      + ' champ.value = "timeout";'
      + ' champ.dispatchEvent(new Event("input", { bubbles: true }));'
      + '})()'
  });
  if (frappe.exceptionDetails) {
    throw new Error('recherche : ' + (frappe.exceptionDetails.exception
      && frappe.exceptionDetails.exception.description));
  }
  await patienter(500);

  const { data } = await page('Page.captureScreenshot', { format: 'png' });
  const chemin = path.join(SORTIE, 'console-reference.png');
  fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
  console.log('  ' + path.relative(RACINE, chemin).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(chemin).size / 1024) + ' Ko)');
}

/* La palette, ouverte et deja filtree : une capture vide ne montrerait ni le
   classement ni la mise en evidence des lettres tapees.

   « cookie » est choisi pour montrer les deux moities du registre a la fois,
   et la regle qui les departage : la vue Cookies passe devant l en-tete
   Cookie, puis viennent les lignes de reference que la palette explique
   depuis qu elle porte aussi les tables. */
if (!MODE_TEXTE) {
  await page('Runtime.evaluate', { expression: 'window.__vue("requests")' });
  await patienter(300);
  await page('Runtime.evaluate', {
    expression: 'document.dispatchEvent(new KeyboardEvent("keydown",'
      + ' { key: "k", ctrlKey: true, bubbles: true }))'
  });
  await patienter(400);
  await page('Runtime.evaluate', {
    /* Enveloppe dans une fonction : deux Runtime.evaluate partagent le meme
       contexte, et un `const` redeclare ferait echouer le second en silence. */
    expression: '(() => { const c = document.getElementById("pal-q");'
      + ' c.value = "cookie"; c.dispatchEvent(new Event("input", { bubbles: true })); })()'
  });
  await patienter(400);
  const { data } = await page('Page.captureScreenshot', { format: 'png' });
  const chemin = path.join(SORTIE, 'console-palette.png');
  fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
  console.log('  ' + path.relative(RACINE, chemin).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(chemin).size / 1024) + ' Ko)');
  await page('Runtime.evaluate', {
    expression: 'document.dispatchEvent(new KeyboardEvent("keydown",'
      + ' { key: "Escape", bubbles: true }))'
  });
  await patienter(250);
}

/* Le panneau de detail, ouvert sur la requete la plus parlante. */
const cible = premier.records.find(r => r.method === 'POST');
if (cible) {
  await page('Runtime.evaluate', { expression: 'window.__vue("requests")' });
  await patienter(400);
  await page('Runtime.evaluate', {
    expression: 'document.dispatchEvent(new CustomEvent("ic:goto",'
      + '{ detail: { view: "requests", id: ' + cible.id + ' } }))'
  });
  await patienter(900);
  const { data } = await page('Page.captureScreenshot', { format: 'png' });
  const chemin = path.join(SORTIE, 'console-detail.png');
  fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
  console.log('  ' + path.relative(RACINE, chemin).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(chemin).size / 1024) + ' Ko)');
}

/* L onglet « En-tetes » de la page principale : c est la que se lisent la
   politique CSP et la fraicheur de cache, calculees a partir des entetes. */
const page1 = premier.records.find(r => r.type === 'main_frame');
if (page1) {
  await page('Runtime.evaluate', {
    expression: 'document.dispatchEvent(new CustomEvent("ic:goto",'
      + '{ detail: { view: "requests", id: ' + page1.id + ' } }))'
  });
  await patienter(800);
  await page('Runtime.evaluate', {
    expression: '(() => { const b = [...document.querySelectorAll("#dtabs .dtab")]'
      + '.find(x => /Headers|En-tetes/.test(x.textContent)); if (b) b.click(); })()'
  });
  await patienter(500);
  /* Le corps du panneau est defile jusqu aux blocs d analyse. */
  await page('Runtime.evaluate', {
    expression: '(() => { const c = document.querySelector("#dbody");'
      + ' if (c) c.scrollTop = c.scrollHeight; })()'
  });
  await patienter(400);
  const { data } = await page('Page.captureScreenshot', { format: 'png' });
  const chemin = path.join(SORTIE, 'console-entetes.png');
  fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
  console.log('  ' + path.relative(RACINE, chemin).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(chemin).size / 1024) + ' Ko)');
}

/* La popup, dans sa taille reelle. */
await page('Emulation.setDeviceMetricsOverride', {
  width: 380, height: 560, deviceScaleFactor: 2, mobile: false
});
const popupChargee = new Promise(resolve => navigateur.surEvenement('Page.loadEventFired', resolve));
await page('Page.navigate', { url: 'http://127.0.0.1:' + scene.port + '/ui/popup.html' });
await popupChargee;
await patienter(1200);
const popup = await page('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(SORTIE, 'popup.png'), Buffer.from(popup.data, 'base64'));
console.log('  docs/images/popup.png');


navigateur.fermer();
scene.fermer();
console.log(MODE_TEXTE ? 'Texte extrait.' : 'Captures terminees.');
