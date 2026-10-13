/* Controles d un corps dans le panneau de detail — SWIFT (by NeoZ)
 *
 * Deux constats, poses dans le bloc du corps : le contenu contredit-il le
 * type annonce, et — pour une reponse — ce que gzip aurait fait d un texte
 * servi sans compression, mesure sur les octets recus. Pour un JSON, les
 * entiers qu un client JavaScript arrondira et les cles ecrites deux fois.
 * La lecture vit dans ui/lib/corps-controles.js.
 */
import { el, frag } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { bytes } from '../lib/format.js';
import { controlerType, controlerJson, mesurerCompression, FAITS_CORPS } from '../lib/corps-controles.js';
import { parLots } from './detail-more.js';

/* Au-dela, les constats JSON se font apres le dessin de l onglet. */
const SEUIL_JSON_DIFFERE = 200000;

/* Les entiers qu un client JavaScript arrondira et les cles ecrites deux
   fois : une ligne par constat, par lots — un corps peut en porter des
   milliers. */
function constatsJson(box, corps, typeAnnonce) {
  const json = controlerJson(corps, typeAnnonce);
  if (!json) return;
  if (json.perdus.length) {
    box.appendChild(el('p', { class: 'note warn', text: tp(FAITS_CORPS.entiersPerdus, { n: json.perdus.length }) }));
    const hote = el('div');
    box.appendChild(hote);
    parLots(hote, json.perdus, p => el('p', { class: 'note', text: '•  ' + tp(FAITS_CORPS.entierPerdu, p) }));
  }
  if (json.doubles.length) {
    box.appendChild(el('p', { class: 'note warn', text: tp(FAITS_CORPS.clesDoubles, { n: json.doubles.length }) }));
    const hote = el('div');
    box.appendChild(hote);
    parLots(hote, json.doubles, d => el('p', { class: 'note', text: '•  ' + tp(FAITS_CORPS.cleDouble, d) }));
  }
}

/**
 * @param {object} corps         le corps de la requete ou de la reponse
 * @param {string} typeAnnonce   le type declare
 * @param {object[]} entetes     les en-tetes de la reponse (pour la compression)
 * @param {{mesurer?: boolean}} options
 */
export function controlesCorps(corps, typeAnnonce, entetes, { mesurer = false } = {}) {
  const box = frag();
  const fait = controlerType(corps, typeAnnonce);
  if (fait) {
    const valeurs = { ...fait.valeurs };
    for (const cle of fait.aTraduire) valeurs[cle] = t(valeurs[cle]);
    box.appendChild(el('p', { class: 'note warn', text: tp(fait.texte, valeurs) }));
  }
  /* Les constats d un JSON. Au-dela de deux cent mille caracteres, sa lecture
     sans perte se sent — pres de deux cents millisecondes sur cinq
     megaoctets : elle attend que l onglet soit dessine, et ses constats
     prennent leur place une fois faits, comme la mesure de compression. */
  if (corps && typeof corps.text === 'string' && corps.text.length > SEUIL_JSON_DIFFERE) {
    const zone = el('div');
    box.appendChild(zone);
    const plusTard = globalThis.requestIdleCallback || (fn => setTimeout(fn, 0));
    plusTard(() => { try { constatsJson(zone, corps, typeAnnonce); } catch { /* corps illisible : rien a dire */ } });
  } else constatsJson(box, corps, typeAnnonce);
  if (mesurer) {
    /* La mesure est asynchrone : elle prend sa place une fois faite, et ne
       laisse rien quand elle n a pas lieu d etre. */
    const zone = el('div');
    box.appendChild(zone);
    mesurerCompression(corps, entetes).then(r => {
      if (!r || r.apres >= r.avant) return;
      zone.appendChild(el('p', { class: 'note', text: tp(FAITS_CORPS.compression, {
        avant: bytes(r.avant), apres: bytes(r.apres), gain: Math.round((1 - r.apres / r.avant) * 100)
      }) }));
    }, () => { /* compression indisponible : rien a dire */ });
  }
  return box;
}
