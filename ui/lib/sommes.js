/* Sommes de controle — INTERCEPTOR (by D4RK)
 *
 * Un seul moteur CRC parametre (largeur, polynome, valeur initiale, reflexion,
 * ou-exclusif final) et le catalogue des variantes reellement utilisees.
 * Chaque variante porte sa valeur de controle publiee pour la chaine
 * « 123456789 » : les tests recalculent cette valeur, donc une entree fausse
 * se voit immediatement au lieu de circuler comme une verite.
 *
 * Une somme de controle detecte une alteration accidentelle. Elle ne prouve
 * rien contre quelqu un qui modifie volontairement les donnees.
 */
import { texteVersOctets } from './bytes.js';

/* ----------------------------- Moteur CRC --------------------------------- */
function inverserBits(valeur, largeur) {
  let sortie = 0;
  for (let i = 0; i < largeur; i++) {
    sortie = ((sortie << 1) | ((valeur >>> i) & 1)) >>> 0;
  }
  return largeur === 32 ? sortie >>> 0 : sortie & ((1 << largeur) - 1);
}

function inverserBits64(valeur) {
  let sortie = 0n;
  for (let i = 0n; i < 64n; i++) sortie = (sortie << 1n) | ((valeur >> i) & 1n);
  return sortie;
}

/** CRC de 8 a 32 bits, bit a bit : lisible et fidele aux parametres publies. */
function crcEtroit(octets, p) {
  const masque = p.largeur === 32 ? 0xffffffff : ((1 << p.largeur) - 1);
  const sommet = p.largeur === 32 ? 0x80000000 : (1 << (p.largeur - 1));
  const decalage = p.largeur - 8;
  let crc = p.init >>> 0;

  for (const brut of octets) {
    const octet = p.refIn ? inverserBits(brut, 8) : brut;
    crc = (crc ^ (decalage >= 0 ? (octet << decalage) : (octet >>> -decalage))) >>> 0;
    crc = (crc & masque) >>> 0;
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc & sommet) ? (((crc << 1) >>> 0) ^ p.poly) : (crc << 1)) >>> 0;
      crc = (crc & masque) >>> 0;
    }
  }
  if (p.refOut) crc = inverserBits(crc, p.largeur);
  return ((crc ^ p.xorOut) & masque) >>> 0;
}

const MASQUE64 = (1n << 64n) - 1n;

function crcLarge(octets, p) {
  let crc = BigInt(p.init) & MASQUE64;
  const poly = BigInt(p.poly) & MASQUE64;
  for (const brut of octets) {
    const octet = BigInt(p.refIn ? inverserBits(brut, 8) : brut);
    crc = (crc ^ (octet << 56n)) & MASQUE64;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000000000000000n) ? (((crc << 1n) & MASQUE64) ^ poly) : ((crc << 1n) & MASQUE64);
    }
  }
  if (p.refOut) crc = inverserBits64(crc);
  return (crc ^ (BigInt(p.xorOut) & MASQUE64)) & MASQUE64;
}

export function crcOctets(octets, p) {
  return p.largeur === 64 ? crcLarge(octets, p) : crcEtroit(octets, p);
}

/* --------------------------- Catalogue CRC -------------------------------- */
/* `controle` est la valeur publiee pour la chaine ASCII « 123456789 ». */
const c = (nom, largeur, poly, init, refIn, refOut, xorOut, controle, usage) =>
  ({ nom, largeur, poly, init, refIn, refOut, xorOut, controle, usage });

