/* HPACK — compression des en-tetes HTTP/2 (RFC 7541) — INTERCEPTOR (by NeoZ)
 *
 * Une trame HEADERS ne transporte pas des en-tetes lisibles : elle transporte
 * un bloc compresse. Sans ce module, le decodeur de trames s arretait au bord
 * en disant « compresse HPACK, non decompresse ici ». Il lit maintenant le
 * bloc jusqu au bout.
 *
 * Trois mecanismes, dans l ordre de la RFC :
 *   - section 5.1 : les entiers, sur un prefixe de N bits puis continuation ;
 *   - section 5.2 et annexe B : les chaines, litterales ou codees en Huffman ;
 *   - sections 2 et 6 : la table statique (61 entrees), la table dynamique
 *     alimentee au fil du flux, et les quatre formes de representation.
 *
 * Verifie contre les exemples complets de l annexe C de la RFC.
 */

/* --------------------------- Table statique (annexe A) -------------------- */
/* 61 entrees, indexees a partir de 1. Le couple vide signifie « nom seul ». */
export const TABLE_STATIQUE = [
  [':authority', ''],
  [':method', 'GET'],
  [':method', 'POST'],
  [':path', '/'],
  [':path', '/index.html'],
  [':scheme', 'http'],
  [':scheme', 'https'],
  [':status', '200'],
  [':status', '204'],
  [':status', '206'],
  [':status', '304'],
  [':status', '400'],
  [':status', '404'],
  [':status', '500'],
  ['accept-charset', ''],
  ['accept-encoding', 'gzip, deflate'],
  ['accept-language', ''],
  ['accept-ranges', ''],
  ['accept', ''],
  ['access-control-allow-origin', ''],
  ['age', ''],
  ['allow', ''],
  ['authorization', ''],
  ['cache-control', ''],
  ['content-disposition', ''],
  ['content-encoding', ''],
  ['content-language', ''],
  ['content-length', ''],
  ['content-location', ''],
  ['content-range', ''],
  ['content-type', ''],
  ['cookie', ''],
  ['date', ''],
  ['etag', ''],
  ['expect', ''],
  ['expires', ''],
  ['from', ''],
  ['host', ''],
  ['if-match', ''],
  ['if-modified-since', ''],
  ['if-none-match', ''],
  ['if-range', ''],
  ['if-unmodified-since', ''],
  ['last-modified', ''],
  ['link', ''],
  ['location', ''],
  ['max-forwards', ''],
  ['proxy-authenticate', ''],
  ['proxy-authorization', ''],
  ['range', ''],
  ['referer', ''],
  ['refresh', ''],
  ['retry-after', ''],
  ['server', ''],
  ['set-cookie', ''],
  ['strict-transport-security', ''],
  ['transfer-encoding', ''],
  ['user-agent', ''],
  ['vary', ''],
  ['via', ''],
  ['www-authenticate', '']
];

/* ------------------------ Code de Huffman (annexe B) ---------------------- */
/* [code, longueur en bits] pour les symboles 0 a 255, puis 256 = fin de flux.
   Table publiee, reproduite telle quelle : aucune valeur n est calculee. */
