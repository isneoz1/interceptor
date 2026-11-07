/* Neutraliser une adresse avant de la partager (« defang ») — SWIFT (by D4RK)
 *
 * Dans un rapport, un ticket ou un message, une URL ou une adresse IP douteuse
 * doit se lire sans devenir un lien sur lequel on clique par megarde. La
 * convention la plus repandue est celle de CyberChef (GCHQ) : « hxxp »,
 * « [.] », « [://] », « [:] ». Ce module reprend exactement ses operations
 * « Defang URL » (reglages par defaut : points, http et :// neutralises,
 * domaines valides et URL completes), « Defang IP Addresses » et « Fang URL ».
 * Les expressions sont recopiees de son source — Crown Copyright, licence
 * Apache-2.0, github.com/gchq/CyberChef, src/core/lib/Extract.mjs et
 * src/core/operations/ — et verifiees contre ses tests publies.
 *
 * Appliquees telles quelles a tout un texte, elles reviennent en arriere :
 * 0,6 s pour 45 Ko de prose sur une ligne, 1,8 s pour « a. » repete 20 000
 * fois, et le temps croit comme le carre de la longueur. Le resultat est donc calcule
 * autrement, et reste le leur : une URL n est cherchee que la ou commence un
 * « :// » ; un domaine, en un seul passage ; une IPv6, avec les deux regards
 * en avant de l expression (« :: » plus loin sur la ligne, et pas deux)
 * evalues une fois par ligne — ils ne changent qu en trois zones au plus.
 * tests/parite.test.mjs compare chaque resultat a celui des expressions
 * d origine sur des dizaines de milliers de textes tires au hasard.
 */

