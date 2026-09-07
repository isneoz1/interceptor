/* Tests du noyau — INTERCEPTOR (cree par D4RK)
 *
 * Le noyau tourne dans le processus d arriere-plan de Firefox. Ici il tourne
 * sous Node, avec le harnais qui imite l API WebExtension : la logique testee
 * est exactement celle qui s execute dans le navigateur, sans reecriture.
 *
 * Couvre : normalisation d URL, correlation anti-doublon, magasin, moteur de
 * regles, analyseur de securite, export HAR, import curl, generation de code.
 */
import { installerTout, enregistrementExemple, egal, memeListe, verifier, leve, bilan }
  from './harnais.mjs';

installerTout();

const { normalizeUrl, hostOf, pathOf, schemeOf, headerGet, headersToObject, parseContentType,
  isTextualMime, looksBinary, truncateText } = await import('../background/lib/util.js');
const { config, DEFAULTS } = await import('../background/core/config.js');
const { store, newRecord, reserveIds } = await import('../background/core/store.js');
const { signatureOf, urlKeyOf, correlator } = await import('../background/core/dedup.js');
const { analyze, analyzerStats, SEVERITY } = await import('../background/core/analyzer.js');
const { applyRules, ruleStats, invalidateRuleCache } = await import('../background/rules/engine.js');
const { buildHar } = await import('../background/export/har.js');
const { analyserCurl, decouper } = await import('../background/ingest/curl.js');
const { generate, GENERATORS, GENERATOR_FILES, generateScript } = await import('../background/export/codegen.js');

await config.ready;

/* ------------------------------ Utilitaires ------------------------------- */
/* La normalisation est la cle de voute de l anti-doublon : deux ecritures de
   la meme adresse doivent donner exactement la meme chaine. */
egal('port par defaut retire et hote en minuscules',
  normalizeUrl('https://A.EXEMPLE.fr:443/a/../b?x=1#f'), 'https://a.exemple.fr/b?x=1');
egal('deux ecritures d une meme URL se rejoignent',
  normalizeUrl('https://a.fr:443/x'), normalizeUrl('HTTPS://A.FR/x'));
egal('hote extrait', hostOf('https://a.exemple.fr/x?y=1'), 'a.exemple.fr');
egal('chemin extrait, requete comprise', pathOf('https://a.exemple.fr/x/y?z=1'), '/x/y?z=1');
egal('schema extrait', schemeOf('https://a.exemple.fr/x'), 'https');
egal('entete lu sans tenir compte de la casse',
  headerGet([{ name: 'Content-Type', value: 'text/html' }], 'content-type'), 'text/html');
egal('entetes repetees jointes',
  headersToObject([{ name: 'A', value: '1' }, { name: 'a', value: '2' }]).a, '1, 2');
egal('type de contenu decoupe', parseContentType('text/html; charset=utf-8').charset, 'utf-8');
verifier('JSON considere comme textuel', isTextualMime('application/json'));
verifier('PNG non considere comme textuel', !isTextualMime('image/png'));
verifier('octets de controle trahissent du binaire', looksBinary('\x00\x01\x02abc\x00'));
verifier('du texte ordinaire n est pas pris pour du binaire', !looksBinary('Bonjour, ceci est du texte.'));
const coupe = truncateText('a'.repeat(100), 10);
egal('texte tronque a la longueur demandee', coupe.text.length, 10);
verifier('troncature signalee', coupe.truncated === true);
egal('taille d origine conservee', coupe.size, 100);
verifier('texte court non tronque', truncateText('court', 10).truncated === false);

/* ------------------------------- Signatures ------------------------------- */
egal('signature normalisee', signatureOf('get', 'https://a.fr/x', 3, 0), 'GET https://a.fr/x @3/0');
egal('meme requete, meme signature',
  signatureOf('GET', 'https://a.fr/x', 3, 0), signatureOf('get', 'HTTPS://A.FR/x', 3, 0));
verifier('onglets differents, signatures differentes',
  signatureOf('GET', 'https://a.fr/x', 3, 0) !== signatureOf('GET', 'https://a.fr/x', 4, 0));
