/* Traduction de l interface — INTERCEPTOR (by NeoZ)
 *
 * Le francais est la langue source : la cle de traduction EST le texte francais.
 * `t('Requetes')` rend « Requests » en anglais, et le texte d origine sinon.
 * Un texte absent du dictionnaire reste donc lisible, jamais vide ni casse.
 */

import { EN } from './dict-en.js';

let current = 'fr';
/* Appelee avec chaque texte que le dictionnaire n a pas. Seuls les tests la
   posent : c est ainsi qu ils voient un libelle arrive par une variable —
   `t(label)` — que la lecture du source ne peut pas voir. */
let temoinManque = null;

export function setLang(lang) { current = lang === 'en' ? 'en' : 'fr'; }
export function lang() { return current; }
export function surManque(fn) { temoinManque = typeof fn === 'function' ? fn : null; }

/** Traduit une chaine. Sans entree, la chaine francaise est rendue telle quelle. */
export function t(text) {
  if (current !== 'en') return text;
  if (EN[text] !== undefined) return EN[text];
  if (temoinManque) temoinManque(text);
  return text;
}

/** Traduit une chaine a trous :  tp('{n} requetes', { n: 12 }) */
export function tp(text, values) {
  let out = t(text);
  for (const [key, value] of Object.entries(values || {})) {
    out = out.split('{' + key + '}').join(String(value));
  }
  return out;
}

/** Nombre d entrees du dictionnaire : affiche dans les reglages. */
export function dictionarySize() { return Object.keys(EN).length; }
