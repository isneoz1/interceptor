/* RDAP, le whois d aujourd hui — SWIFT (by D4RK)
 *
 * Qui a enregistre un domaine, quand il expire, quels serveurs de noms il
 * designe ; a qui appartient une adresse IP ou un numero de systeme
 * autonome. RDAP (RFC 9082, 9083) repond en JSON, la ou whois rendait un
 * texte libre propre a chaque registre.
 *
 *   - le serveur a interroger se trouve dans les fichiers d amorce de l IANA
 *     (RFC 9224) : un par domaine de premier niveau, par bloc d adresses,
 *     par plage de numeros AS ;
 *   - la reponse se lit selon la RFC 9083 : evenements dates, statuts,
 *     entites decrites en jCard (RFC 7095), serveurs de noms, DNSSEC ;
 *   - les statuts sont ceux du registre RDAP de l IANA (RFC 8056 pour les
 *     correspondances avec EPP), expliques en clair.
 *
 * Toutes les tables sont des Map : un nom venu d un serveur — « constructor »
 * — ne doit rien trouver d herite.
 */
import { estIpv4, estIpv6, ipDansCidrV4, ipDansCidrV6 } from './net.js';

export const AMORCES_RDAP = {
  dns: 'https://data.iana.org/rdap/dns.json',
  ipv4: 'https://data.iana.org/rdap/ipv4.json',
  ipv6: 'https://data.iana.org/rdap/ipv6.json',
  asn: 'https://data.iana.org/rdap/asn.json'
};

/**
 * Ce qu on demande : un domaine, une adresse IP ou un numero AS.
 * @returns { type: 'domain'|'ip'|'autnum', valeur, amorce, chemin } ou null
 */
export function requeteRdap(entree) {
  let brut = String(entree == null ? '' : entree).trim();
  if (!brut || /\s/.test(brut)) return null;
  const as = /^(?:AS)?([0-9]{1,10})$/i.exec(brut);
  if (as && Number(as[1]) <= 4294967295) {
    return { type: 'autnum', valeur: String(Number(as[1])), amorce: 'asn', chemin: 'autnum/' + Number(as[1]) };
  }
  const ip = brut.replace(/^\[|\]$/g, '').split('/')[0];
  if (estIpv4(ip)) return { type: 'ip', valeur: ip, amorce: 'ipv4', chemin: 'ip/' + ip };
  if (estIpv6(ip)) return { type: 'ip', valeur: ip, amorce: 'ipv6', chemin: 'ip/' + ip };
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(brut) ? brut : 'http://' + brut);
    brut = u.hostname.replace(/\.$/, '');
  } catch { return null; }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(brut)) return null;
  return { type: 'domain', valeur: brut.toLowerCase(), amorce: 'dns', chemin: 'domain/' + brut.toLowerCase() };
}

const enNombre = v => Number(String(v));

/**
 * Le serveur RDAP d une requete, d apres le fichier d amorce de l IANA :
 * l etiquette la plus longue qui termine le domaine, le bloc d adresses le
 * plus precis, la plage AS qui contient le numero. Une adresse https est
 * preferee a une adresse http.
 */
export function choisirServeurRdap(amorce, requete) {
  const services = amorce && Array.isArray(amorce.services) ? amorce.services : [];
  let meilleur = null;
  let precision = -1;
  for (const service of services) {
    if (!Array.isArray(service) || service.length < 2) continue;
    const [entrees, urls] = service;
    if (!Array.isArray(entrees) || !Array.isArray(urls) || !urls.length) continue;
    for (const entree of entrees) {
      const e = String(entree).toLowerCase();
      let p = -1;
      if (requete.type === 'domain') {
        if (requete.valeur === e || requete.valeur.endsWith('.' + e)) p = e.split('.').length;
      } else if (requete.type === 'ip') {
        const bits = Number(e.split('/')[1]);
        const dedans = requete.amorce === 'ipv4' ? safe(() => ipDansCidrV4(requete.valeur, e)) : safe(() => ipDansCidrV6(requete.valeur, e));
        if (dedans) p = bits;
      } else if (requete.type === 'autnum') {
        const [debut, fin] = e.split('-').map(enNombre);
        const n = enNombre(requete.valeur);
        if (n >= debut && n <= (Number.isFinite(fin) ? fin : debut)) p = 1;
      }
      if (p > precision) {
        precision = p;
        meilleur = urls.map(String).find(u => u.startsWith('https://')) || String(urls[0]);
      }
    }
  }
  return meilleur;
}

