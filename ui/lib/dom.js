/* Constructeurs DOM surs — INTERCEPTOR (by D4RK)
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
      else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = String(dv);
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
    row.title = 'Cliquer pour copier';
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

/** Arbre JSON repliable : garantit qu aucun champ ne peut rester invisible. */
export function jsonTree(value, key = null, depth = 0) {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;

  if (type !== 'object' && type !== 'array') {
    return el('div', { class: 'row' }, [
      key == null ? null : el('span', { class: 'k', text: key + ' :' }),
      el('span', { class: 'v', text: type === 'string' ? value : String(value) }),
      el('span', { class: 't', text: type === 'string' ? '' : '(' + type + ')' })
    ]);
  }

  const entries = type === 'array'
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  const label = (key == null ? 'enregistrement' : key) +
    (type === 'array' ? ' [' + entries.length + ']' : ' {' + entries.length + '}');

  const box = el('details', { open: depth < 1 });
  box.appendChild(el('summary', { text: label }));
  if (!entries.length) box.appendChild(el('div', { class: 'row' }, el('span', { class: 't', text: 'vide' })));
  for (const [k, v] of entries) box.appendChild(jsonTree(v, k, depth + 1));
  return box;
}

/** Ajoute des noeuds en ignorant les absents : `kv()` peut rendre null quand
 *  une donnee n existe pas, et appendChild(null) leverait une erreur. */
export function add(host, ...nodes) {
  for (const node of nodes) if (node) host.appendChild(node);
  return host;
}
