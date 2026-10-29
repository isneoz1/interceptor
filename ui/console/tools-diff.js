/* Panneau « Comparer » — SWIFT (by D4RK)
 *
 * La vue Comparaison confronte deux requetes capturees ; ici on confronte le
 * texte de travail a n importe quel autre texte colle a cote : deux reponses,
 * deux configurations, deux jetons qui devraient etre identiques.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import { comparerTextes, comparerMots, diffUnifie, premiereDifference } from '../lib/diff.js';
import { listeProgressive } from '../lib/liste-progressive.js';

export function panneauComparer(entree, etat, redessiner, poser) {
  const box = frag();
  box.appendChild(sec('Comparer', 'le texte de travail, face a un autre'));

  const zone = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '6', dataset: { champ: 'comparer-autre' },
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
    box.appendChild(el('p', { class: 'note warn', text: t('Comparaison impossible : ') + te(e) }));
    return box;
  }

  box.appendChild(sec('Resultat', resultat.minimal
    ? resultat.similitude + ' % ' + t('de lignes communes')
    : tp('au moins {n} % de lignes communes', { n: resultat.similitude })));
  add(box, kv('Lignes identiques', resultat.egales, { always: true }));
  add(box, kv('Lignes seulement a gauche', resultat.retraits, { always: true }));
  add(box, kv('Lignes seulement a droite', resultat.ajouts, { always: true }));

  if (!resultat.minimal) {
    box.appendChild(el('p', { class: 'note', text:
      t('Les deux textes different trop pour chercher la plus courte liste de changements : la comparaison reste exacte, chaque ligne y figure une fois, mais un bloc peut etre montre retire puis rajoute.') }));
  }
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
    box.appendChild(sec('Premiere difference', tp('position {n}', { n: finesse.position })));
    add(box, kv('A gauche', (finesse.gauche || t('(rien)')) + '   ·   ' + finesse.codeGauche));
    add(box, kv('A droite', (finesse.droite || t('(rien)')) + '   ·   ' + finesse.codeDroite));
    add(box, kv('Contexte', finesse.fin != null
      ? tp('un texte s arrete a {n} caracteres, l autre continue', { n: finesse.fin })
      : finesse.contexte));
  }

  /* ------------------------------ Ligne a ligne ---------------------------- */
  box.appendChild(sec('Ligne a ligne', resultat.operations.length + ' ' + t('lignes')));
  /* Toutes les lignes, par lots : rien n est coupe, rien ne fige. */
  const hote = el('div');
  box.appendChild(hote);
  listeProgressive(hote, resultat.operations, op => {
    const signe = op.type === 'ajout' ? '+' : op.type === 'retrait' ? '-' : ' ';
    return el('div', { class: op.type === 'ajout' ? 'kv hl' : 'kv' }, [
      el('span', { text: signe + ' ' + (op.gauche || op.droite || '') }),
      el('b', { text: op.texte })
    ]);
  });

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
  /* Le correctif au format unifie, que patch et git apply savent appliquer.
     Deux textes identiques n en donnent aucun, comme diff. */
  const unifie = () => diffUnifie(entree, etat.autreTexte || '', 'texte-de-travail', 'second-texte');
  actions.appendChild(button('Copier le format unifie', () => {
    const correctif = unifie();
    if (!correctif) return toast('Textes identiques : aucun correctif a produire', false);
    copy(correctif, 'Difference copiee');
  }));
  actions.appendChild(button('Poser le format unifie comme entree', () => {
    const correctif = unifie();
    if (!correctif) return toast('Textes identiques : aucun correctif a produire', false);
    poser(correctif);
  }));
  box.appendChild(actions);
  return box;
}
