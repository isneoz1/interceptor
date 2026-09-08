/* Traduction de l interface — INTERCEPTOR (by NeoZ)
 *
 * Le francais est la langue source : la cle de traduction EST le texte francais.
 * `t('Requetes')` rend « Requests » en anglais, et le texte d origine sinon.
 * Un texte absent du dictionnaire reste donc lisible, jamais vide ni casse.
 */

import { EN } from './dict-en.js';

let current = 'fr';

export function setLang(lang) { current = lang === 'en' ? 'en' : 'fr'; }
export function lang() { return current; }

/** Traduit une chaine. Sans entree, la chaine francaise est rendue telle quelle. */
export function t(text) {
  if (current !== 'en') return text;
  return EN[text] !== undefined ? EN[text] : text;
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
