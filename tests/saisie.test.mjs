/* Clics et saisie a travers les redessins — SWIFT (by D4RK)
 *
 *   node tests/saisie.test.mjs
 *
 * Plusieurs vues se redessinent d elles-memes, ou parce qu un champ perd le
 * focus. Trois choses se perdaient :
 *
 *   1. le CLIC : un redessin entre l appui et le relachement remplacait le
 *      bouton vise, et le clic n arrivait nulle part — il fallait cliquer deux
 *      fois apres avoir tape dans un champ de la boite a outils, et une ligne
 *      du tableau cliquee pendant le trafic ne s ouvrait pas. lib/appui.js
 *      reporte ces redessins juste apres le clic : verifie ici avec de vrais
 *      evenements, sur un EventTarget ;
 *   2. le FOCUS et la SAISIE : le champ recree n est retrouve que par son nom
 *      (dataset.champ). Chaque champ des vues qui se redessinent doit en porter
 *      un, unique dans sa vue — la boite a outils et ses vingt-trois panneaux,
 *      les Regles (chaque action, chaque operation d entete), les Reglages,
 *      l Interception et ses requetes suspendues, le Flux direct, les journaux,
 *      les Sites et le Journal interne ;
 *   3. le REDESSIN INUTILE : la vue Interception relisait sa file chaque
 *      seconde et se redessinait a chaque fois, meme sans changement.
 *
 * Le geste lui-meme — taper, puis cliquer avec une vraie souris — est rejoue
 * dans un vrai navigateur par tools/interaction.mjs.
 */
import path from 'node:path';
import url from 'node:url';
import { installerTout, installerPage, egal, verifier, bilan } from './harnais.mjs';

installerTout();
const racine = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
installerPage(racine);

/* Une suite coupee avant son bilan ne doit jamais sortir en succes. */
let auBilan = false;
process.on('exit', () => {
  if (auBilan) return;
  console.log('  Clics et saisie : suite interrompue avant son bilan');
  process.exitCode = 1;
});

const { config } = await import('../background/core/config.js');
await config.ready;
const { state } = await import('../ui/app.js');
const A = await import('../ui/lib/appui.js');

/* ======================= 1. Un clic n est jamais perdu ===================== */
const cible = new EventTarget();
A.ecouterAppui(cible, null);
const evenement = (type, extra = {}) => Object.assign(new Event(type), extra);
const apresLeClic = () => new Promise(r => setTimeout(r, 5));

let fait = 0;
A.differerSiAppui('vue', () => { fait++; });
egal('sans appui, le redessin a lieu tout de suite', fait, 1);

let journal = [];
cible.dispatchEvent(evenement('pointerdown'));
A.differerSiAppui('vue', () => journal.push('premier'));
A.differerSiAppui('vue', () => journal.push('dernier'));
A.differerSiAppui('autre', () => journal.push('autre vue'));
egal('pendant l appui, rien ne se redessine', journal.length, 0);
cible.dispatchEvent(evenement('pointerup'));
egal('au relachement, le clic passe avant tout redessin', journal.length, 0);
await apresLeClic();
egal('apres le clic, la derniere demande de chaque vue, une seule fois', journal.join(', '), 'dernier, autre vue');

/* Le clic redessine lui-meme : la demande reportee devient inutile. */
journal = [];
cible.dispatchEvent(evenement('pointerdown'));
A.differerSiAppui('vue', () => journal.push('reportee'));
cible.dispatchEvent(evenement('pointerup'));
A.differerSiAppui('vue', () => journal.push('du clic'));
await apresLeClic();
egal('un redessin fait par le clic remplace celui qui attendait', journal.join(', '), 'du clic');

/* Un relachement hors de la fenetre : le premier mouvement sans bouton. */
journal = [];
cible.dispatchEvent(evenement('pointerdown'));
A.differerSiAppui('vue', () => journal.push('apres'));
cible.dispatchEvent(evenement('pointermove', { buttons: 1 }));
await apresLeClic();
egal('bouton toujours enfonce : on attend encore', journal.length, 0);
cible.dispatchEvent(evenement('pointermove', { buttons: 0 }));
await apresLeClic();
egal('un relachement manque est constate au mouvement suivant', journal.join(', '), 'apres');

/* Un nouvel appui avant que le redessin parte : il attend ce second clic. */
journal = [];
cible.dispatchEvent(evenement('pointerdown'));
A.differerSiAppui('vue', () => journal.push('une fois'));
cible.dispatchEvent(evenement('pointerup'));
cible.dispatchEvent(evenement('pointerdown'));
await apresLeClic();
egal('un second appui tout de suite : le redessin attend encore', journal.length, 0);
cible.dispatchEvent(evenement('pointercancel'));
await apresLeClic();
egal('un appui annule libere aussi le redessin, une fois', journal.join(', '), 'une fois');

