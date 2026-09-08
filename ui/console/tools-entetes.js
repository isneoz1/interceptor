/* Panneau « Entetes » — INTERCEPTOR (by NeoZ)
 *
 * La table de reference dit a quoi sert un entete ; ce panneau lit sa valeur.
 * On colle une ligne ou un bloc entier, et chaque entete connu est decoupe,
 * explique, et suivi de ce qui pose reellement probleme.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy } from '../app.js';
import { analyserBloc, ENTETES_ANALYSABLES } from '../lib/entetes-analyse.js';
import { decrireEntete } from '../lib/ref-entetes.js';

export function panneauEntetes(entree) {
  const box = frag();
  box.appendChild(sec('Entetes', ENTETES_ANALYSABLES.length + ' entetes decoupes en detail'));

  const brut = String(entree || '').trim();
  if (!brut) {
    box.appendChild(el('p', { class: 'note', text:
      t('Collez une ligne « Nom: valeur », ou un bloc entier copie depuis l onglet En-tetes d une requete.') }));
    box.appendChild(sec('Entetes decoupes en detail', ENTETES_ANALYSABLES.length));
    for (const nom of ENTETES_ANALYSABLES) add(box, kv(nom, ''));
    return box;
  }

  const lignes = analyserBloc(brut);
  if (!lignes.length) {
    box.appendChild(el('p', { class: 'note warn', text:
      t('Aucune ligne « Nom: valeur » reconnue dans ce texte.') }));
    return box;
  }

  const analyses = lignes.filter(l => !l.sansAnalyse);
  const risques = lignes.reduce((n, l) => n + l.risques.length, 0);
  box.appendChild(sec('Lignes lues', lignes.length + '   ·   ' + analyses.length + ' ' + t('analysees en detail')));
  if (risques) {
    box.appendChild(el('p', { class: 'note warn', text:
      risques + ' ' + t('point(s) a regarder de pres, listes sous chaque entete.') }));
  }

  for (const ligne of lignes) {
    const description = decrireEntete(ligne.nom);
    const carte = el('div', { class: 'find ' + (ligne.risques.length ? 'warn' : 'info') }, [
      el('h4', { text: ligne.nom }),
      description ? el('p', { class: 'note', text: t(description.description) }) : null,
      el('pre', { class: 'pre', text: ligne.valeur })
    ]);

    for (const p of ligne.parties) {
      add(carte, kv(p.cle, p.valeur + (p.note ? '   ·   ' + t(p.note) : ''), { copy: true }));
    }
    if (ligne.sansAnalyse) {
      carte.appendChild(el('p', { class: 'note', text:
        t('Cet entete n a pas de decoupage particulier : sa valeur est rendue telle quelle.') }));
    }
    for (const risque of ligne.risques) {
      carte.appendChild(el('p', { class: 'note warn',
        text: (risque.ou ? risque.ou + ' : ' : '') + t(risque.texte) }));
    }
    carte.appendChild(el('div', { class: 'actions' },
      button('Copier la valeur', () => copy(ligne.valeur, 'Valeur copiee'))));
    box.appendChild(carte);
  }

  box.appendChild(el('p', { class: 'note', text:
    t('Les avertissements portent sur des faits verifiables : un attribut absent, une directive qui annule la protection. Aucun n est une question de gout.') }));
  return box;
}
