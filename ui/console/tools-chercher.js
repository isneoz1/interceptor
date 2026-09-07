/* Panneau « Chercher » — INTERCEPTOR (by D4RK)
 *
 * Trois facons d extraire une valeur du texte de travail : un motif tout pret,
 * un chemin dans du JSON, un selecteur dans du HTML. La quatrieme, l expression
 * reguliere ecrite a la main, a son propre onglet.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import {
  MOTIFS, luhn, chercherJson, cheminsJson,
  selecteursDisponibles, selecteurCss, selecteurXpath
} from '../lib/motifs.js';

export function panneauChercher(entree, etat, redessiner, poser) {
  const box = frag();
  const brut = String(entree || '');

  /* ------------------------------ Motifs prets ---------------------------- */
  box.appendChild(sec('Motifs courants', MOTIFS.length + ' ' + t('formes reconnues')));
  const liste = el('div', { class: 'actions' });
  for (const motif of MOTIFS) {
    liste.appendChild(button(motif.nom, () => {
      etat.motifChoisi = motif.nom;
      redessiner();
    }, { class: etat.motifChoisi === motif.nom ? 'on' : 'ghost', title: motif.note }));
  }
  box.appendChild(liste);

  if (etat.motifChoisi) {
    const motif = MOTIFS.find(m => m.nom === etat.motifChoisi);
    if (motif) {
      box.appendChild(el('p', { class: 'note', text: t(motif.note) }));
      add(box, kv('Expression', motif.motif, { copy: true }));
      let trouves = [];
      try { trouves = [...new Set(brut.match(new RegExp(motif.motif, 'g')) || [])]; }
      catch (e) { box.appendChild(el('p', { class: 'note warn', text: String(e.message || e) })); }
      box.appendChild(sec('Trouvailles', trouves.length));
      if (!trouves.length) {
        box.appendChild(el('p', { class: 'note', text: t('Rien de cette forme dans le texte de travail.') }));
      }
      for (const trouve of trouves.slice(0, 300)) {
        add(box, kv('valeur', trouve, { copy: true }));
      }
      if (trouves.length) {
        box.appendChild(el('div', { class: 'actions' }, [
          button('Copier la liste', () => copy(trouves.join('\n'), 'Liste copiee')),
          button('Poser la liste comme entree', () => poser(trouves.join('\n')))
        ]));
      }
    }
  }

  /* --------------------------------- Luhn --------------------------------- */
  box.appendChild(sec('Cle de Luhn', 'carte bancaire, IMEI, numero de securite sociale canadien'));
  const champLuhn = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: t('numero a verifier'), value: etat.numeroLuhn || ''
  });
  champLuhn.addEventListener('change', () => { etat.numeroLuhn = champLuhn.value; redessiner(); });
  box.appendChild(el('div', { class: 'actions' }, [champLuhn]));
  if (etat.numeroLuhn) {
    try {
      const r = luhn(etat.numeroLuhn);
      add(box, kv('Chiffres', r.chiffres, { always: true }));
      add(box, kv('Somme de controle', r.somme, { always: true }));
      add(box, kv('Cle de Luhn', r.valide ? t('juste') : t('fausse'), { hl: true }));
      box.appendChild(el('p', { class: 'note', text: r.valide
        ? t('La cle est juste : le numero est bien forme. Cela ne dit rien de son existence.')
        : t('La cle est fausse : il y a une faute de frappe, ou ce n est pas un numero de ce type.') }));
    } catch (e) {
      box.appendChild(el('p', { class: 'note warn', text: String(e.message || e) }));
    }
  }

  /* ------------------------------ Chemin JSON ----------------------------- */
  box.appendChild(sec('Chemin dans le JSON', '$.a.b[0], $.a[*], $..cle'));
  const champChemin = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: '$.data[0].id', value: etat.cheminJson || ''
  });
  champChemin.addEventListener('change', () => { etat.cheminJson = champChemin.value; redessiner(); });
  const barreJson = el('div', { class: 'actions' }, [champChemin]);
  barreJson.appendChild(button('Tous les chemins', () => {
    try {
      const chemins = cheminsJson(brut);
      poser(chemins.map(c => c.chemin + ' = ' + c.valeur).join('\n'));
      toast(chemins.length + ' chemins poses dans le texte de travail');
    } catch (e) { toast(String(e.message || e), false); }
  }));
  box.appendChild(barreJson);

  if (etat.cheminJson) {
    try {
      const trouves = chercherJson(brut, etat.cheminJson);
      box.appendChild(sec('Resultats', trouves.length));
      if (!trouves.length) {
        box.appendChild(el('p', { class: 'note', text: t('Ce chemin ne mene a rien dans ce document.') }));
      }
      for (const trouve of trouves.slice(0, 200)) {
        const valeur = typeof trouve.valeur === 'object'
          ? JSON.stringify(trouve.valeur) : String(trouve.valeur);
        add(box, kv(trouve.chemin, valeur, { copy: true }));
      }
    } catch (e) {
      box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + String(e.message || e) }));
    }
  }

  /* ------------------------------- Selecteurs ----------------------------- */
  box.appendChild(sec('Selecteur dans le HTML', 'CSS ou XPath, sur le texte de travail'));
  if (!selecteursDisponibles()) {
    box.appendChild(el('p', { class: 'note', text:
      t('L analyseur HTML du navigateur n est pas disponible dans ce contexte.') }));
    return box;
  }

  const champSelecteur = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: 'a[href], //a/@href', value: etat.selecteur || ''
  });
  champSelecteur.addEventListener('change', () => { etat.selecteur = champSelecteur.value; redessiner(); });
  const barre = el('div', { class: 'actions' }, [champSelecteur]);
  barre.appendChild(button('CSS', () => { etat.typeSelecteur = 'css'; redessiner(); },
    { class: (etat.typeSelecteur || 'css') === 'css' ? 'on' : 'ghost' }));
  barre.appendChild(button('XPath', () => { etat.typeSelecteur = 'xpath'; redessiner(); },
    { class: etat.typeSelecteur === 'xpath' ? 'on' : 'ghost' }));
  box.appendChild(barre);

  if (etat.selecteur) {
    try {
      const xpath = etat.typeSelecteur === 'xpath';
      const trouves = xpath ? selecteurXpath(brut, etat.selecteur) : selecteurCss(brut, etat.selecteur);
      box.appendChild(sec('Elements trouves', trouves.length));
      if (!trouves.length) {
        box.appendChild(el('p', { class: 'note', text: t('Aucun element ne correspond.') }));
      }
      for (const trouve of trouves) {
        const carte = el('div', { class: 'find info' }, [
          el('h4', { text: xpath ? trouve.nom + '  ·  ' + trouve.type : trouve.balise }),
          el('pre', { class: 'pre', text: xpath ? trouve.valeur : (trouve.texte || trouve.html) })
        ]);
        if (!xpath && trouve.attributs) add(carte, kv('attributs', trouve.attributs, { copy: true }));
        box.appendChild(carte);
      }
    } catch (e) {
      box.appendChild(el('p', { class: 'note warn', text: t('Selecteur refuse : ') + String(e.message || e) }));
    }
  }
  return box;
}
