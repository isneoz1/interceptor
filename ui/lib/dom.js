/* Constructeurs DOM surs — SWIFT (by D4RK)
 *
 * Aucune donnee capturee n est jamais injectee en HTML : tout passe par
 * textContent. Un site observe ne peut donc rien injecter dans l interface.
 */
import { t } from './i18n.js';

export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = String(v);
      else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) { if (dv != null) node.dataset[dk] = String(dv); }
      else if (k === 'style') node.setAttribute('style', v);
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
      else if (k in node && typeof node[k] === 'boolean') node[k] = !!v;
      else node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (children != null) append(node, children);
  return node;
}

export function append(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false || c === '') continue;
    if (Array.isArray(c)) { append(node, c); continue; }
    node.appendChild(typeof c === 'object' && c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/**
 * Redessine une vue sans voler la saisie en cours.
 *
 * Une vue qui filtre pendant qu on tape se redessine a chaque touche, et le
 * redessin reconstruit le champ lui-meme : le focus partait avec l ancien, et
 * la deuxieme lettre tapee n allait plus nulle part. Sept champs de la console
 * ne gardaient ainsi que la premiere lettre, ou perdaient le focus apres une
 * pause. Un champ marque `dataset: { champ: 'nom-unique' }` retrouve ici, apres
 * le rendu, le focus et la position du curseur qu il avait avant.
 *
 * Il retrouve aussi ce qui y etait tape sans etre encore valide : un champ qui
 * s enregistre en perdant le focus (« change ») etait recree avec la valeur
 * enregistree, et ce qu on venait d y taper disparaissait — chaque seconde
 * dans la vue Interception, a chaque reglage enregistre dans les Reglages.
 */
let saisie = null;
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('input', ev => { saisie = ev.target; }, true);
  document.addEventListener('change', ev => { if (ev.target === saisie) saisie = null; }, true);
}

/* Le champ de ce nom, quel que soit le nom : sans selecteur a echapper. */
function champNomme(nom) {
  for (const n of document.querySelectorAll('[data-champ]')) if (n.dataset.champ === nom) return n;
  return null;
}

/* Ce qui etait tape sans etre valide passe dans le champ qui remplace
   l ancien. Le navigateur n a pas vu taper dans celui-ci : a la perte du
   focus, il ne previendrait pas toujours. On previent alors soi-meme, une
   fois, si rien ne l a fait — et seulement pour un champ encore affiche. */
