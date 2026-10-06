/* Apercu d un theme — SWIFT (by NeoZ)
 *
 *   node tools/apercu-theme.mjs --theme=clair [--vue=requests] [--sortie=dossier]
 *
 * Rend la vraie console, alimentee par le vrai noyau comme tools/captures.mjs,
 * dans le theme demande, avec une ligne ouverte dans le detail. Sert a juger
 * un theme a l oeil apres en avoir mesure les contrastes (tests/contraste.mjs) :
 * la mesure dit que chaque paire se lit, l image dit si l ensemble tient.
 */
import fs from 'fs';
import path from 'path';
import { ouvrirScene } from './scene.mjs';
import { ouvrirChrome, patienter } from './chrome.mjs';

const ARGS = process.argv.slice(2);
const arg = (nom, defaut) => {
  const trouve = ARGS.find(a => a.startsWith('--' + nom + '='));
  return trouve ? trouve.slice(nom.length + 3) : defaut;
};
const THEME = arg('theme', 'clair');
const VUE = arg('vue', 'requests');

const scene = await ouvrirScene({ langue: arg('lang', 'en'), theme: THEME });
const SORTIE = path.resolve(arg('sortie', path.join(scene.RACINE, 'dist')));
fs.mkdirSync(SORTIE, { recursive: true });

const premier = scene.instantane;
const navigateur = await ouvrirChrome({ largeur: 1600, hauteur: 1000, echelle: 1 });
const page = navigateur.page;

await page('Page.addScriptToEvaluateOnNewDocument', {
  source: scene.scriptDeDemarrage(JSON.stringify({
    stats: premier.stats, config: premier.config, capabilities: premier.capabilities, version: scene.VERSION
  }))
});

const chargee = new Promise(resolve => navigateur.surEvenement('Page.loadEventFired', resolve));
await page('Page.navigate', { url: 'http://127.0.0.1:' + scene.port + '/ui/console.html' });
await chargee;
await patienter(900);

await page('Runtime.evaluate', { expression: 'window.__vue(' + JSON.stringify(VUE) + ')' });
await patienter(500);
if (VUE === 'requests') {
  /* Une ligne ouverte : la selection et le panneau de detail font partie de
     ce qu il faut juger. */
  await page('Runtime.evaluate', {
    expression: '(() => { const l = document.querySelectorAll("#tbody .trow"); if (l[8]) l[8].click(); })()'
  });
  await patienter(600);
}

const { data } = await page('Page.captureScreenshot', { format: 'png' });
const chemin = path.join(SORTIE, 'apercu-' + THEME + '-' + VUE + '.png');
fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
console.log('  ' + chemin);

navigateur.fermer();
scene.fermer();
