/* Liste rendue par lots — INTERCEPTOR (by NeoZ)
 *
 * Certaines vues affichent des listes longues dont les elements n ont pas tous
 * la meme hauteur : les alertes, les journaux. Le defilement virtuel du tableau
 * ne s y applique pas — il suppose une hauteur constante.
 *
 * Deux problemes se posaient a la place :
 *   - construire des milliers d elements d un coup fige l interface le temps du
 *     rendu, et rend le defilement saccade ensuite ;
 *   - pour l eviter, les vues coupaient a 2000 ou 3000 entrees, ce qui contredit
 *     la regle du projet : rien de capture ne doit rester invisible.
 *
 * Ici, un premier lot est rendu tout de suite, et la suite arrive quand le
 * lecteur approche du bas. Rien n est coupe, rien ne fige.
 */
import { el } from './dom.js';

const LOT = 150;

/**
 * @param hote        element qui recoit les elements rendus
 * @param elements    tableau des donnees a afficher
 * @param fabriquer   (donnee, index) -> element DOM, ou null pour ne rien poser
 * @param options.lot       taille d un lot (defaut 150)
 * @param options.defilant  element dont on observe le defilement ; par defaut
 *                          l ancetre defilant de `hote`
 * @param options.compteur  (rendus, total) -> void, pour afficher la progression
 * @returns { arreter } pour couper l observation quand la vue change
 */
export function listeProgressive(hote, elements, fabriquer, options = {}) {
  const lot = Math.max(1, options.lot || LOT);
  const total = elements.length;
  let rendus = 0;
  let arrete = false;

  /* Sentinelle placee apres le dernier element rendu : quand elle entre dans la
     zone visible, on pose le lot suivant. */
  const sentinelle = el('div', { class: 'sentinelle', 'aria-hidden': 'true' });

  function poser() {
    if (arrete || rendus >= total) return;
    const fin = Math.min(total, rendus + lot);
    const fragment = document.createDocumentFragment();
    for (let i = rendus; i < fin; i++) {
      const noeud = fabriquer(elements[i], i);
      if (noeud) fragment.appendChild(noeud);
    }
    hote.insertBefore(fragment, sentinelle);
    rendus = fin;
    if (options.compteur) options.compteur(rendus, total);
    if (rendus >= total) retirer();
  }

  let observateur = null;
  function retirer() {
    if (observateur) { observateur.disconnect(); observateur = null; }
    if (sentinelle.parentNode) sentinelle.remove();
  }

  hote.appendChild(sentinelle);
  poser();                       // le premier lot est visible immediatement

  if (rendus < total) {
    const racine = options.defilant || ancetreDefilant(hote);
    if (typeof IntersectionObserver === 'function') {
      observateur = new IntersectionObserver(entrees => {
        // Plusieurs lots d affilee si la sentinelle reste visible : cela arrive
        // quand les elements sont courts et la fenetre haute.
        for (const entree of entrees) if (entree.isIntersecting) poser();
      }, { root: racine || null, rootMargin: '600px 0px' });
      observateur.observe(sentinelle);
    } else {
      // Sans IntersectionObserver, on pose tout : mieux vaut une pause qu une
      // liste tronquee sans que personne le sache.
      while (rendus < total) poser();
    }
  }

  return {
    arreter() { arrete = true; retirer(); },
    get rendus() { return rendus; },
    get total() { return total; }
  };
}

/** Le premier ancetre qui defile reellement, ou null. */
function ancetreDefilant(noeud) {
  let n = noeud && noeud.parentElement;
  while (n) {
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(n) : null;
    const debord = style ? style.overflowY : '';
    if (debord === 'auto' || debord === 'scroll') return n;
    n = n.parentElement;
  }
  return null;
}
