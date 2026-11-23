/* Interroger le reseau — SWIFT (by D4RK)
 *
 *   node tests/reseau.test.mjs
 *
 * Ce que la 6.1 ajoute, verifie contre les textes qui le definissent, et par
 * le chemin reel du code : du clic dans le panneau jusqu au noyau, par son
 * vrai repartiteur de commandes. Seuls les bords sont imites — fetch,
 * dns.resolve, WebSocket — pour observer ce qui en sort sans rien envoyer.
 *
 *   1. « Lire une reponse » : la ligne de statut, les en-tetes et le corps
 *      d une reponse collee selon la RFC 9112 (§2.1, §4, §5.1, §5.2) — ce
 *      qu ecrivent curl -I, curl -iL et ses redirections, curl -v, une
 *      reponse provisoire (RFC 9110 §15.2) ; puis la reponse lue par le meme
 *      code que l onglet En-tetes du detail, corps compris ;
 *   2. « Envoyer une requete » : ce qui est repris du texte de travail —
 *      adresse, commande cURL, requete HTTP brute — puis la requete partie du
 *      panneau par le vrai rejeu, jusqu a fetch : en-tete X-Swift-Replay,
 *      cookies du site, en-tetes interdits refuses et nommes, corps seulement
 *      hors GET et HEAD ; rien ne part tant que le rejeu n est pas autorise ;
 *   3. « Resolution DNS » : le nom lu dans le texte (punycode, adresse IP
 *      ecartee), les drapeaux transmis a dns.resolve, ce qui est rendu, les
 *      noms refuses selon la RFC 1123 et les echecs, traduits ;
 *   4. « Client WebSocket » : une session menee de bout en bout — sous-
 *      protocoles, ouverture, texte et octets envoyes, messages recus en
 *      texte et en binaire, fermeture lue avec le sens de son code — et le
 *      panneau qui la suit en direct, au plus un redessin par rafale ;
 *   5. le direct : la vue Securite et les journaux se relisent seuls quand
 *      le noyau compte du nouveau, et seulement alors ;
 *   6. ces panneaux, dans chacun de leurs etats, rendus en anglais : aucun
 *      texte que le traducteur ne connait pas.
 */
import path from 'node:path';
import url from 'node:url';
import { installerTout, installerPage, egal, memeListe, verifier, bilan, dejaAnglais } from './harnais.mjs';

installerTout();
const racine = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
installerPage(racine);

const { setLang, surManque, te } = await import('../ui/lib/i18n.js');
const { EN } = await import('../ui/lib/dict-en.js');
const { state, cmd } = await import('../ui/app.js');
const { lireReponseBrute, enregistrementDepuisReponse, adresseLue } = await import('../ui/lib/reponse-brute.js');
const { panneauReponse } = await import('../ui/console/tools-reponse.js');
const { panneauRequete, panneauDns, requeteDepuisTexte, nomDepuisTexte } = await import('../ui/console/tools-requete.js');
const { panneauWebSocket, sessionWebSocket } = await import('../ui/console/tools-websocket.js');
const { TOOLING_COMMANDS } = await import('../background/api/tooling.js');
const { startRpc, collectStats } = await import('../background/api/rpc.js');
const { config } = await import('../background/core/config.js');

/* L interface en francais, la langue des textes sources : saveConfig
   reapplique le reglage du noyau, qui doit donc le dire aussi. */
await config.set({ lang: 'fr' });
setLang('fr');

/* --------------------------- Outillage commun ----------------------------- */
const texte = n => (n ? (n.textContent || '') + ' ' + (n.children || []).map(texte).join(' ') : '');
const plat = n => texte(n).replace(/\s+/g, ' ').trim();
const cherche = (n, pred) => (n && pred(n) ? n : ((n && n.children) || []).map(c => cherche(c, pred)).find(Boolean) || null);
const tous = (n, pred, sortie = []) => {
  if (!n) return sortie;
  if (pred(n)) sortie.push(n);
  for (const c of n.children || []) tous(c, pred, sortie);
  return sortie;
};
const champ = (n, nom) => cherche(n, x => x.dataset && x.dataset.champ === nom);
const bouton = (n, libelle) => cherche(n, x => x.nodeName === 'BUTTON' && plat(x) === libelle);
const attendre = ms => new Promise(r => setTimeout(r, ms));

/* Les ecouteurs du DOM du harnais ne font rien : pendant un rendu, chaque
   noeud retient les siens, pour qu on puisse cliquer et changer un champ. */
const proto = Object.getPrototypeOf(document.createElement('div'));
const ecouteurDuHarnais = proto.addEventListener;
/* Le harnais pose `value`, `checked` et `selected` en attributs ; un
   navigateur en tire les proprietes que le code lit au clic. On fait de meme. */
function proprietes(n) {
  if (!n) return;
  if (n.nodeName === 'INPUT') {
    if (n.value === undefined) n.value = n.getAttribute('value') || '';
    if (n.checked === undefined) n.checked = n.getAttribute('checked') != null;
  } else if (n.nodeName === 'SELECT' && n.value === undefined) {
    const options = tous(n, x => x.nodeName === 'OPTION');
    const choisie = options.find(o => o.getAttribute('selected') != null) || options[0];
    n.value = choisie ? choisie.getAttribute('value') : '';
  } else if (n.nodeName === 'TEXTAREA' && n.value === undefined) n.value = '';
  for (const c of n.children || []) proprietes(c);
}
function rendre(fabriquer) {
  proto.addEventListener = function (type, rappel) { (this._ecouteurs ||= {})[type] = rappel; };
  try {
    const hote = document.createElement('div');
    hote.appendChild(fabriquer());
    proprietes(hote);
    return hote;
  } finally { proto.addEventListener = ecouteurDuHarnais; }
}
/* Cliquer un bouton par son libelle ; un bouton absent est un echec dit. */
function cliquer(vue, libelle) {
  const b = bouton(vue, libelle);
  if (!b || !b._ecouteurs || !b._ecouteurs.click) {
    verifier('le bouton « ' + libelle + ' » est la', false, plat(vue).slice(0, 300));
    return undefined;
  }
  return b._ecouteurs.click();
}

/* Le dernier message affiche par toast() : le noeud #toast de la page. */
const dernierToast = () => { const n = document.getElementById('toast'); return n ? String(n.textContent || '') : ''; };

/* Les commandes partent par le vrai repartiteur du noyau, comme depuis une
   page de l extension : un nom de commande oublie dans la table, un
   expediteur refuse, et le test le voit. */
