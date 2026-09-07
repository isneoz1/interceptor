/* Fraicheur HTTP — INTERCEPTOR (by D4RK)
 *
 * Applique les regles de la RFC 9111 (HTTP Caching) a des en-tetes reels :
 *   - duree de fraicheur (section 4.2.1) : s-maxage, puis max-age, puis
 *     Expires moins Date, sinon une heuristique sur Last-Modified ;
 *   - age courant (section 4.2.3) : age apparent, age corrige, temps de
 *     residence ;
 *   - verdict : fraiche ou perimee, et pour combien de temps.
 * Chaque chiffre affiche sort de ces formules, rien n est estime a l oeil.
 */

const DIRECTIVES = ['max-age', 's-maxage', 'no-cache', 'no-store', 'private', 'public',
  'must-revalidate', 'proxy-revalidate', 'immutable', 'stale-while-revalidate',
  'stale-if-error', 'no-transform', 'must-understand'];

/** Lit un bloc d en-tetes texte ou un objet, en clefs minuscules. */
export function entetesVersObjet(entree) {
  if (entree && typeof entree === 'object' && !Array.isArray(entree)) {
    const o = {};
    for (const [k, v] of Object.entries(entree)) o[String(k).toLowerCase()] = String(v);
    return o;
  }
  const o = {};
  for (const ligne of String(entree || '').split(/\r?\n/)) {
    const m = /^([A-Za-z0-9-]+)\s*:\s*(.*)$/.exec(ligne.trim());
    if (!m) continue;
    const k = m[1].toLowerCase();
    o[k] = k in o ? o[k] + ', ' + m[2] : m[2];
  }
  return o;
}

/** Cache-Control -> { directive: valeur|true }, inconnues conservees. */
export function analyserCacheControl(valeur) {
  const out = {};
  for (const morceau of String(valeur || '').split(',')) {
    const m = /^\s*([A-Za-z0-9-]+)\s*(?:=\s*"?([^"]*)"?)?\s*$/.exec(morceau);
    if (!m) continue;
    const nom = m[1].toLowerCase();
    out[nom] = m[2] != null ? m[2].trim() : true;
  }
  return out;
}

const dateHttp = v => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};
const entier = v => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * @param options.reponse   en-tetes de reponse (texte ou objet)
 * @param options.requete   en-tetes de requete (facultatif, pour no-cache/max-age cote client)
 * @param options.instantRequete  ms, moment d envoi (defaut : instantReponse)
 * @param options.instantReponse  ms, moment de reception (defaut : Date de la reponse, sinon maintenant)
 * @param options.maintenant      ms, defaut Date.now()
 * @param options.partage         true = cache partage (s-maxage prime), false = cache du navigateur
 */
