/* Requetes enregistrees et variables — SWIFT (by D4RK)
 *
 * Ce qu on attend d un client d API : garder une requete sous un nom, la
 * reprendre plus tard, et ecrire {{base}} ou {{jeton}} a la place de ce qui
 * change d un environnement a l autre.
 *
 *   - les variables s ecrivent une par ligne, « nom = valeur » (ou « nom:
 *     valeur ») ; une ligne qui commence par # est un commentaire ;
 *   - {{nom}} est remplace a l envoi, dans l adresse, les en-tetes et le
 *     corps ; une variable inconnue reste telle quelle, et elle est nommee ;
 *   - une collection s exporte en JSON et se reimporte ; une collection
 *     Postman (schemas v2.0 et v2.1) s importe aussi, dossiers compris.
 */

/** Les variables d un texte « nom = valeur ». */
export function lireVariables(texte) {
  const table = new Map();
  for (const brute of String(texte == null ? '' : texte).split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#')) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_.-]*)\s*[=:]\s?(.*)$/.exec(ligne);
    if (m) table.set(m[1], m[2]);
  }
  return table;
}

/** Remplace {{nom}} ; rend le texte et les noms restes sans valeur. */
export function remplacerVariables(texte, variables) {
  const manquantes = new Set();
  const sortie = String(texte == null ? '' : texte).replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g, (tout, nom) => {
    if (variables.has(nom)) return variables.get(nom);
    manquantes.add(nom);
    return tout;
  });
  return { texte: sortie, manquantes };
}

function requetePropre(r) {
  const methode = String(r.methode || 'GET').toUpperCase();
  return {
    nom: String(r.nom || '').trim() || 'sans nom',
    methode: /^[A-Z]+$/.test(methode) ? methode : 'GET',
    url: String(r.url || ''),
    entetes: String(r.entetes || ''),
    corps: String(r.corps || '')
  };
}

/** Une collection au format de SWIFT, en JSON lisible. */
export function ecrireCollection(requetes, variables = '') {
  return JSON.stringify({ format: 'swift-collection', version: 1, variables: String(variables || ''),
    requetes: (requetes || []).map(requetePropre) }, null, 2);
}

/* Une requete Postman : une adresse en texte ou en objet, des en-tetes
   desactivables, un corps brut, urlencoded ou multipart. */
function depuisPostman(nom, req) {
  if (typeof req === 'string') return requetePropre({ nom, methode: 'GET', url: req });
  if (!req || typeof req !== 'object') return null;
  let url = '';
  if (typeof req.url === 'string') url = req.url;
  else if (req.url && typeof req.url === 'object') {
    if (typeof req.url.raw === 'string') url = req.url.raw;
    else {
      const hote = Array.isArray(req.url.host) ? req.url.host.join('.') : String(req.url.host || '');
      const chemin = Array.isArray(req.url.path) ? req.url.path.join('/') : String(req.url.path || '');
      url = (req.url.protocol ? req.url.protocol + '://' : '') + hote + (chemin ? '/' + chemin : '');
    }
  }
  const entetes = (Array.isArray(req.header) ? req.header : [])
    .filter(h => h && h.key && !h.disabled).map(h => h.key + ': ' + (h.value == null ? '' : h.value));
  let corps = '';
  const b = req.body;
  if (b && typeof b === 'object' && !b.disabled) {
    if (b.mode === 'raw') corps = String(b.raw || '');
    else if (b.mode === 'urlencoded' && Array.isArray(b.urlencoded)) {
      corps = b.urlencoded.filter(p => p && p.key && !p.disabled)
        .map(p => encodeURIComponent(p.key) + '=' + encodeURIComponent(p.value == null ? '' : p.value)).join('&');
      if (!entetes.some(l => /^content-type\s*:/i.test(l))) entetes.push('Content-Type: application/x-www-form-urlencoded');
    } else if (b.mode === 'graphql' && b.graphql) {
      corps = JSON.stringify({ query: String(b.graphql.query || ''), variables: b.graphql.variables ? safeJson(b.graphql.variables) : undefined });
      if (!entetes.some(l => /^content-type\s*:/i.test(l))) entetes.push('Content-Type: application/json');
    } else if (b.mode === 'formdata' && Array.isArray(b.formdata)) {
      corps = b.formdata.filter(p => p && p.key && !p.disabled && p.type !== 'file')
        .map(p => encodeURIComponent(p.key) + '=' + encodeURIComponent(p.value == null ? '' : p.value)).join('&');
    }
  }
  return requetePropre({ nom, methode: req.method, url, entetes: entetes.join('\n'), corps });
}

function safeJson(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

function parcourirPostman(elements, chemin, sortie) {
  for (const it of Array.isArray(elements) ? elements : []) {
    if (!it || typeof it !== 'object') continue;
    const nom = (chemin ? chemin + ' / ' : '') + String(it.name || 'sans nom');
    if (Array.isArray(it.item)) parcourirPostman(it.item, nom, sortie);
    else if (it.request) { const r = depuisPostman(nom, it.request); if (r) sortie.push(r); }
  }
}

/**
 * Lit une collection : celle de SWIFT, ou une collection Postman.
 * @returns { format: 'swift'|'postman', requetes, variables (texte) }
 */
export function lireCollection(texte) {
  let json;
  try { json = JSON.parse(String(texte == null ? '' : texte)); }
  catch { throw new Error('collection illisible : JSON attendu'); }
  if (json && json.format === 'swift-collection' && Array.isArray(json.requetes)) {
    return { format: 'swift', requetes: json.requetes.map(requetePropre), variables: String(json.variables || '') };
  }
  if (json && json.info && Array.isArray(json.item)) {
    const requetes = [];
    parcourirPostman(json.item, '', requetes);
    const variables = (Array.isArray(json.variable) ? json.variable : [])
      .filter(v => v && v.key && !v.disabled).map(v => v.key + ' = ' + (v.value == null ? '' : v.value)).join('\n');
    return { format: 'postman', requetes, variables };
  }
  throw new Error('ni collection SWIFT, ni collection Postman (info et item attendus)');
}
