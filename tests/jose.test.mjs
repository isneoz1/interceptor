/* Jetons JWT, jeux de cles et decouverte — SWIFT (by D4RK)
 *
 *   node tests/jose.test.mjs
 *
 * Ce que la 5.7 ajoute, verifie contre ses references (tests/vecteurs-jose.json,
 * extraits des textes et verifies a l extraction) :
 *
 *   1. RFC 7515, annexe A : HS256 (avec la cle en JWK « oct »), RS256, ES256 et
 *      ES512 se verifient, et plus une fois le jeton altere ; l exemple non
 *      signe (A.5) est dit non signe. RFC 8037 A.4 : EdDSA. RFC 9864 : un
 *      jeton « Ed25519 », et une cle d une autre courbe refusee. RFC 7515
 *      §4.1.1 : « hs256 » et « None » ne sont pas des algorithmes.
 *   2. RFC 7517, annexe A : le jeu public (A.1) et le jeu prive (A.2), ou les
 *      deux cles privees publiees sont signalees ; une cle symetrique publiee,
 *      une cle RSA trop courte (RFC 7518 §3.3), un kid en double (§4.5) ; le
 *      choix d une cle par kid, type, use, key_ops et alg.
 *   3. RFC 8037 A.3 : l empreinte RFC 7638 d une cle Ed25519.
 *   4. RFC 8414 §3.2 et OpenID Connect Discovery §4.2 : les exemples, lus a
 *      l adresse qui les designe ; un issuer qui ne correspond pas ; les deux
 *      formes d adresse d un emetteur a chemin ; https, membres exiges, PKCE.
 *   5. Le noyau et l interface : un jeton capture se verifie seul avec le jeu
 *      de cles capture, relie a son emetteur par son document de decouverte —
 *      onglet En-tetes, onglet Reponse et boite a outils, dans les deux langues.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { installerTout, installerPage, egal, verifier, bilan } from './harnais.mjs';

installerTout();
const ici = path.dirname(url.fileURLToPath(import.meta.url));
installerPage(path.resolve(ici, '..'));

let auBilan = false;
process.on('exit', () => {
  if (auBilan) return;
  console.log('  JOSE : suite interrompue avant son bilan');
  process.exitCode = 1;
});

const V = JSON.parse(fs.readFileSync(path.join(ici, 'vecteurs-jose.json'), 'utf8'));
const J = await import('../ui/lib/jwt.js');
const K = await import('../ui/lib/jwks.js');
const D = await import('../ui/lib/decouverte.js');
const { setLang } = await import('../ui/lib/i18n.js');
const texte = n => (n.textContent || '') + ' ' + (n.children || []).map(texte).join(' ');

const b64u = octets => Buffer.from(octets).toString('base64url');
async function signer(entete, charge, jwk, alg) {
  const donnees = b64u(Buffer.from(JSON.stringify(entete))) + '.' + b64u(Buffer.from(JSON.stringify(charge)));
  const algo = alg === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } : { name: 'Ed25519' };
  const cle = await crypto.subtle.importKey('jwk', jwk, algo, false, ['sign']);
  return donnees + '.' + b64u(new Uint8Array(await crypto.subtle.sign(algo.name, cle, Buffer.from(donnees))));
}
/* Un jeton altere : le premier caractere de la charge utile change. */
const altere = jws => jws.replace(/\.(.)/, (m, c) => '.' + (c === 'A' ? 'B' : 'A'));

