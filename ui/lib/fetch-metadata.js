/* Provenance d une requete (Fetch Metadata) — SWIFT (by NeoZ)
 *
 * Firefox joint a ses requetes https quatre en-tetes qui disent d ou elles
 * viennent et pourquoi : Sec-Fetch-Site, -Mode, -Dest et -User. Un serveur
 * s en sert pour refuser une requete venue d un autre site ; ici, on les lit
 * en clair.
 *
 * Source, lue dans le texte : W3C Fetch Metadata Request Headers
 *   Sec-Fetch-Site  cross-site, same-origin, same-site, none
 *   Sec-Fetch-Mode  cors, navigate, no-cors, same-origin, websocket
 *   Sec-Fetch-Dest  la destination de la requete (Fetch) ; « empty » pour
 *                   la destination vide de fetch() et XMLHttpRequest
 *   Sec-Fetch-User  ?1, seulement pour une navigation declenchee par
 *                   l utilisateur
 * Une valeur que la table ne connait pas est montree telle quelle.
 */

export const SENS_SITE = {
  'same-origin': 'de la meme origine (meme schema, meme hote, meme port)',
  'same-site': 'du meme site, mais d une autre origine (un autre sous-domaine)',
  'cross-site': 'd un autre site',
  'none': 'sans page a l origine : saisie dans la barre d adresse, favori, lien ouvert de l exterieur'
};
export const SENS_MODE = {
  'cors': 'requete CORS : venue d une autre origine, sa reponse ne se lit que si le serveur l autorise',
  'navigate': 'navigation : chargement d un document',
  'no-cors': 'requete sans CORS : venue d une autre origine, sa reponse reste opaque pour la page',
  'same-origin': 'reservee a la meme origine : refusee si elle en visait une autre',
  'websocket': 'ouverture d un WebSocket'
};
export const SENS_DEST = {
  'empty': 'une destination vide : fetch(), XMLHttpRequest et les autres appels sans destination propre',
  'document': 'la page principale', 'iframe': 'un cadre (iframe)', 'frame': 'un cadre (frame)',
  'image': 'une image', 'script': 'un script', 'style': 'une feuille de style', 'font': 'une police',
  'worker': 'un Worker', 'sharedworker': 'un SharedWorker', 'serviceworker': 'un Service Worker',
  'manifest': 'le manifeste de l application', 'audio': 'un son', 'video': 'une video',
  'track': 'des sous-titres', 'object': 'un element object', 'embed': 'un element embed',
  'report': 'un rapport du navigateur', 'xslt': 'une feuille XSLT',
  'audioworklet': 'un AudioWorklet', 'paintworklet': 'un PaintWorklet'
};

const valeur = (entetes, nom) => {
  const h = (entetes || []).find(x => x && String(x.name || '').toLowerCase() === nom);
  return h ? String(h.value ?? '').trim() : null;
};

/**
 * La provenance declaree d une requete, ou null si Firefox n a joint aucun
 * des quatre en-tetes (requete http, ou ancienne capture).
 */
export function lireFetchMetadata(entetes) {
  const site = valeur(entetes, 'sec-fetch-site');
  const mode = valeur(entetes, 'sec-fetch-mode');
  const dest = valeur(entetes, 'sec-fetch-dest');
  const user = valeur(entetes, 'sec-fetch-user');
  if (site === null && mode === null && dest === null && user === null) return null;
  return {
    site, mode, dest,
    utilisateur: user === '?1',
    sensSite: site !== null ? SENS_SITE[site] || null : null,
    sensMode: mode !== null ? SENS_MODE[mode] || null : null,
    sensDest: dest !== null ? SENS_DEST[dest] || null : null
  };
}
