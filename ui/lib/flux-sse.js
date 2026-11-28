/* Lire une reponse diffusee au fil de l eau — SWIFT (by D4RK)
 *
 * Deux formes de flux, lues morceau par morceau, tels qu ils arrivent du
 * reseau — une ligne peut etre coupee entre deux morceaux, et meme une fin de
 * ligne CR LF :
 *
 *   - les Server-Sent Events (text/event-stream), selon la norme HTML du
 *     WHATWG, « Interpreting an event stream » ;
 *   - les lignes JSON (NDJSON, JSON Lines), un document par ligne.
 *
 * Regles suivies pour les Server-Sent Events :
 *   - une fin de ligne est CR LF, LF ou CR seul ; un CR en fin de morceau
 *     attend le morceau suivant, qui commence peut-etre par son LF ;
 *   - une marque d ordre d octets (BOM) en tete du flux est ignoree ;
 *   - une ligne vide distribue l evenement en cours ; sans donnees, il ne
 *     l est pas, et son type est oublie ;
 *   - une ligne qui commence par « : » est un commentaire ;
 *   - « champ:valeur » — une espace juste apres les deux-points est retiree ;
 *     une ligne sans deux-points est un champ de valeur vide ;
 *   - data ajoute sa valeur et un saut de ligne, retire a la distribution ;
 *     event nomme le type (message par defaut) ; id fixe le dernier
 *     identifiant, sauf s il contient NUL ; retry ne vaut que s il n est fait
 *     que de chiffres ; tout autre champ est ignore — et compte ;
 *   - a la fin du flux, un evenement sans ligne vide finale n est pas
 *     distribue : le lecteur le dit, au lieu de le perdre en silence.
 */

/** Le lecteur d un flux text/event-stream. */
export function creerLecteurSse() {
  let reste = '';
  let premier = true;
  let crEnAttente = false;
  let donnees = '';
  let aDesDonnees = false;
  let type = '';
  const etat = { dernierId: '', retry: null, commentaires: 0, champsIgnores: 0, distribues: 0 };

  function distribuer(sortie) {
    if (!aDesDonnees) { type = ''; return; }
    const data = donnees.endsWith('\n') ? donnees.substring(0, donnees.length - 1) : donnees;
    etat.distribues++;
    sortie.push({ type: type || 'message', data, id: etat.dernierId, retry: etat.retry, n: etat.distribues });
    donnees = '';
    aDesDonnees = false;
    type = '';
  }

  function ligne(l, sortie) {
    if (l === '') { distribuer(sortie); return; }
    if (l[0] === ':') { etat.commentaires++; return; }
    const k = l.indexOf(':');
    let champ = l;
    let valeur = '';
    if (k >= 0) {
      champ = l.substring(0, k);
      valeur = l.substring(k + 1);
      if (valeur[0] === ' ') valeur = valeur.substring(1);
    }
    if (champ === 'event') type = valeur;
    else if (champ === 'data') { donnees += valeur + '\n'; aDesDonnees = true; }
    else if (champ === 'id') { if (!valeur.includes('\u0000')) etat.dernierId = valeur; }
    else if (champ === 'retry') { if (/^[0-9]+$/.test(valeur)) etat.retry = Number(valeur); }
    else etat.champsIgnores++;
  }

  return {
    etat,
    /** Un morceau de texte du flux : rend les evenements qu il acheve. */
    pousser(texte) {
      let s = String(texte == null ? '' : texte);
      const sortie = [];
      if (premier && s.length) {
        if (s.charCodeAt(0) === 0xfeff) s = s.substring(1);
        premier = false;
      }
      let i = 0;
      if (crEnAttente && s.length) {
        if (s.charCodeAt(0) === 10) i = 1;
        crEnAttente = false;
      }
      let depart = i;
      for (; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c !== 10 && c !== 13) continue;
        ligne(reste + s.substring(depart, i), sortie);
        reste = '';
        if (c === 13) {
          if (i + 1 < s.length) { if (s.charCodeAt(i + 1) === 10) i++; }
          else crEnAttente = true;
        }
        depart = i + 1;
      }
      reste += s.substring(depart);
      return sortie;
    },
    /** La fin du flux : ce qui restait en cours n est pas distribue. */
    finir() {
      const inacheve = aDesDonnees || reste.length > 0;
      return { inacheve, reste };
    }
  };
}

/** Le lecteur d un flux de lignes JSON (NDJSON, JSON Lines). */
export function creerLecteurLignes() {
  let reste = '';
  let n = 0;
  const lire = brut => {
    const texte = brut.endsWith('\r') ? brut.substring(0, brut.length - 1) : brut;
    n++;
    if (!texte.trim()) return { n, ligne: texte, vide: true };
    try { return { n, ligne: texte, json: JSON.parse(texte) }; }
    catch (e) { return { n, ligne: texte, erreur: String((e && e.message) || e) }; }
  };
  return {
    pousser(texte) {
      const s = reste + String(texte == null ? '' : texte);
      const morceaux = s.split('\n');
      reste = morceaux.pop();
      return morceaux.map(lire).filter(l => !l.vide);
    },
    finir() {
      if (!reste.length) return [];
      const derniere = lire(reste);
      reste = '';
      return derniere.vide ? [] : [derniere];
    }
  };
}

/**
 * La forme d un flux d apres son type de contenu : « sse », « lignes » ou
 * « texte » quand rien ne la dit.
 */
export function formeDuFlux(typeContenu) {
  const type = String(typeContenu || '').split(';')[0].trim().toLowerCase();
  if (type === 'text/event-stream') return 'sse';
  if (['application/x-ndjson', 'application/ndjson', 'application/jsonl', 'application/x-jsonlines',
    'application/jsonlines', 'application/json-lines', 'application/stream+json'].includes(type)) return 'lignes';
  return 'texte';
}
