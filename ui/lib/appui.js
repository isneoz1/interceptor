/* Un appui en cours — SWIFT (by D4RK)
 *
 * Le navigateur ne donne un clic qu a un element present a l appui ET au
 * relachement. Or une vue se redessine d elle-meme — le trafic qui arrive, les
 * statistiques chaque seconde, un reglage enregistre — ou parce qu un champ
 * perd le focus, ce qui arrive justement a l appui sur le bouton suivant.
 * Redessiner entre les deux temps remplacait l element vise : le premier clic
 * se perdait, il fallait cliquer deux fois, et une ligne du tableau cliquee
 * pendant le trafic ne s ouvrait pas.
 *
 * `differerSiAppui(cle, fn)` execute `fn` tout de suite ou, si un appui est en
 * cours, juste apres le clic qui le termine. Une demande plus recente pour la
 * meme cle remplace la precedente, et une execution faite entre-temps pour
 * cette cle (par le clic lui-meme, le plus souvent) la rend inutile.
 */
let appui = false;
const enAttente = new Map();

/* Le clic suit le relachement dans la meme tache : un minuteur nul passe
   apres lui, quand le bouton vise a recu son clic. */
function relacher() {
  if (!appui) return;
  appui = false;
  setTimeout(vider, 0);
}

function vider() {
  if (appui) return;              // un nouvel appui : on attend son relachement
  const taches = [...enAttente.values()];
  enAttente.clear();
  for (const fn of taches) {
    try { fn(); }
    /* Une erreur ne doit ni bloquer les autres rendus ni disparaitre : elle
       est signalee comme une erreur non rattrapee, telle qu elle serait sortie
       sans ce report. */
    catch (e) {
      if (typeof reportError === 'function') reportError(e);
      else setTimeout(() => { throw e; }, 0);
    }
  }
}

/** Suit les appuis sur `cible` (le document) ; `fenetre` signale sa perte de focus. */
export function ecouterAppui(cible, fenetre) {
  cible.addEventListener('pointerdown', () => { appui = true; }, true);
  cible.addEventListener('pointerup', relacher, true);
  cible.addEventListener('pointercancel', relacher, true);
  /* Un relachement hors de la fenetre peut ne jamais arriver : le premier
     mouvement sans bouton enfonce, ou la perte du focus, le constate. */
  cible.addEventListener('pointermove', ev => { if (ev.buttons === 0) relacher(); }, true);
  if (fenetre && typeof fenetre.addEventListener === 'function') fenetre.addEventListener('blur', relacher);
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  ecouterAppui(document, typeof window !== 'undefined' ? window : null);
}

/** Execute `fn` maintenant, ou juste apres le clic si un appui est en cours. */
export function differerSiAppui(cle, fn) {
  if (!appui) {
    enAttente.delete(cle);
    fn();
    return;
  }
  enAttente.set(cle, fn);
}
