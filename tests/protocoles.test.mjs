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
 *      l analyseur (mutation executee en GET, schema livre).
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

bilan('GraphQL, rapports et OpenAPI');
