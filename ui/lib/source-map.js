/* Cartes de source (ECMA-426) — SWIFT (by NeoZ)
 *
 * Un script ou une feuille de style minifies peuvent annoncer une carte de
 * source : le fichier qui les relie a leur code d origine, lisible. Ce module
 * dit si une carte est annoncee, ou, et comment.
 *
 * Source, lue dans le texte : ECMA-426 (Source Map)
 *   - l en-tete HTTP SourceMap ; X-SourceMap est deprecie ;
 *   - le commentaire //# sourceMappingURL=… (JavaScript) ou
 *     /*# sourceMappingURL=… *\/ (CSS) ; la forme //@ est ancienne mais
 *     encore acceptee ;
 *   - l en-tete l emporte sur le commentaire ;
 *   - une adresse relative se resout sur celle du fichier ; une URI data:
 *     porte une carte integree.
 *
 * Annoncee ne veut pas dire accessible : la carte n est pas telechargee.
 */

/* Les phrases des faits, traduites a l affichage. */
export const FAITS_SOURCE_MAP = {
  annoncee: 'carte de source annoncee : si elle est accessible, elle relie ce code minifie a ses sources d origine',
  integree: 'carte integree dans le fichier (URI data:) : les sources d origine voyagent avec le code',
  enteteDeprecie: 'en-tete X-SourceMap : deprecie, SourceMap est le nom attendu (ECMA-426)',
  formeAncienne: 'commentaire //@ : forme ancienne, //# est celle a ecrire (ECMA-426)'
};

const valeur = (entetes, nom) => {
  const h = (entetes || []).find(x => x && String(x.name || '').toLowerCase() === nom);
  return h ? String(h.value ?? '').trim() : null;
};

/* Le commentaire se cherche a la fin du fichier, ou il doit se trouver : lire
   tout un script de plusieurs megaoctets ne changerait rien. */
const FIN_LUE = 4096;
const COMMENTAIRE_JS = /\/\/([#@])\s*sourceMappingURL=(\S+)/g;
const COMMENTAIRE_CSS = /\/\*([#@])\s*sourceMappingURL=(\S+?)\s*\*\//g;

/**
 * La carte de source annoncee par une reponse, ou null.
 * @param {{ entetes:object[], texte:string, type:string, url:string }} reponse
 */
export function lireSourceMap({ entetes = [], texte = '', type = '', url = '' } = {}) {
  let brut = null;
  let source = null;
  let forme = '#';
  const entete = valeur(entetes, 'sourcemap');
  const ancien = valeur(entetes, 'x-sourcemap');
  if (entete) { brut = entete; source = 'entete'; }
  else if (ancien) { brut = ancien; source = 'enteteDeprecie'; }
  else if (typeof texte === 'string' && texte) {
    const fin = texte.slice(-FIN_LUE);
    const css = /css/i.test(type);
    let dernier = null;
    for (const m of fin.matchAll(css ? COMMENTAIRE_CSS : COMMENTAIRE_JS)) dernier = m;
    if (dernier) { brut = dernier[2]; forme = dernier[1]; source = 'commentaire'; }
  }
  if (!brut) return null;
  let adresse = brut;
  try { adresse = new URL(brut, url || undefined).href; } catch { /* adresse illisible : gardee telle quelle */ }
  const integree = /^data:/i.test(brut);
  const faits = [{ cle: integree ? 'integree' : 'annoncee', texte: FAITS_SOURCE_MAP[integree ? 'integree' : 'annoncee'], valeurs: {} }];
  if (source === 'enteteDeprecie') faits.push({ cle: 'enteteDeprecie', texte: FAITS_SOURCE_MAP.enteteDeprecie, valeurs: {} });
  if (forme === '@') faits.push({ cle: 'formeAncienne', texte: FAITS_SOURCE_MAP.formeAncienne, valeurs: {} });
  return { adresse: integree ? brut.slice(0, 80) + (brut.length > 80 ? '…' : '') : adresse, source, integree, faits };
}