startRpc();
const expediteur = { url: 'moz-extension://test/ui/console.html', id: 'swift@test' };
const commandes = [];
globalThis.browser.runtime.sendMessage = async message => {
  if (message && message.cmd) commandes.push(message.cmd);
  const reponses = globalThis.browser.runtime.onMessage.emettre(message, expediteur).filter(r => r !== undefined);
  return reponses.length ? reponses[0] : undefined;
};
const compter = nom => commandes.filter(c => c === nom).length;

/* ================ 1. Lire une reponse : RFC 9112 et curl =================== */
{
  /* curl -I sur un serveur HTTP/2 : en-tetes en minuscules (RFC 9113 §8.2.1),
     aucune raison apres le code — HTTP/2 n en transporte pas — et CRLF. */
  const curlI = lireReponseBrute('HTTP/2 200 \r\ncontent-type: text/html; charset=UTF-8\r\n' +
    'strict-transport-security: max-age=63072000; includeSubDomains; preload\r\ncache-control: max-age=600\r\n\r\n');
  egal('curl -I : le statut', curlI.statut, 200);
  egal('curl -I : la version HTTP/2, sans raison', curlI.version + '|' + curlI.raison, '2|');
  memeListe('curl -I : les en-tetes, noms et valeurs tels qu ecrits', curlI.entetes, [
    { name: 'content-type', value: 'text/html; charset=UTF-8' },
    { name: 'strict-transport-security', value: 'max-age=63072000; includeSubDomains; preload' },
    { name: 'cache-control', value: 'max-age=600' }
  ]);
  egal('curl -I : une reponse, aucun corps, rien d ecarte', curlI.reponses + '|' + curlI.corps + '|' + curlI.ignorees.length, '1||0');

  /* curl -iL : une reponse par redirection, la derniere compte. Une ligne
     « HTTP/1.1 404 » ecrite DANS le corps n ouvre pas une autre reponse. */
  const curlIL = lireReponseBrute([
    'HTTP/1.1 301 Moved Permanently', 'Location: https://www.example.com/', 'Content-Length: 0', '',
    'HTTP/1.1 200 OK', 'Content-Type: text/html', 'Set-Cookie: id=a3fWa; Secure; HttpOnly', '',
    '<!doctype html>', '<p>Exemple :', '', 'HTTP/1.1 404 Not Found', '</p>'
  ].join('\n'));
  egal('curl -iL : la derniere reponse est lue', curlIL.statut + ' ' + curlIL.raison, '200 OK');
  egal('curl -iL : les deux reponses sont comptees', curlIL.reponses, 2);
  memeListe('curl -iL : seuls les en-tetes de la derniere', curlIL.entetes.map(h => h.name), ['Content-Type', 'Set-Cookie']);
  egal('une ligne de statut ecrite dans le corps reste du corps',
    curlIL.corps, '<!doctype html>\n<p>Exemple :\n\nHTTP/1.1 404 Not Found\n</p>');

  /* Une reponse provisoire precede la reponse finale (RFC 9110 §15.2). */
  const provisoire = lireReponseBrute('HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 201 Created\r\nLocation: /items/7\r\n\r\n{"id":7}');
  egal('100 Continue puis 201 : la reponse finale, et son corps', [provisoire.statut, provisoire.raison, provisoire.reponses, provisoire.corps].join(' '),
    '201 Created 2 {"id":7}');
  const indices = lireReponseBrute('HTTP/1.1 103 Early Hints\nLink: </style.css>; rel=preload; as=style\n\nHTTP/1.1 200 OK\nContent-Type: text/html\n');
  egal('103 Early Hints puis 200 : les en-tetes de la reponse finale seulement', indices.statut + ' ' + indices.entetes.map(h => h.name).join(), '200 Content-Type');

  /* Le repli obsolete (RFC 9112 §5.2) : la ligne qui commence par un blanc
     prolonge la precedente, recollee par une espace. */
  const replie = lireReponseBrute("HTTP/1.1 200 OK\nContent-Security-Policy: default-src 'self';\n  img-src https:;\n\tscript-src 'none'\nX-Autre: 1\n");
  egal('repli obsolete : la valeur recollee par une espace', replie.entetes[0].value, "default-src 'self'; img-src https:; script-src 'none'");
  egal('repli obsolete : l en-tete suivant reste a part', replie.entetes.length + ' ' + replie.entetes[1].name, '2 X-Autre');

  /* RFC 9112 §5.1 : aucun blanc entre le nom et les deux-points. */
  const fautes = lireReponseBrute('HTTP/1.1 200 OK\nContent-Type : text/html\nCeci n est pas un en-tete\nX-Vide:\nLocation: https://a.example:8443/x?y=1\n');
  memeListe('un blanc avant les deux-points, une phrase : ecartes, et rendus tels quels', fautes.ignorees,
    ['Content-Type : text/html', 'Ceci n est pas un en-tete']);
  memeListe('une valeur vide reste une valeur ; les deux-points d une valeur y restent', fautes.entetes,
    [{ name: 'X-Vide', value: '' }, { name: 'Location', value: 'https://a.example:8443/x?y=1' }]);

  const seul = lireReponseBrute('\n\n  \nContent-Type: application/json\nAccess-Control-Allow-Origin: *\n');
  egal('un bloc d en-tetes seul : pas de statut, les lignes vides du debut sautees', seul.statut + ' ' + seul.entetes.length + ' ' + seul.reponses, 'null 2 0');
  const invite = lireReponseBrute('$ curl -I https://example.com/\nHTTP/1.1 200 OK\nServer: ECS\n');
  egal('une invite de commande collee avant la reponse : ecartee et rendue', invite.ignorees.join('|') + ' ' + invite.statut + ' ' + invite.entetes.length,
    '$ curl -I https://example.com/ 200 1');
  const http10 = lireReponseBrute('HTTP/1.0 503 Service Unavailable\nRetry-After: 120');
  egal('HTTP/1.0, une raison de plusieurs mots', [http10.version, http10.statut, http10.raison].join(' '), '1.0 503 Service Unavailable');
  const rien = lireReponseBrute(null);
  egal('rien de colle : rien de lu, sans erreur', [String(rien.statut), rien.entetes.length, rien.reponses, rien.corps].join(' '), 'null 0 0 ');

  /* curl -v : la reponse dans les lignes « < », la requete (« > ») et les
     remarques de curl (« * », « { [ ») laissees de cote et comptees. */
  const verbeux = lireReponseBrute([
    '* Host example.com:443 was resolved.', '*   Trying 93.184.215.14:443...',
    '* Connected to example.com (93.184.215.14) port 443',
    '> GET / HTTP/2', '> Host: example.com', '> User-Agent: curl/8.11.0', '> Accept: */*', '>',
    '< HTTP/2 200 ', '< content-type: text/html', '< x-cache: HIT', '<',
    '{ [1256 bytes data]', '<!doctype html>', '* Connection #0 to host example.com left intact'
  ].join('\r\n'));
  egal('curl -v : le statut de la reponse', verbeux.statut + ' ' + verbeux.version, '200 2');
  memeListe('curl -v : les en-tetes de la reponse, pas ceux de la requete', verbeux.entetes,
    [{ name: 'content-type', value: 'text/html' }, { name: 'x-cache', value: 'HIT' }]);
  egal('curl -v : dix lignes de curl et de la requete comptees, le corps garde', verbeux.curlVerbeux + ' ' + verbeux.corps, '10 <!doctype html>');
  egal('sans curl -v, rien n est compte comme tel', curlIL.curlVerbeux, 0);

  /* L enregistrement que lit l onglet En-tetes. */
  const lue = lireReponseBrute('HTTP/1.1 200 OK\nX-Frame-Options: DENY\nContent-Type: Text/HTML; charset=utf-8\n\n<p>corps é</p>');
  const rec = enregistrementDepuisReponse(lue, '', 'main_frame', 1700000000000);
  egal('sans adresse : https://example.com/, une page', [rec.url, rec.type, rec.scheme, rec.host, rec.path].join(' '),
    'https://example.com/ main_frame https example.com /');
  egal('la ligne de statut reecrite comme le noyau la garde', rec.statusLine + '|' + rec.statusCode, 'HTTP/1.1 200 OK|200');
  egal('le type du contenu lu comme le noyau le lit', rec.mime, 'text/html');
  egal('le corps colle, compte en octets UTF-8', rec.responseBody.text + '|' + rec.responseBody.size + '|' + rec.responseBody.truncated, '<p>corps é</p>|15|false');
  egal('les dates : celles du moment, la reponse vient d arriver', [rec.startTime, rec.endTime, rec.state].join(' '), '1700000000000 1700000000000 complete');
  verifier('les en-tetes sont copies, pas partages', rec.responseHeaders[0] !== lue.entetes[0] && rec.responseHeaders[0].value === 'DENY');
  egal('sans corps colle, aucun corps', enregistrementDepuisReponse(curlI, '', 'main_frame').responseBody, null);
  const api = enregistrementDepuisReponse(lue, 'api.example.org/v2/items?page=2', 'xmlhttprequest', 0);
  egal('une adresse sans schema se lit en https ; un appel d API', [api.url, api.type, api.path].join(' '),
    'https://api.example.org/v2/items?page=2 xmlhttprequest /v2/items?page=2');
  egal('une adresse ni http ni https : example.com', enregistrementDepuisReponse(lue, 'ftp://files.example/', 'main_frame').url, 'https://example.com/');
  egal('adresseLue : http garde, javascript: et le vide refuses',
    [adresseLue('http://intranet.local:8080/'), adresseLue('javascript:alert(1)'), adresseLue('  ')].map(u => (u ? u.href : 'null')).join(' '),
    'http://intranet.local:8080/ null null');
  egal('HTTP/2 sans raison : la ligne de statut sans espace finale', enregistrementDepuisReponse(lireReponseBrute('HTTP/2 204'), '', 'x').statusLine, 'HTTP/2 204');
}