const HUFFMAN = [
  [0x1ff8, 13], [0x7fffd8, 23], [0xfffffe2, 28], [0xfffffe3, 28], [0xfffffe4, 28],
  [0xfffffe5, 28], [0xfffffe6, 28], [0xfffffe7, 28], [0xfffffe8, 28], [0xffffea, 24],
  [0x3ffffffc, 30], [0xfffffe9, 28], [0xfffffea, 28], [0x3ffffffd, 30], [0xfffffeb, 28],
  [0xfffffec, 28], [0xfffffed, 28], [0xfffffee, 28], [0xfffffef, 28], [0xffffff0, 28],
  [0xffffff1, 28], [0xffffff2, 28], [0x3ffffffe, 30], [0xffffff3, 28], [0xffffff4, 28],
  [0xffffff5, 28], [0xffffff6, 28], [0xffffff7, 28], [0xffffff8, 28], [0xffffff9, 28],
  [0xffffffa, 28], [0xffffffb, 28],
  [0x14, 6], [0x3f8, 10], [0x3f9, 10], [0xffa, 12], [0x1ff9, 13], [0x15, 6],
  [0xf8, 8], [0x7fa, 11], [0x3fa, 10], [0x3fb, 10], [0xf9, 8], [0x7fb, 11],
  [0xfa, 8], [0x16, 6], [0x17, 6], [0x18, 6],
  [0x0, 5], [0x1, 5], [0x2, 5], [0x19, 6], [0x1a, 6], [0x1b, 6], [0x1c, 6],
  [0x1d, 6], [0x1e, 6], [0x1f, 6],
  [0x5c, 7], [0xfb, 8], [0x7ffc, 15], [0x20, 6], [0xffb, 12], [0x3fc, 10],
  [0x1ffa, 13],
  [0x21, 6], [0x5d, 7], [0x5e, 7], [0x5f, 7], [0x60, 7], [0x61, 7], [0x62, 7],
  [0x63, 7], [0x64, 7], [0x65, 7], [0x66, 7], [0x67, 7], [0x68, 7], [0x69, 7],
  [0x6a, 7], [0x6b, 7], [0x6c, 7], [0x6d, 7], [0x6e, 7], [0x6f, 7], [0x70, 7],
  [0x71, 7], [0x72, 7], [0xfc, 8], [0x73, 7], [0xfd, 8],
  [0x1ffb, 13], [0x7fff0, 19], [0x1ffc, 13], [0x3ffc, 14], [0x22, 6], [0x7ffd, 15],
  [0x3, 5], [0x23, 6], [0x4, 5], [0x24, 6], [0x5, 5], [0x25, 6], [0x26, 6],
  [0x27, 6], [0x6, 5], [0x74, 7], [0x75, 7], [0x28, 6], [0x29, 6], [0x2a, 6],
  [0x7, 5], [0x2b, 6], [0x76, 7], [0x2c, 6], [0x8, 5], [0x9, 5], [0x2d, 6],
  [0x77, 7], [0x78, 7], [0x79, 7], [0x7a, 7], [0x7b, 7],
  [0x7ffe, 15], [0x7fc, 11], [0x3ffd, 14], [0x1ffd, 13], [0xffffffc, 28],
  [0xfffe6, 20], [0x3fffd2, 22], [0xfffe7, 20], [0xfffe8, 20], [0x3fffd3, 22],
  [0x3fffd4, 22], [0x3fffd5, 22], [0x7fffd9, 23], [0x3fffd6, 22], [0x7fffda, 23],
  [0x7fffdb, 23], [0x7fffdc, 23], [0x7fffdd, 23], [0x7fffde, 23], [0xffffeb, 24],
  [0x7fffdf, 23], [0xffffec, 24], [0xffffed, 24], [0x3fffd7, 22], [0x7fffe0, 23],
  [0xffffee, 24], [0x7fffe1, 23], [0x7fffe2, 23], [0x7fffe3, 23], [0x7fffe4, 23],
  [0x1fffdc, 21], [0x3fffd8, 22], [0x7fffe5, 23], [0x3fffd9, 22], [0x7fffe6, 23],
  [0x7fffe7, 23], [0xffffef, 24], [0x3fffda, 22], [0x1fffdd, 21], [0xfffe9, 20],
  [0x3fffdb, 22], [0x3fffdc, 22], [0x7fffe8, 23], [0x7fffe9, 23], [0x1fffde, 21],
  [0x7fffea, 23], [0x3fffdd, 22], [0x3fffde, 22], [0xfffff0, 24], [0x1fffdf, 21],
  [0x3fffdf, 22], [0x7fffeb, 23], [0x7fffec, 23], [0x1fffe0, 21], [0x1fffe1, 21],
  [0x3fffe0, 22], [0x1fffe2, 21], [0x7fffed, 23], [0x3fffe1, 22], [0x7fffee, 23],
  [0x7fffef, 23], [0xfffea, 20], [0x3fffe2, 22], [0x3fffe3, 22], [0x3fffe4, 22],
  [0x7ffff0, 23], [0x3fffe5, 22], [0x3fffe6, 22], [0x7ffff1, 23], [0x3ffffe0, 26],
  [0x3ffffe1, 26], [0xfffeb, 20], [0x7fff1, 19], [0x3fffe7, 22], [0x7ffff2, 23],
  [0x3fffe8, 22], [0x1ffffec, 25], [0x3ffffe2, 26], [0x3ffffe3, 26], [0x3ffffe4, 26],
  [0x7ffffde, 27], [0x7ffffdf, 27], [0x3ffffe5, 26], [0xfffff1, 24], [0x1ffffed, 25],
  [0x7fff2, 19], [0x1fffe3, 21], [0x3ffffe6, 26], [0x7ffffe0, 27], [0x7ffffe1, 27],
  [0x3ffffe7, 26], [0x7ffffe2, 27], [0xfffff2, 24], [0x1fffe4, 21], [0x1fffe5, 21],
  [0x3ffffe8, 26], [0x3ffffe9, 26], [0xffffffd, 28], [0x7ffffe3, 27], [0x7ffffe4, 27],
  [0x7ffffe5, 27], [0xfffec, 20], [0xfffff3, 24], [0xfffed, 20], [0x1fffe6, 21],
  [0x3fffe9, 22], [0x1fffe7, 21], [0x1fffe8, 21], [0x7ffff3, 23], [0x3fffea, 22],
  [0x3fffeb, 22], [0x1ffffee, 25], [0x1ffffef, 25], [0xfffff4, 24], [0xfffff5, 24],
  [0x3ffffea, 26], [0x7ffff4, 23], [0x3ffffeb, 26], [0x7ffffe6, 27], [0x3ffffec, 26],
  [0x3ffffed, 26], [0x7ffffe7, 27], [0x7ffffe8, 27], [0x7ffffe9, 27], [0x7ffffea, 27],
  [0x7ffffeb, 27], [0xffffffe, 28], [0x7ffffec, 27], [0x7ffffed, 27], [0x7ffffee, 27],
  [0x7ffffef, 27], [0x7fffff0, 27], [0x3ffffee, 26],
  [0x3fffffff, 30]                                   /* 256 : fin de flux */
];

