/* Traduction de l interface — INTERCEPTOR (by NeoZ)
 *
 * Le francais est la langue source : la cle de traduction EST le texte francais.
 * `t('Requetes')` rend « Requests » en anglais, et le texte d origine sinon.
 * Un texte absent du dictionnaire reste donc lisible, jamais vide ni casse.
 */

import { EN } from './dict-en.js';
import { MODELES_ERREURS } from './dict-en-erreurs.js';

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

/* ----------------------------- Messages d erreur -------------------------- */
/* Un message d erreur porte souvent une valeur : « caractere invalide dans le
   base32 : @ ». Aucune cle ne peut lui correspondre mot pour mot ; il est donc
   reconnu par un modele a trous, compile une fois, a la premiere demande. */
let modeles = null;
const echapper = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compiler() {
  return Object.entries(MODELES_ERREURS).map(([fr, en]) => {
    const trous = [];
    const motif = fr.split(/(\{@?\w+\})/).map(morceau => {
      const m = /^\{(@?)(\w+)\}$/.exec(morceau);
      if (!m) return echapper(morceau);
      trous.push({ nom: m[2], traduire: m[1] === '@' });
      return '([\\s\\S]*?)';
    }).join('');
    /* Les modeles les plus precis d abord : le plus de texte fixe gagne. */
    return { re: new RegExp('^' + motif + '$'), trous, en, poids: fr.replace(/\{@?\w+\}/g, '').length };
  }).sort((a, b) => b.poids - a.poids);
}

/**
 * Traduit un message d erreur — une Error ou son texte. Sans entree ni
 * modele, le message est rendu tel quel : rien n est invente.
 */
export function te(erreur, profondeur = 0) {
  const message = String((erreur && erreur.message) || erreur || '');
  if (current !== 'en' || !message) return message;
  if (EN[message] !== undefined) return EN[message];
  /* Un message demesure (une valeur collee de plusieurs Ko) n est pas
     soumis aux modeles : leur lecture resterait lineaire, mais inutilement. */
  if (profondeur > 3 || message.length > 4000) return message;
  modeles = modeles || compiler();
  for (const m of modeles) {
    const r = m.re.exec(message);
    if (!r) continue;
    let sortie = m.en;
    m.trous.forEach(({ nom, traduire }, i) => {
      const valeur = traduire ? te(r[i + 1], profondeur + 1) : r[i + 1];
      sortie = sortie.split('{' + (traduire ? '@' : '') + nom + '}').join(valeur);
    });
    return sortie;
  }
  return message;
}

/** Nombre d entrees du dictionnaire : affiche dans les reglages. */
export function dictionarySize() { return Object.keys(EN).length; }
