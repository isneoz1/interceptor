/* Controles d un corps dans le panneau de detail — SWIFT (by NeoZ)
 *
 * Deux constats, poses dans le bloc du corps : le contenu contredit-il le
 * type annonce, et — pour une reponse — ce que gzip aurait fait d un texte
 * servi sans compression, mesure sur les octets recus. La lecture vit dans
 * ui/lib/corps-controles.js.
 */
import { el, frag } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { bytes } from '../lib/format.js';
import { controlerType, mesurerCompression, FAITS_CORPS } from '../lib/corps-controles.js';

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
