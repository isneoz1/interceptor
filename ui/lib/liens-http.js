/* Liens annonces par l en-tete Link — SWIFT (by D4RK)
 *
 * RFC 8288, section 3 : `Link: <cible>; rel="type"; attribut=valeur, …`.
 * Un serveur y annonce ce qu il faut precharger (preload, preconnect), la page
 * suivante d une liste paginee (next, last), la documentation d une
 * depreciation (deprecation, sunset), la version canonique d une ressource…
 *
 * La lecture suit l algorithme de l annexe B, qui n est qu indicatif : la ou
 * il se tait, c est la grammaire normative qui decide. Il ne consomme pas la
 * virgule entre deux liens ; la grammaire (`#link-value`) en fait une liste,
 * on la consomme donc. Et l erratum 5878, verifie, s applique : les
 * parametres en `*` (RFC 8187) agissent sur les attributs de la cible.
 */
import { decoderValeurEtendue } from './entetes-parametres.js';
import { relationLien } from './ref-liens.js';

export const FAITS_LIENS = {
  sansRel: 'lien vers {cible} sans parametre rel : la RFC 8288 l exige (§3.3), le lien est ignore',
  rev: 'parametre rev : la RFC 8288 le deprecie (§3.3) ; une relation inverse s ecrit avec un type de relation propre',
  illisible: 'texte illisible a partir de « {reste} » : la lecture s arrete la (RFC 8288, annexe B.2)',
  etendu: 'valeur etendue {nom} illisible (RFC 8187) : la forme simple est gardee',
  relNonEnregistre: 'type de relation {rel} absent du registre IANA (releve du 8 octobre 2026), et qui n est pas une URI : une relation d extension doit etre une URI absolue (RFC 8288 §2.1.2 et §3.3)'
};

const OWS = /[ \t]/;
function sauter(s, i) { while (i < s.length && OWS.test(s[i])) i++; return i; }

/* Annexe B.4 : une chaine entre guillemets, barres obliques inverses comprises. */
function chaineQuotee(s, i) {
  let sortie = '';
  i++;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      i++;
      if (i >= s.length) return [sortie, i];
      sortie += s[i++];
      continue;
    }
    if (c === '"') return [sortie, i + 1];
    sortie += c;
    i++;
  }
  return [sortie, i];
}

/* Annexe B.3 : `;nom=valeur` jusqu a la virgule suivante ou la fin. */
function parametres(s, i, faits) {
  const sortie = [];
  for (;;) {
    i = sauter(s, i);
    if (s[i] !== ';') return [sortie, i];
    i = sauter(s, i + 1);
    let nom = '';
    while (i < s.length && !/[ \t=;,]/.test(s[i])) nom += s[i++];
    i = sauter(s, i);
    let valeur = '';
    let extension = null;
    if (s[i] === '=') {
      i = sauter(s, i + 1);
      if (s[i] === '"') [valeur, i] = chaineQuotee(s, i);
      else {
        while (i < s.length && s[i] !== ';' && s[i] !== ',') valeur += s[i++];
        valeur = valeur.replace(/[ \t]+$/, '');
      }
      if (nom.endsWith('*')) {
        try { extension = decoderValeurEtendue(valeur).texte; }
        catch { faits.push({ cle: 'etendu', texte: FAITS_LIENS.etendu, valeurs: { nom: nom.toLowerCase() } }); }
      }
    }
    sortie.push({ nom: nom.toLowerCase(), valeur, extension });
    i = sauter(s, i);
    if (s[i] === ',' || i >= s.length) return [sortie, i];
  }
}

function resoudre(reference, base) {
  try { return new URL(reference, base || undefined).href; } catch { return reference; }
}

/**
 * Les liens d un ou plusieurs en-tetes Link.
 *
 * @param valeurs  textes des en-tetes Link (un tableau, ou une seule chaine)
 * @param base     adresse de la reponse : les cibles relatives s y resolvent
 * @returns { liens: [{ rel, cible, brute, contexte, attributs, enregistre }], faits }
 *   `attributs` : [nom, valeur] dans l ordre, `title*` deja decode en `title`.
 */
