/* Vue « Reglages » — INTERCEPTOR (by NeoZ)
 *
 * Chaque option affichee ici existe dans le noyau et a un effet reel.
 * Les modifications sont appliquees immediatement et conservees.
 */
import { $, el, clear, sec, button } from '../lib/dom.js';
import { RESOURCE_TYPES } from '../lib/format.js';
import { COLUMNS, COLUMN_ORDER, DEFAULT_COLUMNS } from '../lib/columns.js';
import { state, cmd, toast, saveConfig, B, copy } from '../app.js';
import { t, tp, dictionarySize } from '../lib/i18n.js';
import { GROUPS, PROFILES } from './settings-groups.js';

let importText = '';

export function render() {
  const pane = clear($('#view-settings'));
  const box = el('div', { class: 'pane narrow' });
  pane.appendChild(box);

  if (!state.config) {
    box.appendChild(el('p', { class: 'note', text: t('Chargement des reglages…') }));
    cmd('getConfig', {}).then(res => { if (!res.error) { state.config = res.config; render(); } });
    return;
  }

  box.appendChild(sec('Profils rapides', 'un clic, plusieurs reglages'));
  const profiles = el('div', { class: 'actions' });
  for (const [label, note, patch] of PROFILES) {
    profiles.appendChild(button(label, async () => {
      await saveConfig(patch);
      toast(tp('Profil « {nom} » applique', { nom: t(label) }));
      render();
    }, { title: t(note) }));
  }
  box.appendChild(profiles);
  /* Le nom du profil ET sa description passent par le dictionnaire : sans
     cela, la ligne de resume restait en francais sous des boutons anglais. */
  box.appendChild(el('p', { class: 'note',
    text: PROFILES.map(p => t(p[0]) + ' : ' + t(p[1])).join('   ·   ') }));

  for (const group of GROUPS) {
    box.appendChild(sec(group.title));
    if (group.note) box.appendChild(el('p', { class: 'note', text: t(group.note) }));
    for (const field of group.fields) box.appendChild(buildField(field));
  }

  box.appendChild(colonnesSection());
  box.appendChild(maintenanceSection());
}

/* ------------------------------- Un champ --------------------------------- */
function buildField([key, label, type, extra, hint]) {
  const value = state.config[key];
  const row = el('div', { class: 'opt' });
  const text = el('div', { class: 'lbl' }, t(label));
  const note = type === 'select' ? hint : (typeof extra === 'string' ? extra : hint);
  /* tp interpole apres traduction : c est ce qui permet a une aide de citer
     un nombre calcule sans devenir intraduisible par concatenation. */
  if (note) text.appendChild(el('i', { text: tp(note, { entrees: dictionarySize() }) }));
  row.appendChild(text);
  const ctl = el('div', { class: 'ctl' });
  row.appendChild(ctl);

  if (type === 'bool') {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!value;
    input.addEventListener('change', () => onToggle(key, input));
    ctl.appendChild(input);
  } else if (type === 'number') {
    const input = el('input', { type: 'number', min: '0', value: String(value ?? 0) });
    input.addEventListener('change', () => {
      const v = Math.max(0, Number(input.value) || 0);
      input.value = String(v);
      saveConfig({ [key]: v });
    });
    ctl.appendChild(input);
  } else if (type === 'text') {
    const input = el('input', { type: 'text', class: 'field', value: String(value ?? '') });
    input.addEventListener('change', () => {
      const v = input.value.trim();
      // Un filtre invalide serait un reglage qui ment : on refuse tout de suite.
      if (v) {
        try { new RegExp(v); }
        catch (e) { return toast('Expression invalide : ' + String(e.message || e), false); }
      }
      saveConfig({ [key]: v });
    });
    ctl.appendChild(input);
  } else if (type === 'select') {
    const select = el('select');
    for (const [v, text2] of extra) select.appendChild(el('option', { value: v, text: t(text2), selected: v === value }));
    select.addEventListener('change', () => saveConfig({ [key]: select.value }));
    ctl.appendChild(select);
  } else if (type === 'list') {
    const area = el('textarea', { class: 'field', spellcheck: 'false', rows: '4' });
    area.value = (value || []).join('\n');
    area.addEventListener('change', () => {
      const list = area.value.split('\n').map(s => s.trim()).filter(Boolean);
      if (key.endsWith('UrlPatterns')) {
        const bad = list.find(p => { try { new RegExp(p); return false; } catch { return true; } });
        if (bad) return toast('Expression invalide : ' + bad, false);
      }
      saveConfig({ [key]: list });
      toast(tp('{n} ligne(s) enregistree(s)', { n: list.length }));
    });
    return el('div', { class: 'opt', style: 'display:block' }, [text, area]);
  } else if (type === 'types') {
    const grid = el('div', { class: 'checks' });
    const current = new Set(value || []);
    for (const ressource of RESOURCE_TYPES) {
      const input = el('input', { type: 'checkbox' });
      input.checked = current.has(ressource);
      input.addEventListener('change', () => {
        if (input.checked) current.add(ressource); else current.delete(ressource);
        saveConfig({ [key]: [...current] });
      });
      grid.appendChild(el('label', {}, [input, ressource]));
    }
    return el('div', { class: 'opt', style: 'display:block' }, [text, grid]);
  }
  return row;
}

