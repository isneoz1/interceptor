/* Messages DNS au format filaire — INTERCEPTOR (by NeoZ)
 *
 * DNS par HTTPS (RFC 8484) transporte des messages DNS binaires, dans le
 * parametre `dns=` d un GET (base64url) ou dans le corps d un POST, avec le
 * type `application/dns-message`. Pour qui regarde le trafic, ce sont des
 * octets opaques ; ici, la question posee et chaque reponse, lues selon la
 * RFC 1035 (4.1), avec EDNS (RFC 6891), DNSSEC (RFC 4034) et les
 * enregistrements SVCB / HTTPS (RFC 9460).
 *
 * Les noms de codes viennent des registres IANA, recopies tels quels.
 * Verifie contre des messages fabriques par dnspython.
 */
import { octetsVersHex, octetsVersBase64 } from './bytes.js';
import { compacterIpv6 } from './net.js';
import { decrireTypeDns, decrireRcodeDns } from './ref-protocoles.js';
import { t, tp } from './i18n.js';

const OPCODES = { 0: 'QUERY', 1: 'IQUERY', 2: 'STATUS', 4: 'NOTIFY', 5: 'UPDATE', 6: 'DSO' };
const CLASSES = { 1: 'IN', 3: 'CH', 4: 'HS', 254: 'NONE', 255: 'ANY' };

/* IANA « DNS EDNS0 Option Codes ». */
const OPTIONS_EDNS = {
  1: 'LLQ', 2: 'Update Lease', 3: 'NSID', 5: 'DAU', 6: 'DHU', 7: 'N3U', 8: 'edns-client-subnet',
  9: 'EDNS EXPIRE', 10: 'COOKIE', 11: 'edns-tcp-keepalive', 12: 'Padding', 13: 'CHAIN',
  14: 'edns-key-tag', 15: 'Extended DNS Error', 16: 'EDNS-Client-Tag', 17: 'EDNS-Server-Tag',
  18: 'Report-Channel', 19: 'ZONEVERSION', 20: 'MQTYPE-Query', 21: 'MQTYPE-Response',
  22: 'EDE-EXTRA-TEXT-LANGUAGE', 23: 'FILTERING-CONTACT', 24: 'FILTERING-ORGANIZATION',
  25: 'FILTERING-DB', 26: 'Structured DNS Error'
};

/* IANA « Extended DNS Error Codes » (RFC 8914 et suivantes). */
const ERREURS_ETENDUES = [
  'Other Error', 'Unsupported DNSKEY Algorithm', 'Unsupported DS Digest Type', 'Stale Answer',
  'Forged Answer', 'DNSSEC Indeterminate', 'DNSSEC Bogus', 'Signature Expired',
  'Signature Not Yet Valid', 'DNSKEY Missing', 'RRSIGs Missing', 'No Zone Key Bit Set',
  'NSEC Missing', 'Cached Error', 'Not Ready', 'Blocked', 'Censored', 'Filtered', 'Prohibited',
  'Stale NXDomain Answer', 'Not Authoritative', 'Not Supported', 'No Reachable Authority',
  'Network Error', 'Invalid Data', 'Signature Expired before Valid', 'Too Early',
  'Unsupported NSEC3 Iterations Value', 'Unable to conform to policy', 'Synthesized',
  'Invalid Query Type', 'Rate Limited', 'Over Quota', 'Negative Trust Anchor',
  'New Delegation Only', 'Blocked by Upstream DNS Server'
];

/* IANA « Service Parameter Keys (SvcParamKeys) ». */
const CLES_SVCB = ['mandatory', 'alpn', 'no-default-alpn', 'port', 'ipv4hint', 'ech', 'ipv6hint',
  'dohpath', 'ohttp', 'tls-supported-groups', 'docpath', 'pvd', 'oots'];

export const FAITS_DNS = {
  identifiant: 'identifiant {id} : la RFC 8484 (4.1) demande 0, pour que les reponses se mettent en cache',
  tronque: 'reponse tronquee (drapeau TC)',
  authentifie: 'donnees validees par DNSSEC, selon le resolveur (drapeau AD)',
  dnssecDemande: 'la requete demande les enregistrements DNSSEC (bit DO)',
  sousReseau: 'le sous-reseau du client est transmis aux serveurs (EDNS Client Subnet : {prefixe})',
  rembourrage: 'message rembourre a une taille fixe (option Padding, RFC 7830)',
  erreurEtendue: 'erreur etendue {code} — {nom}{texte}'
};

