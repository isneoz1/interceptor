/* Verification de signature JWT — INTERCEPTOR (by D4RK)
 *
 * Un jeton decode n est pas un jeton valide : tant que la signature n est pas
 * verifiee, la charge utile n est qu un texte que n importe qui a pu ecrire.
 * Ce module verifie reellement, quand on lui donne la cle :
 *
 *   HS256 / HS384 / HS512   cle partagee (le secret du serveur)
 *   RS256 / RS384 / RS512   cle publique RSA (PEM ou JWK)
 *   PS256 / PS384 / PS512   cle publique RSA-PSS (PEM ou JWK)
 *   ES256 / ES384 / ES512   cle publique sur courbe elliptique (PEM ou JWK)
 *
 * Tout passe par crypto.subtle : aucune verification n est reimplementee ici,
 * donc aucun verdict approximatif. Sans cle, la fonction le dit plutot que de
 * laisser croire a une validite.
 */
import { texteVersOctets, base64VersOctets } from './bytes.js';

const HACHAGE = { 256: 'SHA-256', 384: 'SHA-384', 512: 'SHA-512' };
const COURBES = { 256: 'P-256', 384: 'P-384', 512: 'P-521' };   // ES512 emploie bien P-521

/** Familles reconnues, telles qu elles apparaissent dans l entete « alg ». */
export const ALGORITHMES_JWT = [
  'HS256', 'HS384', 'HS512',
  'RS256', 'RS384', 'RS512',
  'PS256', 'PS384', 'PS512',
  'ES256', 'ES384', 'ES512'
];

function sujet() {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error('crypto.subtle indisponible dans ce contexte');
  return s;
}

/** Decoupe « entete.charge.signature » sans rien interpreter. */
function parties(jeton) {
  const brut = String(jeton || '').trim().replace(/^Bearer\s+/i, '');
  const p = brut.split('.');
  if (p.length !== 3) throw new Error('un JWT compte trois parties separees par des points');
  return p;
}

/** Une cle collee arrive en PEM, en JWK, ou en secret partage. */
function formeDeCle(cle) {
  const brut = String(cle || '').trim();
  if (!brut) throw new Error('cle vide');
  if (brut.includes('-----BEGIN')) return 'pem';
  if (brut.startsWith('{')) return 'jwk';
  return 'brute';
}

/** PEM -> octets DER : on retire les lignes d encadrement et on decode. */
function pemVersDer(pem) {
  const corps = String(pem)
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/[\s\r\n]+/g, '');
  if (!corps) throw new Error('bloc PEM vide');
  if (/PRIVATE KEY/.test(pem)) throw new Error('cle privee fournie : la verification demande la cle publique');
  return base64VersOctets(corps);
}

async function importerPublique(cle, parametres, usages = ['verify']) {
  const forme = formeDeCle(cle);
  if (forme === 'jwk') {
    let jwk;
    try { jwk = JSON.parse(cle); }
    catch { throw new Error('JWK illisible'); }
    return sujet().importKey('jwk', jwk, parametres, false, usages);
  }
  if (forme === 'pem') {
    return sujet().importKey('spki', pemVersDer(cle), parametres, false, usages);
  }
  throw new Error('cle publique attendue au format PEM ou JWK');
}

/**
 * Verifie la signature d un jeton. Rend toujours un verdict explicite :
 * { valide, algorithme, methode } ou { valide:false, erreur }.
 */
export async function verifierJwt(jeton, cle) {
  const [entete64, charge64, signature64] = parties(jeton);

  let entete;
  try { entete = JSON.parse(new TextDecoder().decode(base64VersOctets(entete64))); }
  catch { throw new Error('entete illisible'); }

  const alg = String((entete && entete.alg) || '').toUpperCase();
  if (alg === 'NONE') {
    return { valide: false, algorithme: 'none', methode: 'aucune',
      erreur: 'algorithme « none » : ce jeton n est pas signe du tout' };
  }
  if (!ALGORITHMES_JWT.includes(alg)) {
    throw new Error('algorithme non verifiable ici : ' + (alg || 'absent'));
  }

  const taille = Number(alg.slice(2));
  const hash = HACHAGE[taille];
  const signe = texteVersOctets(entete64 + '.' + charge64);
  const signature = base64VersOctets(signature64);

  if (alg.startsWith('HS')) {
    const importee = await sujet().importKey(
      'raw', texteVersOctets(cle), { name: 'HMAC', hash }, false, ['verify']
    );
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
  const alg = String(algorithme || '').toUpperCase();
  if (alg.startsWith('HS')) return 'la cle partagee du serveur, telle quelle';
  if (alg.startsWith('RS') || alg.startsWith('PS')) return 'la cle publique RSA, en PEM ou en JWK';
  if (alg.startsWith('ES')) return 'la cle publique de la courbe, en PEM ou en JWK';
  if (alg.toLowerCase() === 'none') return 'aucune : ce jeton n est pas signe';
  return 'algorithme non verifiable par une extension';
}
