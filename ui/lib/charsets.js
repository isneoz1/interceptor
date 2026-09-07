/* Jeux de caracteres — INTERCEPTOR (by D4RK)
 *
 * Un corps servi sans « charset » dans son Content-Type, ou servi avec le
 * mauvais, arrive illisible. Le navigateur sait decoder une quarantaine de
 * jeux : on les propose tous, et on montre le resultat de chacun plutot que
 * de deviner lequel etait le bon.
 *
 * Corollaire utile : la reparation du mojibake, ce texte ou « e accent » est
 * devenu deux caracteres parce qu un octet UTF-8 a ete lu en windows-1252.
 */
/** Les jeux que le moteur du navigateur sait lire (norme WHATWG Encoding). */
export const JEUX = [
  'utf-8', 'utf-16le', 'utf-16be',
  'windows-1252', 'windows-1250', 'windows-1251', 'windows-1253', 'windows-1254',
  'windows-1255', 'windows-1256', 'windows-1257', 'windows-1258', 'windows-874',
  'iso-8859-2', 'iso-8859-3', 'iso-8859-4', 'iso-8859-5', 'iso-8859-6',
  'iso-8859-7', 'iso-8859-8', 'iso-8859-10', 'iso-8859-13', 'iso-8859-14',
  'iso-8859-15', 'iso-8859-16',
  'koi8-r', 'koi8-u', 'ibm866', 'macintosh', 'x-mac-cyrillic',
  'gbk', 'gb18030', 'big5', 'euc-jp', 'iso-2022-jp', 'shift_jis', 'euc-kr'
];

/** Decode des octets dans un jeu donne. Rend une erreur si le jeu est inconnu. */
export function decoderAvec(octets, jeu) {
  let decodeur;
  try { decodeur = new TextDecoder(jeu); }
  catch { throw new Error('jeu de caracteres inconnu de ce moteur : ' + jeu); }
  return decodeur.decode(octets);
}

/** Le jeu est-il disponible dans ce moteur ? Tous ne le sont pas partout. */
export function jeuxDisponibles() {
  return JEUX.filter(jeu => {
    try { new TextDecoder(jeu); return true; } catch { return false; }
  });
}

/**
 * Decode les memes octets dans chaque jeu et ne garde que les resultats
 * distincts : la bonne lecture se reconnait a l oeil, pas a une statistique.
 */
export function essayerJeux(octets, limite = 12) {
  const vus = new Set();
  const sorties = [];
  for (const jeu of jeuxDisponibles()) {
    let texte;
    try { texte = decoderAvec(octets, jeu); } catch { continue; }
    if (!texte || vus.has(texte)) continue;
    vus.add(texte);
    const remplacements = (texte.match(/\uFFFD/g) || []).length;
    sorties.push({ jeu, texte, remplacements });
    if (sorties.length >= limite * 3) break;
  }
  // Le moins de caracteres de remplacement d abord : c est le seul indice sur.
  return sorties.sort((a, b) => a.remplacements - b.remplacements).slice(0, limite);
}

/**
 * Repare un texte lu dans le mauvais jeu : on le reecrit octet par octet comme
 * le decodeur fautif l a vu, puis on le relit en UTF-8.
 */
export function reparerMojibake(texte, jeuFautif = 'windows-1252') {
  const s = String(texte);
  const octets = [];
  for (const c of s) {
    const code = c.codePointAt(0);
    // Un caractere hors de la table d origine ne peut pas venir de ce jeu :
    // on rend le texte tel quel plutot qu un resultat invente.
    if (code > 0xffff) return s;
    octets.push(code);
  }
  const table = tableInverse(jeuFautif);
  const bruts = [];
  for (const code of octets) {
    if (code < 0x80) { bruts.push(code); continue; }
    const octet = table.get(code);
    if (octet === undefined) return s;
    bruts.push(octet);
  }
  const relu = new TextDecoder('utf-8').decode(new Uint8Array(bruts));
  return relu.includes('\uFFFD') ? s : relu;
}

const CACHE = new Map();

/** Table « caractere -> octet » d un jeu simple sur un octet. */
function tableInverse(jeu) {
  if (CACHE.has(jeu)) return CACHE.get(jeu);
  const table = new Map();
  const octets = new Uint8Array(1);
  const decodeur = new TextDecoder(jeu);
  for (let o = 0x80; o <= 0xff; o++) {
    octets[0] = o;
    const c = decodeur.decode(octets);
    if (c && c !== '\uFFFD' && !table.has(c.codePointAt(0))) table.set(c.codePointAt(0), o);
  }
  CACHE.set(jeu, table);
  return table;
}

/* Les suites que produit un texte UTF-8 relu en windows-1252. On ne les ecrit
   pas a la main — ce serait illisible, et le projet proscrit les lettres
   accentuees dans le code : on les fabrique a partir des caracteres d origine. */
const CARACTERES_COURANTS = [
  '\u00e9', '\u00e8', '\u00e0', '\u00e7', '\u00ea', '\u00fb', '\u00f4', '\u00ee',
  '\u2019', '\u201c', '\u201d', '\u00ab', '\u00bb', '\u00a0', '\u20ac'
];

const SUITES_MOJIBAKE = (() => {
  try {
    const decodeur = new TextDecoder('windows-1252');
    const encodeur = new TextEncoder();
    return CARACTERES_COURANTS.map(c => decodeur.decode(encodeur.encode(c))).filter(x => x.length > 1);
  } catch { return []; }
})();

/**
 * Signale les traces de mojibake les plus courantes : les suites que produit
 * un texte UTF-8 relu en windows-1252.
 */
export function traceDeMojibake(texte) {
  const s = String(texte);
  const trouves = SUITES_MOJIBAKE.filter(x => s.includes(x));
  return { suspect: trouves.length > 0, suites: trouves };
}
