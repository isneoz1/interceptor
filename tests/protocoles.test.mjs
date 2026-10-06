/* GraphQL, rapports du navigateur, OpenAPI — SWIFT (by NeoZ)
 *
 *   node tests/protocoles.test.mjs
 *
 * Ce que la 5.0 ajoute, verifie contre des references independantes du code
 * teste :
 *
 *   1. GraphQL : les operations d un document, l operation executee et
 *      l introspection, confrontees a graphql-core, le port Python de
 *      graphql-js (vecteurs-graphql.json) ; le hachage d une requete
 *      persistee contre l exemple publie par Apollo ; les quatre formes de
 *      transport, les lots, et les faits dits sur la reponse ;
 *   2. le noyau : l operation dans le resume d une ligne, les faits de
 *      l analyseur (mutation executee en GET, schema livre) ;
 *   3. les rapports du navigateur et leur collecte, avec les noms de champs
 *      des specifications du W3C et du WICG ;
 *   4. l inference de schemas JSON et la description OpenAPI ;
 *
 * et ce que la 5.1 ajoute :
 *
 *   5. JSON-RPC 2.0 sur HTTP, contre les echanges de la specification (§7)
 *      recopies tels quels ;
 *   6. SOAP 1.1 et 1.2, contre les exemples de la Note SOAP 1.1 et du Primer
 *      SOAP 1.2 ;
 *   7. les problemes HTTP, contre l exemple de la RFC 9457 ;
 *   8. les controles d un corps : type annonce contre contenu, et la
 *      compression mesuree, dont le gzip se decompresse avec node:zlib.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { installerTout, enregistrementExemple, egal, verifier, bilan } from './harnais.mjs';

installerTout();
const ici = path.dirname(url.fileURLToPath(import.meta.url));
const lire = nom => JSON.parse(fs.readFileSync(path.join(ici, nom), 'utf8'));

const { config } = await import('../background/core/config.js');
await config.ready;
const gql = await import('../ui/lib/graphql-http.js');
const { analyze } = await import('../background/core/analyzer.js');
const { summarize } = await import('../background/core/store.js');

/* ========================== 1. GraphQL : le document ====================== */
const VGQL = lire('vecteurs-graphql.json');
verifier('GraphQL : vecteurs produits par graphql-core', /^graphql-core /.test(VGQL.genere_par), VGQL.genere_par);
verifier('GraphQL : au moins vingt documents de reference', VGQL.vecteurs.length >= 20, VGQL.vecteurs.length);
let ecartsOps = 0;
let ecartsChoix = 0;
let ecartsIntro = 0;
for (const v of VGQL.vecteurs) {
  const ops = gql.operationsGraphql(v.source);
  if (JSON.stringify(ops) !== JSON.stringify(v.operations)) ecartsOps++;
  if (JSON.stringify(gql.choisirOperation(ops, v.operationName).operation) !== JSON.stringify(v.choisie)) ecartsChoix++;
  if (gql.introspectionGraphql(v.source) !== v.introspection) ecartsIntro++;
}
egal('GraphQL : operations identiques a graphql-core', ecartsOps, 0);
egal('GraphQL : operation executee identique a get_operation_ast', ecartsChoix, 0);
egal('GraphQL : introspection identique au parcours de graphql-core', ecartsIntro, 0);

/* Ce qui n est pas du GraphQL ne doit rien devenir. */
egal('GraphQL : un objet JSON n est pas une requete anonyme', gql.operationsGraphql('{"match": {"a": 1}}').length, 0);
egal('GraphQL : un mot seul n est pas une operation', gql.operationsGraphql('chaussures').length, 0);
egal('GraphQL : une recherche ?query=mot n est pas du GraphQL',
  gql.lireRequeteGraphql({ url: 'https://boutique.test/recherche?query=chaussures' }), null);
egal('GraphQL : ?query= portant du JSON non plus',
  gql.lireRequeteGraphql({ url: 'https://api.test/s?query=' + encodeURIComponent('{"a":1}') }), null);
egal('GraphQL : un corps JSON ordinaire non plus',
  gql.lireRequeteGraphql({ methode: 'POST', url: 'https://api.test/x', corps: { text: '{"operation":"solde"}' } }), null);
egal('GraphQL : une recherche JSON {"query":"mot"} n est pas du GraphQL',
  gql.lireRequeteGraphql({ methode: 'POST', url: 'https://api.test/s', corps: { text: '{"query":"chaussures"}' } }), null);
egal('GraphQL : une requete Elasticsearch {"query":{...}} non plus',
  gql.lireRequeteGraphql({ methode: 'POST', url: 'https://api.test/_search', corps: { text: '{"query":{"match":{"a":"b"}}}' } }), null);
const tardive = gql.lireRequeteGraphql({ methode: 'POST', url: 'https://api.test/g',
  corps: { text: JSON.stringify({ variables: { blob: 'x'.repeat(200000) }, query: 'query Tardive { a }' }) } });
egal('GraphQL : la cle query lue meme apres de longues variables', tardive && tardive.requetes[0].operation.nom, 'Tardive');
egal('GraphQL : un lot dont un element n est pas une requete est refuse',
  gql.lireRequeteGraphql({ methode: 'POST', url: 'https://api.test/g', corps: { text: '[{"query":"{ a }"},{"x":1}]' } }), null);

/* ========================= 2. GraphQL : la requete ======================== */
const DOC_GET = 'query GetUser($id: ID!) { user(id: $id) { name } }';
const enGet = gql.lireRequeteGraphql({
  methode: 'GET',
  url: 'https://api.test/graphql?query=' + encodeURIComponent(DOC_GET)
    + '&operationName=GetUser&variables=' + encodeURIComponent('{"id":"42"}')
});
egal('GET : forme lue dans l URL', enGet && enGet.forme, 'url');
egal('GET : operation executee', JSON.stringify(enGet.requetes[0].operation), '{"type":"query","nom":"GetUser"}');
egal('GET : variables decodees depuis leur chaine JSON (§4.3)', enGet.requetes[0].variables.id, '42');
egal('GET : resume pour le tableau', gql.texteGraphql(gql.resumeGraphql(enGet)), 'query GetUser');

const variablesCassees = gql.lireRequeteGraphql({
  methode: 'GET', url: 'https://api.test/graphql?query=' + encodeURIComponent('{ a }') + '&variables=%7Bpas-du-json'
});
egal('GET : des variables qui ne sont pas du JSON sont signalees', variablesCassees.requetes[0].illisibles.join(), 'variables');
verifier('GET : le fait correspondant est dit',
  gql.faitsGraphql(variablesCassees, null).some(f => f.cle === 'illisible' && f.valeurs.nom === 'variables'));

const enPost = gql.lireRequeteGraphql({
  methode: 'POST', url: 'https://api.test/graphql',
  corps: { text: JSON.stringify({ query: 'mutation Save($v: Int) { save(v: $v) }', variables: { v: 3 } }), contentType: 'application/json' }
});
egal('POST JSON : forme', enPost.forme, 'json');
egal('POST JSON : mutation nommee', gql.texteGraphql(gql.resumeGraphql(enPost)), 'mutation Save');

