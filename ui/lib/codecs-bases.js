/* Encodages par alphabet — INTERCEPTOR (by NeoZ)
 *
 * Base32, base32hex, base58, base45, Ascii85, binaire, octal, decimal, et les
 * ponts directs entre representations d octets. Fonctions pures : la boite a
 * outils les affiche, les tests les executent hors navigateur.
 *
 * Regle commune a tout le fichier : une entree invalide leve une erreur
 * lisible. Jamais de resultat silencieux et faux.
 */
import {
  texteVersOctets, octetsVersTexte, octetsVersHex, hexVersOctets,
  octetsVersBase64, base64VersOctets
} from './bytes.js';

/* --------------------------------- Base32 --------------------------------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';          // RFC 4648 section 6
const B32HEX = '0123456789ABCDEFGHIJKLMNOPQRSTUV';       // RFC 4648 section 7

function base32Vers(octets, alphabet) {
  let bits = 0, valeur = 0, out = '';
  for (const octet of octets) {
    valeur = (valeur * 256) + octet;
    bits += 8;
    while (bits >= 5) { out += alphabet[(valeur >>> (bits - 5)) & 31]; bits -= 5; valeur &= (1 << bits) - 1; }
  }
  if (bits > 0) out += alphabet[(valeur << (5 - bits)) & 31];
  while (out.length % 8) out += '=';
  return out;
}

function base32Octets(texte, alphabet) {
  const net = String(texte).replace(/[\s\r\n=]+/g, '').toUpperCase();
  if (!net) return new Uint8Array(0);
  const octets = [];
  let bits = 0, valeur = 0;
  for (const c of net) {
    const index = alphabet.indexOf(c);
    if (index < 0) throw new Error('caractere invalide dans le base32 : ' + c);
    valeur = (valeur << 5) | index;
    bits += 5;
    if (bits >= 8) { octets.push((valeur >>> (bits - 8)) & 0xff); bits -= 8; valeur &= (1 << bits) - 1; }
  }
  return new Uint8Array(octets);
}

/** Octets bruts d une chaine base32 : les secrets OTP arrivent sous cette forme. */
export function base32VersOctets(texte) { return base32Octets(texte, B32); }
export function octetsVersBase32(octets) { return base32Vers(octets, B32); }

export function base32Encoder(texte) { return base32Vers(texteVersOctets(texte), B32); }
export function base32Decoder(texte) { return octetsVersTexte(base32Octets(texte, B32)); }
export function base32HexEncoder(texte) { return base32Vers(texteVersOctets(texte), B32HEX); }
export function base32HexDecoder(texte) { return octetsVersTexte(base32Octets(texte, B32HEX)); }

/* --------------------------------- Base58 --------------------------------- */
/* Alphabet Bitcoin : ni 0, ni O, ni I, ni l — les caracteres qu on confond. */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58OctetsVers(octets) {
  if (!octets.length) return '';
  const chiffres = [0];
  for (const octet of octets) {
    let report = octet;
    for (let i = 0; i < chiffres.length; i++) {
      const x = (chiffres[i] * 256) + report;
      chiffres[i] = x % 58;
      report = Math.floor(x / 58);
    }
    while (report) { chiffres.push(report % 58); report = Math.floor(report / 58); }
  }
  let out = '';
  for (const octet of octets) { if (octet === 0) out += B58[0]; else break; }
  for (let i = chiffres.length - 1; i >= 0; i--) out += B58[chiffres[i]];
  return out;
}

export function base58VersOctets(texte) {
  const net = String(texte).replace(/[\s\r\n]+/g, '');
  if (!net) return new Uint8Array(0);
  const octets = [0];
  for (const c of net) {
    const index = B58.indexOf(c);
    if (index < 0) throw new Error('caractere invalide dans le base58 : ' + c);
    let report = index;
    for (let i = 0; i < octets.length; i++) {
      const x = octets[i] * 58 + report;
      octets[i] = x & 0xff;
      report = x >> 8;
    }
    while (report) { octets.push(report & 0xff); report >>= 8; }
  }
  const tete = [];
  for (const c of net) { if (c === B58[0]) tete.push(0); else break; }
  return new Uint8Array(tete.concat(octets.reverse()));
}

