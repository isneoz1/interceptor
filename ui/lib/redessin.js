/* Redessiner une vue sans deranger celui qui la lit — SWIFT (by NeoZ)
 *
 * Plusieurs vues se redessinent d elles-memes : a chaque changement du trafic
 * (le « Flux direct », la vue Securite), a chaque lecture d une session suivie,
 * a chaque touche tapee dans un filtre. Chaque redessin recree le cadre qui
 * defile, et le champ de saisie. Trois choses se perdaient ainsi :
 *
 *   - la POSITION : le lecteur descendu a la six-millieme ligne d une session
 *     WebSocket etait ramene en haut plusieurs fois par seconde pendant le
 *     trafic — lire une partie de jeu en direct etait impossible ;
 *   - la SAISIE : le champ de filtre perdait le focus, et seule la premiere
 *     lettre tapee comptait ;
 *   - le CLIC : un redessin entre l appui et le relachement remplacait le
 *     bouton vise, et le clic n arrivait nulle part (lib/appui.js).
 *
 * `redessinerEnPlace` garde les trois. Pour la position, les listes rendues
 * par lots posent d emblee assez d elements pour atteindre l endroit ou etait
 * le lecteur, puis le cadre y est ramene.
 */
import { garderSaisie } from './dom.js';
import { rejoindre } from './liste-progressive.js';
import { differerSiAppui } from './appui.js';

/* Les vues a ramener en haut au prochain redessin : une demande reportee
   ne doit pas perdre cette consigne si une autre la remplace. */
const versLeHaut = new Set();

/**
 * @param conteneur  l element de la vue (#view-...), qui contient son `.pane`
 * @param rendre     la fonction qui redessine la vue
 * @param enHaut     vrai quand l utilisateur change ce qu il regarde (un
 *                   autre flux, un autre filtre) : on repart alors du haut
 */
export function redessinerEnPlace(conteneur, rendre, enHaut = false) {
  if (enHaut) versLeHaut.add(conteneur);
  differerSiAppui(conteneur, () => dessinerEnPlace(conteneur, rendre, versLeHaut.delete(conteneur)));
}

/* Un redessin demande pendant un redessin de la meme vue passe apres lui.
   Chrome valide un champ retire de la page pendant qu il a le focus, et le
   gestionnaire de ce champ redessine aussitot : imbrique, ce second rendu
   reconstruisait la vue au milieu de la construction du premier, qui
   ajoutait ensuite son propre cadre a cote. */
const enCours = new Set();

function dessinerEnPlace(conteneur, rendre, enHaut) {
  if (enCours.has(conteneur)) {
    queueMicrotask(() => redessinerEnPlace(conteneur, rendre, enHaut));
    return;
  }
  enCours.add(conteneur);
  try {
    const ancien = conteneur && conteneur.querySelector ? conteneur.querySelector('.pane') : null;
    const haut = !enHaut && ancien ? ancien.scrollTop || 0 : 0;
    garderSaisie(() => {
      if (haut > 0) rejoindre(haut, rendre); else rendre();
      if (haut > 0) {
        const nouveau = conteneur.querySelector('.pane');
        if (nouveau && nouveau !== ancien) nouveau.scrollTop = haut;
      }
    });
  } finally {
    enCours.delete(conteneur);
  }
}