const lot = gql.lireRequeteGraphql({
  methode: 'POST', url: 'https://api.test/graphql',
  corps: { text: '[{"query":"query A { a }"},{"query":"mutation B { b }","operationName":"B"}]' }
});
egal('lot : forme', lot.forme, 'lot');
egal('lot : chaque operation lue', gql.texteGraphql(gql.resumeGraphql(lot)), 'query A, mutation B');
verifier('lot : le fait dit qu il sort de la specification',
  gql.faitsGraphql(lot, null).some(f => f.cle === 'lot' && f.valeurs.n === 2));

const brut = gql.lireRequeteGraphql({
  methode: 'POST', url: 'https://api.test/graphql',
  corps: { text: 'query Brut { a }', contentType: 'application/graphql; charset=utf-8' }
});
egal('document brut : forme', brut.forme, 'document');
egal('document brut : operation', brut.requetes[0].operation.nom, 'Brut');

const envoi = gql.lireRequeteGraphql({
  methode: 'POST', url: 'https://api.test/graphql',
  corps: {
    kind: 'formData',
    formData: {
      operations: ['{"query":"mutation ($file: Upload!) { upload(file: $file) { id } }","variables":{"file":null}}'],
      map: ['{"0":["variables.file"]}']
    }
  }
});
egal('envoi de fichier multipart : forme', envoi.forme, 'multipart');
egal('envoi de fichier multipart : mutation anonyme', JSON.stringify(envoi.requetes[0].operation), '{"type":"mutation","nom":null}');

const ambigu = gql.lireRequeteGraphql({
  methode: 'POST', url: 'https://api.test/graphql', corps: { text: '{"query":"query A { a } query B { b }"}' }
});
verifier('deux operations sans operationName : le fait le dit (GraphQL §6.1)',
  gql.faitsGraphql(ambigu, null).some(f => f.cle === 'ambigu' && f.valeurs.n === 2));
const introuvable = gql.lireRequeteGraphql({
  methode: 'POST', url: 'https://api.test/graphql', corps: { text: '{"query":"query A { a }","operationName":"Z"}' }
});
verifier('operationName inconnu : le fait le dit',
  gql.faitsGraphql(introuvable, null).some(f => f.cle === 'introuvable' && f.valeurs.nom === 'Z'));

/* Requete persistee : l exemple de la documentation Apollo, dont le hachage
   est celui de « {__typename} ». */
const HACHAGE_APOLLO = 'ecf4edb46db40b5132295c0291d62fb65d6759a9eedfa4d5d612dd5ec54a6b38';
const persistee = gql.lireRequeteGraphql({
  methode: 'GET',
  url: 'https://api.test/graphql?extensions=' + encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: HACHAGE_APOLLO } }))
});
egal('requete persistee seule : lue', persistee && persistee.requetes[0].persistee.hash, HACHAGE_APOLLO);
egal('requete persistee seule : pas d operation lisible', gql.texteGraphql(gql.resumeGraphql(persistee), 'persistee'), 'persistee');
verifier('requete persistee seule : le fait le dit',
  gql.faitsGraphql(persistee, null).some(f => f.cle === 'persisteeSeule'));
const verifiee = await gql.verifierPersistee('{__typename}', HACHAGE_APOLLO);
verifier('requete persistee : le hachage de l exemple Apollo est retrouve', verifiee.egal, verifiee.calcule);
const fausse = await gql.verifierPersistee('{ __typename }', HACHAGE_APOLLO);
verifier('requete persistee : un espace de plus change le hachage', !fausse.egal);
const malFormee = gql.lireRequeteGraphql({
  methode: 'POST', url: 'https://api.test/graphql',
  corps: { text: '{"query":"{ a }","extensions":{"persistedQuery":{"version":1,"sha256Hash":"abc"}}}' }
});
egal('requete persistee : un hachage qui n a pas 64 chiffres hexadecimaux est signale',
  malFormee.requetes[0].persistee.formeValide, false);

/* Mutation en GET : interdite par GraphQL over HTTP §4.3. */
const mutationGet = gql.lireRequeteGraphql({
  methode: 'GET', url: 'https://api.test/graphql?query=' + encodeURIComponent('mutation Like { like(id: 1) }')
});
const clesExecutee = gql.faitsGraphql(mutationGet, null, { statut: 200 }).map(f => f.cle);
verifier('mutation en GET : le fait de la specification est dit', clesExecutee.includes('getMutation'));
verifier('mutation en GET executee en 200 : dit', clesExecutee.includes('getMutationExecutee'));
const clesRefusee = gql.faitsGraphql(mutationGet, null, { statut: 405 }).map(f => f.cle);
verifier('mutation en GET refusee en 405 : dit conforme', clesRefusee.includes('getMutationRefusee')
  && !clesRefusee.includes('getMutationExecutee'));

/* ========================= 3. GraphQL : la reponse ======================== */
const nature = texte => {
  const r = gql.lireReponseGraphql(texte);
  return r ? r.resultats.map(x => x.nature).join(',') : null;
};
egal('reponse : complete', nature('{"data":{"a":1}}'), 'complete');
egal('reponse : partielle (GraphQL §7.1)', nature('{"data":{"a":null},"errors":[{"message":"x","path":["a"]}]}'), 'partielle');
egal('reponse : erreur d execution, data null', nature('{"data":null,"errors":[{"message":"x"}]}'), 'erreurExecution');
egal('reponse : erreur de requete, sans data', nature('{"errors":[{"message":"Syntax Error"}]}'), 'erreurRequete');
egal('reponse : un objet sans data ni errors n en est pas une', nature('{"foo":1}'), null);
egal('reponse : un tableau vide n en est pas une', nature('[]'), null);
egal('reponse : du texte n en est pas une', nature('pas du JSON'), null);
egal('reponse : un lot se lit resultat par resultat', nature('[{"data":{}},{"errors":[{"message":"e"}]}]'), 'complete,erreurRequete');

const detaillee = gql.lireReponseGraphql(JSON.stringify({
  data: { user: null },
  errors: [{ message: 'introuvable', path: ['user', 0, 'name'], locations: [{ line: 2, column: 5 }], extensions: { code: 'NOT_FOUND' } }]
}));
const e0 = detaillee.resultats[0].erreurs[0];
egal('erreur : chemin', e0.chemin, 'user.0.name');
egal('erreur : ligne et colonne', e0.lieux, '2:5');
egal('erreur : code d extension', e0.code, 'NOT_FOUND');

const schema = gql.lireReponseGraphql(JSON.stringify({
  data: { __schema: {
    queryType: { name: 'Query' }, mutationType: { name: 'Mutation' }, subscriptionType: null,
    types: [{ name: 'Query' }, { name: 'Mutation' }, { name: 'User' }, { name: '__Schema' }, { name: '__Type' }],
    directives: [{ name: 'include' }, { name: 'skip' }]
  } }
}));
const s0 = schema.resultats[0].schema;
egal('introspection : types comptes', s0.types, 5);
egal('introspection : types propres a l API', s0.propres, 3);
egal('introspection : racines', [s0.requete, s0.mutation, s0.abonnement].join(','), 'Query,Mutation,');
egal('introspection : directives', s0.directives, 2);