/* ------ Le panneau : la reponse lue par le code de l onglet En-tetes ------- */
{
  const etat = { reponseUrl: 'https://site.example/', reponseType: 'main_frame' };
  const colle = 'HTTP/2 200 \r\ncontent-type: text/html; charset=UTF-8\r\n' +
    'strict-transport-security: max-age=63072000; includeSubDomains; preload\r\ncache-control: max-age=600\r\n' +
    'x-frame-options: SAMEORIGIN\r\nmauvaise ligne\r\n\r\n';
  const vue = plat(rendre(() => panneauReponse(colle, etat, () => {})));
  verifier('panneau : le statut et son sens', vue.includes('Statut 200 · Succes'), vue.slice(0, 300));
  verifier('panneau : HSTS lu comme pour une reponse capturee', vue.includes('impose https pendant 730 jours, a cet hote et a ses sous-domaines'));
  verifier('panneau : la fraicheur RFC 9111 calculee', vue.includes('Duree de fraicheur 600 s'));
  verifier('panneau : l encadrement lu', vue.includes('X-Frame-Options SAMEORIGIN'));
  verifier('panneau : la ligne ecartee est montree, pas seulement comptee', vue.includes('laissees de cote, les voici. mauvaise ligne'));
  verifier('panneau : aucun bloc d en-tetes envoyes pour une reponse seule', !vue.includes('Entetes envoyees'));
  const avecCorps = plat(rendre(() => panneauReponse('HTTP/1.1 200 OK\nContent-Type: text/html\n\n<html><head>' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'"></head></html>', { reponseUrl: 'site.example/page' }, () => {})));
  verifier('panneau : la CSP d une balise <meta> trouvee dans le corps colle', avecCorps.includes('declaree dans une balise <meta> du document'));
  verifier('panneau : une adresse sans schema lue en https', avecCorps.includes('Adresse https://site.example/page'));
  const enHttp = plat(rendre(() => panneauReponse('Strict-Transport-Security: max-age=31536000', { reponseUrl: 'http://site.example/' }, () => {})));
  verifier('panneau : en http, l adresse donnee est gardee', enHttp.includes('Adresse http://site.example/'));
  const illisible = plat(rendre(() => panneauReponse('Content-Type: text/plain', { reponseUrl: 'ftp://x' }, () => {})));
  verifier('panneau : une adresse ni http ni https est signalee', illisible.includes('Adresse illisible ou ni http ni https'));
  const v = plat(rendre(() => panneauReponse('> GET / HTTP/1.1\n> Host: a.example\n>\n< HTTP/1.1 302 Found\n< Location: /x\n<\n', {}, () => {})));
  verifier('panneau : la sortie de curl -v est reconnue et dite', v.includes('Sortie de curl -v : la reponse est lue, 3 ligne(s)') && v.includes('Statut 302 Found'));
  const vide = plat(rendre(() => panneauReponse('', {}, () => {})));
  verifier('panneau vide : il dit quoi coller', vide.includes('Collez dans le texte de travail les en-tetes d une reponse'));
}

