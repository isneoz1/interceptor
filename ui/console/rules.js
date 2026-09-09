/* Vue « Regles » — interception active — INTERCEPTOR (by NeoZ)
 *
 * Editeur visuel : chaque regle se construit avec des champs et des boutons.
 * Le mode JSON reste disponible pour les cas avances et les copier-coller.
 */
import { $, el, clear, sec, button } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { RESOURCE_TYPES } from '../lib/format.js';
import { state, toast, saveConfig, copy } from '../app.js';

const ACTIONS = [
  ['block', 'Bloquer la requete'],
  ['redirect', 'Rediriger vers une autre URL'],
  ['upgrade', 'Forcer le HTTPS'],
  ['modifyHeaders', 'Modifier les entetes'],
  ['mock', 'Simuler la reponse'],
  ['delay', 'Retarder la requete'],
  ['replaceBody', 'Chercher-remplacer dans la reponse']
];

const METHODS = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const PRESETS = [
  {
    label: 'Bloquer la telemetrie courante',
    rule: () => ({
      id: uid('bloquer-telemetrie'), enabled: true, name: 'Bloquer la telemetrie',
      match: { urlRegex: 'google-analytics\\.com|googletagmanager\\.com|doubleclick\\.net|facebook\\.net|hotjar\\.com' },
      action: 'block'
    })
  },
  {
    label: 'Bloquer les images d un domaine',
    rule: () => ({
      id: uid('bloquer-images'), enabled: false, name: 'Bloquer les images',
      match: { host: 'exemple.com', type: 'image' }, action: 'block'
    })
  },
  {
    label: 'Rediriger un domaine vers un autre',
    rule: () => ({
      id: uid('redirection'), enabled: false, name: 'Redirection de test',
      match: { urlRegex: '^https://api\\.exemple\\.com/(.*)$' },
      action: 'redirect', redirectUrl: 'https://api-recette.exemple.com/'
    })
  },
  {
    label: 'Imposer un User-Agent',
    rule: () => ({
      id: uid('user-agent'), enabled: false, name: 'User-Agent impose',
      match: { host: 'exemple.com' }, action: 'modifyHeaders',
      requestHeaders: [{ name: 'User-Agent', value: 'INTERCEPTOR', op: 'set' }]
    })
  },
  {
    label: 'Forcer le HTTPS sur un domaine',
    rule: () => ({
      id: uid('https'), enabled: false, name: 'Forcer le HTTPS',
      match: { host: 'exemple.com' }, action: 'upgrade'
    })
  },
  {
    label: 'Simuler une reponse JSON',
    rule: () => ({
      id: uid('simulation'), enabled: false, name: 'Reponse simulee',
      match: { urlRegex: '/api/statut' }, action: 'mock',
      mock: { contentType: 'application/json; charset=utf-8', body: '{"statut":"simule par INTERCEPTOR"}' }
    })
  },
  {
    label: 'Retirer une entete de reponse',
    rule: () => ({
      id: uid('retirer-entete'), enabled: false, name: 'Retirer Content-Security-Policy',
      match: { host: 'exemple.com' }, action: 'modifyHeaders',
      responseHeaders: [{ name: 'Content-Security-Policy', value: '', op: 'remove' }]
    })
  }
];

let jsonMode = false;
let saveTimer = null;

function uid(base) { return base + '-' + Math.random().toString(36).slice(2, 7); }

function rules() { return [...((state.config && state.config.rules) || [])]; }

function commit(list, message) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const config = await saveConfig({ rules: list });
    if (config && message) toast(message);
    render();
  }, 120);
  if (state.config) state.config.rules = list;
}