async function onToggle(key, input) {
  // Deux options reposent sur une permission facultative, demandee au moment
  // precis de l activation et jamais a l installation.
  const PERMS = { captureProxy: 'proxy', notifyCritical: 'notifications' };
  const permission = PERMS[key];
  if (permission && input.checked) {
    let granted = false;
    try { granted = await B.permissions.request({ permissions: [permission] }); } catch { granted = false; }
    if (!granted) {
      input.checked = false;
      toast(tp('Permission « {nom} » refusee', { nom: permission }), false);
      return;
    }
  }
  await saveConfig({ [key]: input.checked });
}

/* ------------------------------- Colonnes --------------------------------- */
function colonnesSection() {
  const box = el('div');
  box.appendChild(sec('Colonnes du tableau',
    tp('{n} affichee(s)', { n: (state.config.columns || []).length })));
  box.appendChild(el('p', { class: 'note',
    text: t('Egalement accessible par le bouton « Colonnes » au-dessus du tableau.') }));
  const grid = el('div', { class: 'checks' });
  const current = new Set(state.config.columns || DEFAULT_COLUMNS);
  for (const key of COLUMN_ORDER) {
    const input = el('input', { type: 'checkbox' });
    input.checked = current.has(key);
    input.addEventListener('change', () => {
      if (input.checked) current.add(key); else current.delete(key);
      saveConfig({ columns: COLUMN_ORDER.filter(k => current.has(k)) });
    });
    /* Les deux moities passent par le dictionnaire : sans cela la liste
       affichait « Heure — Heure » au milieu d une interface anglaise. */
    grid.appendChild(el('label', {},
      [input, t(COLUMNS[key].label) + ' — ' + t(COLUMNS[key].title || COLUMNS[key].label)]));
  }
  box.appendChild(grid);
  box.appendChild(el('div', { class: 'actions' },
    button('Colonnes par defaut', () => { saveConfig({ columns: [...DEFAULT_COLUMNS] }); render(); })));
  return box;
}

/* Import d une capture externe. Le fichier est lu dans la page, puis confie au
   noyau : rien ne sort du navigateur. */
function importHarFile() {
  const picker = el('input', { type: 'file', accept: '.har,application/json', style: 'display:none' });
  document.body.appendChild(picker);
  picker.addEventListener('change', async () => {
    const file = picker.files && picker.files[0];
    if (!file) { picker.remove(); return; }
    toast(tp('Lecture de {fichier}…', { fichier: file.name }));
    try {
      const res = await cmd('importHar', { har: JSON.parse(await file.text()) });
      if (res.error) toast(res.error, false);
      else toast(res.skipped
        ? tp('{n} requetes importees, {i} ignorees', { n: res.imported, i: res.skipped })
        : tp('{n} requetes importees', { n: res.imported }));
    } catch (e) {
      toast(tp('Fichier illisible : {raison}', { raison: String(e && e.message || e) }), false);
    }
    picker.remove();
  });
  picker.click();
}

/* ------------------------------ Maintenance -------------------------------- */
function maintenanceSection() {
  const box = el('div');
  box.appendChild(sec('Sauvegarde des reglages'));
  box.appendChild(el('p', { class: 'note', text:
    t('Exportez pour conserver votre configuration, ou collez ci-dessous un fichier exporte pour la restaurer.') }));

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Exporter dans un fichier', async () => {
    const res = await cmd('exportFile', { format: 'config' });
    if (res.error) return toast(res.error, false);
    toast(tp('Reglages ecrits — {fichier}', { fichier: res.filename }));
  }));
  actions.appendChild(button('Copier les reglages', () => copy(JSON.stringify(state.config, null, 2), 'Reglages copies')));
  actions.appendChild(button('Importer un fichier HAR', importHarFile,
    { title: 'Relire une capture faite ailleurs (DevTools, Charles, Fiddler…)' }));
  actions.appendChild(button('Relancer le tutoriel', async () => {
    await saveConfig({ tutorialDone: [] });
    document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'tutorial' } }));
  }));
  box.appendChild(actions);

  const area = el('textarea', { class: 'field', spellcheck: 'false', rows: '5', placeholder: 'Coller ici un fichier de reglages JSON…' });
  area.value = importText;
  area.addEventListener('input', () => { importText = area.value; });
  box.appendChild(area);

  const status = el('p', { class: 'note' });
  box.appendChild(el('div', { class: 'actions' }, button('Importer', async () => {
    let parsed;
    try { parsed = JSON.parse(area.value || '{}'); }
    catch (e) {
      status.className = 'note ko';
      status.textContent = tp('JSON invalide : {raison}', { raison: e.message });
      return;
    }
    const res = await cmd('importConfig', { values: parsed });
    if (res.error) { status.className = 'note ko'; status.textContent = res.error; return; }
    state.config = res.config;
    status.className = 'note ok';
    status.textContent = res.ignored.length
      ? tp('{n} reglage(s) appliques, {i} inconnus ignores.', { n: res.applied, i: res.ignored.length })
      : tp('{n} reglage(s) appliques.', { n: res.applied });
    toast('Reglages importes');
    render();
  }, { class: 'accent' })));
  box.appendChild(status);

  box.appendChild(sec('Remise a zero'));
  let armed = false;
  const reset = button('Restaurer les reglages par defaut', async () => {
    if (!armed) {
      armed = true; reset.textContent = 'Confirmer la remise a zero ?'; reset.classList.add('armed');
      setTimeout(() => { armed = false; reset.textContent = 'Restaurer les reglages par defaut'; reset.classList.remove('armed'); }, 4000);
      return;
    }
    const res = await cmd('resetConfig', {});
    if (res.error) return toast(res.error, false);
    state.config = res.config;
    toast('Reglages par defaut restaures');
    render();
  }, { class: 'danger' });
  box.appendChild(el('div', { class: 'actions' }, reset));
  return box;
}
