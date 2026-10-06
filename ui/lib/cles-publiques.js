/* Import d une cle publique collee — SWIFT (by NeoZ)
 *
 * Une seule porte d entree pour toutes les verifications (JWT, signature
 * detachee, signatures de messages HTTP) : une cle se colle comme on la
 * trouve, et chaque outil l accepte de la meme facon.
 *
 *   PEM « PUBLIC KEY »       SubjectPublicKeyInfo, tel quel
 *   PEM « RSA PUBLIC KEY »   PKCS #1 (RFC 8017, A.1.1), enveloppe ici dans un
 *                            SubjectPublicKeyInfo — crypto.subtle ne le lit pas
 *                            autrement
 *   PEM « CERTIFICATE »      la cle publique du certificat (le premier, pour
 *                            une chaine collee en entier)
 *   base64 nu                d une cle SPKI ou d un certificat
 *   JWK                      y compris une paire complete : on n en garde que la
 *                            partie publique, la seule utile pour verifier
 *
 * Une cle privee en PEM est refusee : la coller ici n apporte rien, et le dire
 * evite de la laisser trainer dans un champ.
 */
import { base64VersOctets } from './bytes.js';
import { lireDer } from './asn1.js';

export function sujetCrypto() {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error('crypto.subtle indisponible dans ce contexte');
  return s;
}

/** Une cle collee arrive en PEM, en JWK, ou brute (secret partage). */
export function formeDeCle(cle) {
  const brut = String(cle || '').trim();
  if (!brut) throw new Error('cle vide');
  if (brut.includes('-----BEGIN')) return 'pem';
  if (brut.startsWith('{')) return 'jwk';
  return 'brute';
}

/* Longueur DER (X.690, 8.1.3) : courte sous 128, longue au-dela. */
function longueurDer(n) {
  if (n < 0x80) return [n];
  const octets = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) octets.unshift(v & 0xff);
  return [0x80 | octets.length, ...octets];
}

function tlv(etiquette, contenu) {
  return Uint8Array.from([etiquette, ...longueurDer(contenu.length), ...contenu]);
}

/* AlgorithmIdentifier de rsaEncryption (1.2.840.113549.1.1.1), parametre NULL. */
const RSA_ENCRYPTION = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];

/** PKCS #1 RSAPublicKey -> SubjectPublicKeyInfo (RFC 5280, 4.1). */
export function pkcs1VersSpki(pkcs1) {
  const chaine = tlv(0x03, [0x00, ...pkcs1]);        // BIT STRING, aucun bit inutilise
  return tlv(0x30, [...RSA_ENCRYPTION, ...chaine]);
}

/**
 * La cle publique d un certificat X.509 : son SubjectPublicKeyInfo, septieme
 * champ de tbsCertificate quand la version est presente (RFC 5280, 4.1).
 */
export function spkiDuCertificat(der) {
  const [certificat] = lireDer(der);
  const champs = certificat && certificat.enfants && certificat.enfants.length === 3
    && certificat.enfants[0].enfants;
  if (!champs) throw new Error('certificat X.509 illisible');
  const spki = champs[(champs[0].type === '[0]' ? 1 : 0) + 5];
  if (!spki || spki.type !== 'SEQUENCE' || !spki.enfants || spki.enfants.length !== 2) {
    throw new Error('certificat X.509 sans cle publique lisible');
  }
  return tlv(0x30, [...spki.contenu]);
}

/** PEM -> { der, genre } ; refuse une cle privee. */
export function lirePem(pem) {
  const texte = String(pem);
  const entete = /-----BEGIN ([A-Z0-9 ]+)-----/.exec(texte);
  if (!entete) throw new Error('bloc PEM sans ligne BEGIN');
  const genre = entete[1];
  if (/PRIVATE KEY/.test(genre)) throw new Error('cle privee fournie : la verification demande la cle publique');
  /* Le premier bloc seulement : une chaine de certificats collee en entier
     commence par celui du serveur. */
  const fin = texte.indexOf('-----END', entete.index);
  const corps = texte.slice(entete.index + entete[0].length, fin < 0 ? undefined : fin).replace(/\s+/g, '');
  if (!corps) throw new Error('bloc PEM vide');
  const der = base64VersOctets(corps);
  if (genre === 'RSA PUBLIC KEY') return { der: pkcs1VersSpki(der), genre };
  if (genre === 'PUBLIC KEY') return { der, genre };
  if (genre === 'CERTIFICATE') return { der: spkiDuCertificat(der), genre };
  throw new Error('bloc PEM « ' + genre + ' » : une cle publique ou un certificat est attendu');
}

/* Les membres prives d une JWK (RFC 7518, 6.2.2 et 6.3.2 ; RFC 8037, 2). */
const MEMBRES_PRIVES = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'];

/** La partie publique d une JWK, sans restriction d usage qui bloquerait la verification. */
export function jwkPublique(jwk) {
  if (!jwk || typeof jwk !== 'object') throw new Error('JWK illisible');
  if (jwk.kty === 'oct') throw new Error('JWK symetrique (oct) : c est un secret partage, pas une cle publique');
  const publique = {};
  for (const [cle, valeur] of Object.entries(jwk)) {
    if (MEMBRES_PRIVES.includes(cle) || cle === 'key_ops' || cle === 'ext' || cle === 'use') continue;
    publique[cle] = valeur;
  }
  return publique;
}

/**
 * Importe une cle publique pour verifier.
 * @param parametres  l algorithme au sens de crypto.subtle.importKey
 */
export async function importerClePublique(cle, parametres) {
  const forme = formeDeCle(cle);
  if (forme === 'jwk') {
    let jwk;
    try { jwk = JSON.parse(cle); } catch { throw new Error('JWK illisible'); }
    const publique = jwkPublique(jwk);
    /* Le membre « alg » d une JWK doit concorder avec l algorithme demande ;
       il ne dit rien de plus que ce qu on demande deja. */
    delete publique.alg;
    return sujetCrypto().importKey('jwk', publique, parametres, false, ['verify']);
  }
  if (forme === 'pem') {
    return sujetCrypto().importKey('spki', lirePem(cle).der, parametres, false, ['verify']);
  }
  /* Sans encadrement : une cle ou un certificat en base64 nu, tel qu on le
     copie depuis un fichier de configuration. Un DER commence par une SEQUENCE. */
  let der = null;
  try { der = base64VersOctets(String(cle).replace(/\s+/g, '')); } catch { der = null; }
  if (der && der[0] === 0x30) {
    let spki = der;
    try { spki = spkiDuCertificat(der); } catch { /* pas un certificat : une cle SPKI */ }
    return sujetCrypto().importKey('spki', spki, parametres, false, ['verify']);
  }
  throw new Error('cle publique attendue : PEM, JWK, certificat, ou base64 d une cle SPKI');
}
