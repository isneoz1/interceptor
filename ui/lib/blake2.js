/* BLAKE2 (RFC 7693) — INTERCEPTOR (by D4RK)
 *
 * BLAKE2b-512 (mots de 64 bits) et BLAKE2s-256 (mots de 32 bits), sans cle.
 * Ce sont les deux seules variantes que l on peut recouper ici contre une
 * implementation independante : les longueurs de sortie reduites et le mode
 * a cle changent le bloc de parametres, donc le resultat, et ne sont pas
 * proposees tant qu on ne peut pas les prouver.
 */
import { texteVersOctets, octetsVersHex } from './bytes.js';

/* Permutation du message, identique pour les deux variantes (RFC 7693 s2.7). */
const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0]
];

/* Les huit tours de melange d un tour complet : quatre colonnes, quatre diagonales. */
const CHEMINS = [
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [1, 6, 11, 12], [2, 7, 8, 13], [3, 4, 9, 14]
];

/* ------------------------------ BLAKE2b ----------------------------------- */
const MASQUE64 = (1n << 64n) - 1n;
const IV_B = [
  0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
];
const ROT_B = [32n, 24n, 16n, 63n];

const tournerDroite64 = (x, n) => ((x >> n) | (x << (64n - n))) & MASQUE64;

function compresserB(h, m, compteur, dernier) {
  const v = h.concat(IV_B);
  v[12] ^= compteur & MASQUE64;
  v[13] ^= (compteur >> 64n) & MASQUE64;
  if (dernier) v[14] ^= MASQUE64;

  for (let tour = 0; tour < 12; tour++) {
    const s = SIGMA[tour % 10];
    for (let i = 0; i < 8; i++) {
      const [a, b, c, d] = CHEMINS[i];
      const x = m[s[i * 2]], y = m[s[i * 2 + 1]];
      v[a] = (v[a] + v[b] + x) & MASQUE64;
      v[d] = tournerDroite64(v[d] ^ v[a], ROT_B[0]);
      v[c] = (v[c] + v[d]) & MASQUE64;
      v[b] = tournerDroite64(v[b] ^ v[c], ROT_B[1]);
      v[a] = (v[a] + v[b] + y) & MASQUE64;
      v[d] = tournerDroite64(v[d] ^ v[a], ROT_B[2]);
      v[c] = (v[c] + v[d]) & MASQUE64;
      v[b] = tournerDroite64(v[b] ^ v[c], ROT_B[3]);
    }
  }
  for (let i = 0; i < 8; i++) h[i] = h[i] ^ v[i] ^ v[i + 8];
}

export function blake2b512Octets(octets) {
  const h = IV_B.slice();
  h[0] ^= 0x01010040n; // pas de cle, sortie de 64 octets

  const total = octets.length;
  const blocs = Math.max(1, Math.ceil(total / 128));
  const vue = new DataView(new ArrayBuffer(128));

  for (let i = 0; i < blocs; i++) {
    const debut = i * 128;
    const morceau = octets.subarray(debut, Math.min(debut + 128, total));
    new Uint8Array(vue.buffer).fill(0);
    new Uint8Array(vue.buffer).set(morceau);
    const m = new Array(16);
    for (let j = 0; j < 16; j++) {
      m[j] = BigInt(vue.getUint32(j * 8, true)) | (BigInt(vue.getUint32(j * 8 + 4, true)) << 32n);
    }
    const dernier = i === blocs - 1;
    const compteur = BigInt(dernier ? total : debut + 128);
    compresserB(h, m, compteur, dernier);
  }

  const sortie = new Uint8Array(64);
  const vueSortie = new DataView(sortie.buffer);
  for (let i = 0; i < 8; i++) {
    vueSortie.setUint32(i * 8, Number(h[i] & 0xffffffffn), true);
    vueSortie.setUint32(i * 8 + 4, Number((h[i] >> 32n) & 0xffffffffn), true);
  }
  return sortie;
}

export function blake2b512(texte) {
  return octetsVersHex(blake2b512Octets(texteVersOctets(texte)));
}

/* ------------------------------ BLAKE2s ----------------------------------- */
const IV_S = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];
const ROT_S = [16, 12, 8, 7];

const tournerDroite32 = (x, n) => (((x >>> n) | (x << (32 - n))) >>> 0);

function compresserS(h, m, compteur, dernier) {
  const v = h.concat(IV_S);
  v[12] = (v[12] ^ (compteur >>> 0)) >>> 0;
  v[13] = (v[13] ^ Math.floor(compteur / 4294967296)) >>> 0;
  if (dernier) v[14] = (v[14] ^ 0xffffffff) >>> 0;

  for (let tour = 0; tour < 10; tour++) {
    const s = SIGMA[tour];
    for (let i = 0; i < 8; i++) {
      const [a, b, c, d] = CHEMINS[i];
      const x = m[s[i * 2]], y = m[s[i * 2 + 1]];
      v[a] = (v[a] + v[b] + x) >>> 0;
      v[d] = tournerDroite32(v[d] ^ v[a], ROT_S[0]);
      v[c] = (v[c] + v[d]) >>> 0;
      v[b] = tournerDroite32(v[b] ^ v[c], ROT_S[1]);
      v[a] = (v[a] + v[b] + y) >>> 0;
      v[d] = tournerDroite32(v[d] ^ v[a], ROT_S[2]);
      v[c] = (v[c] + v[d]) >>> 0;
      v[b] = tournerDroite32(v[b] ^ v[c], ROT_S[3]);
    }
  }
  for (let i = 0; i < 8; i++) h[i] = (h[i] ^ v[i] ^ v[i + 8]) >>> 0;
}

export function blake2s256Octets(octets) {
  const h = IV_S.slice();
  h[0] = (h[0] ^ 0x01010020) >>> 0; // pas de cle, sortie de 32 octets

  const total = octets.length;
  const blocs = Math.max(1, Math.ceil(total / 64));
  const tampon = new Uint8Array(64);
  const vue = new DataView(tampon.buffer);

  for (let i = 0; i < blocs; i++) {
    const debut = i * 64;
    tampon.fill(0);
    tampon.set(octets.subarray(debut, Math.min(debut + 64, total)));
    const m = new Array(16);
    for (let j = 0; j < 16; j++) m[j] = vue.getUint32(j * 4, true);
    const dernier = i === blocs - 1;
    compresserS(h, m, dernier ? total : debut + 64, dernier);
  }

  const sortie = new Uint8Array(32);
  const vueSortie = new DataView(sortie.buffer);
  h.forEach((x, i) => vueSortie.setUint32(i * 4, x >>> 0, true));
  return sortie;
}

export function blake2s256(texte) {
  return octetsVersHex(blake2s256Octets(texteVersOctets(texte)));
}