/* Extract.mjs : URL_REGEX et DOMAIN_REGEX. */
const PROTOCOLE = '[A-Z]+://';
const HOTE = '[-\\w]+(?:\\.\\w[-\\w]*)+';
const PORT = ':\\d+';
const CHEMIN = '/[^.!,?"<>\\[\\]{}\\s\\x7F-\\xFF]*' + '(?:[.!,?]+[^.!,?"<>\\[\\]{}\\s\\x7F-\\xFF]+)*';
const URL_CC = new RegExp(PROTOCOLE + HOTE + '(?:' + PORT + ')?(?:' + CHEMIN + ')?', 'ig');
const DOMAINE_CC = /\b((?=[a-z0-9-]{1,63}\.)(xn--)?[a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,63}\b/ig;

/* DefangIPAddresses.mjs : IPV4_REGEX et IPV6_REGEX. */
const IPV4_CC = new RegExp('(?:(?:\\d|[01]?\\d\\d|2[0-4]\\d|25[0-5])\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d|\\d)(?:\\/\\d{1,2})?', 'g');
const REGARDS_IPV6 = '(?=.*::)(?!.*::.+::)';
const IPV6_CC = new RegExp('(' + REGARDS_IPV6 + '(::)?([\\dA-Fa-f]{1,4}:(:|\\b)|){5}|([\\dA-Fa-f]{1,4}:){6})((([\\dA-Fa-f]{1,4}((?!\\3)::|:\\b|(?![\\dA-Fa-f])))|(?!\\2\\3)){2}|(((2[0-4]|1\\d|[1-9])?\\d|25[0-5])\\.?\\b){4})', 'g');

/** Les expressions de CyberChef, telles quelles : la reference des tests. */
export const EXPRESSIONS_CYBERCHEF = Object.freeze({ URL_CC, DOMAINE_CC, IPV4_CC, IPV6_CC });

/* DefangURL.mjs : defangURL(url, true, true, true), dans cet ordre. */
const neutraliserUne = url => url.replace(/\./g, '[.]').replace(/http/gi, 'hxxp').replace(/:\/\//g, '[://]');

/* ----------------------------------- URL ---------------------------------- */
/* Une URL commence par des lettres suivies de « :// » : l expression est
   appliquee, collee, au debut de chaque suite de lettres qui precede un
   « :// », dans l ordre, sans chevauchement — ce que fait le remplacement
   global, sans relire chaque suite de lettres a chaque position. */
const URL_COLLEE = new RegExp(URL_CC.source, 'iy');
const estLettre = c => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
function urlsNeutralisees(texte) {
  let sortie = '', fin = 0;
  for (let i = texte.indexOf('://'); i >= 0; i = texte.indexOf('://', i + 1)) {
    if (i < fin) continue;
    let debut = i;
    while (debut > fin && estLettre(texte.charCodeAt(debut - 1))) debut--;
    if (debut === i) continue;
    URL_COLLEE.lastIndex = debut;
    const m = URL_COLLEE.exec(texte);
    if (!m) continue;
    sortie += texte.slice(fin, debut) + neutraliserUne(m[0]);
    fin = debut + m[0].length;
  }
  return sortie + texte.slice(fin);
}

/* --------------------------------- Domaines ------------------------------- */
/* DOMAIN_REGEX en un passage. Une etiquette va jusqu au point qui la suit :
   1 a 63 caracteres [a-z0-9-], « xn-- » permis en tete, un tiret jamais au
   bord ni double. Apres une ou plusieurs etiquettes, un domaine de premier
   niveau : 2 a 63 lettres, puis une fin de mot. Pour la premiere position
   qui convient (un debut de mot), l expression prend la plus longue suite
   d etiquettes que suit un domaine de premier niveau : `loin` la donne pour
   chaque debut de segment, calculee de droite a gauche. */
const ETIQUETTE = /^(?:xn--)?[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const estChiffre = c => c >= 48 && c <= 57;
const estAlnum = c => estLettre(c) || estChiffre(c);
const estMot = c => estAlnum(c) || c === 95;          // \w : lettres, chiffres, souligne
function domainesNeutralises(texte) {
  const n = texte.length;
  if (!texte.includes('.')) return texte;
  /* finClasse[p] : premier indice >= p hors de [A-Za-z0-9-] ; lettres[p] :
     nombre de lettres consecutives a partir de p, arrete a 64 (au-dela, ce
     n est plus un domaine de premier niveau). */
  const finClasse = new Int32Array(n + 1);
  const lettres = new Uint8Array(n + 1);
  finClasse[n] = n;
  for (let p = n - 1; p >= 0; p--) {
    const c = texte.charCodeAt(p);
    finClasse[p] = estAlnum(c) || c === 45 ? finClasse[p + 1] : p;
    lettres[p] = estLettre(c) ? Math.min(64, lettres[p + 1] + 1) : 0;
  }
  const etiquetteJusquA = p => {
    const d = finClasse[p];
    return d < n && texte.charCodeAt(d) === 46 && d - p >= 1 && d - p <= 63 && ETIQUETTE.test(texte.slice(p, d)) ? d : -1;
  };
  const premierNiveau = d => {
    const m = lettres[d + 1];
    return m >= 2 && m <= 63 && !(d + 1 + m < n && estMot(texte.charCodeAt(d + 1 + m)));
  };
  /* loin[q] (q juste apres un point) : le point le plus lointain de la suite
     d etiquettes qui commence en q, apres lequel vient un domaine de premier
     niveau ; -1 s il n y en a pas. */
  const loin = new Int32Array(n + 1).fill(-1);
  const suite = p => {
    const d = etiquetteJusquA(p);
    if (d < 0) return -1;
    if (loin[d + 1] >= 0) return loin[d + 1];
    return premierNiveau(d) ? d : -1;
  };
  for (let q = n - 1; q >= 1; q--) if (texte.charCodeAt(q - 1) === 46) loin[q] = suite(q);
  let sortie = '', fin = 0;
  for (let p = 0; p < n; p++) {
    if (!estAlnum(texte.charCodeAt(p)) || (p > 0 && estMot(texte.charCodeAt(p - 1)))) continue;
    const d = suite(p);
    if (d < 0) continue;
    const finDomaine = d + 1 + lettres[d + 1];
    sortie += texte.slice(fin, p) + neutraliserUne(texte.slice(p, finDomaine));
    fin = finDomaine;
    p = finDomaine - 1;
  }
  return sortie + texte.slice(fin);
}

/* ----------------------------------- IPv6 --------------------------------- */
/* Les deux regards en avant de IPV6_REGEX portent sur le reste de la ligne :
   « un :: plus loin » et « pas deux :: separes ». Le long d une ligne, ils ne
   peuvent que passer de vrai a faux : trois zones au plus, sur chacune
   desquelles l expression s applique avec ses regards remplaces par leur
   valeur — le meme resultat, sans relire la ligne a chaque position. */
const IPV6_REGARDS_VRAIS = new RegExp(IPV6_CC.source.replace(REGARDS_IPV6, ''), 'g');
const IPV6_REGARDS_FAUX = new RegExp(IPV6_CC.source.replace(REGARDS_IPV6, '(?!)'), 'g');
/* Les fins de ligne de JavaScript, pour lesquelles « . » s arrete. */
const FIN_DE_LIGNE = new RegExp('\\r\\n?|[\\n' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
function ipv6DeLaLigne(ligne) {
  if (!ligne.includes(':')) return ligne;
  const doubles = [];
  for (let j = ligne.indexOf('::'); j >= 0; j = ligne.indexOf('::', j + 1)) doubles.push(j);
  const dernier = doubles.length ? doubles[doubles.length - 1] : -1;
  /* Deux « :: » separes d au moins un caractere existent a partir de p tant
     que p <= le dernier « :: » qui en precede un autre de trois au moins. */
  let finDeux = -1;
  for (const j of doubles) if (j + 3 <= dernier) finDeux = j;
  const zones = [[0, finDeux + 1, IPV6_REGARDS_FAUX], [finDeux + 1, dernier + 1, IPV6_REGARDS_VRAIS], [dernier + 1, ligne.length, IPV6_REGARDS_FAUX]];
  let sortie = '', fin = 0;
  for (const [debutZone, finZone, expression] of zones) {
    if (debutZone >= finZone) continue;
    expression.lastIndex = Math.max(debutZone, fin);
    for (let m = expression.exec(ligne); m && m.index < finZone; m = expression.exec(ligne)) {
      if (!m[0]) { expression.lastIndex = m.index + 1; continue; }
      sortie += ligne.slice(fin, m.index) + m[0].replace(/:/g, '[:]');
      fin = m.index + m[0].length;
      expression.lastIndex = fin;
    }
  }
  return sortie + ligne.slice(fin);
}
function ipv6Neutralisees(texte) {
  let sortie = '', debut = 0;
  for (const m of texte.matchAll(FIN_DE_LIGNE)) {
    sortie += ipv6DeLaLigne(texte.slice(debut, m.index)) + m[0];
    debut = m.index + m[0].length;
  }
  return sortie + ipv6DeLaLigne(texte.slice(debut));
}

/** « Defang URL » de CyberChef, reglages par defaut : URL completes et domaines valides. */
export function neutraliserUrls(texte) {
  return domainesNeutralises(urlsNeutralisees(String(texte ?? '')));
}

/** « Defang IP Addresses » de CyberChef : « [.] » dans une IPv4, « [:] » dans une IPv6. */
export function neutraliserIp(texte) {
  return ipv6Neutralisees(String(texte ?? '').replace(IPV4_CC, x => x.replace(/\./g, '[.]')));
}

/** Les deux a la suite : un texte qu on peut coller dans un rapport. */
export function neutraliser(texte) { return neutraliserIp(neutraliserUrls(texte)); }

/**
 * « Fang URL » de CyberChef (« [.] », « hxxp », « [://] » retablis), et en
 * plus « [:] », que « Defang IP Addresses » pose dans une IPv6 : sans lui,
 * retablir ne serait pas l inverse de neutraliser.
 */
export function retablir(texte) {
  return String(texte ?? '')
    .replace(/\[\.\]/g, '.')
    .replace(/hxxp/g, 'http')
    .replace(/\[:\/\/\]/g, '://')
    .replace(/\[:\]/g, ':');
}