export function analyserFraicheur(options = {}) {
  const rep = entetesVersObjet(options.reponse);
  const req = entetesVersObjet(options.requete);
  const cc = analyserCacheControl(rep['cache-control']);
  const ccReq = analyserCacheControl(req['cache-control']);
  const partage = !!options.partage;
  const maintenant = Number(options.maintenant) || Date.now();
  const dateValeur = dateHttp(rep.date);
  const instantReponse = Number(options.instantReponse) || dateValeur || maintenant;
  const instantRequete = Number(options.instantRequete) || instantReponse;
  const faits = [];

  /* ------------------------- Duree de fraicheur ------------------------- */
  let duree = null, source = '';
  const sMaxAge = entier(cc['s-maxage']);
  const maxAge = entier(cc['max-age']);
  const expires = dateHttp(rep.expires);
  const lastModified = dateHttp(rep['last-modified']);

  if (partage && sMaxAge != null) { duree = sMaxAge; source = 's-maxage'; }
  else if (maxAge != null) { duree = maxAge; source = 'max-age'; }
  else if (expires != null && dateValeur != null) {
    duree = Math.max(0, Math.round((expires - dateValeur) / 1000)); source = 'Expires moins Date';
  } else if (expires != null) {
    duree = Math.max(0, Math.round((expires - instantReponse) / 1000)); source = 'Expires (sans Date)';
  } else if (lastModified != null && dateValeur != null && dateValeur > lastModified) {
    duree = Math.round((dateValeur - lastModified) / 1000 * 0.10);
    source = 'heuristique : 10 % de l ecart Date / Last-Modified';
    faits.push('aucune duree explicite : un cache peut appliquer une heuristique, ici 10 % de l age du document');
  } else if (rep.expires && expires == null) {
    duree = 0; source = 'Expires invalide, donc deja perime';
  }

  /* ----------------------------- Age courant ---------------------------- */
  const ageEntete = entier(rep.age) || 0;
  const ageApparent = dateValeur != null ? Math.max(0, Math.round((instantReponse - dateValeur) / 1000)) : 0;
  const delaiReponse = Math.max(0, Math.round((instantReponse - instantRequete) / 1000));
  const ageCorrige = ageEntete + delaiReponse;
  const ageInitial = Math.max(ageApparent, ageCorrige);
  const residence = Math.max(0, Math.round((maintenant - instantReponse) / 1000));
  const ageCourant = ageInitial + residence;

  /* -------------------------- Peut-on stocker ? ------------------------- */
  let stockable = true;
  if (cc['no-store']) { stockable = false; faits.push('no-store : la reponse ne doit pas etre stockee du tout'); }
  if (cc.private && partage) { stockable = false; faits.push('private : reservee au cache du navigateur, pas a un cache partage'); }
  if (cc['no-cache']) faits.push('no-cache : stockable, mais a revalider aupres du serveur avant chaque reutilisation');
  if (cc['must-revalidate']) faits.push('must-revalidate : une fois perimee, jamais servie sans revalidation');
  if (cc['proxy-revalidate']) faits.push('proxy-revalidate : meme regle, pour les caches partages seulement');
  if (cc.immutable) faits.push('immutable : le navigateur ne revalide pas tant que la reponse est fraiche, meme au rechargement');
  if (cc.public) faits.push('public : stockable par un cache partage meme si la requete etait authentifiee');
  if (cc['stale-while-revalidate'] != null) faits.push('stale-while-revalidate : sert la version perimee pendant ' + cc['stale-while-revalidate'] + ' s en revalidant en arriere-plan');
  if (cc['stale-if-error'] != null) faits.push('stale-if-error : sert la version perimee pendant ' + cc['stale-if-error'] + ' s si le serveur repond en erreur');
  if (cc['no-transform']) faits.push('no-transform : un intermediaire ne doit pas recompresser ni recoder le corps');
  if (req.authorization && partage && !cc.public && sMaxAge == null && !cc['must-revalidate']) {
    faits.push('requete authentifiee sans public/s-maxage/must-revalidate : un cache partage ne doit pas la stocker');
  }
  if (rep.vary === '*') faits.push('Vary: * : aucune reponse stockee ne peut etre reutilisee sans revalidation');
  if (ccReq['no-cache']) faits.push('la requete porte no-cache : le client exige une revalidation');
  if (entier(ccReq['max-age']) != null) faits.push('la requete porte max-age=' + ccReq['max-age'] + ' : le client refuse une reponse plus agee');

  const inconnues = Object.keys(cc).filter(d => !DIRECTIVES.includes(d));
  if (inconnues.length) faits.push('directives non normalisees : ' + inconnues.join(', '));

  /* ------------------------------- Verdict ------------------------------ */
  const fraiche = duree != null && duree > ageCourant;
  const restant = duree != null ? duree - ageCourant : null;
  const validateurs = [];
  if (rep.etag) validateurs.push('ETag ' + rep.etag);
  if (rep['last-modified']) validateurs.push('Last-Modified ' + rep['last-modified']);

  return {
    stockable, fraiche, source, duree, ageCourant, restant,
    detailAge: { ageEntete, ageApparent, delaiReponse, ageCorrige, ageInitial, residence },
    directives: cc, validateurs, vary: rep.vary || '', faits,
    revalidable: validateurs.length > 0
  };
}

/** Une phrase, pour l affichage, a partir du resultat ci-dessus. */
export function resumerFraicheur(r) {
  if (!r.stockable) return 'non stockable';
  if (r.duree == null) return 'aucune duree de fraicheur determinable : a revalider a chaque fois';
  if (r.fraiche) return 'fraiche encore ' + r.restant + ' s (' + r.source + ')';
  return 'perimee depuis ' + Math.abs(r.restant) + ' s (' + r.source + ')'
    + (r.revalidable ? ' — revalidable avec ' + r.validateurs.join(' / ') : ' — aucun validateur, a retelecharger');
}