/* ============== 1. RFC 7515 annexe A, RFC 8037, RFC 9864 ================= */
for (const [nom, v] of [['A.1 HS256', V.rfc7515.A1], ['A.2 RS256', V.rfc7515.A2], ['A.3 ES256', V.rfc7515.A3], ['A.4 ES512', V.rfc7515.A4]]) {
  const bon = await J.verifierJwt(v.jws, JSON.stringify(v.jwk));
  verifier('RFC 7515 ' + nom + ' : la signature se verifie', bon.valide === true, JSON.stringify(bon));
  const mauvais = await J.verifierJwt(altere(v.jws), JSON.stringify(v.jwk));
  verifier('RFC 7515 ' + nom + ' : alteree, elle ne se verifie plus', mauvais.valide === false, JSON.stringify(mauvais));
}
const nonSigne = await J.verifierJwt(V.rfc7515.A5.jws, '');
verifier('RFC 7515 A.5 : non signe, et dit tel', nonSigne.valide === false && nonSigne.algorithme === 'none', JSON.stringify(nonSigne));
const ed = await J.verifierJwt(V.rfc8037.A4.jws, JSON.stringify(V.rfc8037.A2.jwk));
verifier('RFC 8037 A.4 : EdDSA se verifie', ed.valide === true && ed.courbe === 'Ed25519', JSON.stringify(ed));
verifier('RFC 8037 A.4 : altere, non', (await J.verifierJwt(altere(V.rfc8037.A4.jws), JSON.stringify(V.rfc8037.A2.jwk))).valide === false);
const ed25519 = await signer({ alg: 'Ed25519' }, { sub: 'x' }, V.rfc8037.A1.jwk, 'Ed25519');
verifier('RFC 9864 : un jeton « Ed25519 » se verifie', (await J.verifierJwt(ed25519, JSON.stringify(V.rfc8037.A2.jwk))).valide === true);
const ed448 = ed25519.replace(/^[^.]+/, b64u(Buffer.from('{"alg":"Ed448"}')));
let refus = null;
try { await J.verifierJwt(ed448, JSON.stringify(V.rfc8037.A2.jwk)); } catch (e) { refus = e.message; }
verifier('RFC 9864 : une cle Ed25519 pour un jeton « Ed448 » est refusee, et dit pourquoi', /courbe Ed25519, le jeton annonce Ed448/.test(refus || ''), refus);
for (const [alg, proche] of [['hs256', 'HS256'], ['None', 'none'], ['Rs256', 'RS256']]) {
  const jeton = b64u(Buffer.from(JSON.stringify({ alg }))) + '.e30.c2ln';
  let message = null;
  try { await J.verifierJwt(jeton, 'secret'); } catch (e) { message = e.message; }
  verifier('RFC 7515 §4.1.1 : « ' + alg + ' » n est pas « ' + proche + ' »', (message || '').includes('la casse compte') && message.includes('« ' + proche + ' »'), message);
}