const requeteSimple = gql.lireRequeteGraphql({ methode: 'POST', url: 'https://api.test/graphql', corps: { text: '{"query":"{ a }"}' } });
const cles = (texte, statut, typeMedia) =>
  gql.faitsGraphql(requeteSimple, gql.lireReponseGraphql(texte), { statut, typeMedia }).map(f => f.cle);
verifier('statut 200 avec erreurs : le verdict est dans le corps',
  cles('{"data":{"a":null},"errors":[{"message":"x"}]}', 200, 'application/json').includes('statut200Erreurs'));
verifier('application/json : dit comme le type des anciens clients',
  cles('{"data":{"a":1}}', 200, 'application/json; charset=utf-8').includes('typeMediaAncien'));
verifier('application/graphql-response+json : dit comme le type de la specification',
  cles('{"data":{"a":1}}', 200, 'application/graphql-response+json').includes('typeMediaNouveau'));
verifier('graphql-response+json sans data en 200 : la specification demande 4xx ou 5xx',
  cles('{"errors":[{"message":"x"}]}', 200, 'application/graphql-response+json').includes('sansDataEn2xx'));
verifier('graphql-response+json sans data en 400 : rien a redire',
  !cles('{"errors":[{"message":"x"}]}', 400, 'application/graphql-response+json').includes('sansDataEn2xx'));
verifier('graphql-response+json avec data en 500 : la specification demande 2xx',
  cles('{"data":{"a":1}}', 500, 'application/graphql-response+json').includes('dataEnErreur'));
verifier('application/json avec data en 500 : la regle ne s applique pas',
  !cles('{"data":{"a":1}}', 500, 'application/json').includes('dataEnErreur'));
verifier('PERSISTED_QUERY_NOT_FOUND : dit',
  cles('{"errors":[{"message":"PersistedQueryNotFound","extensions":{"code":"PERSISTED_QUERY_NOT_FOUND"}}]}', 200, 'application/json')
    .includes('persisteeInconnue'));

/* ============================ 4. GraphQL : noyau ========================== */
const ligne = enregistrementExemple({
  url: 'https://api.test/graphql', finalUrl: 'https://api.test/graphql', method: 'POST',
  requestBody: { kind: 'raw', text: '{"query":"query Moi { me { id } }"}', size: 36, contentType: 'application/json' }
});
const resume = summarize(ligne);
egal('noyau : l operation figure dans le resume de la ligne', gql.texteGraphql(resume.gql), 'query Moi');
egal('noyau : une ligne ordinaire n a pas d operation', summarize(enregistrementExemple({})).gql, null);
ligne.requestBody = { kind: 'raw', text: '{"query":"mutation Autre { x }"}', size: 31 };
egal('noyau : un corps remplace est relu', gql.texteGraphql(summarize(ligne).gql), 'mutation Autre');

/* Le tableau : l operation a cote du chemin, sauf si sa colonne est affichee. */
const { COLUMNS } = await import('../ui/lib/columns.js');
const texteNoeud = n => (n.nodeName === '#text' ? n.textContent : (n.children || []).map(texteNoeud).join('') || n.textContent || '');
const ligneGql = { path: '/graphql', gql: { lot: false, ops: [{ type: 'query', nom: 'Moi' }], persistee: false } };
verifier('tableau : l operation suit le chemin', /\/graphql\s+query Moi/.test(texteNoeud(COLUMNS.path.cell(ligneGql, { gqlDansChemin: true }))));
verifier('tableau : pas deux fois quand la colonne GraphQL est affichee',
  !/query Moi/.test(texteNoeud(COLUMNS.path.cell(ligneGql, { gqlDansChemin: false }))));
egal('tableau : la colonne GraphQL dit l operation', texteNoeud(COLUMNS.graphql.cell(ligneGql)), 'query Moi');

const analyseGet = analyze(enregistrementExemple({
  method: 'GET', statusCode: 200, requestBody: null,
  url: 'https://api.test/graphql?query=' + encodeURIComponent('mutation { like(id: 1) }'),
  finalUrl: 'https://api.test/graphql?query=' + encodeURIComponent('mutation { like(id: 1) }'),
  responseBody: { kind: 'text', text: '{"data":{"like":true}}', size: 22 }
}), { force: true });
verifier('analyseur : marqueur graphql', analyseGet.tags.includes('graphql'));
verifier('analyseur : mutation executee en GET, un fait et pas une alerte',
  analyseGet.faits.some(f => f.type === 'graphql' && f.valeurs.statut === 200)
  && !analyseGet.findings.some(f => /graphql/i.test(f.title)));

const analyseIntro = analyze(enregistrementExemple({
  url: 'https://api.test/graphql', finalUrl: 'https://api.test/graphql', method: 'POST',
  requestBody: { kind: 'raw', text: JSON.stringify({ query: 'query IntrospectionQuery { __schema { types { name } } }' }), size: 60 },
  responseBody: { kind: 'text', text: JSON.stringify({ data: { __schema: { types: [{ name: 'Query' }, { name: 'User' }] } } }), size: 70 }
}), { force: true });
verifier('analyseur : schema livre par introspection, dit avec son nombre de types',
  analyseIntro.faits.some(f => f.type === 'graphql' && f.valeurs.n === 2));
verifier('analyseur : marqueur introspection', analyseIntro.tags.includes('graphql-introspection'));

/* ===================== 5. Rapports du navigateur ========================= */
/* Les noms de champs sont ceux des specifications : CSPViolationReportBody
   (CSP 3), la forme depreciee de report-uri (CSP 3 §5.3), le corps NEL, et les
   rapports deprecation et intervention du WICG. */
const rap = await import('../ui/lib/rapports.js');

const cspApi = rap.lireRapports(JSON.stringify([{
  age: 120000, type: 'csp-violation', url: 'https://boutique.test/panier', user_agent: 'Mozilla/5.0',
  body: { documentURL: 'https://boutique.test/panier', blockedURL: 'https://pistage.test/p.js',
    effectiveDirective: 'script-src-elem', disposition: 'enforce', originalPolicy: "script-src 'self'",
    sourceFile: 'https://boutique.test/app.js', lineNumber: 12, columnNumber: 7, statusCode: 200, sample: '' }
}]), 'application/reports+json');
egal('Reporting API : forme', cspApi.forme, 'reporting');
egal('Reporting API : type lu', cspApi.rapports[0].type, 'csp-violation');
egal('CSP : la directive enfreinte passe en premier', cspApi.rapports[0].lignes[0].join(' = '), 'Directive enfreinte = script-src-elem');
verifier('CSP : un champ vide n est pas montre', !cspApi.rapports[0].lignes.some(([l]) => l === 'Extrait'));
const clesCsp = cspApi.rapports[0].faits.map(f => f.cle);
verifier('CSP en mode applique : « a bloque » est dit', clesCsp.includes('cspBloque'));
verifier('age de 120 s : dit en secondes', cspApi.rapports[0].faits.some(f => f.cle === 'vieux' && f.valeurs.s === 120));
egal('navigateur emetteur', cspApi.rapports[0].agent, 'Mozilla/5.0');

const rapportSeul = rap.lireRapports(JSON.stringify([{ age: 0, type: 'csp-violation', url: 'https://a.test/',
  body: { blockedURL: 'inline', effectiveDirective: 'script-src-elem', disposition: 'report' } }]));
