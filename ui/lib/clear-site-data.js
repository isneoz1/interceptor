/* Effacement demande par un site (Clear-Site-Data) — SWIFT (by NeoZ)
 *
 * Une reponse peut demander au navigateur d effacer ce qu il garde pour le
 * site : souvent a la deconnexion. Ce module dit ce qui sera efface.
 *
 * Source, lue dans le texte : W3C Clear Site Data
 *   grammaire  Clear-Site-Data = 1#( quoted-string ) — chaque type entre
 *              guillemets
 *   types      "cache", "cookies", "storage", "executionContexts",
 *              "clientHints", et "*" pour tous
 *   contexte   l en-tete n est traite que pour une reponse a une adresse
 *              « a priori authentifiee » (https)
 */

export const TYPES_CSD = {
  'cache': 'le cache du site, pages prechargees comprises',
  'cookies': 'les cookies et les identifiants HTTP de tout le domaine enregistre',
  'storage': 'le stockage du site : localStorage, sessionStorage, IndexedDB, et ses Service Workers',
  'executionContexts': 'les pages ouvertes du site, rechargees',
  'clientHints': 'les Client Hints memorises pour le site (Accept-CH)',
  '*': 'tout ce qui precede'
};

/* Les phrases des faits, traduites a l affichage. */
export const FAITS_CSD = {
  nonQuote: 'valeur {v} sans guillemets : la grammaire exige une chaine entre guillemets',
  inconnu: 'type {v} inconnu de la specification',
  nonSur: 'reponse servie sans https : le navigateur ne traite pas Clear-Site-Data'
};

/**
 * Ce que demande un en-tete Clear-Site-Data : les types reconnus, et les
 * faits sur ce qui sort de la grammaire. null si l en-tete est absent.
 */
export function lireClearSiteData(entetes, urlReponse = '') {
  const valeurs = (entetes || []).filter(h => h && String(h.name || '').toLowerCase() === 'clear-site-data')
    .map(h => String(h.value ?? ''));
  if (!valeurs.length) return null;
  const types = [];
  const faits = [];
  const dire = (cle, v = {}) => faits.push({ cle, texte: FAITS_CSD[cle], valeurs: v });
  for (const brut of valeurs.join(',').split(',').map(x => x.trim()).filter(Boolean)) {
    const m = /^"([^"]*)"$/.exec(brut);
    if (!m) { dire('nonQuote', { v: brut }); continue; }
    if (Object.prototype.hasOwnProperty.call(TYPES_CSD, m[1])) { if (!types.includes(m[1])) types.push(m[1]); }
    else dire('inconnu', { v: '"' + m[1] + '"' });
  }
  let sur = true;
  try {
    const u = new URL(urlReponse);
    sur = u.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch { /* adresse inconnue : rien a dire */ }
  if (!sur) dire('nonSur');
  return { types, faits };
}
