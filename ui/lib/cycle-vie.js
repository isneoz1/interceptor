/* Depreciation et fin de service d une API — SWIFT (by D4RK)
 *
 * Deux en-tetes par lesquels un serveur annonce l avenir d une adresse :
 *
 *   Deprecation (RFC 9745, mars 2025)  `Deprecation: @1688169599` — une date
 *     de champ structure (RFC 9651), passee (deja depreciee) ou a venir.
 *     Les premiers brouillons (-00 a -02) ecrivaient une date HTTP ou
 *     `true` : la RFC ne garde que la forme @secondes.
 *   Sunset (RFC 8594)  `Sunset: Sat, 31 Dec 2018 23:59:59 GMT` — le moment
 *     ou l adresse devrait cesser de repondre. Une date passee veut dire
 *     « a tout moment » (§3).
 *
 * Les deux sont des indices : deprecier ne change rien au fonctionnement
 * (RFC 9745 §5), et rien ne garantit la date de fin (RFC 8594 §3). La fin ne
 * doit pas preceder la depreciation (RFC 9745 §4).
 *
 * Les liens `rel="deprecation"` et `rel="sunset"` de l en-tete Link menent a
 * la documentation : ils sont repris ici.
 */
import { lireArticleSeul } from './champs-structures.js';
import { lireDateHttp, faitsDeDate } from './date-http.js';
import { lireLiens, valeursLink } from './liens-http.js';

export const FAITS_CYCLE = {
  deprecieeDepuis: 'depreciee depuis le {date} : l adresse fonctionne toujours, mais son auteur en a annonce l abandon (RFC 9745)',
  depreciee: 'depreciee a partir du {date} : l adresse fonctionne toujours, mais son auteur en annonce l abandon (RFC 9745)',
  ancienneForme: 'forme des premiers brouillons de la specification ({forme}) : la RFC 9745 exige une date de champ structure, comme @1688169599',
  illisible: 'valeur illisible : la RFC 9745 exige une date de champ structure, comme @1688169599',
  fin: 'fin de service prevue le {date} : l adresse devrait cesser de repondre a partir de la (Sunset, RFC 8594)',
  finPassee: 'date de fin depassee ({date}) : l adresse peut cesser de repondre a tout moment (RFC 8594 §3)',
  finIllisible: 'date de fin illisible : Sunset attend une date HTTP (RFC 8594 §3)',
  finAvant: 'la fin de service precede la depreciation : la RFC 9745 l interdit (§4) et conseille d en demander la raison a l auteur de l API',
  indice: 'un indice, pas une panne : la depreciation ne change rien au fonctionnement (RFC 9745 §5)'
};

const premiere = (entetes, nom) => {
  const h = (entetes || []).find(x => x && String(x.name || '').toLowerCase() === nom);
  return h ? String(h.value ?? '').trim() : null;
};

function lireDeprecation(brut, maintenant, dire) {
  try {
    const article = lireArticleSeul(brut);
    if (article.type === 'date') return { ms: article.valeur * 1000, forme: 'date' };
  } catch { /* pas un champ structure : les formes anciennes ci-dessous */ }
  if (brut === 'true') {
    dire('ancienneForme', { forme: 'true' });
    return { ms: null, forme: 'true' };
  }
  const http = lireDateHttp(brut, maintenant);
  if (http && http.forme !== 'autre') {
    dire('ancienneForme', { forme: 'HTTP-date' });
    return { ms: http.ms, forme: 'date-http' };
  }
  dire('illisible');
  return { ms: null, forme: 'illisible' };
}

/**
 * Ce que la reponse annonce de son avenir. null si ni Deprecation, ni Sunset,
 * ni lien de depreciation ou de fin.
 *
 * @param options.url         adresse de la reponse (pour les liens relatifs)
 * @param options.maintenant  ms ; « passee » et « a venir » se jugent par rapport a lui
 * @param options.sansLiens   vrai pour ne pas lire l en-tete Link (dates seules)
 * @returns { deprecation, fin, liens, faits }
 *   deprecation / fin : { brut, ms, forme, passee } ou null
 */
export function lireCycleDeVie(entetes, options = {}) {
  const maintenant = Number(options.maintenant) || Date.now();
  const brutDeprecation = premiere(entetes, 'deprecation');
  const brutFin = premiere(entetes, 'sunset');
  /* Le resume du noyau n a besoin que des dates : il passe sansLiens, et un
     gros en-tete Link n est pas relu a chaque mise a jour. */
  const liens = options.sansLiens ? [] : lireLiens(valeursLink(entetes), options.url || '').liens
    .filter(l => l.rel === 'deprecation' || l.rel === 'sunset');
  if (brutDeprecation == null && brutFin == null && !liens.length) return null;

  const faits = [];
  const dire = (cle, valeurs = {}, niveau = 'info') => faits.push({ cle, texte: FAITS_CYCLE[cle], valeurs, niveau });

  let deprecation = null;
  if (brutDeprecation != null) {
    const lue = lireDeprecation(brutDeprecation, maintenant, (cle, v) => dire(cle, v, 'warn'));
    deprecation = { brut: brutDeprecation, ...lue, passee: lue.ms == null ? lue.forme === 'true' : lue.ms <= maintenant };
    if (lue.ms != null) dire(lue.ms <= maintenant ? 'deprecieeDepuis' : 'depreciee', { date: lue.ms }, 'warn');
  }

  let fin = null;
  if (brutFin != null) {
    const lue = lireDateHttp(brutFin, maintenant);
    if (!lue) {
      dire('finIllisible', {}, 'warn');
      fin = { brut: brutFin, ms: null, forme: 'illisible', passee: false };
    } else {
      fin = { brut: brutFin, ms: lue.ms, forme: lue.forme, passee: lue.ms <= maintenant };
      dire(fin.passee ? 'finPassee' : 'fin', { date: lue.ms }, 'warn');
      for (const f of faitsDeDate(lue)) faits.push({ ...f, niveau: 'info' });
    }
  }

  if (deprecation && deprecation.ms != null && fin && fin.ms != null && fin.ms < deprecation.ms) dire('finAvant', {}, 'warn');
  if (deprecation) dire('indice');
  return { deprecation, fin, liens, faits };
}