/* =================== 2. Envoyer une requete, par le rejeu ================== */
{
  memeListe('une adresse seule : un GET', requeteDepuisTexte('  https://api.example.com/v1/items  '),
    { methode: 'GET', url: 'https://api.example.com/v1/items', entetes: '', corps: '' });
  memeListe('une commande cURL : methode, en-tetes et corps',
    requeteDepuisTexte("curl -X POST https://api.example.com/v1/items -H 'Content-Type: application/json' -H 'Authorization: Bearer abc' --data '{\"nom\":\"x\"}'"),
    { methode: 'POST', url: 'https://api.example.com/v1/items', entetes: 'Content-Type: application/json\nAuthorization: Bearer abc', corps: '{"nom":"x"}' });
  egal('cURL : -d sans -X donne un POST, comme cURL', requeteDepuisTexte('curl https://api.example.com/f -d a=1').methode, 'POST');
  const brute = requeteDepuisTexte('PUT /v1/items/7 HTTP/1.1\nHost: api.example.com\nContent-Type: text/plain\n\nbonjour');
  egal('une requete HTTP brute : l adresse rebatie depuis Host', brute.methode + ' ' + brute.url + ' ' + brute.corps, 'PUT https://api.example.com/v1/items/7 bonjour');
  verifier('une requete HTTP brute : ses en-tetes repris, Host compris', brute.entetes.includes('Content-Type: text/plain') && brute.entetes.includes('Host: api.example.com'));
  egal('ni adresse, ni cURL, ni requete : rien', [requeteDepuisTexte('bonjour le monde'), requeteDepuisTexte(''), requeteDepuisTexte(null)].join(), ',,');

  /* fetch observe : la reponse vient d ici, rien ne part sur le reseau. */
  const appelsFetch = [];
  let repondre = () => new Response(JSON.stringify({ cree: true, id: 7 }),
    { status: 201, statusText: 'Created', headers: { 'Content-Type': 'application/json', 'Location': '/items/7' } });
  globalThis.fetch = async (adresse, init) => { appelsFetch.push({ adresse: String(adresse), init }); return repondre(); };

  await config.set({ replayEnabled: false });
  state.config = { ...config.values };
  const etat = {};
  const commande = "curl -X POST https://api.example.com/v1/items -H 'Content-Type: application/json' --data '{\"nom\":\"x\"}'";
  let redessins = 0;
  let vue = rendre(() => panneauRequete(commande, etat, () => { redessins++; }));
  egal('le formulaire se remplit de la commande du texte de travail', [etat.reqMethode, etat.reqUrl, etat.reqCorps].join(' '),
    'POST https://api.example.com/v1/items {"nom":"x"}');
  verifier('rejeu non autorise : pas de bouton Envoyer, le bouton qui autorise', !bouton(vue, 'Envoyer') && !!bouton(vue, 'Autoriser le rejeu'));
  const refus = await cmd('replay', { id: null, overrides: { method: 'GET', url: 'https://api.example.com/' } });
  verifier('rejeu non autorise : le noyau refuse, et rien ne part', /Le rejeu est desactive/.test(refus.error || '') && appelsFetch.length === 0, JSON.stringify(refus));

  await cliquer(vue, 'Autoriser le rejeu');
  verifier('« Autoriser le rejeu » : le reglage du noyau change, le panneau se redessine',
    config.get('replayEnabled') === true && state.config.replayEnabled === true && redessins === 1);

  vue = rendre(() => panneauRequete(commande, etat, () => { redessins++; }));
  verifier('rejeu autorise : le bouton Envoyer', !!bouton(vue, 'Envoyer'));
  const avant = collectStats().replay.sent;
  await cliquer(vue, 'Envoyer');
  egal('un envoi : un appel a fetch, par la commande replay du noyau', appelsFetch.length + ' ' + compter('replay'), '1 2');
  const premier = appelsFetch[0];
  egal('fetch : l adresse et la methode du formulaire', premier.adresse + ' ' + premier.init.method, 'https://api.example.com/v1/items POST');
  egal('fetch : les cookies du site, sans cache', premier.init.credentials + ' ' + premier.init.cache, 'include no-store');
  egal('fetch : les en-tetes du formulaire, et X-Swift-Replay', JSON.stringify(premier.init.headers),
    JSON.stringify({ 'Content-Type': 'application/json', 'X-Swift-Replay': '1' }));
  egal('fetch : le corps du formulaire', premier.init.body, '{"nom":"x"}');
  egal('le noyau compte l envoi', collectStats().replay.sent, avant + 1);
  const recu = etat.reqResultats && etat.reqResultats[0];
  egal('la reponse recue : statut, raison, en-tetes', recu && [recu.status, recu.statusText, recu.headers.find(h => h.name === 'location').value].join(' '), '201 Created /items/7');
  egal('le toast dit le statut', dernierToast(), 'Requete envoyee — statut 201');
  vue = rendre(() => panneauRequete(commande, etat, () => {}));
  let lu = plat(vue);
  verifier('le panneau montre la reponse et le sens du statut', lu.includes('Reponse recue 201 Created') && lu.includes('Sens du statut'), lu.slice(0, 400));
  verifier('le panneau montre le corps recu, mis en forme', lu.includes('"id": 7'));

  /* Des en-tetes que fetch ne laisse pas poser, un corps sur un GET. */
  champ(vue, 'requete-methode').value = 'GET';
  champ(vue, 'requete-url').value = 'https://api.example.com/v1/items?page=2';
  champ(vue, 'requete-entetes').value = 'Cookie: a=1\nHost: autre.example\nSec-Fetch-Mode: navigate\nX-Ok: 1\nligne sans deux-points';
  champ(vue, 'requete-corps').value = 'ignore';
  /* 204 : un statut sans corps — fetch refuse qu on lui en donne un. */
  repondre = () => new Response(null, { status: 204, statusText: 'No Content' });
  await cliquer(vue, 'Envoyer');
  const second = appelsFetch[1];
  egal('en-tetes interdits : seuls les permis partent, avec X-Swift-Replay', JSON.stringify(second.init.headers), JSON.stringify({ 'X-Ok': '1', 'X-Swift-Replay': '1' }));
  egal('un GET ne porte pas de corps', 'body' in second.init, false);
  memeListe('les en-tetes refuses sont nommes', etat.reqResultats[0].refusedHeaders, ['Cookie', 'Host', 'Sec-Fetch-Mode']);
  vue = rendre(() => panneauRequete(commande, etat, () => {}));
  lu = plat(vue);
  verifier('le panneau dit les en-tetes refuses par le navigateur', lu.includes('Entetes refuses par le navigateur Cookie, Host, Sec-Fetch-Mode'));
  verifier('les envois precedents restent listes', lu.includes('Envois precedents 1') && lu.includes('POST https://api.example.com/v1/items → 201'));

  champ(vue, 'requete-url').value = 'ftp://fichiers.example/';
  await cliquer(vue, 'Envoyer');
  egal('une adresse ni http ni https : rien ne part, le toast le dit', appelsFetch.length + ' ' + dernierToast(), '2 Adresse http ou https attendue');

  /* Le reseau refuse : l echec est dit, dans la langue de l interface. */
  champ(vue, 'requete-url').value = 'https://injoignable.example/';
  repondre = () => { throw new TypeError('NetworkError when attempting to fetch resource.'); };
  await cliquer(vue, 'Envoyer');
  egal('un echec reseau : l erreur du noyau gardee', etat.reqErreur, 'echec du rejeu : NetworkError when attempting to fetch resource.');
  vue = rendre(() => panneauRequete(commande, etat, () => {}));
  verifier('un echec reseau : le panneau le dit', plat(vue).includes('Echec : echec du rejeu : NetworkError'));
  setLang('en');
  egal('un echec reseau : traduit en anglais', te(etat.reqErreur), 'replay failed: NetworkError when attempting to fetch resource.');
  setLang('fr');

  cliquer(vue, 'Vider le formulaire');
  egal('« Vider le formulaire » remet un GET vide', [etat.reqMethode, etat.reqUrl, etat.reqEntetes, etat.reqCorps].join('|'), 'GET|||');
  vue = rendre(() => panneauRequete('https://autre.example/ping', etat, () => {}));
  cliquer(vue, 'Reprendre le texte de travail');
  egal('« Reprendre le texte de travail » relit le texte', etat.reqMethode + ' ' + etat.reqUrl, 'GET https://autre.example/ping');
  vue = rendre(() => panneauRequete('rien d utilisable', etat, () => {}));
  cliquer(vue, 'Reprendre le texte de travail');
  egal('rien a reprendre : le formulaire reste, le toast le dit', etat.reqUrl + ' | ' + dernierToast(),
    'https://autre.example/ping | Ni commande cURL, ni requete HTTP brute, ni adresse dans le texte de travail');
}

