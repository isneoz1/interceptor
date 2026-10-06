/* MQTT sur WebSocket — SWIFT (by NeoZ)
 *
 * MQTT est le protocole des objets connectes et de bien des tableaux de bord
 * temps reel ; dans un navigateur il passe par une WebSocket de
 * sous-protocole « mqtt ». Ses trames sont BINAIRES : lues telles quelles,
 * elles ne montrent qu une suite d octets.
 *
 * Specifications suivies :
 *   MQTT 3.1.1  https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html
 *   MQTT 5.0    https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html
 *
 * Deux regles pour ne rien inventer :
 *
 *   - Une trame WebSocket peut porter plusieurs paquets MQTT, ou un morceau
 *     seulement (« MUST NOT assume that MQTT Control Packets are aligned on
 *     WebSocket frame boundaries »). Un paquet coupe est signale comme tel.
 *   - La version 5 ajoute des « proprietes » au milieu de plusieurs paquets.
 *     La version de la connexion n est ecrite que dans son paquet CONNECT :
 *     sans lui, ce qui suit ces proprietes n est pas lu, et on le dit.
 */

import { t } from './i18n.js';

export const TYPES_MQTT = {
  1: 'CONNECT', 2: 'CONNACK', 3: 'PUBLISH', 4: 'PUBACK', 5: 'PUBREC',
  6: 'PUBREL', 7: 'PUBCOMP', 8: 'SUBSCRIBE', 9: 'SUBACK', 10: 'UNSUBSCRIBE',
  11: 'UNSUBACK', 12: 'PINGREQ', 13: 'PINGRESP', 14: 'DISCONNECT', 15: 'AUTH'
};

/* 3.1.1, section 3.2.2.3 : codes de retour du CONNACK. */
const RETOURS_311 = {
  0: 'Connection Accepted',
  1: 'unacceptable protocol version',
  2: 'identifier rejected',
  3: 'Server unavailable',
  4: 'bad user name or password',
  5: 'not authorized'
};

/* 5.0, section 2.4 : codes de raison, communs a tous les paquets. */
const RAISONS_5 = {
  0x00: 'Success', 0x01: 'Granted QoS 1', 0x02: 'Granted QoS 2',
  0x04: 'Disconnect with Will Message', 0x10: 'No matching subscribers',
  0x11: 'No subscription existed', 0x18: 'Continue authentication',
  0x19: 'Re-authenticate', 0x80: 'Unspecified error', 0x81: 'Malformed Packet',
  0x82: 'Protocol Error', 0x83: 'Implementation specific error',
  0x84: 'Unsupported Protocol Version', 0x85: 'Client Identifier not valid',
  0x86: 'Bad User Name or Password', 0x87: 'Not authorized',
  0x88: 'Server unavailable', 0x89: 'Server busy', 0x8A: 'Banned',
  0x8B: 'Server shutting down', 0x8C: 'Bad authentication method',
  0x8D: 'Keep Alive timeout', 0x8E: 'Session taken over',
  0x8F: 'Topic Filter invalid', 0x90: 'Topic Name invalid',
  0x91: 'Packet Identifier in use', 0x92: 'Packet Identifier not found',
  0x93: 'Receive Maximum exceeded', 0x94: 'Topic Alias invalid',
  0x95: 'Packet too large', 0x96: 'Message rate too high',
  0x97: 'Quota exceeded', 0x98: 'Administrative action',
  0x99: 'Payload format invalid', 0x9A: 'Retain not supported',
  0x9B: 'QoS not supported', 0x9C: 'Use another server', 0x9D: 'Server moved',
  0x9E: 'Shared Subscriptions not supported', 0x9F: 'Connection rate exceeded',
  0xA0: 'Maximum connect time', 0xA1: 'Subscription Identifiers not supported',
  0xA2: 'Wildcard Subscriptions not supported'
};

/* 3.1.1, section 2.2.2 : les drapeaux imposes. PUBLISH seul les emploie. */
const DRAPEAUX_IMPOSES = { 6: 0b0010, 8: 0b0010, 10: 0b0010 };

const decodeurStrict = new TextDecoder('utf-8', { fatal: true });

