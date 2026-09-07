/* Motifs, chemins et selecteurs — INTERCEPTOR (by D4RK)
 *
 * Trois facons d aller chercher une valeur dans un texte : une expression
 * reguliere toute prete, un chemin dans du JSON, un selecteur dans du HTML.
 *
 * Les motifs sont donnes tels qu ils sont : ils reconnaissent une forme, ils
 * ne valident rien. Une adresse peut avoir la bonne forme sans exister.
 */

/* ----------------------------- Motifs courants ---------------------------- */
const M = [
  ['Adresse de courriel', "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
    'Forme seulement : la seule preuve d existence reste l envoi.'],
  ['URL http ou https', "https?://[^\\s\"'<>]+", 'Toute adresse web dans un texte.'],
  ['Nom de domaine', "\\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,}\\b",
    'Un hote ecrit en clair, sans schema.'],
  ['Adresse IPv4', "\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b",
    'Chaque octet est borne a 255 : les fausses adresses sont ecartees.'],
  ['Adresse IPv6', "\\b(?:[0-9A-Fa-f]{1,4}:){2,7}[0-9A-Fa-f]{1,4}\\b",
    'Forme abregee comprise ; a confirmer dans l onglet Adresse IP.'],
  ['Adresse materielle (MAC)', "\\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\\b", 'Six octets separes.'],
  ['UUID', "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\b",
    'Toutes versions confondues.'],
  ['Jeton JWT', "\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]*",
    'Un entete JSON encode commence toujours par « eyJ ».'],
  ['Entete Authorization', "[Aa]uthorization:\\s*([Bb]earer|[Bb]asic|[Dd]igest)\\s+\\S+",
    'A employer sur un bloc d entetes colle.'],
  ['Cle privee au format PEM', "-----BEGIN [A-Z ]*PRIVATE KEY-----",
    'Une cle privee ne devrait jamais circuler dans une reponse.'],
  ['Empreinte hexadecimale', "\\b[0-9a-fA-F]{32,128}\\b", 'MD5, SHA-1, SHA-256 et suivantes.'],
  ['Chaine base64 longue', "\\b[A-Za-z0-9+/]{40,}={0,2}",
    'Souvent un jeton, une image en ligne ou un corps encode.'],
  ['Date ISO 8601', "\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}(:\\d{2})?(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})?",
    'Le format que rendent la plupart des API.'],
  ['Horodatage Unix (10 chiffres)', "\\b1[0-9]{9}\\b", 'Secondes depuis 1970, de 2001 a 2033.'],
  ['Version semantique', "\\bv?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?\\b", 'major.minor.patch.'],
  ['Couleur hexadecimale', "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b", 'Dans une feuille de style.'],
  ['Numero de carte (forme)', "\\b(?:\\d[ -]?){13,19}\\b",
    'Forme seulement. La cle de Luhn, elle, se verifie : voir l outil dedie.'],
  ['Parametre de requete', "[?&]([A-Za-z0-9_.-]+)=([^&#\\s]*)", 'Couples cle=valeur dans une URL.'],
  ['Balise HTML', "<[a-zA-Z][^>]*>", 'Ouvre ou ferme un element.'],
  ['Commentaire HTML', "<!--[\\s\\S]*?-->", 'Un commentaire oublie livre parfois une adresse interne.']
];

export const MOTIFS = M.map(([nom, motif, note]) => ({ nom, motif, note }));

/* ------------------------------ Luhn ------------------------------------- */
/**
 * Cle de Luhn : le seul controle verifiable sur un numero de carte ou d IMEI.
 * Une cle juste ne rend pas le numero valide, elle rend la faute de frappe
 * improbable — c est tout ce qu on peut affirmer.
 */
export function luhn(valeur) {
  const chiffres = String(valeur).replace(/[\s-]/g, '');
  if (!/^\d{2,}$/.test(chiffres)) throw new Error('deux chiffres au moins sont attendus');
  let somme = 0, double = false;
  for (let i = chiffres.length - 1; i >= 0; i--) {
    let n = chiffres.charCodeAt(i) - 48;
    if (double) { n *= 2; if (n > 9) n -= 9; }
    somme += n;
    double = !double;
  }
  return { chiffres: chiffres.length, somme, valide: somme % 10 === 0 };
}

/* ------------------------------ Chemin JSON ------------------------------- */
/**
 * Chemin a la maniere de JSONPath, volontairement reduit a ce qui se verifie :
 * `$.a.b`, `$.a[0]`, `$.a[*]`, et `..cle` pour chercher une cle a tout niveau.
 */