export function base58Encoder(texte) { return base58OctetsVers(texteVersOctets(texte)); }
export function base58Decoder(texte) { return octetsVersTexte(base58VersOctets(texte)); }

/* --------------------------------- Base45 --------------------------------- */
/* RFC 9285 : l encodage des certificats sanitaires europeens et des QR codes. */
const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

export function base45Encoder(texte) {
  const octets = texteVersOctets(texte);
  let out = '';
  for (let i = 0; i < octets.length; i += 2) {
    if (i + 1 < octets.length) {
      let n = octets[i] * 256 + octets[i + 1];
      const c = n % 45; n = (n - c) / 45;
      const d = n % 45; const e = (n - d) / 45;
      out += B45[c] + B45[d] + B45[e];
    } else {
      const n = octets[i];
      out += B45[n % 45] + B45[(n - (n % 45)) / 45];
    }
  }
  return out;
}

export function base45Decoder(texte) {
  const net = String(texte).replace(/[\r\n]+/g, '');
  if (!net) return '';
  const valeurs = [];
  for (const c of net) {
    const index = B45.indexOf(c);
    if (index < 0) throw new Error('caractere invalide dans le base45 : ' + c);
    valeurs.push(index);
  }
  if (valeurs.length % 3 === 1) throw new Error('longueur de base45 invalide');
  const octets = [];
  for (let i = 0; i < valeurs.length; i += 3) {
    if (i + 2 < valeurs.length) {
      const n = valeurs[i] + valeurs[i + 1] * 45 + valeurs[i + 2] * 45 * 45;
      if (n > 0xffff) throw new Error('groupe base45 hors limite');
      octets.push((n >> 8) & 0xff, n & 0xff);
    } else {
      const n = valeurs[i] + valeurs[i + 1] * 45;
      if (n > 0xff) throw new Error('groupe base45 final hors limite');
      octets.push(n);
    }
  }
  return octetsVersTexte(new Uint8Array(octets));
}

/* -------------------------------- Ascii85 --------------------------------- */
/* Variante Adobe : « z » abrege quatre octets nuls, « <~ ~> » encadre. */
export function ascii85Encoder(texte) {
  const octets = texteVersOctets(texte);
  let out = '';
  for (let i = 0; i < octets.length; i += 4) {
    const reste = Math.min(4, octets.length - i);
    let n = 0;
    for (let j = 0; j < 4; j++) n = n * 256 + (j < reste ? octets[i + j] : 0);
    if (reste === 4 && n === 0) { out += 'z'; continue; }
    const groupe = [];
    for (let j = 0; j < 5; j++) { groupe.unshift(String.fromCharCode(33 + (n % 85))); n = Math.floor(n / 85); }
    out += groupe.slice(0, reste + 1).join('');
  }
  return out;
}

export function ascii85Decoder(texte) {
  let net = String(texte).replace(/[\s\r\n]+/g, '');
  if (net.startsWith('<~')) net = net.slice(2);
  if (net.endsWith('~>')) net = net.slice(0, -2);
  const octets = [];
  let groupe = [];
  for (const c of net) {
    if (c === 'z' && !groupe.length) { octets.push(0, 0, 0, 0); continue; }
    const code = c.charCodeAt(0);
    if (code < 33 || code > 117) throw new Error('caractere invalide dans l Ascii85 : ' + c);
    groupe.push(code);
    if (groupe.length === 5) {
      let n = 0;
      for (const g of groupe) n = n * 85 + (g - 33);
      if (n > 0xffffffff) throw new Error('groupe Ascii85 hors limite');
      octets.push((n / 16777216) & 0xff, (n / 65536) & 0xff, (n / 256) & 0xff, n & 0xff);
      groupe = [];
    }
  }
  if (groupe.length === 1) throw new Error('groupe Ascii85 incomplet');
  if (groupe.length > 1) {
    const reste = groupe.length;
    while (groupe.length < 5) groupe.push(117);            // remplissage par « u »
    let n = 0;
    for (const g of groupe) n = n * 85 + (g - 33);
    const quatre = [(n / 16777216) & 0xff, (n / 65536) & 0xff, (n / 256) & 0xff, n & 0xff];
    for (let i = 0; i < reste - 1; i++) octets.push(quatre[i]);
  }
  return octetsVersTexte(new Uint8Array(octets));
}

