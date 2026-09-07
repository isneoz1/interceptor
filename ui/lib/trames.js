/* Trames WebSocket et HTTP/2 — INTERCEPTOR (by D4RK)
 *
 * Decode des trames brutes (hexadecimal) telles qu elles circulent sur le fil :
 *   - WebSocket, RFC 6455 section 5.2 : FIN, opcode, masque, longueur sur 7,
 *     16 ou 64 bits, cle de masquage, charge utile demasquee ;
 *   - HTTP/2, RFC 9113 section 4.1 : longueur, type, drapeaux, identifiant
 *     de flux, et le sens des charges utiles les plus courantes.
 * Verifie contre les exemples publies dans les deux RFC.
 */
import { hexVersOctets, octetsVersHex, octetsVersTexte, texteVersOctets } from './bytes.js';
import { decrireErreurH2 } from './ref-reseau.js';

/* ------------------------------- WebSocket -------------------------------- */
export const OPCODES_WS = {
  0x0: 'continuation', 0x1: 'texte', 0x2: 'binaire',
  0x8: 'fermeture', 0x9: 'ping', 0xA: 'pong'
};

function lireOctets(entree) {
  if (entree instanceof Uint8Array) return entree;
  const brut = String(entree == null ? '' : entree).trim();
  if (!brut) throw new Error('trame vide');
  return hexVersOctets(brut.replace(/^0x/i, ''));
}

/** Decode UNE trame et rend aussi ce qui suit, pour enchainer. */
export function decoderTrameWs(entree) {
  const o = lireOctets(entree);
  if (o.length < 2) throw new Error('trame trop courte : deux octets minimum');
  const b0 = o[0], b1 = o[1];
  const fin = !!(b0 & 0x80);
  const rsv = [(b0 >> 6) & 1, (b0 >> 5) & 1, (b0 >> 4) & 1];
  const opcode = b0 & 0x0f;
  const masque = !!(b1 & 0x80);
  let longueur = b1 & 0x7f;
  let position = 2;
  let formeLongueur = '7 bits';

  if (longueur === 126) {
    if (o.length < 4) throw new Error('longueur sur 16 bits annoncee, octets manquants');
    longueur = (o[2] << 8) | o[3];
    position = 4;
    formeLongueur = '16 bits';
  } else if (longueur === 127) {
    if (o.length < 10) throw new Error('longueur sur 64 bits annoncee, octets manquants');
    let n = 0n;
    for (let i = 2; i < 10; i++) n = (n << 8n) | BigInt(o[i]);
    if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('longueur 64 bits hors de portee');
    if (o[2] & 0x80) throw new Error('bit de poids fort de la longueur 64 bits a 1 : interdit');
    longueur = Number(n);
    position = 10;
    formeLongueur = '64 bits';
  }

  let cle = null;
  if (masque) {
    if (o.length < position + 4) throw new Error('cle de masquage annoncee, octets manquants');
    cle = o.slice(position, position + 4);
    position += 4;
  }

  const disponible = Math.max(0, Math.min(longueur, o.length - position));
  const charge = new Uint8Array(disponible);
  for (let i = 0; i < disponible; i++) {
    charge[i] = masque ? (o[position + i] ^ cle[i & 3]) : o[position + i];
  }
  const complete = disponible === longueur;
  const fermeture = opcode === 0x8 && charge.length >= 2
    ? { code: (charge[0] << 8) | charge[1], raison: sur(() => octetsVersTexte(charge.slice(2))) }
    : null;

  return {
    fin, rsv, opcode, opcodeNom: OPCODES_WS[opcode] || 'reserve (0x' + opcode.toString(16) + ')',
    masque, cleMasque: cle ? octetsVersHex(cle) : '',
    longueur, formeLongueur, enteteOctets: position,
    chargeUtile: charge, chargeHex: octetsVersHex(charge, ' '),
    texte: (opcode === 0x1 || opcode === 0x0) ? sur(() => octetsVersTexte(charge)) : '',
    fermeture, complete,
    reste: o.slice(position + disponible),
    controle: opcode >= 0x8,
    remarques: remarquesWs({ fin, rsv, opcode, masque, longueur, complete })
  };
}