/* ========================= 2. RFC 7517 annexe A =========================== */
const pub = K.lireJwks(V.rfc7517.A1);
egal('RFC 7517 A.1 : deux cles', pub.cles.length, 2);
egal('RFC 7517 A.1 : leurs kid', pub.cles.map(c => c.kid).join(', '), '1, 2011-04-29');
egal('RFC 7517 A.1 : la cle RSA compte 2048 bits', pub.cles[1].bits, 2048);
egal('RFC 7517 A.1 : rien de grave', pub.faits.filter(f => f.grave).length, 0);
const prive = K.lireJwks(V.rfc7517.A2);
egal('RFC 7517 A.2 : les deux cles privees publiees sont signalees', prive.faits.filter(f => f.grave && /partie privee/.test(f.texte)).length, 2);
verifier('RFC 7517 A.2 : les membres prives ne sont pas gardes', !('d' in prive.cles[0].jwk) && !('p' in prive.cles[1].jwk) && 'n' in prive.cles[1].jwk);
verifier('une cle symetrique publiee est signalee', K.lireJwks({ keys: [V.rfc7515.A1.jwk] }).faits.some(f => f.grave && /symetrique/.test(f.texte)));
const courte = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 1024, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);
const jwkCourte = await crypto.subtle.exportKey('jwk', courte.publicKey);
const lueCourte = K.lireJwks({ keys: [jwkCourte] });
verifier('une cle RSA de 1024 bits est signalee (RFC 7518 §3.3)', lueCourte.cles[0].bits === 1024 && lueCourte.faits.some(f => f.grave && /2048 bits/.test(f.texte)));
const rsaA2 = { kty: 'RSA', n: V.rfc7515.A2.jwk.n, e: V.rfc7515.A2.jwk.e };
egal('un kid en double pour deux cles de meme type est signale', K.lireJwks({ keys: [{ ...rsaA2, kid: 'k' }, { ...pub.cles[1].jwk, kid: 'k' }] }).faits.filter(f => /kid/.test(f.texte)).length, 1);
egal('le meme kid pour deux types differents est admis (RFC 7517 §4.5)', K.lireJwks({ keys: [{ ...rsaA2, kid: 'k' }, { ...V.rfc8037.A2.jwk, kid: 'k' }] }).faits.length, 0);
for (const [nom, v] of [['un tableau', []], ['« keys » qui n est pas un tableau', { keys: 'x' }], ['une cle sans kty', { keys: [{ n: 'x' }] }], ['du texte', 'pas du JSON']]) {
  egal('pas un jeu de cles : ' + nom, K.lireJwks(v), null);
}
/* Choisir la cle : kid, type, use, key_ops, alg. */
const jetonKid = await signer({ alg: 'RS256', kid: 'k2' }, { iss: 'https://server.example.com', sub: 'alice' }, V.rfc7515.A2.jwk, 'RS256');
const enteteKid = J.enteteJwt(jetonKid);
const jeu = K.lireJwks({ keys: [{ ...pub.cles[1].jwk, kid: 'k1' }, { ...rsaA2, kid: 'k2' }, { ...V.rfc8037.A2.jwk, kid: 'k3' }] });
const choix = K.clesCandidates(jeu, enteteKid);
egal('le kid designe une seule cle', choix.retenues.map(c => c.kid).join(), 'k2');
const ok = await K.verifierAvecJeu(jetonKid, jeu, enteteKid);
verifier('la cle designee verifie le jeton', ok.valide && ok.cle.kid === 'k2');
const faux = await K.verifierAvecJeu(altere(jetonKid), jeu, enteteKid);
verifier('altere, la cle designee ne le verifie plus — et c est dit comme un essai', !faux.valide && faux.essais.length === 1);
for (const [nom, cle, raison] of [['use « enc »', { ...rsaA2, kid: 'k2', use: 'enc' }, 'use'],
  ['key_ops sans verify', { ...rsaA2, kid: 'k2', key_ops: ['encrypt'] }, 'key_ops'],
  ['alg PS256', { ...rsaA2, kid: 'k2', alg: 'PS256' }, 'alg'],
  ['une cle EC', { ...pub.cles[0].jwk, kid: 'k2' }, 'type']]) {
  const c = K.clesCandidates(K.lireJwks({ keys: [cle] }), enteteKid);
  verifier('cle ecartee : ' + nom, !c.retenues.length && c.ecartees[0].raison === raison, JSON.stringify(c.ecartees));
}
egal('un kid absent du jeu : aucune candidate', K.clesCandidates(K.lireJwks({ keys: [{ ...rsaA2, kid: 'autre' }] }), enteteKid).retenues.length, 0);
const sansKid = K.clesCandidates(K.lireJwks({ keys: [rsaA2, pub.cles[1].jwk] }), J.enteteJwt(V.rfc7515.A2.jws));
egal('sans kid : toutes les cles qui conviennent sont candidates', sansKid.retenues.length, 2);
verifier('sans kid : la bonne est trouvee parmi elles', (await K.verifierAvecJeu(V.rfc7515.A2.jws, K.lireJwks({ keys: [pub.cles[1].jwk, rsaA2] }), J.enteteJwt(V.rfc7515.A2.jws))).valide);

/* ============================ 3. RFC 7638 ================================= */
egal('RFC 8037 A.3 : l empreinte RFC 7638 de la cle Ed25519', await J.empreinteJwk(V.rfc8037.A2.jwk), V.rfc8037.A3.empreinte);

