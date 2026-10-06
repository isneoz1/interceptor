/* Verification independante de l export OpenAPI — SWIFT (by NeoZ)
 *
 *   node tools/verifier-openapi.mjs
 *   python tools/verifier-openapi.py dist/verif-openapi
 *
 * Le premier script fait batir par le vrai noyau une description OpenAPI du
 * trafic de la scene (tools/scene.mjs) et d appels choisis pour leurs cas
 * limites, puis des paires (exemples, schema deduit). Le second les soumet a
 * des outils qui ne doivent rien a SWIFT :
 *   openapi-spec-validator  le document est-il un OpenAPI 3.1 valide ?
 *   jsonschema              chaque exemple est-il accepte par le schema
 *                           deduit, formats compris (Draft 2020-12) ?
 * pip install openapi-spec-validator jsonschema rfc3339-validator rfc3986-validator
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
const RACINE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SORTIE = path.resolve(process.argv[2] || path.join(RACINE, 'dist', 'verif-openapi'));
fs.mkdirSync(SORTIE, { recursive: true });
const { ouvrirScene } = await import(url.pathToFileURL(RACINE).href + '/tools/scene.mjs');
const scene = await ouvrirScene({ langue: 'en', volume: 400 });
const { store } = await import(url.pathToFileURL(RACINE).href + '/background/core/store.js');
const { buildOpenApi } = await import(url.pathToFileURL(RACINE).href + '/background/export/openapi.js');
const { schemaDeValeurs, formatDe } = await import(url.pathToFileURL(RACINE).href + '/ui/lib/schema-json.js');
const { enregistrementExemple } = await import(url.pathToFileURL(RACINE).href + '/tests/harnais.mjs');

/* Des appels varies, ajoutes a la scene : identifiants, corps, statuts, auth. */
const extra = [];
const ajouter = patch => extra.push(enregistrementExemple({ finalUrl: patch.url, ...patch }));
for (const [i, id] of ['42', '43', '9001'].entries()) {
  ajouter({ id: 90000 + i, url: 'https://api.boutique.test/v2/users/' + id + '?fields=name&lang=fr', method: 'GET',
    requestBody: null, statusCode: 200, mime: 'application/json',
    requestHeaders: [{ name: 'Authorization', value: 'Bearer abc' }],
    responseBody: { kind: 'text', text: JSON.stringify({ id: Number(id), name: 'n' + id, tags: i ? ['a'] : [], created: '2025-01-0' + (i + 1) + 'T10:00:00Z', avatar: i === 2 ? null : 'https://cdn.test/a.png' }), size: 80 } });
}
ajouter({ id: 90010, url: 'https://api.boutique.test/v2/users/0b8c4a3e-2f1d-4c6b-9e7a-1d2c3b4a5f60/orders/7', method: 'POST',
  requestHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Authorization', value: 'Basic dTpw' }],
  requestBody: { kind: 'raw', contentType: 'application/json', text: '{"qty":2,"price":9.5,"note":null}', size: 34 },
  statusCode: 201, mime: 'application/json', responseBody: { kind: 'text', text: '{"ok":true}', size: 11 } });
ajouter({ id: 90011, url: 'https://api.boutique.test/v2/session', method: 'DELETE', requestBody: null,
  statusCode: 204, mime: '', responseBody: null });
ajouter({ id: 90012, url: 'https://api.boutique.test/v2/login', method: 'POST',
  requestBody: { kind: 'formData', formData: { user: ['a'], scope: ['x', 'y'] }, size: 20 },
  requestHeaders: [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }],
  statusCode: 401, mime: 'application/problem+json', responseBody: { kind: 'text', text: '{"type":"about:blank","status":401}', size: 30 } });
ajouter({ id: 90013, url: 'https://api.boutique.test/v2/huge', method: 'GET', requestBody: null,
  statusCode: 200, mime: 'application/json', responseBody: { kind: 'text', text: '{"a":', size: 999999, truncated: true } });
ajouter({ id: 90014, url: 'https://api.boutique.test/v2/pending', method: 'PUT', requestBody: null, statusCode: null, mime: '', responseBody: null });
ajouter({ id: 90015, url: 'https://api.boutique.test/v2/users/42', method: 'OPTIONS', requestBody: null, statusCode: 204,
  requestHeaders: [{ name: 'Access-Control-Request-Method', value: 'POST' }], mime: '', responseBody: null });

const tout = [...store.all(), ...extra];
const resultat = buildOpenApi(tout);
const resultatScene = buildOpenApi(store.all());
fs.writeFileSync(path.join(SORTIE, 'openapi-extra.json'), JSON.stringify(buildOpenApi(extra).document, null, 2));
fs.writeFileSync(path.join(SORTIE, 'openapi-scene.json'), JSON.stringify(resultatScene.document, null, 2));
console.log('scene :', resultatScene.operations, 'operations,', resultatScene.decrites, 'appels decrits,', resultatScene.ecartees, 'ecartes', resultatScene.origine);
console.log('tout  :', resultat.operations, 'operations, origine', resultat.origine);

/* Paires (exemples, schema). */
const paires = [];
const garder = valeurs => paires.push({ valeurs, schema: schemaDeValeurs(valeurs) });
for (const f of fs.readdirSync(path.join(RACINE, 'tests')).filter(n => /^vecteurs-.*\.json$/.test(n))) {
  garder([JSON.parse(fs.readFileSync(path.join(RACINE, 'tests', f), 'utf8'))]);
}
garder([1, 2.5, -3]);
garder(['a', null, 'b']);
garder([[1, 'x', null, [true]], [], [{ a: 1 }]]);
garder([{ a: 1, b: 'x' }, { a: 2 }, { a: null, c: [] }]);
garder([JSON.parse('{"__proto__": {"x": 1}, "constructor": "c"}')]);
garder(['2024-02-29', '2023-12-31']);
garder(['2023-02-29']);                       // date impossible : pas de format
garder(['2025-01-01T00:00:00Z', '1998-12-31T23:59:60Z', '1998-12-31T15:59:60.123-08:00', '1985-04-12T23:20:50.52Z']);
garder(['2025-06-30T23:59:60+02:00']);
garder(['1998-12-31T23:58:60Z']);
garder(['2025-13-01T00:00:00Z']);
garder(['0b8c4a3e-2f1d-4c6b-9e7a-1d2c3b4a5f60', 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE']);
garder(['https://a.test/x?y=1#z', 'http://b.test/%41']);
garder(['https://a.test/a b']);               // espace : pas une URI
garder([{ deep: { deeper: { deepest: [{ v: 1 }, { v: 'deux' }, { w: false }] } } }]);
garder([true, false, 0, '', {}, []]);
/* Au-dela du budget de lecture : le schema doit rester vrai. */
const enorme = Array.from({ length: 300000 }, (_, i) => (i === 299999 ? 'fin' : i));
garder([enorme]);
fs.writeFileSync(path.join(SORTIE, 'schemas.json'), JSON.stringify(paires));
console.log(paires.length, 'paires exemples/schema');
console.log('formats :', ['2024-02-29', '2023-02-29', 'https://a.test/a b'].map(formatDe).join(' | '));
scene.fermer();