/* ======================= 3. Resolution DNS, sur un clic ==================== */
{
  egal('un nom seul', nomDepuisTexte('example.com'), 'example.com');
  egal('une adresse complete : son hote seul', nomDepuisTexte('https://user:pw@Sub.Example.com:8443/x?y#z'), 'sub.example.com');
  egal('un nom international : en punycode (RFC 3492)', nomDepuisTexte('https://Bücher.example/chemin'), 'xn--bcher-kva.example');
  egal('une adresse IP n a rien a resoudre', [nomDepuisTexte('192.168.1.10'), nomDepuisTexte('[2001:db8::1]'), nomDepuisTexte('http://[2001:db8::1]:8080/')].join('|'), '||');
  egal('deux mots, rien : aucun nom', nomDepuisTexte('deux mots') + '|' + nomDepuisTexte(''), '|');

  const appelsDns = [];
  let resoudre = async () => ({ addresses: ['93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c'], canonicalName: 'example.com', isTRR: true });
  globalThis.browser.dns.resolve = async (nom, drapeaux) => { appelsDns.push([nom, drapeaux]); return resoudre(nom, drapeaux); };

  const r = await TOOLING_COMMANDS.dnsResolve({ nom: 'WWW.Example.COM.' });
  egal('le point final retire, la casse ramenee', appelsDns[0][0], 'www.example.com');
  memeListe('par defaut : le nom canonique demande, rien d autre', appelsDns[0][1], ['canonical_name']);
  egal('la reponse : adresses, nom canonique, TRR', [r.resultat.adresses.join(' '), r.resultat.canonique, r.resultat.trr].join(' | '),
    '93.184.215.14 2606:2800:21f:cb07:6820:80da:af6b:8b2c | example.com | true');
  verifier('la reponse : une duree mesuree, une date', r.resultat.duree >= 0 && Math.abs(r.resultat.a - Date.now()) < 5000);
  await TOOLING_COMMANDS.dnsResolve({ nom: 'example.com', sansCache: true, famille: 'ipv4' });
  memeListe('sans cache, IPv4 seulement', appelsDns[1][1], ['canonical_name', 'bypass_cache', 'disable_ipv6']);
  await TOOLING_COMMANDS.dnsResolve({ nom: 'example.com', famille: 'ipv6' });
  memeListe('IPv6 seulement', appelsDns[2][1], ['canonical_name', 'disable_ipv4']);
  egal('un nom de service, avec soulignement', (await TOOLING_COMMANDS.dnsResolve({ nom: '_dmarc.example.com' })).ok, true);

  /* RFC 1123 §2.1 : des etiquettes de 63 caracteres au plus, 253 en tout. */
  const etiquette = n => 'a'.repeat(n);
  egal('63 caracteres par etiquette : admis', (await TOOLING_COMMANDS.dnsResolve({ nom: etiquette(63) + '.example' })).ok, true);
  const refuses = [];
  for (const nom of ['', '   ', 'deux mots', etiquette(64) + '.example', [etiquette(63), etiquette(63), etiquette(63), etiquette(61)].join('.') + '.x',
    '-tiret.example', 'tiret-.example', 'a..b', 'exemple.com/chemin', 'http://example.com']) {
    const res = await TOOLING_COMMANDS.dnsResolve({ nom });
    if (res.error) refuses.push(nom);
  }
  egal('les noms que DNS refuse sont refuses avant de partir', refuses.length + ' ' + appelsDns.length, '10 5');
  egal('un nom vide : dit tel quel', (await TOOLING_COMMANDS.dnsResolve({ nom: ' ' })).error, 'nom vide');
  egal('un nom invalide : nomme', (await TOOLING_COMMANDS.dnsResolve({ nom: 'deux mots' })).error, 'nom d hote invalide : deux mots');

  resoudre = async () => { throw new Error('NS_ERROR_UNKNOWN_HOST'); };
  const echec = await TOOLING_COMMANDS.dnsResolve({ nom: 'inexistant.example' });
  egal('un nom inconnu : l erreur de Firefox rendue', echec.error, 'resolution impossible : NS_ERROR_UNKNOWN_HOST');
  setLang('en');
  egal('un nom inconnu : traduit en anglais', te(echec.error), 'resolution failed: NS_ERROR_UNKNOWN_HOST');
  egal('un nom invalide : traduit en anglais', te('nom d hote invalide : deux mots'), 'invalid host name: deux mots');
  setLang('fr');
  const dns = globalThis.browser.dns;
  delete globalThis.browser.dns;
  egal('sans l API dns : dit, sans planter', (await TOOLING_COMMANDS.dnsResolve({ nom: 'example.com' })).error, 'resolution DNS indisponible dans ce navigateur');
  globalThis.browser.dns = dns;

  /* Le panneau : le nom pris du texte de travail, la commande par le noyau. */
  resoudre = async () => ({ addresses: ['93.184.215.14', '10.0.0.8'], canonicalName: 'cdn.bücher.example', isTRR: false });
  const etat = {};
  let vue = rendre(() => panneauDns('https://Bücher.example/chemin', etat, () => {}));
  egal('panneau : le nom du texte de travail, en punycode', champ(vue, 'dns-nom').value, 'xn--bcher-kva.example');
  verifier('panneau : rien ne part sans un clic', appelsDns.length === 6 && plat(vue).includes('Rien ne part sans un clic sur « Resoudre »'));
  champ(vue, 'dns-famille').value = 'ipv4';
  champ(vue, 'dns-sans-cache').checked = true;
  const avant = compter('dnsResolve');
  await cliquer(vue, 'Resoudre');
  egal('panneau : un clic, une commande au noyau', compter('dnsResolve') - avant, 1);
  memeListe('panneau : le nom et les drapeaux choisis', appelsDns[6], ['xn--bcher-kva.example', ['canonical_name', 'bypass_cache', 'disable_ipv6']]);
  vue = rendre(() => panneauDns('', etat, () => {}));
  const lu = plat(vue);
  verifier('panneau : les adresses et leur categorie', lu.includes('Adresses 2') && lu.includes('93.184.215.14') && lu.includes('10.0.0.8'), lu.slice(0, 500));
  verifier('panneau : le nom canonique, quand il differe', lu.includes('Nom canonique cdn.bücher.example'));
  verifier('panneau : TRR dit', lu.includes('DNS sur HTTPS (TRR) non'));
  champ(vue, 'dns-nom').value = '10.0.0.1';
  await cliquer(vue, 'Resoudre');
  egal('panneau : une adresse IP n est pas envoyee, le toast le dit', appelsDns.length + ' ' + dernierToast(), '7 Nom d hote attendu, par exemple example.com');
  resoudre = async () => { throw new Error('NS_ERROR_UNKNOWN_HOST'); };
  champ(vue, 'dns-nom').value = 'inexistant.example';
  await cliquer(vue, 'Resoudre');
  vue = rendre(() => panneauDns('', etat, () => {}));
  verifier('panneau : l echec est dit, les resolutions precedentes restent', plat(vue).includes('Echec : resolution impossible : NS_ERROR_UNKNOWN_HOST') && plat(vue).includes('93.184.215.14'));
}

