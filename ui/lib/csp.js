/* Content-Security-Policy — INTERCEPTOR (by D4RK)
 *
 * Lit une politique CSP et dit, en clair, ce qu elle AUTORISE. On ne parle pas
 * de « faille » : on decrit ce que la politique laisse passer, en citant la
 * directive concernee. La liste des directives et mots-cles suit CSP niveau 3
 * (W3C) ; les directives retirees ou depreciees sont marquees comme telles.
 */

/* nom, groupe, sens, deprecie */
const D = [
  ['default-src', 'recuperation', 'repli pour toutes les directives de recuperation absentes', false],
  ['script-src', 'recuperation', 'scripts : balises, inline, eval, workers', false],
  ['script-src-elem', 'recuperation', 'scripts dans des balises <script> seulement', false],
  ['script-src-attr', 'recuperation', 'scripts dans des attributs d evenement (onclick...)', false],
  ['style-src', 'recuperation', 'feuilles de style et styles en ligne', false],
  ['style-src-elem', 'recuperation', 'styles dans <style> et <link> seulement', false],
  ['style-src-attr', 'recuperation', 'styles dans des attributs style=""', false],
  ['img-src', 'recuperation', 'images et favicons', false],
  ['font-src', 'recuperation', 'polices (@font-face)', false],
  ['connect-src', 'recuperation', 'fetch, XHR, WebSocket, EventSource, beacons', false],
  ['media-src', 'recuperation', 'audio, video, pistes', false],
  ['object-src', 'recuperation', 'greffons : <object>, <embed>', false],
  ['child-src', 'recuperation', 'workers et cadres (repli de frame-src et worker-src)', false],
  ['frame-src', 'recuperation', 'contenu des <iframe> et <frame>', false],
  ['worker-src', 'recuperation', 'Worker, SharedWorker, ServiceWorker', false],
  ['manifest-src', 'recuperation', 'manifeste d application web', false],
  ['prefetch-src', 'recuperation', 'prechargements (retire de CSP3)', true],
  ['base-uri', 'document', 'URL autorisees dans <base href>', false],
  ['sandbox', 'document', 'bac a sable comme l attribut sandbox d une iframe', false],
  ['form-action', 'navigation', 'destinations autorisees pour l envoi de formulaires', false],
  ['frame-ancestors', 'navigation', 'qui a le droit d encadrer cette page (remplace X-Frame-Options)', false],
  ['navigate-to', 'navigation', 'retire de CSP3, jamais deploye largement', true],
  ['report-uri', 'rapport', 'ou envoyer les violations (deprecie au profit de report-to)', true],
  ['report-to', 'rapport', 'groupe de rapport defini par l en-tete Reporting-Endpoints', false],
  ['upgrade-insecure-requests', 'autre', 'reecrit http:// en https:// avant chaque requete', false],
  ['block-all-mixed-content', 'autre', 'bloque tout contenu mixte (deprecie, remplace par upgrade-insecure-requests)', true],
  ['require-trusted-types-for', 'autre', 'exige des Trusted Types pour les puits DOM dangereux', false],
  ['trusted-types', 'autre', 'politiques Trusted Types autorisees', false],
  ['require-sri-for', 'autre', 'retire : exigeait une integrite sur scripts/styles', true],
  ['plugin-types', 'autre', 'retire : types MIME de greffons', true],
  ['referrer', 'autre', 'retire : remplace par l en-tete Referrer-Policy', true]
];
export const DIRECTIVES_CSP = D.map(([nom, groupe, sens, deprecie]) => ({ nom, groupe, sens, deprecie }));

export const MOTS_CLES_CSP = [
  ["'self'", 'meme origine que le document'],
  ["'none'", 'aucune source'],
  ["'unsafe-inline'", 'scripts ou styles en ligne autorises (ignore si un nonce ou un hash est present)'],
  ["'unsafe-eval'", 'eval(), new Function(), setTimeout(chaine) autorises'],
  ["'unsafe-hashes'", 'permet des gestionnaires d evenement inline par hash'],
  ["'wasm-unsafe-eval'", 'compilation WebAssembly autorisee sans autoriser eval()'],
  ["'strict-dynamic'", 'la confiance se propage aux scripts charges par un script de confiance ; les listes d hotes sont ignorees'],
  ["'report-sample'", 'inclut un extrait du code dans le rapport de violation'],
  ["'inline-speculation-rules'", 'autorise les regles de speculation inline'],
  ["'nonce-...'", 'jeton unique par reponse, a reprendre dans l attribut nonce'],
  ["'sha256-...' / 'sha384-...' / 'sha512-...'", 'hash du contenu inline autorise']
];

