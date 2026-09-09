/* Preflight CORS : ce qu il autorise, et ce qu il refuse
 * INTERCEPTOR (by NeoZ)
 *
 * Le navigateur envoie un OPTIONS avant certaines requetes, pour demander la
 * permission. Quand la vraie requete echoue, l erreur s affiche sur ELLE —
 * alors que la cause vit dans la reponse au OPTIONS, quelques lignes plus
 * haut dans le tableau, souvent deja oubliee.
 *
 * Ce module fait le rapprochement : il apparie chaque preflight avec la
 * requete qu il precede, puis dit si la reponse l autorisait vraiment.
 *
 * Les regles appliquees sont celles de la specification Fetch :
 *
 *   - Access-Control-Allow-Origin doit valoir l origine demandee, ou « * »
 *   - avec des identifiants, « * » ne vaut RIEN : l origine doit etre citee,
 *     et Access-Control-Allow-Credentials doit valoir « true »
 *   - Access-Control-Allow-Methods doit citer la methode demandee, sauf pour
 *     les methodes dites sures qui n ont pas besoin d y figurer
 *   - Access-Control-Allow-Headers doit couvrir chaque entete demande, hors
 *     entetes dits simples
 *   - une reponse de preflight doit reussir : un 4xx ou 5xx refuse tout
 *
 * Rien n est devine : chaque verdict cite l entete qui le fonde, ou dit
 * lequel manque.
 */

/* https://fetch.spec.whatwg.org/#cors-safelisted-method */
const METHODES_SURES = new Set(['GET', 'HEAD', 'POST']);

/* https://fetch.spec.whatwg.org/#cors-safelisted-request-header — ces entetes
   n ont jamais besoin d etre autorises nommement. */
const ENTETES_SIMPLES = new Set([
  'accept', 'accept-language', 'content-language', 'content-type',
  'range', 'dpr', 'downlink', 'save-data', 'viewport-width', 'width'
]);

/** La valeur d un entete dans une liste [{ name, value }], sans casse. */
export function entete(liste, nom) {
  const cherche = String(nom).toLowerCase();
  for (const h of liste || []) {
    if (String(h.name || '').toLowerCase() === cherche) return h.value;
  }
  return null;
}

/** Vrai si cet enregistrement est un preflight CORS. */
export function estPreflight(rec) {
  return !!rec
    && String(rec.method || '').toUpperCase() === 'OPTIONS'
    && entete(rec.requestHeaders, 'access-control-request-method') != null;
}

/* L URL sans sa chaine de requete ni son fragment : un preflight porte sur
   une ressource, pas sur des parametres. */
