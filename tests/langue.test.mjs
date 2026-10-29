/* La langue de chacun — SWIFT (by D4RK)
 *
 *   node tests/langue.test.mjs
 *
 * Ce que la 5.8 rend au monde entier :
 *
 *   1. Une installation neuve suit la langue de Firefox : le francais pour un
 *      Firefox en francais, l anglais partout ailleurs. Un choix enregistre
 *      n est jamais remplace.
 *   2. Tout ce que SWIFT ecrit suit la langue choisie : rapport d alertes, CSV,
 *      HAR (assaini ou non), collection Postman, code genere, fiche Markdown.
 *      En anglais, aucun mot francais ; en francais, le texte d avant.
 *   3. Le CSV s ouvre d un double clic dans le tableur de chacun : un
 *      point-virgule la ou la virgule marque les decimales, une virgule
 *      ailleurs ; une cellule qui contient le separateur est entre guillemets.
 *   4. Le clic droit, la notification et les raccourcis clavier (manifeste et
 *      _locales) existent dans les deux langues.
 *   5. Un HAR exporte en anglais, relu, garde ses corps tronques.
 */
import fs from 'node:fs';
import { installerTout, enregistrementExemple, egal, memeListe, verifier, bilan } from './harnais.mjs';

installerTout();
const { config, DEFAULTS } = await import('../background/core/config.js');
const { langueChoisie, setLang, lang } = await import('../ui/lib/i18n.js');
const { EN } = await import('../ui/lib/dict-en.js');
const { GROUPS } = await import('../ui/console/settings-groups.js');
const { buildCsv, buildFindingsReport, separateurCsv } = await import('../background/export/report.js');
const { buildHar } = await import('../background/export/har.js');
const { assainirHar } = await import('../background/export/assainir.js');
const { buildPostman } = await import('../background/export/postman.js');
const { generate, generateScript } = await import('../background/export/codegen.js');
const { importHar } = await import('../background/ingest/har.js');
const { store } = await import('../background/core/store.js');
const { MENUS_SWIFT } = await import('../background/api/menus.js');
await config.ready;

/* ------------------- 1. La langue d une installation neuve ----------------- */
egal('une installation neuve suit la langue de Firefox', DEFAULTS.lang, 'auto');
egal('Firefox en francais : francais', langueChoisie('auto', 'fr'), 'fr');
egal('Firefox en francais du Canada : francais', langueChoisie('auto', 'fr-CA'), 'fr');
egal('Firefox en francais de Belgique, ecrit a l ancienne : francais', langueChoisie('auto', 'fr_BE'), 'fr');
egal('Firefox en allemand : anglais', langueChoisie('auto', 'de'), 'en');
egal('Firefox en anglais americain : anglais', langueChoisie('auto', 'en-US'), 'en');
egal('Firefox en japonais : anglais', langueChoisie('auto', 'ja'), 'en');
egal('Firefox en espagnol : anglais', langueChoisie('auto', 'es-ES'), 'en');
egal('le frison du Nord (frr) n est pas du francais', langueChoisie('auto', 'frr'), 'en');
egal('le frison occidental (fy) n est pas du francais', langueChoisie('auto', 'fy-NL'), 'en');
egal('langue inconnue : anglais', langueChoisie('auto', ''), 'en');
egal('un choix enregistre l emporte : francais', langueChoisie('fr', 'en-US'), 'fr');
egal('un choix enregistre l emporte : anglais', langueChoisie('en', 'fr-FR'), 'en');
egal('un reglage abime suit Firefox', langueChoisie('klingon', 'fr'), 'fr');
setLang('en');
egal('setLang applique un choix', lang(), 'en');
setLang('fr');
egal('setLang revient au francais', lang(), 'fr');
const champLangue = GROUPS.flatMap(g => g.fields).find(f => f[0] === 'lang');
memeListe('le reglage propose d abord la langue de Firefox', champLangue[3].map(o => o[0]), ['auto', 'fr', 'en']);
verifier('« Celle de Firefox » est traduite', typeof EN['Celle de Firefox'] === 'string');

/* ------------------------- 2. Ce que SWIFT ecrit --------------------------- */
/* Des donnees sans un mot de francais : ce que le test cherche dans les
   fichiers anglais ne peut venir que de SWIFT lui-meme. */