/* --------------------- Binaire, octal, decimal par octet ------------------ */
export function binaireEncoder(texte) {
  return [...texteVersOctets(texte)].map(o => o.toString(2).padStart(8, '0')).join(' ');
}

export function binaireDecoder(texte) {
  const net = String(texte).replace(/[\s\r\n_.,-]+/g, '');
  if (!net) return '';
  if (!/^[01]+$/.test(net)) throw new Error('caractere non binaire');
  if (net.length % 8) throw new Error('nombre de bits non multiple de huit');
  const octets = new Uint8Array(net.length / 8);
  for (let i = 0; i < octets.length; i++) octets[i] = parseInt(net.substr(i * 8, 8), 2);
  return octetsVersTexte(octets);
}

export function octalEncoder(texte) {
  return [...texteVersOctets(texte)].map(o => o.toString(8).padStart(3, '0')).join(' ');
}

export function octalDecoder(texte) {
  const morceaux = String(texte).trim().split(/[\s\r\n,]+/).filter(Boolean);
  const octets = new Uint8Array(morceaux.length);
  for (let i = 0; i < morceaux.length; i++) {
    if (!/^[0-7]{1,3}$/.test(morceaux[i])) throw new Error('valeur octale invalide : ' + morceaux[i]);
    const v = parseInt(morceaux[i], 8);
    if (v > 255) throw new Error('valeur octale hors d un octet : ' + morceaux[i]);
    octets[i] = v;
  }
  return octetsVersTexte(octets);
}

export function decimalEncoder(texte) {
  return [...texteVersOctets(texte)].join(' ');
}

export function decimalDecoder(texte) {
  const morceaux = String(texte).trim().split(/[\s\r\n,;]+/).filter(Boolean);
  const octets = new Uint8Array(morceaux.length);
  for (let i = 0; i < morceaux.length; i++) {
    const v = Number(morceaux[i]);
    if (!Number.isInteger(v) || v < 0 || v > 255) throw new Error('valeur hors d un octet : ' + morceaux[i]);
    octets[i] = v;
  }
  return octetsVersTexte(octets);
}

/* ------------------- Ponts directs entre representations ------------------ */
export function base64VersHex(texte) { return octetsVersHex(base64VersOctets(texte), ' '); }
export function hexVersBase64(texte) { return octetsVersBase64(hexVersOctets(texte)); }
export function base64VersBinaire(texte) {
  return [...base64VersOctets(texte)].map(o => o.toString(2).padStart(8, '0')).join(' ');
}
export function hexVersDecimal(texte) { return [...hexVersOctets(texte)].join(' '); }

/* --------------------------- Bases de nombres ----------------------------- */
/**
 * Lit un entier ecrit dans une base de 2 a 36 et le rend en BigInt : le
 * panneau « Nombres » le reecrit ensuite dans toutes les autres bases. On
 * passe par BigInt pour ne perdre aucun chiffre sur un identifiant long.
 */