/* =================== 4. RFC 8414 et OpenID Connect Discovery ============== */
/* Les faits graves, avec leurs valeurs posees dans le gabarit. */
const graves = d => d.faits.filter(f => f.grave).map(f => f.texte.replace(/\{(\w+)\}/g, (m, k) => (k in f.valeurs ? String(f.valeurs[k]) : m)));
const d1 = D.lireDecouverte('https://server.example.com/.well-known/oauth-authorization-server', JSON.stringify(V.rfc8414.s32));
verifier('RFC 8414 §3.2 : l exemple est conforme a son adresse', d1 && d1.conforme && !d1.oidc, JSON.stringify(d1 && d1.faits));
egal('RFC 8414 §3.2 : rien de grave', graves(d1).length, 0);
verifier('RFC 8414 §3.2 : sans code_challenge_methods_supported, pas de PKCE annonce (§2)', d1.faits.some(f => /PKCE/.test(f.texte)));
const d2 = D.lireDecouverte('https://server.example.com/.well-known/openid-configuration', JSON.stringify(V.oidc.s42));
verifier('OpenID Connect Discovery §4.2 : l exemple est conforme', d2 && d2.conforme && d2.oidc);
egal('OpenID Connect Discovery §4.2 : rien de grave', graves(d2).join(' | '), '');
egal('§4.2 : le jeu de cles annonce', d2.champs.jwks_uri, 'https://server.example.com/jwks.json');
const ailleurs = D.lireDecouverte('https://evil.example/.well-known/openid-configuration', JSON.stringify(V.oidc.s42));
verifier('un document lu ailleurs que chez son emetteur ne doit pas etre utilise (§4.3, RFC 8414 §3.3)', !ailleurs.conforme && graves(ailleurs).some(t => /ne doit pas etre utilise/.test(t)));
const avecChemin = { ...V.oidc.s42, issuer: 'https://example.com/issuer1' };
for (const [adresse, attendu] of [
  ['https://example.com/.well-known/oauth-authorization-server/issuer1', true],
  ['https://example.com/issuer1/.well-known/openid-configuration', true],
  ['https://example.com/.well-known/openid-configuration/issuer1', true],
  ['https://example.com/.well-known/openid-configuration', false],
  ['https://example.com/issuer2/.well-known/openid-configuration', false]]) {
  egal('emetteur a chemin, ' + adresse, D.lireDecouverte(adresse, JSON.stringify(avecChemin)).conforme, attendu);
}
egal('un « / » final de l emetteur est admis', D.lireDecouverte('https://example.com/.well-known/openid-configuration', JSON.stringify({ ...V.oidc.s42, issuer: 'https://example.com/' })).conforme, true);
for (const [nom, doc, motif] of [
  ['issuer en http', { ...V.oidc.s42, issuer: 'http://server.example.com' }, /https sans requete/],
  ['issuer avec une requete', { ...V.oidc.s42, issuer: 'https://server.example.com?x=1' }, /https sans requete/],
  ['jwks_uri en http', { ...V.oidc.s42, jwks_uri: 'http://server.example.com/jwks.json' }, /jwks_uri .* https/],
  ['sans jwks_uri', (({ jwks_uri, ...reste }) => reste)(V.oidc.s42), /jwks_uri absent/],
  ['sans RS256', { ...V.oidc.s42, id_token_signing_alg_values_supported: ['ES256'] }, /RS256/],
  ['PKCE sans S256', { ...V.oidc.s42, code_challenge_methods_supported: ['plain'] }, /S256/]]) {
  const lu = D.lireDecouverte('https://server.example.com/.well-known/openid-configuration', JSON.stringify(doc));
  verifier('decouverte : ' + nom + ' est signale', graves(lu).some(t => motif.test(t)), graves(lu).join(' | '));
}
verifier('« none » parmi les algorithmes des jetons d identite est dit, sans gravite', D.lireDecouverte('https://server.example.com/.well-known/openid-configuration',
  JSON.stringify({ ...V.oidc.s42, id_token_signing_alg_values_supported: ['RS256', 'none'] })).faits.some(f => !f.grave && /none/.test(f.texte)));
egal('une adresse qui n est pas de decouverte', D.lireDecouverte('https://server.example.com/config.json', JSON.stringify(V.oidc.s42)), null);