/* ==================== 4. Client WebSocket, de bout en bout ================= */
class FauxWebSocket {
  static crees = [];
  constructor(adresse, protocoles) {
    this.url = adresse;
    this.demandes = protocoles === undefined ? null : [].concat(protocoles);
    this.readyState = 0;
    this.protocol = '';
    this.binaryType = 'blob';
    this.envoyes = [];
    this.ecouteurs = {};
    this.fermeAvec = null;
    FauxWebSocket.crees.push(this);
  }
  addEventListener(type, rappel) { (this.ecouteurs[type] ||= []).push(rappel); }
  emettre(type, ev = {}) { for (const rappel of this.ecouteurs[type] || []) rappel(ev); }
  send(donnee) { this.envoyes.push(donnee); }
  close(code) { this.fermeAvec = code; }
  /* Ce que fait le serveur, cote test. */
  ouvrir(protocole = '') { this.readyState = 1; this.protocol = protocole; this.emettre('open'); }
  recevoir(data) { this.emettre('message', { data }); }
  fermer(code, reason = '', wasClean = true) { this.readyState = 3; this.emettre('close', { code, reason, wasClean }); }
}
globalThis.WebSocket = FauxWebSocket;
{
  const session = sessionWebSocket();
  const etat = {};
  let redessins = 0;
  const panneau = entree => rendre(() => panneauWebSocket(entree, etat, () => { redessins++; }));

  await config.set({ replayEnabled: false });
  state.config = { ...config.values };
  let vue = panneau('wss://echo.example/socket');
  egal('l adresse ws:// du texte de travail reprise', champ(vue, 'ws-url').value, 'wss://echo.example/socket');
  verifier('rejeu non autorise : pas de bouton pour ouvrir', !bouton(vue, 'Ouvrir la connexion') && !!bouton(vue, 'Autoriser le rejeu'));
  await cliquer(vue, 'Autoriser le rejeu');

  vue = panneau('');
  champ(vue, 'ws-url').value = 'https://pas-un-websocket.example/';
  cliquer(vue, 'Ouvrir la connexion');
  egal('une adresse http : refusee, rien n est ouvert', FauxWebSocket.crees.length + ' ' + dernierToast(), '0 Adresse ws:// ou wss:// attendue');

  champ(vue, 'ws-url').value = '  wss://echo.example/socket ';
  champ(vue, 'ws-protocoles').value = 'chat, , superchat ';
  cliquer(vue, 'Ouvrir la connexion');
  const ws = FauxWebSocket.crees[0];
  egal('ouverture : l adresse, les sous-protocoles demandes', ws && ws.url + ' ' + JSON.stringify(ws.demandes), 'wss://echo.example/socket ["chat","superchat"]');
  egal('ouverture : les messages binaires lus en ArrayBuffer', ws.binaryType, 'arraybuffer');
  egal('avant l ouverture : en cours', session.etat, 'connexion');
  vue = panneau('');
  verifier('en cours : le bouton pour fermer, pas pour envoyer encore', !!bouton(vue, 'Fermer la connexion'));
  egal('envoyer avant l ouverture : refuse', cliquer(vue, 'Envoyer le message') + ' ' + ws.envoyes.length + ' ' + dernierToast(),
    'undefined 0 La connexion n est pas ouverte');

  ws.ouvrir('superchat');
  egal('ouverte : l etat, le sous-protocole accepte par le serveur', session.etat + ' ' + session.protocole, 'ouverte superchat');

  vue = panneau('');
  champ(vue, 'ws-message').value = 'bonjour é';
  cliquer(vue, 'Envoyer le message');
  egal('un texte envoye tel quel', ws.envoyes[0], 'bonjour é');
  vue = panneau('');
  champ(vue, 'ws-message').value = '48 69 00 FF';
  champ(vue, 'ws-hex').checked = true;
  cliquer(vue, 'Envoyer le message');
  egal('des octets ecrits en hexadecimal envoyes en binaire', ws.envoyes[1] instanceof Uint8Array && Array.from(ws.envoyes[1]).join(','), '72,105,0,255');
  vue = panneau('');
  champ(vue, 'ws-message').value = 'zz';
  cliquer(vue, 'Envoyer le message');
  egal('un hexadecimal invalide : rien n est envoye', ws.envoyes.length, 2);

  /* En direct : une rafale de messages, un seul redessin, et seulement
     quand la boite a outils est la vue ouverte. */
  state.view = 'tools';
  await attendre(160);
  const base = redessins;
  ws.recevoir('pong');
  ws.recevoir(new Uint8Array([1, 2, 254]).buffer);
  ws.recevoir('{"type":"tick","n":3}');
  await attendre(200);
  egal('trois messages en rafale : un seul redessin', redessins - base, 1);
  state.view = 'requests';
  ws.recevoir('hors de la vue');
  await attendre(200);
  egal('une autre vue ouverte : le message est garde, rien n est redessine', redessins - base + ' ' + session.messages.length, '1 6');

  const [m1, m2, m3, m4] = session.messages;
  egal('envoye : le texte, sa taille en octets UTF-8', [m1.sens, m1.texte, m1.taille, m1.binaire].join(' '), 'envoye bonjour é 10 false');
  egal('envoye : les octets montres en hexadecimal', [m2.sens, m2.texte, m2.taille, m2.binaire].join(' '), 'envoye 48 69 00 ff 4 true');
  egal('recu : un texte', [m3.sens, m3.texte].join(' '), 'recu pong');
  egal('recu : un binaire, en hexadecimal, entier', [m4.sens, m4.texte, m4.taille, m4.binaire].join(' '), 'recu 01 02 fe 3 true');

  vue = panneau('');
  const cadres = tous(vue, n => n.classList && n.classList.contains('frame'));
  egal('le journal : chaque message, les plus recents en haut', cadres.map(c => (c.classList.contains('send') ? '↑' : '↓')).join(''), '↓↓↓↓↑↑');
  verifier('le journal : le dernier recu en tete', plat(cadres[0]).includes('hors de la vue'));
  egal('le journal : un binaire porte son explication', cadres[2].getAttribute('title'), 'message binaire, montre en hexadecimal');
  const lu = plat(vue);
  verifier('l etat de la session montre', lu.includes('Etat ouverte') && lu.includes('Sous-protocole accepte superchat') && lu.includes('6 message(s), les plus recents en haut'));

  /* Une seconde connexion remplace la premiere ; la premiere ne parle plus. */
  cliquer(vue, 'Fermer la connexion');
  egal('fermer : code 1000, fermeture normale demandee', ws.fermeAvec, 1000);
  ws.fermer(1000, 'au revoir', true);
  egal('fermee : l etat et ce que le serveur a dit', session.etat + ' ' + JSON.stringify(session.fermeture), 'fermee {"code":1000,"raison":"au revoir","propre":true}');
  vue = panneau('');
  const ferme = plat(vue);
  verifier('fermee : le code et son sens', ferme.includes('Code de fermeture 1000 Fermeture normale') && ferme.includes('La transaction est terminee, des deux cotes.'));
  verifier('fermee : la raison donnee', ferme.includes('Raison donnee au revoir'));
  verifier('fermee : le journal reste', ferme.includes('6 message(s)'));

  champ(vue, 'ws-protocoles').value = '';
  cliquer(vue, 'Ouvrir la connexion');
  const ws2 = FauxWebSocket.crees[1];
  egal('sans sous-protocole : aucun n est demande', ws2 && ws2.demandes, null);
  ws.recevoir('message tardif de l ancienne');
  egal('l ancienne connexion ne parle plus a la session', session.messages.length, 6);
  ws2.emettre('error');
  ws2.fermer(1006, '', false);
  vue = panneau('');
  const anormale = plat(vue);
  verifier('une erreur : dite, avec ses causes habituelles', anormale.includes('Le navigateur signale une erreur sur cette connexion'));
  verifier('1006 : nommee et expliquee', /Code de fermeture 1006 \S/.test(anormale), anormale.slice(anormale.indexOf('Code de fermeture'), anormale.indexOf('Code de fermeture') + 120));

  cliquer(vue, 'Vider le journal');
  egal('« Vider le journal » : plus aucun message', session.messages.length, 0);
  cliquer(panneau('texte de travail'), 'Prendre le texte de travail');
  egal('« Prendre le texte de travail » remplit le message', etat.wsMessage, 'texte de travail');
}

