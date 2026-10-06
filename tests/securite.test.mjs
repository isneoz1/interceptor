/* Outils de securite — SWIFT (by NeoZ)
 *
 *   node tests/securite.test.mjs
 *
 * Ce que la 4.5 ajoute, verifie contre des references independantes du code
 * teste : les flux gzip et DEFLATE sont fabriques par node:zlib, les
 * empreintes par node:crypto.
 *
 *   1. faits de l analyseur : parametre renvoye, redirection vers un
 *      parametre, et l alerte « nonce CSP reutilise » ;
 *   2. empreintes calculees sur les VRAIS octets — ceux que Firefox remet au
 *      filtre — et un verdict seulement quand il se prouve ;
 *   3. le texte d un corps de requete, exact ou non ;
 *   4. les protections d une reponse ;
 *   5. la CSP deduite des chargements ;
 *   6. OAuth 2.0 / OpenID Connect ;
 *   7. SAML 2.0, dans ses deux liaisons.
 */
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { installerTout, enregistrementExemple, egal, verifier, leve, bilan } from './harnais.mjs';

installerTout();

const { config } = await import('../background/core/config.js');
await config.ready;
const { analyze } = await import('../background/core/analyzer.js');
const { oublierNonces, parametresDe } = await import('../background/core/analyzer-faits.js');
const { empreintesDeReponse, empreintesDe, RAISONS } = await import('../background/capture/empreintes.js');
const { decodeRequestBody } = await import('../background/capture/bodies.js');
const { store } = await import('../background/core/store.js');
const { lireProtections } = await import('../ui/lib/protections.js');
const { proposerCsp, chargementsDe } = await import('../ui/lib/csp-observee.js');
const { lireOAuth, FAITS_OAUTH } = await import('../ui/lib/oauth.js');
const { trouverSaml, decoderSaml, decoderSamlTexte, lireSaml, FAITS_SAML } = await import('../ui/lib/saml.js');

const b64 = o => Buffer.from(o).toString('base64');
const sha = (algo, o) => crypto.createHash(algo).update(o).digest('base64');

/* =============================== 1. Analyseur ============================ */
const html = (patch) => enregistrementExemple({
  mime: 'text/html', type: 'main_frame', requestBody: null,
  responseBody: { kind: 'text', text: '', size: 0, source: 'streamFilter' }, ...patch
});

const reflete = analyze(html({
  url: 'https://a.test/recherche?q=chaussures&lang=fr',
  finalUrl: 'https://a.test/recherche?q=chaussures&lang=fr',
  responseBody: { kind: 'text', text: '<h1>Resultats pour chaussures</h1><p>chaussures</p>', size: 60 }
}), { force: true });
egal('reflexion : un fait, pas une alerte', reflete.findings.length, 0);
egal('reflexion : le fait est note', reflete.faits.length, 1);
egal('reflexion : combien de fois', reflete.faits[0].valeurs.n, 2);
verifier('reflexion : marqueur pose', reflete.tags.includes('reflete'));
verifier('reflexion : une valeur de moins de six caracteres ne compte pas',
  !reflete.faits.some(f => f.valeurs.nom === 'lang'));

const brut = analyze(html({
  url: 'https://a.test/r?q=' + encodeURIComponent('<b>test</b>'),
  finalUrl: 'https://a.test/r?q=' + encodeURIComponent('<b>test</b>'),
  responseBody: { kind: 'text', text: 'Vous avez cherche <b>test</b>', size: 30 }
}), { force: true });
verifier('reflexion brute : caracteres speciaux non echappes', brut.tags.includes('reflete-brut'));
const echappe = analyze(html({
  url: 'https://a.test/r?q=' + encodeURIComponent('<b>test</b>'),
  finalUrl: 'https://a.test/r?q=' + encodeURIComponent('<b>test</b>'),
  responseBody: { kind: 'text', text: 'Vous avez cherche &lt;b&gt;test&lt;/b&gt;', size: 40 }
}), { force: true });
egal('une valeur renvoyee echappee n est pas dite renvoyee telle quelle', echappe.faits.length, 0);

const image = analyze(html({
  mime: 'image/svg+xml', url: 'https://a.test/i?t=abcdefgh', finalUrl: 'https://a.test/i?t=abcdefgh',
  responseBody: { kind: 'text', text: '<svg>abcdefgh</svg>', size: 20 }
}), { force: true });
egal('reflexion : seulement dans une reponse textuelle HTML, JSON, JS ou XML', image.faits.length, 0);

/* Le parcours est borne : sans borne, 5 000 champs face a 20 Mo figeaient la
   capture dix secondes. Un compte borne est dit comme un minimum. */
