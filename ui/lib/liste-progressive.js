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
 *
 * Un piege merite d etre nomme : un IntersectionObserver ne rappelle que si
 * l etat CHANGE. Si la sentinelle reste dans la zone visible apres un lot,
 * elle reste « visible » — aucun changement, donc aucun rappel, et la liste
 * s arretait la definitivement, descendre n y changeant rien puisque
 * descendre ne changeait pas davantage son etat. On pose donc tant qu elle y
 * reste, en mesurant, plutot que d attendre un rappel qui ne viendra pas.
 */
import { el } from './dom.js';

const LOT = 150;

/* Marge sous la zone visible ou l on considere que la sentinelle approche.
   La meme valeur sert au `rootMargin` de l observateur et a la mesure faite
   apres chaque lot : les deux doivent parler de la meme zone. */
const MARGE = 600;

/* Nombre maximal de lots poses d affilee sans reprendre la main. A 150 par
   lot, cela fait trente mille elements : bien au-dela de ce qu une liste
   atteint, et assez bas pour qu une mesure impossible — un cadre masque, dont
   tout mesure zero — ne fige pas la page. */
const LOTS_MAX = 200;

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

  /* La sentinelle est-elle encore assez haute pour meriter un lot de plus ?
     Mesure directe, parce que l observateur, lui, ne redira rien tant que
     l etat ne change pas. */
  function approche(racine) {
    if (!sentinelle.getBoundingClientRect) return false;
    const bas = racine && racine.getBoundingClientRect
      ? racine.getBoundingClientRect().bottom
      : (typeof innerHeight === 'number' ? innerHeight : 0);
    return sentinelle.getBoundingClientRect().top <= bas + MARGE;
  }

  /* Pose des lots tant que la sentinelle reste dans la zone. Sans cette
     boucle, un lot qui ne la fait pas sortir arretait la liste pour de bon :
     l observateur n avait plus aucun changement a signaler. */
  function poserJusquASortie(racine) {
    let lots = 0;
    do { poser(); } while (rendus < total && ++lots < LOTS_MAX && approche(racine));
  }

  let observateur = null;
  function retirer() {
    if (observateur) { observateur.disconnect(); observateur = null; }
    if (sentinelle.parentNode) sentinelle.remove();
  }

  hote.appendChild(sentinelle);

  /* Rien a poser : la sentinelle n a personne a attendre. Sans cela elle
     restait dans le document, a observer le vide. */
  if (!total) retirer();

  const racine = options.defilant || ancetreDefilant(hote);
  poserJusquASortie(racine);     // de quoi remplir l ecran, tout de suite

  if (rendus < total) {
    if (typeof IntersectionObserver === 'function') {
      observateur = new IntersectionObserver(entrees => {
        if (entrees.some(entree => entree.isIntersecting)) poserJusquASortie(racine);
      }, { root: racine || null, rootMargin: MARGE + 'px 0px' });
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
