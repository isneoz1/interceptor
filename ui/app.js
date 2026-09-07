/* Etat partage et services communs — INTERCEPTOR (by D4RK)
 *
 * Utilise a l identique par la console plein ecran, le panneau lateral et la
 * popup : une seule logique d acces au noyau, une seule mise en forme.
 */
import { $, el, clear } from './lib/dom.js';
import { matchTerms } from './lib/filters.js';
import { setLang, t } from './lib/i18n.js';

export const B = typeof browser !== 'undefined' ? browser : chrome;

/** Appel de commande vers le noyau. Toute erreur est normalisee. */
export async function cmd(name, args) {
  try {
    const res = await B.runtime.sendMessage({ t: 'cmd', cmd: name, args: args || {} });
    return res || { error: 'aucune reponse du noyau' };
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}

export const state = {
  records: new Map(),
  order: [],
  tabId: null,
  scope: 'tab',          // 'tab' | 'all' | un identifiant d onglet precis
  query: '',
  terms: [],
  deep: false,
  deepIds: null,
  facets: new Set(),
  sort: { key: 'time', dir: 'asc' },
  selection: new Set(),
  selected: null,
  view: 'requests',
  config: null,
  caps: null,
  stats: null,
  lastTotal: 0,
  rate: 0,
  rates: [],             // debit mesure seconde par seconde (sparkline)

  /* Ce que l utilisateur a reellement fait : sert au tutoriel, qui ne coche
     jamais une case a sa place. */
  seen: {
    views: new Set(),
    detail: false,
    tabs: 0,
    filter: false,
    facet: false,
    sort: false,
    selection: false
  }
};

/* --------------------------------- Toast --------------------------------- */
let toastTimer = null;
export function toast(message, ok = true) {
  let node = $('#toast');
  if (!node) {
    node = el('div', { class: 'toast', id: 'toast' });
    document.body.appendChild(node);
  }
  node.textContent = t(message);
  node.classList.toggle('ko', !ok);
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, ok ? 2400 : 4200);
}

export async function copy(text, label = 'Copie dans le presse-papiers') {
  try { await navigator.clipboard.writeText(String(text)); toast(label); return true; }
  catch { toast('Copie refusee par le navigateur', false); return false; }
}

/* --------------------------------- Menus --------------------------------- */
export function closeMenus(except) {
  for (const m of document.querySelectorAll('.menu')) if (m !== except) m.hidden = true;
}

/**
 * Menu deroulant construit a la demande.
 * items : [{ label, action, checked, kind:'sep'|'head', class }]
 */
export function dropdown(button, itemsFn, opts = {}) {
  const wrap = button.closest('.menu-wrap') || button.parentElement;
  const menu = el('div', { class: 'menu' + (opts.up ? ' up' : '') + (opts.left ? ' left' : ''), hidden: true });
  wrap.appendChild(menu);

  // Le contenu est reconstruit a chaque ouverture, et apres toute action qui
  // laisse le menu ouvert : les cases cochees refletent toujours l etat reel.
  function build() {
    clear(menu);
    for (const item of itemsFn()) {
      if (!item) continue;
      if (item.kind === 'sep') { menu.appendChild(el('hr')); continue; }
      if (item.kind === 'head') { menu.appendChild(el('div', { class: 'head', text: t(item.label) })); continue; }
      const line = el('button', { class: item.class || null, type: 'button' }, [
        item.checked === undefined ? null : el('span', { text: item.checked ? '☑' : '☐' }),
        el('span', { text: t(item.label) })
      ]);
      line.addEventListener('click', ev2 => {
        ev2.stopPropagation();
        if (!item.keepOpen) menu.hidden = true;
        item.action && item.action();
        if (item.keepOpen) build();
      });
      menu.appendChild(line);
    }
  }

  button.addEventListener('click', ev => {
    ev.stopPropagation();
    const opening = menu.hidden;
    closeMenus();
    if (!opening) { menu.hidden = true; return; }
    build();
    menu.hidden = false;
  });

  return menu;
}

document.addEventListener('click', () => closeMenus());

