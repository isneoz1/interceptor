/* Les caches traverses — SWIFT (by NeoZ)
 *
 * Cache-Status (RFC 9211) : chaque cache sur le chemin ajoute un membre a la
 * liste. Le premier est le plus proche de l origine, le dernier le plus
 * proche de l utilisateur (section 2). Parametres :
 *   hit         servie par ce cache, sans aller plus loin (2.1)
 *   fwd         transmise vers l origine, et pourquoi (2.2)
 *   fwd-status  le statut rendu par le saut suivant (2.3)
 *   ttl         fraicheur restante en secondes, negative si perimee (2.4)
 *   stored      ce cache a garde la reponse (2.5)
 *   collapsed   fusionnee avec d autres requetes en route (2.6)
 *   key, detail propres a chaque cache (2.7, 2.8)
 *
 * CDN-Cache-Control (RFC 9213) : la meme grammaire que Cache-Control, mais
 * destinee aux seuls CDN — qui ignorent alors Cache-Control et Expires pour
 * cette reponse (2.2). C est un dictionnaire de champ structure : une erreur
 * de lecture le fait ignorer en entier (2.1).
 */
import { lireListe, lireDictionnaire, decrireArticle } from './champs-structures.js';

export const RAISONS_FWD = {
  'bypass': 'le cache est configure pour ne pas traiter cette requete',
  'method': 'la methode de la requete impose de la transmettre',
  'uri-miss': 'aucune reponse en cache pour cette adresse',
  'vary-miss': 'une reponse en cache pour cette adresse, mais aucune ne convient aux en-tetes de la requete (Vary)',
  'miss': 'aucune reponse en cache utilisable',
  'request': 'une reponse fraiche existait, mais la requete en interdisait l emploi',
  'stale': 'une reponse existait, mais perimee',
  'partial': 'une reponse partielle existait, sans toutes les plages demandees'
};

export const FAITS_CACHE_STATUS = {
  servie: 'servie par ce cache',
  transmise: 'transmise vers l origine : {raison}',
  raisonInconnue: 'transmise vers l origine (raison {raison}, inconnue de la RFC 9211)',
  ttlFraiche: 'fraiche encore {duree} selon ce cache',
  ttlPerimee: 'perimee depuis {duree} selon ce cache',
  statutSuivant: 'le saut suivant a repondu {statut}',
  gardee: 'gardee par ce cache',
  nonGardee: 'non gardee par ce cache',
  fusionnee: 'fusionnee avec d autres requetes en route',
  fusionRatee: 'fusion avec d autres requetes tentee, sans succes',
  rien: 'ni hit ni fwd : ce cache n en dit pas plus',
  exclusifs: 'hit et fwd ensemble : la RFC 9211 les veut exclusifs (§2.1)',
  sansObjet: '{param} sans fwd : sans objet (RFC 9211 §2.3 a 2.6)',
  identifiant: 'identifiant de cache d un type {type} : une chaine ou un jeton est exige (RFC 9211 §2)',
  fwdType: 'fwd d un type {type} : un jeton est attendu (RFC 9211 §2.2)',
  illisible: 'Cache-Status illisible : une liste de champ structure est attendue (RFC 9211 §2)',
  cdnIllisible: 'CDN-Cache-Control illisible : un CDN l ignore en entier et revient a Cache-Control (RFC 9213 §2.1)',
  cdnPrime: 'pour un CDN qui le suit, il remplace Cache-Control et Expires sur cette reponse (RFC 9213 §2.2)',
  cdnDecimal: '{directive} a une valeur decimale : un cache ne devrait pas la consommer (RFC 9213 §2.1)'
};

const valeursDe = (entetes, nom) => (entetes || []).filter(h => h && String(h.name || '').toLowerCase() === nom)
  .map(h => String(h.value ?? ''));
const parametre = (liste, cle) => { let v; for (const p of liste || []) if (p.cle === cle) v = p; return v; };
/* La valeur lisible d un parametre : une chaine telle quelle, le reste decrit. */
const decrireValeur = p => (p.type === 'chaine' || p.type === 'jeton' ? String(p.valeur) : decrireArticle(p));

/**
 * @param options.statut  statut de la reponse : fwd-status vaut lui par defaut (2.3)
 * @returns null sans en-tete, sinon { caches, faits }
 */