/* Une vue qui plante ne prive pas les autres de leur redessin, et son erreur
   ne disparait pas. L ecouteur ne recueille que l erreur signalee apres coup :
   une erreur levee tout de suite est rattrapee ici, sinon elle aurait coupe
   la suite en silence. */
journal = [];
let signalee = null;
let tropTot = null;
const surErreur = e => { signalee = e; };
process.on('uncaughtException', surErreur);
try {
  cible.dispatchEvent(evenement('pointerdown'));
  A.differerSiAppui('cassee', () => { throw new Error('vue cassee'); });
  A.differerSiAppui('saine', () => journal.push('saine'));
  cible.dispatchEvent(evenement('pointerup'));
} catch (e) { tropTot = e; }
await apresLeClic();
await apresLeClic();
process.removeListener('uncaughtException', surErreur);
verifier('pendant l appui, une vue qui plante ne plante pas avant le clic', tropTot === null, String(tropTot));
egal('une vue qui plante n empeche pas les autres de se redessiner', journal.join(', '), 'saine');
verifier('son erreur est signalee, pas avalee', !!signalee && signalee.message === 'vue cassee', String(signalee));

/* Un redessin demande pendant un redessin de la meme vue — Chrome valide un
   champ retire de la page, et son gestionnaire redessine aussitot — doit
   passer apres lui : imbrique, il reconstruisait la vue au milieu de sa
   propre construction. */
const { redessinerEnPlace } = await import('../ui/lib/redessin.js');
const cadreVue = document.createElement('div');
const ordre = [];
redessinerEnPlace(cadreVue, () => {
  ordre.push('debut');
  redessinerEnPlace(cadreVue, () => ordre.push('imbrique'));
  ordre.push('fin');
});
await apresLeClic();
egal('un redessin demande pendant un redessin de la meme vue passe apres lui', ordre.join(', '), 'debut, fin, imbrique');

/* ================ 2. Chaque champ d une vue vivante a un nom =============== */
const TYPES_SANS_SAISIE = new Set(['file', 'hidden', 'button', 'submit', 'reset', 'image']);
function champsDe(racineVue) {
  return ['input', 'textarea', 'select']
    .flatMap(balise => racineVue.querySelectorAll(balise))
    .filter(n => !TYPES_SANS_SAISIE.has(n.getAttribute('type')));
}
let champsVus = 0;
/* Une vue cachee reste dans le document : un nom partage par deux vues
   ferait rendre le focus, et ce qui a ete tape, au champ de l autre. */
const proprietaires = new Map();
const partages = new Set();
function controlerNoms(vue, racineVue, proprietaire = vue) {
  const champs = champsDe(racineVue);
  champsVus += champs.length;
  const sansNom = champs.filter(n => !n.dataset.champ);
  const noms = champs.map(n => n.dataset.champ).filter(Boolean);
  const doublons = [...new Set(noms.filter((x, i) => noms.indexOf(x) !== i))];
  verifier(vue + ' : chaque champ porte un nom stable', !sansNom.length,
    sansNom.map(n => n.nodeName.toLowerCase() + ' « ' + (n.getAttribute('placeholder') || n.getAttribute('type') || '') + ' »').join(', '));
  verifier(vue + ' : aucun nom en double dans la vue', !doublons.length, doublons.join(', '));
  for (const nom of noms) {
    if (proprietaires.has(nom) && proprietaires.get(nom) !== proprietaire) partages.add(nom + ' (' + proprietaires.get(nom) + ', ' + proprietaire + ')');
    else proprietaires.set(nom, proprietaire);
  }
  return champs.length;
}

state.config = { ...config.values };

/* La boite a outils : chaque panneau, avec des entrees qui font paraitre ses
   champs conditionnels (un JWT, un lien otpauth, du HTML, un prefixe...). */
const tools = await import('../ui/console/tools.js');
const ENTREES = ['', '{"a":1}', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln',
  'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP', '<a href="/x">y</a>', '10.0.0.0/8', '4111111111111111'];
const OUTILS = tools.FAMILLES.flatMap(([, outils]) => outils.map(([id]) => id));
verifier('la boite a outils compte ses vingt-trois outils et la transformation', OUTILS.length >= 24, OUTILS.length + ' outils');
const vueOutils = document.querySelector('#view-tools');
for (const id of OUTILS) {
  let vus = 0;
  for (const entree of ENTREES) {
    tools.poser(entree, { bascule: false, vers: id });
    vus = Math.max(vus, controlerNoms('boite a outils · ' + id + ' · « ' + entree.slice(0, 12) + ' »', vueOutils, 'boite a outils'));
  }
  verifier('boite a outils · ' + id + ' : le panneau a bien ete rendu', vus >= 1, vus + ' champ(s)');
}

