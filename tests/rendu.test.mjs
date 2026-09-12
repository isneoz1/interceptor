/* Rendu reel de l interface — INTERCEPTOR (cree par NeoZ)
 *
 * Les autres suites lisent le source de l interface ; celle-ci l execute. Elle
 * construit les vues, les onglets du detail et les panneaux de la boite a
 * outils pour de bon, contre des donnees qui existent vraiment — y compris
 * celles qu un fichier importe peut contenir.
 *
 * Elle n aurait rien pu trouver avant : le DOM du harnais ne declarait pas
 * `nodeType`, donc chaque enfant devenait la chaine « [object Object] » et
 * rien de ce qui est imbrique n etait construit. Une fois cela repare, trois
 * defauts se sont vus dans la meme journee :
 *
 *   - l onglet Chronologie plantait des qu une requete portait un
 *     chronometrage, un `const t` masquant la fonction de traduction ;
 *   - un fichier HAR deforme laissait une ligne a moitie remplie dans le
 *     tableau, et vidait les onglets qui la lisaient ;
 *   - la moitie des ecrans « rien a montrer » — les premiers qu on voit apres
 *     l installation — s affichaient en francais quelle que soit la langue.
 */
import path from 'node:path';
import url from 'node:url';
import {
  installerTout, installerPage, enregistrementExemple, egal, verifier, bilan
} from './harnais.mjs';

installerTout();
const racine = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const parId = installerPage(racine);

const { setLang } = await import('../ui/lib/i18n.js');
const { state } = await import('../ui/app.js');
const { newRecord, store } = await import('../background/core/store.js');
const { collectStats } = await import('../background/api/status.js');
const { importHar } = await import('../background/ingest/har.js');

verifier('la page declare assez d identifiants pour rendre les vues',
  parId.size > 50, parId.size + ' identifiants');

/* --------------------------- Outillage commun ----------------------------- */
function texteDe(noeud, sortie = []) {
  if (!noeud) return sortie;
  const texte = String(noeud.textContent || '').trim();
  if (texte) sortie.push(texte);
  for (const enfant of noeud.children || []) texteDe(enfant, sortie);
  return sortie;
}

/* `state.records` est une Map indexee par `state.order` : y poser un tableau
   laisse la boucle de `visibleRecords` tourner a vide, et toutes les vues se
   rendent comme si la capture etait vide. Le piege vaut d etre ecrit une fois. */
function poserCapture(liste) {
  state.records = new Map(liste.map(r => [r.id, r]));
  state.order = liste.map(r => r.id);
  state.scope = 'all';
  state.query = '';
  state.terms = [];
  state.deepIds = null;
  state.facets = new Set();
  state.selection = new Set();
  try { state.stats = collectStats(); } catch { state.stats = null; }
}

/* Une capture ou tout coexiste : erreurs, WebSocket, SSE, chronometrage. */
function captureVariee(n) {
  const liste = [];
  for (let i = 0; i < n; i++) {
    const rec = enregistrementExemple({ id: i + 1 });
    if (i % 3 === 0) rec.statusCode = 500;
    if (i % 4 === 0) rec.ws = { sent: 1, received: 1, protocols: ['chat'], frames: [{ dir: 'send', ts: 1, data: 'x' }] };
    if (i % 5 === 0) rec.sse = { messages: [{ event: 'tick', data: '1' }] };
    if (i % 6 === 0) rec.perf = { timings: { blocked: 1, dns: 2, connect: 3, ssl: 4, send: 1, wait: 20, receive: 3 } };
    liste.push(rec);
  }
  return liste;
}

/* ====================== 1. Les seize vues se rendent ======================= */
const VUES = [];
for (const nom of ['requests', 'alerts', 'streams', 'journal', 'stats', 'rules',
  'settings', 'help', 'tutorial', 'summary', 'compare', 'tools', 'sitemap',
  'debug', 'intercept']) {
  const mod = await import('../ui/console/' + nom + '.js');
  if (typeof mod.render === 'function') VUES.push([nom, mod.render]);
}
const statusbar = await import('../ui/console/statusbar.js');
VUES.push(['statusbar', statusbar.renderFoot]);

