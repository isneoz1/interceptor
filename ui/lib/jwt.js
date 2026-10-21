/* Verification de signature JWT — SWIFT (by NeoZ)
 *
 * Un jeton decode n est pas un jeton valide : tant que la signature n est pas
 * verifiee, la charge utile n est qu un texte que n importe qui a pu ecrire.
 * Ce module verifie reellement, quand on lui donne la cle :
 *
 *   HS256 / HS384 / HS512   cle partagee (le secret du serveur, en texte ou en
 *                           JWK « oct », RFC 7518 §6.4)
 *   RS256 / RS384 / RS512   cle publique RSA (PEM, JWK ou certificat)
 *   PS256 / PS384 / PS512   cle publique RSA-PSS (PEM, JWK ou certificat)
 *   ES256 / ES384 / ES512   cle publique sur courbe elliptique (PEM, JWK…)
 *   EdDSA                   courbe d Edwards (RFC 8037) : Ed25519, ou Ed448 si
 *                           le navigateur le connait
 *   Ed25519 / Ed448         les memes, nommes sans ambiguite (RFC 9864)
 *
 * Tout passe par crypto.subtle : aucune verification n est reimplementee ici,
 * donc aucun verdict approximatif. Sans cle, la fonction le dit plutot que de
 * laisser croire a une validite.
 */
import { texteVersOctets, base64VersOctets } from './bytes.js';
import { sujetCrypto as sujet, importerClePublique as importerPublique } from './cles-publiques.js';

const HACHAGE = { 256: 'SHA-256', 384: 'SHA-384', 512: 'SHA-512' };
const COURBES = { 256: 'P-256', 384: 'P-384', 512: 'P-521' };   // ES512 emploie bien P-521

/** Les algorithmes verifiables, tels qu ils s ecrivent dans « alg ». */
export const ALGORITHMES_JWT = [
  'HS256', 'HS384', 'HS512',
  'RS256', 'RS384', 'RS512',
  'PS256', 'PS384', 'PS512',
  'ES256', 'ES384', 'ES512',
  'EdDSA', 'Ed25519', 'Ed448'
];
export const ALGORITHMES_EDWARDS = ['EdDSA', 'Ed25519', 'Ed448'];

/** Decoupe « entete.charge.signature » sans rien interpreter. */
function parties(jeton) {
  const brut = String(jeton || '').trim().replace(/^Bearer\s+/i, '');
  const p = brut.split('.');
  if (p.length !== 3) throw new Error('un JWT compte trois parties separees par des points');
  return p;
}

/** L entete d un jeton, lu ; leve une erreur s il ne se lit pas. */
export function enteteJwt(jeton) {
  try { return JSON.parse(new TextDecoder().decode(base64VersOctets(parties(jeton)[0]))); }
  catch (e) {
    if (/trois parties/.test(e.message)) throw e;
    throw new Error('entete illisible');
  }
}

/* « alg » se compare a la lettre : la casse compte (RFC 7515 §4.1.1). Un
   « hs256 » ou un « None » n est pas un algorithme enregistre — un serveur
   conforme refuse le jeton ; certaines bibliotheques l ont accepte. */
function algorithmeLu(entete) {
  const alg = typeof (entete && entete.alg) === 'string' ? entete.alg : '';
  if (alg === 'none' || ALGORITHMES_JWT.includes(alg)) return alg;
  const proche = ['none', ...ALGORITHMES_JWT].find(a => a.toLowerCase() === alg.toLowerCase());
  if (proche) throw new Error('algorithme « ' + alg + ' » inconnu : la casse compte, et ce n est pas « ' + proche + ' » (RFC 7515 §4.1.1)');
  throw new Error('algorithme non verifiable ici : ' + (alg || 'absent'));
}

/* Le secret d un HMAC : une JWK « oct » donne ses octets (k, en base64url),
   tout autre texte se prend tel quel. */
function secretHmac(cle) {
  const brut = String(cle || '').trim();
  if (brut.startsWith('{')) {
    let jwk = null;
    try { jwk = JSON.parse(brut); } catch { jwk = null; }
    if (jwk && jwk.kty === 'oct' && typeof jwk.k === 'string') return base64VersOctets(jwk.k);
  }
  return texteVersOctets(brut);
}

/* La courbe d Edwards a employer : nommee par l algorithme (RFC 9864), par la
   cle JWK (« crv », RFC 8037 §2), ou, pour EdDSA avec une cle PEM, les deux
   essayees. */
function courbesEdwards(alg, cle) {
  let crv = null;
  try {
    const jwk = JSON.parse(String(cle));
    if (jwk && typeof jwk.crv === 'string') crv = jwk.crv;
  } catch { /* pas une JWK */ }
  if (alg !== 'EdDSA') {
    if (crv && crv !== alg) throw new Error('la cle est sur la courbe ' + crv + ', le jeton annonce ' + alg + ' (RFC 9864)');
    return [alg];
  }
  return crv === 'Ed25519' || crv === 'Ed448' ? [crv] : ['Ed25519', 'Ed448'];
}

async function verifierEdwards(alg, cle, signature, signe) {
  let nonPrise = null;
  let derniere = null;
  for (const courbe of courbesEdwards(alg, cle)) {
    let importee;
    try { importee = await importerPublique(cle, { name: courbe }); }
    catch (e) {
      if (e && e.name === 'NotSupportedError') nonPrise = courbe;
      derniere = e;
      continue;
    }
    const valide = await sujet().verify({ name: courbe }, importee, signature, signe);
    return { valide, algorithme: alg, methode: 'cle publique sur courbe d Edwards', courbe };
  }
  if (nonPrise) throw new Error('ce navigateur ne sait pas verifier ' + nonPrise + ' (Web Crypto)');
  throw derniere || new Error('cle publique Ed25519 ou Ed448 attendue');
}