/* Les Regles : une regle par action, et des operations d entetes. */
const rules = await import('../ui/console/rules.js');
state.view = 'rules';
state.config = { ...config.values, rulesEnabled: true, rules: [
  { id: 'r-bloc', enabled: true, name: 'Bloquer', match: { host: 'a.test' }, action: 'block' },
  { id: 'r-redir', enabled: false, name: 'Rediriger', match: { urlRegex: '^https://' }, action: 'redirect', redirectUrl: 'https://b.test/' },
  { id: 'r-mock', enabled: false, name: 'Simuler', match: {}, action: 'mock', mock: { contentType: 'text/plain', body: 'x' } },
  { id: 'r-delai', enabled: false, name: 'Retarder', match: {}, action: 'delay', delayMs: 200 },
  { id: 'r-corps', enabled: false, name: 'Remplacer', match: {}, action: 'replaceBody', replace: { find: 'a', replace: 'b', flags: 'g' } },
  { id: 'r-entetes', enabled: false, name: 'Entetes', match: {}, action: 'modifyHeaders',
    requestHeaders: [{ op: 'set', name: 'X-A', value: '1' }, { op: 'remove', name: 'X-B' }],
    responseHeaders: [{ op: 'set', name: 'X-C', value: '3' }] },
  /* Deux regles au meme identifiant, comme un JSON colle peut en avoir. */
  { id: 'r-bloc', enabled: false, name: 'Copie', match: {}, action: 'block' }
] };
rules.render();
const champsRegles = controlerNoms('Regles', document.querySelector('#view-rules'));
verifier('les Regles montrent les champs de chaque action', champsRegles >= 30, champsRegles + ' champs');

/* Les Reglages, tous groupes confondus. */
const settings = await import('../ui/console/settings.js');
state.view = 'settings';
state.config = { ...config.values };
settings.render();
const champsReglages = controlerNoms('Reglages', document.querySelector('#view-settings'));
verifier('les Reglages montrent leurs champs', champsReglages >= 20, champsReglages + ' champs');

/* L Interception, avec deux requetes suspendues : une requete sortante et
   une reponse entrante. La file vient du noyau ; on la fournit ici. */
const intercept = await import('../ui/console/intercept.js');
const envoiReel = globalThis.browser.runtime.sendMessage;
let file = { pending: [
  { id: 'p1', phase: 'onBeforeSendHeaders', method: 'POST', url: 'https://a.test/api', type: 'xmlhttprequest',
    tabId: 3, at: 1700000000000, requestHeaders: [{ name: 'Accept', value: '*/*' }] },
  { id: 'p2', phase: 'onHeadersReceived', method: 'GET', url: 'https://a.test/', type: 'main_frame', statusCode: 200,
    tabId: 3, at: 1700000001000, responseHeaders: [{ name: 'Content-Type', value: 'text/html' }] }
], count: 2, stats: { forwarded: 1 } };
let lectures = 0;
globalThis.browser.runtime.sendMessage = async message => {
  if (message && message.cmd === 'interceptList') { lectures++; return JSON.parse(JSON.stringify(file)); }
  return envoiReel ? envoiReel(message) : {};
};
state.view = 'intercept';
state.config = { ...config.values, interceptEnabled: true };
await intercept.charger();
const vueInterception = document.querySelector('#view-intercept');
const champsInterception = controlerNoms('Interception', vueInterception);
verifier('l Interception montre le filtre, l echeance et chaque requete suspendue', champsInterception >= 5,
  champsInterception + ' champs');

/* ============ 3. L Interception ne se redessine que si elle change ======== */
const cadre = () => vueInterception.querySelector('.pane');
const avant = cadre();
await intercept.charger();
verifier('la file relue a l identique : la vue n est pas redessinee', cadre() === avant && lectures === 2,
  lectures + ' lecture(s)');
file = { ...file, pending: file.pending.slice(1), count: 1 };
await intercept.charger();
verifier('une requete en moins : la vue est redessinee', cadre() !== avant);
const apresFile = cadre();
state.config = { ...state.config, interceptFilter: 'api' };
await intercept.charger();
verifier('un reglage d interception change ailleurs : la vue est redessinee', cadre() !== apresFile);
globalThis.browser.runtime.sendMessage = envoiReel;

/* Les vues qui avaient deja des champs nommes le restent. */
for (const [nom, fichier, rendre] of [
  ['Flux direct', 'streams.js', m => m.render()],
  ['Sites et chemins', 'sitemap.js', m => m.render()],
  ['Journal interne', 'debug.js', m => m.render()],
  ['Journal des cookies', 'journal.js', m => m.render('cookies')]
]) {
  const mod = await import('../ui/console/' + fichier);
  rendre(mod);
  const id = fichier === 'journal.js' ? '#view-cookies' : '#view-' + fichier.replace('.js', '');
  const conteneur = document.querySelector(id);
  verifier(nom + ' : la vue existe', !!conteneur, id);
  if (conteneur) controlerNoms(nom, conteneur);
}
verifier('aucun nom de champ n est partage par deux vues', !partages.size, [...partages].join(', '));
verifier('le controle a vu assez de champs', champsVus > 200, champsVus + ' champs');

auBilan = true;
bilan('Clics et saisie a travers les redessins');