verifier('toutes les vues de la console sont couvertes', VUES.length >= 16,
  VUES.length + ' vues');

const CAPTURES = [
  ['aucune capture', []],
  ['un enregistrement neuf', [newRecord({ id: 1, url: 'https://exemple.test/' })]],
  ['vingt enregistrements varies', captureVariee(20)]
];

let renduxVues = 0;
const vuesEnEchec = [];
for (const langue of ['fr', 'en']) {
  setLang(langue);
  for (const [quoi, records] of CAPTURES) {
    poserCapture(records);
    for (const [nom, rendre] of VUES) {
      state.view = nom;
      renduxVues++;
      try { rendre(); }
      catch (e) { vuesEnEchec.push(nom + ' · ' + quoi + ' [' + langue + '] : ' + e.message); }
    }
  }
}
for (const echec of vuesEnEchec.slice(0, 10)) verifier('la vue se rend', false, echec);
egal('aucune vue ne plante, quelle que soit la capture', vuesEnEchec.length, 0);
verifier('le controle a bien rendu les vues', renduxVues >= 90, renduxVues + ' rendus');

/* =================== 2. Les onglets du panneau de detail ================== */
const parts = await import('../ui/console/detail-parts.js');
const more = await import('../ui/console/detail-more.js');
const ONGLETS = [
  ['Resume', parts.resume], ['En-tetes', parts.headers],
  ['Requete', parts.requestBody], ['Reponse', parts.responseBody],
  ['Cookies', more.cookies], ['Securite', more.security],
  ['Alertes', more.analysis], ['Flux', more.streams],
  ['Chronologie', more.timeline], ['Pile JS', more.stack], ['Brut', more.raw]
];
egal('les onze onglets du detail sont couverts', ONGLETS.length, 11);

/* Le chronometrage est le cas qui manquait : c est celui qui plantait. */
const avecChrono = enregistrementExemple({ id: 900 });
avecChrono.perf = {
  timings: { blocked: 1, dns: 2, connect: 3, ssl: 4, send: 1, wait: 200, receive: 3 },
  serverTiming: [{ name: 'db', duration: 42, description: 'requete' }]
};
avecChrono.redirects = [{ statusCode: 301, from: 'https://a.test/', to: 'https://b.test/' }];

const CAS_DETAIL = [
  ['neuf', newRecord({ id: 901, url: 'https://exemple.test/' })],
  ['complet', enregistrementExemple({ id: 902 })],
  ['avec chronometrage', avecChrono]
];

const ongletsEnEchec = [];
let rendusDetail = 0;
for (const langue of ['fr', 'en']) {
  setLang(langue);
  for (const [quoi, rec] of CAS_DETAIL) {
    for (const [nom, rendre] of ONGLETS) {
      rendusDetail++;
      try { rendre(rec); }
      catch (e) { ongletsEnEchec.push(nom + ' · ' + quoi + ' [' + langue + '] : ' + e.message); }
    }
  }
}
for (const echec of ongletsEnEchec.slice(0, 10)) verifier('l onglet de detail se rend', false, echec);
egal('aucun onglet du detail ne plante', ongletsEnEchec.length, 0);
verifier('le controle a bien rendu les onglets', rendusDetail >= 60, rendusDetail + ' rendus');

/* La chronologie affiche bien ses mesures, et non un onglet vide. */
setLang('en');
const chrono = texteDe(more.timeline(avecChrono)).join(' | ');
verifier('la chronologie affiche le chronometrage reseau',
  /Network timing/i.test(chrono) || /Chronometrage/i.test(chrono), chrono.slice(0, 80));
verifier('la chronologie traduit les etapes mesurees',
  /Response|Reponse/.test(chrono) && /Connection|Connexion/.test(chrono), chrono.slice(0, 120));