const champs = {};
for (let i = 0; i < 5000; i++) champs['c' + i] = ['valeur' + i + 'zz'];
const t0 = performance.now();
const enorme = analyze(html({ url: 'https://a.test/f', finalUrl: 'https://a.test/f',
  requestBody: { kind: 'formData', formData: champs },
  responseBody: { kind: 'text', text: 'valeur0zz ' + 'abcdefghij'.repeat(2e6), size: 2e7 } }), { force: true });
const msReflexion = performance.now() - t0;
verifier('5 000 champs face a 20 Mo : analyse en moins d une seconde', msReflexion < 1000, Math.round(msReflexion) + ' ms');
egal('corps lu en partie : le compte est un minimum', enorme.faits[0] && enorme.faits[0].valeurs.n, '1+');
const souvent = analyze(html({ url: 'https://a.test/r?q=repete', finalUrl: 'https://a.test/r?q=repete',
  responseBody: { kind: 'text', text: 'repete '.repeat(1500), size: 10500 } }), { force: true });
egal('plus de mille occurrences : le compte est un minimum', souvent.faits[0].valeurs.n, '1000+');

egal('parametres d un corps JSON', parametresDe({
  url: 'https://a.test/', requestBody: { text: '{"nom":"Dupont","age":4}', contentType: 'application/json' }
}).map(p => p.nom).join(','), 'nom');

const redirection = analyze(html({
  url: 'https://a.test/login?next=https%3A%2F%2Fautre.test%2Fx',
  redirects: [{ from: 'https://a.test/login?next=https%3A%2F%2Fautre.test%2Fx', to: 'https://autre.test/x', statusCode: 302 }]
}), { force: true });
verifier('redirection vers la valeur d un parametre', redirection.tags.includes('redirection-parametree'));
const relative = analyze(html({
  url: 'https://a.test/go?page=%2Fcompte',
  redirects: [{ from: 'https://a.test/go?page=%2Fcompte', to: 'https://a.test/compte', statusCode: 301 }]
}), { force: true });
verifier('redirection vers un chemin relatif du parametre', relative.tags.includes('redirection-parametree'));

/* --- Le corps arrive apres l analyse --- */
/* Le filtre de flux remet le corps apres onCompleted, et la decompression est
   asynchrone : l analyse faite a la cloture ne l avait pas vu. */
const { applyResponseBody } = await import('../background/capture/streamfilter.js');
/* Cree comme le fait la capture : store.create pose l index de chronologie. */
const tardif = store.create({ url: 'https://a.test/r?q=vetements', finalUrl: 'https://a.test/r?q=vetements',
  method: 'GET', type: 'main_frame', mime: 'text/html', statusCode: 200,
  requestHeaders: [], responseHeaders: [{ name: 'Content-Type', value: 'text/html' }] });
analyze(tardif, { force: true });
egal('avant le corps : aucun fait', tardif.analysis.faits.length, 0);
applyResponseBody(tardif, new TextEncoder().encode('<p>vetements</p><p>AKIAIOSFODNN7EXAMPLE</p>'),
  { mime: 'text/html', charset: 'utf-8', total: 42, truncated: false, decompressed: false, contentEncoding: '' });
egal('le corps arrive : la reflexion est vue', tardif.analysis.faits.length, 1);
verifier('le corps arrive : le secret qu il contient est vu',
  tardif.analysis.findings.some(f => f.where === 'responseBody'));

/* --- Nonce CSP --- */
oublierNonces();
const avecNonce = (id, patch = {}) => enregistrementExemple({
  id, url: 'https://a.test/p' + id, finalUrl: 'https://a.test/p' + id, startTime: 1000 + id,
  responseHeaders: [{ name: 'Content-Security-Policy', value: "script-src 'nonce-R4nd0m' 'strict-dynamic'" }], ...patch
});
const premiere = avecNonce(501);
egal('premier nonce : rien', analyze(premiere, { force: true }).findings.filter(f => f.rule === 'csp').length, 0);
egal('meme reponse reanalysee : rien', analyze(premiere, { force: true }).findings.filter(f => f.rule === 'csp').length, 0);
egal('reponse servie par le cache : rien',
  analyze(avecNonce(502, { fromCache: true }), { force: true }).findings.filter(f => f.rule === 'csp').length, 0);
egal('304 : rien', analyze(avecNonce(503, { statusCode: 304 }), { force: true }).findings.filter(f => f.rule === 'csp').length, 0);
egal('meme fichier HAR importe deux fois : rien',
  analyze(avecNonce(504, { url: 'https://a.test/p501', finalUrl: 'https://a.test/p501', startTime: 1501 }), { force: true })
    .findings.filter(f => f.rule === 'csp').length, 0);
