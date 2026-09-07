/* Empreintes que le navigateur ne fournit pas — INTERCEPTOR (by D4RK)
 *
 * RIPEMD-160 (adresses Bitcoin, PGP), SM3 (norme chinoise) et MD4 (ancetre de
 * MD5, encore croise dans NTLM et de vieux protocoles).
 *
 * Chacune suit sa specification et est verifiee contre une valeur publiee :
 * une implementation « qui a l air correcte » ne suffit pas.
 * MD4 et RIPEMD-160 ne protegent plus rien ; elles servent a reconnaitre une
 * valeur existante, jamais a prouver une identite.
 */
import { texteVersOctets, octetsVersHex } from './bytes.js';

/* --------------------------- Outils communs ------------------------------- */
const tournerGauche = (x, n) => (n === 0 ? x >>> 0 : ((x << n) | (x >>> (32 - n))) >>> 0);

/** Remplissage de Merkle-Damgard : 0x80, des zeros, puis la longueur en bits. */
function remplir(octets, petitBoutiste) {
  const longueur = octets.length;
  const total = (((longueur + 8) >> 6) << 6) + 64;
  const bloc = new Uint8Array(total);
  bloc.set(octets);
  bloc[longueur] = 0x80;
  const vue = new DataView(bloc.buffer);
  const bas = (longueur * 8) >>> 0;
  const haut = Math.floor(longueur / 536870912);
  if (petitBoutiste) {
    vue.setUint32(total - 8, bas, true);
    vue.setUint32(total - 4, haut, true);
  } else {
    vue.setUint32(total - 8, haut, false);
    vue.setUint32(total - 4, bas, false);
  }
  return bloc;
}

/* ------------------------------ RIPEMD-160 -------------------------------- */
/* Ordre des mots et rotations des deux lignes, tels que la specification les fixe. */
const R_G = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
  3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
  1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
  4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
];
const R_D = [
  5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
  6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
  15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
  8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
  12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
];
const S_G = [
  11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
  7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
  11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
  11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
  9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
];
const S_D = [
  8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
  9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
  9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
  15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
  8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
];
const K_G = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
const K_D = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];

const f160 = (j, x, y, z) =>
  j < 16 ? (x ^ y ^ z)
  : j < 32 ? ((x & y) | (~x & z))
  : j < 48 ? ((x | ~y) ^ z)
  : j < 64 ? ((x & z) | (y & ~z))
  : (x ^ (y | ~z));

export function ripemd160Octets(octets) {
  const bloc = remplir(octets, true);
  const vue = new DataView(bloc.buffer);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

  for (let debut = 0; debut < bloc.length; debut += 64) {
    const mot = new Array(16);
    for (let i = 0; i < 16; i++) mot[i] = vue.getUint32(debut + i * 4, true);

    /* Ligne gauche et ligne droite avancent en parallele sur le meme bloc. */
    let ag = h0, bg = h1, cg = h2, dg = h3, eg = h4;
    let ad = h0, bd = h1, cd = h2, dd = h3, ed = h4;

    for (let j = 0; j < 80; j++) {
      const tour = (j / 16) | 0;

      let t = (ag + f160(j, bg, cg, dg) + mot[R_G[j]] + K_G[tour]) | 0;
      t = (tournerGauche(t >>> 0, S_G[j]) + eg) | 0;
      ag = eg; eg = dg; dg = tournerGauche(cg, 10); cg = bg; bg = t >>> 0;

      let u = (ad + f160(79 - j, bd, cd, dd) + mot[R_D[j]] + K_D[tour]) | 0;
      u = (tournerGauche(u >>> 0, S_D[j]) + ed) | 0;
      ad = ed; ed = dd; dd = tournerGauche(cd, 10); cd = bd; bd = u >>> 0;
    }

    const t = (h1 + cg + dd) | 0;
    h1 = (h2 + dg + ed) | 0;
    h2 = (h3 + eg + ad) | 0;
    h3 = (h4 + ag + bd) | 0;
    h4 = (h0 + bg + cd) | 0;
    h0 = t;
  }

  const sortie = new Uint8Array(20);
  const vueSortie = new DataView(sortie.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => vueSortie.setUint32(i * 4, h >>> 0, true));
  return sortie;
}

export function ripemd160(texte) {
  return octetsVersHex(ripemd160Octets(texteVersOctets(texte)));
}

/* ---------------------------------- SM3 ----------------------------------- */
/* Norme chinoise GB/T 32905-2016 : structure proche de SHA-256, constantes et
   fonctions differentes. On la croise dans le TLS deploye en Chine. */
const sm3T = j => (j < 16 ? 0x79cc4519 : 0x7a879d8a);
const sm3FF = (j, x, y, z) => (j < 16 ? (x ^ y ^ z) : ((x & y) | (x & z) | (y & z)));
const sm3GG = (j, x, y, z) => (j < 16 ? (x ^ y ^ z) : ((x & y) | (~x & z)));
const p0 = x => (x ^ tournerGauche(x, 9) ^ tournerGauche(x, 17)) >>> 0;
const p1 = x => (x ^ tournerGauche(x, 15) ^ tournerGauche(x, 23)) >>> 0;