verifier('methodes differentes, signatures differentes',
  signatureOf('GET', 'https://a.fr/x', 3, 0) !== signatureOf('POST', 'https://a.fr/x', 3, 0));
egal('cle sans methode', urlKeyOf('https://a.fr/x', 3), 'https://a.fr/x @3');

/* --------------------------------- Magasin -------------------------------- */
const vierge = newRecord({ url: 'https://a.exemple.fr/x', method: 'GET', tabId: 3 });
verifier('identifiant attribue', Number.isInteger(vierge.id) && vierge.id > 0);
egal('etat initial', vierge.state, 'pending');
verifier('champs de correlation prets', vierge.dedup && vierge.dedup.merged === 0);
verifier('deux enregistrements ont deux identifiants',
  newRecord().id !== newRecord().id);

/* reserveIds evite qu une session restauree ecrase les lignes rechargees. */
const avant = newRecord().id;
reserveIds(avant + 1000);
verifier('compteur repositionne au-dessus des identifiants restaures',
  newRecord().id > avant + 1000);

/* Le magasin remplit lui-meme schema, hote et chemin depuis l URL. */
const range = store.create({
  url: 'https://a.exemple.fr/dossier/page?x=1', method: 'GET', tabId: 3, startTime: Date.now()
});
egal('schema deduit', range.scheme, 'https');
egal('hote deduit', range.host, 'a.exemple.fr');
egal('chemin deduit', range.path, '/dossier/page?x=1');
verifier('enregistrement present dans le magasin', store.records.has(range.id));
verifier('enregistrement present dans l ordre', store.order.includes(range.id));
egal('retrouve par identifiant', store.get(range.id), range);

store.bindRequestId(range, 'rid-7');
egal('retrouve par requestId Firefox', store.byRid('rid-7'), range);
store.addSource(range, 'page');
verifier('source ajoutee une seule fois',
  (store.addSource(range, 'page'), range.sources.filter(s => s === 'page').length === 1));

verifier('un evenement de chronologie est ajoute', store.mark(range, 'debut', 1000) === true);
verifier('le meme evenement au meme instant n est pas duplique',
  store.mark(range, 'debut', 1000) === false);

store.finalize(range, 'complete');
egal('etat final', range.state, 'complete');
verifier('duree calculee', range.duration != null);

store.clear();
egal('magasin vide apres nettoyage', store.order.length, 0);
egal('plus aucun enregistrement', store.records.size, 0);

/* ---------------------------- Moteur de regles ---------------------------- */
/* Une regle ne doit agir que sur ce qu elle designe : on verifie les deux
   sens, la correspondance et la non-correspondance. */
await config.set({
  rulesEnabled: true,
  rules: [
    { id: 'r-bloc', enabled: true, name: 'Bloquer pub.exemple.fr',
      match: { host: 'pub.exemple.fr' }, action: 'block' },
    { id: 'r-redir', enabled: true, name: 'Rediriger vieux chemin',
      match: { urlRegex: '^https://a\\.exemple\\.fr/vieux' }, action: 'redirect',
      redirectUrl: 'https://a.exemple.fr/neuf' }
  ]
});
invalidateRuleCache();

const cible = newRecord({ url: 'https://pub.exemple.fr/banniere.js', host: 'pub.exemple.fr', method: 'GET' });
const bloque = applyRules(cible, 'onBeforeRequest', { url: cible.url });
verifier('la regle de blocage annule la requete', !!(bloque && bloque.cancel));
verifier('la regle appliquee est tracee dans l enregistrement',
  cible.rulesApplied.some(r => r.action === 'block'));

const epargne = newRecord({ url: 'https://a.exemple.fr/page.js', host: 'a.exemple.fr', method: 'GET' });
egal('une URL hors du motif n est pas touchee',
  applyRules(epargne, 'onBeforeRequest', { url: epargne.url }), null);

const ancien = newRecord({ url: 'https://a.exemple.fr/vieux/page', host: 'a.exemple.fr', method: 'GET' });
const redirige = applyRules(ancien, 'onBeforeRequest', { url: ancien.url });
egal('la redirection pointe vers la nouvelle adresse',
  redirige && redirige.redirectUrl, 'https://a.exemple.fr/neuf');