const reutilise = analyze(avecNonce(505), { force: true }).findings.find(f => f.rule === 'csp');
verifier('meme nonce dans une autre reponse : alerte', !!reutilise);
egal('alerte : gravite moyenne', reutilise && reutilise.severity, 'medium');
egal('alerte : la preuve cite la premiere reponse', reutilise && reutilise.preuveValeurs.id, 501);
oublierNonces();
egal('apres effacement de la capture, plus de memoire des nonces',
  analyze(avecNonce(506), { force: true }).findings.filter(f => f.rule === 'csp').length, 0);

/* ======================= 2. Empreintes sur les vrais octets ============== */
const TEXTE = 'console.log("INTERCEPTOR");\n';
const clair = Buffer.from(TEXTE);
const gz = zlib.gzipSync(clair);

/* Firefox decode Content-Encoding AVANT le filtre de flux (StreamFilterParent :
   aMustApplyContentConversion = true) : le filtre recoit d ordinaire le corps
   decode, et le transmet tel quel a la page. */
async function empreintes(entetes, recus, meta = {}) {
  const rec = store.create({ url: 'https://a.test/app.js', type: 'script', responseHeaders: entetes });
  rec.responseBody = { kind: 'text', text: '', size: recus.length };
  await empreintesDeReponse(rec, new Uint8Array(recus), { contentEncoding: '', truncated: false, status: 200, ...meta });
  return rec.responseBody;
}
const digest = (o, nom = 'Content-Digest') => ({ name: nom, value: 'sha-256=:' + sha('sha256', o) + ':' });
const code = codage => ({ name: 'Content-Encoding', value: codage });
const autre = Buffer.from('un autre contenu');

const sansCodage = await empreintes([digest(clair)], clair);
egal('sans codage : l empreinte correspond', sansCodage.integrite[0].resultats[0].verdict, 'correspond');
const falsifie = await empreintes([digest(autre)], clair);
egal('sans codage, autre contenu : la discordance est affirmee', falsifie.integrite[0].resultats[0].verdict, 'differe');

/* Le cas ordinaire : gzip, deja decode par Firefox. L empreinte porte sur le
   flux gzip, jamais vu : la verifier sur le texte serait une fausse discordance. */
const dejaDecode = await empreintes([code('gzip'), digest(gz)], clair, { contentEncoding: 'gzip' });
egal('gzip deja decode : non verifiable, et dit pourquoi', dejaDecode.integrite[0].raison, RAISONS.dejaDecode);
verifier('gzip deja decode : aucun verdict invente', !dejaDecode.integrite[0].resultats);
verifier('le hacher sur le texte decode aurait donne une fausse discordance', sha('sha256', clair) !== sha('sha256', gz));

/* Un type que Firefox ne connait pas lui parvient encore code : l accord se
   prouve de lui-meme. */
const encoreCode = await empreintes([code('gzip'), digest(gz)], gz, { contentEncoding: 'gzip' });
egal('flux encore code : l accord est prouve', encoreCode.integrite[0].resultats[0].verdict, 'correspond');
/* Des octets gzip peuvent aussi etre un fichier .gz que Firefox a decode une
   fois : un desaccord ne prouve alors rien. */
const codeFaux = await empreintes([code('gzip'), digest(autre)], gz, { contentEncoding: 'gzip' });
egal('signature gzip, desaccord : pas de verdict', codeFaux.integrite[0].raison, RAISONS.codeNonProuve);
const brotli = await empreintes([code('br'), digest(autre)], clair, { contentEncoding: 'br' });
egal('brotli n a pas de signature : un desaccord ne prouve rien', brotli.integrite[0].raison, RAISONS.codeNonProuve);
const deflate = await empreintes([code('deflate'), digest(autre)], clair, { contentEncoding: 'deflate' });
egal('deflate peut venir sans en-tete zlib : un desaccord ne prouve rien', deflate.integrite[0].raison, RAISONS.codeNonProuve);
const deux = await empreintes([code('gzip, br'), digest(gz)], clair, { contentEncoding: 'gzip, br' });
egal('deux codages : c est la signature du dernier applique qui compte', deux.integrite[0].raison, RAISONS.codeNonProuve);
const zstd = await empreintes([code('zstd'), digest(autre)], clair, { contentEncoding: 'zstd' });
egal('zstd sans sa signature : deja decode', zstd.integrite[0].raison, RAISONS.dejaDecode);

const mixte = await empreintes([code('gzip'), { name: 'Content-Digest',
  value: 'sha-256=:' + sha('sha256', clair) + ':, sha-512=:' + sha('sha512', autre) + ':' }], clair, { contentEncoding: 'gzip' });
const verdicts = (mixte.integrite[0].resultats || []).map(r => r.verdict).join(',');
egal('un accord prouve les octets : le desaccord de l autre algorithme est reel', verdicts, 'correspond,differe');

const tronque = await empreintes([digest(clair)], clair, { truncated: true });
egal('corps tronque : non verifiable', tronque.integrite[0].raison, RAISONS.tronque);
const partielle = await empreintes([digest(clair, 'Repr-Digest')], clair, { status: 206 });
egal('206 et Repr-Digest : non verifiable', partielle.integrite[0].raison, RAISONS.partielle);