export function sm3Octets(octets) {
  const bloc = remplir(octets, false);
  const vue = new DataView(bloc.buffer);
  let v = [0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600,
           0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e];

  for (let debut = 0; debut < bloc.length; debut += 64) {
    const w = new Array(68);
    for (let i = 0; i < 16; i++) w[i] = vue.getUint32(debut + i * 4, false);
    for (let i = 16; i < 68; i++) {
      w[i] = (p1((w[i - 16] ^ w[i - 9] ^ tournerGauche(w[i - 3], 15)) >>> 0)
        ^ tournerGauche(w[i - 13], 7) ^ w[i - 6]) >>> 0;
    }
    const w1 = new Array(64);
    for (let i = 0; i < 64; i++) w1[i] = (w[i] ^ w[i + 4]) >>> 0;

    let [a, b, c, d, e, f, g, h] = v;
    for (let j = 0; j < 64; j++) {
      const a12 = tournerGauche(a, 12);
      const ss1 = tournerGauche((a12 + e + tournerGauche(sm3T(j), j % 32)) >>> 0, 7);
      const ss2 = (ss1 ^ a12) >>> 0;
      const tt1 = (sm3FF(j, a, b, c) + d + ss2 + w1[j]) >>> 0;
      const tt2 = (sm3GG(j, e, f, g) + h + ss1 + w[j]) >>> 0;
      d = c; c = tournerGauche(b, 9); b = a; a = tt1;
      h = g; g = tournerGauche(f, 19); f = e; e = p0(tt2);
    }
    const bloc8 = [a, b, c, d, e, f, g, h];
    v = v.map((x, i) => (x ^ bloc8[i]) >>> 0);
  }

  const sortie = new Uint8Array(32);
  const vueSortie = new DataView(sortie.buffer);
  v.forEach((x, i) => vueSortie.setUint32(i * 4, x >>> 0, false));
  return sortie;
}

export function sm3(texte) { return octetsVersHex(sm3Octets(texteVersOctets(texte))); }

/* ---------------------------------- MD4 ----------------------------------- */
/* RFC 1320. Cassee depuis longtemps : elle sert a relire des protocoles
   anciens (NTLM notamment), jamais a proteger quoi que ce soit. */
const MD4_K2 = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];
const MD4_K3 = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];

export function md4Octets(octets) {
  const bloc = remplir(octets, true);
  const vue = new DataView(bloc.buffer);
  const etat = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

  const F = (x, y, z) => (x & y) | (~x & z);
  const G = (x, y, z) => (x & y) | (x & z) | (y & z);
  const H = (x, y, z) => x ^ y ^ z;

  for (let debut = 0; debut < bloc.length; debut += 64) {
    const m = new Array(16);
    for (let i = 0; i < 16; i++) m[i] = vue.getUint32(debut + i * 4, true);
    const r = etat.slice();

    /* A chaque pas les quatre registres tournent : le registre mis a jour est
       A, puis D, puis C, puis B, et ainsi de suite. */
    const pas = (i, fonction, indice, decalage, constante) => {
      const ia = (4 - (i & 3)) & 3;
      const ib = (ia + 1) & 3, ic = (ia + 2) & 3, id = (ia + 3) & 3;
      const somme = (r[ia] + fonction(r[ib], r[ic], r[id]) + m[indice] + constante) >>> 0;
      r[ia] = tournerGauche(somme, decalage);
    };

    const d1 = [3, 7, 11, 19], d2 = [3, 5, 9, 13], d3 = [3, 9, 11, 15];
    for (let i = 0; i < 16; i++) pas(i, F, i, d1[i & 3], 0);
    for (let i = 0; i < 16; i++) pas(i, G, MD4_K2[i], d2[i & 3], 0x5a827999);
    for (let i = 0; i < 16; i++) pas(i, H, MD4_K3[i], d3[i & 3], 0x6ed9eba1);

    for (let i = 0; i < 4; i++) etat[i] = (etat[i] + r[i]) | 0;
  }

  const sortie = new Uint8Array(16);
  const vueSortie = new DataView(sortie.buffer);
  etat.forEach((x, i) => vueSortie.setUint32(i * 4, x >>> 0, true));
  return sortie;
}

export function md4(texte) { return octetsVersHex(md4Octets(texteVersOctets(texte))); }

/** NTLM : MD4 du mot de passe encode en UTF-16LE. Sert a relire une capture
 *  d authentification Windows, pas a en fabriquer une. */
export function ntlm(motDePasse) {
  const texte = String(motDePasse == null ? '' : motDePasse);
  const octets = new Uint8Array(texte.length * 2);
  const vue = new DataView(octets.buffer);
  for (let i = 0; i < texte.length; i++) vue.setUint16(i * 2, texte.charCodeAt(i), true);
  return octetsVersHex(md4Octets(octets));
}