const ALERTE = 'Jeton JWT non signe (alg: none)';
const neutre = (patch = {}) => enregistrementExemple({
  url: 'https://api.example.com/v2/accounts/42', finalUrl: 'https://api.example.com/v2/accounts/42',
  host: 'api.example.com', path: '/v2/accounts/42',
  requestBody: { size: 16, kind: 'texte', source: 'webRequest', text: '{"op":"balance"}' },
  responseBody: { size: 15, kind: 'texte', source: 'streamFilter', text: '{"balance":128}' },
  analysis: { risk: 'critical', tags: ['jwt'], findings: [{ severity: 'critical', rule: 'jwt', title: ALERTE, where: 'header', sample: 'eyJ' }] },
  ...patch
});
const FRANCAIS = /\b(requetes?|reponses?|alertes?|genere|serveur|octets|corps|masquee?s?|assaini|tronque|aucune?|doublon|cree|capturees?|observee?s?|valeur|champ|duree|taille|statut|couches|heure|methode|hote|chemin|risque|marqueurs|jeton|signe|mesure|detaillees|ecarts|evenements|natif|transposable|identifiant|inconnu|sans-hote|perimetre|analysees?|porteuses)\b/i;
const sansFrancais = (nom, texte) => {
  const m = FRANCAIS.exec(texte);
  return verifier(nom + ' : aucun mot francais', !m, m ? '« ' + m[0] + ' » dans ' + JSON.stringify(texte.slice(Math.max(0, m.index - 60), m.index + 60)) : '');
};
verifier('l alerte de l exemple est traduite', typeof EN[ALERTE] === 'string');
/* Le champ `_swift` d un HAR porte l enregistrement tel que SWIFT le garde,
   alertes comprises : ce sont des donnees, que la relecture restaure a
   l identique — traduites, elles ne se retraduiraient plus. Le reste du
   fichier est du texte pour qui le lit. */
const horsSwift = har => JSON.stringify(har, (cle, valeur) => (cle === '_swift' ? undefined : valeur));

setLang('en');
{
  const rapport = buildFindingsReport([neutre()]);
  verifier('rapport : titre anglais', rapport.startsWith('# SWIFT — alert report'), rapport.split('\n')[0]);
  verifier('rapport : l alerte dans sa traduction', rapport.includes(EN[ALERTE]));
  sansFrancais('rapport', rapport);
  const vide = buildFindingsReport([neutre({ analysis: null })]);
  verifier('rapport sans alerte : dit en anglais', vide.includes(EN['Aucune alerte detectee sur le perimetre analyse.']));
  sansFrancais('rapport sans alerte', vide);

  const csv = buildCsv([neutre()], { separateur: ',' });
  egal('CSV : entete anglaise, separee par des virgules', csv.replace(/^﻿/, '').split('\r\n')[0],
    'id,time,method,status,host,path,type,mime,size,duration_ms,ip,layers,risk,markers,alerts');
  verifier('CSV : l alerte dans sa traduction', csv.includes(EN[ALERTE]));
  sansFrancais('CSV', csv);

  const har = buildHar([neutre({ responseBody: { size: 900, kind: 'texte', source: 'streamFilter', text: '{"balance":1', truncated: true } })]);
  egal('HAR : commentaire anglais', har.log.comment, 'SWIFT export — requests: 1, no duplicates.');
  egal('HAR : auteur', har.log.creator.comment, 'by D4RK');
  egal('HAR : corps tronque dit en anglais', har.log.entries[0].response.content.comment, 'truncated by SWIFT');
  sansFrancais('HAR', horsSwift(har));
  verifier('HAR : le champ _swift garde l alerte telle quelle, pour la relecture',
    JSON.stringify(har.log.entries[0]._swift || {}).includes(ALERTE));
  const avant = new Set(store.order);
  importHar(har);
  const relu = store.get(store.order.find(id => !avant.has(id)));
  verifier('HAR anglais relu : le corps reste tronque', relu && relu.responseBody && relu.responseBody.truncated === true);

  const assaini = assainirHar(buildHar([neutre()]));
  verifier('HAR assaini : commentaire anglais', /Sanitised by SWIFT: \d+ value\(s\) masked\./.test(assaini.har.log.comment), assaini.har.log.comment);
  verifier('HAR assaini : marque anglaise', JSON.stringify(assaini.har).includes('[masked by SWIFT]'));
  sansFrancais('HAR assaini', horsSwift(assaini.har));

  const postman = buildPostman([neutre(), neutre({ id: 2, host: '' })]);
  verifier('Postman : description anglaise', postman.info.description.startsWith('Requests captured by SWIFT (by D4RK): 2.'), postman.info.description);
  verifier('Postman : reponse nommee en anglais', postman.item[0].item[0].response[0].name.startsWith('Response observed on '));
  verifier('Postman : dossier sans hote nomme en anglais', postman.item.some(d => d.name === 'no-host'));
  sansFrancais('Postman', JSON.stringify(postman));

  const fiche = generate('markdown', neutre());
  verifier('fiche Markdown : tableau anglais', fiche.includes('| Field | Value |') && fiche.includes('| Status |') && fiche.includes('**Alerts**'));
  sansFrancais('fiche Markdown', fiche);
  const binaire = neutre({ requestBody: { size: 64, kind: 'binary', base64: 'AAEC' }, responseBody: { size: 64, kind: 'binary', base64: 'AAEC' } });
  verifier('cURL : corps binaire dit en anglais', generate('curl', binaire).includes('# binary body: 64 bytes, cannot be written on a command line'));
  verifier('reponse brute : corps binaire dit en anglais', generate('http-response', binaire).includes('[binary body, 64 bytes]'));
  verifier('Node : commentaire anglais', generate('node', neutre()).startsWith('// Node 18+: fetch is built in'));
  verifier('HTTPie : commentaire anglais', generate('httpie', neutre()).includes('# with the body: echo '));
  const script = generateScript('curl', [neutre()]);
  verifier('script : titre anglais', script.content.includes('SWIFT (by D4RK) — requests: 1'));
  for (const genre of ['curl', 'httpie', 'node', 'http-response', 'markdown']) sansFrancais('code ' + genre, generate(genre, binaire));
  sansFrancais('script cURL', script.content);
}