/* Arbre de decodage construit une fois : chaque noeud porte deux branches. */
let racineHuffman = null;
function arbreHuffman() {
  if (racineHuffman) return racineHuffman;
  racineHuffman = {};
  for (let symbole = 0; symbole < HUFFMAN.length; symbole++) {
    const [code, bits] = HUFFMAN[symbole];
    let noeud = racineHuffman;
    for (let i = bits - 1; i >= 0; i--) {
      const bit = (code >>> i) & 1;
      if (i === 0) noeud[bit] = { symbole };
      else noeud = (noeud[bit] = noeud[bit] || {});
    }
  }
  return racineHuffman;
}

/** Decode une suite d octets codee en Huffman (RFC 7541 section 5.2). */
export function decoderHuffman(octets) {
  const arbre = arbreHuffman();
  let noeud = arbre;
  const sortie = [];
  let bitsDePadding = 0;

  for (const octet of octets) {
    for (let i = 7; i >= 0; i--) {
      const bit = (octet >>> i) & 1;
      noeud = noeud[bit];
      if (!noeud) throw new Error('Huffman : suite de bits absente de la table');
      if (noeud.symbole !== undefined) {
        if (noeud.symbole === 256) throw new Error('Huffman : symbole de fin de flux rencontre dans la charge');
        sortie.push(noeud.symbole);
        noeud = arbre;
        bitsDePadding = 0;
      } else {
        bitsDePadding++;
      }
    }
  }
  /* Le remplissage final doit etre les bits de poids fort du symbole de fin
     de flux, et tenir sur moins d un octet (section 5.2). */
  if (bitsDePadding > 7) throw new Error('Huffman : remplissage final trop long');
  return new Uint8Array(sortie);
}

