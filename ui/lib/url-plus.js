/* URL et noms : normalisation, DNS inverse, homographes — INTERCEPTOR (by NeoZ)
 *
 *   - normaliserUrl : RFC 3986 section 6.2 (schema et hote en minuscules,
 *     pourcent-encodages non reserves decodes, hexadecimaux en majuscules,
 *     segments « . » et « .. » resolus, port par defaut retire, chemin vide
 *     remplace par « / »). Deux URL qui designent la meme ressource donnent
 *     alors le meme texte.
 *   - nomInverse : nom PTR d une adresse (in-addr.arpa, ip6.arpa).
 *   - scriptsDuNom : les ecritures presentes dans chaque libelle d un nom
 *     d hote, pour reperer un melange latin/cyrillique qui imite un autre nom.
 */
import { estIpv4, estIpv6, etendreIpv6 } from './net.js';

/* ------------------------------ Normalisation ----------------------------- */
const NON_RESERVES = /%(4[1-9A-F]|5[0-9A]|6[1-9A-F]|7[0-9A]|3[0-9]|2D|2E|5F|7E)/gi;

function pourcentNormalise(texte) {
  return String(texte)
    .replace(NON_RESERVES, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/%([0-9a-f]{2})/g, (m, h) => '%' + h.toUpperCase());
}

export function normaliserUrl(entree, { trierParametres = false } = {}) {
  const brut = String(entree == null ? '' : entree).trim();
  if (!brut) throw new Error('URL vide');
  let u;
  try { u = new URL(brut); } catch { throw new Error('URL invalide : ' + brut); }
  const changements = [];
  const avant = brut;

  // L API URL fait deja : schema/hote en minuscules, port par defaut retire,
  // segments-points resolus, chemin vide -> « / » pour http(s).
  let chemin = pourcentNormalise(u.pathname);
  if (chemin !== u.pathname) { u.pathname = chemin; changements.push('pourcent-encodages du chemin normalises'); }
  let requete = pourcentNormalise(u.search);
  if (requete !== u.search) { u.search = requete; changements.push('pourcent-encodages de la requete normalises'); }
  if (trierParametres && u.search) {
    const p = new URLSearchParams(u.search);
    p.sort();
    u.search = p.toString() ? '?' + p.toString() : '';
    changements.push('parametres tries');
  }
  if (u.hash === '#' || u.hash === '') { u.hash = ''; }
  const apres = u.href;
  if (avant !== apres) {
    if (/^[A-Z]/.test(avant.split(':')[0])) changements.push('schema en minuscules');
    if (/\/\/[^/]*[A-Z]/.test(avant.split('?')[0].split('#')[0])) changements.push('hote en minuscules');
    if (/:(80|443)\//.test(avant) || /:(80|443)$/.test(avant)) changements.push('port par defaut retire');
    if (/\/\.\.?(\/|$)/.test(avant)) changements.push('segments . et .. resolus');
    if (/^https?:\/\/[^/?#]+$/i.test(avant)) changements.push('chemin vide remplace par /');
  }
  return { avant, apres, identique: avant === apres, changements: [...new Set(changements)] };
}

/* ------------------------------- DNS inverse ------------------------------ */
export function nomInverse(adresse) {
  const a = String(adresse == null ? '' : adresse).trim();
  if (estIpv4(a)) return a.split('.').reverse().join('.') + '.in-addr.arpa';
  if (estIpv6(a)) {
    const long = etendreIpv6(a).replace(/:/g, '');
    if (long.length !== 32) throw new Error('adresse IPv6 illisible');
    return long.split('').reverse().join('.') + '.ip6.arpa';
  }
  throw new Error('adresse IPv4 ou IPv6 attendue');
}

/** Lit un nom PTR et rend l adresse d origine. */
export function adresseDepuisNomInverse(nom) {
  const n = String(nom == null ? '' : nom).trim().toLowerCase().replace(/\.$/, '');
  let m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\.in-addr\.arpa$/.exec(n);
  if (m) return m[4] + '.' + m[3] + '.' + m[2] + '.' + m[1];
  m = /^((?:[0-9a-f]\.){32})ip6\.arpa$/.exec(n);
  if (m) {
    const hex = m[1].replace(/\./g, '').split('').reverse().join('');
    return hex.match(/.{4}/g).join(':');
  }
  throw new Error('nom inverse in-addr.arpa ou ip6.arpa attendu');
}

/* ------------------------------- Homographes ------------------------------ */
/* Plages d ecriture (Unicode), suffisantes pour un nom d hote. Ecrites en
   sequences \u : le code source reste en ASCII pur. */
const ECRITURES = [
  ['latin', /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/],
  ['cyrillique', /[\u0400-\u04FF\u0500-\u052F]/],
  ['grec', /[\u0370-\u03FF\u1F00-\u1FFF]/],
  ['armenien', /[\u0530-\u058F]/],
  ['hebreu', /[\u0590-\u05FF]/],
  ['arabe', /[\u0600-\u06FF\u0750-\u077F]/],
  ['devanagari', /[\u0900-\u097F]/],
  ['thai', /[\u0E00-\u0E7F]/],
  ['han', /[\u4E00-\u9FFF\u3400-\u4DBF]/],
  ['kana', /[\u3040-\u30FF]/],
  ['hangul', /[\uAC00-\uD7AF\u1100-\u11FF]/]
];

/* Lettres cyrilliques et grecques qui se dessinent comme des lettres latines
   (cles en points de code, pour la meme raison). */
const SOSIES = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c', '\u0445': 'x', '\u0443': 'y',
  '\u0456': 'i', '\u0458': 'j', '\u04BB': 'h', '\u0501': 'd', '\u051B': 'q', '\u0455': 's', '\u051D': 'w',
  '\u03BF': 'o', '\u03B1': 'a', '\u03B5': 'e', '\u03C1': 'p', '\u03BD': 'v', '\u03C5': 'u', '\u03BA': 'k'
};

export function scriptsDuNom(hote) {
  const h = String(hote == null ? '' : hote).trim().toLowerCase().replace(/\.$/, '');
  if (!h) throw new Error('nom d hote vide');
  const libelles = h.split('.').map(libelle => {
    const ecritures = new Set();
    const sosies = [];
    for (const c of libelle) {
      for (const [nom, re] of ECRITURES) if (re.test(c)) ecritures.add(nom);
      if (SOSIES[c]) sosies.push({ caractere: c, code: 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'), ressembleA: SOSIES[c] });
    }
    const punycode = /^xn--/.test(libelle);
    return { libelle, ecritures: [...ecritures], melange: ecritures.size > 1, sosies, punycode,
      nonAscii: /[^\x00-\x7F]/.test(libelle) };
  });
  const faits = [];
  for (const l of libelles) {
    if (l.melange) faits.push('« ' + l.libelle + ' » melange plusieurs ecritures : ' + l.ecritures.join(' + '));
    if (l.sosies.length) faits.push('« ' + l.libelle + ' » contient ' + l.sosies.map(s => s.caractere + ' (' + s.code + ', ressemble a ' + s.ressembleA + ')').join(', '));
    if (l.punycode) faits.push('« ' + l.libelle + ' » est en punycode : le nom affiche differe de celui envoye');
  }
  if (!faits.length) faits.push('une seule ecriture par libelle, aucun caractere sosie');
  return { hote: h, libelles, faits, suspect: libelles.some(l => l.melange || l.sosies.length) };
}