/* ============== 3. Un fichier HAR deforme ne casse rien ================== */
/* L import est la seule frontiere par ou des donnees ecrites ailleurs entrent
   dans le magasin : ce que le fichier contient n est jamais garanti. */
const entreeHar = () => ({
  startedDateTime: '2026-09-12T10:00:00.000Z', time: 214,
  request: {
    method: 'POST', url: 'https://exemple.test/v2/profil',
    headers: [{ name: 'Content-Type', value: 'application/json' }],
    postData: { mimeType: 'application/json', text: '{"a":1}', params: [] }
  },
  response: {
    status: 200, statusText: 'OK', httpVersion: 'HTTP/2',
    headers: [{ name: 'Content-Type', value: 'application/json' }],
    content: { size: 12, mimeType: 'application/json', text: '{"ok":true}' },
    cookies: [{ name: 'sid', value: 'abc', secure: true }]
  },
  timings: { blocked: 1, dns: 2, connect: 3, ssl: 4, send: 1, wait: 200, receive: 3 },
  _interceptor: {
    sources: ['webRequest'], type: 'xhr', tabId: 3, frameId: 0,
    redirects: [{ statusCode: 301, from: 'https://a.test/', to: 'https://b.test/' }],
    websocket: { sent: 1, received: 2, protocols: ['chat'], frames: [{ dir: 'send', ts: 1, data: 'x' }] },
    sse: { messages: [{ event: 'tick', data: '1' }] },
    rulesApplied: [{ name: 'Regle', action: 'block', phase: 'request' }],
    urlClassification: { firstParty: [], thirdParty: ['tracking'] },
    frameAncestors: [{ url: 'https://parent.test/' }],
    cookiesChanged: [{ name: 'a', value: 'b' }],
    timeline: [{ event: 'start', ts: 1, detail: null }],
    stack: { frames: [{ fn: 'f', url: 'https://exemple.test/a.js', line: 1 }] },
    transferSize: 1234
  }
});

function deformer(objet, chemin, valeur) {
  const copie = JSON.parse(JSON.stringify(objet));
  const bouts = chemin.split('.');
  let cible = copie;
  for (const bout of bouts.slice(0, -1)) {
    if (!cible[bout] || typeof cible[bout] !== 'object') cible[bout] = {};
    cible = cible[bout];
  }
  const dernier = bouts[bouts.length - 1];
  if (valeur === undefined) delete cible[dernier]; else cible[dernier] = valeur;
  return copie;
}

/* Les champs que le fichier controle, et ce qu ils peuvent valoir quand
   personne ne les a verifies. */
const CHEMINS_HAR = ['request', 'request.headers', 'request.postData',
  'request.postData.params', 'response', 'response.headers', 'response.content',
  'response.cookies', 'timings', '_interceptor', '_interceptor.sources',
  '_interceptor.tabId', '_interceptor.redirects', '_interceptor.stack',
  '_interceptor.websocket', '_interceptor.websocket.frames', '_interceptor.sse',
  '_interceptor.sse.messages', '_interceptor.rulesApplied',
  '_interceptor.urlClassification', '_interceptor.frameAncestors',
  '_interceptor.cookiesChanged', '_interceptor.timeline', '_interceptor.transferSize'];
const VALEURS_HAR = [undefined, null, 0, -1, '', 'texte', true, [], {}, [null], [0]];