/** Encode des octets en Huffman, avec le remplissage exige par la RFC. */
export function encoderHuffman(octets) {
  let tampon = 0n;
  let bits = 0;
  const sortie = [];
  for (const octet of octets) {
    const [code, longueur] = HUFFMAN[octet];
    tampon = (tampon << BigInt(longueur)) | BigInt(code);
    bits += longueur;
    while (bits >= 8) {
      bits -= 8;
      sortie.push(Number((tampon >> BigInt(bits)) & 0xffn));
    }
  }
  if (bits) {
    // Remplissage : les bits de poids fort du symbole de fin de flux, qui
    // valent tous 1.
    tampon = (tampon << BigInt(8 - bits)) | ((1n << BigInt(8 - bits)) - 1n);
    sortie.push(Number(tampon & 0xffn));
  }
  return new Uint8Array(sortie);
}

/* ----------------------------- Lecteur de bits ---------------------------- */
class Lecteur {
  constructor(octets) { this.o = octets; this.i = 0; }
  reste() { return this.o.length - this.i; }
  octet() {
    if (this.i >= this.o.length) throw new Error('bloc HPACK tronque');
    return this.o[this.i++];
  }
  tranche(n) {
    if (this.i + n > this.o.length) throw new Error('bloc HPACK tronque');
    const t = this.o.subarray(this.i, this.i + n);
    this.i += n;
    return t;
  }
}

/** Entier a prefixe de N bits (RFC 7541 section 5.1). */
export function decoderEntier(lecteur, bitsPrefixe, premierOctet) {
  const masque = (1 << bitsPrefixe) - 1;
  const premier = premierOctet === undefined ? lecteur.octet() : premierOctet;
  let valeur = premier & masque;
  if (valeur < masque) return valeur;
  let decalage = 0;
  for (;;) {
    const o = lecteur.octet();
    valeur += (o & 0x7f) * Math.pow(2, decalage);
    if (!(o & 0x80)) break;
    decalage += 7;
    if (decalage > 28) throw new Error('entier HPACK hors de portee');
  }
  return valeur;
}

/** Ecrit un entier a prefixe de N bits ; `drapeaux` occupe les bits de tete. */
export function encoderEntier(valeur, bitsPrefixe, drapeaux = 0) {
  const masque = (1 << bitsPrefixe) - 1;
  const sortie = [];
  if (valeur < masque) { sortie.push(drapeaux | valeur); return new Uint8Array(sortie); }
  sortie.push(drapeaux | masque);
  let reste = valeur - masque;
  while (reste >= 128) { sortie.push((reste % 128) + 128); reste = Math.floor(reste / 128); }
  sortie.push(reste);
  return new Uint8Array(sortie);
}

const TEXTE = new TextDecoder('utf-8', { fatal: false });

/** Chaine litterale, eventuellement codee en Huffman (section 5.2). */
function lireChaine(lecteur) {
  const premier = lecteur.octet();
  const huffman = !!(premier & 0x80);
  const longueur = decoderEntier(lecteur, 7, premier);
  const brut = lecteur.tranche(longueur);
  return { texte: TEXTE.decode(huffman ? decoderHuffman(brut) : brut), huffman, octets: longueur };
}

/* ---------------------------- Table dynamique ----------------------------- */
/* La taille d une entree est celle definie par la RFC : longueur du nom, plus
   longueur de la valeur, plus 32 octets de surcout. */
export class TableDynamique {
  constructor(tailleMax = 4096) {
    this.entrees = [];       // la plus recente en tete
    this.tailleMax = tailleMax;
    this.taille = 0;
  }
  static coutDe(nom, valeur) { return nom.length + valeur.length + 32; }

  ajouter(nom, valeur) {
    const cout = TableDynamique.coutDe(nom, valeur);
    // Une entree plus grande que la table entiere la vide sans y entrer.
    if (cout > this.tailleMax) { this.entrees = []; this.taille = 0; return false; }
    this.entrees.unshift([nom, valeur]);
    this.taille += cout;
    this.evincer();
    return true;
  }
  evincer() {
    while (this.taille > this.tailleMax && this.entrees.length) {
      const [n, v] = this.entrees.pop();
      this.taille -= TableDynamique.coutDe(n, v);
    }
  }
  redimensionner(taille) { this.tailleMax = taille; this.evincer(); }

