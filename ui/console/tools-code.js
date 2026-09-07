/* Panneau « Code » — INTERCEPTOR (by D4RK)
 *
 * Deux gestes reciproques sur le meme texte de travail :
 *   Brouiller   enveloppe le code dans une forme qui s auto-decode a
 *               l execution — il tourne a l identique.
 *   Rendre lisible   deroule ces enveloppes et decode les procedes courants.
 *
 * L affichage montre clairement laquelle des deux operations est active, le
 * resultat en grand, et ce qui a ete fait etape par etape. On peut reprendre
 * le resultat comme nouvelle matiere d un clic.
 */
import { el, frag, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import { obfusquer, STYLES } from '../lib/obfuscation.js';
import { deobfusquer } from '../lib/obfuscation-lire.js';

/**
 * @param entree     texte de travail courant
 * @param etat       memoire du panneau (sens, style, embellir, dernier resultat)
 * @param redessiner redemande un rendu complet de la vue
 * @param reprendre  charge une valeur comme nouveau texte de travail
 */
export function panneauCode(entree, etat, redessiner, reprendre) {
  const box = frag();
  const brut = String(entree || '');
  if (etat.codeSens !== 'brouiller' && etat.codeSens !== 'lisible') etat.codeSens = 'lisible';
  if (!etat.codeStyle) etat.codeStyle = 'securise';
  if (etat.codeEmbellir == null) etat.codeEmbellir = true;

  box.appendChild(sec('Code',
    'Brouiller un code, ou rendre lisible un code brouille — sans jamais l executer'));

  /* --------------------------- Choix du sens ----------------------------- */
  const choix = el('div', { class: 'seg' });
  const bascule = (cle, libelle, aide) => {
    const b = el('button', { class: 'segbtn' + (etat.codeSens === cle ? ' on' : ''), type: 'button', title: t(aide) },
      el('span', { text: t(libelle) }));
    b.addEventListener('click', () => { etat.codeSens = cle; etat.codeSortie = null; redessiner(); });
    return b;
  };
  choix.appendChild(bascule('lisible', 'Rendre lisible',
    'Deroule les enveloppes eval et decode fromCharCode, echappements et base64'));
  choix.appendChild(bascule('brouiller', 'Brouiller',
    'Enveloppe le code dans une forme qui s auto-decode a l execution'));
  box.appendChild(choix);

  if (!brut) {
    box.appendChild(el('p', { class: 'note', text:
      t('Collez un code dans le texte de travail, en haut, puis choisissez une action.') }));
    return box;
  }

  if (etat.codeSens === 'brouiller') rendreBrouiller(box, brut, etat, redessiner, reprendre);
  else rendreLisible(box, brut, etat, redessiner, reprendre);

  return box;
}

/* ------------------------------- Brouiller -------------------------------- */
function rendreBrouiller(box, brut, etat, redessiner, reprendre) {
  const select = el('select');
  for (const [cle, libelle] of STYLES) {
    select.appendChild(el('option', { value: cle, text: t(libelle), selected: cle === etat.codeStyle }));
  }
  select.addEventListener('change', () => { etat.codeStyle = select.value; lancer(); });

  const actions = el('div', { class: 'actions' }, [select]);
  actions.appendChild(button('Brouiller', lancer));
  box.appendChild(actions);

  box.appendChild(el('p', { class: 'note', text: t('Le code brouille s execute a l identique : on remet la source telle quelle avant de la lancer. Ce n est pas du chiffrement — la cle voyage avec le code : cela gene une lecture rapide, cela ne protege pas un secret.') }));

  function lancer() {
    try {
      const sortie = obfusquer(brut, etat.codeStyle);
      etat.codeSortie = { ok: true, valeur: sortie, sens: 'brouiller' };
    } catch (e) {
      etat.codeSortie = { ok: false, erreur: String((e && e.message) || e) };
    }
    redessiner();
  }

  afficherResultat(box, etat, reprendre, {
    titre: 'Code brouille',
    videAide: 'Choisissez une forme puis « Brouiller ».'
  });
}

/* ----------------------------- Rendre lisible ----------------------------- */
function rendreLisible(box, brut, etat, redessiner, reprendre) {
  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Rendre lisible', lancer));

  const opt = el('label', { class: 'inline' }, [
    el('input', { type: 'checkbox', checked: etat.codeEmbellir ? 'checked' : null }),
    el('span', { text: t('Reindenter') })
  ]);
  opt.querySelector('input').addEventListener('change', ev => {
    etat.codeEmbellir = ev.target.checked; lancer();
  });
  actions.appendChild(opt);
  box.appendChild(actions);

  function lancer() {
    const res = deobfusquer(brut, { embellir: etat.codeEmbellir });
    etat.codeSortie = res.ok
      ? { ok: true, valeur: res.source, sens: 'lisible', etapes: res.etapes }
      : { ok: false, erreur: res.erreur };
    redessiner();
  }

  if (etat.codeSortie && etat.codeSortie.sens === 'lisible' && etat.codeSortie.etapes) {
    box.appendChild(sec('Ce qui a ete fait', etat.codeSortie.etapes.length));
    const liste = el('ul', { class: 'plain' });
    for (const e of etat.codeSortie.etapes) liste.appendChild(el('li', { text: t(e) }));
    box.appendChild(liste);
  }

  afficherResultat(box, etat, reprendre, {
    titre: 'Code lisible',
    videAide: 'Collez un code brouille puis « Rendre lisible ».'
  });
}

/* ------------------------- Affichage du resultat -------------------------- */
function afficherResultat(box, etat, reprendre, { titre, videAide }) {
  const sortie = etat.codeSortie;
  if (!sortie) { box.appendChild(el('p', { class: 'note', text: t(videAide) })); return; }
  if (!sortie.ok) { box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + sortie.erreur })); return; }

  box.appendChild(sec(titre, sortie.valeur.length + ' ' + t('caracteres')));
  const apercu = sortie.valeur.length > 20000 ? sortie.valeur.slice(0, 20000) + '\n…' : sortie.valeur;
  box.appendChild(el('pre', { class: 'pre', text: apercu }));

  const acts = el('div', { class: 'actions' });
  acts.appendChild(button('Copier le resultat', () => copy(sortie.valeur, 'Resultat copie')));
  acts.appendChild(button('Reprendre comme entree', () => reprendre(sortie.valeur)));
  add(box, acts);
  if (!sortie.valeur) toast('Resultat vide', false);
}
