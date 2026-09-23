/* Redessiner une vue sans deranger celui qui la lit — INTERCEPTOR (by NeoZ)
 *
 * Plusieurs vues se redessinent d elles-memes : a chaque changement du trafic
 * (le « Flux direct », la vue Securite), a chaque lecture d une session suivie,
 * a chaque touche tapee dans un filtre. Chaque redessin recree le cadre qui
 * defile, et le champ de saisie. Deux choses se perdaient ainsi :
 *
 *   - la POSITION : le lecteur descendu a la six-millieme ligne d une session
 *     WebSocket etait ramene en haut plusieurs fois par seconde pendant le
 *     trafic — lire une partie de jeu en direct etait impossible ;
 *   - la SAISIE : le champ de filtre perdait le focus, et seule la premiere
 *     lettre tapee comptait.
 *
 * `redessinerEnPlace` garde les deux. Pour la position, les listes rendues par
 * lots posent d emblee assez d elements pour atteindre l endroit ou etait le
 * lecteur, puis le cadre y est ramene.
 */
import { garderSaisie } from './dom.js';
import { rejoindre } from './liste-progressive.js';

/**
 * @param conteneur  l element de la vue (#view-...), qui contient son `.pane`
 * @param rendre     la fonction qui redessine la vue
 * @param enHaut     vrai quand l utilisateur change ce qu il regarde (un
 *                   autre flux, un autre filtre) : on repart alors du haut
 */
export function redessinerEnPlace(conteneur, rendre, enHaut = false) {
  const ancien = conteneur && conteneur.querySelector ? conteneur.querySelector('.pane') : null;
  const haut = !enHaut && ancien ? ancien.scrollTop || 0 : 0;
  return garderSaisie(() => {
    const resultat = haut > 0 ? rejoindre(haut, rendre) : rendre();
    if (haut > 0) {
      const nouveau = conteneur.querySelector('.pane');
      if (nouveau && nouveau !== ancien) nouveau.scrollTop = haut;
    }
    return resultat;
  });
}
