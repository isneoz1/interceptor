/* Limites de debit d une API — SWIFT (by D4RK)
 *
 * Ce qu un serveur dit du quota qu il accorde, et du moment ou reessayer.
 *
 *   Retry-After (RFC 9110 §10.2.3)  un nombre de secondes ou une date HTTP.
 *     Avec un 503 : combien de temps le service restera indisponible ; avec
 *     un 3xx : l attente minimale avant de suivre la redirection.
 *
 *   RateLimit et RateLimit-Policy — un brouillon de l IETF, pas encore une
 *   RFC : draft-ietf-httpapi-ratelimit-headers. Trois generations
 *   circulent, et des bibliotheques courantes savent encore les emettre :
 *     -08 et suivants (avril 2025 ; -11 en mai 2026)
 *         RateLimit-Policy: "burst";q=100;w=60
 *         RateLimit: "default";r=50;t=30
 *     -07 (decembre 2023)
 *         RateLimit-Policy: 100;w=10
 *         RateLimit: limit=100, remaining=50, reset=5
 *     -00 a -06 (2021 a 2023)
 *         RateLimit-Limit: 100   RateLimit-Remaining: 50   RateLimit-Reset: 5
 *         (de -00 a -03, RateLimit-Limit est une liste : la limite, puis
 *         les politiques — `RateLimit-Limit: 10, 10;w=1, 50;w=60`)
 *
 *   X-RateLimit-Limit, -Remaining, -Reset : aucune specification. Le sens de
 *     Reset varie d un service a l autre ; il est lu comme une heure Unix
 *     au-dela d un milliard, comme un nombre de secondes en deca, et la
 *     lecture le dit.
 */
import { lireListe, lireDictionnaire, lireArticleSeul } from './champs-structures.js';
import { lireDateHttp, faitsDeDate } from './date-http.js';

export const FAITS_DEBIT = {
  reessayerDans: 'reessayer dans {duree} ({date})',
  reessayer503: 'service indisponible pour ce client pendant {duree} encore, d apres le serveur (RFC 9110 §10.2.3)',
  reessayer3xx: 'attendre au moins {duree} avant de suivre la redirection (RFC 9110 §10.2.3)',
  reessayerPasse: 'la date de nouvel essai ({date}) est deja passee',
  retryIllisible: 'Retry-After illisible : un nombre entier de secondes ou une date HTTP est attendu (RFC 9110 §10.2.3)',
  epuise: 'quota epuise : plus rien de disponible sous la politique {nom}',
  epuiseSimple: 'quota epuise : plus rien de disponible jusqu a la remise a zero',
  malForme: '{entete} mal forme : un client doit l ignorer (brouillon IETF ratelimit-headers)',
  cache: 'reponse servie par un cache : ces valeurs peuvent dater, le brouillon demande de les ignorer (§7.3)',
  retryAvantFenetre: 'Retry-After tombe avant la fin de la fenetre annoncee : le brouillon le deconseille (§6), et Retry-After l emporte (§7)',
  forme11: 'forme du brouillon IETF -08 et suivants (draft-ietf-httpapi-ratelimit-headers, pas encore une RFC)',
  forme07: 'forme du brouillon IETF -07 (decembre 2023), remplacee depuis',
  forme06: 'forme des brouillons IETF -00 a -06 (2021 a 2023), remplacee depuis',
  formeX: 'X-RateLimit-* : aucune specification ; Reset est lu {lecture}',
  resetUnix: 'comme une heure Unix (valeur superieure a un milliard)',
  resetSecondes: 'comme un nombre de secondes',
  reinit: 'remise a zero du quota dans {duree} ({date})'
};

const UNITES = { 'requests': 'requete(s)', 'content-bytes': 'octet(s) de contenu', 'concurrent-requests': 'requete(s) simultanee(s)' };
export const UNITES_DEBIT = Object.assign(Object.create(null), UNITES);

function valeurs(entetes, nom) {
  return (entetes || []).filter(h => h && String(h.name || '').toLowerCase() === nom).map(h => String(h.value ?? ''));
}
const joindre = (entetes, nom) => { const v = valeurs(entetes, nom); return v.length ? v.join(', ') : null; };

/* RFC 9651 : quand une cle se repete, la derniere l emporte. */
function parametre(liste, cle) {
  let trouve;
  for (const p of liste || []) if (p.cle === cle) trouve = p;
  return trouve;
}
const entierNonNegatif = p => (p && p.type === 'entier' && p.valeur >= 0 ? p.valeur : null);

/* Brouillon -08+ : liste de chaines portant q/qu/w (politique) ou r/t (limite). */
function lirePolitiques11(texte) {
  const membres = lireListe(texte);
  if (!membres.length) throw new Error('liste vide');
  return membres.map(m => {
    if (m.type !== 'chaine') throw new Error('le nom d une politique est une chaine');
    const q = entierNonNegatif(parametre(m.parametres, 'q'));
    if (q == null) throw new Error('q, entier non negatif, est obligatoire');
    const qu = parametre(m.parametres, 'qu');
    const w = parametre(m.parametres, 'w');
    return {
      nom: m.valeur, quota: q,
      unite: qu && qu.type === 'chaine' ? qu.valeur : 'requests',
      fenetre: w && w.type === 'entier' && w.valeur > 0 ? w.valeur : null
    };
  });
}

