/* Une cle publique sous toutes ses formes — SWIFT (by D4RK)
 *
 * La meme cle s ecrit en PEM (SubjectPublicKeyInfo, RFC 5280 §4.1 ; PKCS #1,
 * RFC 8017 A.1.1), en JWK (RFC 7517), dans un certificat, ou en ligne
 * OpenSSH (RFC 4253 §6.6, RFC 5656 §3.1, RFC 8709 §4) — et se designe par
 * des empreintes qui ne se ressemblent pas : l epingle « pin-sha256 »
 * (RFC 7469 §2.4), l empreinte JWK (RFC 7638), celles d OpenSSH (« SHA256: »
 * et l ancienne en MD5), l identifiant de cle d un certificat (RFC 5280
 * §4.2.1.2, methode 1). Ce module lit une cle sous n importe laquelle de ces
 * formes et les rend toutes : de quoi dire si deux cles vues a deux endroits
 * sont la meme.
 *
 * Il ne lit que des cles PUBLIQUES : une cle privee collee est refusee.
 */
import { base64VersOctets, octetsVersBase64, octetsVersHex, texteVersOctets } from './bytes.js';
import { lireDer } from './asn1.js';
import { pkcs1VersSpki, spkiDuCertificat } from './cles-publiques.js';
import { md5Octets } from './hashes.js';

/* ------------------------------ DER, a la main ---------------------------- */
function longueur(n) {
  if (n < 0x80) return [n];
  const octets = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) octets.unshift(v & 0xff);
  return [0x80 | octets.length, ...octets];
}
const tlv = (etiquette, contenu) => Uint8Array.from([etiquette, ...longueur(contenu.length), ...contenu]);
const concat = (...parties) => {
  const sortie = new Uint8Array(parties.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parties) { sortie.set(p, i); i += p.length; }
  return sortie;
};
/* Un entier non signe, sans zero de tete, comme le veut une JWK (RFC 7518
   §6.3.1.1) ; un INTEGER DER ou un mpint SSH remettent un zero si le bit de
   poids fort est leve (X.690 §8.3, RFC 4251 §5). */
const sansZeros = o => { let i = 0; while (i < o.length - 1 && o[i] === 0) i++; return o.subarray(i); };
const signe = o => { const s = sansZeros(o); return s[0] & 0x80 ? concat([0], s) : s; };

const OID = {
  rsa: [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01],     // 1.2.840.113549.1.1.1
  ec: [0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01],                  // 1.2.840.10045.2.1
  'P-256': [0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07],       // 1.2.840.10045.3.1.7
  'P-384': [0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x22],                         // 1.3.132.0.34
  'P-521': [0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x23],                         // 1.3.132.0.35
  Ed25519: [0x06, 0x03, 0x2b, 0x65, 0x70],                                     // 1.3.101.112
  Ed448: [0x06, 0x03, 0x2b, 0x65, 0x71]                                        // 1.3.101.113
};
const COURBE_DE_OID = { '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521' };
const TAILLE_COORDONNEE = { 'P-256': 32, 'P-384': 48, 'P-521': 66 };
const SSH_EC = { 'P-256': 'nistp256', 'P-384': 'nistp384', 'P-521': 'nistp521' };

/* ------------------------- La cle, sous sa forme neutre -------------------- */
/* { genre: 'RSA', n, e } | { genre: 'EC', courbe, point } |
   { genre: 'Ed25519' | 'Ed448', brute } — octets non signes. */

/** La cle d un SubjectPublicKeyInfo DER. */
export function depuisSpki(der) {
  const [racine] = lireDer(der);
  const [algo, bits] = (racine && racine.enfants) || [];
  const oid = algo && algo.enfants && algo.enfants[0] && algo.enfants[0].oid;
  if (!oid || !bits || bits.type !== 'BIT STRING') throw new Error('SubjectPublicKeyInfo illisible');
  const contenu = bits.contenu.subarray(1);
  if (oid === '1.2.840.113549.1.1.1') {
    const [seq] = lireDer(contenu);
    const [n, e] = (seq && seq.enfants) || [];
    if (!n || !e || n.type !== 'INTEGER' || e.type !== 'INTEGER') throw new Error('cle RSA illisible');
    return { genre: 'RSA', n: sansZeros(n.contenu), e: sansZeros(e.contenu) };
  }
  if (oid === '1.2.840.10045.2.1') {
    const courbe = COURBE_DE_OID[algo.enfants[1] && algo.enfants[1].oid];
    if (!courbe) throw new Error('courbe elliptique non prise en charge');
    if (contenu[0] !== 0x04 || contenu.length !== 1 + 2 * TAILLE_COORDONNEE[courbe]) throw new Error('point de courbe non compresse attendu');
    return { genre: 'EC', courbe, point: contenu };
  }
  if (oid === '1.3.101.112' || oid === '1.3.101.113') {
    const genre = oid === '1.3.101.112' ? 'Ed25519' : 'Ed448';
    if (contenu.length !== (genre === 'Ed25519' ? 32 : 57)) throw new Error('longueur de cle ' + genre + ' inattendue');
    return { genre, brute: contenu };
  }
  throw new Error('type de cle non pris en charge : ' + oid);
}

