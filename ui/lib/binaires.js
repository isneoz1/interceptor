/* Formats binaires — INTERCEPTOR (by D4RK)
 *
 * Protocol Buffers, MessagePack et CBOR : les trois corps binaires que l on
 * croise vraiment dans du trafic HTTP moderne (gRPC, API compactes, WebAuthn,
 * COSE). On les lit octet par octet, sans schema et sans bibliotheque.
 *
 * Sans fichier .proto, un message protobuf ne livre que la structure : numero
 * de champ, type de fil, valeur brute. On ne devine pas les noms, on montre ce
 * qui est reellement encode.
 */
import { octetsVersHex, hexVersOctets, base64VersOctets } from './bytes.js';

/* ------------------------------ Lecture commune --------------------------- */
class Lecteur {
  constructor(octets) { this.o = octets; this.i = 0; }
  get reste() { return this.o.length - this.i; }
  octet() {
    if (this.i >= this.o.length) throw new Error('fin de donnees inattendue');
    return this.o[this.i++];
  }
  tranche(n) {
    if (n < 0 || this.i + n > this.o.length) throw new Error('longueur hors des donnees');
    const t = this.o.subarray(this.i, this.i + n);
    this.i += n;
    return t;
  }
  vue(n) {
    const t = this.tranche(n);
    return new DataView(t.buffer, t.byteOffset, t.byteLength);
  }
}

const texteDe = octets => new TextDecoder('utf-8').decode(octets);
const imprimable = s => s.length > 0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\uFFFD]/.test(s);

/* -------------------------- Protocol Buffers ------------------------------ */
const TYPES_FIL = {
  0: 'varint', 1: '64 bits', 2: 'longueur prefixee', 3: 'groupe (obsolete)',
  4: 'fin de groupe (obsolete)', 5: '32 bits'
};

function varint(lec) {
  let resultat = 0n, decalage = 0n, octets = 0;
  for (;;) {
    const o = lec.octet();
    resultat |= BigInt(o & 0x7f) << decalage;
    octets++;
    if (!(o & 0x80)) break;
    decalage += 7n;
    if (octets > 10) throw new Error('varint trop long');
  }
  return resultat;
}

/** Le zigzag des champs signes : 0, -1, 1, -2... */
const zigzag = n => (n >> 1n) ^ -(n & 1n);

/**
 * Decode un message protobuf. `profondeur` limite la recursion sur les champs
 * imbriques, qu on ne reconnait que par tentative.
 */
export function decoderProtobuf(octets, profondeur = 0) {
  const lec = new Lecteur(octets);
  const champs = [];
  while (lec.reste > 0) {
    const cle = varint(lec);
    const numero = Number(cle >> 3n);
    const type = Number(cle & 7n);
    if (numero === 0) throw new Error('numero de champ nul');
    const champ = { numero, type, typeNom: TYPES_FIL[type] || 'inconnu' };

    if (type === 0) {
      const v = varint(lec);
      champ.valeur = v.toString();
      champ.lectures = {
        entier: v.toString(),
        signe: zigzag(v).toString(),
        booleen: v === 0n ? 'false' : v === 1n ? 'true' : null
      };
    } else if (type === 1) {
      const vue = lec.vue(8);
      champ.valeur = octetsVersHex(new Uint8Array(vue.buffer, vue.byteOffset, 8), ' ');
      champ.lectures = {
        entier: vue.getBigUint64(0, true).toString(),
        signe: vue.getBigInt64(0, true).toString(),
        flottant: vue.getFloat64(0, true)
      };
    } else if (type === 5) {
      const vue = lec.vue(4);
      champ.valeur = octetsVersHex(new Uint8Array(vue.buffer, vue.byteOffset, 4), ' ');
      champ.lectures = {
        entier: vue.getUint32(0, true).toString(),
        signe: vue.getInt32(0, true).toString(),
        flottant: vue.getFloat32(0, true)
      };
    } else if (type === 2) {
      const taille = Number(varint(lec));
      const contenu = lec.tranche(taille);
      champ.octets = taille;
      const texte = texteDe(contenu);
      champ.valeur = imprimable(texte) ? texte : octetsVersHex(contenu, ' ');
      champ.texteLisible = imprimable(texte);
      // Un champ de longueur prefixee est souvent un message imbrique : on essaie,
      // et on ne garde le resultat que s il consomme exactement les octets.
      if (profondeur < 6 && taille > 1 && !imprimable(texte)) {
        try {
          const enfants = decoderProtobuf(contenu, profondeur + 1);
          if (enfants.length) champ.enfants = enfants;
        } catch { /* ce n etait pas un message imbrique */ }
      }
    } else if (type === 3 || type === 4) {
      champ.valeur = '(groupe : encodage abandonne par protobuf)';
    } else {
      throw new Error('type de fil inconnu : ' + type);
    }
    champs.push(champ);
  }
  if (!champs.length) throw new Error('aucun champ protobuf reconnu');
  return champs;
}

