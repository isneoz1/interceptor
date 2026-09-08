/* Calculs de reseau — INTERCEPTOR (by NeoZ)
 *
 * Decoupage d URL, arithmetique IPv4 et IPv6, calcul de sous-reseau,
 * appartenance a un prefixe et categorie d adresse (RFC 1918, 6598, 4193...).
 * Fonctions pures : la boite a outils les affiche, les tests les executent
 * hors navigateur.
 */
import { domaineVersAscii, domaineVersUnicode } from './codecs-web.js';

/* ----------------------------------- URL ---------------------------------- */
const PORTS_PAR_DEFAUT = { 'http:': 80, 'https:': 443, 'ws:': 80, 'wss:': 443, 'ftp:': 21 };

/** Decoupe une URL en toutes ses parties, sans en cacher aucune. */
export function analyserUrl(entree) {
  const brut = String(entree || '').trim();
  if (!brut) throw new Error('URL vide');
  let u;
  try { u = new URL(brut); }
  catch {
    try { u = new URL('https://' + brut); }
    catch { throw new Error('URL illisible'); }
  }
  const parametres = [...u.searchParams.entries()].map(([cle, valeur]) => ({ cle, valeur }));
  const segments = u.pathname.split('/').filter(Boolean);
  const hoteUnicode = domaineVersUnicode(u.hostname);
  const etiquettes = u.hostname.split('.');
  return {
    complete: u.href,
    schema: u.protocol.replace(':', ''),
    utilisateur: u.username || null,
    motDePasse: u.password || null,
    hote: u.hostname,
    hoteAscii: domaineVersAscii(u.hostname),
    hoteUnicode,
    hoteTrompeur: hoteUnicode !== u.hostname,
    port: u.port || null,
    portEffectif: u.port ? Number(u.port) : (PORTS_PAR_DEFAUT[u.protocol] || null),
    origine: u.origin === 'null' ? null : u.origin,
    chemin: u.pathname,
    segments,
    fichier: segments.length ? segments[segments.length - 1] : null,
    extension: (segments.length && segments[segments.length - 1].includes('.'))
      ? segments[segments.length - 1].split('.').pop() : null,
    requete: u.search ? u.search.slice(1) : null,
    parametres,
    fragment: u.hash ? u.hash.slice(1) : null,
    deuxEtiquettes: etiquettes.length > 1 ? etiquettes.slice(-2).join('.') : u.hostname,
    derniereEtiquette: etiquettes.length > 1 ? etiquettes[etiquettes.length - 1] : null,
    etiquettes,
    estAdresseIp: estIpv4(u.hostname) || estIpv6(u.hostname.replace(/^\[|\]$/g, '')),
    longueur: u.href.length
  };
}

/* ---------------------------------- IPv4 ---------------------------------- */
export function estIpv4(valeur) {
  return /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(String(valeur))
    && String(valeur).split('.').every(o => Number(o) >= 0 && Number(o) <= 255);
}

export function ipv4VersEntier(ip) {
  if (!estIpv4(ip)) throw new Error('adresse IPv4 invalide : ' + ip);
  return String(ip).split('.').reduce((n, o) => n * 256 + Number(o), 0);
}

export function entierVersIpv4(n) {
  const x = Number(n);
  if (!Number.isInteger(x) || x < 0 || x > 4294967295) throw new Error('entier hors de la plage IPv4');
  return [x >>> 24, (x >>> 16) & 255, (x >>> 8) & 255, x & 255].join('.');
}

const PLAGES_V4 = [
  ['0.0.0.0/8', 'reseau courant (RFC 1122)'],
  ['10.0.0.0/8', 'privee (RFC 1918)'],
  ['100.64.0.0/10', 'partagee entre operateurs (RFC 6598)'],
  ['127.0.0.0/8', 'boucle locale (RFC 1122)'],
  ['169.254.0.0/16', 'lien local (RFC 3927)'],
  ['172.16.0.0/12', 'privee (RFC 1918)'],
  ['192.0.0.0/24', 'affectations de protocole (RFC 6890)'],
  ['192.0.2.0/24', 'documentation TEST-NET-1 (RFC 5737)'],
  ['192.88.99.0/24', 'relais 6to4 abandonne (RFC 7526)'],
  ['192.168.0.0/16', 'privee (RFC 1918)'],
  ['198.18.0.0/15', 'mesure de performance (RFC 2544)'],
  ['198.51.100.0/24', 'documentation TEST-NET-2 (RFC 5737)'],
  ['203.0.113.0/24', 'documentation TEST-NET-3 (RFC 5737)'],
  ['224.0.0.0/4', 'multidiffusion (RFC 5771)'],
  ['240.0.0.0/4', 'reservee pour usage futur (RFC 1112)'],
  ['255.255.255.255/32', 'diffusion generale']
];