export const CRC_VARIANTES = [
  c('CRC-8/SMBUS', 8, 0x07, 0x00, false, false, 0x00, 0xf4, 'bus SMBus, capteurs I2C'),
  c('CRC-8/MAXIM-DOW', 8, 0x31, 0x00, true, true, 0x00, 0xa1, 'sondes 1-Wire Dallas/Maxim'),
  c('CRC-8/DARC', 8, 0x39, 0x00, true, true, 0x00, 0x15, 'radiodiffusion de donnees DARC'),
  c('CRC-16/ARC', 16, 0x8005, 0x0000, true, true, 0x0000, 0xbb3d, 'archives LHA, ARC'),
  c('CRC-16/MODBUS', 16, 0x8005, 0xffff, true, true, 0x0000, 0x4b37, 'automates industriels Modbus RTU'),
  c('CRC-16/USB', 16, 0x8005, 0xffff, true, true, 0xffff, 0xb4c8, 'trames USB'),
  c('CRC-16/IBM-3740', 16, 0x1021, 0xffff, false, false, 0x0000, 0x29b1, 'aussi appelee CCITT-FALSE'),
  c('CRC-16/XMODEM', 16, 0x1021, 0x0000, false, false, 0x0000, 0x31c3, 'transfert XMODEM, ZMODEM'),
  c('CRC-16/KERMIT', 16, 0x1021, 0x0000, true, true, 0x0000, 0x2189, 'protocole Kermit, souvent nomme CCITT'),
  c('CRC-16/GENIBUS', 16, 0x1021, 0xffff, false, false, 0xffff, 0xd64e, 'bus Genibus, DNP'),
  c('CRC-16/CDMA2000', 16, 0xc867, 0xffff, false, false, 0x0000, 0x4c06, 'telephonie CDMA2000'),
  c('CRC-16/DECT-R', 16, 0x0589, 0x0000, false, false, 0x0001, 0x007e, 'telephonie sans fil DECT'),
  c('CRC-32/ISO-HDLC', 32, 0x04c11db7, 0xffffffff, true, true, 0xffffffff, 0xcbf43926, 'ZIP, PNG, gzip, Ethernet'),
  c('CRC-32/BZIP2', 32, 0x04c11db7, 0xffffffff, false, false, 0xffffffff, 0xfc891918, 'archives bzip2'),
  c('CRC-32/ISCSI', 32, 0x1edc6f41, 0xffffffff, true, true, 0xffffffff, 0xe3069283, 'CRC-32C : iSCSI, SCTP, ext4, Btrfs'),
  c('CRC-32/MPEG-2', 32, 0x04c11db7, 0xffffffff, false, false, 0x00000000, 0x0376e6e7, 'flux de transport MPEG-2'),
  c('CRC-32/JAMCRC', 32, 0x04c11db7, 0xffffffff, true, true, 0x00000000, 0x340bc6d9, 'variante sans ou-exclusif final'),
  c('CRC-32/CKSUM', 32, 0x04c11db7, 0x00000000, false, false, 0xffffffff, 0x765e7680, 'commande cksum POSIX'),
  c('CRC-64/XZ', 64, 0x42f0e1eba9ea3693n, 0xffffffffffffffffn, true, true, 0xffffffffffffffffn, 0x995dc9bbdf1939fan, 'archives xz'),
  c('CRC-64/ECMA-182', 64, 0x42f0e1eba9ea3693n, 0x0000000000000000n, false, false, 0x0000000000000000n, 0x6c40df5f0b497347n, 'bandes DLT, norme ECMA-182')
];

export function crcParNom(nom) {
  return CRC_VARIANTES.find(v => v.nom === nom) || null;
}

/** Calcule une variante nommee et rend la valeur en hexadecimal, largeur fixe. */
export function crc(texte, nom) {
  const v = crcParNom(nom);
  if (!v) return '';
  const valeur = crcOctets(texteVersOctets(texte), v);
  const chiffres = v.largeur / 4;
  return valeur.toString(16).padStart(chiffres, '0');
}

/* --------------------------- Hachages rapides ----------------------------- */
/* Ni l un ni l autre n est cryptographique : ils servent a repartir des cles
   dans une table, pas a authentifier quoi que ce soit. */

const tournerGauche32 = (x, n) => (((x << n) | (x >>> (32 - n))) >>> 0);