/* ===================== 5. Le direct : Securite et journaux ================= */
{
  const alerts = await import('../ui/console/alerts.js');
  const journal = await import('../ui/console/journal.js');
  state.scope = 'all';
  state.stats = { analyzer: { findings: 0 }, logs: { cookies: 0, navigation: 0, context: 0 } };
  const lectures = () => compter('findings');
  state.view = 'alerts';
  alerts.render();
  await attendre(20);
  const premiere = lectures();
  egal('Securite ouverte : une lecture', premiere, 1);
  alerts.suivre(state.stats);
  await attendre(20);
  egal('releve du noyau sans nouvelle alerte : aucune relecture', lectures(), premiere);
  state.stats = { ...state.stats, analyzer: { findings: 3 } };
  alerts.suivre(state.stats);
  await attendre(20);
  egal('trois alertes de plus dans le noyau : une relecture, sans clic', lectures(), premiere + 1);
  alerts.suivre(state.stats);
  await attendre(20);
  egal('le meme releve encore : rien', lectures(), premiere + 1);
  state.scope = '12';
  alerts.suivre(state.stats);
  await attendre(20);
  egal('le perimetre change : relue pour le nouvel onglet', lectures(), premiere + 2);
  state.scope = 'all';

  const journaux = () => compter('logs');
  state.view = 'cookies';
  journal.render('cookies');
  await attendre(20);
  const ouvert = journaux();
  egal('journal des cookies ouvert : une lecture', ouvert, 1);
  journal.suivre('cookies', state.stats);
  await attendre(20);
  egal('aucune entree nouvelle : aucune relecture', journaux(), ouvert);
  state.stats = { ...state.stats, logs: { ...state.stats.logs, cookies: 2 } };
  journal.suivre('cookies', state.stats);
  journal.suivre('cookies', state.stats);
  await attendre(20);
  egal('deux cookies de plus : une relecture, une seule meme appelee deux fois', journaux(), ouvert + 1);
  journal.suivre('navigation', state.stats);
  await attendre(20);
  egal('un journal jamais ouvert ne se lit pas', journaux(), ouvert + 1);

  /* La Comparaison suit une requete comparee qui recoit encore. */
  const compare = await import('../ui/console/compare.js');
  const { store } = await import('../background/core/store.js');
  const creer = (adresse, texteCorps) => {
    const rec = store.create({ requestId: null, sources: ['webRequest'], url: adresse, finalUrl: adresse, method: 'GET',
      type: 'xmlhttprequest', tabId: 1, frameId: 0, thirdParty: false, startTime: Date.now() });
    rec.statusCode = 200;
    rec.responseHeaders = [{ name: 'Content-Type', value: 'text/plain' }];
    rec.responseBody = { kind: 'text', text: texteCorps, size: texteCorps.length, stored: texteCorps.length, truncated: false };
    return rec;
  };
  const a = creer('https://a.example/flux', 'debut');
  const b = creer('https://b.example/flux', 'debut');
  state.selection = new Set([a.id, b.id]);
  state.view = 'compare';
  const fiches = () => compter('record');
  await compare.loadSelection();
  const chargees = fiches();
  egal('Comparaison ouverte : les deux requetes lues', chargees >= 2, true);
  compare.suivre([{ id: 987654 }]);
  await attendre(50);
  egal('du trafic ailleurs : la comparaison ne se relit pas', fiches(), chargees);
  a.responseBody = { kind: 'text', text: 'debut et suite', size: 14, stored: 14, truncated: false };
  compare.suivre([{ id: a.id }]);
  compare.suivre([{ id: a.id }, { id: b.id }]);
  await attendre(100);
  egal('la requete de gauche recoit encore : les deux relues, une seule fois', fiches(), chargees + 2);
  verifier('la comparaison montre ce qui est arrive', plat(document.getElementById('view-compare')).includes('debut et suite'));
  compare.suivre([{ id: b.id }]);
  await attendre(300);
  egal('une seconde lecture attend la seconde suivante', fiches(), chargees + 2);
  await attendre(900);
  egal('puis se fait, une seule', fiches(), chargees + 4);
  state.view = 'requests';
  compare.suivre([{ id: a.id }]);
  await attendre(1100);
  egal('une autre vue ouverte : rien n est relu', fiches(), chargees + 4);
}