class Lecteur {
  constructor(o) { this.o = o; this.i = 0; }
  u8() { if (this.i >= this.o.length) throw new Error('message DNS tronque'); return this.o[this.i++]; }
  u16() { return (this.u8() << 8) | this.u8(); }
  u32() { return ((this.u16() << 16) >>> 0) + this.u16(); }
  tranche(n) {
    if (this.i + n > this.o.length) throw new Error('message DNS tronque');
    const morceau = this.o.subarray(this.i, this.i + n);
    this.i += n;
    return morceau;
  }
}

/* Un label, en format de presentation (RFC 1035, 5.1) : un point ou un
   caractere non imprimable s echappe. */
function labelTexte(octets) {
  let s = '';
  for (const o of octets) {
    if (o === 0x2e || o === 0x5c) s += '\\' + String.fromCharCode(o);
    else if (o > 0x20 && o < 0x7f) s += String.fromCharCode(o);
    else s += '\\' + String(o).padStart(3, '0');
  }
  return s;
}

/* Un nom, avec la compression (4.1.4). Un pointeur ne peut viser qu en
   arriere : c est ce qui interdit les boucles. */
function lireNom(lec) {
  const labels = [];
  let i = lec.i;
  let retour = -1;
  let longueur = 1;                  // l octet nul de la racine compte (RFC 1035, 3.1)
  for (let sauts = 0; ; ) {
    if (i >= lec.o.length) throw new Error('nom DNS tronque');
    const n = lec.o[i];
    if (n === 0) { i++; break; }
    if ((n & 0xc0) === 0xc0) {
      if (i + 1 >= lec.o.length) throw new Error('pointeur DNS tronque');
      const cible = ((n & 0x3f) << 8) | lec.o[i + 1];
      if (retour < 0) retour = i + 2;
      if (cible >= i || ++sauts > 127) throw new Error('pointeur de compression invalide');
      i = cible;
      continue;
    }
    if (n & 0xc0) throw new Error('type de label reserve');
    if (i + 1 + n > lec.o.length) throw new Error('label DNS tronque');
    labels.push(labelTexte(lec.o.subarray(i + 1, i + 1 + n)));
    longueur += n + 1;
    if (longueur > 255) throw new Error('nom DNS de plus de 255 octets');
    i += 1 + n;
  }
  lec.i = retour >= 0 ? retour : i;
  return labels.length ? labels.join('.') + '.' : '.';
}

const nomType = code => (decrireTypeDns(code) || {}).nom || 'TYPE' + code;
const ipv4 = o => [...o].join('.');
const ipv6 = o => compacterIpv6(Array.from({ length: 8 }, (_, k) => ((o[2 * k] << 8) | o[2 * k + 1]).toString(16)).join(':'));
const chaineCar = octets => '"' + [...octets].map(o => (o === 0x22 || o === 0x5c ? '\\' + String.fromCharCode(o)
  : o >= 0x20 && o < 0x7f ? String.fromCharCode(o) : '\\' + String(o).padStart(3, '0'))).join('') + '"';

function lireChainesCar(lec, fin) {
  const out = [];
  while (lec.i < fin) out.push(chaineCar(lec.tranche(lec.u8())));
  return out;
}

function lireSvcb(lec, fin) {
  const priorite = lec.u16();
  const cible = lireNom(lec);
  const params = [];
  while (lec.i < fin) {
    const cle = lec.u16();
    const valeur = lec.tranche(lec.u16());
    const nom = CLES_SVCB[cle] || 'key' + cle;
    const v = new Lecteur(valeur);
    let texte;
    if (cle === 1) { const l = []; while (v.i < valeur.length) l.push(new TextDecoder().decode(v.tranche(v.u8()))); texte = l.join(','); }
    else if (cle === 0) {
      const l = [];
      while (v.i < valeur.length) { const k = v.u16(); l.push(CLES_SVCB[k] || 'key' + k); }
      texte = l.join(',');
    }
    else if (cle === 3) texte = String(v.u16());
    else if (cle === 4) { const l = []; while (v.i < valeur.length) l.push(ipv4(v.tranche(4))); texte = l.join(','); }
    else if (cle === 6) { const l = []; while (v.i < valeur.length) l.push(ipv6(v.tranche(16))); texte = l.join(','); }
    else if (cle === 5) texte = octetsVersBase64(valeur);
    else if (cle === 7) texte = new TextDecoder().decode(valeur);
    else texte = valeur.length ? octetsVersHex(valeur) : '';
    params.push(texte === '' ? nom : nom + '=' + texte);
  }
  return priorite + ' ' + cible + (params.length ? ' ' + params.join(' ') : '');
}

const horodatage = s => new Date(s * 1000).toISOString().replace(/\.000Z$/, 'Z');

