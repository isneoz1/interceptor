/* Encodages et decodages — INTERCEPTOR (by NeoZ)
 *
 * Les encodages que l on rencontre a longueur de journee dans le trafic :
 * base64, URL, entites HTML, hexadecimal, echappements Unicode,
 * quoted-printable. Les alphabets plus rares vivent dans codecs-bases.js, les
 * operations de texte dans codecs-text.js, les formats structures dans
 * codecs-format.js et les encodages propres au web dans codecs-web.js.
 *
 * Fonctions pures, sans DOM ni API navigateur : la boite a outils s en sert,
 * les tests les executent hors navigateur. Chaque fonction leve une erreur
 * lisible sur une entree invalide — jamais de retour silencieux et faux.
 */
import {
  texteVersOctets, octetsVersTexte, octetsVersBinaire, binaireVersOctets,
  octetsVersHex, hexVersOctets
} from './bytes.js';

/* Les primitives d octets restent accessibles depuis ce module : c est ici que
   le reste de l interface vient les chercher depuis toujours. */
export { texteVersOctets, octetsVersTexte } from './bytes.js';

/* ROT13 vit avec les autres chiffres classiques, la mise en forme JSON avec
   les autres formats structures : on les republie plutot que de les ecrire
   deux fois. */
export { rot13 } from './codecs-text.js';
export { jsonJoli, jsonCompact } from './codecs-format.js';
import { codeDeLEntite, ENTITES_INVERSES, NOMBRE_ENTITES } from './entites-html.js';
export { NOMBRE_ENTITES };

/* -------------------------------- Base64 ---------------------------------- */
export function base64Encoder(texte) {
  return btoa(octetsVersBinaire(texteVersOctets(texte)));
}

export function base64Decoder(texte) {
  // Les espaces et les retours a la ligne sont toleres : un base64 colle depuis
  // un entete ou un journal arrive presque toujours coupe en morceaux.
  let net = String(texte).replace(/[\s\r\n]+/g, '');
  if (!net) return '';
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(net)) throw new Error('caractere invalide dans le base64');
  const reste = net.length % 4;
  if (reste === 1) throw new Error('longueur de base64 invalide');
  if (reste) net += '='.repeat(4 - reste);
  return octetsVersTexte(binaireVersOctets(atob(net)));
}

export function base64UrlEncoder(texte) {
  return base64Encoder(texte).split('+').join('-').split('/').join('_').split('=').join('');
}

export function base64UrlDecoder(texte) {
  const net = String(texte).trim().split('-').join('+').split('_').join('/');
  return base64Decoder(net);
}

/* --------------------------------- URL ------------------------------------ */
export function urlEncoder(texte) { return encodeURIComponent(String(texte)); }

export function urlDecoder(texte) {
  try { return decodeURIComponent(String(texte).split('+').join(' ')); }
  catch { throw new Error('sequence pourcent invalide'); }
}

/** Encode uniquement ce qui doit l etre dans une URL complete. */
export function urlEncoderComplet(texte) { return encodeURI(String(texte)); }

/** Encode tout, y compris les caracteres reserves : utile dans un parametre. */
export function urlEncoderTout(texte) {
  return [...texteVersOctets(texte)].map(o => '%' + o.toString(16).toUpperCase().padStart(2, '0')).join('');
}

/* ------------------------------ Entites HTML ------------------------------ */
/* Seuls ces cinq caracteres doivent etre echappes pour qu un texte reste sur
   dans une page ; la table complete des noms sert au decodage. */
const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function htmlEncoder(texte) {
  return String(texte).replace(/[&<>"']/g, c => ENTITES[c]);
}

export function htmlDecoder(texte) {
  return String(texte).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (entier, nom) => {
    if (nom[0] === '#') {
      const hex = nom[1] === 'x' || nom[1] === 'X';
      const code = parseInt(hex ? nom.slice(2) : nom.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return entier;
      try { return String.fromCodePoint(code); } catch { return entier; }
    }
    // Un nom inconnu reste tel quel : mieux vaut une entite visible qu un
    // caractere invente.
    const code = codeDeLEntite(nom);
    return code === null ? entier : String.fromCodePoint(code);
  });
}

/** Echappe tout caractere non ASCII en entite numerique : diagnostic d encodage. */
export function htmlEncoderTout(texte) {
  return [...String(texte)].map(c => {
    const code = c.codePointAt(0);
    return code < 128 ? htmlEncoder(c) : '&#' + code + ';';
  }).join('');
}

/** Encode avec les noms quand ils existent : la forme la plus lisible. */
export function htmlEncoderNomme(texte) {
  return [...String(texte)].map(c => {
    const code = c.codePointAt(0);
    if (ENTITES[c]) return ENTITES[c];
    const nom = ENTITES_INVERSES.get(code);
    return nom ? '&' + nom + ';' : (code < 128 ? c : '&#' + code + ';');
  }).join('');
}

/* ------------------------------ Hexadecimal ------------------------------- */
export function hexEncoder(texte) { return octetsVersHex(texteVersOctets(texte), ' '); }
export function hexDecoder(texte) { return octetsVersTexte(hexVersOctets(texte)); }

/** Hexadecimal a la maniere du C : 0x61, 0x62... */
export function hexEncoderC(texte) {
  return [...texteVersOctets(texte)].map(o => '0x' + o.toString(16).padStart(2, '0')).join(', ');
}

/* --------------------------- Echappements Unicode ------------------------- */
export function unicodeEncoder(texte) {
  // On parcourt les demi-codets, pas les points de code : un emoji s ecrit en
  // deux sequences \uXXXX, exactement comme JavaScript l ecrit lui-meme.
  // Parcourir les points de code perdrait le second demi-codet.
  const s = String(texte);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out += code < 128 ? s[i] : '\\u' + code.toString(16).padStart(4, '0');
  }
  return out;
}

export function unicodeDecoder(texte) {
  return String(texte)
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (e, h) => {
      const code = parseInt(h, 16);
      try { return String.fromCodePoint(code); } catch { return e; }
    })
    .replace(/\\u([0-9a-fA-F]{4})/g, (e, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (e, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Nom et point de code de chaque caractere : lecture d une chaine suspecte. */
export function pointsDeCode(texte) {
  return [...String(texte)].map(c =>
    'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') + ' ' + c
  ).join('\n');
}

/* --------------------------- Quoted-printable ----------------------------- */
export function qpDecoder(texte) {
  const sansCoupure = String(texte).replace(/=\r?\n/g, '');
  const octets = [];
  for (let i = 0; i < sansCoupure.length; i++) {
    const c = sansCoupure[i];
    if (c === '=' && /^[0-9a-fA-F]{2}$/.test(sansCoupure.substr(i + 1, 2))) {
      octets.push(parseInt(sansCoupure.substr(i + 1, 2), 16));
      i += 2;
    } else {
      for (const o of texteVersOctets(c)) octets.push(o);
    }
  }
  return octetsVersTexte(new Uint8Array(octets));
}

export function qpEncoder(texte) {
  let out = '';
  for (const octet of texteVersOctets(texte)) {
    if (octet === 9 || octet === 10 || octet === 13 || (octet >= 32 && octet <= 126 && octet !== 61)) {
      out += String.fromCharCode(octet);
    } else {
      out += '=' + octet.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return out;
}