export function lireLiens(valeurs, base = '') {
  const liens = [];
  const faits = [];
  for (const texte of (Array.isArray(valeurs) ? valeurs : [valeurs])) {
    const s = String(texte == null ? '' : texte);
    let i = 0;
    while (i < s.length) {
      i = sauter(s, i);
      if (i >= s.length) break;
      if (s[i] === ',') { i++; continue; }
      if (s[i] !== '<') {
        faits.push({ cle: 'illisible', texte: FAITS_LIENS.illisible, valeurs: { reste: s.slice(i, i + 24) } });
        break;
      }
      const fin = s.indexOf('>', i + 1);
      if (fin < 0) {
        faits.push({ cle: 'illisible', texte: FAITS_LIENS.illisible, valeurs: { reste: s.slice(i, i + 24) } });
        break;
      }
      const brute = s.slice(i + 1, fin);
      let params;
      [params, i] = parametres(s, fin + 1, faits);
      const cible = resoudre(brute, base);

      const rel = params.find(p => p.nom === 'rel');
      const ancre = params.find(p => p.nom === 'anchor');
      if (params.some(p => p.nom === 'rev')) faits.push({ cle: 'rev', texte: FAITS_LIENS.rev, valeurs: {} });
      if (!rel || !rel.valeur.trim()) {
        faits.push({ cle: 'sansRel', texte: FAITS_LIENS.sansRel, valeurs: { cible } });
        continue;
      }

      /* Etapes 13 et 14 : media, title, title* et type ne comptent qu une fois. */
      const uniques = new Set(['media', 'title', 'title*', 'type']);
      const attributs = [];
      for (const p of params) {
        if (p.nom === 'rel' || p.nom === 'anchor' || p.nom === 'rev') continue;
        if (uniques.has(p.nom) && attributs.some(([n]) => n === p.nom)) continue;
        attributs.push([p.nom, p.extension != null ? p.extension : p.valeur, p.extension != null]);
      }
      /* Etapes 15 et 16 (erratum 5878) : `title*` remplace `title`, decode. */
      const etoiles = attributs.filter(([n, , decode]) => n.endsWith('*') && decode).map(([n]) => n);
      let finals = attributs;
      for (const etoile of etoiles) {
        const simple = etoile.slice(0, -1);
        finals = finals.filter(([n]) => n !== simple).map(a => (a[0] === etoile ? [simple, a[1], true] : a));
      }

      const contexte = ancre ? resoudre(ancre.valeur, base) : (base || null);
      for (const type of rel.valeur.trim().split(/[ \t]+/)) {
        const nom = type.toLowerCase();
        const enregistre = !!relationLien(nom);
        if (!enregistre && !/^[a-z][a-z0-9+.-]*:/i.test(type)) {
          faits.push({ cle: 'relNonEnregistre', texte: FAITS_LIENS.relNonEnregistre, valeurs: { rel: type } });
        }
        liens.push({ rel: nom, cible, brute, contexte, attributs: finals.map(([n, v]) => [n, v]), enregistre });
      }
    }
  }
  return { liens, faits };
}

/** Les valeurs des en-tetes Link d une liste d en-tetes { name, value }. */
export function valeursLink(entetes) {
  return (entetes || []).filter(h => h && String(h.name || '').toLowerCase() === 'link')
    .map(h => String(h.value ?? ''));
}

/* Les relations qui demandent au navigateur d agir avant d en avoir besoin. */
export const RELATIONS_ANTICIPATION = ['preload', 'modulepreload', 'preconnect', 'dns-prefetch', 'prefetch', 'prerender'];

/**
 * Ce qu il est advenu, dans la capture, de chaque ressource annoncee pour
 * etre chargee par avance : combien de requetes vers cette adresse.
 * Seul un fait est rendu — la requete vue ou non — jamais une explication.
 *
 * @param liens   resultat de lireLiens
 * @param urls    adresses capturees (un Map url -> nombre, ou un tableau)
 */
export function suiviAnticipations(liens, urls) {
  const compte = urls instanceof Map ? urls : new Map();
  if (!(urls instanceof Map)) for (const u of urls || []) compte.set(u, (compte.get(u) || 0) + 1);
  return liens.filter(l => l.rel === 'preload' || l.rel === 'modulepreload' || l.rel === 'prefetch')
    .map(l => ({ ...l, requetes: compte.get(l.cible) || 0 }));
}
