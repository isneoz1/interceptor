/* Menu contextuel des lignes et redimensionnement des colonnes
 * INTERCEPTOR (by D4RK)
 *
 * Extrait de la vue Requetes pour garder chaque module lisible. Le tableau
 * fournit les quelques actions dont ce menu a besoin (`api`), rien de plus.
 */
import { $, el } from '../lib/dom.js';
import { template } from '../lib/columns.js';
import { state, cmd, toast, copy, saveConfig, B } from '../app.js';
import { poser } from './tools.js';
import { t } from '../lib/i18n.js';

/** Ferme tout menu contextuel ouvert. */
export function closeContextMenu() {
  for (const menu of document.querySelectorAll('.ctxmenu')) menu.remove();
}

/**
 * Clic droit sur une ligne : les actions les plus frequentes, sans quitter le
 * tableau. Chaque entree agit sur la ligne visee, jamais sur la selection.
 */
export function openRowMenu(ev, api) {
  const row = ev.target.closest('.trow');
  if (!row) return;
  ev.preventDefault();
  closeContextMenu();

  const id = Number(row.dataset.id);
  const rec = state.records.get(id);
  if (!rec) return;

  const items = [
    { head: rec.method + '  ' + (rec.host || rec.scheme || '—') },
    ['Ouvrir le detail', () => api.open(id)],
    ['Copier l URL', () => copy(rec.url, 'URL copiee')],
    ['Copier en cURL', async () => {
      const res = await cmd('codegen', { id, kind: 'curl' });
      if (res.error) return toast(res.error, false);
      copy(res.code, 'Commande cURL copiee');
    }],
    ['Copier la ligne en JSON', async () => {
      const res = await cmd('codegen', { id, kind: 'json' });
      if (res.error) return toast(res.error, false);
      copy(res.code, 'Enregistrement copie');
    }],
    // La boite a outils ouvre directement le panneau qui convient a la matiere
    // envoyee : une URL sur l onglet URL, un corps sur les transformations.
    ['Analyser l URL dans la boite a outils', () => poser(rec.url, { vers: 'url' })],
    ['Analyser les entetes dans la boite a outils', () => {
      const lignes = [...(rec.requestHeaders || []), ...(rec.responseHeaders || [])]
        .map(h => h.name + ': ' + h.value);
      if (!lignes.length) return toast('Aucun entete capture sur cette ligne', false);
      poser(lignes.join(String.fromCharCode(10)), { vers: 'entetes' });
    }],
    { sep: true },
    ['Filtrer sur cet hote', () => api.filter('host:' + rec.host)],
    ['Filtrer sur ce type', () => api.filter('type:' + rec.type)],
    ['Filtrer sur ce statut', () => api.filter('status:' + (rec.statusCode || 0))],
    ['Masquer cet hote', () => api.filter('-host:' + rec.host)],
    { sep: true },
    [rec.flag ? 'Retirer l epingle' : 'Epingler cette ligne', () => api.flag(id)],
    ...COULEURS.map(([cle, libelle]) => [
      (rec.color === cle ? '● ' : '○ ') + t(libelle),
      () => marquer(id, cle)
    ]),
    ['Ajouter a la selection', () => api.select(id)],
    ['Ouvrir l URL dans un onglet', async () => {
      if (!/^https?:/.test(rec.url)) return toast('Seules les URL http et https sont ouvrables', false);
      try { await B.tabs.create({ url: rec.url, active: true }); }
      catch { toast('Ouverture impossible', false); }
    }],
    { sep: true },
    ['Bloquer cet hote (regle active)', () => blockHost(rec), 'danger'],
    ['Supprimer cette ligne', async () => {
      const res = await cmd('deleteRecords', { ids: [id] });
      if (res.error) return toast(res.error, false);
      toast('Ligne supprimee');
    }, 'danger']
  ];

  const menu = el('div', { class: 'ctxmenu' });
  for (const item of items) {
    if (item.head) { menu.appendChild(el('div', { class: 'head', text: item.head })); continue; }   // methode et hote : rien a traduire
    if (item.sep) { menu.appendChild(el('hr')); continue; }
    const [label, action, cls] = item;
    const btn = el('button', { class: cls || null, type: 'button' }, t(label));
    btn.addEventListener('click', () => { closeContextMenu(); action(); });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  const width = 244;
  const height = menu.childNodes.length * 30 + 20;
  const maxLeft = (window.innerWidth || 1200) - width - 8;
  const maxTop = (window.innerHeight || 800) - height - 8;
  menu.style.left = Math.max(4, Math.min(ev.clientX, maxLeft)) + 'px';
  menu.style.top = Math.max(4, Math.min(ev.clientY, maxTop)) + 'px';
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}

/* Les six couleurs de marquage, plus le retrait. Elles n ont pas de sens
   impose : c est l utilisateur qui decide de ce que « rouge » veut dire. */
const COULEURS = [
  ['', 'Aucune couleur'],
  ['rouge', 'Rouge'], ['orange', 'Orange'], ['jaune', 'Jaune'],
  ['vert', 'Vert'], ['bleu', 'Bleu'], ['violet', 'Violet']
];

async function marquer(id, color) {
  const res = await cmd('annotateRecord', { id, color });
  if (res.error) return toast(res.error, false);
  const resume = state.records.get(id);
  if (resume) resume.color = res.color;
  toast(color ? 'Ligne marquee' : 'Marquage retire');
}

async function blockHost(rec) {
  if (!rec.host) return toast('Hote inconnu', false);
  const rules = [...((state.config && state.config.rules) || [])];
  const id = 'block-' + rec.host;
  if (rules.some(r => r.id === id)) return toast('Regle deja presente');
  rules.push({ id, enabled: true, name: 'Bloquer ' + rec.host, match: { host: rec.host }, action: 'block' });
  const config = await saveConfig({ rules, rulesEnabled: true });
  if (config) toast(rec.host + ' bloque — regle active');
}

/**
 * Poignee de redimensionnement d une colonne. La largeur choisie est conservee
 * dans les reglages, colonne par colonne.
 */
export function grip(key, cell, api) {
  const handle = el('div', { class: 'grip', title: 'Tirer pour redimensionner cette colonne' });
  handle.addEventListener('click', ev => ev.stopPropagation());
  handle.addEventListener('mousedown', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX;
    const startWidth = cell.getBoundingClientRect().width;

    const move = e2 => {
      const width = Math.max(28, Math.round(startWidth + (e2.clientX - startX)));
      const widths = { ...((state.config && state.config.columnWidths) || {}), [key]: width + 'px' };
      if (state.config) state.config.columnWidths = widths;
      $('#table').style.setProperty('--cols', template(api.columns(), widths));
    };
    const stop = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      saveConfig({ columnWidths: (state.config && state.config.columnWidths) || {} });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
  });
  return handle;
}