/* ================== 6. Les memes panneaux, en anglais ====================== */
/* Le releve de tests/rendu.test.mjs — toute phrase francaise que le
   traducteur ne connait pas — applique a chaque etat de ces panneaux : une
   reponse lue, une requete envoyee puis en echec, des resolutions, une
   session WebSocket fermee avec son journal. Un mot seul lui echapperait :
   les etats et les categories d adresses sont donc lus un par un. C est
   ainsi qu on a vu que les categories d adresses IP — « privee (RFC 1918) »
   — s affichaient en francais dans l interface anglaise, dans l outil
   Adresse IP aussi, depuis toujours. */
{
  const MOTS_FRANCAIS = /(^|[\s'(«])(de|du|des|la|le|les|un|une|et|est|pour|sans|avec|par|sur|dans|jamais|aucun|aucune|cette|depuis|apres|avant|entre|plus|moins|pas|qu|au|aux|leur|ou|ne|n|l|d)(\s|$)/i;
  const anglais = dejaAnglais(EN);
  const manques = new Set();
  const { panneauAdresse } = await import('../ui/console/tools-reseau.js');
  sessionWebSocket().messages.push({ sens: 'recu', a: 1, binaire: true, texte: '01 02', taille: 2 },
    { sens: 'envoye', a: 2, binaire: false, texte: 'ping', taille: 4 });
  const reqEtat = { reqResultats: [{ at: 1, duration: 12, method: 'POST', url: 'https://a.example/', status: 201, statusText: 'Created',
    headers: [{ name: 'content-type', value: 'application/json' }], bodySize: 9, body: '{"a":1}', truncated: true, refusedHeaders: ['Cookie'] },
  { at: 0, method: 'GET', url: 'https://a.example/', status: 200 }], reqErreur: 'echec du rejeu : NetworkError' };
  const dnsEtat = { dnsResultats: [{ nom: 'example.com', a: 1, duree: 3, adresses: ['93.184.215.14', '::1', '10.0.0.1', 'fd00::1'], canonique: 'x.example', trr: true }],
    dnsErreur: 'resolution impossible : NS_ERROR_UNKNOWN_HOST' };
  let vus = [];
  setLang('en');
  surManque(x => manques.add(String(x)));
  try {
    vus = [
      rendre(() => panneauReponse('HTTP/1.1 301 Moved\nLocation: /a\n\nHTTP/1.1 200 OK\nX-Frame-Options: DENY\nnot a header\n', { reponseUrl: 'ftp://x' }, () => {})),
      rendre(() => panneauReponse('> GET / HTTP/1.1\n< HTTP/1.1 200 OK\n< Content-Type: text/html\n<\n', {}, () => {})),
      rendre(() => panneauReponse('', {}, () => {})),
      rendre(() => panneauRequete('curl https://a.example/', reqEtat, () => {})),
      rendre(() => panneauDns('example.com', dnsEtat, () => {})),
      rendre(() => panneauWebSocket('', {}, () => {})),
      rendre(() => panneauAdresse('192.168.1.20/24', {}, () => {}, () => {}))
    ].map(plat);
  } finally { surManque(null); setLang('fr'); }
  const phrases = [...manques].filter(s => !anglais(s) && /\s/.test(s) && /[a-z]{3}/i.test(s) && MOTS_FRANCAIS.test(s));
  egal('en anglais : aucune phrase francaise dans ces panneaux, dans aucun de leurs etats', phrases.slice(0, 12).join(' | '), '');
  const [reponse, verbeuse, vide, requete, resolution, socket, adresse] = vus;
  verifier('en anglais : la reponse collee, ses redirections et l adresse illisible',
    reponse.includes('2 responses pasted (redirects or interim responses)') && reponse.includes('Unreadable address, or neither http nor https')
    && reponse.includes('left aside, here they are. not a header'), reponse.slice(0, 300));
  verifier('en anglais : la sortie de curl -v', verbeuse.includes('curl -v output: the response is read, 1 line(s)'));
  verifier('en anglais : le panneau vide', vide.includes('Paste the headers of a response into the working text'));
  verifier('en anglais : la reponse recue, les en-tetes refuses, l echec',
    requete.includes('Response received 201 Created') && requete.includes('Headers refused by the browser Cookie') && requete.includes('Failed: replay failed: NetworkError'),
    requete.slice(0, 300));
  verifier('en anglais : la resolution, chaque categorie d adresse traduite',
    ['93.184.215.14 public', '::1 loopback', '10.0.0.1 private (RFC 1918)', 'fd00::1 unique local, ULA (RFC 4193)', 'DNS over HTTPS (TRR) yes',
      'Failed: resolution failed: NS_ERROR_UNKNOWN_HOST'].every(x => resolution.includes(x)), resolution.slice(0, 400));
  verifier('en anglais : la session WebSocket, son etat, sa fermeture et son journal',
    socket.includes('WebSocket client closed') && socket.includes('State closed') && socket.includes('Close code 1006 Abnormal closure')
    && socket.includes('2 message(s), newest first'), socket.slice(0, 400));
  verifier('en anglais : l outil Adresse IP traduit aussi sa categorie', adresse.includes('Category private (RFC 1918)'), adresse.slice(0, 300));
}

bilan('Interroger le reseau');