verifier('CSP en Report-Only : « non bloque » est dit, pas « a bloque »',
  rapportSeul.rapports[0].faits.some(f => f.cle === 'cspRapportSeul') && !rapportSeul.rapports[0].faits.some(f => f.cle === 'cspBloque'));

const ancien = rap.lireRapports(JSON.stringify({ 'csp-report': {
  'document-uri': 'https://a.test/', 'blocked-uri': 'https://b.test/x.js', 'violated-directive': 'script-src',
  'effective-directive': 'script-src-elem', 'original-policy': "script-src 'self'", disposition: 'enforce',
  'line-number': 3, 'source-file': 'https://a.test/', 'status-code': 200
} }), 'application/csp-report');
egal('report-uri : forme depreciee reconnue', ancien.forme, 'csp-report');
egal('report-uri : cles a tirets ramenees aux noms actuels', ancien.rapports[0].lignes[0].join(' = '), 'Directive enfreinte = script-src-elem');
verifier('report-uri : la directive declaree est gardee', ancien.rapports[0].lignes.some(([l, v]) => l === 'Directive declaree' && v === 'script-src'));
verifier('report-uri : la depreciation est dite', ancien.rapports[0].faits[0].cle === 'cspDeprecie');

const nel = rap.lireRapports(JSON.stringify([{ age: 5, type: 'network-error', url: 'https://a.test/',
  body: { sampling_fraction: 1, elapsed_time: 30012, phase: 'connection', type: 'tcp.timed_out', server_ip: '203.0.113.7', protocol: 'h2' } }]));
const faitNel = nel.rapports[0].faits.find(f => f.cle === 'nelEchec');
egal('NEL : le type d erreur et sa phase', faitNel && faitNel.valeurs.type + '/' + faitNel.valeurs.phase, 'tcp.timed_out/connection');
egal('NEL : le sens vient de la table de la specification', faitNel.valeurs.sens, rap.TYPES_NEL['tcp.timed_out'][1]);
verifier('NEL : le sens est marque a traduire', faitNel.aTraduire.includes('sens'));
egal('NEL : la table couvre les trente types predefinis', Object.keys(rap.TYPES_NEL).length, 30);
verifier('NEL : chaque type est rattache a une phase de la specification',
  Object.values(rap.TYPES_NEL).every(([phase]) => ['dns', 'connection', 'application'].includes(phase)));
const nelOk = rap.lireRapports(JSON.stringify([{ age: 0, type: 'network-error', url: 'https://a.test/',
  body: { sampling_fraction: 0.01, elapsed_time: 50, phase: 'application', type: 'ok', status_code: 200 } }]));
verifier('NEL : un succes echantillonne est dit comme tel', nelOk.rapports[0].faits.some(f => f.cle === 'nelSucces'));

const depreciation = rap.lireRapports(JSON.stringify([{ age: 0, type: 'deprecation', url: 'https://a.test/',
  body: { id: 'websql', anticipatedRemoval: '2020-01-01', message: 'WebSQL is deprecated', sourceFile: 'https://a.test/a.js', lineNumber: 1, columnNumber: 2 } }]));
egal('deprecation : identifiant en tete', depreciation.rapports[0].lignes[0].join(' = '), 'Identifiant = websql');
const inconnu = rap.lireRapports(JSON.stringify([{ age: 0, type: 'coep', url: 'https://a.test/',
  body: { type: 'corp', blockedURL: 'https://b.test/i.png', destination: 'image', disposition: 'enforce' } }]));
egal('type sans table : les champs sont montres tels quels, rien n est devine',
  inconnu.rapports[0].lignes.map(([l]) => l).join(','), 'type,blockedURL,destination,disposition');
egal('rapports : un tableau ordinaire n en est pas un', rap.lireRapports('[{"a":1}]'), null);
egal('rapports : un objet ordinaire n en est pas un', rap.lireRapports('{"a":1}'), null);
egal('rapports : du texte n en est pas un', rap.lireRapports('bonjour'), null);

/* La collecte : Reporting-Endpoints (Reporting API §3.3), Report-To, NEL. */
const h = (name, value) => ({ name, value });
const collecte = rap.lireCollecte([
  h('Reporting-Endpoints', 'default="https://rapports.test/csp", relatif="/r", clair="http://rapports.test/x", nombre=5'),
  h('NEL', '{"report_to":"reseau","max_age":86400,"success_fraction":0.05,"include_subdomains":true}'),
  h('Report-To', '{"group":"reseau","max_age":86400,"endpoints":[{"url":"https://rapports.test/nel"}]}')
], 'https://boutique.test/page');
egal('Reporting-Endpoints : les points retenus', collecte.points.map(p => p.nom + '=' + p.url).join(' '),
  'default=https://rapports.test/csp relatif=https://boutique.test/r clair=http://rapports.test/x');
verifier('Reporting-Endpoints : une adresse relative se resout sur l URL de la reponse', collecte.points[1].sure);
verifier('Reporting-Endpoints : une origine http est dite ignoree',
  collecte.faits.some(f => f.cle === 'endpointNonSur' && f.valeurs.nom === 'clair'));
verifier('Reporting-Endpoints : une valeur qui n est pas une chaine est dite ignoree',
  collecte.faits.some(f => f.cle === 'endpointNonChaine' && f.valeurs.nom === 'nombre'));
egal('Report-To : groupe et adresse', collecte.groupes.map(g => g.groupe + ' ' + g.urls.join()).join(), 'reseau https://rapports.test/nel');
verifier('Report-To : dit remplace par Reporting-Endpoints', collecte.faits.some(f => f.cle === 'reportToAncien'));
egal('NEL : fractions, la valeur par defaut de failure_fraction est 1',
  collecte.nel.succes + '/' + collecte.nel.echecs, '0.05/1');
verifier('NEL : pourcentages dits', collecte.faits.some(f => f.cle === 'nelEchantillons' && f.valeurs.s === '5' && f.valeurs.e === '100'));
verifier('NEL : sous-domaines dits', collecte.faits.some(f => f.cle === 'nelSousDomaines'));
const suppression = rap.lireCollecte([h('NEL', '{"report_to":"reseau","max_age":0}')], 'https://a.test/');
verifier('NEL max_age 0 : la suppression de la politique est dite', suppression.faits.some(f => f.cle === 'nelSuppression'));
const enClair = rap.lireCollecte([h('Reporting-Endpoints', 'default="https://r.test/"')], 'http://a.test/');
verifier('reponse en http : le navigateur ignore la collecte (Reporting API §3.3, NEL)',
  enClair.faits.some(f => f.cle === 'reponseNonSure'));
egal('collecte : rien sans les trois en-tetes', rap.lireCollecte([h('Content-Type', 'text/html')], 'https://a.test/'), null);
verifier('origine sure : bouclage local accepte', rap.origineSure('http://localhost:8080/r') && rap.origineSure('http://127.0.0.1/r'));

const analyseRapport = analyze(enregistrementExemple({
  requestHeaders: [{ name: 'Content-Type', value: 'application/reports+json' }],
  requestBody: { kind: 'raw', text: '[]', size: 2 }
}), { force: true });
verifier('analyseur : un rapport du navigateur porte son marqueur', analyseRapport.tags.includes('rapport-navigateur'));