function lireDonnees(lec, type, longueur) {
  const fin = lec.i + longueur;
  if (fin > lec.o.length) throw new Error('donnees d enregistrement tronquees');
  let texte;
  switch (type) {
    case 1: texte = longueur === 4 ? ipv4(lec.tranche(4)) : null; break;
    case 28: texte = longueur === 16 ? ipv6(lec.tranche(16)) : null; break;
    case 2: case 5: case 12: case 39: texte = lireNom(lec); break;
    case 15: texte = lec.u16() + ' ' + lireNom(lec); break;
    case 16: texte = lireChainesCar(lec, fin).join(' '); break;
    case 6: texte = [lireNom(lec), lireNom(lec), lec.u32(), lec.u32(), lec.u32(), lec.u32(), lec.u32()].join(' '); break;
    case 33: texte = [lec.u16(), lec.u16(), lec.u16(), lireNom(lec)].join(' '); break;
    case 257: { const f = lec.u8(); const tag = new TextDecoder().decode(lec.tranche(lec.u8()));
      texte = f + ' ' + tag + ' ' + chaineCar(lec.tranche(fin - lec.i)); break; }
    case 43: texte = [lec.u16(), lec.u8(), lec.u8(), octetsVersHex(lec.tranche(fin - lec.i)).toUpperCase()].join(' '); break;
    case 48: texte = [lec.u16(), lec.u8(), lec.u8(), octetsVersBase64(lec.tranche(fin - lec.i))].join(' '); break;
    case 46: texte = [nomType(lec.u16()), lec.u8(), lec.u8(), lec.u32(), horodatage(lec.u32()), horodatage(lec.u32()),
      lec.u16(), lireNom(lec), octetsVersBase64(lec.tranche(fin - lec.i))].join(' '); break;
    case 64: case 65: texte = lireSvcb(lec, fin); break;
    default: texte = null;
  }
  /* Type inconnu, ou donnees d une forme inattendue : le format generique
     de la RFC 3597 (« \# longueur hex »), plutot qu une lecture inventee. */
  if (texte === null) { lec.i = fin - longueur; texte = '\\# ' + longueur + (longueur ? ' ' + octetsVersHex(lec.tranche(longueur)) : ''); }
  if (lec.i !== fin) throw new Error('donnees ' + nomType(type) + ' : longueur annoncee ' + longueur + ', lue ' + (lec.i - fin + longueur));
  return texte;
}

function lireOpt(rr, octets) {
  const opt = {
    tailleUdp: rr.classe, rcodeEtendu: (rr.ttl >>> 24) & 0xff, version: (rr.ttl >>> 16) & 0xff,
    dnssecOk: !!(rr.ttl & 0x8000), options: []
  };
  const lec = new Lecteur(octets);
  while (lec.i < octets.length) {
    const code = lec.u16();
    const v = lec.tranche(lec.u16());
    const option = { code, nom: OPTIONS_EDNS[code] || 'option ' + code, longueur: v.length };
    /* Familles d adresses IANA : 1 IPv4, 2 IPv6. Une autre ne se lit pas. */
    if (code === 8 && v.length >= 4 && (((v[0] << 8) | v[1]) === 1 || ((v[0] << 8) | v[1]) === 2)) {
      const famille = (v[0] << 8) | v[1];
      const source = v[2];
      const adresse = v.subarray(4);
      const complet = new Uint8Array(famille === 2 ? 16 : 4);
      complet.set(adresse.subarray(0, complet.length));
      option.valeur = (famille === 2 ? ipv6(complet) : ipv4(complet)) + '/' + source;
      option.portee = v[3];
    } else if (code === 15 && v.length >= 2) {
      option.infoCode = (v[0] << 8) | v[1];
      option.valeur = option.infoCode + ' ' + (ERREURS_ETENDUES[option.infoCode] || '');
      option.texte = new TextDecoder().decode(v.subarray(2));
    } else if (code === 3) {
      option.valeur = octetsVersHex(v);
    } else if (code === 12) {
      option.valeur = null;
    } else if (code === 10) {
      option.client = octetsVersHex(v.subarray(0, 8));
      option.serveur = v.length > 8 ? octetsVersHex(v.subarray(8)) : null;
      option.valeur = option.client + (option.serveur ? ' ' + option.serveur : '');
    } else {
      option.valeur = octetsVersHex(v);
    }
    opt.options.push(option);
  }
  return opt;
}

