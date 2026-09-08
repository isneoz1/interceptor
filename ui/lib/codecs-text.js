/* Operations de texte et chiffres classiques — INTERCEPTOR (by NeoZ)
 *
 * ROT47, Atbash, Cesar, Vigenere, XOR, morse, alphabet radio, casse, lignes,
 * normalisation Unicode. Fonctions pures, sans DOM : la boite a outils les
 * affiche, les tests les executent hors navigateur.
 *
 * Les chiffres classiques ne protegent rien : ils servent a relire une valeur
 * obscurcie dans un parametre ou un cookie, pas a chiffrer quoi que ce soit.
 */
import { texteVersOctets, octetsVersTexte, octetsVersHex, hexVersOctets } from './bytes.js';

/* --------------------------------- ROT13 / ROT47 -------------------------- */
export function rot13(texte) {
  return String(texte).replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/** ROT47 : tourne les 94 caracteres imprimables, ponctuation comprise. */
export function rot47(texte) {
  let out = '';
  for (const c of String(texte)) {
    const code = c.charCodeAt(0);
    out += (code >= 33 && code <= 126) ? String.fromCharCode(33 + ((code - 33 + 47) % 94)) : c;
  }
  return out;
}

/** Atbash : A devient Z, B devient Y. Son propre inverse. */
export function atbash(texte) {
  return String(texte).replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
  });
}

/* --------------------------------- Cesar ---------------------------------- */
export function cesar(texte, decalage) {
  const d = ((Number(decalage) || 0) % 26 + 26) % 26;
  return String(texte).replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + d) % 26) + base);
  });
}

/** Les vingt-cinq decalages, pour reconnaitre le bon d un coup d oeil. */
export function cesarToutes(texte) {
  const out = [];
  for (let d = 1; d <= 25; d++) out.push({ decalage: d, texte: cesar(texte, d) });
  return out;
}

/* -------------------------------- Vigenere -------------------------------- */
/** Vigenere : Cesar dont le decalage suit les lettres d une cle. */
export function vigenere(texte, cle, dechiffrer = false) {
  const lettres = String(cle || '').replace(/[^a-zA-Z]/g, '');
  if (!lettres) throw new Error('la cle doit contenir au moins une lettre');
  let index = 0;
  return String(texte).replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    const k = lettres[index % lettres.length].toLowerCase().charCodeAt(0) - 97;
    index++;
    const d = dechiffrer ? (26 - k) % 26 : k;
    return String.fromCharCode(((c.charCodeAt(0) - base + d) % 26) + base);
  });
}

/* ----------------------------------- XOR ---------------------------------- */
/**
 * XOR octet par octet avec une cle repetee. La cle peut etre du texte ou de
 * l hexadecimal ; le resultat est rendu en octets, a l appelant de choisir sa
 * representation. L operation est sa propre reciproque.
 */
export function xorOctets(octets, cle, cleHex = false) {
  const k = cleHex ? hexVersOctets(cle) : texteVersOctets(cle);
  if (!k.length) throw new Error('cle vide');
  const out = new Uint8Array(octets.length);
  for (let i = 0; i < octets.length; i++) out[i] = octets[i] ^ k[i % k.length];
  return out;
}

export function xorTexte(texte, cle, cleHex = false) {
  return octetsVersTexte(xorOctets(texteVersOctets(texte), cle, cleHex));
}

export function xorHex(texte, cle, cleHex = false) {
  return octetsVersHex(xorOctets(texteVersOctets(texte), cle, cleHex), ' ');
}

/**
 * Cherche la cle d un octet unique : les 255 resultats, tries par
 * vraisemblance (proportion de caracteres imprimables). Aucune promesse, une
 * liste de candidats.
 */
export function xorForceUnOctet(octets) {
  const sorties = [];
  for (let cle = 1; cle < 256; cle++) {
    const out = new Uint8Array(octets.length);
    for (let i = 0; i < octets.length; i++) out[i] = octets[i] ^ cle;
    let bons = 0;
    for (const o of out) if (o === 9 || o === 10 || o === 13 || (o >= 32 && o <= 126)) bons++;
    const score = out.length ? bons / out.length : 0;
    if (score > 0.9) sorties.push({ cle, score: Math.round(score * 100), texte: octetsVersTexte(out) });
  }
  return sorties.sort((a, b) => b.score - a.score);
}

/* ---------------------------------- Morse --------------------------------- */
const MORSE = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
  i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.',
  q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
  y: '-.--', z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
};
const MORSE_INVERSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export function morseEncoder(texte) {
  const mots = String(texte).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return mots.map(mot => [...mot].map(c => {
    if (MORSE[c] === undefined) throw new Error('caractere sans code morse : ' + c);
    return MORSE[c];
  }).join(' ')).join(' / ');
}