/** Le SubjectPublicKeyInfo DER d une cle (RFC 5280 §4.1, RFC 5480, RFC 8410). */
export function versSpki(cle) {
  if (cle.genre === 'RSA') {
    const pkcs1 = tlv(0x30, concat(tlv(0x02, signe(cle.n)), tlv(0x02, signe(cle.e))));
    return tlv(0x30, concat(tlv(0x30, concat(OID.rsa, [0x05, 0x00])), tlv(0x03, concat([0], pkcs1))));
  }
  if (cle.genre === 'EC') return tlv(0x30, concat(tlv(0x30, concat(OID.ec, OID[cle.courbe])), tlv(0x03, concat([0], cle.point))));
  return tlv(0x30, concat(tlv(0x30, Uint8Array.from(OID[cle.genre])), tlv(0x03, concat([0], cle.brute))));
}

/* --------------------------------- JWK ------------------------------------ */
const b64u = o => octetsVersBase64(o).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** La cle d une JWK publique (ou privee : seuls ses membres publics servent). */
export function depuisJwk(jwk) {
  if (!jwk || typeof jwk !== 'object') throw new Error('JWK illisible');
  if (jwk.kty === 'oct') throw new Error('JWK symetrique (oct) : c est un secret partage, pas une cle publique');
  if (jwk.kty === 'RSA' && typeof jwk.n === 'string' && typeof jwk.e === 'string') {
    return { genre: 'RSA', n: sansZeros(base64VersOctets(jwk.n)), e: sansZeros(base64VersOctets(jwk.e)) };
  }
  if (jwk.kty === 'EC' && TAILLE_COORDONNEE[jwk.crv] && typeof jwk.x === 'string' && typeof jwk.y === 'string') {
    const t = TAILLE_COORDONNEE[jwk.crv];
    const x = base64VersOctets(jwk.x), y = base64VersOctets(jwk.y);
    if (x.length !== t || y.length !== t) throw new Error('coordonnees de la courbe ' + jwk.crv + ' : ' + t + ' octets chacune attendus (RFC 7518 §6.2.1.2)');
    return { genre: 'EC', courbe: jwk.crv, point: concat([4], x, y) };
  }
  if (jwk.kty === 'OKP' && (jwk.crv === 'Ed25519' || jwk.crv === 'Ed448') && typeof jwk.x === 'string') {
    return depuisSpki(versSpki({ genre: jwk.crv, brute: base64VersOctets(jwk.x) }));
  }
  throw new Error('JWK non prise en charge : RSA, EC (P-256, P-384, P-521) ou OKP (Ed25519, Ed448) attendue');
}

/** La JWK publique d une cle (RFC 7518 §6.2.1, §6.3.1 ; RFC 8037 §2). */
export function versJwk(cle) {
  if (cle.genre === 'RSA') return { kty: 'RSA', n: b64u(cle.n), e: b64u(cle.e) };
  if (cle.genre === 'EC') {
    const t = TAILLE_COORDONNEE[cle.courbe];
    return { kty: 'EC', crv: cle.courbe, x: b64u(cle.point.subarray(1, 1 + t)), y: b64u(cle.point.subarray(1 + t)) };
  }
  return { kty: 'OKP', crv: cle.genre, x: b64u(cle.brute) };
}

/* -------------------------------- OpenSSH --------------------------------- */
/* Le format de fil d OpenSSH : des chaines precedees de leur longueur sur
   quatre octets (RFC 4251 §5). */