export function render() {
  const pane = clear($('#view-rules'));
  const box = el('div', { class: 'pane narrow' });
  pane.appendChild(box);
  const config = state.config;
  if (!config) { box.appendChild(el('p', { class: 'note', text: t('Chargement…') })); return; }

  const list = rules();
  const stats = state.stats && state.stats.rules;

  box.appendChild(sec('Interception active', tp('{n} regle(s)', { n: list.length })));
  box.appendChild(el('p', { class: 'note warn', text: t(
    'Par defaut INTERCEPTOR observe sans jamais modifier le trafic. Activer le moteur autorise le blocage, la redirection et la reecriture d entetes. A n utiliser que sur des cibles dont vous avez la responsabilite.') }));

  /* Interrupteur principal */
  const master = el('div', { class: 'opt' }, [
    el('div', { class: 'lbl' }, [
      t('Moteur de regles actif'),
      el('i', { text: t('Desactive, aucune regle n est evaluee : les regles restent enregistrees.') })
    ]),
    el('div', { class: 'ctl' })
  ]);
  const masterInput = el('input', { type: 'checkbox' });
  masterInput.checked = !!config.rulesEnabled;
  masterInput.addEventListener('change', async () => {
    await saveConfig({ rulesEnabled: masterInput.checked });
    toast(t(masterInput.checked ? 'Moteur de regles ACTIF' : 'Moteur de regles arrete'));
    render();
  });
  master.querySelector('.ctl').appendChild(masterInput);
  box.appendChild(master);

  if (stats) {
    box.appendChild(el('p', { class: 'note', text:
      tp('Depuis le demarrage : {e} evaluations, {b} blocages, {r} redirections, {h} entetes modifies.', {
        e: stats.evaluated, b: stats.blocked, r: stats.redirected, h: stats.headersModified }) }));
  }

  /* Barre d actions */
  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Ajouter une regle', () => {
    commit([...rules(), { id: uid('regle'), enabled: false, name: 'Nouvelle regle', match: {}, action: 'block' }], 'Regle ajoutee');
  }, { class: 'accent' }));
  for (const preset of PRESETS) {
    actions.appendChild(button(preset.label, () => commit([...rules(), preset.rule()], 'Modele ajoute'), { class: 'sm' }));
  }
  box.appendChild(actions);

  const actions2 = el('div', { class: 'actions' });
  actions2.appendChild(button(jsonMode ? 'Editeur visuel' : 'Mode JSON', () => { jsonMode = !jsonMode; render(); }));
  actions2.appendChild(button('Copier les regles', () => copy(JSON.stringify(list, null, 2), 'Regles copiees')));
  let armed = false;
  const wipe = button('Tout supprimer', () => {
    if (!armed) {
      armed = true; wipe.textContent = 'Confirmer ?'; wipe.classList.add('armed');
      setTimeout(() => { armed = false; wipe.textContent = 'Tout supprimer'; wipe.classList.remove('armed'); }, 4000);
      return;
    }
    commit([], 'Toutes les regles supprimees');
  }, { class: 'danger' });
  actions2.appendChild(wipe);
  box.appendChild(actions2);

  if (jsonMode) { box.appendChild(jsonEditor(list)); return; }

  if (!list.length) {
    box.appendChild(el('div', { class: 'empty' }, [
      el('b', { text: 'Aucune regle' }),
      'Ajoutez une regle vierge, ou partez d un des modeles ci-dessus.'
    ]));
    return;
  }
  list.forEach((rule, index) => box.appendChild(ruleCard(rule, index, list)));
}