/* ===================== 6. Schema JSON deduit d exemples ================== */
/* Verifie une fois contre jsonschema (Draft 2020-12, formats controles) et
   openapi-spec-validator : tools/verifier-openapi.mjs les prepare. Ici, les
   regles elles-memes. */
const sj = await import('../ui/lib/schema-json.js');
egal('format : date valide', sj.formatDe('2024-02-29'), 'date');
egal('format : 29 fevrier d une annee non bissextile refuse', sj.formatDe('2023-02-29'), null);
egal('format : date-time RFC 3339', sj.formatDe('1985-04-12T23:20:50.52Z'), 'date-time');
egal('format : mois 13 refuse', sj.formatDe('2025-13-01T00:00:00Z'), null);
egal('format : seconde intercalaire jamais annoncee', sj.formatDe('1998-12-31T23:59:60Z'), null);
egal('format : uuid', sj.formatDe('0b8c4a3e-2f1d-4c6b-9e7a-1d2c3b4a5f60'), 'uuid');
egal('format : uri http', sj.formatDe('https://a.test/x?y=1#z'), 'uri');
egal('format : une espace n est pas permise dans une URI', sj.formatDe('https://a.test/a b'), null);
egal('format : texte ordinaire', sj.formatDe('bonjour'), null);

const ecrit = v => JSON.stringify(sj.schemaDeValeurs(v));
egal('schema : entier et decimal donnent number', ecrit([1, 2.5]), '{"type":"number"}');
egal('schema : union avec null', ecrit(['a', null]), '{"type":["null","string"]}');
egal('schema : requis = present dans tous les exemples',
  ecrit([{ a: 1, b: 'x' }, { a: 2 }]), '{"type":"object","properties":{"a":{"type":"integer"},"b":{"type":"string"}},"required":["a"]}');
egal('schema : tableau vide, aucun element contraint', ecrit([[]]), '{"type":"array"}');
egal('schema : elements fusionnes', ecrit([[1, 'x']]), '{"type":"array","items":{"type":["integer","string"]}}');
egal('schema : format garde seulement s il vaut pour toutes les chaines', ecrit(['2024-01-01', 'hier']), '{"type":"string"}');
const proto = sj.schemaDeValeurs([JSON.parse('{"__proto__":{"x":1}}')]);
verifier('schema : une cle « __proto__ » reste une propriete', Object.prototype.hasOwnProperty.call(proto.properties, '__proto__')
  && Object.getPrototypeOf(proto.properties) === Object.prototype);
const geant = Array.from({ length: 300000 }, (_, i) => (i === 299999 ? 'fin' : i));
egal('schema : au-dela du budget de lecture, aucune contrainte plutot qu une fausse', ecrit([geant]), '{}');
const sortieOutil = JSON.parse(sj.jsonVersSchema('{"a":1}\n{"a":"x","b":true}'));
egal('boite a outils : JSON Lines, plusieurs exemples, dialecte 2020-12',
  sortieOutil.$schema + ' ' + JSON.stringify(sortieOutil.properties.a.type) + ' ' + JSON.stringify(sortieOutil.required),
  'https://json-schema.org/draft/2020-12/schema ["integer","string"] ["a"]');
let refus = null;
try { sj.jsonVersSchema('{pas du json'); } catch (e) { refus = e.message; }
verifier('boite a outils : un JSON invalide est refuse avec sa raison', /^JSON invalide : /.test(refus || ''), refus);
const { TRANSFORMATIONS, transformer } = await import('../ui/lib/catalogue.js');
verifier('boite a outils : la transformation est au catalogue', TRANSFORMATIONS.some(x => x.cle === 'json-schema' && !x.decode));
egal('boite a outils : elle passe par transformer()', JSON.parse(transformer('json-schema', '[1,2]').valeur).items.type, 'integer');

/* ========================= 7. Description OpenAPI ========================= */
const oa = await import('../background/export/openapi.js');
egal('chemin : identifiants entiers nommes d apres le segment qui precede',
  oa.gabaritDuChemin('/v2/users/42/orders/7').gabarit, '/v2/users/{usersId}/orders/{ordersId}');
egal('chemin : premier segment sans nom', oa.gabaritDuChemin('/42').gabarit, '/{paramId}');
egal('chemin : noms rendus uniques', oa.gabaritDuChemin('/a/1/a/2').gabarit, '/a/{aId}/a/{aId2}');
egal('chemin : seize chiffres hexadecimaux font un identifiant', oa.gabaritDuChemin('/files/6f1c0e2d9a8b7c6d').gabarit, '/files/{filesId}');
egal('chemin : un mot reste un mot', oa.gabaritDuChemin('/v2/abc/latest').gabarit, '/v2/abc/latest');

const appel = (patch) => enregistrementExemple({ finalUrl: patch.url, requestHeaders: [], ...patch });
const appels = [
  appel({ id: 1, url: 'https://api.test/v1/items/5?fields=a', method: 'GET', requestBody: null, statusCode: 200,
    requestHeaders: [{ name: 'Authorization', value: 'Bearer x' }], mime: 'application/json',
    responseBody: { kind: 'text', text: '{"id":5}', size: 8 } }),
  appel({ id: 2, url: 'https://api.test/v1/items/6', method: 'GET', requestBody: null, statusCode: 200, mime: 'application/json',
    responseBody: { kind: 'text', text: '{"id":6,"extra":null}', size: 20 } }),
  appel({ id: 3, url: 'https://api.test/v1/items/6', method: 'OPTIONS', requestBody: null, statusCode: 204,
    requestHeaders: [{ name: 'Access-Control-Request-Method', value: 'DELETE' }], mime: '', responseBody: null }),
  appel({ id: 4, url: 'https://api.test/logo.png', method: 'GET', type: 'image', requestBody: null, statusCode: 200, mime: 'image/png', responseBody: null }),
  appel({ id: 5, url: 'https://api.test/v1/big', method: 'GET', requestBody: null, statusCode: 200, mime: 'application/json',
    responseBody: { kind: 'text', text: '{"a":', size: 9999999, truncated: true } }),
  appel({ id: 6, url: 'https://api.test/v1/slow', method: 'POST', requestBody: null, statusCode: null, mime: '', responseBody: null }),
  appel({ id: 7, url: 'https://ailleurs.test/x', method: 'GET', requestBody: null, statusCode: 200, mime: '', responseBody: null })
];
const decrit = oa.buildOpenApi(appels, { maintenant: new Date(Date.UTC(2026, 9, 6)) });
const doc = decrit.document;
egal('OpenAPI : version 3.1.0', doc.openapi, '3.1.0');
egal('OpenAPI : l origine la plus representee est decrite', doc.servers[0].url, 'https://api.test');
egal('OpenAPI : les appels vers une autre origine sont comptes et dits', decrit.ecartees, 1);
verifier('OpenAPI : la description dit ce qu elle laisse de cote', /1 call\(s\) to other origins were left out/.test(doc.info.description));
egal('OpenAPI : chemins decrits (ni image, ni preflight)', Object.keys(doc.paths).join(' '), '/v1/big /v1/items/{itemsId} /v1/slow');
const lecture = doc.paths['/v1/items/{itemsId}'].get;
egal('OpenAPI : deux appels, une operation', lecture['x-swift-observations'], 2);
egal('OpenAPI : parametre de chemin entier', JSON.stringify(lecture.parameters[0]),
  '{"name":"itemsId","in":"path","required":true,"schema":{"type":"integer"}}');
