/* Aides partagees de generation de code — INTERCEPTOR (by NeoZ)
 *
 * Tout le monde tape la meme requete dans un langage different : ce module
 * porte les briques communes (entetes utilisables, corps, echappement par
 * langage) reutilisees par tous les generateurs. Rien n est execute ici.
 */

export const NL = String.fromCharCode(10);

/* Entetes que l on n emet jamais dans le code genere : elles sont recalculees
   par le client HTTP et fausseraient la requete si on les recopiait. */
export const SKIP_HEADERS = new Set(['content-length', 'host', 'connection', 'transfer-encoding']);

export function target(rec) { return rec.finalUrl || rec.url; }

export function usableHeaders(rec) {
  return (rec.requestHeaders || []).filter(h => !SKIP_HEADERS.has(String(h.name).toLowerCase()));
}

export function headerMap(rec) {
  const out = {};
  for (const h of usableHeaders(rec)) out[h.name] = h.value;
  return out;
}

export function bodyText(rec) {
  return rec.requestBody && rec.requestBody.text ? rec.requestBody.text : null;
}

export function contentType(rec) {
  for (const h of rec.requestHeaders || []) {
    if (String(h.name).toLowerCase() === 'content-type') return h.value;
  }
  return (rec.requestBody && rec.requestBody.contentType) || 'application/json';
}

/* --------------------------- Echappement par langage ---------------------- */

/** Chaine entre apostrophes pour un shell POSIX. */
export function shQuote(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

/** Chaine entre guillemets pour PowerShell (accent grave comme echappement). */
export function psQuote(s) { return '"' + String(s).replace(/"/g, '`"').replace(/\$/g, '`$') + '"'; }

/** Chaine entre guillemets pour cmd.exe de Windows. */
export function cmdQuote(s) { return '"' + String(s).replace(/"/g, '\\"').replace(/%/g, '%%') + '"'; }

/** Litteral JavaScript / JSON (fetch, axios, Node, k6...). */
export function jsQuote(s) { return JSON.stringify(String(s)); }

/** Chaine entre guillemets doubles avec echappement generique (C, Go, Java,
 *  C#, Rust, Swift, Kotlin, Dart, Objective-C, Clojure, R, Perl, Elixir...). */
export function dq(s) {
  return '"' + String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t') + '"';
}

/** Chaine entre apostrophes (PHP, Ruby : n interprete que \\ et l apostrophe). */
export function sq(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

/** Chaine YAML entre apostrophes : une apostrophe s y echappe en la doublant,
 *  jamais par une barre oblique inverse. Un texte multiligne devient un bloc
 *  litteral, seule forme qui conserve les sauts de ligne tels quels. */
export function yq(s, pad = '') {
  const text = String(s);
  if (text.includes('\n') || text.includes('\r')) {
    const corps = text.split(/\r?\n/).map(line => pad + '  ' + line).join(NL);
    return '|-' + NL + corps;
  }
  return "'" + text.split("'").join("''") + "'";
}

/** Indente chaque ligne d un bloc. */
export function indent(text, pad) {
  return String(text).split(NL).map(line => pad + line).join(NL);
}