/* Une methode ou un type qui ne correspond pas ecarte la regle. */
await config.set({ rules: [
  { id: 'r-post', enabled: true, name: 'POST seulement',
    match: { host: 'a.exemple.fr', method: 'POST' }, action: 'block' }
] });
invalidateRuleCache();
egal('un GET echappe a une regle qui vise POST',
  applyRules(newRecord({ url: 'https://a.exemple.fr/x', host: 'a.exemple.fr', method: 'GET' }),
    'onBeforeRequest', { url: 'https://a.exemple.fr/x' }), null);
verifier('un POST est bien pris par la meme regle',
  !!applyRules(newRecord({ url: 'https://a.exemple.fr/x', host: 'a.exemple.fr', method: 'POST' }),
    'onBeforeRequest', { url: 'https://a.exemple.fr/x' }));

/* Une expression illisible doit rendre la regle inerte, jamais l elargir :
   une parenthese oubliee ne doit pas transformer « cette URL » en « toutes ». */
await config.set({ rules: [
  { id: 'r-casse', enabled: true, name: 'Motif casse',
    match: { urlRegex: '^https://a\\.exemple\\.fr/(vieux' }, action: 'block' }
] });
invalidateRuleCache();
egal('une expression illisible ne bloque rien',
  applyRules(newRecord({ url: 'https://autre.fr/x', host: 'autre.fr', method: 'GET' }),
    'onBeforeRequest', { url: 'https://autre.fr/x' }), null);
egal('une expression illisible ne bloque pas non plus l hote vise',
  applyRules(newRecord({ url: 'https://a.exemple.fr/vieux', host: 'a.exemple.fr', method: 'GET' }),
    'onBeforeRequest', { url: 'https://a.exemple.fr/vieux' }), null);

await config.set({ rulesEnabled: false });
invalidateRuleCache();
egal('regles desactivees : plus aucune action',
  applyRules(cible, 'onBeforeRequest', { url: cible.url }), null);
verifier('les regles tiennent leurs compteurs', ruleStats.evaluated > 0);

/* ------------------------------- Analyseur -------------------------------- */
/* L analyseur est volontairement avare : il ne signale que ce qui est
   demontrable a partir de la capture. Les deux sens sont testes. */
await config.set({ analyzerEnabled: true, analyzeSecrets: true, analyzeTransport: true, analyzeCookies: true });

const propre = analyze(enregistrementExemple(), { force: true });
egal('une requete HTTPS ordinaire ne declenche rien', propre.findings.length, 0);
egal('risque nul', propre.risk, 'none');

/* Identifiants dans l URL : demontrable, critique. */
const dansUrl = analyze(enregistrementExemple({
  url: 'https://marie:motdepasse@a.exemple.fr/x',
  finalUrl: 'https://marie:motdepasse@a.exemple.fr/x'
}), { force: true });
verifier('identifiants dans l URL signales',
  dansUrl.findings.some(f => f.rule === 'exposure' && f.severity === 'critical'));

/* Jeton en query string : le nom du parametre et la longueur sont exiges. */
const jetonUrl = analyze(enregistrementExemple({
  url: 'https://a.exemple.fr/x?access_token=aZ3kD9fLpQ2sVx7yTr4WbN1m',
  finalUrl: 'https://a.exemple.fr/x?access_token=aZ3kD9fLpQ2sVx7yTr4WbN1m'
}), { force: true });
verifier('jeton en query string signale',
  jetonUrl.findings.some(f => f.title === 'Jeton passe en query string'));

const triAnodin = analyze(enregistrementExemple({
  url: 'https://a.exemple.fr/x?key=3', finalUrl: 'https://a.exemple.fr/x?key=3'
}), { force: true });
verifier('un parametre court et anodin ne declenche rien',
  !triAnodin.findings.some(f => f.rule === 'exposure'));