/** MurmurHash3, variante x86 32 bits (Austin Appleby, domaine public). */
export function murmur3Octets(octets, graine = 0) {
  const C1 = 0xcc9e2d51, C2 = 0x1b873593;
  let h = graine >>> 0;
  const blocs = octets.length >> 2;

  for (let i = 0; i < blocs; i++) {
    const d = i * 4;
    let k = (octets[d] | (octets[d + 1] << 8) | (octets[d + 2] << 16) | (octets[d + 3] << 24)) >>> 0;
    k = Math.imul(k, C1) >>> 0;
    k = tournerGauche32(k, 15);
    k = Math.imul(k, C2) >>> 0;
    h = (h ^ k) >>> 0;
    h = tournerGauche32(h, 13);
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
  }

  let k = 0;
  const reste = octets.length & 3, base = blocs * 4;
  if (reste === 3) k ^= octets[base + 2] << 16;
  if (reste >= 2) k ^= octets[base + 1] << 8;
  if (reste >= 1) {
    k = (k ^ octets[base]) >>> 0;
    k = Math.imul(k, C1) >>> 0;
    k = tournerGauche32(k, 15);
    k = Math.imul(k, C2) >>> 0;
    h = (h ^ k) >>> 0;
  }

  h = (h ^ octets.length) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function murmur3(texte, graine = 0) {
  return murmur3Octets(texteVersOctets(texte), graine).toString(16).padStart(8, '0');
}

/** xxHash32 (Yann Collet). */
const P1 = 2654435761, P2 = 2246822519, P3 = 3266489917, P4 = 668265263, P5 = 374761393;

export function xxhash32Octets(octets, graine = 0) {
  const n = octets.length;
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  let position = 0;
  let h;

  const tour = (accumulateur, lane) =>
    Math.imul(tournerGauche32((accumulateur + Math.imul(lane, P2)) >>> 0, 13), P1) >>> 0;

  if (n >= 16) {
    let v1 = (graine + P1 + P2) >>> 0;
    let v2 = (graine + P2) >>> 0;
    let v3 = graine >>> 0;
    let v4 = (graine - P1) >>> 0;
    const limite = n - 16;
    while (position <= limite) {
      v1 = tour(v1, vue.getUint32(position, true)); position += 4;
      v2 = tour(v2, vue.getUint32(position, true)); position += 4;
      v3 = tour(v3, vue.getUint32(position, true)); position += 4;
      v4 = tour(v4, vue.getUint32(position, true)); position += 4;
    }
    h = (tournerGauche32(v1, 1) + tournerGauche32(v2, 7)
      + tournerGauche32(v3, 12) + tournerGauche32(v4, 18)) >>> 0;
  } else {
    h = (graine + P5) >>> 0;
  }

  h = (h + n) >>> 0;
  while (position + 4 <= n) {
    h = Math.imul(tournerGauche32((h + Math.imul(vue.getUint32(position, true), P3)) >>> 0, 17), P4) >>> 0;
    position += 4;
  }
  while (position < n) {
    h = Math.imul(tournerGauche32((h + Math.imul(octets[position], P5)) >>> 0, 11), P1) >>> 0;
    position += 1;
  }

  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, P2) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, P3) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function xxhash32(texte, graine = 0) {
  const octets = texteVersOctets(texte);
  return xxhash32Octets(new Uint8Array(octets), graine).toString(16).padStart(8, '0');
}


/* ---------------------------- Hachages 64 bits ---------------------------- */
/* JavaScript n a pas d entier 64 bits natif : ces deux fonctions travaillent
   en BigInt, masque a 64 bits apres chaque operation. Plus lentes, mais
   exactes — et c est l exactitude qu on vient chercher ici. */
const M64 = (1n << 64n) - 1n;
const rotl64 = (x, n) => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M64;
const u64le = (o, i) => {
  let v = 0n;
  for (let j = 7; j >= 0; j--) v = (v << 8n) | BigInt(o[i + j]);
  return v;
};

/**
 * SipHash-2-4 (Aumasson et Bernstein, 2012). Fonction a cle, concue pour les
 * tables de hachage exposees a des entrees choisies par un tiers ; on la
 * croise dans les en-tetes de nombreux protocoles.
 *
 * @param octets  message
 * @param cle     16 octets exactement
 * @returns BigInt sur 64 bits
 */