/* --------------------------------- Theme --------------------------------- */
let mediaWatcher = null;
export function applyTheme(config) {
  if (!config) return;
  setLang(config.lang);
  document.documentElement.lang = config.lang === 'en' ? 'en' : 'fr';
  const root = document.documentElement;
  const resolve = () => {
    if (config.theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'clair' : 'sombre';
    }
    return config.theme === 'clair' ? 'clair' : 'sombre';
  };
  root.dataset.theme = resolve();
  document.body.dataset.density = config.density === 'compact' ? 'compact' : 'confort';
  document.body.dataset.contrast = config.highContrast ? 'fort' : 'normal';
  appliquerEchelle(config);

  suivreTaille(config);

  if (mediaWatcher) { mediaWatcher.onchange = null; mediaWatcher = null; }
  if (config.theme === 'auto') {
    mediaWatcher = window.matchMedia('(prefers-color-scheme: light)');
    mediaWatcher.onchange = () => { root.dataset.theme = resolve(); };
  }
}

/* ------------------------- Connexion au flux direct ----------------------- */
export function connect(handlers) {
  let port = null;
  try {
    port = B.runtime.connect({ name: 'interceptor-ui' });
  } catch {
    toast('Noyau injoignable — rechargez l extension', false);
    return null;
  }

  port.onMessage.addListener(msg => {
    if (msg.t === 'delta') {
      for (const rec of msg.records) {
        if (!state.records.has(rec.id)) state.order.push(rec.id);
        state.records.set(rec.id, rec);
      }
      handlers.onDelta && handlers.onDelta(msg.records);
    } else if (msg.t === 'stats') {
      applyStats(msg.stats);
      handlers.onStats && handlers.onStats(msg.stats);
    } else if (msg.t === 'cleared') {
      state.records.clear();
      state.order.length = 0;
      state.selection.clear();
      state.lastTotal = 0;
      handlers.onClear && handlers.onClear();
    } else if (msg.t === 'removed') {
      for (const id of msg.ids || []) { state.records.delete(id); state.selection.delete(id); }
      const gone = new Set(msg.ids || []);
      state.order = state.order.filter(id => !gone.has(id));
      handlers.onRemoved && handlers.onRemoved(msg.ids || []);
    } else if (msg.t === 'intercept') {
      handlers.onIntercept && handlers.onIntercept();
    } else if (msg.t === 'hello' || msg.t === 'config') {
      if (msg.stats) applyStats(msg.stats);
      if (msg.capabilities) state.caps = msg.capabilities;
      if (msg.config) { state.config = msg.config; applyTheme(msg.config); }
      handlers.onConfig && handlers.onConfig(msg.config);
    }
  });

  port.onDisconnect.addListener(() => {
    handlers.onDisconnect && handlers.onDisconnect();
  });

  return port;
}

export function applyStats(stats) {
  if (!stats) return;
  state.rate = Math.max(0, stats.store.total - state.lastTotal);
  state.lastTotal = stats.store.total;
  state.stats = stats;
  // Historique du debit : 30 mesures, une par seconde, pour le diagramme vif.
  state.rates.push(state.rate);
  if (state.rates.length > 30) state.rates.shift();
}

/** Ecrit un reglage : mise a jour optimiste puis persistance par le noyau. */
export async function saveConfig(patch) {
  if (state.config) Object.assign(state.config, patch);
  const res = await cmd('setConfig', { patch });
  if (res.error) { toast(res.error, false); return null; }
  state.config = res.config;
  applyTheme(res.config);
  return res.config;
}

/* ---------------------------- Selection de lignes -------------------------- */
export function inScope(rec) {
  if (state.scope === 'all') return true;
  if (state.scope === 'tab') return state.tabId == null || rec.tabId === state.tabId;
  const wanted = Number(state.scope);
  return Number.isFinite(wanted) ? rec.tabId === wanted : true;
}

/** Enregistrements visibles : perimetre, facettes, recherche. */
export function visibleRecords(facetTest) {
  const out = [];
  for (const id of state.order) {
    const rec = state.records.get(id);
    if (!rec) continue;
    if (!inScope(rec)) continue;
    if (state.facets.size && facetTest && !facetTest(rec)) continue;
    if (state.deepIds) { if (!state.deepIds.has(rec.id)) continue; }
    else if (state.terms.length && !matchTerms(rec, state.terms)) continue;
    out.push(rec);
  }
  return out;
}