class Lecture {
  constructor(octets, debut, fin) { this.o = octets; this.i = debut; this.fin = fin; }
  get reste() { return this.fin - this.i; }
  octet() {
    if (this.i >= this.fin) throw new Error('paquet MQTT plus court que annonce');
    return this.o[this.i++];
  }
  entier16() { return (this.octet() << 8) | this.octet(); }
  entierVariable() {
    let valeur = 0;
    for (let k = 0; k < 4; k++) {
      const b = this.octet();
      valeur += (b & 0x7f) * Math.pow(128, k);
      if (!(b & 0x80)) return valeur;
    }
    throw new Error('entier variable MQTT sur plus de quatre octets');
  }
  binaire() {
    const n = this.entier16();
    if (n > this.reste) throw new Error('chaine MQTT plus longue que le paquet');
    const morceau = this.o.subarray(this.i, this.i + n);
    this.i += n;
    return morceau;
  }
  texte() { return decodeurStrict.decode(this.binaire()); }
  /* Proprietes MQTT 5 : on les saute en gardant leur taille, sans les lire
     une a une — leur liste n est pas necessaire a comprendre le paquet. */
  sauterProprietes() {
    const n = this.entierVariable();
    if (n > this.reste) throw new Error('proprietes MQTT plus longues que le paquet');
    this.i += n;
    return n;
  }
}

/** La charge utile : texte si c en est, sinon ses octets. */
function charge(octets) {
  try {
    return { texte: decodeurStrict.decode(octets), octets: octets.length };
  } catch {
    return { texte: null, octets: octets.length };
  }
}

function lirePaquet(type, drapeaux, lec, niveau) {
  const p = { type: TYPES_MQTT[type] };
  const v5 = niveau === 5;
  const niveauConnu = niveau === 3 || niveau === 4 || niveau === 5;

  if (type === 1) {                                   // CONNECT
    const nomProtocole = lec.texte();
    if (nomProtocole !== 'MQTT' && nomProtocole !== 'MQIsdp') {
      throw new Error('nom de protocole MQTT inattendu : ' + nomProtocole.slice(0, 12));
    }
    p.niveau = lec.octet();
    p.version = { 3: '3.1', 4: '3.1.1', 5: '5.0' }[p.niveau] || ('niveau ' + p.niveau);
    const f = lec.octet();
    if (f & 1) throw new Error('bit reserve du CONNECT leve');
    p.sessionPropre = !!(f & 0x02);
    p.keepAlive = lec.entier16();
    if (p.niveau === 5) lec.sauterProprietes();
    p.clientId = lec.texte();
    if (f & 0x04) {                                   // testament
      if (p.niveau === 5) lec.sauterProprietes();
      p.testament = { sujet: lec.texte(), qos: (f >> 3) & 3, retenu: !!(f & 0x20) };
      lec.binaire();
    }
    if (f & 0x80) p.utilisateur = lec.texte();
    /* Le mot de passe est un secret : on dit qu il est la, pas ce qu il vaut. */
    if (f & 0x40) p.motDePasseOctets = lec.binaire().length;
    return p;
  }

  if (type === 2) {                                   // CONNACK
    p.sessionPresente = !!(lec.octet() & 1);
    p.code = lec.octet();
    /* 0 vaut « accepte » dans les deux versions, sous deux noms differents :
       sans version prouvee, on donne les deux plutot que d en choisir un. */
    if (p.code === 0) {
      p.sens = !niveauConnu ? RETOURS_311[0] + ' (3.1.1) / ' + RAISONS_5[0] + ' (5.0)'
        : v5 ? RAISONS_5[0] : RETOURS_311[0];
    }
    else if (v5) p.sens = RAISONS_5[p.code] || null;
    else if (niveauConnu) p.sens = RETOURS_311[p.code] || null;
    if (lec.reste > 0) {
      if (niveauConnu && !v5) throw new Error('CONNACK 3.1.1 plus long que deux octets');
      lec.i = lec.fin;                                // proprietes MQTT 5
    }
    return p;
  }

  if (type === 3) {                                   // PUBLISH
    p.qos = (drapeaux >> 1) & 3;
    if (p.qos === 3) throw new Error('QoS 3 n existe pas');
    p.retenu = !!(drapeaux & 1);
    p.doublon = !!(drapeaux & 8);
    p.sujet = lec.texte();
    if (p.qos > 0) p.paquet = lec.entier16();
    if (!niveauConnu) {
      /* Des proprietes v5 peuvent preceder la charge : on ne la lit pas, mais
         le paquet est bien consomme jusqu a sa fin. */
      p.chargeNonLue = true;
      lec.i = lec.fin;
      return p;
    }
    if (v5) lec.sauterProprietes();
    p.charge = charge(lec.o.subarray(lec.i, lec.fin));
    lec.i = lec.fin;
    return p;
  }

  /* Au-dela de l identifiant, seul MQTT 5 ecrit quelque chose : un code de
     raison puis des proprietes. Des octets en plus prouvent donc la version 5
     quand elle n est pas connue, et une erreur quand c est la 3.1.1. */
  const suiteV5 = () => {
    if (lec.reste === 0) return;
    if (niveauConnu && !v5) throw new Error(p.type + ' 3.1.1 plus long que prevu');
    p.code = lec.octet();
    p.sens = RAISONS_5[p.code] || null;
    lec.i = lec.fin;
  };

  if (type >= 4 && type <= 7) {                       // PUBACK PUBREC PUBREL PUBCOMP
    p.paquet = lec.entier16();
    suiteV5();
    return p;
  }

  if (type === 8 || type === 10) {                    // SUBSCRIBE UNSUBSCRIBE
    p.paquet = lec.entier16();
    if (!niveauConnu) { p.sujetsNonLus = true; lec.i = lec.fin; return p; }
    if (v5) lec.sauterProprietes();
    p.sujets = [];
    while (lec.reste > 0) {
      const filtre = lec.texte();
      if (type === 8) {
        const options = lec.octet();
        p.sujets.push({ filtre, qos: options & 3 });
      } else {
        p.sujets.push({ filtre });
      }
    }
    return p;
  }

  if (type === 9 || type === 11) {                    // SUBACK UNSUBACK
    p.paquet = lec.entier16();
    if (!niveauConnu) { lec.i = lec.fin; return p; }
    if (v5) lec.sauterProprietes();
    p.codes = [];
    while (lec.reste > 0) p.codes.push(lec.octet());
    return p;
  }

  if (type === 12 || type === 13) {                   // PINGREQ PINGRESP
    if (lec.reste !== 0) throw new Error(p.type + ' ne porte rien');
    return p;
  }

  if (type === 14 || type === 15) {                   // DISCONNECT AUTH
    suiteV5();
    return p;
  }
  throw new Error('type de paquet MQTT inconnu');
}

