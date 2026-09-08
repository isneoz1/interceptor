/* Generateurs de valeurs — INTERCEPTOR (by NeoZ)
 *
 * Identifiants, secrets de test et adresses. Tout vient de crypto.getRandomValues :
 * aucun tirage n emploie Math.random, qui ne convient pas a une valeur qui
 * ressemble a un secret.
 *
 * Ces valeurs servent a essayer une API, jamais a proteger quoi que ce soit en
 * production : elles naissent dans un navigateur et transitent par l ecran.
 */
import { md5Octets } from './hashes.js';

function octetsAleatoires(combien) {
  const n = Math.min(4096, Math.max(1, Math.floor(Number(combien) || 1)));
  const tampon = new Uint8Array(n);
  const c = globalThis.crypto;
  if (!c || !c.getRandomValues) throw new Error('generateur aleatoire indisponible');
  c.getRandomValues(tampon);
  return tampon;
}

const hex = octets => [...octets].map(o => o.toString(16).padStart(2, '0')).join('');

/* ------------------------------- Identifiants ----------------------------- */
/** UUID version 4 : seize octets tires au hasard, deux champs imposes. */
export function uuidV4() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const o = octetsAleatoires(16);
  o[6] = (o[6] & 0x0f) | 0x40;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = hex(o);
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

/**
 * UUID version 7 (RFC 9562) : les 48 premiers bits portent l horodatage en
 * millisecondes, donc deux identifiants se trient dans l ordre de creation.
 */
export function uuidV7(date = Date.now()) {
  const ms = BigInt(Math.floor(date));
  const o = octetsAleatoires(16);
  for (let i = 0; i < 6; i++) o[i] = Number((ms >> BigInt(40 - i * 8)) & 0xffn);
  o[6] = (o[6] & 0x0f) | 0x70;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = hex(o);
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID : meme idee que l UUID v7, ecrit en base 32 Crockford, 26 caracteres. */
export function ulid(date = Date.now()) {
  let ms = BigInt(Math.floor(date));
  let tete = '';
  for (let i = 0; i < 10; i++) { tete = CROCKFORD[Number(ms % 32n)] + tete; ms /= 32n; }
  const o = octetsAleatoires(10);
  let queue = '';
  let bits = 0, valeur = 0;
  for (const octet of o) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) { queue += CROCKFORD[(valeur >>> (bits - 5)) & 31]; bits -= 5; valeur &= (1 << bits) - 1; }
  }
  return tete + queue.slice(0, 16);
}

const NANO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

/** NanoID : identifiant court d URL, alphabet de 64 caracteres. */
export function nanoid(taille = 21) {
  const n = Math.min(256, Math.max(1, Math.floor(Number(taille) || 21)));
  return [...octetsAleatoires(n)].map(o => NANO[o & 63]).join('');
}

/* ---------------------------------- Secrets ------------------------------- */
export function hexAleatoire(octets = 32) { return hex(octetsAleatoires(octets)); }

export function base64Aleatoire(octets = 32) {
  let binaire = '';
  for (const o of octetsAleatoires(octets)) binaire += String.fromCharCode(o);
  return btoa(binaire);
}

export function base64UrlAleatoire(octets = 32) {
  return base64Aleatoire(octets).split('+').join('-').split('/').join('_').split('=').join('');
}

const JEUX = {
  minuscules: 'abcdefghijklmnopqrstuvwxyz',
  majuscules: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  chiffres: '0123456789',
  symboles: '!#$%&()*+,-./:;<=>?@[]^_{|}~'
};

/**
 * Mot de passe tire sans biais : on rejette les octets qui tomberaient dans la
 * partie tronquee de l alphabet, plutot que de prendre un modulo qui favorise
 * les premiers caracteres.
 */
export function motDePasse(longueur = 24, jeux = ['minuscules', 'majuscules', 'chiffres', 'symboles']) {
  const alphabet = jeux.map(j => JEUX[j] || '').join('');
  if (!alphabet) throw new Error('aucun jeu de caracteres choisi');
  const n = Math.min(512, Math.max(1, Math.floor(Number(longueur) || 24)));
  const limite = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < n) {
    for (const octet of octetsAleatoires(Math.max(16, n))) {
      if (octet >= limite) continue;                 // tirage rejete, sans biais
      out += alphabet[octet % alphabet.length];
      if (out.length === n) break;
    }
  }
  return out;
}