function safe(fn) { try { return fn(); } catch { return false; } }

/* ------------------------------ Les statuts ------------------------------- */
/* Registre IANA « RDAP JSON Values », type status. */
export const STATUTS_RDAP = new Map([
  ['validated', 'les donnees ont ete verifiees'],
  ['renew prohibited', 'le renouvellement est interdit'],
  ['update prohibited', 'toute modification est interdite'],
  ['transfer prohibited', 'le transfert est interdit'],
  ['delete prohibited', 'la suppression est interdite'],
  ['proxy', 'les coordonnees sont celles d un intermediaire'],
  ['private', 'les coordonnees ne sont pas publiees'],
  ['removed', 'des donnees ont ete retirees de la reponse'],
  ['obscured', 'des donnees ont ete masquees dans la reponse'],
  ['associated', 'l objet est lie a d autres objets du registre'],
  ['active', 'actif, aucune restriction'],
  ['inactive', 'inactif : pas de serveurs de noms, le domaine ne resout pas'],
  ['locked', 'verrouille contre les changements'],
  ['pending create', 'creation en attente'],
  ['pending renew', 'renouvellement en attente'],
  ['pending transfer', 'transfert en cours'],
  ['pending update', 'modification en attente'],
  ['pending delete', 'suppression en attente : le domaine va etre libere'],
  ['add period', 'periode de grace apres creation'],
  ['auto renew period', 'periode de grace apres renouvellement automatique'],
  ['client delete prohibited', 'suppression bloquee par le bureau d enregistrement'],
  ['client hold', 'suspendu par le bureau d enregistrement : le domaine ne resout plus'],
  ['client renew prohibited', 'renouvellement bloque par le bureau d enregistrement'],
  ['client transfer prohibited', 'transfert bloque par le bureau d enregistrement (verrou habituel contre le vol de domaine)'],
  ['client update prohibited', 'modifications bloquees par le bureau d enregistrement'],
  ['pending restore', 'restauration en attente'],
  ['redemption period', 'periode de rachat : le domaine a expire et peut encore etre recupere'],
  ['renew period', 'periode de grace apres renouvellement'],
  ['server delete prohibited', 'suppression bloquee par le registre'],
  ['server renew prohibited', 'renouvellement bloque par le registre'],
  ['server transfer prohibited', 'transfert bloque par le registre'],
  ['server update prohibited', 'modifications bloquees par le registre'],
  ['server hold', 'suspendu par le registre : le domaine ne resout plus'],
  ['transfer period', 'periode de grace apres transfert'],
  ['administrative', 'objet administratif'],
  ['reserved', 'reserve par le registre']
]);

/* Registre IANA « RDAP JSON Values », type event action. */
export const EVENEMENTS_RDAP = new Map([
  ['registration', 'Enregistre le'],
  ['reregistration', 'Reenregistre le'],
  ['last changed', 'Modifie le'],
  ['expiration', 'Expire le'],
  ['deletion', 'Supprime le'],
  ['reinstantiation', 'Retabli le'],
  ['transfer', 'Transfere le'],
  ['locked', 'Verrouille le'],
  ['unlocked', 'Deverrouille le'],
  ['last update of RDAP database', 'Base RDAP mise a jour le'],
  ['registrar expiration', 'Expire chez le bureau d enregistrement le'],
  ['enum validation expiration', 'Validation ENUM expire le']
]);