/**
 * Verifie la signature d un jeton. Rend toujours un verdict explicite :
 * { valide, algorithme, methode } ou { valide:false, erreur }.
 */
export async function verifierJwt(jeton, cle) {
  const [entete64, charge64, signature64] = parties(jeton);
  const alg = algorithmeLu(enteteJwt(jeton));
  if (alg === 'none') {
    return { valide: false, algorithme: 'none', methode: 'aucune',
      erreur: 'algorithme « none » : ce jeton n est pas signe du tout' };
  }

  const signe = texteVersOctets(entete64 + '.' + charge64);
  const signature = base64VersOctets(signature64);

  if (ALGORITHMES_EDWARDS.includes(alg)) return verifierEdwards(alg, cle, signature, signe);

  const taille = Number(alg.slice(2));
  const hash = HACHAGE[taille];

  if (alg.startsWith('HS')) {
    const importee = await sujet().importKey('raw', secretHmac(cle), { name: 'HMAC', hash }, false, ['verify']);
    const valide = await sujet().verify('HMAC', importee, signature, signe);
    return { valide, algorithme: alg, methode: 'cle partagee (HMAC)' };
  }

  if (alg.startsWith('RS')) {
    const importee = await importerPublique(cle, { name: 'RSASSA-PKCS1-v1_5', hash });
    const valide = await sujet().verify('RSASSA-PKCS1-v1_5', importee, signature, signe);
    return { valide, algorithme: alg, methode: 'cle publique RSA' };
  }

  if (alg.startsWith('PS')) {
    const importee = await importerPublique(cle, { name: 'RSA-PSS', hash });
    // Le sel a la taille de l empreinte : c est ce que le RFC 7518 impose.
    const valide = await sujet().verify(
      { name: 'RSA-PSS', saltLength: taille / 8 }, importee, signature, signe
    );
    return { valide, algorithme: alg, methode: 'cle publique RSA-PSS' };
  }

  const namedCurve = COURBES[taille];
  const importee = await importerPublique(cle, { name: 'ECDSA', namedCurve });
  const valide = await sujet().verify({ name: 'ECDSA', hash }, importee, signature, signe);
  return { valide, algorithme: alg, methode: 'cle publique sur courbe elliptique', courbe: namedCurve };
}

/** Ce qu il faut fournir pour verifier un jeton, avant meme d avoir la cle. */
export function cleAttendue(algorithme) {
  const alg = String(algorithme || '');
  if (/^HS(256|384|512)$/.test(alg)) return 'la cle partagee du serveur, telle quelle ou en JWK « oct »';
  if (/^(RS|PS)(256|384|512)$/.test(alg)) return 'la cle publique RSA, en PEM, en JWK ou par son certificat — ou le jeu de cles (JWKS) de l emetteur';
  if (/^ES(256|384|512)$/.test(alg)) return 'la cle publique de la courbe, en PEM, en JWK ou par son certificat — ou le jeu de cles (JWKS) de l emetteur';
  if (ALGORITHMES_EDWARDS.includes(alg)) return 'la cle publique Ed25519 ou Ed448, en PEM ou en JWK — ou le jeu de cles (JWKS) de l emetteur';
  if (alg === 'none') return 'aucune : ce jeton n est pas signe';
  return 'algorithme non verifiable par une extension';
}

/* -------------------- Empreinte de cle JWK (RFC 7638) --------------------- */
/* Deux JWK qui designent la meme cle peuvent s ecrire differemment : ordre des
 * membres, champs facultatifs presents ou non. L empreinte les ramene a une
 * valeur unique, en ne retenant que les membres requis, tries, sans espace.
 * C est ce qui permet de dire « ce jeton a bien ete signe par cette cle-la ».
 */

/* Membres requis par type de cle, dans l ordre lexicographique impose. */
const MEMBRES_REQUIS = Object.assign(Object.create(null), {
  EC: ['crv', 'kty', 'x', 'y'],
  RSA: ['e', 'kty', 'n'],
  oct: ['k', 'kty'],
  OKP: ['crv', 'kty', 'x']
});

/** La forme canonique d une JWK, telle que la RFC 7638 la definit. */
export function jwkCanonique(cle) {
  const objet = typeof cle === 'string' ? JSON.parse(cle) : cle;
  const type = objet && objet.kty;
  const requis = MEMBRES_REQUIS[type];
  if (!requis) throw new Error('type de cle inconnu ou absent (kty) : ' + String(type));
  const retenus = {};
  for (const membre of requis) {
    if (objet[membre] === undefined) throw new Error('membre requis absent pour ' + type + ' : ' + membre);
    retenus[membre] = objet[membre];
  }
  // JSON.stringify conserve l ordre d insertion : les membres sont deja tries.
  return JSON.stringify(retenus);
}

/**
 * Empreinte d une JWK : SHA-256 de la forme canonique, en base64url.
 * @param algorithme  'SHA-256' par defaut, comme dans la RFC.
 */
export async function empreinteJwk(cle, algorithme = 'SHA-256') {
  const canonique = jwkCanonique(cle);
  const condense = await crypto.subtle.digest(algorithme, new TextEncoder().encode(canonique));
  let binaire = '';
  for (const octet of new Uint8Array(condense)) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