function ressource(url) {
  const texte = String(url == null ? '' : url);
  const coupe = texte.search(/[?#]/);
  return coupe < 0 ? texte : texte.slice(0, coupe);
}

/* Une liste d entetes annonces, decoupee et normalisee. */
function listeEntetes(valeur) {
  return String(valeur == null ? '' : valeur)
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Apparie chaque preflight avec la requete qu il autorisait.
 *
 * On retient la PREMIERE requete qui suit le preflight, vers la meme
 * ressource et avec la methode demandee. Un preflight vaut pour un couple
 * ressource + methode : apparier au-dela reviendrait a inventer un lien.
 *
 * @param enregistrements liste dans l ordre de capture
 * @returns [{ preflight, requete }] — `requete` vaut null quand la vraie
 *          requete n a jamais suivi, ce qui est en soi un resultat : le
 *          preflight a echoue, ou la page a renonce.
 */
export function apparierPreflights(enregistrements) {
  const liste = (enregistrements || []).slice()
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  const paires = [];
  const consommes = new Set();

  for (let i = 0; i < liste.length; i++) {
    const p = liste[i];
    if (!estPreflight(p)) continue;

    const cible = ressource(p.url);
    const methode = String(entete(p.requestHeaders, 'access-control-request-method') || '')
      .toUpperCase();

    let suite = null;
    for (let j = i + 1; j < liste.length; j++) {
      const r = liste[j];
      if (consommes.has(r.id)) continue;
      if (estPreflight(r)) continue;
      if (ressource(r.url) !== cible) continue;
      if (String(r.method || '').toUpperCase() !== methode) continue;
      suite = r;
      consommes.add(r.id);
      break;
    }
    paires.push({ preflight: p, requete: suite });
  }
  return paires;
}

/**
 * Dit si la reponse au preflight autorise reellement la requete demandee.
 *
 * @returns { autorise, motifs, details }
 *          `motifs` liste ce qui bloque : chacun porte un gabarit `cle` et
 *          ses `valeurs`, que l interface remplit apres traduction. Vide
 *          quand tout passe.
 */
export function verdictPreflight(preflight) {
  if (!estPreflight(preflight)) throw new Error('cet enregistrement n est pas un preflight CORS');

  const demande = preflight.requestHeaders || [];
  const reponse = preflight.responseHeaders || [];

  const origine = entete(demande, 'origin');
  const methode = String(entete(demande, 'access-control-request-method') || '').toUpperCase();
  const entetesDemandes = listeEntetes(entete(demande, 'access-control-request-headers'));

  const permisOrigine = entete(reponse, 'access-control-allow-origin');
  const permisMethodes = entete(reponse, 'access-control-allow-methods');
  const permisEntetes = entete(reponse, 'access-control-allow-headers');
  const identifiants = String(entete(reponse, 'access-control-allow-credentials') || '')
    .trim().toLowerCase() === 'true';
  const duree = entete(reponse, 'access-control-max-age');

  const motifs = [];
  const statut = Number(preflight.statusCode || 0);

  /* Une reponse en echec refuse tout, quels que soient ses entetes. */
  if (statut >= 400 || statut === 0) {
    motifs.push({
      quoi: 'statut',
      cle: 'la reponse au preflight vaut {statut} : le navigateur ne regarde meme pas les autorisations',
      valeurs: { statut: statut || 'aucun statut' }
    });
  }

  /* L origine. */
  if (permisOrigine == null) {
    motifs.push({ quoi: 'origine', cle: 'Access-Control-Allow-Origin est absent de la reponse' });
  } else if (permisOrigine.trim() === '*') {
    /* Le joker ne vaut rien quand la requete porte des identifiants : c est
       la regle la plus souvent oubliee, et elle produit une erreur qui ne
       mentionne meme pas les cookies. */
    if (identifiants) {
      motifs.push({
        quoi: 'origine',
        cle: 'Access-Control-Allow-Origin vaut « * » alors que les identifiants sont autorises : le navigateur refuse cette combinaison, l origine doit etre citee'
      });
    }
  } else if (origine && permisOrigine.trim() !== origine.trim()) {
    motifs.push({
      quoi: 'origine',
      cle: 'Access-Control-Allow-Origin repond « {permis} » alors que l origine demandee est « {demande} »',
      valeurs: { permis: permisOrigine.trim(), demande: origine.trim() }
    });
  }

  /* La methode. Les methodes sures n ont pas besoin d etre citees. */
  if (methode && !METHODES_SURES.has(methode)) {
    const permises = listeEntetes(permisMethodes).map(m => m.toUpperCase());
    if (permisMethodes == null) {
      motifs.push({ quoi: 'methode', cle: 'Access-Control-Allow-Methods est absent de la reponse' });
    } else if (!permises.includes('*') && !permises.includes(methode)) {
      motifs.push({
        quoi: 'methode',
        cle: 'la methode {methode} n est pas dans Access-Control-Allow-Methods (« {permises} »)',
        valeurs: { methode, permises: permisMethodes.trim() }
      });
    }
  }

  /* Les entetes. */
  const permisListe = listeEntetes(permisEntetes);
  const joker = permisListe.includes('*');
  const manquants = entetesDemandes.filter(h =>
    !ENTETES_SIMPLES.has(h) && !permisListe.includes(h)
    /* Le joker ne couvre pas Authorization : il faut le nommer. */
    && !(joker && h !== 'authorization'));
  if (manquants.length) {
    /* Le singulier et le pluriel sont deux gabarits distincts : une langue
       ne les accorde pas forcement comme le francais. */
    motifs.push(manquants.length === 1
      ? {
        quoi: 'entetes',
        cle: 'l entete « {entete} » n est pas couvert par Access-Control-Allow-Headers',
        valeurs: { entete: manquants[0] }
      }
      : {
        quoi: 'entetes',
        cle: 'les entetes {liste} ne sont pas couverts par Access-Control-Allow-Headers',
        valeurs: { liste: manquants.map(h => '« ' + h + ' »').join(', ') }
      });
  }

  return {
    autorise: motifs.length === 0,
    motifs,
    details: {
      origine,
      methode,
      entetesDemandes,
      permisOrigine,
      permisMethodes,
      permisEntetes,
      identifiants,
      /* Passe ce delai, le navigateur refera un preflight. Les navigateurs
         plafonnent cette valeur, Firefox a 24 heures. */
      maxAgeSecondes: duree == null ? null : Number(duree)
    }
  };
}

/** Une phrase disant ce que le preflight autorise, ou ce qui bloque. */
export function resumerPreflight(preflight) {
  let verdict;
  try { verdict = verdictPreflight(preflight); } catch { return null; }
  if (verdict.autorise) {
    const duree = verdict.details.maxAgeSecondes;
    return 'preflight accepte pour ' + (verdict.details.methode || 'la methode demandee')
      + (Number.isFinite(duree) && duree > 0 ? ' · valable ' + duree + ' s' : '');
  }
  return 'preflight refuse : ' + verdict.motifs.map(m => m.quoi).join(', ');
}