/**
 * Lit les paquets MQTT d une trame WebSocket binaire.
 *
 * @param octets  la trame
 * @param niveau  3, 4 ou 5 — le niveau ecrit dans le CONNECT de la connexion,
 *                s il a ete capture. Sans lui, ce qui suit les proprietes de
 *                la version 5 n est pas lu.
 * @returns { protocole, paquets[], incomplet }
 */
export function lireMqtt(octets, niveau = null) {
  if (!(octets instanceof Uint8Array) || !octets.length) throw new Error('trame vide');
  const paquets = [];
  let i = 0;
  let incomplet = false;
  while (i < octets.length) {
    const premier = octets[i];
    const type = premier >> 4;
    const drapeaux = premier & 0x0f;
    if (!TYPES_MQTT[type]) throw new Error('type de paquet MQTT 0 reserve');
    if (type === 15 && niveau != null && niveau !== 5) throw new Error('AUTH n existe qu en MQTT 5');
    const impose = DRAPEAUX_IMPOSES[type];
    if (type !== 3 && drapeaux !== (impose || 0)) throw new Error('drapeaux MQTT non conformes');

    const tete = new Lecture(octets, i + 1, octets.length);
    const longueur = tete.entierVariable();
    const debut = tete.i;
    if (debut + longueur > octets.length) {
      /* La suite est dans la trame suivante : on ne lit pas un paquet coupe. */
      paquets.push({ type: TYPES_MQTT[type], incomplet: true, attendus: longueur, presents: octets.length - debut });
      incomplet = true;
      break;
    }
    const lec = new Lecture(octets, debut, debut + longueur);
    const paquet = lirePaquet(type, drapeaux, lec, niveau);
    if (lec.reste !== 0) throw new Error('paquet MQTT plus long que son contenu');
    paquets.push(paquet);
    i = debut + longueur;
  }
  return { protocole: 'MQTT', paquets, incomplet };
}

/** Le niveau de protocole ecrit dans un CONNECT, ou null. */
export function niveauDuConnect(octets) {
  try {
    const lu = lireMqtt(octets, null);
    const connect = lu.paquets.find(p => p.type === 'CONNECT');
    return connect ? connect.niveau : null;
  } catch {
    return null;
  }
}

/** Une ligne courte : type du premier paquet, sujet, QoS. */
export function resumerMqtt(lu) {
  const p = lu.paquets[0];
  if (!p) return null;
  let texte = 'MQTT ' + p.type;
  if (p.type === 'CONNECT') texte += ' v' + p.version + ' « ' + p.clientId + ' »';
  else if (p.sujet != null) texte += ' « ' + p.sujet + ' »' + (p.qos ? ' QoS ' + p.qos : '');
  else if (p.sujets && p.sujets.length) texte += ' ' + p.sujets.map(s => '« ' + s.filtre + ' »').join(', ');
  else if (p.sens) texte += ' — ' + p.sens;
  if (p.incomplet) texte += ' ' + t('(paquet incomplet)');
  if (lu.paquets.length > 1) texte += ' +' + (lu.paquets.length - 1);
  return texte;
}