function lireLimites11(texte) {
  const membres = lireListe(texte);
  if (!membres.length) throw new Error('liste vide');
  return membres.map(m => {
    if (m.type !== 'chaine') throw new Error('le nom d une politique est une chaine');
    const r = entierNonNegatif(parametre(m.parametres, 'r'));
    if (r == null) throw new Error('r, entier non negatif, est obligatoire');
    const t = entierNonNegatif(parametre(m.parametres, 't'));
    return { nom: m.valeur, restant: r, fenetre: t };
  });
}

/* Brouillon -07 : RateLimit est un dictionnaire limit / remaining / reset. */
function lireLimite07(texte) {
  const membres = lireDictionnaire(texte);
  const cle = c => { let v; for (const m of membres) if (m.cle === c) v = m; return v; };
  const limite = entierNonNegatif(cle('limit'));
  const reinit = entierNonNegatif(cle('reset'));
  if (limite == null || reinit == null) throw new Error('limit et reset sont obligatoires');
  return { limite, restant: entierNonNegatif(cle('remaining')), reinit };
}

/* RateLimit-Policy des brouillons -06 et -07 : des entiers avec ;w=. */
function lirePolitiques07(texte) {
  return lireListe(texte).map(m => {
    if (m.type !== 'entier' || m.valeur < 0) throw new Error('quota entier attendu');
    const w = parametre(m.parametres, 'w');
    return { nom: null, quota: m.valeur, unite: 'requests', fenetre: w && w.type === 'entier' ? w.valeur : null };
  });
}

/* RateLimit-Limit des brouillons -00 a -06 : un entier seul (-04 a -06), ou
   une liste dont le premier membre est la limite et les suivants des
   politiques (-00 a -03). null si absent, undefined si mal forme. */
function lireLimiteAncienne(texte) {
  if (texte == null) return null;
  let membres;
  try { membres = lireListe(texte); } catch { return undefined; }
  if (!membres.length || membres[0].type !== 'entier' || membres[0].valeur < 0) return undefined;
  const politiques = [];
  for (const m of membres.slice(1)) {
    if (m.type !== 'entier' || m.valeur < 0) return undefined;
    const w = parametre(m.parametres, 'w');
    politiques.push({ nom: null, quota: m.valeur, unite: 'requests', fenetre: w && w.type === 'entier' ? w.valeur : null });
  }
  return { limite: membres[0].valeur, politiques };
}

function entierSeul(texte) {
  if (texte == null) return null;
  try {
    const a = lireArticleSeul(texte);
    return a.type === 'entier' && a.valeur >= 0 ? a.valeur : undefined;
  } catch { return undefined; }
}

/** Retry-After : { secondes, ms } par rapport a l instant de la reponse. */
export function lireRetryAfter(brut, instantReponse, maintenant = Date.now()) {
  const texte = String(brut ?? '').trim();
  if (/^\d+$/.test(texte)) {
    const secondes = Number(texte);
    return { brut: texte, forme: 'secondes', secondes, ms: instantReponse + secondes * 1000, date: null };
  }
  const date = lireDateHttp(texte, maintenant);
  if (!date) return { brut: texte, forme: 'illisible', secondes: null, ms: null, date: null };
  return { brut: texte, forme: 'date', secondes: Math.round((date.ms - instantReponse) / 1000), ms: date.ms, date };
}

/**
 * Tout ce que la reponse dit du debit. null si aucun en-tete n en parle.
 *
 * @param options.statut          code de statut de la reponse
 * @param options.instantReponse  ms, reception de la reponse (sinon maintenant)
 * @param options.depuisCache     vrai si la reponse sort d un cache
 * @param options.maintenant      ms
 */