function remarquesWs(t) {
  const r = [];
  if (t.rsv.some(Boolean)) r.push('bit RSV a 1 : reserve a une extension negociee (permessage-deflate par exemple)');
  if (t.controle && !t.fin) r.push('une trame de controle ne doit pas etre fragmentee (FIN=0)');
  if (t.controle && t.longueur > 125) r.push('une trame de controle ne peut pas depasser 125 octets');
  if (!t.masque) r.push('non masquee : envoyee par le serveur (le client doit toujours masquer)');
  else r.push('masquee : envoyee par le client');
  if (!t.complete) r.push('charge utile incomplete dans les octets fournis');
  return r;
}

/** Decode toutes les trames consecutives d un tampon. */
export function decoderTramesWs(entree) {
  let reste = lireOctets(entree);
  const trames = [];
  while (reste.length >= 2 && trames.length < 200) {
    const t = decoderTrameWs(reste);
    trames.push(t);
    if (!t.complete || !t.reste.length) break;
    reste = t.reste;
  }
  return trames;
}

/** Fabrique une trame conforme, pour tester un serveur ou relire l encodage. */
export function encoderTrameWs({ opcode = 0x1, texte = '', octets = null, fin = true, masquer = false, cle = null } = {}) {
  const charge = octets ? new Uint8Array(octets) : texteVersOctets(texte);
  const n = charge.length;
  const entete = [((fin ? 0x80 : 0) | (opcode & 0x0f))];
  const bitMasque = masquer ? 0x80 : 0;
  if (n <= 125) entete.push(bitMasque | n);
  else if (n <= 0xffff) entete.push(bitMasque | 126, n >> 8, n & 0xff);
  else {
    entete.push(bitMasque | 127);
    let v = BigInt(n);
    const huit = [];
    for (let i = 0; i < 8; i++) { huit.unshift(Number(v & 0xffn)); v >>= 8n; }
    entete.push(...huit);
  }
  let k = null;
  if (masquer) {
    k = cle ? hexVersOctets(cle) : new Uint8Array(4);
    if (!cle && globalThis.crypto && globalThis.crypto.getRandomValues) globalThis.crypto.getRandomValues(k);
    entete.push(...k);
  }
  const sortie = new Uint8Array(entete.length + n);
  sortie.set(entete);
  for (let i = 0; i < n; i++) sortie[entete.length + i] = masquer ? (charge[i] ^ k[i & 3]) : charge[i];
  return sortie;
}

/* --------------------------------- HTTP/2 --------------------------------- */
export const PREFACE_H2 = 'PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n';
export const TYPES_H2 = {
  0x0: 'DATA', 0x1: 'HEADERS', 0x2: 'PRIORITY', 0x3: 'RST_STREAM', 0x4: 'SETTINGS',
  0x5: 'PUSH_PROMISE', 0x6: 'PING', 0x7: 'GOAWAY', 0x8: 'WINDOW_UPDATE', 0x9: 'CONTINUATION',
  0xa: 'ALTSVC', 0xc: 'ORIGIN'
};
const DRAPEAUX_H2 = {
  DATA: { 0x1: 'END_STREAM', 0x8: 'PADDED' },
  HEADERS: { 0x1: 'END_STREAM', 0x4: 'END_HEADERS', 0x8: 'PADDED', 0x20: 'PRIORITY' },
  SETTINGS: { 0x1: 'ACK' },
  PING: { 0x1: 'ACK' },
  PUSH_PROMISE: { 0x4: 'END_HEADERS', 0x8: 'PADDED' },
  CONTINUATION: { 0x4: 'END_HEADERS' }
};
export const PARAMETRES_H2 = {
  1: 'HEADER_TABLE_SIZE', 2: 'ENABLE_PUSH', 3: 'MAX_CONCURRENT_STREAMS',
  4: 'INITIAL_WINDOW_SIZE', 5: 'MAX_FRAME_SIZE', 6: 'MAX_HEADER_LIST_SIZE',
  8: 'ENABLE_CONNECT_PROTOCOL', 9: 'NO_RFC7540_PRIORITIES'
};

const u32 = (o, i) => ((o[i] << 24) | (o[i + 1] << 16) | (o[i + 2] << 8) | o[i + 3]) >>> 0;