export function morseDecoder(texte) {
  const net = String(texte).trim().replace(/[|]/g, '/');
  if (!net) return '';
  return net.split(/\s*\/\s*/).map(mot => mot.trim().split(/\s+/).filter(Boolean).map(code => {
    if (MORSE_INVERSE[code] === undefined) throw new Error('code morse inconnu : ' + code);
    return MORSE_INVERSE[code];
  }).join('')).join(' ');
}

/* --------------------------- Alphabet radio OTAN -------------------------- */
const OTAN = {
  a: 'Alfa', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot',
  g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima',
  m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo',
  s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey',
  x: 'Xray', y: 'Yankee', z: 'Zulu',
  0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four',
  5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine'
};

/** Epelle une valeur pour la dicter sans erreur : cle d API, empreinte, jeton. */
export function otanEncoder(texte) {
  return [...String(texte)].map(c => {
    const bas = c.toLowerCase();
    if (OTAN[bas]) return c === bas ? OTAN[bas].toLowerCase() : OTAN[bas];
    if (c === ' ') return '(espace)';
    return '(' + c + ')';
  }).join(' ');
}

/* ---------------------------------- Casse --------------------------------- */
const mots = texte => String(texte)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .split(/[^a-zA-Z0-9]+/)
  .filter(Boolean);

export function majuscules(texte) { return String(texte).toUpperCase(); }
export function minuscules(texte) { return String(texte).toLowerCase(); }
export function casseInversee(texte) {
  return [...String(texte)].map(c => c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()).join('');
}
export function capitaliser(texte) {
  return String(texte).replace(/\b[a-z]/g, c => c.toUpperCase());
}
export function camelCase(texte) {
  const m = mots(texte).map(x => x.toLowerCase());
  return m.map((x, i) => i ? x[0].toUpperCase() + x.slice(1) : x).join('');
}
export function pascalCase(texte) {
  return mots(texte).map(x => x[0].toUpperCase() + x.slice(1).toLowerCase()).join('');
}
export function snakeCase(texte) { return mots(texte).map(x => x.toLowerCase()).join('_'); }
export function kebabCase(texte) { return mots(texte).map(x => x.toLowerCase()).join('-'); }
export function constantCase(texte) { return mots(texte).map(x => x.toUpperCase()).join('_'); }

/* ------------------------------- Unicode ---------------------------------- */
export function normaliserNFC(texte) { return String(texte).normalize('NFC'); }
export function normaliserNFD(texte) { return String(texte).normalize('NFD'); }
export function normaliserNFKC(texte) { return String(texte).normalize('NFKC'); }
export function normaliserNFKD(texte) { return String(texte).normalize('NFKD'); }