/* ===================== 5. Le noyau et l interface ======================== */
const { store } = await import('../background/core/store.js');
const { clesJose } = await import('../background/core/jose-liens.js');
const { state } = await import('../ui/app.js');
const decouverte = store.create({ url: 'https://server.example.com/.well-known/openid-configuration', method: 'GET', type: 'xmlhttprequest' });
decouverte.responseBody = { kind: 'text', size: 2000, text: JSON.stringify(V.oidc.s42) };
const jwks = store.create({ url: 'https://server.example.com/jwks.json', method: 'GET', type: 'xmlhttprequest' });
jwks.responseBody = { kind: 'text', size: 2000, text: JSON.stringify({ keys: [{ ...pub.cles[1].jwk, kid: 'k1' }, { ...V.rfc7515.A2.jwk, kid: 'k2' }] }) };
const trouve = clesJose({ iss: 'https://server.example.com' });
verifier('noyau : le document de decouverte de l emetteur est trouve', trouve.decouverte && trouve.decouverte.jwksUri === 'https://server.example.com/jwks.json');
verifier('noyau : son jeu de cles aussi, relie a lui', trouve.jeux.length === 1 && trouve.jeux[0].deLEmetteur === true);
verifier('noyau : un membre prive publie ne sort pas du noyau', !('d' in trouve.jeux[0].keys[1]) && 'n' in trouve.jeux[0].keys[1]);

/* L interface parle au noyau par cmd : ici, directement a sa fonction. */
const envoiReel = globalThis.browser.runtime.sendMessage;
globalThis.browser.runtime.sendMessage = async m => (m && m.cmd === 'clesJose' ? clesJose(m.args) : envoiReel(m));
const jose = await import('../ui/console/jose-detail.js');
const v = await jose.verdictJeton(jetonKid, enteteKid, { iss: 'https://server.example.com' });
verifier('verdict : verifie avec la cle de l emetteur', v.etat === 'valide' && v.jeu.deLEmetteur && v.cle.kid === 'k2', JSON.stringify(v.etat));
egal('verdict : altere, la signature est fausse', (await jose.verdictJeton(altere(jetonKid), enteteKid, { iss: 'https://server.example.com' })).etat, 'invalide');
egal('verdict : non signe', (await jose.verdictJeton(V.rfc7515.A5.jws, { alg: 'none' }, {})).etat, 'nonSigne');
egal('verdict : HS256 sans jeu de cles, le secret reste au serveur', (await jose.verdictJeton(V.rfc7515.A1.jws, { alg: 'HS256' }, { iss: 'joe' })).etat, 'secret');
const autreEmetteur = await jose.verdictJeton(jetonKid, enteteKid, { iss: 'https://ailleurs.example' });
verifier('verdict : un jeu capture qui n est pas relie a l emetteur est dit tel', autreEmetteur.etat === 'valide' && !autreEmetteur.jeu.deLEmetteur);
egal('verdict : « hs256 » n est pas un algorithme', (await jose.verdictJeton(jetonKid, { alg: 'hs256' }, {})).etat, 'algorithme');
/* Une cle d un jeu qui n est pas celui de l emetteur ne prouve rien contre
   le jeton : son echec n est pas une signature fausse. */
const sansLien = await jose.verdictJeton(altere(jetonKid), enteteKid, { iss: 'https://ailleurs.example' });
verifier('verdict : l echec d une cle d un autre emetteur ne condamne pas le jeton', sansLien.etat !== 'invalide', sansLien.etat);
egal('un jeton suivi d un point, dans un texte, est trouve', jose.jetonsDe({ url: 'https://x.example/', responseBody: { text: 'jeton : ' + jetonKid + '.' } }).length, 1);
/* Un noyau qui repond sans la forme attendue : une capture sans cles, pas
   une exception affichee comme un nom d algorithme. */
globalThis.browser.runtime.sendMessage = async () => ({});
egal('verdict : une reponse du noyau sans jeux vaut une capture sans cles', (await jose.verdictJeton(jetonKid, enteteKid, { iss: 'https://muet.example' })).etat, 'sansCles');
globalThis.browser.runtime.sendMessage = async m => (m && m.cmd === 'clesJose' ? clesJose(m.args) : envoiReel(m));