/* Registre IANA « RDAP JSON Values », type role. */
export const ROLES_RDAP = new Map([
  ['registrant', 'Titulaire'], ['technical', 'Contact technique'], ['administrative', 'Contact administratif'],
  ['abuse', 'Contact abus'], ['billing', 'Contact facturation'], ['registrar', 'Bureau d enregistrement'],
  ['reseller', 'Revendeur'], ['sponsor', 'Parrain'], ['proxy', 'Intermediaire'], ['notifications', 'Notifications'],
  ['noc', 'Centre d exploitation reseau']
]);

/* Une jCard (RFC 7095) : ["vcard", [[nom, parametres, type, valeur], …]]. */
function lireJcard(vcard) {
  const sortie = { nom: null, organisation: null, courriel: null, telephone: null, adresse: null, pays: null };
  if (!Array.isArray(vcard) || vcard[0] !== 'vcard' || !Array.isArray(vcard[1])) return sortie;
  for (const propriete of vcard[1]) {
    if (!Array.isArray(propriete) || propriete.length < 4) continue;
    const [nom, parametres, , valeur] = propriete;
    const texte = Array.isArray(valeur) ? valeur.filter(v => typeof v === 'string' && v).join(', ') : (valeur == null ? '' : String(valeur));
    if (nom === 'fn' && texte && !sortie.nom) sortie.nom = texte;
    else if (nom === 'org' && texte && !sortie.organisation) sortie.organisation = texte;
    else if (nom === 'email' && texte && !sortie.courriel) sortie.courriel = texte;
    else if (nom === 'tel' && texte && !sortie.telephone) sortie.telephone = texte.replace(/^tel:/i, '');
    else if (nom === 'adr') {
      if (parametres && typeof parametres.label === 'string') sortie.adresse = parametres.label.replace(/\n/g, ', ');
      else if (texte) sortie.adresse = texte;
      if (Array.isArray(valeur) && typeof valeur[6] === 'string' && valeur[6]) sortie.pays = valeur[6];
      if (parametres && typeof parametres.cc === 'string') sortie.pays = parametres.cc;
    }
  }
  return sortie;
}

function lireEntites(liste, sortie, profondeur = 0) {
  if (!Array.isArray(liste) || profondeur > 4) return;
  for (const e of liste) {
    if (!e || typeof e !== 'object') continue;
    const carte = lireJcard(e.vcardArray);
    const ids = Array.isArray(e.publicIds) ? e.publicIds.filter(p => p && p.identifier).map(p => String(p.type || '') + ' ' + p.identifier) : [];
    sortie.push({
      roles: Array.isArray(e.roles) ? e.roles.map(String) : [],
      poignee: e.handle ? String(e.handle) : null,
      ...carte,
      identifiants: ids
    });
    lireEntites(e.entities, sortie, profondeur + 1);
  }
}

const dates = evts => {
  const sortie = [];
  for (const e of Array.isArray(evts) ? evts : []) {
    if (!e || !e.eventAction || !e.eventDate) continue;
    sortie.push({ action: String(e.eventAction), date: String(e.eventDate), acteur: e.eventActor ? String(e.eventActor) : null });
  }
  return sortie;
};

/**
 * Lit une reponse RDAP (objet JSON deja analyse).
 * @returns { classe, poignee, nom, nomUnicode, statuts, evenements, entites,
 *            serveursDeNoms, dnssec, plage, asn, pays, avis, liens, erreur }
 */