/** Categorie d une adresse IPv4, d apres les plages reservees publiees. */
export function categorieIpv4(ip) {
  const n = ipv4VersEntier(ip);
  for (const [prefixe, libelle] of PLAGES_V4) {
    const [base, bits] = prefixe.split('/');
    const masque = bits === '0' ? 0 : (0xffffffff << (32 - Number(bits))) >>> 0;
    if ((n & masque) >>> 0 === (ipv4VersEntier(base) & masque) >>> 0) return libelle;
  }
  return 'publique';
}

/** Calcul complet d un sous-reseau IPv4 : tout ce qu on veut savoir d un /n. */
export function analyserCidrV4(entree) {
  const brut = String(entree || '').trim();
  const [adresse, bitsTexte] = brut.split('/');
  if (!estIpv4(adresse)) throw new Error('adresse IPv4 invalide');
  const bits = bitsTexte === undefined ? 32 : Number(bitsTexte);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) throw new Error('prefixe hors de 0 a 32');

  const n = ipv4VersEntier(adresse);
  const masque = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const reseau = (n & masque) >>> 0;
  const diffusion = (reseau | (~masque >>> 0)) >>> 0;
  const total = Math.pow(2, 32 - bits);
  const utilisables = bits >= 31 ? total : Math.max(0, total - 2);

  return {
    adresse, prefixe: bits,
    masque: entierVersIpv4(masque),
    masqueJoker: entierVersIpv4((~masque) >>> 0),
    reseau: entierVersIpv4(reseau),
    diffusion: entierVersIpv4(diffusion),
    premiere: entierVersIpv4(bits >= 31 ? reseau : reseau + 1),
    derniere: entierVersIpv4(bits >= 31 ? diffusion : diffusion - 1),
    adresses: total,
    utilisables,
    categorie: categorieIpv4(adresse),
    entier: n,
    binaire: [...Array(4)].map((x, i) => ((n >>> (24 - i * 8)) & 255).toString(2).padStart(8, '0')).join('.'),
    hexadecimal: '0x' + (n >>> 0).toString(16).padStart(8, '0'),
    inverse: adresse.split('.').reverse().join('.') + '.in-addr.arpa'
  };
}

export function ipDansCidrV4(ip, cidr) {
  const bloc = analyserCidrV4(cidr);
  const n = ipv4VersEntier(ip);
  return n >= ipv4VersEntier(bloc.reseau) && n <= ipv4VersEntier(bloc.diffusion);
}

/* ---------------------------------- IPv6 ---------------------------------- */
export function estIpv6(valeur) {
  const s = String(valeur);
  if (!s.includes(':')) return false;
  try { etendreIpv6(s); return true; } catch { return false; }
}

/** Ecriture longue : huit groupes de quatre chiffres, sans abreviation. */
export function etendreIpv6(entree) {
  let s = String(entree || '').trim().replace(/^\[|\]$/g, '').split('%')[0];
  if (!s) throw new Error('adresse IPv6 vide');

  // Une adresse IPv4 en fin d adresse (::ffff:192.0.2.1) devient deux groupes.
  const v4 = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) {
    if (!estIpv4(v4[1])) throw new Error('partie IPv4 invalide');
    const n = ipv4VersEntier(v4[1]);
    s = s.slice(0, v4.index) +
      ((n >>> 16) & 0xffff).toString(16) + ':' + (n & 0xffff).toString(16);
  }

  const double = s.split('::');
  if (double.length > 2) throw new Error('« :: » ne peut apparaitre qu une fois');
  const gauche = double[0] ? double[0].split(':') : [];
  const droite = double.length === 2 ? (double[1] ? double[1].split(':') : []) : [];
  if (double.length === 1 && gauche.length !== 8) throw new Error('adresse IPv6 incomplete');
  const manquants = 8 - gauche.length - droite.length;
  if (manquants < 0) throw new Error('adresse IPv6 trop longue');
  const groupes = [...gauche, ...Array(double.length === 2 ? manquants : 0).fill('0'), ...droite];
  return groupes.map(g => {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) throw new Error('groupe IPv6 invalide : ' + g);
    return g.toLowerCase().padStart(4, '0');
  }).join(':');
}