setLang('fr');
let importsFaits = 0;
const importsEnEchec = [];
const lignesFantomes = [];
for (const chemin of CHEMINS_HAR) {
  for (const valeur of VALEURS_HAR) {
    const quoi = chemin + ' = ' + JSON.stringify(valeur === undefined ? 'absent' : valeur);
    store.clear();
    let resultat;
    try {
      resultat = importHar({ log: { version: '1.2', entries: [deformer(entreeHar(), chemin, valeur)] } });
      importsFaits++;
    } catch (e) { importsEnEchec.push(quoi + ' : ' + e.message); continue; }

    /* Une entree annoncee ignoree ne doit pas rester dans le magasin :
       `store.create` inscrit la ligne avant qu elle soit remplie. */
    if (resultat && typeof resultat.imported === 'number'
      && store.all().length !== resultat.imported) {
      lignesFantomes.push(quoi + ' : ' + resultat.imported + ' annoncee(s), '
        + store.all().length + ' presente(s)');
    }

    for (const rec of store.all()) {
      for (const [nom, rendre] of ONGLETS) {
        try { rendre(rec); }
        catch (e) { importsEnEchec.push('onglet ' + nom + ' apres ' + quoi + ' : ' + e.message); }
      }
    }
  }
}
store.clear();
for (const echec of importsEnEchec.slice(0, 10)) verifier('le HAR deforme est absorbe', false, echec);
egal('aucun fichier HAR deforme ne casse l import ni le detail', importsEnEchec.length, 0);
for (const fantome of lignesFantomes.slice(0, 5)) verifier('aucune ligne fantome', false, fantome);
egal('une entree ignoree ne reste pas dans le magasin', lignesFantomes.length, 0);
verifier('le controle a bien importe des fichiers deformes', importsFaits >= 200,
  importsFaits + ' imports');

/* ================= 4. Les panneaux de la boite a outils =================== */
const PANNEAUX = [];
for (const [nom, fichier, appeler] of [
  ['cles', 'tools-chiffres.js', (m, e, s) => m.panneauCles(e, s, () => {}, () => {})],
  ['identifier', 'tools-chiffres.js', (m, e) => m.panneauIdentifier(e)],
  ['chiffrement', 'tools-crypto.js', (m, e, s) => m.panneauChiffrement(e, s, () => {}, () => {})],
  ['jwt', 'tools-panels.js', (m, e, s) => m.panneauJwt(e, s, () => {})],
  ['empreintes', 'tools-panels.js', (m, e, s) => m.panneauEmpreintes(e, () => {}, s)],
  ['mesures', 'tools-panels.js', (m, e) => m.panneauMesures(e)],
  ['hex', 'tools-panels.js', (m, e) => m.panneauHex(e)],
  ['analyse', 'tools-panels.js', (m, e) => m.panneauAnalyse(e)],
  ['regex', 'tools-panels.js', (m, e, s) => m.panneauRegex(e, s, () => {})],
  ['binaire', 'tools-binaire.js', (m, e, s) => m.panneauBinaire(e, s, () => {}, () => {})],
  ['code', 'tools-code.js', (m, e, s) => m.panneauCode(e, s, () => {}, () => {})],
  ['otp', 'tools-otp.js', (m, e, s) => m.panneauOtp(e, s, () => {})],
  ['temps', 'tools-temps.js', (m, e) => m.panneauHorodatage(e)],
  ['nombres', 'tools-temps.js', (m, e, s) => m.panneauNombres(e, s, () => {})],
  ['entetes', 'tools-entetes.js', (m, e) => m.panneauEntetes(e)],
  ['chercher', 'tools-chercher.js', (m, e, s) => m.panneauChercher(e, s, () => {}, () => {})],
  ['comparer', 'tools-diff.js', (m, e, s) => m.panneauComparer(e, s, () => {}, () => {})],
  ['url', 'tools-reseau.js', (m, e) => m.panneauUrl(e)],
  ['adresse', 'tools-reseau.js', (m, e, s) => m.panneauAdresse(e, s, () => {}, () => {})],
  ['reference', 'tools-reference.js', (m, e, s) => m.panneauReference(e, s, () => {})],
  ['generer', 'tools-generer.js', (m, e, s) => m.panneauGenerateurs(() => {}, s, () => {})],
  ['importer', 'tools-import.js', (m, e, s) => m.panneauImport(e, s, () => {})]
]) {
  const mod = await import('../ui/console/' + fichier);
  PANNEAUX.push([nom, (entree, etat) => appeler(mod, entree, etat)]);
}
egal('les vingt-deux panneaux de la boite a outils sont couverts', PANNEAUX.length, 22);