export function convertirNombre(valeur, baseSource) {
  const brut = String(valeur).trim().replace(/[\s_]+/g, '');
  if (!brut) throw new Error('valeur vide');
  const base = Number(baseSource);
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new Error('base hors de 2 a 36');
  const negatif = brut.startsWith('-');
  const corps = (negatif ? brut.slice(1) : brut).replace(/^0[xbo]/i, '');
  if (!corps) throw new Error('valeur vide');
  const chiffres = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
  let n = 0n;
  for (const c of corps.toLowerCase()) {
    const index = chiffres.indexOf(c);
    if (index < 0) throw new Error('chiffre « ' + c + ' » impossible en base ' + base);
    n = n * BigInt(base) + BigInt(index);
  }
  return negatif ? -n : n;
}

/* --------------------------- Base62 et Crockford --------------------------- */
/* Base62 : alphabet chiffres + lettres, sans separateur ni remplissage. On la
   croise dans les identifiants courts et les raccourcisseurs d URL. Comme
   base58, elle traite les octets comme un grand nombre : les zeros de tete sont
   donc notes explicitement pour rester reversibles. */
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function versAlphabet(octets, alphabet) {
  if (!octets.length) return '';
  const base = alphabet.length;
  const chiffres = [0];
  for (const octet of octets) {
    let report = octet;
    for (let i = 0; i < chiffres.length; i++) {
      report += chiffres[i] << 8;
      chiffres[i] = report % base;
      report = (report / base) | 0;
    }
    while (report > 0) { chiffres.push(report % base); report = (report / base) | 0; }
  }
  let sortie = '';
  for (const octet of octets) { if (octet === 0) sortie += alphabet[0]; else break; }
  for (let i = chiffres.length - 1; i >= 0; i--) sortie += alphabet[chiffres[i]];
  return sortie;
}

function depuisAlphabet(texte, alphabet, nom) {
  const net = String(texte).replace(/\s+/g, '');
  if (!net) return new Uint8Array(0);
  const base = alphabet.length;
  const octets = [0];
  for (const c of net) {
    const index = alphabet.indexOf(c);
    if (index < 0) throw new Error('caractere invalide dans le ' + nom + ' : ' + c);
    let report = index;
    for (let i = 0; i < octets.length; i++) {
      report += octets[i] * base;
      octets[i] = report & 0xff;
      report >>= 8;
    }
    while (report > 0) { octets.push(report & 0xff); report >>= 8; }
  }
  let zeros = 0;
  for (const c of net) { if (c === alphabet[0]) zeros++; else break; }
  return new Uint8Array([...new Array(zeros).fill(0), ...octets.reverse()]);
}

export function base62Encoder(texte) { return versAlphabet(texteVersOctets(texte), B62); }
export function base62Decoder(texte) { return octetsVersTexte(depuisAlphabet(texte, B62, 'base62')); }

/* Base32 de Crockford : alphabet sans I, L, O ni U, precisement pour qu on ne
   confonde plus 1/I/L ni 0/O. A la lecture on replie donc ces caracteres vers
   le chiffre voulu, et les traits d union de confort sont ignores. */
const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function crockfordEncoder(texte) {
  const octets = texteVersOctets(texte);
  let bits = 0, valeur = 0, out = '';
  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) { out += CROCK[(valeur >>> (bits - 5)) & 31]; bits -= 5; valeur &= (1 << bits) - 1; }
  }
  if (bits > 0) out += CROCK[(valeur << (5 - bits)) & 31];
  return out;
}

export function crockfordDecoder(texte) {
  const net = String(texte).replace(/[\s-]+/g, '').toUpperCase()
    .replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
  if (!net) return '';
  const octets = [];
  let bits = 0, valeur = 0;
  for (const c of net) {
    const index = CROCK.indexOf(c);
    if (index < 0) throw new Error('caractere invalide dans le base32 Crockford : ' + c);
    valeur = (valeur << 5) | index;
    bits += 5;
    if (bits >= 8) { octets.push((valeur >>> (bits - 8)) & 0xff); bits -= 8; valeur &= (1 << bits) - 1; }
  }
  return octetsVersTexte(new Uint8Array(octets));
}