/* SRI : sur les octets que le filtre transmet a la page, ceux que le chargeur
   de script recoit et hache. */
egal('SRI sha384 = empreinte des octets transmis a la page', sansCodage.sri.sha384, 'sha384-' + sha('sha384', clair));
egal('SRI sha256', sansCodage.sri.sha256, 'sha256-' + sha('sha256', clair));
egal('SRI sha512', sansCodage.sri.sha512, 'sha512-' + sha('sha512', clair));
egal('SRI d un corps que Firefox a decode : sur le corps decode', dejaDecode.sri.sha384, 'sha384-' + sha('sha384', clair));
egal('corps tronque : pas de SRI', tronque.sri, undefined);
egal('corps tronque : la raison est donnee', tronque.sriRaison, RAISONS.tronque);
const imageSri = store.create({ url: 'https://a.test/i.png', type: 'image' });
imageSri.responseBody = { kind: 'binary', size: 3 };
await empreintesDeReponse(imageSri, new Uint8Array([1, 2, 3]), { contentEncoding: '' });
egal('une image n a pas de SRI', imageSri.responseBody.sri, undefined);

/* Un flux encore gzip est decompresse par l extension — sans jamais se laisser
   deplier sans fin. */
const { maybeDecompress } = await import('../background/lib/util.js');
const deplie = await maybeDecompress(new Uint8Array(gz), 'gzip');
egal('flux gzip encore code : decompresse', Buffer.from(deplie.bytes).toString(), TEXTE);
const gonfle = zlib.gzipSync(Buffer.alloc(4096, 0x61));
const plafonne = await maybeDecompress(new Uint8Array(gonfle), 'gzip', 1024);
verifier('au-dela du plafond : flux garde tel quel, dit non decompresse',
  plafonne.decompressed === false && plafonne.bytes.length === gonfle.length);

/* Le corps peut etre remplace pendant le calcul — par celui que rapporte la
   page. Les empreintes vont sur le corps en place a la fin, et le suivent. */
const course = store.create({ url: 'https://a.test/c.js', type: 'script', responseHeaders: [digest(clair)] });
course.responseBody = { kind: 'binary', size: clair.length };
const enCours = empreintesDeReponse(course, new Uint8Array(clair), { contentEncoding: '' });
course.responseBody = { kind: 'text', text: 'rapporte par la page', source: 'pageHook' };
await enCours;
verifier('corps remplace pendant le calcul : les empreintes vont sur le nouveau',
  !!course.responseBody.sri && !!course.responseBody.integrite);
const reporte = { kind: 'text', source: 'pageHook', ...empreintesDe(course.responseBody) };
egal('corps remplace apres le calcul : les empreintes suivent', reporte.sri && reporte.sri.sha384, course.responseBody.sri.sha384);
egal('rien a reporter d un corps sans empreinte', Object.keys(empreintesDe({ kind: 'text' })).length, 0);

/* ========================= 3. Corps de requete exact ===================== */
const corpsDe = octets => decodeRequestBody({ raw: [{ bytes: new Uint8Array(octets).buffer }] }, 'text/plain');
egal('UTF-8 valide : le texte redonne les octets', corpsDe(Buffer.from('bonjour é')).octetsExacts, true);
egal('BOM retire : le texte ne redonne pas les octets',
  corpsDe(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('abc')])).octetsExacts, false);
egal('octet latin-1 invalide en UTF-8 : pas exact', corpsDe(Buffer.from([0x63, 0x61, 0x66, 0xe9])).octetsExacts, false);

/* ============================= 4. Protections ============================ */
const prot = (entetes, patch = {}) => lireProtections({
  type: 'main_frame', scheme: 'https', mime: 'text/html',
  responseHeaders: Object.entries(entetes).map(([name, value]) => ({ name, value })), ...patch
});
const ligne = (lignes, nom) => lignes.filter(l => l.nom === nom);
const etat = (lignes, nom) => ligne(lignes, nom).map(l => l.etat).join(',');

