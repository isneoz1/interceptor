/* SHA-3 et Keccak — INTERCEPTOR (by NeoZ)
 *
 * Le navigateur ne propose que SHA-1 et SHA-2 : SHA-3 s ecrit donc ici, tel
 * que le FIPS 202 le definit. Les quatre longueurs normalisees sont fournies,
 * plus les fonctions extensibles SHAKE128 et SHAKE256.
 *
 * L etat est un tableau de vingt-cinq mots de 64 bits. JavaScript n a pas
 * d entier de 64 bits natif : on emploie BigInt, plus lent qu un decoupage en
 * deux moities, mais lisible et sans risque d erreur de retenue. Sur une
 * valeur collee dans la boite a outils, la difference ne se voit pas.
 */
import { texteVersOctets, octetsVersHex } from './bytes.js';

const MASQUE = (1n << 64n) - 1n;

/* Constantes de tour, telles que le FIPS 202 les publie. */
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
];

/* Decalages de rotation de l etape rho, par position. */
const ROTATIONS = [
  0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25,
  39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14
].map(BigInt);

/* Permutation pi : l indice d ou vient chaque lane. */
const PI = [
  0, 6, 12, 18, 24, 3, 9, 10, 16, 22, 1, 7, 13,
  19, 20, 4, 5, 11, 17, 23, 2, 8, 14, 15, 21
];

const tourner = (x, n) => ((x << n) | (x >> (64n - n))) & MASQUE;

/** Permutation Keccak-f[1600] : vingt-quatre tours sur l etat. */
function keccakF(etat) {
  for (let tour = 0; tour < 24; tour++) {
    /* Theta */
    const c = new Array(5);
    for (let x = 0; x < 5; x++) {
      c[x] = etat[x] ^ etat[x + 5] ^ etat[x + 10] ^ etat[x + 15] ^ etat[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ tourner(c[(x + 1) % 5], 1n);
      for (let y = 0; y < 25; y += 5) etat[x + y] ^= d;
    }

    /* Rho et pi */
    const tampon = new Array(25);
    for (let i = 0; i < 25; i++) tampon[i] = tourner(etat[PI[i]], ROTATIONS[PI[i]]);
    for (let i = 0; i < 25; i++) etat[i] = tampon[i];

    /* Chi */
    for (let y = 0; y < 25; y += 5) {
      const ligne = [etat[y], etat[y + 1], etat[y + 2], etat[y + 3], etat[y + 4]];
      for (let x = 0; x < 5; x++) {
        etat[y + x] = ligne[x] ^ ((~ligne[(x + 1) % 5] & MASQUE) & ligne[(x + 2) % 5]);
      }
    }

    /* Iota */
    etat[0] ^= RC[tour];
  }
  return etat;
}

/**
 * Eponge Keccak : absorption du message par blocs de `debit` octets, puis
 * extraction de `sortie` octets. `remplissage` vaut 0x06 pour SHA-3 et 0x1f
 * pour SHAKE — c est la seule difference entre les deux familles.
 */
function eponge(octets, debit, sortie, remplissage) {
  const etat = new Array(25).fill(0n);
  const bloc = new Uint8Array(debit);
  let pos = 0;

  const absorber = () => {
    for (let i = 0; i < debit / 8; i++) {
      let lane = 0n;
      for (let j = 7; j >= 0; j--) lane = (lane << 8n) | BigInt(bloc[i * 8 + j]);
      etat[i] ^= lane;
    }
    keccakF(etat);
  };

  for (const octet of octets) {
    bloc[pos++] = octet;
    if (pos === debit) { absorber(); pos = 0; }
  }

  /* Remplissage pad10*1 : premier octet marque le domaine, dernier bit a 1. */
  bloc.fill(0, pos);
  bloc[pos] = remplissage;
  bloc[debit - 1] |= 0x80;
  absorber();

  const out = new Uint8Array(sortie);
  let ecrit = 0;
  for (;;) {
    for (let i = 0; i < debit / 8 && ecrit < sortie; i++) {
      let lane = etat[i];
      for (let j = 0; j < 8 && ecrit < sortie; j++) {
        out[ecrit++] = Number(lane & 0xffn);
        lane >>= 8n;
      }
    }
    if (ecrit >= sortie) break;
    keccakF(etat);
  }
  return out;
}

/** SHA-3 sur des octets. `bits` vaut 224, 256, 384 ou 512. */
export function sha3Octets(octets, bits = 256) {
  if (![224, 256, 384, 512].includes(Number(bits))) {
    throw new Error('SHA-3 accepte 224, 256, 384 ou 512 bits');
  }
  const sortie = Number(bits) / 8;
  return eponge(octets, 200 - sortie * 2, sortie, 0x06);
}

/** SHA-3 d un texte, en hexadecimal. */
export function sha3(texte, bits = 256) {
  return octetsVersHex(sha3Octets(texteVersOctets(texte), bits));
}

/**
 * SHAKE : la meme eponge, mais la longueur de sortie est choisie librement.
 * `force` vaut 128 ou 256 et fixe la capacite, pas la longueur.
 */
export function shake(texte, force = 128, octetsDeSortie = 32) {
  if (![128, 256].includes(Number(force))) throw new Error('SHAKE accepte 128 ou 256');
  const n = Math.max(1, Math.min(4096, Math.floor(Number(octetsDeSortie) || 32)));
  return octetsVersHex(eponge(texteVersOctets(texte), 200 - Number(force) / 4, n, 0x1f));
}

/**
 * Keccak d origine, celui d avant la normalisation : meme permutation, autre
 * octet de remplissage (0x01). C est lui qu emploie Ethereum, et il ne donne
 * pas le meme resultat que SHA-3 — d ou sa presence a part.
 */
export function keccak(texte, bits = 256) {
  if (![224, 256, 384, 512].includes(Number(bits))) {
    throw new Error('Keccak accepte 224, 256, 384 ou 512 bits');
  }
  const sortie = Number(bits) / 8;
  return octetsVersHex(eponge(texteVersOctets(texte), 200 - sortie * 2, sortie, 0x01));
}