/* JWT « alg: none » : l en-tete du jeton le dit lui-meme. */
const enteteNone = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/=/g, '');
const chargeNone = btoa(JSON.stringify({ sub: '42' })).replace(/=/g, '');
const jwtNone = analyze(enregistrementExemple({
  requestHeaders: [{ name: 'Authorization', value: 'Bearer ' + enteteNone + '.' + chargeNone + '.' }]
}), { force: true });
verifier('JWT non signe signale',
  jwtNone.findings.some(f => f.rule === 'jwt' && f.severity === 'critical'));

/* HTTP en clair, mais seulement si quelque chose circule vraiment. */
const clairAvecJeton = analyze(enregistrementExemple({
  url: 'http://a.exemple.fr/x', finalUrl: 'http://a.exemple.fr/x', scheme: 'http',
  requestHeaders: [{ name: 'Authorization', value: 'Bearer abc' }]
}), { force: true });
verifier('HTTP en clair avec Authorization signale',
  clairAvecJeton.findings.some(f => f.rule === 'transport' && f.severity === 'critical'));

const clairSansRien = analyze(enregistrementExemple({
  url: 'http://a.exemple.fr/logo.png', finalUrl: 'http://a.exemple.fr/logo.png', scheme: 'http',
  requestHeaders: [], requestBody: null
}), { force: true });
verifier('HTTP en clair sans rien a voler ne declenche pas d alerte critique',
  !clairSansRien.findings.some(f => f.rule === 'transport' && f.severity === 'critical'));

/* Une adresse locale n est pas interceptable sur le reseau. */
const local = analyze(enregistrementExemple({
  url: 'http://localhost:8080/api', finalUrl: 'http://localhost:8080/api',
  scheme: 'http', host: 'localhost',
  requestHeaders: [{ name: 'Authorization', value: 'Bearer abc' }]
}), { force: true });
verifier('localhost en HTTP n est pas signale',
  !local.findings.some(f => f.rule === 'transport'));

/* CORS : origine renvoyee en miroir AVEC credentials. */
const cors = analyze(enregistrementExemple({
  requestHeaders: [{ name: 'Origin', value: 'https://attaquant.fr' }],
  responseHeaders: [
    { name: 'Access-Control-Allow-Origin', value: 'https://attaquant.fr' },
    { name: 'Access-Control-Allow-Credentials', value: 'true' }
  ]
}), { force: true });
verifier('CORS en miroir avec credentials signale',
  cors.findings.some(f => f.rule === 'cors' && f.severity === 'critical'));

/* Cookie SameSite=None sans Secure : le navigateur le refusera. Les cookies
   sont analyses depuis la forme deja decoupee par la couche de capture. */
const cookie = analyze(enregistrementExemple({
  cookies: { set: [{ name: 'session', sameSite: 'None', secure: false, path: '/' }], changed: [] }
}), { force: true });
verifier('SameSite=None sans Secure signale',
  cookie.findings.some(f => f.title === 'SameSite=None sans Secure'));

const cookieSain = analyze(enregistrementExemple({
  cookies: { set: [{ name: 'session', sameSite: 'None', secure: true, path: '/' }], changed: [] }
}), { force: true });
verifier('SameSite=None avec Secure ne declenche rien',
  !cookieSain.findings.some(f => f.rule === 'cookie'));

/* Le prefixe __Host- impose Secure, Path=/ et aucun Domain. */
const prefixe = analyze(enregistrementExemple({
  cookies: { set: [{ name: '__Host-jeton', secure: false, path: '/x', domain: 'a.fr' }], changed: [] }
}), { force: true });
verifier('prefixe __Host- non respecte signale',
  prefixe.findings.some(f => f.title === 'Prefixe __Host- non respecte'));

verifier('les severites sont ordonnees', SEVERITY.critical > SEVERITY.high);
verifier('l analyseur tient ses compteurs', analyzerStats.findings > 0);

/* Analyse desactivee : plus rien ne sort, meme sur une requete fautive. */
await config.set({ analyzerEnabled: false });
egal('analyse desactivee : aucun resultat',
  analyze(enregistrementExemple({ url: 'https://a:b@c.fr/' }), { force: true }), null);
await config.set({ analyzerEnabled: true });