/** Force reelle d un mot de passe : log2 de l espace, en bits. */
export function forceMotDePasse(valeur) {
  const s = String(valeur || '');
  if (!s) return { bits: 0, alphabet: 0, lecture: 'Vide.' };
  let alphabet = 0;
  if (/[a-z]/.test(s)) alphabet += 26;
  if (/[A-Z]/.test(s)) alphabet += 26;
  if (/[0-9]/.test(s)) alphabet += 10;
  if (/[^a-zA-Z0-9]/.test(s)) alphabet += 32;
  const bits = Math.round(s.length * Math.log2(alphabet || 1) * 10) / 10;
  const lecture = bits >= 128 ? 'Tres solide, meme face a une attaque hors ligne.'
    : bits >= 80 ? 'Solide pour un usage courant.'
    : bits >= 60 ? 'Correct en ligne, faible hors ligne.'
    : 'Faible : une attaque hors ligne en vient a bout.';
  return { bits, alphabet, lecture };
}

/* --------------------------------- Reseau --------------------------------- */
/** Adresse materielle tiree au hasard, marquee « localement administree ». */
export function macAleatoire() {
  const o = octetsAleatoires(6);
  o[0] = (o[0] & 0xfe) | 0x02;                       // unicast, administration locale
  return [...o].map(x => x.toString(16).padStart(2, '0')).join(':');
}

/** Adresse IPv4 privee tiree au hasard, pour peupler un jeu d essai. */
export function ipv4PriveeAleatoire() {
  const o = octetsAleatoires(3);
  return '192.168.' + (o[0] % 256) + '.' + Math.max(1, o[1] % 254);
}

/** Port dynamique tire au hasard (RFC 6335). */
export function portAleatoire() {
  const o = octetsAleatoires(2);
  return 49152 + (((o[0] << 8) | o[1]) % (65535 - 49152));
}

/* ------------------------------ Valeurs limites --------------------------- */
/**
 * Chaines qui font tomber les validateurs mal ecrits : longueur, encodage,
 * sens d ecriture. Ce sont des cas limites d essai, pas des charges d attaque.
 */
export const VALEURS_LIMITES = [
  ['Chaine vide', ''],
  ['Espace seul', ' '],
  ['Tres longue (1 000 caracteres)', 'A'.repeat(1000)],
  ['Emoji hors du plan de base', String.fromCodePoint(0x1f600, 0x1f469, 0x200d, 0x1f4bb)],
  ['Ecriture de droite a gauche', String.fromCharCode(0x202e) + 'gpj.exe'],
  ['Espace insecable', 'a' + String.fromCharCode(0x00a0) + 'b'],
  ['Largeur nulle', 'a' + String.fromCharCode(0x200b) + 'b'],
  ['Accents decomposes', 'e' + String.fromCharCode(0x0301)],
  ['Retours a la ligne melanges', 'a\r\nb\nc\rd'],
  ['Nombre maximal exact', String(Number.MAX_SAFE_INTEGER)],
  ['Nombre au-dela du sur', '9007199254740993'],
  ['Zero negatif', '-0'],
  ['Notation scientifique', '1e309'],
  ['Vrai et faux en texte', 'true'],
  ['Nul en texte', 'null'],
  ['JSON imbrique profond', '['.repeat(50) + ']'.repeat(50)]
];

/* --------------------- Identifiants derives d un nom ---------------------- */
/* Les espaces de noms normalises du RFC 9562. Un meme nom dans un meme espace
   donne toujours le meme identifiant : c est tout l interet des versions 3 et 5. */
export const ESPACES_UUID = {
  DNS: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  URL: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  OID: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  X500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8'
};

function uuidVersOctets(uuid) {
  const net = String(uuid).replace(/[^0-9a-fA-F]/g, '');
  if (net.length !== 32) throw new Error('espace de noms invalide : un UUID est attendu');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(net.substr(i * 2, 2), 16);
  return out;
}

function octetsVersUuid(o, version) {
  const copie = o.slice(0, 16);
  copie[6] = (copie[6] & 0x0f) | (version << 4);
  copie[8] = (copie[8] & 0x3f) | 0x80;
  const h = hex(copie);
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

function concatener(espace, nom) {
  const a = uuidVersOctets(espace);
  const b = new TextEncoder().encode(String(nom));
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** UUID version 5 : SHA-1 d un espace de noms et d un nom. Reproductible. */
export async function uuidV5(nom, espace = ESPACES_UUID.DNS) {
  const sujet = globalThis.crypto && globalThis.crypto.subtle;
  if (!sujet) throw new Error('crypto.subtle indisponible dans ce contexte');
  const empreinte = new Uint8Array(await sujet.digest('SHA-1', concatener(espace, nom)));
  return octetsVersUuid(empreinte, 5);
}

/** UUID version 3 : la meme idee, avec MD5. Conserve pour les systemes anciens. */
export function uuidV3(nom, espace = ESPACES_UUID.DNS) {
  return octetsVersUuid(md5Octets(concatener(espace, nom)), 3);
}