const chaine = o => concat([o.length >>> 24 & 0xff, o.length >>> 16 & 0xff, o.length >>> 8 & 0xff, o.length & 0xff], o);
function lireChaines(blob) {
  const sortie = [];
  let i = 0;
  while (i < blob.length) {
    if (i + 4 > blob.length) throw new Error('cle OpenSSH tronquee');
    const n = ((blob[i] << 24) >>> 0) + (blob[i + 1] << 16) + (blob[i + 2] << 8) + blob[i + 3];
    i += 4;
    if (i + n > blob.length) throw new Error('cle OpenSSH tronquee');
    sortie.push(blob.subarray(i, i + n));
    i += n;
  }
  return sortie;
}
const texte = o => new TextDecoder().decode(o);

/** Le nom OpenSSH du type de cle, ou null s il n en a pas (Ed448). */
export function nomSsh(cle) {
  if (cle.genre === 'RSA') return 'ssh-rsa';
  if (cle.genre === 'Ed25519') return 'ssh-ed25519';
  if (cle.genre === 'EC') return 'ecdsa-sha2-' + SSH_EC[cle.courbe];
  return null;
}

/** La cle d un blob OpenSSH (la partie base64 d une ligne de cle publique). */
export function depuisBlobSsh(blob) {
  const parties = lireChaines(blob);
  const nom = parties.length ? texte(parties[0]) : '';
  if (nom === 'ssh-rsa' && parties.length === 3) return { genre: 'RSA', e: sansZeros(parties[1]), n: sansZeros(parties[2]) };
  if (nom === 'ssh-ed25519' && parties.length === 2 && parties[1].length === 32) return { genre: 'Ed25519', brute: parties[1] };
  const ec = /^ecdsa-sha2-(nistp256|nistp384|nistp521)$/.exec(nom);
  if (ec && parties.length === 3 && texte(parties[1]) === ec[1]) {
    const courbe = Object.keys(SSH_EC).find(c => SSH_EC[c] === ec[1]);
    return depuisSpki(versSpki({ genre: 'EC', courbe, point: parties[2] }));
  }
  throw new Error('cle OpenSSH non prise en charge : ' + (nom || 'type absent'));
}

/** Le blob OpenSSH d une cle (RFC 4253 §6.6, RFC 5656 §3.1, RFC 8709 §4). */
export function versBlobSsh(cle) {
  const nom = nomSsh(cle);
  if (!nom) return null;
  if (cle.genre === 'RSA') return concat(chaine(texteVersOctets(nom)), chaine(signe(cle.e)), chaine(signe(cle.n)));
  if (cle.genre === 'Ed25519') return concat(chaine(texteVersOctets(nom)), chaine(cle.brute));
  return concat(chaine(texteVersOctets(nom)), chaine(texteVersOctets(SSH_EC[cle.courbe])), chaine(cle.point));
}

/* ---------------------------------- Lire ---------------------------------- */
const LIGNE_SSH = /(?:^|\s)(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp(?:256|384|521))\s+([A-Za-z0-9+/]+={0,2})(?:\s+(.*))?$/;

function lirePem(genre, corps) {
  const der = base64VersOctets(corps.replace(/\s+/g, ''));
  if (genre === 'PUBLIC KEY') return { cle: depuisSpki(der), source: 'PEM (SubjectPublicKeyInfo)' };
  if (genre === 'RSA PUBLIC KEY') return { cle: depuisSpki(pkcs1VersSpki(der)), source: 'PEM (PKCS #1)' };
  if (genre === 'CERTIFICATE') return { cle: depuisSpki(spkiDuCertificat(der)), source: 'certificat X.509', certificat: der };
  throw new Error('bloc PEM « ' + genre + ' » : une cle publique ou un certificat est attendu');
}

function lireLigneSsh([, nom, b64, commentaire]) {
  const cle = depuisBlobSsh(base64VersOctets(b64));
  if (nomSsh(cle) !== nom) throw new Error('la ligne annonce ' + nom + ', la cle est ' + nomSsh(cle));
  return { cle, source: 'OpenSSH', commentaire: commentaire ? commentaire.trim() : null };
}

/**
 * Les cles d un texte colle : PEM (cle publique, PKCS #1 ou certificat), JWK
 * ou jeu de cles, lignes OpenSSH (un fichier authorized_keys entier), ou DER
 * en base64. @returns [{ cle, source, commentaire?, certificat? }]
 */
