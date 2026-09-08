/* Fenetre du defilement virtuel — INTERCEPTOR (by NeoZ)
 *
 * Le tableau ne dessine que les lignes visibles ; deux cales tiennent la place
 * des autres. Tout le probleme tient dans une invariante :
 *
 *     cale du haut + lignes dessinees + cale du bas = hauteur totale
 *
 * Si cette somme bouge d une image a l autre, `scrollHeight` bouge avec elle :
 * l ascenseur saute, le contenu se decale, et le defilement a la molette
 * devient saccade. C est ce qui arrivait quand les deux cales etaient arrondies
 * chacune de son cote, la hauteur de ligne etant fractionnaire des que
 * l affichage est mis a l echelle (calc(28px * 1.07) = 29.96 px).
 *
 * Les cales sont donc laissees en valeurs exactes : leur somme vaut alors
 * exactement `total * hauteur`, quelle que soit la position.
 *
 * Fonction pure, sans DOM : elle se teste directement.
 */

/**
 * @param scrollTop  position de defilement, en pixels
 * @param viewport   hauteur visible, en pixels
 * @param hauteur    hauteur d une ligne, en pixels (peut etre fractionnaire)
 * @param total      nombre de lignes
 * @param marge      lignes dessinees en plus de part et d autre
 * @returns { premiere, derniere, haut, bas, hauteurTotale }
 */
export function fenetreVirtuelle(scrollTop, viewport, hauteur, total, marge = 12) {
  /* Les trois entrees viennent du DOM : une mesure prise pendant que le panneau
     est masque rend 0, et une soustraction sur un element absent rend NaN. On
     les ramene a des nombres utilisables plutot que de propager l anomalie. */
  const h = Number(hauteur) > 0 ? Number(hauteur) : 1;
  const vue = Number(viewport) > 0 ? Number(viewport) : h;
  const n = Math.max(0, Math.floor(Number(total)) || 0);
  const position = Math.max(0, Number(scrollTop) || 0);

  if (!n) return { premiere: 0, derniere: 0, haut: 0, bas: 0, hauteurTotale: 0 };

  const parEcran = Math.ceil(vue / h);
  const aDessiner = parEcran + marge * 2;

  /* La position peut depasser le contenu juste apres un filtrage ou une
     suppression : on la borne pour ne jamais afficher une page vide. */
  const premiereMax = Math.max(0, n - parEcran);
  const brute = Math.floor(position / h) - marge;
  const premiere = Math.min(premiereMax, Math.max(0, brute));
  const derniere = Math.min(n, premiere + aDessiner);

  /* Valeurs exactes : haut + (derniere - premiere) * h + bas == n * h. */
  return {
    premiere,
    derniere,
    haut: premiere * h,
    bas: (n - derniere) * h,
    hauteurTotale: n * h
  };
}

/** Vrai si deux fenetres dessinent exactement les memes lignes. */
export function memeFenetre(a, b) {
  return !!a && !!b && a.premiere === b.premiere && a.derniere === b.derniere;
}
