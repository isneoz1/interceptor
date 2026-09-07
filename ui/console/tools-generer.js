/* Panneau « Generer » — INTERCEPTOR (by D4RK)
 *
 * Identifiants, secrets d essai, adresses et valeurs limites. Tout est tire du
 * generateur aleatoire du moteur ; la valeur produite remplace le texte de
 * travail, prete a etre transformee, hachee ou collee dans une requete.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import {
  uuidV4, uuidV7, ulid, nanoid, hexAleatoire, base64Aleatoire, base64UrlAleatoire,
  motDePasse, forceMotDePasse, macAleatoire, ipv4PriveeAleatoire, portAleatoire,
  VALEURS_LIMITES
} from '../lib/generateurs.js';

const JEUX = [
  ['minuscules', 'Minuscules'],
  ['majuscules', 'Majuscules'],
  ['chiffres', 'Chiffres'],
  ['symboles', 'Symboles']
];

export function panneauGenerateurs(poser, etat, redessiner) {
  const box = frag();

  /* ----------------------------- Identifiants ---------------------------- */
  box.appendChild(sec('Identifiants', 'formats normalises'));
  const ids = el('div', { class: 'actions' });
  ids.appendChild(button('UUID v4', () => poser(uuidV4()), { title: 'Seize octets au hasard' }));
  ids.appendChild(button('UUID v7', () => poser(uuidV7()),
    { title: 'Horodate : deux identifiants se trient dans l ordre de creation' }));
  ids.appendChild(button('ULID', () => poser(ulid()), { title: 'Horodate, ecrit en base 32 Crockford' }));
  ids.appendChild(button('NanoID', () => poser(nanoid()), { title: 'Vingt et un caracteres d URL' }));
  box.appendChild(ids);

  /* ------------------------------- Secrets ------------------------------- */
  box.appendChild(sec('Suites aleatoires', 'longueur en octets'));
  const suites = el('div', { class: 'actions' });
  for (const n of [16, 32, 64]) {
    suites.appendChild(button(n + ' octets en hexadecimal', () => poser(hexAleatoire(n))));
  }
  suites.appendChild(button('32 octets en base64', () => poser(base64Aleatoire(32))));
  suites.appendChild(button('32 octets en base64 URL', () => poser(base64UrlAleatoire(32))));
  box.appendChild(suites);

  /* ---------------------------- Mot de passe ----------------------------- */
  box.appendChild(sec('Mot de passe', 'tirage sans biais'));
  const longueur = el('input', {
    type: 'number', class: 'field', min: '4', max: '256',
    value: String(etat.longueurMdp || 24), style: 'max-width:110px'
  });
  longueur.addEventListener('change', () => {
    etat.longueurMdp = Math.max(4, Math.min(256, Number(longueur.value) || 24));
    redessiner();
  });
  const barre = el('div', { class: 'actions' }, [
    el('span', { class: 'note', text: t('Longueur') }), longueur
  ]);
  for (const [cle, libelle] of JEUX) {
    const actif = (etat.jeuxMdp || ['minuscules', 'majuscules', 'chiffres', 'symboles']).includes(cle);
    barre.appendChild(button(libelle, () => {
      const courants = new Set(etat.jeuxMdp || ['minuscules', 'majuscules', 'chiffres', 'symboles']);
      if (courants.has(cle)) courants.delete(cle); else courants.add(cle);
      etat.jeuxMdp = [...courants];
      redessiner();
    }, { class: actif ? 'on' : 'ghost' }));
  }
  box.appendChild(barre);

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Tirer un mot de passe', () => {
    try {
      const valeur = motDePasse(etat.longueurMdp || 24,
        etat.jeuxMdp || ['minuscules', 'majuscules', 'chiffres', 'symboles']);
      etat.dernierMdp = valeur;
      redessiner();
    } catch (e) { toast(String(e.message || e), false); }
  }));
  box.appendChild(actions);

  if (etat.dernierMdp) {
    const force = forceMotDePasse(etat.dernierMdp);
    add(box, kv('Mot de passe', etat.dernierMdp, { copy: true, hl: true }));
    add(box, kv('Alphabet employe', force.alphabet + ' caracteres', { always: true }));
    add(box, kv('Entropie', force.bits + ' bits', { always: true }));
    box.appendChild(el('p', { class: 'note', text: t(force.lecture) }));
    const suite = el('div', { class: 'actions' });
    suite.appendChild(button('Copier', () => copy(etat.dernierMdp, 'Mot de passe copie')));
    suite.appendChild(button('Poser comme texte de travail', () => poser(etat.dernierMdp)));
    box.appendChild(suite);
  }

  /* -------------------------------- Reseau -------------------------------- */
  box.appendChild(sec('Reseau', 'valeurs d essai'));
  const reseau = el('div', { class: 'actions' });
  reseau.appendChild(button('Adresse materielle', () => poser(macAleatoire()),
    { title: 'Marquee « administree localement », comme il se doit' }));
  reseau.appendChild(button('Adresse IPv4 privee', () => poser(ipv4PriveeAleatoire())));
  reseau.appendChild(button('Port dynamique', () => poser(String(portAleatoire()))));
  box.appendChild(reseau);

  /* --------------------------- Valeurs limites ---------------------------- */
  box.appendChild(sec('Valeurs limites', VALEURS_LIMITES.length));
  box.appendChild(el('p', { class: 'note', text:
    t('Des cas qui font tomber les validateurs mal ecrits : longueur, encodage, sens d ecriture. A employer sur ses propres services.') }));
  const limites = el('div', { class: 'actions' });
  for (const [libelle, valeur] of VALEURS_LIMITES) {
    limites.appendChild(button(libelle, () => {
      poser(valeur);
      toast(t('Valeur posee : ') + valeur.length + ' ' + t('caracteres'));
    }, { class: 'ghost' }));
  }
  box.appendChild(limites);

  box.appendChild(el('p', { class: 'note', text:
    t('La valeur produite remplace le texte de travail.') }));
  return box;
}