/** Politique -> liste ordonnee de { nom, sources[], connu, deprecie }. */
export function analyserCsp(politique) {
  const directives = [];
  const vus = new Set();
  for (const morceau of String(politique || '').split(';')) {
    const parts = morceau.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    const nom = parts[0].toLowerCase();
    const ref = DIRECTIVES_CSP.find(d => d.nom === nom);
    const doublon = vus.has(nom);
    vus.add(nom);
    directives.push({ nom, sources: parts.slice(1), connu: !!ref, deprecie: !!(ref && ref.deprecie), doublon,
      sens: ref ? ref.sens : '' });
  }
  return { directives, faits: faitsCsp(directives) };
}

function sourcesDe(directives, nom) {
  const d = directives.find(x => x.nom === nom && !x.doublon);
  return d ? d.sources : null;
}

/**
 * Ce que la politique laisse passer, en phrases factuelles.
 *
 * Chaque fait est un couple { texte, valeurs } : le texte est un gabarit
 * constant, traduisible tel quel, et les valeurs s y inserent apres coup. Sans
 * cette separation, une phrase construite par concatenation resterait en
 * francais dans une interface anglaise. Meme convention que les preuves de
 * l analyseur (voir `preuveLisible` dans ui/lib/format.js).
 */
function faitsCsp(directives) {
  const f = [];
  const dire = (texte, valeurs) => f.push({ texte, valeurs: valeurs || {} });
  const src = nom => sourcesDe(directives, nom);
  const scripts = src('script-src') ?? src('default-src');
  const scriptsVia = src('script-src') ? 'script-src' : (src('default-src') ? 'default-src' : null);

  if (!directives.length) { dire('politique vide : rien n est restreint'); return f; }
  if (!src('default-src')) dire('default-src absent : toute directive de recuperation non definie est sans restriction');

  if (!scriptsVia) {
    dire('ni script-src ni default-src : les scripts peuvent venir de n importe ou');
  } else {
    const s = scripts;
    const via = { d: scriptsVia };
    const nonceOuHash = s.some(x => /^'(nonce-|sha(256|384|512)-)/i.test(x));
    const strictDynamic = s.includes("'strict-dynamic'");
    if (s.includes("'unsafe-inline'") && !nonceOuHash) dire("{d} autorise 'unsafe-inline' : tout script inline injecte s executera", via);
    if (s.includes("'unsafe-inline'") && nonceOuHash) dire("{d} porte 'unsafe-inline' mais aussi un nonce ou un hash : les navigateurs recents ignorent alors unsafe-inline", via);
    if (s.includes("'unsafe-eval'")) dire("{d} autorise 'unsafe-eval' : eval() et new Function() sont permis", via);
    if (s.includes('*')) dire('{d} contient * : des scripts de toute origine sont acceptes', via);
    for (const sch of ['http:', 'https:', 'data:', 'blob:', 'filesystem:']) {
      if (s.includes(sch)) dire('{d} accepte le schema {s} entier : toute URL {s} peut fournir un script', { d: scriptsVia, s: sch });
    }
    if (strictDynamic) dire("'strict-dynamic' present : les listes d hotes et 'self' sont ignorees pour les scripts ; seuls nonce/hash comptent");
    if (s.includes("'none'") && s.length > 1) dire("{d} melange 'none' avec d autres sources : 'none' doit etre seul", via);
    const hotesLarges = s.filter(x => /^(https?:\/\/)?\*\.[a-z0-9.-]+$/i.test(x));
    if (hotesLarges.length) dire('{d} accepte des jokers de sous-domaine : {h}', { d: scriptsVia, h: hotesLarges.join(', ') });
  }

  if (!src('object-src') && !src('default-src')) dire('object-src absent (et pas de default-src) : les greffons <object>/<embed> ne sont pas restreints');
  else if (src('object-src') && !src('object-src').includes("'none'")) dire('object-src autorise des greffons : {s}', { s: src('object-src').join(' ') });
  if (!src('base-uri')) dire('base-uri absent : une balise <base> injectee peut rediriger toutes les URL relatives');
  if (!src('frame-ancestors')) dire('frame-ancestors absent : cette politique ne dit pas qui peut encadrer la page (voir X-Frame-Options)');
  if (!src('form-action')) dire('form-action absent : un formulaire peut etre envoye vers n importe quelle origine');

  const styles = src('style-src') ?? src('default-src');
  if (styles && styles.includes("'unsafe-inline'")) dire('les styles en ligne sont autorises (style-src ou default-src)');
  const conn = src('connect-src') ?? src('default-src');
  if (conn && conn.includes('*')) dire('connect-src contient * : fetch/XHR/WebSocket vers toute origine');

  for (const d of directives) {
    if (!d.connu) dire('directive inconnue ignoree par les navigateurs : {n}', { n: d.nom });
    else if (d.deprecie) dire('directive depreciee ou retiree : {n} ({s})', { n: d.nom, s: d.sens });
    if (d.doublon) dire('directive en double, seule la premiere compte : {n}', { n: d.nom });
  }
  if (src('report-uri') && !src('report-to')) dire('report-uri seul : deprecie, mais encore lu ; report-to est la forme actuelle');
  if (!f.length) dire('aucune permission large detectee dans cette politique');
  return f;
}
