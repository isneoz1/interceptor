/* Lire les sources du projet, pour les tests — SWIFT (by D4RK)
 *
 * Ce qu ont en commun les suites qui verifient les sources elles-memes
 * (tests/ui-load.test.mjs, tests/langue.test.mjs) : la liste des modules du
 * projet, la valeur d un litteral tel que le programme la manipule, et les
 * arguments d un appel, lus en suivant ses parentheses, ses chaines et ses
 * commentaires.
 */
import fs from 'fs';
import path from 'path';
import url from 'url';

export const racine = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
export const relatif = p => path.relative(racine, p).split(path.sep).join('/');
/* Ce qui n appartient pas au projet : le depot git, les paquets construits,
   les dependances, et les dossiers de travail d outils comme .claude (un
   worktree y recopie tout le projet, et faisait compter 481 modules pour
   243). */
export const HORS_PROJET = new Set(['.git', 'dist', 'node_modules', '.claude']);

export function fichiersJs(dossier) {
  const out = [];
  (function parcourir(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const rel = relatif(p);
      if (HORS_PROJET.has(rel.split('/')[0]) || rel.startsWith('tests')) continue;
      if (e.isDirectory()) parcourir(p);
      else if (e.name.endsWith('.js')) out.push(rel);
    }
  })(dossier);
  return out;
}

/* Un litteral tel qu il est ecrit dans le source, ramene a la valeur que le
   programme manipule vraiment : « \\/ » vaut « \/ », « \' » vaut « ' ». */
export function desechapper(litteral) {
  return litteral.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (tout, quoi) => {
    if (quoi[0] === 'u') return String.fromCharCode(parseInt(quoi.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' }[quoi] ?? quoi;
  });
}

/* Les arguments d un appel, lus en suivant ses parentheses, ses chaines et
   ses commentaires. */
export function finDeChaine(s, i) {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === q) return j;
  }
  return s.length;
}
export function finDeGroupe(s, i) {
  const ferme = { '(': ')', '{': '}', '[': ']' }[s[i]];
  let n = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'" || c === '`') { j = finDeChaine(s, j); continue; }
    if (c === '/' && s[j + 1] === '/') { j = s.indexOf('\n', j); if (j < 0) return s.length; continue; }
    if (c === '/' && s[j + 1] === '*') { j = s.indexOf('*/', j) + 1; continue; }
    if (c === s[i]) n++;
    else if (c === ferme && --n === 0) return j;
  }
  return s.length;
}
export function argumentsDe(s, ouvrante) {
  const fin = finDeGroupe(s, ouvrante);
  const args = [];
  let debut = ouvrante + 1;
  for (let j = ouvrante + 1; j < fin; j++) {
    const c = s[j];
    if (c === '"' || c === "'" || c === '`') { j = finDeChaine(s, j); continue; }
    if (c === '(' || c === '{' || c === '[') { j = finDeGroupe(s, j); continue; }
    if (c === ',') { args.push(s.slice(debut, j).trim()); debut = j + 1; }
  }
  args.push(s.slice(debut, fin).trim());
  return args;
}