verifier('OpenAPI : un parametre d URL n est jamais dit obligatoire', lecture.parameters[1].in === 'query' && !('required' in lecture.parameters[1]));
egal('OpenAPI : schema de la reponse deduit des deux corps',
  JSON.stringify(lecture.responses['200'].content['application/json'].schema),
  '{"type":"object","properties":{"id":{"type":"integer"},"extra":{"type":"null"}},"required":["id"]}');
egal('OpenAPI : description du statut prise dans la table IANA', lecture.responses['200'].description, 'OK');
egal('OpenAPI : un seul appel portait un jeton, l operation le dit', JSON.stringify(lecture.security), '[{"bearerAuth":[]}]');
egal('OpenAPI : scheme Bearer declare', JSON.stringify(doc.components.securitySchemes), '{"bearerAuth":{"type":"http","scheme":"bearer"}}');
egal('OpenAPI : corps tronque, type annonce sans schema', JSON.stringify(doc.paths['/v1/big'].get.responses['200'].content), '{"application/json":{}}');
egal('OpenAPI : sans reponse observee, il le dit', doc.paths['/v1/slow'].post.responses.default.description, 'No response observed');
verifier('OpenAPI : aucune valeur capturee recopiee', !JSON.stringify(doc).includes('Bearer x') && !JSON.stringify(doc).includes('"id":5'));
egal('OpenAPI : rien sans appel d API', oa.buildOpenApi([appels[3]]).document, null);

/* ===================== 8. JSON-RPC 2.0 sur HTTP ========================== */
/* Les echanges de la specification (jsonrpc.org, §7), recopies tels quels. */
const rpc = await import('../ui/lib/rpc-http.js');
const appelPos = rpc.lireAppelJsonRpc('{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}');
egal('JSON-RPC §7 : appel a parametres positionnels', appelPos.appels[0].methode + ' ' + JSON.stringify(appelPos.appels[0].params) + ' #' + appelPos.appels[0].id, 'subtract [42,23] #1');
const repPos = rpc.lireReponseJsonRpc('{"jsonrpc": "2.0", "result": 19, "id": 1}');
egal('JSON-RPC §7 : resultat', repPos.reponses[0].resultat, 19);
egal('JSON-RPC §7 : un echange conforme ne dit rien', rpc.faitsJsonRpc(appelPos, repPos, { statut: 200 }).length, 0);
verifier('JSON-RPC §7 : une notification n a pas d id',
  rpc.lireAppelJsonRpc('{"jsonrpc": "2.0", "method": "update", "params": [1,2,3,4,5]}').appels[0].notification);
const inconnue = rpc.lireReponseJsonRpc('{"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": "1"}');
egal('JSON-RPC §7 : methode inexistante, sens du code', inconnue.reponses[0].erreur.sens, 'Method not found');
egal('JSON-RPC §7 : un JSON illisible n est pas un appel', rpc.lireAppelJsonRpc('{"jsonrpc": "2.0", "method": "foobar, "params": "bar", "baz]'), null);
egal('JSON-RPC §7 : sa reponse se lit', rpc.lireReponseJsonRpc('{"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": null}').reponses[0].erreur.sens, 'Parse error');
const lotSpec = rpc.lireAppelJsonRpc(`[
        {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},
        {"jsonrpc": "2.0", "method": "notify_hello", "params": [7]},
        {"jsonrpc": "2.0", "method": "subtract", "params": [42,23], "id": "2"},
        {"foo": "boo"},
        {"jsonrpc": "2.0", "method": "foo.get", "params": {"name": "myself"}, "id": "5"},
        {"jsonrpc": "2.0", "method": "get_data", "id": "9"}
    ]`);
const lotReponse = rpc.lireReponseJsonRpc(`[
        {"jsonrpc": "2.0", "result": 7, "id": "1"},
        {"jsonrpc": "2.0", "result": 19, "id": "2"},
        {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null},
        {"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": "5"},
        {"jsonrpc": "2.0", "result": ["hello", 5], "id": "9"}
    ]`);
const faitsLot = rpc.faitsJsonRpc(lotSpec, lotReponse, { statut: 200 });
egal('JSON-RPC §7 : lot, l element invalide est compte', faitsLot.filter(f => f.cle === 'elementsInvalides').map(f => f.valeurs.n).join(), '1');
verifier('JSON-RPC §7 : lot, chaque requete a sa reponse', !faitsLot.some(f => f.cle === 'sansReponse'));
verifier('JSON-RPC §7 : lot, deux erreurs malgre le statut 200', faitsLot.some(f => f.cle === 'statut2xxErreurs' && f.valeurs.n === 2));
const amputee = rpc.lireReponseJsonRpc('[{"jsonrpc": "2.0", "result": 7, "id": "1"}]');
verifier('JSON-RPC §6 : une requete sans reponse est nommee',
  rpc.faitsJsonRpc(lotSpec, amputee).some(f => f.cle === 'sansReponse' && f.valeurs.id === '"2"'));
const notifications = rpc.lireAppelJsonRpc('[{"jsonrpc": "2.0", "method": "notify_sum", "params": [1,2,4]}, {"jsonrpc": "2.0", "method": "notify_hello", "params": [7]}]');
verifier('JSON-RPC §4.1 : un serveur qui repond a des notifications est signale',
  rpc.faitsJsonRpc(notifications, rpc.lireReponseJsonRpc('{"jsonrpc": "2.0", "result": 7, "id": null}')).some(f => f.cle === 'notificationRepondue'));
verifier('JSON-RPC §6 : un tableau vide en reponse a un lot est signale',
  rpc.faitsJsonRpc(lotSpec, rpc.lireReponseJsonRpc('[]')).some(f => f.cle === 'lotVide'));
verifier('JSON-RPC : un id de reponse different est signale',
  rpc.faitsJsonRpc(appelPos, rpc.lireReponseJsonRpc('{"jsonrpc": "2.0", "result": 19, "id": 2}')).some(f => f.cle === 'idInattendu'));
verifier('JSON-RPC §5 : result et error ensemble font une reponse invalide',
  rpc.lireReponseJsonRpc('{"jsonrpc": "2.0", "result": 1, "error": {"code": 1, "message": "x"}, "id": 1}') === null);
egal('JSON-RPC : la version 1.0 n est pas lue', rpc.lireAppelJsonRpc('{"jsonrpc": "1.0", "method": "getinfo", "id": 1}'), null);
egal('JSON-RPC : resume d un lot', rpc.texteRpc(rpc.resumeRpc(lotSpec)), 'JSON-RPC sum, notify_hello, subtract +2');

/* ============================== 9. SOAP ================================== */
/* Exemples de SOAP 1.1 (Note du W3C, 2000) et du Primer SOAP 1.2 (§2.3). */
const SOAP11_APPEL = `<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
   <SOAP-ENV:Body>
       <m:GetLastTradePrice xmlns:m="Some-URI">
           <symbol>DIS</symbol>
       </m:GetLastTradePrice>
   </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
const SOAP11_FAUTE = `<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
   <SOAP-ENV:Body>
       <SOAP-ENV:Fault>
           <faultcode>SOAP-ENV:MustUnderstand</faultcode>
           <faultstring>SOAP Must Understand Error</faultstring>
       </SOAP-ENV:Fault>
   </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