/* Les journaux de navigation et de contexte assemblaient « onglet 3 / cadre 0 »
   et « ERREUR » hors de toute traduction : l interface anglaise les montrait. */
{
  const { describe } = await import('../ui/console/journal.js');
  const nav = { kind: 'error', tabId: 3, frameId: 0, url: 'https://shop.example.com/', transitionType: 'link', error: 'NS_ERROR_NET_RESET' };
  const ligne = describe('navigation', nav);
  verifier('journal de navigation : onglet et cadre en anglais', ligne.startsWith('tab 3 / frame 0'), ligne);
  verifier('journal de navigation : erreur en anglais', ligne.includes('ERROR NS_ERROR_NET_RESET'), ligne);
  sansFrancais('journal de navigation', ligne);
  const ctx = describe('context', { kind: 'worker:create', url: 'https://shop.example.com/w.js', frameUrl: 'https://shop.example.com/' });
  verifier('journal de contexte : cadre en anglais', ctx.includes('frame https://shop.example.com/'), ctx);
  sansFrancais('journal de contexte', ctx);
}

/* Des titres assembles avant d etre traduits : « Lectures de « 1761759600 » »
   et « 16 octets en hexadecimal » n avaient aucune entree, et restaient en
   francais dans l interface anglaise. */
{
  const { panneauHorodatage } = await import('../ui/console/tools-temps.js');
  const { panneauGenerateurs } = await import('../ui/console/tools-generer.js');
  /* Le DOM du harnais ne compose pas textContent : le texte se lit noeud par
     noeud, comme dans ui-load. */
  const texteDe = n => !n ? '' : String(n.textContent || '') + [...(n.children || [])].map(e => ' ' + texteDe(e)).join('');
  const temps = texteDe(panneauHorodatage('1761759600'));
  verifier('horodatage : le panneau se lit', temps.includes('1761759600'), temps.slice(0, 120));
  verifier('horodatage : les lectures titrees en anglais', temps.includes('Readings of "1761759600"'), temps.slice(0, 200));
  verifier('horodatage : aucun « Lectures de »', !temps.includes('Lectures de'));
  const generer = texteDe(panneauGenerateurs(() => {}, {}, () => {}));
  verifier('generateur : le panneau se lit', generer.includes('32 bytes as base64'), generer.slice(0, 120));
  for (const n of [16, 32, 64]) {
    verifier('generateur : ' + n + ' octets en hexadecimal, en anglais', generer.includes(n + ' bytes as hexadecimal'));
  }
  verifier('generateur : aucun « octets »', !/octets/.test(generer));
  egal('flux : le titre se traduit avec son numero', EN['Flux #{id}'], 'Stream #{id}');
}