export function lireCles(entree) {
  const brut = String(entree || '').trim();
  if (!brut) throw new Error('cle vide');
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(brut)) throw new Error('cle privee fournie : collez la cle publique');
  if (brut.includes('-----BEGIN')) {
    const blocs = [...brut.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g)];
    if (!blocs.length) throw new Error('bloc PEM sans fin');
    /* Des blocs PEM et des lignes OpenSSH colles ensemble : chacun a sa place,
       dans l ordre du texte. */
    const trouvees = blocs.map(m => ({ position: m.index, lue: lirePem(m[1], m[2]) }));
    let reste = brut;
    for (const m of blocs) reste = reste.replace(m[0], l => ' '.repeat(l.length));
    let position = 0;
    for (const ligne of reste.split('\n')) {
      const ssh = LIGNE_SSH.exec(ligne.trim());
      if (ssh && !ligne.trim().startsWith('#')) trouvees.push({ position, lue: lireLigneSsh(ssh) });
      position += ligne.length + 1;
    }
    return trouvees.sort((a, b) => a.position - b.position).map(x => x.lue);
  }
  if (brut.startsWith('{')) {
    let objet;
    try { objet = JSON.parse(brut); } catch { throw new Error('JWK illisible'); }
    if (Array.isArray(objet.keys)) return objet.keys.map(k => ({ cle: depuisJwk(k), source: 'JWK', kid: typeof k.kid === 'string' ? k.kid : null }));
    return [{ cle: depuisJwk(objet), source: 'JWK', kid: typeof objet.kid === 'string' ? objet.kid : null }];
  }
  const lignes = brut.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const ssh = lignes.map(l => LIGNE_SSH.exec(l));
  if (ssh.some(Boolean)) return ssh.filter(Boolean).map(lireLigneSsh);
  let der = null;
  try { der = base64VersOctets(brut.replace(/\s+/g, '')); } catch { der = null; }
  if (der && der[0] === 0x30) {
    try { return [{ cle: depuisSpki(spkiDuCertificat(der)), source: 'certificat X.509', certificat: der }]; }
    catch { return [{ cle: depuisSpki(der), source: 'DER (SubjectPublicKeyInfo)' }]; }
  }
  throw new Error('cle publique attendue : PEM, certificat, JWK, ligne OpenSSH ou DER en base64');
}

/* ------------------------------- Les formes -------------------------------- */
const pem = (titre, der) => '-----BEGIN ' + titre + '-----\n'
  + (octetsVersBase64(der).match(/.{1,64}/g) || []).join('\n') + '\n-----END ' + titre + '-----\n';
const condense = async (algo, octets) => new Uint8Array(await crypto.subtle.digest(algo, octets));
const hexDeux = o => octetsVersHex(o, ':').toUpperCase();

/** La taille : bits du module RSA, ou la courbe. */
export function tailleDe(cle) {
  if (cle.genre !== 'RSA') return cle.genre === 'EC' ? cle.courbe : cle.genre;
  const n = cle.n;
  return (n.length - 1) * 8 + (32 - Math.clz32(n[0])) + ' bits';
}

/**
 * Toutes les formes et empreintes d une cle lue par lireCles.
 * @returns { taille, pem, pkcs1, jwk, ssh, pin, empreinteSsh, empreinteMd5,
 *            identifiantCle, empreinteCertificat }
 */
export async function formesDe({ cle, commentaire, certificat }) {
  const spki = versSpki(cle);
  const bitString = lireDer(spki)[0].enfants[1].contenu.subarray(1);
  const blob = versBlobSsh(cle);
  const formes = {
    taille: tailleDe(cle),
    pem: pem('PUBLIC KEY', spki),
    pkcs1: cle.genre === 'RSA' ? pem('RSA PUBLIC KEY', lireDer(spki)[0].enfants[1].contenu.subarray(1)) : null,
    jwk: versJwk(cle),
    /* RFC 7469 §2.4 : SHA-256 du SubjectPublicKeyInfo DER, en base64. */
    pin: octetsVersBase64(await condense('SHA-256', spki)),
    /* RFC 5280 §4.2.1.2, methode 1 : SHA-1 de la valeur de la BIT STRING. */
    identifiantCle: hexDeux(await condense('SHA-1', bitString)),
    ssh: blob ? nomSsh(cle) + ' ' + octetsVersBase64(blob) + (commentaire ? ' ' + commentaire : '') : null,
    /* Comme ssh-keygen -l : base64 sans remplissage, et MD5 en hexadecimal. */
    empreinteSsh: blob ? 'SHA256:' + octetsVersBase64(await condense('SHA-256', blob)).replace(/=+$/, '') : null,
    empreinteMd5: blob ? 'MD5:' + octetsVersHex(md5Octets(blob), ':') : null,
    empreinteCertificat: certificat ? hexDeux(await condense('SHA-256', certificat)) : null
  };
  return formes;
}
