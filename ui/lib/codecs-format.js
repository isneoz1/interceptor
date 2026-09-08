/* Formats structures et echappements — INTERCEPTOR (by NeoZ)
 *
 * JSON, YAML, CSV, XML, listes de proprietes, et les echappements de chaine
 * pour JavaScript, JSON, expressions regulieres et lignes de commande.
 * Fonctions pures : la boite a outils les affiche, les tests les executent
 * hors navigateur.
 */

/* ---------------------------------- JSON ---------------------------------- */
export function jsonJoli(texte) { return JSON.stringify(JSON.parse(String(texte)), null, 2); }
export function jsonCompact(texte) { return JSON.stringify(JSON.parse(String(texte))); }

/** Trie les cles a tous les niveaux : deux reponses deviennent comparables. */
export function jsonTrie(texte) {
  const trier = valeur => {
    if (Array.isArray(valeur)) return valeur.map(trier);
    if (valeur && typeof valeur === 'object') {
      const out = {};
      for (const cle of Object.keys(valeur).sort()) out[cle] = trier(valeur[cle]);
      return out;
    }
    return valeur;
  };
  return JSON.stringify(trier(JSON.parse(String(texte))), null, 2);
}

/** Une ligne par chemin : le plus sur moyen de comparer deux structures. */
export function jsonAplati(texte) {
  const valeur = JSON.parse(String(texte));
  const lignes = [];
  const descendre = (v, chemin) => {
    if (Array.isArray(v)) {
      if (!v.length) return lignes.push(chemin + ' = []');
      v.forEach((x, i) => descendre(x, chemin + '[' + i + ']'));
    } else if (v && typeof v === 'object') {
      const cles = Object.keys(v);
      if (!cles.length) return lignes.push(chemin + ' = {}');
      for (const cle of cles) descendre(v[cle], chemin ? chemin + '.' + cle : cle);
    } else {
      lignes.push(chemin + ' = ' + JSON.stringify(v));
    }
  };
  descendre(valeur, '');
  return lignes.join('\n');
}

/** JSON sur une ligne par enregistrement (JSON Lines) a partir d un tableau. */
export function jsonVersLignes(texte) {
  const valeur = JSON.parse(String(texte));
  if (!Array.isArray(valeur)) throw new Error('JSON Lines attend un tableau');
  return valeur.map(v => JSON.stringify(v)).join('\n');
}

export function lignesVersJson(texte) {
  const lignes = String(texte).split(/\r?\n/).filter(l => l.trim());
  return JSON.stringify(lignes.map((l, i) => {
    try { return JSON.parse(l); }
    catch { throw new Error('ligne ' + (i + 1) + ' illisible en JSON'); }
  }), null, 2);
}

/* ---------------------------------- YAML ---------------------------------- */
/**
 * Emission YAML volontairement prudente : toutes les chaines sont ecrites
 * entre guillemets doubles, ce qui est toujours valide et ne peut pas changer
 * le sens d une valeur (« yes », « 1.0 », « null » restent du texte).
 */
export function jsonVersYaml(texte) {
  const valeur = JSON.parse(String(texte));
  const scalaire = v => v === null ? 'null'
    : typeof v === 'string' ? JSON.stringify(v)
    : Array.isArray(v) ? '[]'
    : typeof v === 'object' ? '{}'
    : String(v);
  const plein = v => v !== null && typeof v === 'object'
    && (Array.isArray(v) ? v.length : Object.keys(v).length) > 0;

  const lignes = (v, marge) => {
    const out = [];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (!plein(item)) { out.push(marge + '- ' + scalaire(item)); continue; }
        const sous = lignes(item, marge + '  ');
        out.push(marge + '- ' + sous[0].slice(marge.length + 2));
        for (let i = 1; i < sous.length; i++) out.push(sous[i]);
      }
      return out;
    }
    for (const [cle, val] of Object.entries(v)) {
      if (!plein(val)) { out.push(marge + JSON.stringify(cle) + ': ' + scalaire(val)); continue; }
      out.push(marge + JSON.stringify(cle) + ':');
      out.push(...lignes(val, marge + '  '));
    }
    return out;
  };

  if (!plein(valeur)) return scalaire(valeur);
  return lignes(valeur, '').join('\n');
}

/* ----------------------------------- CSV ---------------------------------- */
/** Lecture CSV conforme au RFC 4180 : guillemets doubles, champs multilignes. */
export function lireCsv(texte, separateur = ',') {
  const s = String(texte);
  const lignes = [];
  let champ = '', ligne = [], dansGuillemets = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (s[i + 1] === '"') { champ += '"'; i++; }
        else dansGuillemets = false;
      } else champ += c;
      continue;
    }
    if (c === '"') { dansGuillemets = true; continue; }
    if (c === separateur) { ligne.push(champ); champ = ''; continue; }
    if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; continue; }
    if (c === '\r') continue;
    champ += c;
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes;
}

