/* Primitives d octets — INTERCEPTOR (by D4RK)
 *
 * Le socle commun de tous les encodages : texte <-> octets, octets <-> chaine
 * binaire, octets <-> hexadecimal, octets <-> base64. Aucun DOM, aucune API
 * d extension : les tests executent ces fonctions hors navigateur.
 *
 * Tout le reste (codecs.js, codecs-bases.js, codecs-text.js, codecs-web.js,
 * hashes.js) se sert d ici plutot que de redefinir les memes boucles.
 */

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

/** Texte -> octets UTF-8. */
export function texteVersOctets(texte) { return encodeur.encode(String(texte)); }

/** Octets UTF-8 -> texte. Les octets invalides deviennent U+FFFD. */
export function octetsVersTexte(octets) { return decodeur.decode(octets); }

/** Octets -> chaine ou chaque caractere vaut un octet (latin-1). */
export function octetsVersBinaire(octets) {
  let out = '';
  const PAS = 0x8000;
  for (let i = 0; i < octets.length; i += PAS) {
    out += String.fromCharCode.apply(null, octets.subarray(i, i + PAS));
  }
  return out;
}

/** Chaine latin-1 -> octets. */
export function binaireVersOctets(binaire) {
  const out = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) out[i] = binaire.charCodeAt(i) & 0xff;
  return out;
}

/* -------------------------------- Hexadecimal ----------------------------- */
export function octetsVersHex(octets, separateur = '') {
  return [...octets].map(o => o.toString(16).padStart(2, '0')).join(separateur);
}

/**
 * Hexadecimal -> octets. Tolere les separateurs habituels (espaces, deux-points,
 * tirets, virgules) et le prefixe 0x, parce qu un hexadecimal colle depuis un
 * journal ou un entete arrive presque toujours decore.
 */
export function hexVersOctets(texte) {
  const net = String(texte).replace(/0x/gi, '').replace(/[\s\r\n:,_.-]+/g, '');
  if (!net) return new Uint8Array(0);
  if (net.length % 2) throw new Error('nombre impair de chiffres hexadecimaux');
  if (!/^[0-9a-fA-F]+$/.test(net)) throw new Error('caractere non hexadecimal');
  const octets = new Uint8Array(net.length / 2);
  for (let i = 0; i < octets.length; i++) octets[i] = parseInt(net.substr(i * 2, 2), 16);
  return octets;
}

/* ---------------------------------- Base64 -------------------------------- */
export function octetsVersBase64(octets) { return btoa(octetsVersBinaire(octets)); }

/** Base64 -> octets. Espaces toleres, remplissage facultatif, variante URL admise. */
export function base64VersOctets(texte) {
  let net = String(texte).replace(/[\s\r\n]+/g, '');
  if (!net) return new Uint8Array(0);
  if (/^[A-Za-z0-9_-]*={0,2}$/.test(net) && /[-_]/.test(net)) {
    net = net.split('-').join('+').split('_').join('/');
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(net)) throw new Error('caractere invalide dans le base64');
  const reste = net.length % 4;
  if (reste === 1) throw new Error('longueur de base64 invalide');
  if (reste) net += '='.repeat(4 - reste);
  return binaireVersOctets(atob(net));
}

