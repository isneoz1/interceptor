/* Vue « Interception » — points d arret en direct — INTERCEPTOR (by NeoZ)
 *
 * La seule vue qui retient reellement le trafic. Chaque requete suspendue y
 * attend une decision : laisser passer, abandonner, ou modifier puis envoyer.
 *
 * Trois rappels affiches en permanence, parce qu ils evitent les mauvaises
 * surprises : l interception ne fonctionne que console ouverte, une echeance
 * relache toujours la requete, et fermer la console relache tout.
 */
import { $, el, clear, sec, button, kv, add } from '../lib/dom.js';
import { clock, middle } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { state, cmd, toast, saveConfig } from '../app.js';

let file = { pending: [], count: 0, stats: {} };
let brouillons = new Map();     // id -> { url, entetes } en cours d edition
let enCours = false;

/** Relit la file. Appelee sur diffusion `intercept` et a chaque seconde. */
export async function charger({ silencieux = true } = {}) {
  // Interception coupee et vue fermee : rien a relire. Sans ce garde-fou, on
  // interrogerait le noyau chaque seconde pour apprendre qu il n y a rien.
  const actif = !!(state.config && state.config.interceptEnabled);
  if (!actif && state.view !== 'intercept') {
    if (file.count) { file = { pending: [], count: 0, stats: file.stats || {} }; }
    return;
  }
  if (enCours) return;
  enCours = true;
  const res = await cmd('interceptList', {});
  enCours = false;
  if (res.error) { if (!silencieux) toast(res.error, false); return; }
  file = res;
  if (state.view === 'intercept') render();
}

/** Nombre de requetes suspendues : sert a la pastille de la barre laterale. */
export function attente() { return file.count || 0; }

export function render() {
  const pane = clear($('#view-intercept'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  const config = state.config || {};
  const actif = !!config.interceptEnabled;

  box.appendChild(sec('Interception', actif ? 'active' : 'inactive'));

  /* ------------------------------ Interrupteur --------------------------- */
  const actions = el('div', { class: 'actions' });
  actions.appendChild(button(actif ? 'Arreter l interception' : 'Demarrer l interception', async () => {
    await saveConfig({ interceptEnabled: !actif });
    toast(actif ? 'Interception arretee' : 'Interception demarree');
    charger({ silencieux: false });
    render();
  }, { class: actif ? 'danger' : null }));

  if (file.count) {
    actions.appendChild(button('Tout laisser passer', async () => {
      const res = await cmd('interceptReleaseAll', {});
      if (res.error) return toast(res.error, false);
      toast(res.released + ' requete(s) relachee(s)');
      brouillons.clear();
      charger({ silencieux: false });
    }));
  }
  actions.appendChild(button('Actualiser', () => charger({ silencieux: false })));
  box.appendChild(actions);

  box.appendChild(el('p', { class: 'note', text: t(
    'L interception ne retient une requete que si cette console est ouverte. Une echeance la relache automatiquement, et fermer la console relache tout : une navigation ne peut pas rester bloquee.') }));

  if (!actif) {
    box.appendChild(el('div', { class: 'empty' }, [
      el('b', { text: 'Interception inactive' }),
      t('Demarrez l interception pour suspendre les requetes et les modifier avant leur depart.')
    ]));
    box.appendChild(reglagesRapides(config));
    return;
  }

  box.appendChild(reglagesRapides(config));

  /* -------------------------------- Compteurs ---------------------------- */
  const s = file.stats || {};
  const tuiles = el('div', { class: 'tiles' });
  tuiles.appendChild(tuile(file.count || 0, 'En attente', !!file.count));
  tuiles.appendChild(tuile(s.forwarded || 0, 'Laissees passer'));
  tuiles.appendChild(tuile(s.modified || 0, 'Modifiees'));
  tuiles.appendChild(tuile(s.dropped || 0, 'Abandonnees'));
  tuiles.appendChild(tuile(s.timedOut || 0, 'Relachees par echeance'));
  box.appendChild(tuiles);

  /* --------------------------------- File -------------------------------- */
  if (!file.pending.length) {
    box.appendChild(el('div', { class: 'empty' }, [
      el('b', { text: 'Aucune requete suspendue' }),
      t('Naviguez : la prochaine requete correspondant au filtre s arretera ici.')
    ]));
    return;
  }

  box.appendChild(sec('Requetes suspendues', file.pending.length));
  for (const p of file.pending) box.appendChild(carte(p));
}

function tuile(valeur, libelle, chaud) {
  return el('div', { class: 'tile' + (chaud ? ' alert hot' : '') }, [
    el('b', { text: String(valeur) }),
    el('label', { text: t(libelle) })
  ]);
}

/* --------------------------- Reglages a portee de main -------------------- */
function reglagesRapides(config) {
  const box = el('div');
  box.appendChild(sec('Portee', 'ce qui doit s arreter'));

  const ligne = el('div', { class: 'actions' });
  for (const [cle, libelle] of [['interceptRequests', 'Requetes sortantes'],
                                ['interceptResponses', 'Reponses entrantes']]) {
    const btn = button((config[cle] ? '☑ ' : '☐ ') + t(libelle), async () => {
      await saveConfig({ [cle]: !config[cle] });
      render();
    });
    ligne.appendChild(btn);
  }
  box.appendChild(ligne);

  const filtre = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: t('Filtre (expression reguliere) — vide = toutes les requetes'),
    value: config.interceptFilter || ''
  });
  filtre.addEventListener('change', async () => {
    const valeur = filtre.value.trim();
    if (valeur) {
      try { new RegExp(valeur); }
      catch (e) { return toast('Expression invalide : ' + String(e.message || e), false); }
    }
    await saveConfig({ interceptFilter: valeur });
    toast(valeur ? 'Filtre applique' : 'Filtre retire');
  });
  box.appendChild(el('div', { class: 'actions' }, filtre));

  const echeance = el('input', {
    type: 'number', class: 'field', min: '1000', max: '300000',
    value: String(config.interceptTimeoutMs || 30000), style: 'max-width:140px'
  });
  echeance.addEventListener('change', async () => {
    const ms = Math.max(1000, Math.min(300000, Number(echeance.value) || 30000));
    echeance.value = String(ms);
    await saveConfig({ interceptTimeoutMs: ms });
  });
  box.appendChild(el('label', {}, [t('Echeance de securite (ms)'), echeance]));
  return box;
}