  /** Index HPACK : 1..61 dans la table statique, au-dela dans la dynamique. */
  lire(index) {
    if (index <= 0) throw new Error('index HPACK nul : interdit');
    if (index <= TABLE_STATIQUE.length) return TABLE_STATIQUE[index - 1];
    const i = index - TABLE_STATIQUE.length - 1;
    if (i >= this.entrees.length) throw new Error('index HPACK hors de la table : ' + index);
    return this.entrees[i];
  }
}

/* ------------------------------- Decodage --------------------------------- */
/**
 * Decode un bloc d en-tetes.
 *
 * @param entree   Uint8Array, ou hexadecimal en chaine
 * @param table    TableDynamique a conserver entre les trames d une meme
 *                 connexion ; sans elle, une table neuve est creee
 * @returns { entetes, operations, table, tailleTable }
 */
export function decoderBlocHpack(entree, table = new TableDynamique()) {
  const octets = entree instanceof Uint8Array ? entree : hexEnOctets(entree);
  const lecteur = new Lecteur(octets);
  const entetes = [];
  const operations = [];

  while (lecteur.reste() > 0) {
    const premier = lecteur.octet();

    /* 6.1 — en-tete entierement indexe */
    if (premier & 0x80) {
      const index = decoderEntier(lecteur, 7, premier);
      const [nom, valeur] = table.lire(index);
      entetes.push({ nom, valeur, forme: 'indexe', index });
      operations.push({ forme: 'indexe', index, nom, valeur });
      continue;
    }

    /* 6.3 — mise a jour de la taille de la table dynamique */
    if ((premier & 0xe0) === 0x20) {
      const taille = decoderEntier(lecteur, 5, premier);
      table.redimensionner(taille);
      operations.push({ forme: 'taille de table', taille });
      continue;
    }

    /* 6.2.1 / 6.2.2 / 6.2.3 — litteral, avec ou sans indexation */
    let bitsIndex, forme, indexer;
    if ((premier & 0xc0) === 0x40) { bitsIndex = 6; forme = 'litteral indexe'; indexer = true; }
    else if ((premier & 0xf0) === 0x10) { bitsIndex = 4; forme = 'litteral jamais indexe'; indexer = false; }
    else { bitsIndex = 4; forme = 'litteral sans indexation'; indexer = false; }

    const indexNom = decoderEntier(lecteur, bitsIndex, premier);
    const nom = indexNom === 0 ? lireChaine(lecteur).texte : table.lire(indexNom)[0];
    const chaineValeur = lireChaine(lecteur);
    const valeur = chaineValeur.texte;

    if (indexer) table.ajouter(nom, valeur);
    entetes.push({ nom, valeur, forme, index: indexNom || null, huffman: chaineValeur.huffman });
    operations.push({ forme, nom, valeur, indexNom: indexNom || null, huffman: chaineValeur.huffman });
  }

  return { entetes, operations, table, tailleTable: table.taille, tailleMaxTable: table.tailleMax };
}

function hexEnOctets(texte) {
  const propre = String(texte || '').replace(/[^0-9a-fA-F]/g, '');
  if (propre.length % 2) throw new Error('hexadecimal de longueur impaire');
  const out = new Uint8Array(propre.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(propre.substr(i * 2, 2), 16);
  return out;
}

/** Cherche un couple nom/valeur dans les deux tables. 0 si absent. */
export function indexDe(nom, valeur, table) {
  for (let i = 0; i < TABLE_STATIQUE.length; i++) {
    if (TABLE_STATIQUE[i][0] === nom && TABLE_STATIQUE[i][1] === valeur) return i + 1;
  }
  if (table) {
    for (let i = 0; i < table.entrees.length; i++) {
      if (table.entrees[i][0] === nom && table.entrees[i][1] === valeur) {
        return TABLE_STATIQUE.length + i + 1;
      }
    }
  }
  return 0;
}