/* ------------------------------- Une regle -------------------------------- */
function ruleCard(rule, index, list) {
  const card = el('div', { class: 'rule' + (rule.enabled ? ' on' : ' off') });
  const update = (patch, message) => {
    const next = list.map((r, i) => (i === index ? { ...r, ...patch } : r));
    commit(next, message);
  };
  const updateMatch = patch => update({ match: { ...(rule.match || {}), ...patch } });

  /* En-tete : activation, nom, deplacement, suppression */
  const head = el('div', { class: 'rule-head' });
  const enabled = el('input', { type: 'checkbox', title: 'Activer cette regle' });
  enabled.checked = !!rule.enabled;
  enabled.addEventListener('change', () => update({ enabled: enabled.checked }));
  head.appendChild(enabled);

  const name = el('input', { type: 'text', class: 'field name', value: rule.name || '', placeholder: 'Nom de la regle' });
  name.addEventListener('change', () => update({ name: name.value }));
  head.appendChild(name);

  head.appendChild(button('↑', () => {
    if (index === 0) return;
    const next = [...list];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    commit(next);
  }, { class: 'sm', title: 'Monter (les regles sont evaluees dans l ordre)' }));
  head.appendChild(button('↓', () => {
    if (index >= list.length - 1) return;
    const next = [...list];
    [next[index + 1], next[index]] = [next[index], next[index + 1]];
    commit(next);
  }, { class: 'sm', title: 'Descendre' }));
  head.appendChild(button('Dupliquer', () => {
    const copyRule = { ...rule, id: uid(rule.id.replace(/-[a-z0-9]{5}$/, '')), name: (rule.name || 'Regle') + ' (copie)' };
    const next = [...list];
    next.splice(index + 1, 0, copyRule);
    commit(next, 'Regle dupliquee');
  }, { class: 'sm' }));
  head.appendChild(button('Supprimer', () => {
    commit(list.filter((_, i) => i !== index), 'Regle supprimee');
  }, { class: 'sm danger' }));
  card.appendChild(head);

  /* Conditions */
  const match = rule.match || {};
  const grid = el('div', { class: 'rule-grid' });
  grid.appendChild(labelled('Hote contient', textInput(match.host, v => updateMatch({ host: v || undefined }), 'exemple.com')));
  grid.appendChild(labelled('URL (expression reguliere)', textInput(match.urlRegex, v => updateMatch({ urlRegex: v || undefined }), '^https://api\\.')));
  grid.appendChild(labelled('Methode', selectInput(METHODS.map(m => [m, m || 'toutes']), match.method || '', v => updateMatch({ method: v || undefined }))));
  grid.appendChild(labelled('Type de ressource', selectInput([['', 'tous']].concat(RESOURCE_TYPES.map(t => [t, t])), match.type || '', v => updateMatch({ type: v || undefined }))));
  grid.appendChild(labelled('Action', selectInput(ACTIONS, rule.action || 'block', v => update({ action: v }))));
  if (rule.action === 'redirect') {
    grid.appendChild(labelled('Rediriger vers ($1 = groupe capture)',
      textInput(rule.redirectUrl, v => update({ redirectUrl: v }), 'https://…')));
  }
  card.appendChild(grid);

  if (rule.action === 'mock') {
    const mock = rule.mock || {};
    const panel = el('div', { class: 'hops' });
    panel.appendChild(sec('Reponse simulee', 'le corps reel du serveur reste enregistre'));
    panel.appendChild(labelled('Type de contenu',
      textInput(mock.contentType, v => update({ mock: { ...mock, contentType: v } }), 'application/json; charset=utf-8')));
    const body = el('textarea', { class: 'field', spellcheck: 'false', rows: '5' });
    body.value = mock.body || '';
    body.addEventListener('change', () => update({ mock: { ...mock, body: body.value } }));
    panel.appendChild(el('label', {}, [t('Corps servi a la page'), body]));
    panel.appendChild(el('p', { class: 'note', text:
      t('Le code de statut d origine est conserve : Firefox ne permet pas de le reecrire depuis une extension.') }));
    card.appendChild(panel);
  }

  if (rule.action === 'delay') {
    const panel = el('div', { class: 'hops' });
    panel.appendChild(sec('Latence injectee', 'plafonnee a 30 000 ms'));
    const champ = el('input', { type: 'number', class: 'field', min: '0', max: '30000',
      value: String(rule.delayMs || 0) });
    champ.addEventListener('change', () => {
      const ms = Math.max(0, Math.min(30000, Number(champ.value) || 0));
      champ.value = String(ms);
      update({ delayMs: ms });
    });
    panel.appendChild(el('label', {}, [t('Attente avant emission (ms)'), champ]));
    panel.appendChild(el('p', { class: 'note', text:
      t('La requete part normalement, mais plus tard : de quoi reproduire un reseau lent sans rien changer d autre.') }));
    card.appendChild(panel);
  }

  if (rule.action === 'replaceBody') {
    const repl = rule.replace || {};
    const panel = el('div', { class: 'hops' });
    panel.appendChild(sec('Chercher-remplacer', 'le corps reel du serveur reste enregistre'));
    panel.appendChild(labelled('Chercher (expression reguliere)',
      textInput(repl.find, v => update({ replace: { ...repl, find: v } }), 'ancien-texte')));
    panel.appendChild(labelled('Remplacer par ($1 = groupe capture)',
      textInput(repl.replace, v => update({ replace: { ...repl, replace: v } }), 'nouveau-texte')));
    panel.appendChild(labelled('Options',
      textInput(repl.flags || 'g', v => update({ replace: { ...repl, flags: v || 'g' } }), 'g, gi, gm…')));
    panel.appendChild(el('p', { class: 'note', text:
      t('Ne s applique qu aux reponses textuelles non compressees. Dans les autres cas le flux passe intact et la raison est inscrite sur la ligne.') }));
    card.appendChild(panel);
  }

  if (rule.action === 'modifyHeaders') {
    card.appendChild(headerOps('Entetes de requete', rule.requestHeaders || [], ops => update({ requestHeaders: ops })));
    card.appendChild(headerOps('Entetes de reponse', rule.responseHeaders || [], ops => update({ responseHeaders: ops })));
  }

  card.appendChild(el('p', { class: alerteDe(rule) ? 'note warn' : 'note', text: describe(rule) }));
  return card;
}

/** Expression d URL ecrite mais illisible : la regle ne correspondra a rien. */
function motifIllisible(rule) {
  const src = rule.match && rule.match.urlRegex;
  if (!src) return false;
  try { new RegExp(src, 'i'); return false; } catch { return true; }
}

/** Vrai quand la ligne merite d etre lue avant d activer la regle. */
function alerteDe(rule) {
  if (motifIllisible(rule)) return true;
  const m = rule.match || {};
  const sansCondition = !m.host && !m.urlRegex && !m.method && !m.type;
  return sansCondition && (rule.action === 'block' || rule.action === 'redirect');
}