/* --------------------------------- HAR ------------------------------------ */
/* Le HAR doit rester lisible par un autre outil : structure 1.2 conforme. */
const har = buildHar([enregistrementExemple()]);
egal('version HAR', har.log.version, '1.2');
egal('une entree exportee', har.log.entries.length, 1);
const entree = har.log.entries[0];
egal('methode conservee', entree.request.method, 'POST');
egal('statut conserve', entree.response.status, 200);
verifier('entetes de requete exportees', entree.request.headers.length >= 4);
verifier('horodatage au format ISO', /^\d{4}-\d{2}-\d{2}T/.test(entree.startedDateTime));
verifier('adresse IP du serveur reportee', entree.serverIPAddress === '203.0.113.42');
verifier('minutage present', entree.timings && typeof entree.timings.wait === 'number');
egal('HAR vide reste valide', buildHar([]).log.entries.length, 0);

/* ------------------------------ Import curl ------------------------------- */
memeListe('decoupage en respectant les guillemets',
  decouper("curl 'https://a.fr/x' -H 'A: 1'"), ['curl', 'https://a.fr/x', '-H', 'A: 1']);

const c1 = analyserCurl("curl -X POST https://a.fr/x -H 'Content-Type: application/json' -d '{\"k\":1}'");
egal('methode lue', c1.method, 'POST');
egal('URL lue', c1.url, 'https://a.fr/x');
egal('corps lu', c1.body, '{"k":1}');
egal('entete lue', c1.headers[0].name, 'Content-Type');

/* Sans -X, un corps implique POST ; sans corps, GET. */
egal('corps sans -X implique POST', analyserCurl("curl https://a.fr/x -d 'k=v'").method, 'POST');
egal('sans corps ni -X, GET', analyserCurl('curl https://a.fr/x').method, 'GET');
egal('-I implique HEAD', analyserCurl('curl -I https://a.fr/x').method, 'HEAD');
/* -u produit un en-tete Authorization Basic calcule, pas devine. */
verifier('-u produit un Authorization Basic',
  analyserCurl('curl -u marie:secret https://a.fr/x')
    .headers.some(h => h.name === 'Authorization' && h.value === 'Basic ' + btoa('marie:secret')));
verifier('option sans effet ici signalee en avertissement',
  analyserCurl('curl --inconnue-xyz https://a.fr/x').warnings.length > 0);
verifier('une option courante et sans effet ne pollue pas les avertissements',
  analyserCurl('curl --compressed https://a.fr/x').warnings.length === 0);

/* --------------------------- Generation de code --------------------------- */
/* Chaque generateur annonce dans le menu doit exister et produire du texte :
   sans ce test, une entree de menu peut pointer dans le vide. */
const exemple = enregistrementExemple();
for (const nom of Object.keys(GENERATORS)) {
  const code = generate(nom, exemple);
  verifier('le generateur ' + nom + ' produit du texte',
    typeof code === 'string' && code.length > 0);
}
for (const nom of Object.keys(GENERATOR_FILES)) {
  verifier('le generateur de fichier ' + nom + ' a une fonction', !!GENERATORS[nom]);
}
verifier('curl contient la methode et l URL',
  /POST/.test(generate('curl', exemple)) && /api\.exemple\.fr/.test(generate('curl', exemple)));
verifier('fetch contient un appel fetch', /fetch\(/.test(generate('fetch', exemple)));
verifier('python contient un import', /import/.test(generate('python', exemple)));
leve('generateur inconnu refuse', () => generate('inexistant', exemple));

const lot = generateScript('curl', [exemple, exemple]);
verifier('un lot de deux requetes produit un script', lot && lot.content.length > 0);
verifier('le script porte une extension', lot && !!lot.extension);

/* ------------------------------ Configuration ----------------------------- */
verifier('les valeurs par defaut sont gelees', Object.isFrozen(DEFAULTS));
verifier('une valeur par defaut existe pour la capture', DEFAULTS.capturing === true);
await config.set({ capturing: false });
egal('valeur modifiee relue', config.get('capturing'), false);
await config.set({ capturing: true });

correlator.stop();
bilan('Noyau');