egal('HSTS absent', etat(prot({ 'X-A': '1' }), 'HSTS'), 'absent');
egal('HSTS absent mais applique par Firefox', etat(prot({ 'X-A': '1' }, { security: { hsts: true } }), 'HSTS'), 'present');
egal('HSTS recu en http : ignore', etat(prot({ 'Strict-Transport-Security': 'max-age=31536000' }, { scheme: 'http' }), 'HSTS'), 'inoperant');
egal('HSTS sans max-age : inoperant', etat(prot({ 'Strict-Transport-Security': 'includeSubDomains' }), 'HSTS'), 'inoperant');
egal('HSTS max-age=0', etat(prot({ 'Strict-Transport-Security': 'max-age=0' }), 'HSTS'), 'inoperant');
egal('HSTS : jours', ligne(prot({ 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }), 'HSTS')[0].valeurs.jours, 365);
egal('HSTS : conditions de prechargement remplies',
  etat(prot({ 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' }), 'HSTS'), 'present,present');
egal('HSTS : preload sans les autres conditions',
  etat(prot({ 'Strict-Transport-Security': 'max-age=300; preload' }), 'HSTS'), 'present,partiel');

egal('CSP appliquee', etat(prot({ 'Content-Security-Policy': "default-src 'self'" }), 'CSP'), 'present');
egal('CSP en observation seulement', etat(prot({ 'Content-Security-Policy-Report-Only': "default-src 'self'" }), 'CSP'), 'partiel');
egal('CSP dans une balise meta', etat(prot({ 'X-A': '1' }, {
  responseBody: { text: '<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'"></head>' } }), 'CSP'), 'present');
verifier('CSP absente, corps non capture : on dit que la meta n a pas pu etre cherchee',
  /n a pas pu etre cherchee/.test(ligne(prot({ 'X-A': '1' }), 'CSP')[0].texte));

verifier('frame-ancestors l emporte sur X-Frame-Options', /est alors ignore/.test(ligne(prot({
  'Content-Security-Policy': "frame-ancestors 'self'", 'X-Frame-Options': 'DENY' }), 'Encadrement')[0].texte));
egal('X-Frame-Options DENY', etat(prot({ 'X-Frame-Options': 'deny' }), 'Encadrement'), 'present');
egal('X-Frame-Options ALLOW-FROM : plus reconnu', etat(prot({ 'X-Frame-Options': 'ALLOW-FROM https://x.test' }), 'Encadrement'), 'inoperant');
egal('aucune protection d encadrement', etat(prot({ 'X-A': '1' }), 'Encadrement'), 'absent');
egal('nosniff', etat(prot({ 'X-Content-Type-Options': 'nosniff' }), 'nosniff'), 'present');

egal('Referrer-Policy absente : celle de Firefox est dite',
  ligne(prot({ 'X-A': '1' }), 'Referrer-Policy')[0].texte, 'absente ; Firefox applique strict-origin-when-cross-origin : {sens}');
egal('Referrer-Policy : la derniere valeur reconnue s applique',
  ligne(prot({ 'Referrer-Policy': 'no-referrer, inconnue, same-origin' }), 'Referrer-Policy')[0].valeurs.politique, 'same-origin');
const perm = ligne(prot({ 'Permissions-Policy': 'camera=(), geolocation=(self "https://carte.test"), microphone=()' }), 'Permissions-Policy')[0];
egal('Permissions-Policy : fonctions coupees', perm.valeurs.coupees, 'camera, microphone');
egal('Permissions-Policy : fonctions limitees', perm.valeurs.limitees, 'geolocation');
egal('isolation : COOP same-origin et COEP require-corp', etat(prot({
  'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }), 'Isolation'), 'present');
egal('pas d isolation sans COEP', etat(prot({ 'Cross-Origin-Opener-Policy': 'same-origin' }), 'Isolation'), 'absent');
egal('version annoncee', ligne(prot({ 'Server': 'nginx/1.18.0' }), 'server')[0].texte, 'le serveur annonce une version : {valeur}');
egal('nom sans version', ligne(prot({ 'Server': 'cloudflare' }), 'server')[0].texte, 'le serveur se nomme : {valeur}');
const script = lireProtections({ type: 'script', scheme: 'https', responseHeaders: [{ name: 'X-A', value: '1' }] });
egal('une ressource : nosniff et CORP seulement', script.map(l => l.nom).join(','), 'nosniff,CORP');
egal('sans en-tetes, rien', lireProtections({ type: 'main_frame', responseHeaders: [] }).length, 0);

/* ============================ 5. CSP deduite ============================= */
const csp = proposerCsp('https://a.test/page', [
  { type: 'script', url: 'https://a.test/app.js' },
  { type: 'script', url: 'https://cdn.test/lib.js' },
  { type: 'stylesheet', url: 'https://a.test/s.css' },
  { type: 'image', url: 'data:image/png;base64,AAAA' },
  { type: 'font', url: 'https://fonts.test/f.woff2' },
  { type: 'xmlhttprequest', url: 'https://api.test/v1' },
  { type: 'websocket', url: 'wss://a.test/ws' },
  { type: 'sub_frame', url: 'https://video.test/embed' },
  { type: 'csp_report', url: 'https://a.test/report' },
  { type: 'other', url: 'https://a.test/x' }
]);
egal('CSP deduite', csp.politique,
  "default-src 'none'; script-src 'self' https://cdn.test; style-src 'self'; img-src data:; "
  + "font-src https://fonts.test; connect-src https://api.test wss://a.test; frame-src https://video.test");
egal('chargements retenus', csp.retenus, 8);
egal('chargements ignores (rapports, autres)', csp.ignores, 2);
egal('les chargements d une page : meme onglet, meme document, sans fragment',
  chargementsDe({ id: 1, tabId: 4, url: 'https://a.test/page#haut' }, [
    { id: 2, tabId: 4, initiator: 'https://a.test/page', type: 'script', url: 'https://a.test/a.js' },
    { id: 3, tabId: 5, initiator: 'https://a.test/page', type: 'script', url: 'https://a.test/b.js' },
    { id: 4, tabId: 4, initiator: 'https://a.test/autre', type: 'script', url: 'https://a.test/c.js' }
  ]).map(c => c.url).join(','), 'https://a.test/a.js');

/* =============================== 6. OAuth ================================ */
const autorise = url => lireOAuth({ url, requestBody: null, responseBody: null });
const textes = lu => (lu && lu.demande ? lu.demande.faits : []).map(f => f.texte);
const sansPkce = autorise('https://idp.test/authorize?response_type=code&client_id=app&redirect_uri=https%3A%2F%2Fapp.test%2Fcb&state=xyz&scope=openid%20email');
verifier('flux code sans PKCE : le fait est dit', textes(sansPkce).includes(FAITS_OAUTH.sansPkce));
verifier('state present : pas de fait « aucune protection »', !textes(sansPkce).includes(FAITS_OAUTH.sansCsrf));
egal('scope openid : OpenID Connect', sansPkce.demande.oidc, true);
egal('state : present, sans en recopier la valeur', sansPkce.demande.champs.state, 'present');
egal('S256 : rien a dire', textes(autorise('https://idp.test/a?response_type=code&client_id=app&code_challenge=abc&code_challenge_method=S256')).length, 0);
verifier('plain', textes(autorise('https://idp.test/a?response_type=code&client_id=app&code_challenge=abc&code_challenge_method=plain')).includes(FAITS_OAUTH.plain));
verifier('methode absente : plain par defaut', textes(autorise('https://idp.test/a?response_type=code&client_id=app&code_challenge=abc')).includes(FAITS_OAUTH.methodeParDefaut));
const implicite = autorise('https://idp.test/a?response_type=token&client_id=app');
verifier('flux implicite', textes(implicite).includes(FAITS_OAUTH.implicite));
verifier('ni state ni PKCE ni nonce', textes(implicite).includes(FAITS_OAUTH.sansCsrf));
verifier('retour en http', textes(autorise('https://idp.test/a?response_type=code&client_id=a&state=s&code_challenge=c&code_challenge_method=S256&redirect_uri=http%3A%2F%2Fapp.test%2Fcb')).includes(FAITS_OAUTH.retourEnClair));
verifier('retour en http sur la boucle locale : rien a dire (RFC 8252)', !textes(autorise('https://idp.test/a?response_type=code&client_id=a&state=s&code_challenge=c&code_challenge_method=S256&redirect_uri=http%3A%2F%2F127.0.0.1%3A8080%2Fcb')).includes(FAITS_OAUTH.retourEnClair));
const jeton = lireOAuth({ url: 'https://idp.test/token', requestBody: { kind: 'formData',
  formData: { grant_type: ['password'], username: ['a'], password: ['b'], client_secret: ['s'] } }, responseBody: null });
verifier('grant_type=password', textes(jeton).includes(FAITS_OAUTH.motDePasse));
verifier('client_secret present', textes(jeton).includes(FAITS_OAUTH.secretPresent));
verifier('le secret n est jamais reproduit', !JSON.stringify(jeton).includes('"s"'));
const reponse = lireOAuth({ url: 'https://idp.test/token', requestBody: null, responseBody: {
  text: '{"access_token":"at","token_type":"Bearer","expires_in":3600,"refresh_token":"rt","id_token":"a.b.c"}' } });
egal('reponse de jeton : type', reponse.reponse.champs.token_type, 'Bearer');
egal('reponse de jeton : duree', reponse.reponse.champs.expires_in, 3600);
egal('reponse de jeton : deux faits', reponse.reponse.faits.length, 2);
verifier('le jeton d acces n est pas reproduit', !JSON.stringify(reponse.reponse.champs).includes('"at"'));
egal('une requete ordinaire n est pas de l OAuth', lireOAuth({ url: 'https://a.test/?code=123', requestBody: null, responseBody: null }), null);

/* ================================ 7. SAML ================================ */
const DEMANDE = '<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" '
  + 'xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_d1" Version="2.0" '
  + 'IssueInstant="2026-09-24T10:00:00Z" Destination="https://idp.test/sso" '
  + 'AssertionConsumerServiceURL="https://app.test/acs"><saml:Issuer>https://app.test/meta</saml:Issuer>'
  + '</samlp:AuthnRequest>';
const REPONSE = (signature, chiffree) => '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" '
  + 'xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r1" InResponseTo="_d1" Version="2.0" '
  + 'IssueInstant="2026-09-24T10:00:05Z" Destination="https://app.test/acs">'
  + '<saml:Issuer>https://idp.test</saml:Issuer>'
  + '<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>'
  + (chiffree ? '<saml:EncryptedAssertion><xenc:EncryptedData xmlns:xenc="http://www.w3.org/2001/04/xmlenc#"/></saml:EncryptedAssertion>'
    : '<saml:Assertion ID="_a1" Version="2.0" IssueInstant="2026-09-24T10:00:05Z"><saml:Issuer>https://idp.test</saml:Issuer>'
    + (signature ? '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo>'
      + '<ds:SignatureMethod Algorithm="' + signature + '"/><ds:Reference URI="#_a1">'
      + '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/></ds:Reference></ds:SignedInfo></ds:Signature>' : '')
    + '<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">alice@app.test</saml:NameID>'
    + '<saml:SubjectConfirmation><saml:SubjectConfirmationData NotOnOrAfter="2026-09-24T10:05:05Z" Recipient="https://app.test/acs"/>'
    + '</saml:SubjectConfirmation></saml:Subject>'
    + '<saml:Conditions NotBefore="2026-09-24T09:59:35Z" NotOnOrAfter="2026-09-24T10:05:05Z"><saml:AudienceRestriction>'
    + '<saml:Audience>https://app.test/meta</saml:Audience></saml:AudienceRestriction></saml:Conditions>'
    + '<saml:AuthnStatement SessionIndex="_s1"/><saml:AttributeStatement>'
    + '<saml:Attribute Name="urn:oid:0.9.2342.19200300.100.1.3" FriendlyName="mail"><saml:AttributeValue>alice@app.test</saml:AttributeValue></saml:Attribute>'
    + '</saml:AttributeStatement></saml:Assertion>')
  + '</samlp:Response>';

/* Liaison Redirect : DEFLATE brut par node:zlib, base64, encodage d URL. */
const redirige = 'https://idp.test/sso?SAMLRequest=' + encodeURIComponent(b64(zlib.deflateRawSync(Buffer.from(DEMANDE))))
  + '&RelayState=r1&SigAlg=' + encodeURIComponent('http://www.w3.org/2000/09/xmldsig#rsa-sha1') + '&Signature=AAAA';
const trouveRedirect = trouverSaml({ url: redirige });
egal('liaison Redirect reconnue', trouveRedirect.liaison, 'HTTP-Redirect');
const lu = await decoderSaml(trouveRedirect, Date.parse('2026-09-24T10:00:01Z'));
egal('demande : element racine', lu.resume.racine, 'AuthnRequest');
egal('demande : emetteur', lu.resume.emetteur, 'https://app.test/meta');
egal('demande : retour', lu.resume.retour, 'https://app.test/acs');
verifier('demande : signee par la liaison Redirect', lu.faits.some(f => f.texte === FAITS_SAML.signeRedirect));
verifier('demande : SHA-1 signale', lu.faits.some(f => f.texte === FAITS_SAML.sha1));

const poste = sig => ({ url: 'https://app.test/acs', requestBody: { kind: 'formData',
  formData: { SAMLResponse: [b64(Buffer.from(REPONSE(sig)))], RelayState: ['r1'] } } });
const signee = await decoderSaml(trouverSaml(poste('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256')), Date.parse('2026-09-24T10:00:06Z'));
egal('reponse : liaison POST', trouverSaml(poste('x')).liaison, 'HTTP-POST');
egal('reponse : emetteur (celui de la reponse)', signee.resume.emetteur, 'https://idp.test');
egal('reponse : statut', signee.resume.statut, 'urn:oasis:names:tc:SAML:2.0:status:Success');
egal('reponse : sujet', signee.resume.nameId, 'alice@app.test');
egal('reponse : audience', signee.resume.audiences.join(), 'https://app.test/meta');
egal('reponse : attribut', signee.resume.attributs.join(), 'mail (urn:oid:0.9.2342.19200300.100.1.3)');
egal('reponse : la signature est dans l assertion, pas dans la reponse', signee.resume.signatures.join(), 'Assertion');
verifier('reponse : assertion signee dite comme telle', signee.faits.some(f => f.texte === FAITS_SAML.signeAssertion));
verifier('reponse : pas de SHA-1 invente', !signee.faits.some(f => f.texte === FAITS_SAML.sha1));
verifier('reponse : valable au moment de la capture', !signee.faits.some(f => f.texte === FAITS_SAML.expiree));

const tard = await decoderSaml(trouverSaml(poste('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256')), Date.parse('2026-09-24T11:00:00Z'));
verifier('capturee apres NotOnOrAfter : expiree', tard.faits.some(f => f.texte === FAITS_SAML.expiree));
const nue = await decoderSaml(trouverSaml(poste('')), Date.parse('2026-09-24T10:00:06Z'));
verifier('aucune signature : dit', nue.faits.some(f => f.texte === FAITS_SAML.aucuneSignature));
const chiffree = await decoderSaml(trouverSaml({ url: 'https://app.test/acs', requestBody: { kind: 'formData',
  formData: { SAMLResponse: [b64(Buffer.from(REPONSE('', true)))] } } }), 0);
verifier('assertion chiffree : dit', chiffree.faits.some(f => f.texte === FAITS_SAML.chiffree));
verifier('assertion chiffree : pas « aucune signature », on ne voit pas dedans',
  !chiffree.faits.some(f => f.texte === FAITS_SAML.aucuneSignature));

verifier('boite a outils : valeur Redirect encodee pour l URL',
  (await decoderSamlTexte(encodeURIComponent(b64(zlib.deflateRawSync(Buffer.from(DEMANDE)))))).includes('AuthnRequest'));
verifier('boite a outils : valeur POST', (await decoderSamlTexte(b64(Buffer.from(REPONSE(''))))).includes('Response'));
leve('un XML qui n est pas du SAML est refuse', () => lireSaml('<racine><x/></racine>'));
egal('une requete ordinaire n est pas du SAML', trouverSaml({ url: 'https://a.test/?q=1', requestBody: null }), null);

/* --- Ce que XML permet, et qu un decoupage naif lisait mal --- */
const ecrit = lireSaml('<?xml version="1.0"?><!-- <saml:Issuer>faux</saml:Issuer> -->'
  + '<samlp:Response ID="_x" Destination="https://app.test/acs?a=1>2">'
  + '<saml:Issuer><![CDATA[https://idp.test/<vrai>]]></saml:Issuer>'
  + '<saml:Subject><saml:NameID>b&amp;o</saml:NameID></saml:Subject></samlp:Response>');
egal('un « > » dans une valeur d attribut ne coupe pas la balise', ecrit.destination, 'https://app.test/acs?a=1>2');
egal('un commentaire n est pas lu comme un element', ecrit.emetteur, 'https://idp.test/<vrai>');
egal('entite dans le texte : decodee', ecrit.nameId, 'b&o');
const entites = lireSaml('<samlp:Response><saml:Issuer>&amp;#65; &#66; &#x43; &#99999999;</saml:Issuer></samlp:Response>');
egal('entites : une seule passe, et un point de code hors d Unicode reste ecrit', entites.emetteur, '&#65; B C &#99999999;');
leve('balise jamais fermee : refusee', () => lireSaml('<samlp:Response ID="_x'));

/* Une entree hostile ne fige pas l onglet : l ancien decoupage relisait tout
   le reste du texte a chaque « < » sans « > » — 2,5 s pour 110 Ko. */
const duree = texte => { const t0 = performance.now(); try { lireSaml(texte); } catch { /* attendu */ } return performance.now() - t0; };
for (const [nom, hostile] of [
  ['guillemet jamais ferme', '<samlp:Response>' + '<a b="x'.repeat(150000)],
  ['balises jamais fermees', '<samlp:Response>' + '<a '.repeat(300000)],
  ['nom d attribut sans valeur', '<samlp:Response ' + 'b'.repeat(900000) + '>'],
  ['commentaires jamais fermes', '<!--'.repeat(250000)]
]) {
  const ms = duree(hostile);
  verifier('entree hostile (' + nom + ', ' + Math.round(hostile.length / 1024) + ' Ko) : lue en moins de 250 ms',
    ms < 250, Math.round(ms) + ' ms');
}
leve('plus de 4 Mo : non lu', () => lireSaml('<samlp:Response>' + ' '.repeat(4 * 1024 * 1024) + '</samlp:Response>'));

/* Une bombe DEFLATE : quelques Ko qui se deplient en 16 Mo. */
const bombe = encodeURIComponent(b64(zlib.deflateRawSync(Buffer.alloc(16 * 1024 * 1024, 0x20))));
let refus = null;
try { await decoderSaml({ liaison: 'HTTP-Redirect', valeur: decodeURIComponent(bombe) }, 0); } catch (e) { refus = e; }
verifier('bombe DEFLATE : arretee au-dela de 4 Mo', !!refus && /4 Mo/.test(refus.message), refus && refus.message);
let refusOutil = null;
try { await decoderSamlTexte(bombe); } catch (e) { refusOutil = e; }
verifier('bombe DEFLATE dans la boite a outils : arretee aussi', !!refusOutil && /4 Mo/.test(refusOutil.message),
  refusOutil && refusOutil.message);

bilan('Outils de securite');
