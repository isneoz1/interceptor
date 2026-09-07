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
