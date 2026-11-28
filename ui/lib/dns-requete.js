/* Ecrire une question DNS — SWIFT (by D4RK)
 *
 * Le message qu envoie l outil « Resolution DNS » en mode DNS sur HTTPS
 * (RFC 8484) : une question, au format filaire de la RFC 1035 (4.1), que
 * dns-message.js relit ensuite avec la reponse.
 *
 *   - identifiant 0 : la RFC 8484 (4.1) le demande, pour que les reponses se
 *     mettent en cache ;
 *   - recursion demandee (RD) ;
 *   - un enregistrement OPT (EDNS, RFC 6891) annonce 1232 octets — la taille
 *     que recommande le « DNS Flag Day 2020 » —, porte le bit DO quand on
 *     veut les enregistrements DNSSEC (RFC 3225), et rembourre la question a
 *     un multiple de 128 octets (option Padding, RFC 7830, avec la taille de
 *     bloc que recommande la RFC 8467 pour les questions) : la longueur du
 *     message chiffre ne trahit plus le nom demande.
 */
import { estIpv4, estIpv6, etendreIpv6 } from './net.js';

/* Les types que l outil propose, dans l ordre ou on les cherche le plus. */
export const TYPES_DNS = [
  ['A', 1], ['AAAA', 28], ['CNAME', 5], ['MX', 15], ['TXT', 16], ['NS', 2], ['SOA', 6],
  ['CAA', 257], ['HTTPS', 65], ['SVCB', 64], ['SRV', 33], ['PTR', 12], ['DNAME', 39],
  ['DS', 43], ['DNSKEY', 48]
];

const PAR_NOM = new Map(TYPES_DNS);

/** Le code d un type, depuis son nom (« MX ») ou son numero (« 15 »). */
export function codeTypeDns(type) {
  const brut = String(type == null ? '' : type).trim().toUpperCase();
  if (PAR_NOM.has(brut)) return PAR_NOM.get(brut);
  if (/^(TYPE)?[0-9]{1,5}$/.test(brut)) {
    const n = Number(brut.replace('TYPE', ''));
    if (n >= 1 && n <= 65535) return n;
  }
  return null;
}

/**
 * Le nom a demander pour une adresse IP : la question PTR se pose sur
 * in-addr.arpa (RFC 1035 3.5) ou ip6.arpa (RFC 3596 2.5).
 */
export function nomPourPtr(adresse) {
  const ip = String(adresse == null ? '' : adresse).trim();
  if (estIpv4(ip)) return ip.split('.').reverse().join('.') + '.in-addr.arpa';
  if (estIpv6(ip)) return etendreIpv6(ip).replace(/:/g, '').split('').reverse().join('.') + '.ip6.arpa';
  return null;
}

/** Les etiquettes d un nom, en octets, verifiees (RFC 1035 2.3.4). */
function etiquettes(nom) {
  const brut = String(nom == null ? '' : nom).trim().replace(/\.$/, '');
  if (!brut) return [];
  const sortie = [];
  let total = 1;
  for (const e of brut.split('.')) {
    if (!e) throw new Error('nom DNS avec une etiquette vide : ' + brut);
    const octets = new TextEncoder().encode(e);
    if (octets.length > 63) throw new Error('etiquette de plus de 63 octets : ' + e);
    total += octets.length + 1;
    sortie.push(octets);
  }
  if (total > 255) throw new Error('nom DNS de plus de 255 octets');
  return sortie;
}

/**
 * @param nom      le nom demande (deja en punycode)
 * @param type     son code (1 pour A…)
 * @param options.dnssec       bit DO : rendre aussi les signatures
 * @param options.edns         false : une question nue, sans OPT
 * @param options.rembourrage  false : pas d option Padding
 * @returns Uint8Array
 */
export function construireRequeteDns(nom, type, { dnssec = false, edns = true, rembourrage = true } = {}) {
  const code = Number(type);
  if (!Number.isInteger(code) || code < 1 || code > 65535) throw new Error('type DNS invalide : ' + type);
  const labels = etiquettes(nom);
  const octets = [];
  const u16 = v => octets.push((v >> 8) & 0xff, v & 0xff);
  /* En-tete : id 0, RD, une question, un additionnel si EDNS. */
  u16(0); u16(0x0100); u16(1); u16(0); u16(0); u16(edns ? 1 : 0);
  for (const l of labels) { octets.push(l.length, ...l); }
  octets.push(0);
  u16(code); u16(1);
  if (edns) {
    /* OPT : nom racine, type 41, classe = taille UDP, TTL = rcode etendu,
       version, drapeaux (DO = 0x8000). */
    const avantOpt = octets.length;
    octets.push(0); u16(41); u16(1232);
    octets.push(0, 0); u16(dnssec ? 0x8000 : 0);
    if (rembourrage) {
      /* Taille finale : multiple de 128. L option elle-meme prend 4 octets
         d en-tete, et RDLEN 2 de plus. */
      const sansOption = avantOpt + 11;
      const avecEntete = sansOption + 4;
      const cible = Math.ceil(avecEntete / 128) * 128;
      const remplissage = cible - avecEntete;
      u16(4 + remplissage);
      u16(12); u16(remplissage);
      for (let k = 0; k < remplissage; k++) octets.push(0);
    } else {
      u16(0);
    }
  }
  return new Uint8Array(octets);
}