function reprendreSaisie(nouveau, tape) {
  const rendu = nouveau.value;
  nouveau.value = tape;
  saisie = nouveau;
  let valide = false;
  const surChange = () => { valide = true; };
  nouveau.addEventListener('change', surChange, { once: true });
  nouveau.addEventListener('blur', () => {
    nouveau.removeEventListener('change', surChange);
    if (!valide && nouveau.isConnected && nouveau.value !== rendu) {
      nouveau.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { once: true });
}

export function garderSaisie(rendre) {
  const actif = typeof document !== 'undefined' ? document.activeElement : null;
  const nom = actif && actif.dataset ? actif.dataset.champ : null;
  let debut = null;
  let fin = null;
  /* Un nombre a moitie tape (« 1e », « - ») se lit comme une valeur vide : le
     reprendre viderait le champ. Il garde alors la valeur redessinee. */
  const illisible = !!(actif && actif.validity && actif.validity.badInput);
  const tape = nom && actif === saisie && !illisible && typeof actif.value === 'string' ? actif.value : null;
  if (nom) {
    try { debut = actif.selectionStart; fin = actif.selectionEnd; } catch { /* champ sans curseur */ }
  }
  const resultat = rendre();
  if (nom && actif.isConnected === false) {
    const nouveau = champNomme(nom);
    if (nouveau) {
      if (tape != null && nouveau.value !== tape) reprendreSaisie(nouveau, tape);
      nouveau.focus();
      try { if (debut != null) nouveau.setSelectionRange(debut, fin); } catch { /* idem */ }
    }
  }
  return resultat;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const frag = () => document.createDocumentFragment();

/** Bouton pret a l emploi : libelle, classe, action. */
export function button(label, onClick, opts = {}) {
  // Les libelles passent par la traduction : un seul point d entree pour
  // tous les boutons de l interface.
  const node = el('button', {
    class: 'btn' + (opts.class ? ' ' + opts.class : ''),
    title: opts.title ? t(opts.title) : null,
    type: 'button'
  }, t(label));
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

/* Un bouton a deux temps : le premier clic arme, le second agit s il vient
   dans les quatre secondes. L etat arme vit hors du bouton : une vue qui se
   redessine entre les deux clics — les statistiques, chaque seconde — le
   remplacait par un bouton desarme, et le second clic ne faisait que rearmer.
   Les deux libelles passent par la traduction, a chaque etat. */
const ARME_MS = 4000;
const armes = new Map();   // cle -> minuteur

function marquerArme(cle, libelle, arme) {
  for (const b of document.querySelectorAll('[data-confirme]')) {
    if (b.dataset.confirme !== cle) continue;
    b.textContent = t(libelle);
    if (arme) b.classList.add('armed'); else b.classList.remove('armed');
  }
}

export function boutonConfirme(cle, libelle, confirmation, agir, opts = {}) {
  const arme = armes.has(cle);
  const node = button(arme ? confirmation : libelle, () => {
    if (!armes.has(cle)) {
      armes.set(cle, setTimeout(() => { armes.delete(cle); marquerArme(cle, libelle, false); }, ARME_MS));
      marquerArme(cle, confirmation, true);
      return;
    }
    clearTimeout(armes.get(cle));
    armes.delete(cle);
    marquerArme(cle, libelle, false);
    agir();
  }, opts);
  node.dataset.confirme = cle;
  if (arme) node.classList.add('armed');
  return node;
}

/** Ligne « libelle / valeur ». Retourne null si la valeur est absente. */
export function kv(label, value, opts = {}) {
  if (value == null || value === '' || value === false) return opts.always ? kvForce(label, '—', opts) : null;
  return kvForce(label, value, opts);
}

function kvForce(label, value, opts) {
  const row = el('div', { class: 'kv' + (opts.hl ? ' hl' : '') + (opts.copy ? ' copyable' : '') }, [
    el('span', { text: t(label) }),
    el('b', { text: String(value) })
  ]);
  if (opts.copy) {
    row.title = t('Cliquer pour copier');
    row.addEventListener('click', () => {
      navigator.clipboard.writeText(String(value)).catch(() => {});
      row.classList.add('hl');
      setTimeout(() => row.classList.remove('hl'), 600);
    });
  }
  return row;
}

/** Titre de section, avec compteur ou precision a droite. */
export function sec(title, aside) {
  return el('div', { class: 'sec' }, [
    el('span', { text: t(title) }),
    aside == null || aside === '' ? null : el('em', { text: t(String(aside)) })
  ]);
}

/**
 * Bloc « rien a montrer » : un titre, une phrase qui dit quoi faire.
 *
 * Les deux passent par la traduction. Ecrit treize fois a la main, il l etait
 * huit fois sans — et ces ecrans sont les premiers que voit quelqu un qui
 * vient d installer : une console vide, en francais, quelle que soit la
 * langue choisie.
 */
export function vide(titre, phrase) {
  return el('div', { class: 'empty' }, [
    el('b', { text: t(titre) }),
    phrase == null || phrase === '' ? null : t(String(phrase))
  ]);
}

/** Bloc « definition list » compact pour les statistiques. */
export function grid(pairs, columns = '1fr auto') {
  const dl = el('dl', { class: 'grid', style: 'grid-template-columns:' + columns });
  for (const [label, value, tone] of pairs) {
    if (value == null) continue;
    dl.appendChild(el('dt', { text: t(label) }));
    dl.appendChild(el('dd', { class: tone || null, text: String(value) }));
  }
  return dl;
}

/** Petit balisage : **gras** uniquement, sans jamais passer par innerHTML.
 *  L aide et le tutoriel l emploient tous deux. */
export function richText(tag, source) {
  const node = el(tag);
  const parts = String(source).split(/\*\*/);
  parts.forEach((part, i) => {
    if (!part) return;
    node.appendChild(i % 2 ? el('b', { text: part }) : document.createTextNode(part));
  });
  return node;
}

/** Ajoute des noeuds en ignorant les absents : `kv()` peut rendre null quand
 *  une donnee n existe pas, et appendChild(null) leverait une erreur. */
export function add(host, ...nodes) {
  for (const node of nodes) if (node) host.appendChild(node);
  return host;
}