export function chercherJson(valeur, chemin) {
  const objet = typeof valeur === 'string' ? JSON.parse(valeur) : valeur;
  const brut = String(chemin || '').trim();
  if (!brut || brut === '$') return [{ chemin: '$', valeur: objet }];

  if (brut.startsWith('$..') || brut.startsWith('..')) {
    const cle = brut.replace(/^\$?\.\./, '');
    if (!cle) throw new Error('cle attendue apres « .. »');
    return descendre(objet, cle, '$');
  }

  let courant = [{ chemin: '$', valeur: objet }];
  const etapes = brut.replace(/^\$/, '').match(/\.[A-Za-z0-9_-]+|\[[^\]]+\]/g);
  if (!etapes) throw new Error('chemin illisible : ' + brut);

  for (const etape of etapes) {
    const suivant = [];
    for (const { chemin: c, valeur: v } of courant) {
      if (v == null) continue;
      if (etape.startsWith('.')) {
        const cle = etape.slice(1);
        if (Object.prototype.hasOwnProperty.call(v, cle)) suivant.push({ chemin: c + '.' + cle, valeur: v[cle] });
      } else {
        const dedans = etape.slice(1, -1).replace(/^["']|["']$/g, '');
        if (dedans === '*') {
          const entrees = Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v);
          for (const [k, x] of entrees) suivant.push({ chemin: c + '[' + k + ']', valeur: x });
        } else if (Object.prototype.hasOwnProperty.call(v, dedans)) {
          suivant.push({ chemin: c + '[' + dedans + ']', valeur: v[dedans] });
        }
      }
    }
    courant = suivant;
  }
  return courant;
}

function descendre(valeur, cle, chemin, sorties = []) {
  if (valeur == null || typeof valeur !== 'object') return sorties;
  const entrees = Array.isArray(valeur)
    ? valeur.map((v, i) => [String(i), v, chemin + '[' + i + ']'])
    : Object.entries(valeur).map(([k, v]) => [k, v, chemin + '.' + k]);
  for (const [k, v, c] of entrees) {
    if (k === cle) sorties.push({ chemin: c, valeur: v });
    descendre(v, cle, c, sorties);
  }
  return sorties;
}

/** Tous les chemins d un document : la carte complete d une reponse JSON. */
export function cheminsJson(valeur, limite = 500) {
  const objet = typeof valeur === 'string' ? JSON.parse(valeur) : valeur;
  const sorties = [];
  const marcher = (v, chemin) => {
    if (sorties.length >= limite) return;
    if (v !== null && typeof v === 'object') {
      const entrees = Array.isArray(v)
        ? v.map((x, i) => [chemin + '[' + i + ']', x])
        : Object.entries(v).map(([k, x]) => [chemin + '.' + k, x]);
      if (!entrees.length) sorties.push({ chemin, type: Array.isArray(v) ? 'tableau vide' : 'objet vide', valeur: '' });
      for (const [c, x] of entrees) marcher(x, c);
    } else {
      sorties.push({ chemin, type: v === null ? 'null' : typeof v, valeur: String(v) });
    }
  };
  marcher(objet, '$');
  return sorties;
}

/* ------------------------------- Selecteurs -------------------------------- */
/** Le moteur de la page sait analyser HTML et XML : on s en sert, sans rien reecrire. */
export function selecteursDisponibles() {
  return typeof DOMParser === 'function';
}

/**
 * Applique un selecteur CSS a un document HTML ou XML colle. Rend le texte et
 * les attributs de chaque element trouve.
 */
export function selecteurCss(source, selecteur, limite = 200) {
  if (!selecteursDisponibles()) throw new Error('DOMParser indisponible dans ce contexte');
  const doc = new DOMParser().parseFromString(String(source), 'text/html');
  const trouves = [...doc.querySelectorAll(String(selecteur))].slice(0, limite);
  return trouves.map(n => ({
    balise: n.tagName.toLowerCase(),
    texte: (n.textContent || '').trim().slice(0, 500),
    attributs: [...n.attributes].map(a => a.name + '=' + a.value).join('  '),
    html: n.outerHTML.slice(0, 500)
  }));
}

/** Meme chose avec XPath, pour ce que CSS ne sait pas exprimer. */
export function selecteurXpath(source, expression, limite = 200) {
  if (!selecteursDisponibles() || typeof document === 'undefined' || !document.evaluate) {
    throw new Error('XPath indisponible dans ce contexte');
  }
  const doc = new DOMParser().parseFromString(String(source), 'text/html');
  const resultat = doc.evaluate(String(expression), doc, null, 5, null);   // ordered iterator
  const sorties = [];
  let noeud = resultat.iterateNext();
  while (noeud && sorties.length < limite) {
    sorties.push({
      type: noeud.nodeType === 1 ? 'element' : noeud.nodeType === 2 ? 'attribut' : 'texte',
      nom: noeud.nodeName,
      valeur: (noeud.nodeType === 1 ? noeud.textContent : noeud.nodeValue || '').trim().slice(0, 500)
    });
    noeud = resultat.iterateNext();
  }
  return sorties;
}
