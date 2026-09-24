/* Une CSP deduite de ce que la page a reellement charge — INTERCEPTOR (by NeoZ)
 *
 * Ecrire une Content-Security-Policy, c est enumerer d ou la page a le droit
 * de charger ses scripts, ses styles, ses images, ses connexions. INTERCEPTOR
 * a vu chacun de ces chargements : il peut proposer la politique qui les
 * autorise tous, et rien d autre.
 *
 * Ce qu elle ne peut pas savoir est dit, pas devine : un script ecrit dans la
 * page, un attribut onclick, un appel a eval() ne passent pas par le reseau ;
 * base-uri, form-action et frame-ancestors ne se deduisent d aucun
 * chargement ; et ce que la page n a pas charge pendant la capture n y est
 * pas. D ou la recommandation : l essayer d abord en Report-Only.
 */

/* Type webRequest -> directive CSP qui le gouverne (CSP niveau 3). Les
   workers passent pour des scripts : worker-src se replie sur script-src. */
const DIRECTIVE_DU_TYPE = {
  script: 'script-src',
  xslt: 'script-src',
  stylesheet: 'style-src',
  image: 'img-src',
  imageset: 'img-src',
  font: 'font-src',
  media: 'media-src',
  xmlhttprequest: 'connect-src',
  websocket: 'connect-src',
  beacon: 'connect-src',
  ping: 'connect-src',
  sub_frame: 'frame-src',
  object: 'object-src',
  object_subrequest: 'object-src',
  web_manifest: 'manifest-src'
};

/* L ordre dans lequel on ecrit la politique : lisible, stable. */
const ORDRE = ['default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src',
  'media-src', 'frame-src', 'object-src', 'manifest-src'];

/* Ce qu aucun chargement ne permet de deduire. */
export const LIMITES_CSP = [
  'les scripts et styles ecrits dans la page, les attributs onclick et eval() ne passent pas par le reseau : la politique ne les autorise pas',
  'base-uri, form-action et frame-ancestors ne se deduisent d aucun chargement : a decider soi-meme',
  'ce que la page n a pas charge pendant la capture n y figure pas : a essayer d abord en Report-Only'
];

const sansFragment = u => String(u || '').split('#')[0];

/**
 * @param page        l URL du document
 * @param chargements [{ type, url }] — ce que ce document a charge
 * @returns { politique, directives: [{ nom, sources }], retenus, ignores }
 */
export function proposerCsp(page, chargements) {
  let originePage = null;
  try { originePage = new URL(page).origin; } catch { /* page sans origine */ }
  const directives = new Map();
  let retenus = 0;
  let ignores = 0;
  for (const c of chargements || []) {
    const directive = DIRECTIVE_DU_TYPE[c.type];
    if (!directive) { ignores++; continue; }
    let source = null;
    try {
      const u = new URL(c.url);
      if (u.protocol === 'data:' || u.protocol === 'blob:') source = u.protocol;
      /* Une connexion WebSocket s ecrit avec son propre schema : on ne
         s en remet pas a 'self', que les navigateurs n appliquent pas tous
         aux schemas ws et wss. */
      else if (u.origin === originePage && u.protocol !== 'ws:' && u.protocol !== 'wss:') source = "'self'";
      else source = u.origin;
    } catch { ignores++; continue; }
    if (!directives.has(directive)) directives.set(directive, new Set());
    directives.get(directive).add(source);
    retenus++;
  }
  const liste = [{ nom: 'default-src', sources: ["'none'"] }];
  for (const nom of ORDRE) {
    if (nom === 'default-src' || !directives.has(nom)) continue;
    const sources = [...directives.get(nom)].sort((a, b) => (a === "'self'" ? -1 : b === "'self'" ? 1 : a.localeCompare(b)));
    liste.push({ nom, sources });
  }
  return {
    politique: liste.map(d => d.nom + ' ' + d.sources.join(' ')).join('; '),
    directives: liste,
    retenus,
    ignores
  };
}

/** Les chargements d un document parmi les lignes du tableau. */
export function chargementsDe(rec, lignes) {
  const page = sansFragment(rec.finalUrl || rec.url);
  const out = [];
  for (const l of lignes) {
    if (!l || l.id === rec.id || l.tabId !== rec.tabId) continue;
    if (sansFragment(l.initiator) !== page) continue;
    out.push({ type: l.type, url: l.url });
  }
  return out;
}