/** Ecriture courte recommandee par le RFC 5952. */
export function compacterIpv6(entree) {
  const groupes = etendreIpv6(entree).split(':').map(g => g.replace(/^0+(?=.)/, ''));
  let meilleurDebut = -1, meilleureTaille = 0, debut = -1, taille = 0;
  for (let i = 0; i < 8; i++) {
    if (groupes[i] === '0') {
      if (debut < 0) debut = i;
      taille++;
      if (taille > meilleureTaille) { meilleureTaille = taille; meilleurDebut = debut; }
    } else { debut = -1; taille = 0; }
  }
  if (meilleureTaille < 2) return groupes.join(':');
  return (groupes.slice(0, meilleurDebut).join(':') + '::' +
    groupes.slice(meilleurDebut + meilleureTaille).join(':')).replace(/:{3,}/, '::');
}

const PLAGES_V6 = [
  ['::1/128', 'boucle locale'],
  ['::/128', 'adresse non specifiee'],
  ['::ffff:0:0/96', 'IPv4 projetee dans IPv6 (RFC 4291)'],
  ['64:ff9b::/96', 'traduction NAT64 (RFC 6052)'],
  ['100::/64', 'trou noir de routage (RFC 6666)'],
  ['2001:db8::/32', 'documentation (RFC 3849)'],
  ['2001::/32', 'Teredo (RFC 4380)'],
  ['2002::/16', '6to4 (RFC 3056)'],
  ['fc00::/7', 'unique locale, ULA (RFC 4193)'],
  ['fe80::/10', 'lien local (RFC 4291)'],
  ['ff00::/8', 'multidiffusion (RFC 4291)']
];

const ipv6VersEntier = ip => BigInt('0x' + etendreIpv6(ip).split(':').join(''));
const entierVersIpv6 = n => {
  const hex = n.toString(16).padStart(32, '0');
  return compacterIpv6((hex.match(/.{4}/g) || []).join(':'));
};

export function categorieIpv6(ip) {
  const n = ipv6VersEntier(ip);
  for (const [prefixe, libelle] of PLAGES_V6) {
    const [base, bits] = prefixe.split('/');
    const decalage = 128n - BigInt(bits);
    if ((n >> decalage) === (ipv6VersEntier(base) >> decalage)) return libelle;
  }
  return 'unidiffusion mondiale';
}

/** Calcul d un prefixe IPv6 : premiere adresse, derniere, nombre d adresses. */
export function analyserCidrV6(entree) {
  const brut = String(entree || '').trim();
  const [adresse, bitsTexte] = brut.split('/');
  const bits = bitsTexte === undefined ? 128 : Number(bitsTexte);
  if (!Number.isInteger(bits) || bits < 0 || bits > 128) throw new Error('prefixe hors de 0 a 128');
  const n = ipv6VersEntier(adresse);
  const masque = bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(128 - bits);
  const reseau = n & masque;
  const derniere = reseau | ((1n << BigInt(128 - bits)) - 1n);
  return {
    adresse: compacterIpv6(adresse),
    etendue: etendreIpv6(adresse),
    prefixe: bits,
    reseau: entierVersIpv6(reseau),
    premiere: entierVersIpv6(reseau),
    derniere: entierVersIpv6(derniere),
    adresses: (derniere - reseau + 1n).toString(),
    categorie: categorieIpv6(adresse),
    hexadecimal: '0x' + n.toString(16).padStart(32, '0'),
    inverse: etendreIpv6(adresse).split(':').join('').split('').reverse().join('.') + '.ip6.arpa'
  };
}

export function ipDansCidrV6(ip, cidr) {
  const [base, bitsTexte] = String(cidr).split('/');
  const bits = bitsTexte === undefined ? 128 : Number(bitsTexte);
  const decalage = BigInt(128 - bits);
  return (ipv6VersEntier(ip) >> decalage) === (ipv6VersEntier(base) >> decalage);
}

/** Aiguillage : rend l analyse qui convient a la famille de l adresse. */
export function analyserPrefixe(entree) {
  const brut = String(entree || '').trim();
  const adresse = brut.split('/')[0];
  if (estIpv4(adresse)) return { famille: 'IPv4', ...analyserCidrV4(brut) };
  if (estIpv6(adresse)) return { famille: 'IPv6', ...analyserCidrV6(brut) };
  throw new Error('ni IPv4 ni IPv6');
}