const etatOutils = () => ({
  empreintes: {}, cleHmac: '', algoHmac: 'SHA-256', hmac: null, cleJwt: '', jwtVerdict: null,
  motif: '', options: 'gi', remplacement: '', cleXor: '', xorHex: false, xorCandidats: null,
  cleVigenere: '', base: 10, prefixeTest: '', familleRef: 'tout', questionRef: undefined,
  modeAes: 'AES-GCM', cleAes: '', formeCleAes: 'hex', ivAes: '', aadAes: '',
  sortieAes: null, erreurAes: null, mdpKdf: '', selKdf: '', iterations: '100000',
  hashKdf: 'SHA-256', bitsKdf: '256', sortieKdf: null, erreurKdf: null,
  signature: '', cleSignature: '', algoSignature: 'RSASSA-PKCS1-v1_5',
  hashSignature: 'SHA-256', verdictSignature: null, familleBinaire: 'auto', arbreDer: false,
  jeuChoisi: 'utf-8', autreTexte: '', motifChoisi: '', numeroLuhn: '', cheminJson: '',
  selecteur: '', typeSelecteur: 'css', sousPrefixe: 26, decoupe: false, listePrefixes: '',
  plageDebut: '', plageFin: '', longueurMdp: 24,
  jeuxMdp: ['minuscules', 'majuscules', 'chiffres', 'symboles'], dernierMdp: null,
  importBrut: false, codeSens: 'lisible', codeStyle: 'securise', codeEmbellir: true,
  codeSortie: null, otpForme: 'base32', otpAlgo: 'SHA-1', otpChiffres: 6, otpPas: 30,
  otpSecret: null, otpResultat: null, otpVoisins: null, otpCompteur: 0
});

/* Ce qu un operateur colle vraiment : un collage rate, un jeton tronque, un
   corps vide, et quelques valeurs qu aucun humain ne tape. */
const ENTREES = ['', ' ', '\n', '\0', 'a', '0', '-1', 'NaN', '{', '{}', '[1,2,',
  '<?xml', 'a'.repeat(3000), 'é'.repeat(200), '💥'.repeat(100), '%zz', '%e2%82',
  '====', '../../etc/passwd', 'https://[', 'https://exemple.test/a?b=c#d',
  '256.256.256.256', 'fe80::%25eth0', 'eyJhbGciOiJub25lIn0.', 'a.b.c.d',
  'GET / HTTP/1.1\r\nHost: a\r\n\r\n', '0x', '1e999', '9007199254740993',
  'name=a&name=b&=&', 'Priority: u=@', 'Cache-Status: a;b=@1'];

let rendusPanneaux = 0;
const panneauxEnEchec = [];
for (const langue of ['fr', 'en']) {
  setLang(langue);
  for (const [nom, rendre] of PANNEAUX) {
    for (const entree of ENTREES) {
      rendusPanneaux++;
      try { rendre(entree, etatOutils()); }
      catch (e) {
        panneauxEnEchec.push(nom + ' [' + langue + '] sur '
          + JSON.stringify(entree.slice(0, 24)) + ' : ' + e.message);
      }
    }
  }
}
for (const echec of panneauxEnEchec.slice(0, 10)) verifier('le panneau se rend', false, echec);
egal('aucun panneau de la boite a outils ne plante', panneauxEnEchec.length, 0);
verifier('le controle a bien rendu les panneaux', rendusPanneaux >= 1400,
  rendusPanneaux + ' rendus');

/* =========== 5. Rien ne reste en francais dans l interface anglaise ======= */
/* Le controle de traduction des autres suites lit le source : il ne voit rien
   de ce qui est assemble a l execution, ni de ce qui sort d une table sans
   passer par `t`. Celui-ci compare ce qui s affiche vraiment. */