const requete = store.create({ url: 'https://api.example.com/moi', method: 'GET', type: 'xmlhttprequest' });
requete.requestHeaders = [{ name: 'Authorization', value: 'Bearer ' + jetonKid }, { name: 'Cookie', value: 'session=' + V.rfc7515.A1.jws + '; autre=1' }];
requete.startTime = Date.now();
egal('les jetons d une requete, et ou ils sont', jose.jetonsDe(requete).map(j => j.ou.texte).join(' | '), 'l entete « {nom} » | le cookie « {nom} »');
const jwe = 'eyJhbGciOiJSU0EtT0FFUCIsImVuYyI6IkEyNTZHQ00ifQ.OKOawDo13gRp2ojaHV7LFpZcgV7T6DVZKTyKOMTYUmKoTCVJRgckCL9kiMT03JGeipsEdY3mx_etLbbWSrFr05kLzcSr4qKAq7YN7e9jwQRb23nfa6c9d-StnImGyFDbSv04uVuxIp5Zms1gNxKKK2Da14B8S4rzVRltdYwam_lDp5XnZAYpQdb76FdIKLaVmqgfwX7XWRxv2322i-vDxRfqNzo_tETKzpVLzfiwQyeyPGLBIO56YJ7eObdv0je81860ppamavo35UgoRdbYaBcoh9QcfylQr66oc6vFWXRcZ_ZT2LawVCWTIy3brGPi6UklfCpIMfIjf7iGdXKHzg.48V1_ALb6US04U3b.5eym8TW_c8SuK0ltJ3rpYIzOeDQz7TALvtu6UG9oMo4vpzs9tX_EFShS8iB7j6jiSdiwkIr3ajwQzaBtQD_A.XFBoMYUZodetZdvTiFvSkQ';
egal('un jeton chiffre (JWE) n est pas pris pour un JWT signe', jose.jetonsDe({ ...requete, requestHeaders: [{ name: 'Authorization', value: 'Bearer ' + jwe }] }).length, 0);

state.records = new Map([[decouverte.id, { id: decouverte.id, url: decouverte.url }], [jwks.id, { id: jwks.id, url: jwks.url }]]);
for (const langue of ['fr', 'en']) {
  setLang(langue);
  const boite = document.createElement('div');
  boite.appendChild(jose.jetonsJwt(requete));
  await new Promise(r => setTimeout(r, 50));
  const vu = texte(boite);
  verifier('onglet En-tetes [' + langue + '] : deux jetons, leur emplacement', vu.includes(langue === 'en' ? 'JWT 2' : 'Jeton JWT 2') && vu.includes('Authorization'));
  verifier('onglet En-tetes [' + langue + '] : verifie avec la cle de l emetteur', vu.includes(langue === 'en' ? 'Signature verified with the key « k2 » that the issuer https://server.example.com publishes' : 'Signature verifiee avec la cle « k2 » que l emetteur https://server.example.com publie'), vu.slice(0, 600));
  verifier('onglet En-tetes [' + langue + '] : le HMAC dit pourquoi il n est pas verifie', vu.includes(langue === 'en' ? 'only the server holds the secret' : 'seul le serveur detient le secret'));
  const r1 = document.createElement('div');
  r1.appendChild(jose.jwksReponse({ ...jwks, responseBody: { kind: 'text', text: JSON.stringify(V.rfc7517.A2) } }));
  const vj = texte(r1);
  verifier('onglet Reponse [' + langue + '] : le jeu de cles et ses cles privees publiees', vj.includes('RFC 7517') && vj.includes(langue === 'en' ? 'publishes its private part' : 'publie sa partie privee') && vj.includes('2011-04-29'));
  const r2 = document.createElement('div');
  r2.appendChild(jose.decouverteReponse(decouverte));
  const vd = texte(r2);
  verifier('onglet Reponse [' + langue + '] : la decouverte, conforme, avec son jeu de cles a ouvrir', vd.includes('https://server.example.com/jwks.json') && vd.includes(langue === 'en' ? 'issuer conforms' : 'issuer conforme') && vd.includes(langue === 'en' ? 'Open the captured key set' : 'Ouvrir le jeu de cles capture'));
  const { panneauJwt } = await import('../ui/console/tools-panels.js');
  const etat = { cleJwt: JSON.stringify({ keys: [{ ...rsaA2, kid: 'k2' }] }), jwtVerdict: null };
  const p = document.createElement('div');
  p.appendChild(panneauJwt(jetonKid, etat, () => {}));
  verifier('boite a outils [' + langue + '] : le champ de cle accepte un jeu de cles', texte(p).includes('JWKS'));
}
setLang('fr');
globalThis.browser.runtime.sendMessage = envoiReel;

auBilan = true;
bilan('JWT, jeux de cles et decouverte');
