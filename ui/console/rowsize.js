/* Hauteur de ligne du tableau — INTERCEPTOR (by D4RK)
 *
 * Le defilement virtuel a besoin de la hauteur EXACTE d une ligne pour que les
 * cales (paddings) collent au contenu reel. On la mesure sur une vraie ligne
 * plutot que de la deviner : sinon, des que l affichage est mis a l echelle
 * (--scale) ou passe en densite compacte, la hauteur supposee derive de la
 * vraie, et les lignes sautent ou se chevauchent pendant un defilement rapide.
 */
import { $ } from '../lib/dom.js';

const REPLI = { confort: 28, compact: 23 };   // repli si la mise en page manque
let cache = 0;

/** A appeler quand l echelle ou la densite change : force une remesure. */
export function invaliderHauteur() { cache = 0; }

/** Hauteur d une ligne en pixels, mise en cache. */
export function hauteurLigne(densite) {
  return cache || (cache = mesurer(densite));
}

/** Recale la hauteur sur une ligne reellement dessinee : le prochain calcul de
 *  fenetre colle alors exactement au contenu, meme apres un changement d echelle. */
export function recalerHauteur(body) {
  const premiere = body && body.querySelector && body.querySelector('.trow');
  if (!premiere) return;
  const h = premiere.getBoundingClientRect().height;
  if (h > 1) cache = h;
}

function mesurer(densite) {
  const repli = REPLI[densite === 'compact' ? 'compact' : 'confort'];
  const wrap = $('#tablewrap');
  const doc = (wrap && wrap.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!doc || !doc.createElement) return repli;

  const existante = wrap && wrap.querySelector && wrap.querySelector('.trow');
  if (existante) {
    const h = existante.getBoundingClientRect().height;
    if (h > 1) return h;
  }
  // Aucune ligne dessinee : une sonde invisible resout calc(28px * scale).
  const hote = doc.body || doc.documentElement;
  if (!hote) return repli;
  const sonde = doc.createElement('div');
  sonde.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;height:var(--row-h)';
  hote.appendChild(sonde);
  const h = sonde.getBoundingClientRect().height;
  sonde.remove();
  return h > 1 ? h : repli;
}
