/* Panneau « Cles et signatures » — INTERCEPTOR (by NeoZ)
 *
 * Les operations qui demandent une cle ou un essai systematique : XOR,
 * Cesar, Vigenere. Plus la reconnaissance d une empreinte et la lecture des
 * premiers octets d un contenu.
 *
 * Ces chiffres ne protegent rien. Ils servent a relire une valeur volontairement
 * obscurcie dans un parametre, un cookie ou un fichier de configuration.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import { xorTexte, xorHex, xorForceUnOctet, cesarToutes, vigenere } from '../lib/codecs-text.js';
import { texteVersOctets } from '../lib/bytes.js';
import { reconnaitreEmpreinte } from '../lib/hashes.js';
import { reconnaitreTexte } from '../lib/ref-mime.js';
import { lireIdentifiant, remarqueDate } from '../lib/identifiants.js';

export function panneauCles(entree, etat, redessiner, poser) {
  const box = frag();
  const brut = String(entree || '');

  /* ----------------------------------- XOR -------------------------------- */
  box.appendChild(sec('XOR', 'cle repetee, operation reciproque'));
  const cle = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: t('cle en texte, ou en hexadecimal'), value: etat.cleXor || ''
  });
  cle.addEventListener('change', () => { etat.cleXor = cle.value; redessiner(); });
  const barre = el('div', { class: 'actions' }, [cle]);
  barre.appendChild(button('Cle en hexadecimal', () => { etat.xorHex = !etat.xorHex; redessiner(); },
    { class: etat.xorHex ? 'on' : 'ghost' }));
  box.appendChild(barre);

  if (etat.cleXor) {
    try {
      const clair = xorTexte(brut, etat.cleXor, !!etat.xorHex);
      const hex = xorHex(brut, etat.cleXor, !!etat.xorHex);
      box.appendChild(sec('Resultat', clair.length + ' caracteres'));
      box.appendChild(el('pre', { class: 'pre', text: clair }));
      box.appendChild(sec('Le meme resultat, en octets'));
      box.appendChild(el('pre', { class: 'pre nowrap', text: hex }));
      const acts = el('div', { class: 'actions' });
      acts.appendChild(button('Copier', () => copy(clair, 'Resultat copie')));
      acts.appendChild(button('Reprendre comme entree', () => poser(clair)));
      box.appendChild(acts);
    } catch (e) {
      box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + String(e.message || e) }));
    }
  } else {
    box.appendChild(el('p', { class: 'note', text:
      t('Sans cle, essayez les 255 cles d un seul octet ci-dessous.') }));
  }

  const force = el('div', { class: 'actions' });
  force.appendChild(button('Essayer les 255 cles d un octet', () => {
    etat.xorCandidats = xorForceUnOctet(texteVersOctets(brut));
    if (!etat.xorCandidats.length) toast('Aucune cle ne rend un texte lisible', false);
    redessiner();
  }));
  box.appendChild(force);

  if (etat.xorCandidats && etat.xorCandidats.length) {
    box.appendChild(sec('Cles d un octet retenues', etat.xorCandidats.length));
    for (const c of etat.xorCandidats.slice(0, 12)) {
      const carte = el('div', { class: 'find info' }, [
        el('h4', { text: '0x' + c.cle.toString(16).padStart(2, '0') + '   ·   ' + c.score + ' % lisible' }),
        el('pre', { class: 'pre', text: c.texte.slice(0, 500) })
      ]);
      carte.appendChild(el('div', { class: 'actions' },
        button('Reprendre comme entree', () => poser(c.texte))));
      box.appendChild(carte);
    }
  }

  /* ---------------------------------- Cesar ------------------------------- */
  box.appendChild(sec('Cesar', 'les vingt-cinq decalages'));
  const decalages = cesarToutes(brut.slice(0, 400));
  if (!brut.trim()) {
    box.appendChild(el('p', { class: 'note', text: t('Texte de travail vide.') }));
  } else {
    for (const d of decalages) {
      const ligne = el('div', { class: 'kv copyable' }, [
        el('span', { text: '+' + d.decalage }),
        el('b', { text: d.texte })
      ]);
      ligne.addEventListener('click', () => copy(d.texte, 'Ligne copiee'));
      box.appendChild(ligne);
    }
  }

  /* -------------------------------- Vigenere ------------------------------ */
  box.appendChild(sec('Vigenere', 'cle en lettres'));
  const cleV = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: t('cle en lettres'), value: etat.cleVigenere || ''
  });
  cleV.addEventListener('change', () => { etat.cleVigenere = cleV.value; redessiner(); });
  const barreV = el('div', { class: 'actions' }, [cleV]);
  barreV.appendChild(button('Chiffrer', () => {
    try { poser(vigenere(brut, cleV.value, false)); }
    catch (e) { toast(String(e.message || e), false); }
  }));
  barreV.appendChild(button('Dechiffrer', () => {
    try { poser(vigenere(brut, cleV.value, true)); }
    catch (e) { toast(String(e.message || e), false); }
  }));
  box.appendChild(barreV);

  return box;
}