function lireEnregistrement(lec) {
  const nom = lireNom(lec);
  const type = lec.u16();
  const classe = lec.u16();
  const ttl = lec.u32();
  const longueur = lec.u16();
  const rr = { nom, type, typeNom: nomType(type), classe, classeNom: CLASSES[classe] || 'CLASS' + classe, ttl };
  if (type === 41) {
    rr.opt = lireOpt(rr, lec.tranche(longueur));
    return rr;
  }
  rr.donnees = lireDonnees(lec, type, longueur);
  return rr;
}

/**
 * Lit un message DNS complet.
 * @returns { id, reponse, opcode, drapeaux, rcode, rcodeNom, questions, reponses,
 *            autorite, additionnels, opt, faits }
 */
export function lireMessageDns(octets) {
  if (octets.length < 12) throw new Error('message DNS de ' + octets.length + ' octets : l en-tete en compte 12');
  const lec = new Lecteur(octets);
  const id = lec.u16();
  const f = lec.u16();
  const nombres = [lec.u16(), lec.u16(), lec.u16(), lec.u16()];
  const m = {
    id, reponse: !!(f & 0x8000), opcode: OPCODES[(f >> 11) & 0xf] || String((f >> 11) & 0xf),
    drapeaux: { AA: !!(f & 0x400), TC: !!(f & 0x200), RD: !!(f & 0x100), RA: !!(f & 0x80),
      AD: !!(f & 0x20), CD: !!(f & 0x10) },
    rcode: f & 0xf, questions: [], reponses: [], autorite: [], additionnels: [], opt: null
  };
  for (let k = 0; k < nombres[0]; k++) {
    const nom = lireNom(lec);
    const type = lec.u16();
    const classe = lec.u16();
    m.questions.push({ nom, type, typeNom: nomType(type), classeNom: CLASSES[classe] || 'CLASS' + classe });
  }
  for (const [n, liste] of [[nombres[1], m.reponses], [nombres[2], m.autorite], [nombres[3], m.additionnels]]) {
    for (let k = 0; k < n; k++) liste.push(lireEnregistrement(lec));
  }
  if (lec.i !== octets.length) throw new Error((octets.length - lec.i) + ' octets en trop apres le message');
  const opt = m.additionnels.find(r => r.opt);
  if (opt) {
    m.opt = opt.opt;
    m.additionnels = m.additionnels.filter(r => r !== opt);
    m.rcode |= m.opt.rcodeEtendu << 4;
  }
  const r = decrireRcodeDns(m.rcode);
  m.rcodeNom = r ? r.nom : String(m.rcode);
  m.faits = faitsDns(m);
  return m;
}

function faitsDns(m) {
  const faits = [];
  if (!m.reponse && m.id !== 0) faits.push({ texte: FAITS_DNS.identifiant, valeurs: { id: m.id } });
  if (m.drapeaux.TC) faits.push({ texte: FAITS_DNS.tronque, valeurs: {} });
  if (m.reponse && m.drapeaux.AD) faits.push({ texte: FAITS_DNS.authentifie, valeurs: {} });
  if (m.opt) {
    if (!m.reponse && m.opt.dnssecOk) faits.push({ texte: FAITS_DNS.dnssecDemande, valeurs: {} });
    for (const o of m.opt.options) {
      if (o.code === 8) faits.push({ texte: FAITS_DNS.sousReseau, valeurs: { prefixe: o.valeur } });
      if (o.code === 12) faits.push({ texte: FAITS_DNS.rembourrage, valeurs: {} });
      if (o.code === 15) {
        faits.push({ texte: FAITS_DNS.erreurEtendue,
          valeurs: { code: o.infoCode, nom: ERREURS_ETENDUES[o.infoCode] || '?', texte: o.texte ? ' : « ' + o.texte + ' »' : '' } });
      }
    }
  }
  return faits;
}

/** Une ligne d enregistrement en format de presentation (RFC 1035, 5.1). */
export function ligneEnregistrement(rr) {
  return rr.nom + '\t' + rr.ttl + '\t' + rr.classeNom + '\t' + rr.typeNom + '\t' + rr.donnees;
}

/* ------------------------------ Dans le trafic ---------------------------- */
const octetsDe64url = t => {
  const net = String(t).trim().replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(net + '='.repeat((4 - (net.length % 4)) % 4)), c => c.charCodeAt(0));
};

/**
 * Les messages DNS d un enregistrement : la question (parametre `dns=` ou
 * corps POST) et la reponse, quand elles sont en `application/dns-message`.
 * @returns { question: {message, brut}|{erreur}|null, reponse: ...|null }
 *          `brut` : les octets en base64, pour les rouvrir ailleurs
 */
