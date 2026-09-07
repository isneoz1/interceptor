/* Emplacement de la console — INTERCEPTOR (by D4RK)
 *
 * Le menu d ancrage de la barre d en-tete : le meme choix qu au clic sur
 * l icone (onglet, fenetre detachee, panneau lateral, fenetre compacte), plus
 * la position de la fenetre detachee, applique immediatement et retenu pour la
 * prochaine ouverture. C est l equivalent du menu d ancrage des outils Firefox.
 */
import { $ } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { cmd, state, toast, dropdown } from '../app.js';

const DOCK_EMPLACEMENTS = [
  ['onglet', 'Onglet complet'],
  ['fenetre', 'Fenetre detachee'],
  ['panneau', 'Panneau lateral'],
  ['popup', 'Fenetre compacte au clic']
];
const DOCK_POSITIONS = [
  ['droite', 'A droite'], ['gauche', 'A gauche'], ['haut', 'En haut'],
  ['bas', 'En bas'], ['centre', 'Au centre'], ['plein', 'Plein ecran'],
  ['libre', 'La ou je la laisse']
];

async function appliquer(emplacement, position) {
  const args = position ? { emplacement, position } : { emplacement };
  const res = await cmd('surfaceDeplacer', args);
  if (res && res.error) { toast(res.error, false); return null; }
  if (state.config) {
    state.config.iconOpens = emplacement;
    if (position) state.config.consolePosition = position;
    else if (res && res.surface) state.config.consolePosition = res.surface.position;
  }
  return res;
}

export function bindDock() {
  const bouton = $('#dock');
  if (!bouton) return;
  dropdown(bouton, () => {
    const config = state.config || {};
    const actuel = config.iconOpens === 'console' ? 'onglet' : (config.iconOpens || 'popup');
    const position = config.consolePosition || 'droite';
    const items = [{ kind: 'head', label: 'Ouvrir la console' }];

    for (const [cle, libelle] of DOCK_EMPLACEMENTS) {
      items.push({
        label: libelle, checked: actuel === cle, keepOpen: true,
        action: async () => { if (await appliquer(cle, null)) toast(t('Console') + ' : ' + t(libelle)); }
      });
    }

    items.push({ kind: 'sep' }, { kind: 'head', label: 'Position de la fenetre detachee' });
    for (const [cle, libelle] of DOCK_POSITIONS) {
      items.push({
        label: libelle, checked: position === cle, keepOpen: true,
        action: async () => { if (await appliquer('fenetre', cle)) toast(t('Fenetre') + ' : ' + t(libelle)); }
      });
    }
    return items;
  });
}