const SOAP12_FAUTE = `<?xml version='1.0' ?>
<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"
            xmlns:rpc='http://www.w3.org/2003/05/soap-rpc'>
  <env:Body>
   <env:Fault>
     <env:Code>
       <env:Value>env:Sender</env:Value>
       <env:Subcode>
        <env:Value>rpc:BadArguments</env:Value>
       </env:Subcode>
     </env:Code>
     <env:Reason>
      <env:Text xml:lang="en-US">Processing error</env:Text>
      <env:Text xml:lang="cs">Chyba zpracování</env:Text>
     </env:Reason>
     <env:Detail>
      <e:myFaultDetails
        xmlns:e="http://travelcompany.example.org/faults">
        <e:message>Name does not match card number</e:message>
        <e:errorcode>999</e:errorcode>
      </e:myFaultDetails>
     </env:Detail>
   </env:Fault>
 </env:Body>
</env:Envelope>`;
const appelSoap = rpc.lireSoap(SOAP11_APPEL);
egal('SOAP 1.1 : version lue a l espace de noms', appelSoap.version, '1.1');
egal('SOAP 1.1 : operation et son espace de noms', appelSoap.operation.nom + ' ' + appelSoap.operation.espace, 'GetLastTradePrice Some-URI');
const faute11 = rpc.lireSoap(SOAP11_FAUTE);
egal('SOAP 1.1 : faute lue', faute11.faute.code + ' | ' + faute11.faute.message, 'SOAP-ENV:MustUnderstand | SOAP Must Understand Error');
egal('SOAP 1.1 : faute en 500, rien a redire', rpc.faitsSoap(appelSoap, faute11, { statut: 500 }).length, 0);
const cles200 = rpc.faitsSoap(appelSoap, faute11, { statut: 200 }).map(f => f.cle).join();
egal('SOAP 1.1 §6.2 : faute en 200, deux faits', cles200, 'soapStatut2xx,soap11Statut');
const faute12 = rpc.lireSoap(SOAP12_FAUTE);
egal('SOAP 1.2 : version', faute12.version, '1.2');
egal('SOAP 1.2 : code, sous-code, premiere raison', [faute12.faute.code, faute12.faute.sousCode, faute12.faute.message].join(' | '),
  'env:Sender | rpc:BadArguments | Processing error');
egal('SOAP 1.2 : le detail garde son texte', faute12.faute.detail, 'Name does not match card number 999');
verifier('SOAP 1.2 : aucune regle de statut inventee', !rpc.faitsSoap(null, faute12, { statut: 400 }).some(f => f.cle === 'soap11Statut'));
egal('SOAP : un autre espace de noms n est pas SOAP', rpc.lireSoap('<Envelope xmlns="urn:autre"><Body/></Envelope>'), null);
verifier('SOAP : une enveloppe coupee est lue en partie et le dit', rpc.lireSoap(SOAP11_APPEL.slice(0, 160)).incomplet);
egal('SOAP 1.1 : SOAPAction lue sans guillemets', JSON.stringify(rpc.actionSoap([{ name: 'SOAPAction', value: '"Some-URI#GetLastTradePrice"' }])),
  '{"source":"SOAPAction","valeur":"Some-URI#GetLastTradePrice"}');
egal('SOAP 1.2 : action lue dans le type', rpc.actionSoap([], 'application/soap+xml; charset=utf-8; action="urn:Quote"').valeur, 'urn:Quote');
verifier('SOAP 1.1 : SOAPAction vide, son sens est dit',
  rpc.faitsSoap(appelSoap, null, { action: rpc.actionSoap([{ name: 'SOAPAction', value: '""' }]) }).some(f => f.cle === 'soapActionVide'));
const ligneSoap = enregistrementExemple({ url: 'https://api.test/soap', finalUrl: 'https://api.test/soap',
  requestBody: { kind: 'raw', text: SOAP11_APPEL, size: SOAP11_APPEL.length, contentType: 'text/xml; charset="utf-8"' } });
egal('noyau : l operation SOAP figure dans le resume de la ligne', rpc.texteRpc(summarize(ligneSoap).rpc), 'SOAP 1.1 GetLastTradePrice');
const ligneRpc = enregistrementExemple({ url: 'https://api.test/rpc', finalUrl: 'https://api.test/rpc',
  requestBody: { kind: 'raw', text: '{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}', size: 70 } });
egal('noyau : la methode JSON-RPC figure dans le resume de la ligne', rpc.texteRpc(summarize(ligneRpc).rpc), 'JSON-RPC subtract');
egal('noyau : une ligne ordinaire n a pas d appel RPC', summarize(enregistrementExemple({})).rpc, null);

/* ======================= 10. Probleme HTTP (RFC 9457) ===================== */
const pb = await import('../ui/lib/probleme-http.js');
const HORS_CREDIT = `{
 "type": "https://example.com/probs/out-of-credit",
 "title": "You do not have enough credit.",
 "detail": "Your current balance is 30, but that costs 50.",
 "instance": "/account/12345/msgs/abc",
 "balance": 30,
 "accounts": ["/account/12345",
              "/account/67890"]
}`;
const p1 = pb.lireProbleme(HORS_CREDIT, 'application/problem+json');
egal('RFC 9457 §3 : l exemple de la RFC se lit', p1.type + ' | ' + p1.title, 'https://example.com/probs/out-of-credit | You do not have enough credit.');
egal('RFC 9457 : les membres d extension sont gardes a part', Object.keys(p1.extensions).join(','), 'balance,accounts');
egal('RFC 9457 : sans status ni type relatif, rien a redire', pb.faitsProbleme(p1, { statut: 403, url: 'https://example.com/account/12345/msgs' }).length, 0);
egal('RFC 9457 : un autre type n est pas lu', pb.lireProbleme(HORS_CREDIT, 'application/json'), null);
const p2 = pb.lireProbleme('{"title":"Not Found","status":404}', 'application/problem+json; charset=utf-8');
const cles2 = pb.faitsProbleme(p2, { statut: 200 }).map(f => f.cle).join();
egal('RFC 9457 §3.1.1, §4.2.1, §3.1.2 : type absent, about:blank, status contredit', cles2, 'typeAbsent,aboutBlank,statutDifferent');
egal('RFC 9457 §4.2.1 : about:blank et la phrase du statut', pb.faitsProbleme(p2, { statut: 404 }).find(f => f.cle === 'aboutBlank').valeurs.phrase, 'Not Found');
const p3 = pb.lireProbleme('{"type":"/probs/x","status":"404"}', 'application/problem+json');
egal('RFC 9457 §3.1 : un status qui n est pas un nombre est ignore', p3.ignores.join(), 'status');
egal('RFC 9457 §3.1.1 : type relatif resolu', pb.faitsProbleme(p3, { statut: 404, url: 'https://api.test/v1/x' }).find(f => f.cle === 'typeRelatif').valeurs.resolu,
  'https://api.test/probs/x');