/** Nombre d enregistrements dans le perimetre, filtres exclus. */
export function scopeCount() {
  let n = 0;
  for (const id of state.order) {
    const rec = state.records.get(id);
    if (rec && inScope(rec)) n++;
  }
  return n;
}

/** Recupere l instantane complet au demarrage. */
export async function bootstrap() {
  try {
    const tabs = await B.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) state.tabId = tabs[0].id;
  } catch { /* le perimetre « tout Firefox » reste disponible */ }

  const snap = await cmd('snapshot', { tabId: null, limit: 0 });
  if (snap.error) { toast(snap.error, false); return false; }

  for (const rec of snap.records) {
    if (!state.records.has(rec.id)) state.order.push(rec.id);
    state.records.set(rec.id, rec);
  }
  state.lastTotal = snap.stats.store.total;
  state.stats = snap.stats;
  state.config = snap.config;
  state.caps = snap.capabilities;
  state.scope = snap.config.defaultScope === 'all' ? 'all' : 'tab';
  if (snap.config.sortKey) state.sort = { key: snap.config.sortKey, dir: snap.config.sortDir || 'asc' };
  applyTheme(snap.config);
  return true;
}

/* ===================== Adaptation a la taille de l ecran ==================== */
/**
 * L interface doit etre lisible partout : dans un panneau lateral de 340 px
 * comme sur un ecran de 4 000 px. On calcule donc un facteur d echelle a
 * partir de la fenetre reelle, borne des deux cotes — jamais minuscule,
 * jamais enorme — et on le multiplie par la preference de l utilisateur.
 *
 * Tout le socle visuel s appuie sur `--scale` : texte, hauteurs de ligne,
 * boutons et champs suivent ensemble, sans qu aucune valeur soit figee.
 */
export function facteurEcran(largeur, hauteur) {
  const l = Number(largeur) || 1200;
  const h = Number(hauteur) || 800;
  // Sous 700 px on est dans le panneau lateral : on resserre juste ce qu il
  // faut pour que le tableau tienne, sans passer sous le seuil de lisibilite.
  const parLargeur = l <= 380 ? 0.90
    : l <= 560 ? 0.94
    : l <= 900 ? 0.98
    : l <= 1500 ? 1
    : l <= 2000 ? 1.07
    : l <= 2800 ? 1.15
    : 1.22;
  // Une fenetre basse (portable 768 px) gagne a etre un peu plus dense.
  const parHauteur = h <= 620 ? 0.95 : h >= 1300 ? 1.04 : 1;
  const facteur = parLargeur * parHauteur;
  return Math.round(Math.min(1.30, Math.max(0.88, facteur)) * 100) / 100;
}

/** Applique la preference de l utilisateur, ajustee a l ecran quand il le veut. */
export function appliquerEchelle(config) {
  const root = document.documentElement;
  const choix = Math.min(140, Math.max(80, Number(config && config.fontScale) || 100)) / 100;
  const auto = (config && config.fontScaleAuto === false)
    ? 1
    : facteurEcran(window.innerWidth, window.innerHeight);
  const total = Math.min(1.7, Math.max(0.75, choix * auto));
  const avant = root.style.getPropertyValue('--scale');
  root.style.setProperty('--scale', total.toFixed(2));
  root.style.setProperty('--scale-auto', auto.toFixed(2));
  // La largeur sert aussi aux vues qui adaptent leur mise en page en JS.
  root.dataset.largeur = window.innerWidth <= 560 ? 'etroite'
    : window.innerWidth <= 900 ? 'moyenne' : 'large';
  // L echelle change la hauteur des lignes : les vues qui mesurent le DOM
  // (tableau virtualise) doivent remesurer, sinon elles gardent l ancienne.
  if (avant !== root.style.getPropertyValue('--scale')) {
    document.dispatchEvent(new CustomEvent('ic:echelle', { detail: { scale: total } }));
  }
}

let suiviTaille = null;
/** Recalcule l echelle quand la fenetre change, sans redessiner a chaque pixel. */
function suivreTaille(config) {
  if (suiviTaille) window.removeEventListener('resize', suiviTaille);
  let attente = null;
  suiviTaille = () => {
    if (attente) clearTimeout(attente);
    attente = setTimeout(() => appliquerEchelle(config), 120);
  };
  window.addEventListener('resize', suiviTaille);
}