/* Le garde-fou de ces trois fautes : aucun texte assemble avant d etre passe
   a une fonction qui traduit. Un gabarit a trous (tp) se traduit ; un
   assemblage n a jamais d entree dans le dictionnaire. */
{
  const ASSEMBLE = /\b(sec|t|kv|button|toast|vide)\(('[^']*[a-z]{3}[^']*' \+|[A-Za-z_.]+ \+ '[^']*[a-z]{3}[^']*')/;
  const fautes = [];
  const parcourir = dossier => {
    for (const nom of fs.readdirSync(new URL(dossier, import.meta.url))) {
      const rel = dossier + nom;
      if (fs.statSync(new URL(rel, import.meta.url)).isDirectory()) { parcourir(rel + '/'); continue; }
      if (!nom.endsWith('.js') || nom.startsWith('dict-en')) continue;
      fs.readFileSync(new URL(rel, import.meta.url), 'utf8').split('\n').forEach((ligne, i) => {
        if (ASSEMBLE.test(ligne)) fautes.push(rel.replace('../', '') + ':' + (i + 1));
      });
    }
  };
  parcourir('../ui/');
  parcourir('../background/');
  verifier('aucun texte assemble avant d etre traduit', fautes.length === 0, fautes.join(', '));
}

/* -------------- Aucun francais dans les outils en anglais ----------------
   Les bibliotheques rendent leurs libelles en francais, cle du dictionnaire :
   un panneau qui les affiche sans t(), ou une cle sans entree, laissait du
   francais dans l interface anglaise (« Adresse de courriel », « il y a 839
   jours », « Web chiffre par TLS »). Chaque panneau est rendu ici dans les
   deux langues avec ce qu un operateur colle vraiment, et deux filets
   cherchent ce qui a echappe a la traduction : des mots francais, et des
   phrases restees identiques d une langue a l autre. */
{
  const { chargerPanneaux, etatOutils } = await import('./panneaux-outils.mjs');
  const { VECTEURS } = { VECTEURS: {
    jose: JSON.parse(fs.readFileSync(new URL('./vecteurs-jose.json', import.meta.url), 'utf8')),
    cles: JSON.parse(fs.readFileSync(new URL('./vecteurs-cles.json', import.meta.url), 'utf8'))
  } };
  const jetonRfc = JSON.stringify(VECTEURS.jose.rfc7515).match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0];
  const COLLAGES = [
    '', 'eyJ1c2VyIjoiYWRhIiwicm9sZSI6ImFkbWluIn0', jetonRfc, VECTEURS.cles.ec256.certificat,
    VECTEURS.cles.rsa2048.pem, VECTEURS.cles.ed25519.ssh, 'SWIFT by D4RK', '1761759600', '1761759600123',
    'https://api.example.com/v2/catalog?page=1&sort=price&utm_source=mail#reviews', 'http://example.com:8080/x',
    '203.0.113.42/24', '2001:db8::1', '10.0.0.1', '0190a6f2-7c3e-7b8a-9f00-2b1c3d4e5f60',
    '550e8400-e29b-41d4-a716-446655440000',
    'curl -X POST https://api.example.com/v2/cart -H "Content-Type: application/json" -d \'{"item":"REF-8842"}\'',
    'otpauth://totp/Shop:ada@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Shop', '{"a":1,"b":[1,2,{"c":"d"}]}',
    '48656c6c6f20776f726c64', '5f4dcc3b5aa765d61d8327deb882cf99',
    'Content-Type: application/json\nCache-Control: max-age=300\nSet-Cookie: a=b; Secure',
    'GET /index.html HTTP/1.1\nHost: example.com', '0x1F', '255', 'JBSWY3DPEHPK3PXP',
    '01HZY3Q8G4K6Y2J8R5ZC0V9X7T', 'AAEC', '%7B%22a%22%3A1%7D', '&lt;b&gt;', 'a\tb c\nd',
    'Via: 1.1 proxy-a, 1.1 proxy-b\nX-Forwarded-For: 203.0.113.1, 10.0.0.2\n'
      + 'Content-Disposition: attachment; filename="r.pdf"\nAuthorization: Basic YWRhOnNlY3JldA==\n'
      + 'Range: bytes=0-99\nStrict-Transport-Security: max-age=31536000; includeSubDomains\n'
      + 'Content-Security-Policy: default-src \'self\'\nCache-Control: no-store, private\nExpires: 0'
  ];
  const etat = () => ({ ...etatOutils(), motif: 'a', autreTexte: '{"a":2}' });
  const fragments = n => {
    const sortie = [];
    const visiter = x => {
      if (!x) return;
      for (const v of [x.textContent, x.title, x.placeholder]) { const s = String(v || '').trim(); if (s) sortie.push(s); }
      for (const e of x.children || []) visiter(e);
    };
    visiter(n);
    return sortie;
  };
  const MOTS_FRANCAIS = /\b(le|la|les|des|une|est|sont|cette|cet|pour|avec|aucune?|il y a|jours|chiffre|dans|sur|par|mais|qui|que|du|aux|sans|selon|entre|deja|tres|leurs?|peut|doit|valeur|entete|requete|reponse|octets|corps|donnees?|cle|chaine|caracteres?|fichier|lignes?|nombre|jeton|introuvable|invalide|ecrit|ici|vide|n est|d un|d une|qu un|qu une|ou|et|de|en|au|rien|espace|tabulation|saut)\b/;
  const enAnglais = new Map(), identiques = new Map();
  const panneaux = await chargerPanneaux();
  for (const [nom, rendre] of panneaux) {
    for (const collage of COLLAGES) {
      const rendus = {};
      for (const langue of ['fr', 'en']) {
        setLang(langue);
        try { rendus[langue] = fragments(await rendre(collage, etat())); } catch { rendus[langue] = []; }
      }
      const francais = new Set(rendus.fr);
      for (const f of rendus.en) {
        /* La donnee collee, ou ce que le panneau en tire mot pour mot, n est
           pas un texte de l interface. */
        if (collage && (f.includes(collage) || collage.includes(f))) continue;
        if (/^[0-9a-f]{8}  /.test(f) || /^([0-9a-f]{2} )+[0-9a-f]{2}$/i.test(f)) continue;   // octets en hexadecimal
        const mot = MOTS_FRANCAIS.exec(f);
        if (mot && !/[A-Za-z]{4,}\d|https?:|[{}<>]/.test(f)) enAnglais.set(nom + ' : ' + f.slice(0, 90), mot[0]);
        if (francais.has(f) && nom !== 'cles' && /\s/.test(f) && /[a-z]{4,}/.test(f) && mot) identiques.set(nom + ' : ' + f.slice(0, 90), true);
      }
    }
  }
  setLang('en');
  verifier('aucun mot francais dans les vingt-quatre outils en anglais', enAnglais.size === 0,
    [...enAnglais].slice(0, 12).map(([f, m]) => f + ' [' + m + ']').join(' || '));
  verifier('aucune phrase restee la meme en francais et en anglais', identiques.size === 0,
    [...identiques.keys()].slice(0, 12).join(' || '));
}