export function siphash24Octets(octets, cle) {
  const o = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  const k = cle instanceof Uint8Array ? cle : new Uint8Array(cle);
  if (k.length !== 16) throw new Error('SipHash : cle de 16 octets attendue (recu ' + k.length + ')');

  const k0 = u64le(k, 0);
  const k1 = u64le(k, 8);
  let v0 = k0 ^ 0x736f6d6570736575n;
  let v1 = k1 ^ 0x646f72616e646f6dn;
  let v2 = k0 ^ 0x6c7967656e657261n;
  let v3 = k1 ^ 0x7465646279746573n;

  const tour = () => {
    v0 = (v0 + v1) & M64; v1 = rotl64(v1, 13); v1 ^= v0; v0 = rotl64(v0, 32);
    v2 = (v2 + v3) & M64; v3 = rotl64(v3, 16); v3 ^= v2;
    v0 = (v0 + v3) & M64; v3 = rotl64(v3, 21); v3 ^= v0;
    v2 = (v2 + v1) & M64; v1 = rotl64(v1, 17); v1 ^= v2; v2 = rotl64(v2, 32);
  };

  const blocs = Math.floor(o.length / 8) * 8;
  for (let i = 0; i < blocs; i += 8) {
    const m = u64le(o, i);
    v3 ^= m; tour(); tour(); v0 ^= m;
  }

  /* Dernier bloc : le reste, puis la longueur du message sur l octet de tete. */
  let dernier = BigInt(o.length & 0xff) << 56n;
  for (let i = blocs; i < o.length; i++) dernier |= BigInt(o[i]) << BigInt(8 * (i - blocs));
  v3 ^= dernier; tour(); tour(); v0 ^= dernier;

  v2 ^= 0xffn;
  tour(); tour(); tour(); tour();
  return (v0 ^ v1 ^ v2 ^ v3) & M64;
}

/** SipHash-2-4 d un texte, cle en hexadecimal ou en octets, sortie hex. */
export function siphash24(texte, cle) {
  const k = typeof cle === 'string'
    ? new Uint8Array((cle.replace(/[^0-9a-fA-F]/g, '').match(/../g) || []).map(x => parseInt(x, 16)))
    : cle;
  return siphash24Octets(texteVersOctets(texte), k).toString(16).padStart(16, '0');
}

/* Constantes publiees de xxHash (Yann Collet). */
const XP1 = 11400714785074694791n;
const XP2 = 14029467366897019727n;
const XP3 = 1609587929392839161n;
const XP4 = 9650029242287828579n;
const XP5 = 2870177450012600261n;

function rondeXxh(acc, valeur) {
  acc = (acc + valeur * XP2) & M64;
  acc = rotl64(acc, 31);
  return (acc * XP1) & M64;
}
function fusionXxh(acc, valeur) {
  acc ^= rondeXxh(0n, valeur);
  acc = (acc * XP1) & M64;
  return (acc + XP4) & M64;
}

/** xxHash64, graine comprise. Rend un BigInt sur 64 bits. */
export function xxhash64Octets(octets, graine = 0n) {
  const o = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  const g = BigInt(graine) & M64;
  let h;
  let i = 0;

  if (o.length >= 32) {
    let a = (g + XP1 + XP2) & M64;
    let b = (g + XP2) & M64;
    let c = g;
    let d = (g - XP1) & M64;
    for (; i + 32 <= o.length; i += 32) {
      a = rondeXxh(a, u64le(o, i));
      b = rondeXxh(b, u64le(o, i + 8));
      c = rondeXxh(c, u64le(o, i + 16));
      d = rondeXxh(d, u64le(o, i + 24));
    }
    h = (rotl64(a, 1) + rotl64(b, 7) + rotl64(c, 12) + rotl64(d, 18)) & M64;
    h = fusionXxh(h, a);
    h = fusionXxh(h, b);
    h = fusionXxh(h, c);
    h = fusionXxh(h, d);
  } else {
    h = (g + XP5) & M64;
  }

  h = (h + BigInt(o.length)) & M64;

  for (; i + 8 <= o.length; i += 8) {
    h ^= rondeXxh(0n, u64le(o, i));
    h = (rotl64(h, 27) * XP1 + XP4) & M64;
  }
  if (i + 4 <= o.length) {
    let v = 0n;
    for (let j = 3; j >= 0; j--) v = (v << 8n) | BigInt(o[i + j]);
    h ^= (v * XP1) & M64;
    h = (rotl64(h, 23) * XP2 + XP3) & M64;
    i += 4;
  }
  for (; i < o.length; i++) {
    h ^= (BigInt(o[i]) * XP5) & M64;
    h = (rotl64(h, 11) * XP1) & M64;
  }

  h ^= h >> 33n; h = (h * XP2) & M64;
  h ^= h >> 29n; h = (h * XP3) & M64;
  h ^= h >> 32n;
  return h;
}

/** xxHash64 d un texte, en hexadecimal sur seize chiffres. */
export function xxhash64(texte, graine = 0) {
  return xxhash64Octets(texteVersOctets(texte), BigInt(graine)).toString(16).padStart(16, '0');
}