export function lireLimitesDebit(entetes, options = {}) {
  const maintenant = Number(options.maintenant) || Date.now();
  const instant = Number(options.instantReponse) || maintenant;
  const statut = Number(options.statut) || 0;
  const faits = [];
  const dire = (cle, v = {}, niveau = 'info') => faits.push({ cle, texte: FAITS_DEBIT[cle], valeurs: v, niveau });

  const brutRetry = joindre(entetes, 'retry-after');
  const brutLimite = joindre(entetes, 'ratelimit');
  const brutPolitique = joindre(entetes, 'ratelimit-policy');
  const anciens = {
    limite: joindre(entetes, 'ratelimit-limit'), restant: joindre(entetes, 'ratelimit-remaining'),
    reinit: joindre(entetes, 'ratelimit-reset')
  };
  const x = {
    limite: joindre(entetes, 'x-ratelimit-limit'), restant: joindre(entetes, 'x-ratelimit-remaining'),
    reinit: joindre(entetes, 'x-ratelimit-reset')
  };
  const aAnciens = Object.values(anciens).some(v => v != null);
  const aX = Object.values(x).some(v => v != null);
  if (brutRetry == null && brutLimite == null && brutPolitique == null && !aAnciens && !aX) return null;

  const lu = { retryAfter: null, politiques: [], limites: [], forme: null, ancien: null, faits };

  /* ------------------------------ Retry-After ------------------------------ */
  if (brutRetry != null) {
    const r = lireRetryAfter(brutRetry, instant, maintenant);
    lu.retryAfter = r;
    if (r.forme === 'illisible') dire('retryIllisible', {}, 'warn');
    else {
      if (r.date) for (const f of faitsDeDate(r.date)) faits.push({ ...f, niveau: 'info' });
      if (r.ms <= maintenant && r.forme === 'date') dire('reessayerPasse', { date: r.ms });
      else if (statut === 503) dire('reessayer503', { duree: r.secondes, date: r.ms }, 'warn');
      else if (statut >= 300 && statut < 400) dire('reessayer3xx', { duree: r.secondes, date: r.ms });
      else dire('reessayerDans', { duree: r.secondes, date: r.ms }, statut === 429 ? 'warn' : 'info');
    }
  }

  /* --------------------------- RateLimit-Policy ---------------------------- */
  if (brutPolitique != null) {
    try { lu.politiques = lirePolitiques11(brutPolitique); lu.forme = '11'; }
    catch {
      try { lu.politiques = lirePolitiques07(brutPolitique); lu.forme = brutLimite != null ? '07' : '06'; }
      catch { dire('malForme', { entete: 'RateLimit-Policy' }, 'warn'); }
    }
  }

  /* ------------------------------- RateLimit ------------------------------- */
  let finFenetre = null;
  if (brutLimite != null) {
    try {
      lu.limites = lireLimites11(brutLimite);
      lu.forme = '11';
      for (const l of lu.limites) if (l.fenetre != null) finFenetre = Math.max(finFenetre || 0, instant + l.fenetre * 1000);
    } catch {
      try {
        const l = lireLimite07(brutLimite);
        lu.ancien = { limite: l.limite, restant: l.restant, reinit: l.reinit, reinitForme: 'secondes' };
        lu.forme = '07';
        finFenetre = instant + l.reinit * 1000;
      } catch { dire('malForme', { entete: 'RateLimit' }, 'warn'); }
    }
  }

  /* -------------------- Champs separes : -00 a -06, puis X- ------------------ */
  if (!lu.ancien && aAnciens) {
    const lue = lireLimiteAncienne(anciens.limite);
    const limite = lue ? lue.limite : lue;
    const restant = entierSeul(anciens.restant);
    const reinit = entierSeul(anciens.reinit);
    if ([limite, restant, reinit].some(v => v === undefined)) dire('malForme', { entete: 'RateLimit-Limit / -Remaining / -Reset' }, 'warn');
    else {
      if (lue && lue.politiques.length && !lu.politiques.length) lu.politiques = lue.politiques;
      lu.ancien = { limite, restant, reinit, reinitForme: 'secondes' };
      lu.forme = lu.forme || '06';
      if (reinit != null) finFenetre = instant + reinit * 1000;
    }
  }
  if (!lu.ancien && aX) {
    const nombre = v => (v != null && /^\s*\d+\s*$/.test(v) ? Number(v) : null);
    const limite = nombre(x.limite);
    const restant = nombre(x.restant);
    const reinitBrut = nombre(x.reinit);
    const unix = reinitBrut != null && reinitBrut > 1e9;
    lu.ancien = { limite, restant, reinit: reinitBrut, reinitForme: unix ? 'unix' : 'secondes' };
    lu.forme = 'x';
    dire('formeX', { lecture: unix ? FAITS_DEBIT.resetUnix : FAITS_DEBIT.resetSecondes });
    if (reinitBrut != null) finFenetre = unix ? reinitBrut * 1000 : instant + reinitBrut * 1000;
  }

  /* ------------------------------- Les faits ------------------------------- */
  if (lu.forme === '11') dire('forme11');
  if (lu.forme === '07') dire('forme07');
  if (lu.forme === '06') dire('forme06');

  for (const l of lu.limites) {
    if (l.restant === 0) dire('epuise', { nom: l.nom }, 'warn');
  }
  if (lu.ancien && lu.ancien.restant === 0) dire('epuiseSimple', {}, 'warn');
  if (lu.ancien && lu.ancien.reinit != null) {
    const quand = lu.ancien.reinitForme === 'unix' ? lu.ancien.reinit * 1000 : instant + lu.ancien.reinit * 1000;
    dire('reinit', { duree: Math.round((quand - instant) / 1000), date: quand });
  }
  /* Les deux regles qui suivent sont celles du brouillon courant (-11, §6 et
     §7.3) : on ne les prete pas aux formes anciennes. */
  if (options.depuisCache && lu.forme === '11') dire('cache', {}, 'info');
  if (lu.forme === '11' && lu.retryAfter && lu.retryAfter.ms != null && finFenetre != null
    && lu.retryAfter.ms < finFenetre) {
    dire('retryAvantFenetre', {}, 'warn');
  }
  return lu;
}