/* Le francais reste celui d avant. */
setLang('fr');
{
  verifier('rapport francais', buildFindingsReport([neutre()]).startsWith('# SWIFT — rapport d alertes'));
  egal('CSV francais : entete inchangee', buildCsv([neutre()], { separateur: ';' }).replace(/^﻿/, '').split('\r\n')[0],
    'id;heure;methode;statut;hote;chemin;type;mime;taille;duree_ms;ip;couches;risque;marqueurs;alertes');
  egal('HAR francais : commentaire', buildHar([neutre()]).log.comment, 'Export SWIFT — requetes : 1, sans doublon.');
  verifier('HAR assaini francais', /Assaini par SWIFT : \d+ valeur\(s\) masquee\(s\)\./.test(assainirHar(buildHar([neutre()])).har.log.comment));
  verifier('fiche Markdown francaise', generate('markdown', neutre()).includes('| Champ | Valeur |'));
  const { describe } = await import('../ui/console/journal.js');
  verifier('journal de navigation francais', describe('navigation', { tabId: 3, frameId: 0, url: 'https://a.test/', error: 'X' })
    .startsWith('onglet 3 / cadre 0') && describe('navigation', { tabId: 3, frameId: 0, url: 'https://a.test/', error: 'X' }).includes('ERREUR X'));
}