/** Retire les signes diacritiques : « ete » reste lisible, la convention du projet. */
export function sansAccents(texte) {
  return String(texte).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Signale les caracteres invisibles ou trompeurs : espaces insecables, marques
 * de direction, largeur nulle. Ils servent a masquer du contenu dans une URL
 * ou un entete, et ne se voient jamais a l oeil nu.
 */
export function caracteresCaches(texte) {
  const SUSPECTS = /[\u00a0\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\ufeff\u2066-\u2069]/;
  const trouves = [];
  const s = String(texte);
  for (let i = 0; i < s.length; i++) {
    if (SUSPECTS.test(s[i])) {
      trouves.push({ index: i, code: 'U+' + s.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0') });
    }
  }
  return trouves;
}

export function retirerCaracteresCaches(texte) {
  return String(texte).replace(/[\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\ufeff\u2066-\u2069]/g, '').replace(/\u00a0/g, ' ');
}

/* ---------------------------------- Lignes -------------------------------- */
const lignesDe = texte => String(texte).split(/\r?\n/);

export function inverserTexte(texte) { return [...String(texte)].reverse().join(''); }
export function inverserLignes(texte) { return lignesDe(texte).reverse().join('\n'); }
export function trierLignes(texte) {
  return lignesDe(texte).slice().sort((a, b) => a.localeCompare(b)).join('\n');
}
export function trierLignesInverse(texte) {
  return lignesDe(texte).slice().sort((a, b) => b.localeCompare(a)).join('\n');
}
export function lignesUniques(texte) { return [...new Set(lignesDe(texte))].join('\n'); }
export function numeroterLignes(texte) {
  const l = lignesDe(texte);
  const large = String(l.length).length;
  return l.map((ligne, i) => String(i + 1).padStart(large, ' ') + '  ' + ligne).join('\n');
}
export function sansLignesVides(texte) { return lignesDe(texte).filter(l => l.trim()).join('\n'); }
export function couperEspaces(texte) { return lignesDe(texte).map(l => l.trim()).join('\n'); }
export function compacterEspaces(texte) { return String(texte).replace(/[ \t]+/g, ' ').trim(); }
export function sansEspaces(texte) { return String(texte).replace(/\s+/g, ''); }
export function lfVersCrlf(texte) { return String(texte).replace(/\r?\n/g, '\r\n'); }
export function crlfVersLf(texte) { return String(texte).replace(/\r\n/g, '\n'); }
export function melangerLignes(texte) {
  const l = lignesDe(texte);
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l.join('\n');
}

/* ------------------------------- Frequences ------------------------------- */
/** Comptage des caracteres, du plus frequent au moins frequent. */
export function frequences(texte, limite = 20) {
  const comptes = new Map();
  for (const c of String(texte)) comptes.set(c, (comptes.get(c) || 0) + 1);
  const total = String(texte).length || 1;
  return [...comptes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([c, n]) => ({
      caractere: c === ' ' ? '(espace)' : c === '\n' ? '(fin de ligne)' : c === '\t' ? '(tabulation)' : c,
      code: 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'),
      nombre: n,
      part: Math.round((n / total) * 1000) / 10
    }));
}


/* ------------------------- Autres chiffres classiques --------------------- */
/**
 * Transposition en zigzag (« rail fence ») : le texte descend et remonte sur
 * un nombre de rangees donne, puis se lit rangee par rangee.
 */
export function zigzagChiffrer(texte, rangees) {
  const n = Math.max(2, Math.min(64, Math.floor(Number(rangees) || 3)));
  const s = String(texte);
  const lignes = Array.from({ length: n }, () => []);
  let rangee = 0, pas = 1;
  for (const c of s) {
    lignes[rangee].push(c);
    if (rangee === 0) pas = 1;
    else if (rangee === n - 1) pas = -1;
    rangee += pas;
  }
  return lignes.map(l => l.join('')).join('');
}

export function zigzagDechiffrer(texte, rangees) {
  const n = Math.max(2, Math.min(64, Math.floor(Number(rangees) || 3)));
  const s = String(texte);
  const places = new Array(s.length);
  let rangee = 0, pas = 1;
  for (let i = 0; i < s.length; i++) {
    places[i] = rangee;
    if (rangee === 0) pas = 1;
    else if (rangee === n - 1) pas = -1;
    rangee += pas;
  }
  const sortie = new Array(s.length);
  let index = 0;
  for (let r = 0; r < n; r++) {
    for (let i = 0; i < s.length; i++) if (places[i] === r) sortie[i] = s[index++];
  }
  return sortie.join('');
}

/** Chiffre affine : chaque lettre devient (a * x + b) modulo 26. */
export function affine(texte, a, b, dechiffrer = false) {
  const A = Math.floor(Number(a));
  const B = Math.floor(Number(b));
  if (!Number.isInteger(A) || !Number.isInteger(B)) throw new Error('a et b doivent etre entiers');
  if (pgcd(((A % 26) + 26) % 26, 26) !== 1) {
    throw new Error('a doit etre premier avec 26 : 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23 ou 25');
  }
  const inverse = inverseModulaire(((A % 26) + 26) % 26, 26);
  return String(texte).replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    const x = c.charCodeAt(0) - base;
    const y = dechiffrer
      ? (inverse * (x - B + 26 * 26)) % 26
      : (A * x + B) % 26;
    return String.fromCharCode(base + ((y % 26) + 26) % 26);
  });
}

const pgcd = (a, b) => (b === 0 ? a : pgcd(b, a % b));

function inverseModulaire(a, m) {
  for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x;
  throw new Error('aucun inverse modulaire pour ' + a);
}

/* Chiffre de Bacon : chaque lettre devient cinq symboles A et B. Variante a
   vingt-six lettres, celle que produisent les outils modernes. */
const BACON = 'abcdefghijklmnopqrstuvwxyz';

export function baconChiffrer(texte) {
  return String(texte).toLowerCase().replace(/[^a-z ]/g, '').split('').map(c => {
    if (c === ' ') return '/';
    const i = BACON.indexOf(c);
    return i.toString(2).padStart(5, '0').split('0').join('A').split('1').join('B');
  }).join(' ');
}

export function baconDechiffrer(texte) {
  const groupes = String(texte).toUpperCase().replace(/[^AB/ ]/g, '').split(/\s+/).filter(Boolean);
  return groupes.map(g => {
    if (g === '/') return ' ';
    if (g.length !== 5) throw new Error('groupe de cinq symboles attendu : ' + g);
    const i = parseInt(g.split('A').join('0').split('B').join('1'), 2);
    if (i >= 26) throw new Error('groupe hors de l alphabet : ' + g);
    return BACON[i];
  }).join('');
}
