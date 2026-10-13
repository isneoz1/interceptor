/* Formats structures et echappements — SWIFT (by NeoZ)
 *
 * JSON, YAML, CSV, XML, listes de proprietes, et les echappements de chaine
 * pour JavaScript, JSON, expressions regulieres et lignes de commande.
 * Fonctions pures : la boite a outils les affiche, les tests les executent
 * hors navigateur.
 *
 * Le JSON passe par lib/json-exact.js : un nombre ou une chaine ressort tel
 * qu il est entre. JSON.parse arrondissait les entiers au-dela de 2^53
 * (1234567890123456789 ressortait 1234567890123456800) et ne gardait qu une
 * cle sur deux jumelles.
 */
import { lireJsonExact, ecrireJsonExact, trierClesJson, cheminsJson } from './json-exact.js';

/* ---------------------------------- JSON ---------------------------------- */
export function jsonJoli(texte) { return ecrireJsonExact(lireJsonExact(String(texte)), '  '); }
export function jsonCompact(texte) { return ecrireJsonExact(lireJsonExact(String(texte)), ''); }

/** Trie les cles a tous les niveaux : deux reponses deviennent comparables. */
export function jsonTrie(texte) { return ecrireJsonExact(trierClesJson(lireJsonExact(String(texte))), '  '); }

/** Une ligne par chemin : le plus sur moyen de comparer deux structures. */
export function jsonAplati(texte) { return cheminsJson(lireJsonExact(String(texte))).join('\n'); }

/** JSON sur une ligne par enregistrement (JSON Lines) a partir d un tableau. */
export function jsonVersLignes(texte) {
  const arbre = lireJsonExact(String(texte));
  if (arbre.type !== 'tableau') throw new Error('JSON Lines attend un tableau');
  return arbre.elements.map(e => ecrireJsonExact(e, '')).join('\n');
}

export function lignesVersJson(texte) {
  const lignes = String(texte).split(/\r?\n/).filter(l => l.trim());
  const elements = lignes.map((l, i) => {
    try { return lireJsonExact(l); }
    catch { throw new Error('ligne ' + (i + 1) + ' illisible en JSON'); }
  });
  return ecrireJsonExact({ type: 'tableau', elements }, '  ');
}

/* ---------------------------------- YAML ---------------------------------- */
/**
 * Emission YAML volontairement prudente : toutes les chaines sont ecrites
 * entre guillemets doubles, ce qui est toujours valide et ne peut pas changer
 * le sens d une valeur (« yes », « 1.0 », « null » restent du texte).
 */
export function jsonVersYaml(texte) {
  const racine = lireJsonExact(String(texte));
  /* Un lexeme JSON est aussi un scalaire YAML 1.2 valide : une chaine entre
     guillemets doubles garde ses echappements, un nombre son ecriture. */
  const scalaire = n => (n.type === 'objet' ? '{}' : n.type === 'tableau' ? '[]' : n.brut);
  const plein = n => (n.type === 'objet' ? n.membres.length : n.type === 'tableau' ? n.elements.length : 0) > 0;

  const lignes = (n, marge) => {
    if (marge.length > 2000) throw new Error('YAML : plus de mille niveaux d imbrication, chacun ajoute deux espaces de marge');
    const out = [];
    if (n.type === 'tableau') {
      for (const item of n.elements) {
        if (!plein(item)) { out.push(marge + '- ' + scalaire(item)); continue; }
        const sous = lignes(item, marge + '  ');
        out.push(marge + '- ' + sous[0].slice(marge.length + 2));
        for (let i = 1; i < sous.length; i++) out.push(sous[i]);
      }
      return out;
    }
    for (const m of n.membres) {
      if (!plein(m.valeur)) { out.push(marge + m.brutCle + ': ' + scalaire(m.valeur)); continue; }
      out.push(marge + m.brutCle + ':');
      out.push(...lignes(m.valeur, marge + '  '));
    }
    return out;
  };

  if (!plein(racine)) return scalaire(racine);
  return lignes(racine, '').join('\n');
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
  /* Un objet sans prototype : une colonne « __proto__ » reste une colonne. Deux
     colonnes de meme nom gardent leurs deux valeurs, dans un tableau. */
  const out = lignes.slice(1).map(ligne => {
    const objet = Object.create(null);
    entetes.forEach((nom, i) => {
      const cle = nom || 'colonne' + (i + 1);
      const valeur = ligne[i] === undefined ? '' : ligne[i];
      if (!Object.prototype.hasOwnProperty.call(objet, cle)) objet[cle] = valeur;
      else if (Array.isArray(objet[cle])) objet[cle].push(valeur);
      else objet[cle] = [objet[cle], valeur];
    });
    return objet;
  });
  return JSON.stringify(out, null, 2);
}

export function jsonVersCsv(texte, separateur = ',') {
  const racine = lireJsonExact(String(texte));
  const lignes = racine.type === 'tableau' ? racine.elements : [racine];
  /* Une ligne est un objet (colonnes nommees) ou un tableau (colonnes
     numerotees, comme Object.keys les nommait). */
  const membres = ligne => {
    if (ligne.type === 'objet') return ligne.membres;
    if (ligne.type === 'tableau') return ligne.elements.map((valeur, k) => ({ cle: String(k), valeur }));
    throw new Error('le CSV attend un tableau d objets');
  };
  const colonnes = [];
  const vues = new Set();
  for (const ligne of lignes) {
    for (const m of membres(ligne)) if (!vues.has(m.cle)) { vues.add(m.cle); colonnes.push(m.cle); }
  }
  const texteDe = n => (!n ? ''
    : n.type === 'chaine' ? n.valeur
      : n.type === 'litteral' && n.brut === 'null' ? ''
        : n.type === 'objet' || n.type === 'tableau' ? ecrireJsonExact(n, '') : n.brut);
  const echapper = s => (/["\r\n]/.test(s) || s.includes(separateur) ? '"' + s.split('"').join('""') + '"' : s);
  /* Deux cles jumelles : la derniere, comme JSON.parse. */
  const cellules = ligne => {
    const parCle = new Map();
    for (const m of membres(ligne)) parCle.set(m.cle, m.valeur);
    return colonnes.map(c => echapper(texteDe(parCle.get(c)))).join(separateur);
  };
  return [colonnes.map(echapper).join(separateur)].concat(lignes.map(cellules)).join('\n');
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