/* --------------------------- 3. Le separateur CSV -------------------------- */
egal('France : point-virgule', separateurCsv('fr-FR'), ';');
egal('Allemagne : point-virgule', separateurCsv('de-DE'), ';');
egal('Espagne : point-virgule', separateurCsv('es-ES'), ';');
egal('Bresil : point-virgule', separateurCsv('pt-BR'), ';');
egal('Etats-Unis : virgule', separateurCsv('en-US'), ',');
egal('Royaume-Uni : virgule', separateurCsv('en-GB'), ',');
egal('Japon : virgule', separateurCsv('ja-JP'), ',');
egal('Chine : virgule', separateurCsv('zh-CN'), ',');
egal('Inde : virgule', separateurCsv('hi-IN'), ',');
egal('region illisible : virgule', separateurCsv('?!'), ',');
{
  const virgule = neutre({ path: '/a,b' });
  verifier('cellule avec virgule entre guillemets sous la virgule', buildCsv([virgule], { separateur: ',' }).includes('"/a,b"'));
  verifier('la meme cellule nue sous le point-virgule', buildCsv([virgule], { separateur: ';' }).includes(';/a,b;'));
  verifier('cellule avec point-virgule entre guillemets sous le point-virgule', buildCsv([neutre({ path: '/a;b' })], { separateur: ';' }).includes('"/a;b"'));
  /* Un Content-Type vient du serveur : commencant par « = », un tableur le
     lirait comme une formule (OWASP, CSV Injection). */
  const piege = buildCsv([neutre({ mime: '=HYPERLINK("https://evil.test","x")' })], { separateur: ',' });
  verifier('CSV : une valeur qui commence par = reste du texte', piege.includes('"\'=HYPERLINK(""https://evil.test"",""x"")"'), piege.split('\r\n')[1]);
  for (const debut of ['+', '-', '@']) {
    verifier('CSV : une valeur qui commence par ' + debut + ' reste du texte',
      buildCsv([neutre({ mime: debut + 'x' })], { separateur: ',' }).includes(',\'' + debut + 'x,'));
  }
  verifier('CSV : un nombre negatif ou une taille restent des nombres', /,96,128,/.test(buildCsv([neutre()], { separateur: ',' })));
  const parDefaut = buildCsv([neutre()]).replace(/^﻿/, '').split('\r\n')[0];
  verifier('sans consigne, le separateur de la region courante', parDefaut.startsWith('id' + separateurCsv()));
}

/* ---------------- 4. Clic droit, notification, raccourcis ------------------ */
for (const [id, titre] of MENUS_SWIFT) {
  verifier('menu ' + id + ' traduit', typeof EN[titre] === 'string' && EN[titre].startsWith('SWIFT'), titre);
  if (EN[titre]) sansFrancais('menu ' + id, EN[titre]);
}
verifier('notification traduite', typeof EN['SWIFT — alerte critique'] === 'string' && typeof EN['Alerte critique'] === 'string');
verifier('regle « bloquer ce domaine » traduite', typeof EN['Bloquer {hote}'] === 'string');
{
  const racine = new URL('../', import.meta.url);
  const manifeste = JSON.parse(fs.readFileSync(new URL('manifest.json', racine), 'utf8'));
  const messages = l => JSON.parse(fs.readFileSync(new URL('_locales/' + l + '/messages.json', racine), 'utf8'));
  const en = messages('en'), fr = messages('fr');
  const raccourcis = Object.entries(manifeste.commands || {});
  verifier('quatre raccourcis', raccourcis.length === 4);
  for (const [nom, commande] of raccourcis) {
    const m = /^__MSG_(\w+)__$/.exec(commande.description || '');
    verifier('raccourci ' + nom + ' : description traduite par _locales', !!m, commande.description);
    if (!m) continue;
    verifier('raccourci ' + nom + ' : anglais present', !!(en[m[1]] && en[m[1]].message));
    verifier('raccourci ' + nom + ' : francais present', !!(fr[m[1]] && fr[m[1]].message));
    if (en[m[1]]) sansFrancais('raccourci ' + nom, en[m[1]].message);
  }
}

bilan('La langue de chacun');