/* -------------------------- Reconnaissance de forme ----------------------- */
export function panneauIdentifier(entree) {
  const box = frag();
  const brut = String(entree || '').trim();
  box.appendChild(sec('Identifier', 'ce que la forme du texte laisse deviner'));

  if (!brut) {
    box.appendChild(el('p', { class: 'note', text:
      t('Collez une empreinte, un jeton ou le debut d un contenu binaire.') }));
    return box;
  }

  const empreinte = reconnaitreEmpreinte(brut);
  box.appendChild(sec('Empreinte', empreinte.candidats.length + ' candidat(s)'));
  for (const c of empreinte.candidats) add(box, kv('Candidat', c, { hl: true }));
  box.appendChild(el('p', { class: 'note', text: t(empreinte.note) }));

  const signatures = reconnaitreTexte(brut);
  box.appendChild(sec('Signature de contenu', signatures.length));
  if (!signatures.length) {
    box.appendChild(el('p', { class: 'note', text:
      t('Aucune signature connue au debut de ce contenu. Un corps binaire doit d abord etre decode depuis le base64 ou l hexadecimal.') }));
  }
  for (const s of signatures) {
    add(box, kv(s.nom, s.type, { hl: true }));
  }

  /* Ce que l identifiant CONTIENT, quand sa forme le permet : la plupart des
     identifiants d API portent un horodatage, parfois une machine et un
     compteur. Le lire dit quand la ressource a ete creee. */
  const lectures = lireIdentifiant(brut);
  if (lectures.length) {
    box.appendChild(sec('Identifiant reconnu', lectures.length + ' ' + t('lecture(s) possible(s)')));
    for (const lu of lectures) {
      const carte = el('div', { class: 'find info' }, [el('h4', { text: lu.nom })]);
      if (lu.versionSens) add(carte, kv('Version', t(lu.versionSens), { hl: true }));
      if (lu.variante) add(carte, kv('Variante', t(lu.variante)));
      if (lu.particulier) add(carte, kv('Cas particulier', t(lu.particulier), { hl: true }));
      if (lu.iso) {
        add(carte, kv('Date de creation', lu.iso, { copy: true, hl: true }));
        add(carte, kv('Anciennete', t(remarqueDate(lu.instant))));
      }
      add(carte, kv('Machine', lu.machine));
      add(carte, kv('Processus', lu.processus));
      add(carte, kv('Sequence dans la milliseconde', lu.sequence));
      add(carte, kv('Compteur', lu.compteur));
      add(carte, kv('Horloge', lu.horloge));
      if (lu.noeud) {
        add(carte, kv('Noeud', lu.noeud, { copy: true }));
        add(carte, kv('Noeud tire au hasard', lu.noeudAleatoire ? 'oui' : 'non — adresse de machine reelle'));
      }
      add(carte, kv('Secondes depuis l origine', lu.secondes));
      add(carte, kv('Partie aleatoire', lu.hasard || lu.hasardBase32, { copy: true }));
      box.appendChild(carte);
    }
    if (lectures.length > 1) {
      box.appendChild(el('p', { class: 'note', text:
        t('Plusieurs lectures tiennent : seule la source de l identifiant dit laquelle est la bonne.') }));
    }
  }

  box.appendChild(sec('Formes reconnues', 'lecture directe'));
  add(box, kv('Longueur', brut.length, { always: true }));
  add(box, kv('Uniquement hexadecimal', /^[0-9a-fA-F]+$/.test(brut) ? 'oui' : 'non'));
  add(box, kv('Alphabet base64', /^[A-Za-z0-9+/]+={0,2}$/.test(brut) ? 'oui' : 'non'));
  add(box, kv('Alphabet base64 URL', /^[A-Za-z0-9_-]+$/.test(brut) ? 'oui' : 'non'));
  add(box, kv('Trois parties separees par des points', brut.split('.').length === 3 ? 'oui' : 'non'));
  add(box, kv('Forme d UUID',
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brut) ? 'oui' : 'non'));
  add(box, kv('Chiffres seulement', /^\d+$/.test(brut) ? 'oui' : 'non'));
  add(box, kv('Commence par un accolade ou un crochet', /^[{[]/.test(brut) ? 'oui' : 'non'));
  return box;
}
