/* Un long texte dans un bloc <pre> — SWIFT (by NeoZ)
 *
 * Poser cinq megaoctets de texte dans la page d un coup se sent : le panneau
 * fige le temps de la mise en page. On en montre donc le debut, avec le compte
 * exact et un bouton qui montre tout. Ce n est pas une troncature : rien n est
 * perdu, le reste est a un clic, et chaque bouton « Copier » ou « Reprendre »
 * travaille sur le texte entier.
 *
 * Plusieurs vues coupaient a la place, en silence ou presque : une partie de
 * formulaire a 4000 caracteres, le base64 d un corps a 20 000, un resultat de
 * la boite a outils a 4000 ou 20 000, un essai de jeu de caracteres a 2000.
 */
import { el } from './dom.js';
import { t, tp } from './i18n.js';
import { entierLisible } from './format.js';

/* Au-dela, la mise en page d un seul bloc commence a se sentir. */
export const SEUIL_TEXTE = 200000;

/**
 * @param texte            le texte entier
 * @param options.seuil    nombre de caracteres montres d emblee
 * @param options.classe   classe du bloc (« pre » par defaut)
 * @returns un element : le bloc seul, ou le bloc precede du compte et du bouton
 */
export function texteLong(texte, { seuil = SEUIL_TEXTE, classe = 'pre' } = {}) {
  const complet = String(texte ?? '');
  const pre = el('pre', { class: classe });
  if (complet.length <= seuil) {
    pre.textContent = complet;
    return pre;
  }
  pre.textContent = complet.slice(0, seuil);
  const avis = el('p', { class: 'note', text: tp('{vus} caracteres affiches sur {total}.',
    { vus: entierLisible(seuil), total: entierLisible(complet.length) }) });
  const tout = el('button', { class: 'btn sm', type: 'button' }, t('Tout afficher'));
  const boite = el('div', null, [avis, el('div', { class: 'actions' }, tout), pre]);
  tout.addEventListener('click', () => {
    pre.textContent = complet;
    avis.remove();
    tout.parentNode.remove();
  });
  return boite;
}
