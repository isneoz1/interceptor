/* Empreintes et sommes de controle — INTERCEPTOR (by NeoZ)
 *
 * SHA-1, SHA-256, SHA-384 et SHA-512 viennent du moteur du navigateur
 * (crypto.subtle). MD5, CRC-32, Adler-32, FNV-1a et djb2 sont ecrits ici :
 * le navigateur ne les propose pas, et ils restent courants dans les entetes,
 * les ETag et les protocoles anciens.
 *
 * MD5 et SHA-1 sont casses pour la signature : ils servent a reconnaitre une
 * valeur, jamais a prouver une identite. L interface le dit sur chaque ecran.
 */
import { texteVersOctets, octetsVersHex } from './bytes.js';

/* ----------------------------------- MD5 ---------------------------------- */
/* RFC 1321, ecrit sur des entiers 32 bits. Sert a relire un ETag, un checksum
   de paquet ou une empreinte historique : jamais a garantir une integrite. */
const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];
const MD5_K = new Uint32Array(64);
for (let i = 0; i < 64; i++) MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

const tourner = (x, n) => (x << n) | (x >>> (32 - n));

export function md5Octets(octets) {
  const longueurBits = octets.length * 8;
  const remplissage = ((octets.length + 8) >> 6 << 6) + 64;
  const message = new Uint8Array(remplissage);
  message.set(octets);
  message[octets.length] = 0x80;
  const vue = new DataView(message.buffer);
  vue.setUint32(remplissage - 8, longueurBits >>> 0, true);
  vue.setUint32(remplissage - 4, Math.floor(longueurBits / 4294967296), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const bloc = new Uint32Array(16);
  for (let debut = 0; debut < remplissage; debut += 64) {
    for (let i = 0; i < 16; i++) bloc[i] = vue.getUint32(debut + i * 4, true);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      f = (f + a + MD5_K[i] + bloc[g]) | 0;
      a = d; d = c; c = b;
      b = (b + tourner(f, MD5_S[i])) | 0;
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }
  const sortie = new Uint8Array(16);
  const vueSortie = new DataView(sortie.buffer);
  vueSortie.setUint32(0, a0 >>> 0, true);
  vueSortie.setUint32(4, b0 >>> 0, true);
  vueSortie.setUint32(8, c0 >>> 0, true);
  vueSortie.setUint32(12, d0 >>> 0, true);
  return sortie;
}

export function md5(texte) { return octetsVersHex(md5Octets(texteVersOctets(texte))); }

/* -------------------------------- Sommes 32 bits -------------------------- */
const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE 802.3) : la somme des archives ZIP, de PNG et de gzip. */
export function crc32(texte) {
  let c = 0xffffffff;
  for (const octet of texteVersOctets(texte)) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

/** Adler-32 : la somme de zlib. Plus rapide, moins sure que CRC-32. */
export function adler32(texte) {
  let a = 1, b = 0;
  for (const octet of texteVersOctets(texte)) { a = (a + octet) % 65521; b = (b + a) % 65521; }
  return (((b << 16) | a) >>> 0).toString(16).padStart(8, '0');
}

/** FNV-1a 32 bits : la fonction de hachage des tables de dispersion. */
export function fnv1a32(texte) {
  let h = 0x811c9dc5;
  for (const octet of texteVersOctets(texte)) {
    h ^= octet;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** djb2 : le hachage de Daniel Bernstein, present dans beaucoup de code C. */
export function djb2(texte) {
  let h = 5381;
  for (const octet of texteVersOctets(texte)) h = ((Math.imul(h, 33) + octet) | 0);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Somme des octets modulo 256, et sa complementaire : protocoles embarques. */
export function sommeOctets(texte) {
  let somme = 0;
  for (const octet of texteVersOctets(texte)) somme = (somme + octet) & 0xff;
  return {
    somme: somme.toString(16).padStart(2, '0'),
    complement: (((~somme) + 1) & 0xff).toString(16).padStart(2, '0')
  };
}

/* --------------------------------- SHA et HMAC ---------------------------- */
const SHA = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

/** Toutes les empreintes disponibles, natives et locales confondues. */
export const ALGORITHMES = ['MD5', ...SHA];

function sujet() {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error('crypto.subtle indisponible dans ce contexte');
  return s;
}

export async function empreinteHex(algorithme, texte) {
  if (algorithme === 'MD5') return md5(texte);
  if (!SHA.includes(algorithme)) throw new Error('algorithme inconnu : ' + algorithme);
  const tampon = await sujet().digest(algorithme, texteVersOctets(texte));
  return octetsVersHex(new Uint8Array(tampon));
}

/**
 * HMAC, la signature a cle partagee des API : c est ce qu on verifie sur un
 * webhook (Stripe, GitHub) ou sur un jeton JWT signe en HS256.
 */
export async function hmacHex(algorithme, cle, message) {
  if (!SHA.includes(algorithme)) throw new Error('HMAC : algorithme inconnu ' + algorithme);
  if (!String(cle)) throw new Error('cle vide');
  const importee = await sujet().importKey(
    'raw', texteVersOctets(cle), { name: 'HMAC', hash: algorithme }, false, ['sign']
  );
  const signature = await sujet().sign('HMAC', importee, texteVersOctets(message));
  return octetsVersHex(new Uint8Array(signature));
}

/* --------------------------- Reconnaissance d empreinte ------------------- */
const FORMES = [
  { longueur: 32, hex: true, noms: ['MD5', 'MD4', 'NTLM', 'MD2'] },
  { longueur: 40, hex: true, noms: ['SHA-1', 'RIPEMD-160', 'identifiant Git'] },
  { longueur: 56, hex: true, noms: ['SHA-224', 'SHA3-224'] },
  { longueur: 64, hex: true, noms: ['SHA-256', 'SHA3-256', 'BLAKE2s-256'] },
  { longueur: 96, hex: true, noms: ['SHA-384', 'SHA3-384'] },
  { longueur: 128, hex: true, noms: ['SHA-512', 'SHA3-512', 'BLAKE2b-512', 'Whirlpool'] },
  { longueur: 16, hex: true, noms: ['CRC-64 tronque', 'empreinte courte'] },
  { longueur: 8, hex: true, noms: ['CRC-32', 'Adler-32', 'FNV-1a 32'] }
];

/**
 * Candidats pour une empreinte collee. On ne tranche jamais : la longueur et
 * l alphabet ne suffisent pas a distinguer deux algorithmes de meme taille.
 */
export function reconnaitreEmpreinte(texte) {
  const brut = String(texte).trim();
  if (!brut) return { candidats: [], note: 'Texte vide.' };
  if (/^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(brut)) {
    return { candidats: ['bcrypt'], note: 'Format bcrypt reconnu a son prefixe.' };
  }
  if (/^\$argon2(id|i|d)\$/.test(brut)) {
    return { candidats: ['Argon2'], note: 'Format Argon2 reconnu a son prefixe.' };
  }
  if (/^\$6\$/.test(brut)) return { candidats: ['crypt SHA-512'], note: 'Format crypt(3) Unix.' };
  if (/^\$5\$/.test(brut)) return { candidats: ['crypt SHA-256'], note: 'Format crypt(3) Unix.' };
  if (/^\$1\$/.test(brut)) return { candidats: ['crypt MD5'], note: 'Format crypt(3) Unix.' };
  if (/^\{SSHA\}/i.test(brut)) return { candidats: ['SSHA (LDAP)'], note: 'Format LDAP.' };
  if (/^[\w-]+\.[\w-]+\.[\w-]*$/.test(brut)) {
    return { candidats: ['JWT'], note: 'Trois parties separees par des points : voir l onglet JWT.' };
  }

  const hex = /^[0-9a-fA-F]+$/.test(brut);
  const forme = FORMES.find(f => f.longueur === brut.length && f.hex === hex);
  if (forme) {
    return {
      candidats: forme.noms,
      note: 'Longueur de ' + brut.length + ' caracteres hexadecimaux : plusieurs algorithmes la partagent, '
        + 'la liste est une piste, pas une reponse.'
    };
  }
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(brut) && brut.length % 4 === 0) {
    return {
      candidats: ['empreinte encodee en base64'],
      note: 'Alphabet base64 : essayez « Base64 vers hexadecimal » pour retrouver la longueur reelle.'
    };
  }
  return { candidats: [], note: 'Aucune forme connue ne correspond a cette longueur.' };
}