/* ------------------------------ MessagePack ------------------------------- */
function lireMsgpack(lec) {
  const o = lec.octet();
  if (o <= 0x7f) return o;                                   // entier positif court
  if (o >= 0xe0) return o - 256;                             // entier negatif court
  if (o >= 0x80 && o <= 0x8f) return carte(lec, o & 0x0f);
  if (o >= 0x90 && o <= 0x9f) return tableau(lec, o & 0x0f);
  if (o >= 0xa0 && o <= 0xbf) return texteDe(lec.tranche(o & 0x1f));
  switch (o) {
    case 0xc0: return null;
    case 0xc2: return false;
    case 0xc3: return true;
    case 0xc4: return '(binaire ' + octetsVersHex(lec.tranche(lec.octet()), ' ') + ')';
    case 0xc5: return '(binaire ' + octetsVersHex(lec.tranche(lec.vue(2).getUint16(0)), ' ') + ')';
    case 0xc6: return '(binaire ' + octetsVersHex(lec.tranche(lec.vue(4).getUint32(0)), ' ') + ')';
    case 0xca: return lec.vue(4).getFloat32(0);
    case 0xcb: return lec.vue(8).getFloat64(0);
    case 0xcc: return lec.octet();
    case 0xcd: return lec.vue(2).getUint16(0);
    case 0xce: return lec.vue(4).getUint32(0);
    case 0xcf: return lec.vue(8).getBigUint64(0).toString();
    case 0xd0: return lec.vue(1).getInt8(0);
    case 0xd1: return lec.vue(2).getInt16(0);
    case 0xd2: return lec.vue(4).getInt32(0);
    case 0xd3: return lec.vue(8).getBigInt64(0).toString();
    case 0xd9: return texteDe(lec.tranche(lec.octet()));
    case 0xda: return texteDe(lec.tranche(lec.vue(2).getUint16(0)));
    case 0xdb: return texteDe(lec.tranche(lec.vue(4).getUint32(0)));
    case 0xdc: return tableau(lec, lec.vue(2).getUint16(0));
    case 0xdd: return tableau(lec, lec.vue(4).getUint32(0));
    case 0xde: return carte(lec, lec.vue(2).getUint16(0));
    case 0xdf: return carte(lec, lec.vue(4).getUint32(0));
    default: break;
  }
  if (o >= 0xd4 && o <= 0xd8) return extension(lec, 1 << (o - 0xd4));
  if (o === 0xc7) return extension(lec, lec.octet());
  if (o === 0xc8) return extension(lec, lec.vue(2).getUint16(0));
  if (o === 0xc9) return extension(lec, lec.vue(4).getUint32(0));
  throw new Error('octet MessagePack inconnu : 0x' + o.toString(16));
}

function tableau(lec, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(lireMsgpack(lec));
  return out;
}

function carte(lec, n) {
  const out = {};
  for (let i = 0; i < n; i++) {
    const cle = lireMsgpack(lec);
    out[typeof cle === 'object' ? JSON.stringify(cle) : String(cle)] = lireMsgpack(lec);
  }
  return out;
}

function extension(lec, taille) {
  const type = lec.vue(1).getInt8(0);
  const contenu = lec.tranche(taille);
  // Le type -1 est l horodatage normalise : on le rend lisible.
  if (type === -1) {
    const vue = new DataView(contenu.buffer, contenu.byteOffset, contenu.byteLength);
    if (taille === 4) return new Date(vue.getUint32(0) * 1000).toISOString();
    if (taille === 8) {
      const brut = vue.getBigUint64(0);
      const secondes = Number(brut & 0x3ffffffffn);
      return new Date(secondes * 1000).toISOString();
    }
    if (taille === 12) return new Date(Number(vue.getBigInt64(4)) * 1000).toISOString();
  }
  return '(extension ' + type + ' : ' + octetsVersHex(contenu, ' ') + ')';
}

/** Decode un document MessagePack complet. */
export function decoderMsgpack(octets) {
  const lec = new Lecteur(octets);
  const valeur = lireMsgpack(lec);
  if (lec.reste > 0) throw new Error(lec.reste + ' octets en trop apres le document');
  return valeur;
}

/* ---------------------------------- CBOR ---------------------------------- */
/* RFC 8949 : l encodage de COSE, de WebAuthn et de bien des objets connectes. */
function demiFlottant(bits) {
  const signe = (bits & 0x8000) ? -1 : 1;
  const exposant = (bits >> 10) & 0x1f;
  const fraction = bits & 0x3ff;
  if (exposant === 0) return signe * Math.pow(2, -14) * (fraction / 1024);
  if (exposant === 31) return fraction ? NaN : signe * Infinity;
  return signe * Math.pow(2, exposant - 15) * (1 + fraction / 1024);
}