export function csvVersJson(texte, separateur = ',') {
  const lignes = lireCsv(texte, separateur).filter(l => l.length && !(l.length === 1 && l[0] === ''));
  if (!lignes.length) return '[]';
  const entetes = lignes[0];
  const out = lignes.slice(1).map(ligne => {
    const objet = {};
    entetes.forEach((nom, i) => { objet[nom || 'colonne' + (i + 1)] = ligne[i] === undefined ? '' : ligne[i]; });
    return objet;
  });
  return JSON.stringify(out, null, 2);
}

export function jsonVersCsv(texte, separateur = ',') {
  const valeur = JSON.parse(String(texte));
  const tableau = Array.isArray(valeur) ? valeur : [valeur];
  const colonnes = [];
  for (const ligne of tableau) {
    if (!ligne || typeof ligne !== 'object') throw new Error('le CSV attend un tableau d objets');
    for (const cle of Object.keys(ligne)) if (!colonnes.includes(cle)) colonnes.push(cle);
  }
  const echapper = v => {
    const s = v === null || v === undefined ? ''
      : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /["\r\n]/.test(s) || s.includes(separateur) ? '"' + s.split('"').join('""') + '"' : s;
  };
  return [colonnes.map(echapper).join(separateur)]
    .concat(tableau.map(ligne => colonnes.map(c => echapper(ligne[c])).join(separateur)))
    .join('\n');
}

/* ----------------------------------- XML ---------------------------------- */
/** Mise en forme XML ou HTML : une balise par ligne, indentation par niveau. */
export function xmlJoli(texte) {
  const s = String(texte).replace(/>\s+</g, '><').trim();
  if (!s) return '';
  const jetons = s.split(/(<[^>]*>)/).filter(j => j !== '');
  const AUTONOMES = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const lignes = [];
  let niveau = 0;
  for (const jeton of jetons) {
    if (!jeton.startsWith('<')) {
      const contenu = jeton.trim();
      if (contenu) lignes.push('  '.repeat(niveau) + contenu);
      continue;
    }
    const nom = (jeton.match(/^<\/?\s*([a-zA-Z0-9_:.-]+)/) || [])[1] || '';
    const fermante = jeton.startsWith('</');
    const autonome = jeton.endsWith('/>') || jeton.startsWith('<?') || jeton.startsWith('<!')
      || AUTONOMES.has(nom.toLowerCase());
    if (fermante) niveau = Math.max(0, niveau - 1);
    lignes.push('  '.repeat(niveau) + jeton);
    if (!fermante && !autonome) niveau++;
  }
  return lignes.join('\n');
}

/** Retire les balises et rend le texte visible : lecture rapide d une reponse. */
export function xmlVersTexte(texte) {
  return String(texte)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ------------------------------ Echappements ------------------------------ */
/** Chaine JavaScript prete a coller, guillemets compris. */
export function echapperJs(texte) {
  const s = String(texte);
  let out = '';
  for (const c of s) {
    const code = c.codePointAt(0);
    if (c === '\\') out += '\\\\';
    else if (c === "'") out += "\\'";
    else if (c === '\n') out += '\\n';
    else if (c === '\r') out += '\\r';
    else if (c === '\t') out += '\\t';
    else if (code < 32 || code === 127) out += '\\x' + code.toString(16).padStart(2, '0');
    else out += c;
  }
  return "'" + out + "'";
}

export function desechapperJs(texte) {
  const s = String(texte).trim().replace(/^['"`]|['"`]$/g, '');
  return s
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (e, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (e, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (e, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\(['"`\\/])/g, '$1');
}

export function echapperJson(texte) { return JSON.stringify(String(texte)); }

export function desechapperJson(texte) {
  const brut = String(texte).trim();
  const cite = brut.startsWith('"') ? brut : JSON.stringify(brut).slice(0, 1) + brut + '"';
  try { return JSON.parse(cite); }
  catch { throw new Error('chaine JSON invalide'); }
}

/** Neutralise les caracteres speciaux : le texte devient un motif litteral. */
export function echapperRegex(texte) {
  return String(texte).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Argument sur pour un interpreteur POSIX : tout est litteral entre apostrophes. */
export function echapperShell(texte) {
  return "'" + String(texte).split("'").join("'" + '\\' + "''") + "'";
}

/** Argument sur pour PowerShell : l apostrophe se double. */
export function echapperPowerShell(texte) {
  return "'" + String(texte).split("'").join("''") + "'";
}
