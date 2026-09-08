/* Panneau « Comparer » — INTERCEPTOR (by NeoZ)
 *
 * La vue Comparaison confronte deux requetes capturees ; ici on confronte le
 * texte de travail a n importe quel autre texte colle a cote : deux reponses,
 * deux configurations, deux jetons qui devraient etre identiques.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import { comparerTextes, comparerMots, diffUnifie, premiereDifference } from '../lib/diff.js';

export function panneauComparer(entree, etat, redessiner, poser) {
  const box = frag();
  box.appendChild(sec('Comparer', 'le texte de travail, face a un autre'));

  const zone = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '6',
    placeholder: t('collez ici le second texte : la reponse d hier, l autre environnement, la valeur attendue')
  });
  zone.value = etat.autreTexte || '';
  zone.addEventListener('change', () => { etat.autreTexte = zone.value; redessiner(); });
  box.appendChild(zone);

  const barre = el('div', { class: 'actions' });
  barre.appendChild(button('Depuis le presse-papiers', async () => {
    try {
      etat.autreTexte = await navigator.clipboard.readText();
      redessiner();
    } catch { toast('Lecture du presse-papiers refusee par le navigateur', false); }
  }));
  barre.appendChild(button('Echanger les deux', () => {
    const ancien = etat.autreTexte || '';
    etat.autreTexte = String(entree || '');
    poser(ancien);
  }));
  barre.appendChild(button('Vider', () => { etat.autreTexte = ''; redessiner(); }, { class: 'ghost' }));
  box.appendChild(barre);

  if (!String(entree || '') && !String(etat.autreTexte || '')) {
    box.appendChild(el('p', { class: 'note', text: t('Les deux textes sont vides.') }));
    return box;
  }

  let resultat;
  try { resultat = comparerTextes(entree, etat.autreTexte || ''); }
  catch (e) {
    box.appendChild(el('p', { class: 'note warn', text: t('Comparaison impossible : ') + String(e.message || e) }));
    return box;
  }

  box.appendChild(sec('Resultat', resultat.similitude + ' % ' + t('de lignes communes')));
  add(box, kv('Lignes identiques', resultat.egales, { always: true }));
  add(box, kv('Lignes seulement a gauche', resultat.retraits, { always: true }));
  add(box, kv('Lignes seulement a droite', resultat.ajouts, { always: true }));

  if (resultat.identiques) {
    box.appendChild(el('p', { class: 'note', text: t('Les deux textes sont identiques, ligne pour ligne.') }));
    const finesse = premiereDifference(entree, etat.autreTexte || '');
    if (finesse) {
      box.appendChild(el('p', { class: 'note warn', text:
        t('Ils different pourtant caractere par caractere : voir ci-dessous.') }));
    }
  }

  /* --- Difference caractere par caractere : l explication d un « pourtant
         c est pareil » quand deux jetons ne s egalent pas. --- */
  const finesse = premiereDifference(entree, etat.autreTexte || '');
  if (finesse) {
    box.appendChild(sec('Premiere difference', 'position ' + finesse.position));
    add(box, kv('A gauche', (finesse.gauche || '(rien)') + '   ·   ' + finesse.codeGauche));
    add(box, kv('A droite', (finesse.droite || '(rien)') + '   ·   ' + finesse.codeDroite));
    add(box, kv('Contexte', finesse.contexte));
  }

  /* ------------------------------ Ligne a ligne ---------------------------- */
  box.appendChild(sec('Ligne a ligne', resultat.operations.length + ' ' + t('lignes')));
  const affichees = resultat.operations.slice(0, 600);
  for (const op of affichees) {
    const signe = op.type === 'ajout' ? '+' : op.type === 'retrait' ? '-' : ' ';
    const classe = op.type === 'ajout' ? 'kv hl' : op.type === 'retrait' ? 'kv' : 'kv';
    const ligne = el('div', { class: classe }, [
      el('span', { text: signe + ' ' + (op.gauche || op.droite || '') }),
      el('b', { text: op.texte })
    ]);
    box.appendChild(ligne);
  }
  if (resultat.operations.length > affichees.length) {
    box.appendChild(el('p', { class: 'note', text:
      t('Affichage limite a 600 lignes ; le format unifie ci-dessous les porte toutes.') }));
  }

  /* -------------------------------- Mot a mot ------------------------------ */
  const gauche = String(entree || '').split(/\r?\n/);
  const droite = String(etat.autreTexte || '').split(/\r?\n/);
  if (gauche.length === 1 && droite.length === 1 && (gauche[0] || droite[0])) {
    box.appendChild(sec('Mot a mot', 'sur une seule ligne, la difference se voit mieux'));
    const mots = comparerMots(gauche[0], droite[0]);
    const ligne = el('p', { class: 'pre' });
    for (const mot of mots) {
      ligne.appendChild(el('span', {
        class: mot.type === 'egal' ? '' : mot.type === 'ajout' ? 'ok' : 'ko',
        text: (mot.type === 'egal' ? '' : mot.type === 'ajout' ? '+' : '-') + mot.texte
      }));
    }
    box.appendChild(ligne);
  }

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Copier le format unifie', () =>
    copy(diffUnifie(entree, etat.autreTexte || '', 'texte de travail', 'second texte'), 'Difference copiee')));
  actions.appendChild(button('Poser le format unifie comme entree', () =>
    poser(diffUnifie(entree, etat.autreTexte || '', 'texte de travail', 'second texte'))));
  box.appendChild(actions);
  return box;
}