export function lireRdap(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('reponse RDAP illisible : un objet JSON est attendu');
  const classe = json.objectClassName ? String(json.objectClassName) : null;
  const lu = {
    classe,
    poignee: json.handle ? String(json.handle) : null,
    nom: json.ldhName ? String(json.ldhName) : (json.name ? String(json.name) : null),
    nomUnicode: json.unicodeName ? String(json.unicodeName) : null,
    statuts: (Array.isArray(json.status) ? json.status : []).map(s => String(s).toLowerCase()),
    evenements: dates(json.events),
    entites: [],
    serveursDeNoms: [],
    dnssec: null,
    plage: null,
    asn: null,
    pays: json.country ? String(json.country) : null,
    avis: [],
    liens: [],
    erreur: null
  };
  if (json.errorCode) {
    lu.erreur = { code: Number(json.errorCode), titre: json.title ? String(json.title) : null,
      description: Array.isArray(json.description) ? json.description.map(String).join(' ') : null };
  }
  lireEntites(json.entities, lu.entites);
  for (const ns of Array.isArray(json.nameservers) ? json.nameservers : []) {
    if (!ns || !ns.ldhName) continue;
    const ips = ns.ipAddresses || {};
    lu.serveursDeNoms.push({ nom: String(ns.ldhName).toLowerCase(),
      adresses: [...(Array.isArray(ips.v4) ? ips.v4 : []), ...(Array.isArray(ips.v6) ? ips.v6 : [])].map(String) });
  }
  if (json.secureDNS && typeof json.secureDNS === 'object') {
    const s = json.secureDNS;
    lu.dnssec = { signe: s.delegationSigned === true, ds: Array.isArray(s.dsData) ? s.dsData.length : 0,
      cles: Array.isArray(s.keyData) ? s.keyData.length : 0 };
  }
  if (classe === 'ip network' || json.startAddress) {
    lu.plage = {
      debut: json.startAddress ? String(json.startAddress) : null, fin: json.endAddress ? String(json.endAddress) : null,
      version: json.ipVersion ? String(json.ipVersion) : null, type: json.type ? String(json.type) : null,
      parent: json.parentHandle ? String(json.parentHandle) : null,
      cidrs: (Array.isArray(json.cidr0_cidrs) ? json.cidr0_cidrs : [])
        .map(c => (c && (c.v4prefix || c.v6prefix) ? (c.v4prefix || c.v6prefix) + '/' + c.length : null)).filter(Boolean)
    };
  }
  if (classe === 'autnum' || json.startAutnum != null) {
    lu.asn = { debut: json.startAutnum != null ? Number(json.startAutnum) : null, fin: json.endAutnum != null ? Number(json.endAutnum) : null,
      type: json.type ? String(json.type) : null };
  }
  for (const n of [...(Array.isArray(json.notices) ? json.notices : []), ...(Array.isArray(json.remarks) ? json.remarks : [])]) {
    if (n && n.title) lu.avis.push(String(n.title));
  }
  for (const l of Array.isArray(json.links) ? json.links : []) {
    if (l && l.href) lu.liens.push({ rel: l.rel ? String(l.rel) : '', href: String(l.href), type: l.type ? String(l.type) : '' });
  }
  return lu;
}

/** La date d un evenement, ou null. */
export function dateEvenement(lu, action) {
  const e = lu.evenements.find(x => x.action === action);
  return e ? e.date : null;
}

/** L entite qui joue un role (le bureau d enregistrement, le contact abus). */
export function entiteDeRole(lu, role) {
  return lu.entites.find(e => e.roles.includes(role)) || null;
}

/** Les liens vers un autre serveur RDAP qui en sait plus (le bureau
 *  d enregistrement d un registre « mince » comme .com). */
export function liensRdapLies(lu) {
  return lu.liens.filter(l => l.rel === 'related' && /^https:\/\//i.test(l.href)
    && (!l.type || /rdap\+json|json/i.test(l.type)) && /\/(domain|ip|autnum|entity|nameserver)\//i.test(l.href));
}

export const TEXTES_RDAP = [...STATUTS_RDAP.values(), ...EVENEMENTS_RDAP.values(), ...ROLES_RDAP.values()];