export function lireCacheStatus(entetes, options = {}) {
  const valeurs = valeursDe(entetes, 'cache-status');
  if (!valeurs.length) return null;
  const faits = [];
  let membres;
  try { membres = lireListe(valeurs.join(', ')); }
  catch {
    faits.push({ cle: 'illisible', texte: FAITS_CACHE_STATUS.illisible, valeurs: {} });
    return { caches: [], faits };
  }
  const caches = membres.map((m, rang) => {
    const notes = [];
    const dire = (cle, v = {}) => notes.push({ cle, texte: FAITS_CACHE_STATUS[cle], valeurs: v });
    if (m.type !== 'chaine' && m.type !== 'jeton') {
      faits.push({ cle: 'identifiant', texte: FAITS_CACHE_STATUS.identifiant, valeurs: { type: m.type } });
    }
    const hit = parametre(m.parametres, 'hit');
    const fwd = parametre(m.parametres, 'fwd');
    const fwdStatut = parametre(m.parametres, 'fwd-status');
    const ttl = parametre(m.parametres, 'ttl');
    const stored = parametre(m.parametres, 'stored');
    const collapsed = parametre(m.parametres, 'collapsed');
    const estHit = !!(hit && hit.type === 'booleen' && hit.valeur);
    const raison = fwd && (fwd.type === 'jeton' || fwd.type === 'chaine') ? String(fwd.valeur) : null;
    if (fwd && fwd.type !== 'jeton') dire('fwdType', { type: fwd.type });

    if (estHit && fwd) dire('exclusifs');
    if (estHit) dire('servie');
    if (raison) {
      if (RAISONS_FWD[raison]) dire('transmise', { raison: RAISONS_FWD[raison], code: raison });
      else dire('raisonInconnue', { raison });
      const statut = fwdStatut && fwdStatut.type === 'entier' ? fwdStatut.valeur : (Number(options.statut) || null);
      if (statut) dire('statutSuivant', { statut });
      if (stored && stored.type === 'booleen') dire(stored.valeur ? 'gardee' : 'nonGardee');
      if (collapsed && collapsed.type === 'booleen') dire(collapsed.valeur ? 'fusionnee' : 'fusionRatee');
    } else {
      for (const p of [fwdStatut && 'fwd-status', stored && 'stored', collapsed && 'collapsed'].filter(Boolean)) {
        dire('sansObjet', { param: p });
      }
    }
    if (ttl && ttl.type === 'entier') dire(ttl.valeur >= 0 ? 'ttlFraiche' : 'ttlPerimee', { duree: Math.abs(ttl.valeur) });
    if (!estHit && !raison) dire('rien');

    const cle = parametre(m.parametres, 'key');
    const detail = parametre(m.parametres, 'detail');
    return {
      nom: m.type === 'chaine' || m.type === 'jeton' ? String(m.valeur) : decrireArticle(m), rang, hit: estHit, fwd: raison,
      cle: cle ? decrireValeur(cle) : null, detail: detail ? decrireValeur(detail) : null, notes
    };
  });
  return { caches, faits };
}

/**
 * CDN-Cache-Control : les directives destinees aux CDN, a cote de celles du
 * Cache-Control ordinaire. null sans en-tete.
 */
export function lireCdnCacheControl(entetes) {
  const valeurs = valeursDe(entetes, 'cdn-cache-control');
  if (!valeurs.length) return null;
  const faits = [];
  const texte = valeurs.join(', ').trim();
  let directives = [];
  try { directives = texte ? lireDictionnaire(texte) : []; }
  catch {
    faits.push({ cle: 'cdnIllisible', texte: FAITS_CACHE_STATUS.cdnIllisible, valeurs: {} });
    return { directives: [], ignore: true, faits };
  }
  if (!directives.length) {
    faits.push({ cle: 'cdnIllisible', texte: FAITS_CACHE_STATUS.cdnIllisible, valeurs: {} });
    return { directives: [], ignore: true, faits };
  }
  /* RFC 9651 : la derniere occurrence d une cle l emporte. */
  const parCle = new Map();
  for (const d of directives) parCle.set(d.cle, d);
  for (const d of parCle.values()) {
    if (d.type === 'decimal') faits.push({ cle: 'cdnDecimal', texte: FAITS_CACHE_STATUS.cdnDecimal, valeurs: { directive: d.cle } });
  }
  faits.push({ cle: 'cdnPrime', texte: FAITS_CACHE_STATUS.cdnPrime, valeurs: {} });
  return {
    directives: [...parCle.values()].map(d => ({
      cle: d.cle,
      valeur: d.type === 'booleen' && d.valeur === true ? null : decrireValeur(d)
    })),
    ignore: false,
    faits
  };
}
