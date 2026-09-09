/* Assainissement d un export — INTERCEPTOR (by NeoZ)
 *
 * Un fichier HAR est fait pour etre partage : joint a un ticket, envoye a un
 * collegue, depose sur un outil d analyse. Il contient pourtant tout ce que le
 * navigateur a envoye — l entete Authorization, les cookies de session, les
 * cles d API glissees dans une URL. Exporter et partager, c est divulguer.
 *
 * Ce module produit une copie masquee. Il ne remplace pas l export fidele, qui
 * reste necessaire pour rejouer une capture : il s ajoute a cote, et c est
 * l operateur qui choisit lequel il partage.
 *
 * Ce qui est masque :
 *   - les entetes de porteur de secret, par leur nom (Authorization, Cookie,
 *     Set-Cookie, X-Api-Key et les autres)
 *   - les parametres d URL dont le nom trahit un secret (token, api_key…)
 *   - tout ce que reconnaissent les MOTIFS de l analyseur, ou qu il se trouve,
 *     y compris au milieu d un corps de reponse
 *
 * Les memes motifs que l analyseur : ce qu il signale comme secret est
 * exactement ce que l export masque. Deux listes auraient diverge.
 */
import { SECRET_PATTERNS } from '../core/secrets.js';

/* Ces entetes portent un secret par nature : leur valeur entiere disparait,
   sans chercher a savoir a quoi elle ressemble. */
const ENTETES_SECRETES = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'set-cookie',
  'x-api-key', 'x-auth-token', 'x-access-token', 'x-csrf-token',
  'x-xsrf-token', 'x-session-token', 'api-key', 'auth-token',
  'x-amz-security-token', 'x-goog-api-key', 'authentication'
]);

/* Un parametre dont le NOM annonce un secret : sa valeur part, quelle qu elle
   soit. On vise le nom entier ou un mot, pas une sous-chaine au hasard, pour
   ne pas masquer « nonetoken » ou « tokenizer ». */
const PARAM_SECRET =
  /(^|[_.-])(token|api[_.-]?key|apikey|secret|password|passwd|pwd|auth|access[_.-]?token|refresh[_.-]?token|id[_.-]?token|session|sig|signature|credential|client[_.-]?secret)($|[_.-])/i;

const MARQUE = '[masque par INTERCEPTOR]';

/**
 * Masque une valeur en gardant de quoi la reconnaitre sans la reveler : sa
 * longueur, et assez de debut pour identifier de quel jeton il s agit.
 */
function masquer(valeur) {
  const s = String(valeur == null ? '' : valeur);
  if (!s) return s;
  if (s.length <= 8) return MARQUE;
  return s.slice(0, 4) + '… ' + MARQUE + ' (' + s.length + ')';
}

/** Remplace, dans un texte libre, tout ce que les motifs reconnaissent. */
function masquerDansTexte(texte, compte) {
  let sortie = String(texte == null ? '' : texte);
  if (!sortie) return sortie;

  for (const [motif] of SECRET_PATTERNS) {
    /* Les motifs de l analyseur portent le drapeau global et gardent donc un
       lastIndex entre deux usages : on repart d une expression neuve pour que
       le resultat ne depende pas de l ordre des appels. */
    const re = new RegExp(motif.source, motif.flags.includes('g') ? motif.flags : motif.flags + 'g');
    sortie = sortie.replace(re, trouve => { compte.n++; return masquer(trouve); });
  }
  return sortie;
}

/** Masque les valeurs d une liste d entetes HAR : [{ name, value }]. */
function entetes(liste, compte) {
  return (liste || []).map(h => {
    const nom = String(h.name || '').toLowerCase();
    if (ENTETES_SECRETES.has(nom)) {
      compte.n++;
      return { ...h, value: masquer(h.value) };
    }
    return { ...h, value: masquerDansTexte(h.value, compte) };
  });
}

/** Masque les valeurs d une liste de parametres HAR : [{ name, value }]. */
function parametres(liste, compte) {
  return (liste || []).map(p => {
    if (PARAM_SECRET.test(String(p.name || ''))) {
      compte.n++;
      return { ...p, value: masquer(p.value) };
    }
    return { ...p, value: masquerDansTexte(p.value, compte) };
  });
}

/** Masque les parametres de requete a l interieur d une URL. */
function url(brute, compte) {
  const texte = String(brute == null ? '' : brute);
  const coupe = texte.indexOf('?');
  if (coupe < 0) return masquerDansTexte(texte, compte);

  const base = texte.slice(0, coupe);
  const fin = texte.slice(coupe + 1);
  /* On decoupe a la main plutot qu avec URLSearchParams : celui-ci reencode
     la chaine, et un export doit rester fidele a ce qui est passe sur le fil. */
  const morceaux = fin.split('&').map(couple => {
    const egal = couple.indexOf('=');
    if (egal < 0) return couple;
    const nom = couple.slice(0, egal);
    const valeur = couple.slice(egal + 1);
    if (PARAM_SECRET.test(decodeURIComponent(nom).replace(/\+/g, ' '))) {
      compte.n++;
      return nom + '=' + encodeURIComponent(masquer(decodeURIComponent(valeur)));
    }
    return nom + '=' + valeur;
  });
  return masquerDansTexte(base, compte) + '?' + morceaux.join('&');
}

/** Masque les cookies d une entree HAR : [{ name, value, ... }]. */
function cookies(liste, compte) {
  return (liste || []).map(c => {
    compte.n++;
    return { ...c, value: masquer(c.value) };
  });
}

/**
 * Rend une copie assainie d un HAR, sans toucher a l original.
 *
 * @returns { har, masques } — `masques` compte les valeurs remplacees, pour
 *          que l interface puisse le dire plutot que de laisser croire que
 *          rien n a ete trouve.
 */
export function assainirHar(har) {
  const compte = { n: 0 };
  const entrees = ((har && har.log && har.log.entries) || []).map(entree => {
    const requete = entree.request || {};
    const reponse = entree.response || {};

    const copie = {
      ...entree,
      request: {
        ...requete,
        url: url(requete.url, compte),
        headers: entetes(requete.headers, compte),
        queryString: parametres(requete.queryString, compte),
        cookies: cookies(requete.cookies, compte)
      },
      response: {
        ...reponse,
        headers: entetes(reponse.headers, compte),
        cookies: cookies(reponse.cookies, compte)
      }
    };

    /* Les corps : un jeton se glisse aussi bien dans un JSON de reponse que
       dans un entete. On ne masque que ce que les motifs reconnaissent, pour
       ne pas rendre le corps inexploitable. */
    if (requete.postData && requete.postData.text != null) {
      copie.request.postData = {
        ...requete.postData,
        text: masquerDansTexte(requete.postData.text, compte)
      };
      if (requete.postData.params) {
        copie.request.postData.params = parametres(requete.postData.params, compte);
      }
    }
    if (reponse.content && reponse.content.text != null) {
      copie.response.content = {
        ...reponse.content,
        text: masquerDansTexte(reponse.content.text, compte)
      };
    }
    return copie;
  });

  return {
    har: {
      ...har,
      log: {
        ...(har && har.log),
        /* Le fichier dit lui-meme qu il a ete assaini : sans cela, personne ne
           peut savoir si les valeurs manquantes ont ete masquees ou n ont
           jamais existe. */
        comment: [(har && har.log && har.log.comment) || '',
          'Assaini par INTERCEPTOR : ' + compte.n + ' valeur(s) masquee(s).']
          .filter(Boolean).join(' '),
        entries: entrees
      }
    },
    masques: compte.n
  };
}