/* ========================= 11. Controles d un corps ======================= */
const cc = await import('../ui/lib/corps-controles.js');
const zlib = await import('node:zlib');
const pageErreur = cc.controlerType({ text: '<!DOCTYPE html><html><body>502 Bad Gateway</body></html>', size: 56 }, 'application/json');
egal('corps : une page HTML annoncee JSON', pageErreur.cle + ' / ' + pageErreur.valeurs.nature, 'pasDuJson / ' + cc.FAITS_CORPS.natureHtml);
verifier('corps : la nature est marquee a traduire', pageErreur.aTraduire.includes('nature'));
egal('corps : un JSON valide ne dit rien', cc.controlerType({ text: '{"a":1}' }, 'application/json; charset=utf-8'), null);
egal('corps : un corps tronque n est pas juge', cc.controlerType({ text: '{"a":', truncated: true }, 'application/json'), null);
egal('corps : du JSON servi en text/html', cc.controlerType({ text: '{"a":1}' }, 'text/html').cle, 'jsonEnHtml');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]).toString('base64');
egal('corps : un JPEG annonce PNG', cc.controlerType({ base64: jpeg }, 'image/png').valeurs.format, 'JPEG');
egal('corps : un JPEG annonce JPEG ne dit rien', cc.controlerType({ base64: jpeg }, 'image/jpeg'), null);
egal('corps : signature WebP', cc.formatImage(new Uint8Array([...Buffer.from('RIFF'), 1, 2, 3, 4, ...Buffer.from('WEBP')])), 'webp');
egal('corps : octets inconnus, aucune affirmation', cc.formatImage(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), null);

const texteLong = JSON.stringify({ lignes: Array.from({ length: 300 }, (_, i) => ({ id: i, libelle: 'produit ' + (i % 7) })) });
const octetsLong = new TextEncoder().encode(texteLong);
const mesure = await cc.mesurerCompression({ text: texteLong, size: octetsLong.length, stored: octetsLong.length }, []);
verifier('compression : mesuree sur un texte servi sans compression', mesure && mesure.apres < mesure.avant, JSON.stringify(mesure));
const gz = await cc.gzipOctets(octetsLong);
verifier('compression : le gzip mesure se decompresse avec node:zlib en texte identique',
  Buffer.from(zlib.gunzipSync(gz)).equals(Buffer.from(octetsLong)));
egal('compression : la taille annoncee est celle de ce gzip', mesure.apres, gz.length);
egal('compression : deja compresse, pas de mesure', await cc.mesurerCompression({ text: texteLong, stored: octetsLong.length }, [{ name: 'Content-Encoding', value: 'br' }]), null);
egal('compression : texte qui ne redonne pas les octets recus, pas de mesure', await cc.mesurerCompression({ text: texteLong, stored: octetsLong.length + 3 }, []), null);
egal('compression : moins d un kilo-octet, pas de mesure', await cc.mesurerCompression({ text: '{"a":1}', stored: 7 }, []), null);

/* ======================= 12. security.txt (RFC 9116) ====================== */
/* L exemple non signe de la RFC (§2.6), recopie tel quel. */
const st = await import('../ui/lib/security-txt.js');
const EXEMPLE_9116 = `# Our security address
Contact: mailto:security@example.com

# Our OpenPGP key
Encryption: https://example.com/pgp-key.txt

# Our security policy
Policy: https://example.com/security-policy.html

# Our security acknowledgments page
Acknowledgments: https://example.com/hall-of-fame.html

Expires: 2021-12-31T18:37:07z
`;
const lu9116 = st.lireSecurityTxt(EXEMPLE_9116);
egal('RFC 9116 §2.6 : les cinq champs de l exemple, commentaires ignores', lu9116.champs.map(c => c.nom).join(','),
  'Contact,Encryption,Policy,Acknowledgments,Expires');
egal('RFC 3339 : le « z » minuscule de l exemple est une date valide', new Date(st.dateRfc3339('2021-12-31T18:37:07z')).toISOString(), '2021-12-31T18:37:07.000Z');
egal('RFC 3339 : decalage pris en compte', new Date(st.dateRfc3339('2021-12-31T20:37:07+02:00')).toISOString(), '2021-12-31T18:37:07.000Z');
egal('RFC 3339 : 30 fevrier refuse', st.dateRfc3339('2021-02-30T00:00:00Z'), null);
const URL_WK = 'https://example.com/.well-known/security.txt';
const avant = st.faitsSecurityTxt(lu9116, { url: URL_WK, typeMedia: 'text/plain; charset=utf-8', maintenant: Date.UTC(2021, 5, 1) });
egal('RFC 9116 : l exemple, lu avant son expiration, n a que la recommandation de signature', avant.map(f => f.cle).join(), 'nonSigne');
const apres = st.faitsSecurityTxt(lu9116, { url: URL_WK, typeMedia: 'text/plain', maintenant: Date.UTC(2026, 9, 6) });
verifier('RFC 9116 §2.5.5 : lu en 2026, l exemple est perime', apres.some(f => f.cle === 'perime' && f.valeurs.date === '2021-12-31'));
const fautif = st.lireSecurityTxt('contact: http://example.com/securite\nExpires: 2030-01-01T00:00:00Z\nExpires: 2031-01-01T00:00:00Z\nCanonical: https://example.com/.well-known/security.txt');
const clesFautif = st.faitsSecurityTxt(fautif, { url: 'http://example.com/security.txt', typeMedia: 'text/html', maintenant: Date.UTC(2026, 9, 6) }).map(f => f.cle);
for (const cle of ['contactHttp', 'expiresMultiple', 'plusDunAn', 'horsCanonical', 'nonHttps', 'typeContenu', 'horsWellKnown']) {
  verifier('RFC 9116 : ' + cle + ' constate', clesFautif.includes(cle), clesFautif.join());
}
egal('RFC 9116 §2 : nom de champ insensible a la casse', fautif.champs[0].nom, 'Contact');
verifier('RFC 9116 : sans Contact ni Expires, les deux sont dits',
  ['sansContact', 'sansExpires'].every(c => st.faitsSecurityTxt(st.lireSecurityTxt('Policy: https://a.test/p'), { url: URL_WK }).some(f => f.cle === c)));
const signe = st.lireSecurityTxt('-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA256\n\nContact: mailto:s@a.test\n- -----not a header\nExpires: 2030-01-01T00:00:00Z\n-----BEGIN PGP SIGNATURE-----\n\nAAAA\n-----END PGP SIGNATURE-----\n');
egal('RFC 9116 §2.3 : signature OpenPGP en clair reconnue, armure retiree', signe.signe + ' ' + signe.champs.map(c => c.nom).join(','), 'true Contact,Expires');
egal('security.txt : emplacements', ['https://a.test/.well-known/security.txt', 'https://a.test/security.txt', 'https://a.test/x.txt'].map(st.emplacementSecurityTxt).join(','),
  'well-known,racine,');
const analyseSt = analyze(enregistrementExemple({ url: URL_WK, finalUrl: URL_WK, method: 'GET', requestBody: null }), { force: true });
verifier('analyseur : un security.txt porte son marqueur', analyseSt.tags.includes('security-txt'));

bilan('Protocoles et formats d API');