function longueurCbor(lec, complement) {
  if (complement < 24) return complement;
  if (complement === 24) return lec.octet();
  if (complement === 25) return lec.vue(2).getUint16(0);
  if (complement === 26) return lec.vue(4).getUint32(0);
  if (complement === 27) {
    const n = lec.vue(8).getBigUint64(0);
    if (n > 9007199254740991n) throw new Error('longueur CBOR hors des entiers surs');
    return Number(n);
  }
  if (complement === 31) return -1;                          // longueur indefinie
  throw new Error('complement CBOR reserve : ' + complement);
}

function lireCbor(lec, profondeur = 0) {
  if (profondeur > 32) throw new Error('imbrication CBOR trop profonde');
  const initial = lec.octet();
  const majeur = initial >> 5;
  const complement = initial & 0x1f;

  if (majeur === 0) return longueurCbor(lec, complement);
  if (majeur === 1) return -1 - longueurCbor(lec, complement);
  if (majeur === 2) {
    const n = longueurCbor(lec, complement);
    if (n < 0) return '(binaire de longueur indefinie)';
    return '(binaire ' + octetsVersHex(lec.tranche(n), ' ') + ')';
  }
  if (majeur === 3) {
    const n = longueurCbor(lec, complement);
    if (n < 0) {
      let out = '';
      while (lec.o[lec.i] !== 0xff) out += lireCbor(lec, profondeur + 1);
      lec.octet();
      return out;
    }
    return texteDe(lec.tranche(n));
  }
  if (majeur === 4) {
    const n = longueurCbor(lec, complement);
    const out = [];
    if (n < 0) {
      while (lec.o[lec.i] !== 0xff) out.push(lireCbor(lec, profondeur + 1));
      lec.octet();
    } else for (let i = 0; i < n; i++) out.push(lireCbor(lec, profondeur + 1));
    return out;
  }
  if (majeur === 5) {
    const n = longueurCbor(lec, complement);
    const out = {};
    const poser = () => {
      const cle = lireCbor(lec, profondeur + 1);
      out[typeof cle === 'object' ? JSON.stringify(cle) : String(cle)] = lireCbor(lec, profondeur + 1);
    };
    if (n < 0) { while (lec.o[lec.i] !== 0xff) poser(); lec.octet(); }
    else for (let i = 0; i < n; i++) poser();
    return out;
  }
  if (majeur === 6) {
    const etiquette = longueurCbor(lec, complement);
    const valeur = lireCbor(lec, profondeur + 1);
    if (etiquette === 0) return valeur;                       // date en texte
    if (etiquette === 1 && typeof valeur === 'number') return new Date(valeur * 1000).toISOString();
    return { etiquette, valeur };
  }
  // Majeur 7 : constantes simples et flottants.
  if (complement === 20) return false;
  if (complement === 21) return true;
  if (complement === 22) return null;
  if (complement === 23) return '(non defini)';
  if (complement === 25) return demiFlottant(lec.vue(2).getUint16(0));
  if (complement === 26) return lec.vue(4).getFloat32(0);
  if (complement === 27) return lec.vue(8).getFloat64(0);
  if (complement === 31) throw new Error('rupture CBOR inattendue');
  return '(valeur simple ' + longueurCbor(lec, complement) + ')';
}

/** Decode un document CBOR complet. */
export function decoderCbor(octets) {
  const lec = new Lecteur(octets);
  const valeur = lireCbor(lec);
  if (lec.reste > 0) throw new Error(lec.reste + ' octets en trop apres le document');
  return valeur;
}

/* ------------------------- Reconnaissance de format ----------------------- */
/**
 * Essaie les trois formats et rend ceux qui consomment exactement les octets.
 * Aucun verdict : plusieurs formats peuvent accepter les memes octets courts.
 */
export function essayerFormats(octets) {
  const trouves = [];
  for (const [nom, fn] of [
    ['MessagePack', decoderMsgpack],
    ['CBOR', decoderCbor],
    ['Protocol Buffers', decoderProtobuf]
  ]) {
    try {
      const valeur = fn(octets);
      trouves.push({ format: nom, valeur });
    } catch { /* ce format ne convient pas */ }
  }
  return trouves;
}

/* --------------------- Entrees texte pour le catalogue -------------------- */
/* Le catalogue des transformations travaille sur du texte : ces enveloppes
   lisent le base64 ou l hexadecimal colle, puis rendent la structure en JSON. */
function octetsDeTexte(texte) {
  const brut = String(texte || '').trim();
  if (!brut) throw new Error('rien a decoder');
  const sansEspace = brut.replace(/[\s:,-]+/g, '');
  return /^(0x)?[0-9a-fA-F]+$/.test(sansEspace) && sansEspace.replace(/^0x/, '').length % 2 === 0
    ? hexVersOctets(brut)
    : base64VersOctets(brut);
}

export function protobufVersJson(texte) {
  return JSON.stringify(decoderProtobuf(octetsDeTexte(texte)), null, 2);
}

export function msgpackVersJson(texte) {
  return JSON.stringify(decoderMsgpack(octetsDeTexte(texte)), null, 2);
}

export function cborVersJson(texte) {
  return JSON.stringify(decoderCbor(octetsDeTexte(texte)), null, 2);
}