function rendreVue(nom, rendre, langue, records) {
  setLang(langue);
  poserCapture(records);
  state.view = nom;
  for (const noeud of parId.values()) { noeud.children.length = 0; noeud.childNodes.length = 0; }
  try { rendre(); } catch { return null; }
  const sortie = [];
  for (const noeud of parId.values()) if (noeud.children.length) texteDe(noeud, sortie);
  return sortie;
}

/* Ce que ce controle cherche, ce sont des PHRASES restees en francais. Il
   laisse donc passer trois choses, pour de bonnes raisons :

   - un fragment sans espace est un nom, pas une phrase : « webRequest »,
     « application/json », « camelCase », « onHeadersReceived ». Les libelles
     d un seul mot restent couverts par le controle de traduction de
     ui-load.test.mjs, qui lit les appels a `t` dans le source ;
   - une mesure et son unite ne se traduisent pas : « 128 ms », « 0 ms » ;
   - une methode HTTP suivie de son code non plus : « POST  500 ».

   Tout le reste — deux mots ou davantage, avec des lettres — doit differer
   d une langue a l autre, ou figurer dans la liste ci-dessous. */
const UN_SEUL_MOT = /^\S+$/;
const SANS_LETTRE = /^[\d\s.,:;/+\-_()[\]|·—%<>@#*'"«»…?!=&✔○]*$/;
const MESURE = /^-?[\d.,\s]+(ms|s|min|h|o|ko|mo|go|B|kB|MB|GB|%|\/s)?$/i;
const NON_MESURE = /^(NaN|Infinity|-Infinity)\s*\S*$/;
const METHODE = /^(GET|HEAD|POST|PUT|PATCH|DELETE|CONNECT|OPTIONS|TRACE)[\s\d]*$/;
const ADRESSE = /^(https?:\/\/|[a-z0-9.-]+\.[a-z]{2,}([/?].*)?$|\/)/i;

/* Des expressions de plusieurs mots qui s ecrivent identiquement dans les
   deux langues. Chacune a ete verifiee une par une : ce n est pas une liste
   d exceptions commode, c est la liste de ce qui n a rien a traduire. */
const IDENTIQUES = new Set([
  'Interception inactive',   /* les deux mots sont les memes en anglais */
  'Server-Sent Events',      /* le nom de la specification, jamais traduit */
  'Aucune alerte',           /* remplace par sa traduction, jamais identique */
  'SQL Server', 'SQL Server Analysis', 'OPC UA', 'Docker TLS', 'SIP TLS',
  'MQTT TLS', 'DHCP client', 'DHCPv6 client', 'XMPP client', 'NetBIOS session',
  'SNMP trap'
]);

const francaisRestant = [];
let vuesComparees = 0;
for (const [nom, rendre] of VUES) {
  const records = captureVariee(12);
  const fr = rendreVue(nom, rendre, 'fr', records);
  const en = rendreVue(nom, rendre, 'en', records);
  if (fr === null || en === null || fr.length !== en.length) continue;
  vuesComparees++;
  for (let i = 0; i < fr.length; i++) {
    const texte = fr[i];
    if (texte !== en[i]) continue;
    if (UN_SEUL_MOT.test(texte) || SANS_LETTRE.test(texte)) continue;
    if (MESURE.test(texte) || NON_MESURE.test(texte) || METHODE.test(texte)) continue;
    if (ADRESSE.test(texte) || IDENTIQUES.has(texte)) continue;
    if (texte.includes('\n') || texte.length > 140) continue;   /* agregats de parents */
    francaisRestant.push(nom + ' : ' + JSON.stringify(texte.slice(0, 90)));
  }
}
const uniques = [...new Set(francaisRestant)];
for (const reste of uniques.slice(0, 15)) {
  verifier('le fragment est bien traduit en anglais', false, reste);
}
egal('aucun fragment ne reste en francais dans l interface anglaise', uniques.length, 0);
verifier('la comparaison a bien porte sur les vues',
  vuesComparees >= 12, vuesComparees + ' vues comparees');

bilan('Rendu de l interface');