export function messagesDnsDe(rec) {
  const lire = octets => {
    try { return { message: lireMessageDns(octets), brut: octetsVersBase64(octets) }; }
    catch (e) { return { erreur: String(e.message || e) }; }
  };
  const entetes = liste => Object.fromEntries((liste || []).map(h => [String(h.name).toLowerCase(), String(h.value || '')]));
  const envoye = entetes(rec.requestHeaders);
  const recu = entetes(rec.responseHeaders);
  const estDns = t => /^application\/dns-message\b/i.test(t || '');
  let question = null;
  let parametre = null;
  try { parametre = new URL(rec.url).searchParams.get('dns'); } catch { /* URL illisible */ }
  if (parametre && (rec.method || 'GET').toUpperCase() === 'GET') {
    try { question = lire(octetsDe64url(parametre)); } catch { question = { erreur: 'parametre dns= : base64url illisible' }; }
  } else if (estDns(envoye['content-type']) && rec.requestBody) {
    const b = rec.requestBody;
    /* Les octets envoyes : conserves en base64, ou redonnes exactement par le
       texte (verifie a la capture). Sinon, on ne lit pas un texte approche. */
    if (b.base64) question = lire(octetsDe64url(b.base64));
    else if (b.octetsExacts === true && typeof b.text === 'string') question = lire(new TextEncoder().encode(b.text));
    else question = { erreur: 'octets du corps envoye non conserves' };
  }
  let reponse = null;
  if (estDns(recu['content-type']) && rec.responseBody) {
    reponse = rec.responseBody.base64 ? lire(octetsDe64url(rec.responseBody.base64))
      : { erreur: 'corps binaire non conserve (reglage « corps binaires »)' };
  }
  return { question, reponse };
}

/** Une option EDNS, en texte lisible et traduit. */
export function valeurOption(o) {
  if (o.code === 8) return tp('{prefixe} (portee /{portee})', { prefixe: o.valeur, portee: o.portee });
  if (o.code === 12) return tp('{n} octets', { n: o.longueur });
  if (o.code === 10) {
    return tp('client {client}', { client: o.client }) + (o.serveur ? ', ' + tp('serveur {serveur}', { serveur: o.serveur }) : '');
  }
  if (o.code === 15) return o.valeur + (o.texte ? ' : « ' + o.texte + ' »' : '');
  return o.valeur;
}

/** Pour la boite a outils : un message colle en base64url, base64 ou hexadecimal. */
export function dnsVersTexte(texte) {
  const brut = String(texte || '').trim().replace(/^.*[?&]dns=/, '').replace(/&.*$/, '');
  if (!brut) throw new Error('rien a decoder');
  const sansEspace = brut.replace(/\s+/g, '');
  /* Une meme chaine peut se lire en hexadecimal ET en base64url (« AAAA »,
     « 00ab ») : on essaie les deux, et on garde la lecture qui donne un message. */
  const lectures = [];
  if (/^[0-9a-fA-F]+$/.test(sansEspace) && sansEspace.length % 2 === 0) {
    lectures.push(() => Uint8Array.from(sansEspace.match(/../g), h => parseInt(h, 16)));
  }
  lectures.push(() => octetsDe64url(sansEspace));
  let m = null;
  let erreur = null;
  for (const lire of lectures) {
    try { m = lireMessageDns(lire()); break; } catch (e) { erreur = erreur || e; }
  }
  if (!m) throw erreur;
  const lignes = [
    ';; ' + tp('{sens}, opcode {opcode}, statut {statut}, id {id}',
      { sens: t(m.reponse ? 'reponse' : 'requete'), opcode: m.opcode, statut: m.rcodeNom, id: m.id }),
    ';; ' + tp('drapeaux : {liste}',
      { liste: Object.entries(m.drapeaux).filter(([, v]) => v).map(([k]) => k).join(' ') || t('(aucun)') })
  ];
  if (m.opt) {
    lignes.push(';; EDNS version ' + m.opt.version + ', UDP ' + m.opt.tailleUdp + (m.opt.dnssecOk ? ', DO' : ''));
    for (const o of m.opt.options) lignes.push(';;   ' + o.nom + ' : ' + valeurOption(o));
  }
  lignes.push('', ';; ' + t('QUESTION'));
  for (const q of m.questions) lignes.push(';' + q.nom + '\t\t' + q.classeNom + '\t' + q.typeNom);
  for (const [titre, liste] of [['REPONSE', m.reponses], ['AUTORITE', m.autorite], ['ADDITIONNEL', m.additionnels]]) {
    if (!liste.length) continue;
    lignes.push('', ';; ' + t(titre));
    for (const rr of liste) lignes.push(ligneEnregistrement(rr));
  }
  return lignes.join('\n');
}