export function decoderTrameH2(entree) {
  let o = lireOctets(entree);
  let preface = false;
  const prefaceOctets = texteVersOctets(PREFACE_H2);
  if (o.length >= 24 && prefaceOctets.every((b, i) => o[i] === b)) {
    preface = true;
    o = o.slice(24);
  }
  if (!o.length && preface) {
    return { preface, vide: true, reste: new Uint8Array(0) };
  }
  if (o.length < 9) throw new Error('en-tete HTTP/2 incomplet : neuf octets attendus');
  const longueur = (o[0] << 16) | (o[1] << 8) | o[2];
  const type = o[3];
  const drapeaux = o[4];
  const reserve = (o[5] >> 7) & 1;
  const flux = u32(o, 5) & 0x7fffffff;
  const typeNom = TYPES_H2[type] || 'inconnu (0x' + type.toString(16) + ')';
  const noms = DRAPEAUX_H2[typeNom] || {};
  const drapeauxNoms = Object.entries(noms).filter(([bit]) => drapeaux & Number(bit)).map(([, n]) => n);
  const charge = o.slice(9, 9 + longueur);
  const complete = charge.length === longueur;

  return {
    preface, longueur, type, typeNom, drapeaux, drapeauxNoms, reserve, flux,
    chargeUtile: charge, chargeHex: octetsVersHex(charge, ' '), complete,
    details: detailsH2(typeNom, drapeaux, charge, flux),
    reste: o.slice(9 + charge.length)
  };
}

function detailsH2(typeNom, drapeaux, c, flux) {
  const d = [];
  if (typeNom === 'SETTINGS') {
    if (drapeaux & 0x1) d.push(['ACK', 'accuse de reception, sans parametre']);
    for (let i = 0; i + 6 <= c.length; i += 6) {
      const id = (c[i] << 8) | c[i + 1];
      d.push([PARAMETRES_H2[id] || 'parametre ' + id, String(u32(c, i + 2))]);
    }
  } else if (typeNom === 'RST_STREAM' && c.length >= 4) {
    const code = u32(c, 0);
    const e = decrireErreurH2(code);
    d.push(['code d erreur', code + (e ? ' ' + e.nom : '')]);
  } else if (typeNom === 'GOAWAY' && c.length >= 8) {
    const dernier = u32(c, 0) & 0x7fffffff;
    const code = u32(c, 4);
    const e = decrireErreurH2(code);
    d.push(['dernier flux traite', String(dernier)], ['code d erreur', code + (e ? ' ' + e.nom : '')]);
    if (c.length > 8) d.push(['donnees de debogage', sur(() => octetsVersTexte(c.slice(8)))]);
  } else if (typeNom === 'WINDOW_UPDATE' && c.length >= 4) {
    d.push(['increment de fenetre', String(u32(c, 0) & 0x7fffffff)]);
  } else if (typeNom === 'PING') {
    d.push(['donnees opaques', octetsVersHex(c, ' ')]);
  } else if (typeNom === 'PRIORITY' && c.length >= 5) {
    d.push(['exclusif', String(!!(c[0] & 0x80))], ['dependance', String(u32(c, 0) & 0x7fffffff)],
           ['poids', String(c[4] + 1)]);
  } else if (typeNom === 'DATA' || typeNom === 'HEADERS') {
    if (drapeaux & 0x8 && c.length) d.push(['remplissage', c[0] + ' octets']);
    if (typeNom === 'HEADERS') d.push(['bloc d en-tetes', 'compresse HPACK (RFC 7541), non decompresse ici']);
  }
  if (flux === 0 && (typeNom === 'DATA' || typeNom === 'HEADERS')) {
    d.push(['remarque', 'flux 0 interdit pour ce type : erreur de protocole']);
  }
  return d;
}

/** Decode toutes les trames consecutives ; un reliquat plus court qu un
 *  en-tete (9 octets) est rendu tel quel dans `reliquat`, sans erreur. */
export function decoderTramesH2(entree) {
  let reste = lireOctets(entree);
  const trames = [];
  let reliquat = new Uint8Array(0);
  while (reste.length && trames.length < 200) {
    if (reste.length < 9 && !(trames.length === 0 && reste.length >= 24)) { reliquat = reste; break; }
    const t = decoderTrameH2(reste);
    trames.push(t);
    if (t.vide || !t.complete || !t.reste.length) break;
    reste = t.reste;
  }
  trames.reliquat = reliquat;
  return trames;
}

function sur(fn) { try { return fn(); } catch { return ''; } }