/* La phrase qui dit, en clair, ce que la regle fera.
 *
 * Chaque morceau est un gabarit traduit separement puis assemble : une phrase
 * collee bout a bout a l execution ne correspond a aucune cle, et resterait
 * donc en francais. Or c est precisement le texte sur lequel l operateur se
 * fie avant d activer une regle qui modifie du trafic. */
function describe(rule) {
  if (motifIllisible(rule)) {
    return t('L expression d URL de cette regle est illisible : elle ne correspondra a aucune requete tant qu elle n est pas corrigee.');
  }

  const m = rule.match || {};
  const conditions = [
    m.host ? tp('hote contient « {valeur} »', { valeur: m.host }) : null,
    m.urlRegex ? tp('URL correspond a /{motif}/', { motif: m.urlRegex }) : null,
    m.method ? tp('methode {valeur}', { valeur: m.method }) : null,
    m.type ? tp('type {valeur}', { valeur: m.type }) : null
  ].filter(Boolean);

  const quoi = {
    block: () => t('la requete est bloquee'),
    redirect: () => tp('la requete part vers {url}',
      { url: rule.redirectUrl || t('(URL manquante)') }),
    upgrade: () => t('la requete http est renvoyee en https'),
    mock: () => tp('la page recoit une reponse simulee ({n} octets), le corps reel restant enregistre',
      { n: ((rule.mock && rule.mock.body) || '').length }),
    delay: () => tp('la requete part avec {n} ms de retard', { n: rule.delayMs || 0 }),
    replaceBody: () => tp('la page recoit le corps du serveur avec « {cherche} » remplace par « {par} »', {
      cherche: (rule.replace && rule.replace.find) || t('(motif manquant)'),
      par: (rule.replace && rule.replace.replace) || ''
    })
  };
  const what = (quoi[rule.action] || (() => t('les entetes sont reecrits')))();

  return tp('Si {conditions}, alors {effet}.', {
    conditions: conditions.length
      ? conditions.join(t(' ET '))
      : t('AUCUNE condition (toutes les requetes)'),
    effet: what
  });
}

function labelled(text, control) { return el('label', {}, [t(text), control]); }

function textInput(value, onChange, placeholder) {
  const input = el('input', { type: 'text', class: 'field', value: value || '', placeholder: placeholder || '' });
  input.addEventListener('change', () => onChange(input.value.trim()));
  return input;
}

function selectInput(options, value, onChange) {
  const select = el('select', { class: 'field' });
  for (const [v, label] of options) {
    select.appendChild(el('option', { value: v, text: t(label), selected: v === value }));
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function headerOps(title, ops, onChange) {
  const box = el('div', { class: 'hops' });
  box.appendChild(sec(title, ops.length + ' operation(s)'));
  ops.forEach((op, i) => {
    const row = el('div', { class: 'hop' });
    row.appendChild(selectInput([['set', 'Definir'], ['remove', 'Retirer']], op.op || 'set',
      v => onChange(ops.map((o, j) => (j === i ? { ...o, op: v } : o)))));
    row.appendChild(textInput(op.name, v => onChange(ops.map((o, j) => (j === i ? { ...o, name: v } : o))), 'Nom'));
    if ((op.op || 'set') === 'set') {
      row.appendChild(textInput(op.value, v => onChange(ops.map((o, j) => (j === i ? { ...o, value: v } : o))), 'Valeur'));
    }
    row.appendChild(button('✕', () => onChange(ops.filter((_, j) => j !== i)), { class: 'sm danger' }));
    box.appendChild(row);
  });
  box.appendChild(button('Ajouter une operation', () => onChange([...ops, { name: '', value: '', op: 'set' }]), { class: 'sm' }));
  return box;
}

/* ------------------------------- Mode JSON -------------------------------- */
function jsonEditor(list) {
  const box = el('div');
  box.appendChild(sec('Regles au format JSON', 'tableau'));
  const area = el('textarea', { class: 'field', spellcheck: 'false', rows: '20' });
  area.value = JSON.stringify(list, null, 2);
  const status = el('p', { class: 'note', text: list.length + ' regle(s) enregistree(s).' });

  area.addEventListener('change', () => {
    let parsed;
    try {
      parsed = JSON.parse(area.value || '[]');
      if (!Array.isArray(parsed)) throw new Error('un tableau est attendu');
    } catch (e) {
      status.className = 'note ko';
      status.textContent = 'JSON invalide : ' + e.message;
      return;
    }
    status.className = 'note ok';
    status.textContent = parsed.length + ' regle(s) enregistree(s).';
    commit(parsed, 'Regles enregistrees');
  });

  box.appendChild(area);
  box.appendChild(status);
  return box;
}