/* ------------------------- Une requete suspendue -------------------------- */
function carte(p) {
  const requete = p.phase === 'onBeforeSendHeaders';
  const brouillon = brouillons.get(p.id) || {
    url: p.url,
    entetes: enTexte(requete ? p.requestHeaders : p.responseHeaders)
  };
  brouillons.set(p.id, brouillon);

  const box = el('div', { class: 'find ' + (requete ? 'high' : 'medium') });
  box.appendChild(el('h4', { text: p.method + '  ' + middle(p.url, 110) }));
  box.appendChild(el('p', {
    text: (requete ? t('Requete sortante') : t('Reponse entrante')) +
          '  ·  ' + (p.statusCode ? p.statusCode + '  ·  ' : '') +
          p.type + '  ·  ' + t('onglet') + ' ' + p.tabId + '  ·  ' + clock(p.at)
  }));

  if (requete) {
    const champUrl = el('input', { type: 'text', class: 'field', spellcheck: 'false', value: brouillon.url });
    champUrl.addEventListener('input', () => { brouillon.url = champUrl.value; });
    box.appendChild(el('label', {}, [t('URL'), champUrl]));
  }

  const zone = el('textarea', { class: 'field', spellcheck: 'false', rows: '6' });
  zone.value = brouillon.entetes;
  zone.addEventListener('input', () => { brouillon.entetes = zone.value; });
  box.appendChild(el('label', {}, [
    requete ? t('Entetes envoyees (une par ligne : Nom: valeur)')
            : t('Entetes recues (une par ligne : Nom: valeur)'),
    zone
  ]));

  const boutons = el('div', { class: 'actions' });
  boutons.appendChild(button('Laisser passer', () => trancher(p.id, 'forward')));
  boutons.appendChild(button('Envoyer modifiee', () => {
    const changes = requete
      ? { url: brouillon.url, requestHeaders: depuisTexte(brouillon.entetes) }
      : { responseHeaders: depuisTexte(brouillon.entetes) };
    trancher(p.id, 'modify', changes);
  }));
  boutons.appendChild(button('Abandonner', () => trancher(p.id, 'drop'), { class: 'danger' }));
  box.appendChild(boutons);

  if (requete && brouillon.url !== p.url) {
    box.appendChild(el('p', { class: 'note', text: t(
      'L URL a change : la requete partira par redirection, et les entetes modifiees ici ne seront pas appliquees a ce depart.') }));
  }
  add(box, kv('Ligne', '#' + p.recordId));
  return box;
}

async function trancher(id, decision, changes) {
  const res = await cmd('interceptResolve', { id, decision, changes });
  if (res.error) return toast(res.error, false);
  brouillons.delete(id);
  toast(decision === 'drop' ? 'Requete abandonnee'
      : decision === 'modify' ? 'Requete modifiee et envoyee'
      : 'Requete laissee passer');
  charger({ silencieux: false });
}

/* -------------------------- Entetes : texte <-> liste --------------------- */
function enTexte(liste) {
  return (liste || []).map(h => h.name + ': ' + h.value).join('\n');
}

function depuisTexte(texte) {
  const out = [];
  for (const ligne of String(texte || '').split(/\r?\n/)) {
    const net = ligne.trim();
    if (!net) continue;
    const coupe = net.indexOf(':');
    if (coupe < 0) continue;
    const name = net.slice(0, coupe).trim();
    if (!name) continue;
    out.push({ name, value: net.slice(coupe + 1).trim() });
  }
  return out;
}
