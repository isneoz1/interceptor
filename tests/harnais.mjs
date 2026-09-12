/* Harnais de test — INTERCEPTOR (cree par NeoZ)
 *
 * Les modules du noyau et de l interface sont ecrits pour un navigateur : ils
 * lisent `browser`, `document`, `window`. Ce fichier fournit le strict
 * minimum pour qu ils s importent et se testent sous Node, sans navigateur ni
 * dependance externe.
 *
 * Regle : le harnais IMITE, il ne SIMULE pas. Aucune fonction ici ne rend une
 * valeur inventee qui pourrait faire passer un test a tort ; les stubs rendent
 * du vide, et chaque test verifie une valeur calculee par le code reel.
 */

/* ------------------------------ Assertions -------------------------------- */
import fs from 'node:fs';
import path from 'node:path';

let total = 0;
let echecs = 0;
const details = [];

export function verifier(nom, condition, remarque = '') {
  total++;
  if (condition) return true;
  echecs++;
  details.push('  ' + nom + (remarque ? '  ->  ' + remarque : ''));
  return false;
}

export function egal(nom, obtenu, attendu) {
  const ok = Object.is(obtenu, attendu);
  return verifier(nom, ok, ok ? '' : 'obtenu ' + affiche(obtenu) + ', attendu ' + affiche(attendu));
}

export function proche(nom, obtenu, attendu, tolerance = 1e-9) {
  const ok = Math.abs(obtenu - attendu) <= tolerance;
  return verifier(nom, ok, ok ? '' : 'obtenu ' + obtenu + ', attendu ' + attendu + ' +/- ' + tolerance);
}

export function memeListe(nom, obtenu, attendu) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  return verifier(nom, a === b, a === b ? '' : 'obtenu ' + a + ', attendu ' + b);
}

export function leve(nom, fn) {
  try { fn(); return verifier(nom, false, 'aucune erreur levee'); }
  catch { return verifier(nom, true); }
}

function affiche(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  if (v instanceof Uint8Array) return '[' + Array.from(v).join(' ') + ']';
  return String(v);
}

/** Bilan final : code de sortie 1 des qu une verification a echoue. */
export function bilan(titre) {
  const reussies = total - echecs;
  if (echecs) {
    console.log('  ' + titre + ' : ' + reussies + '/' + total + ' verifications');
    console.log('  Echecs :');
    for (const ligne of details) console.log(ligne);
    process.exit(1);
  }
  console.log('  ' + titre + ' : ' + total + ' verifications, toutes passees');
  process.exit(0);
}

/* --------------------------- API WebExtension ----------------------------- */
/* Surface reellement utilisee par le code, relevee dans les sources. Les
   ecouteurs sont conserves : certains tests declenchent un evenement. */
function evenement() {
  const ecouteurs = [];
  return {
    addListener: fn => ecouteurs.push(fn),
    removeListener: fn => {
      const i = ecouteurs.indexOf(fn);
      if (i >= 0) ecouteurs.splice(i, 1);
    },
    hasListener: fn => ecouteurs.includes(fn),
    emettre: (...args) => ecouteurs.map(fn => fn(...args)),
    ecouteurs
  };
}

/** Stockage en memoire : suffisant pour config.js, qui lit et ecrit `config`. */
function stockage() {
  const donnees = new Map();
  return {
    donnees,
    get: async cle => {
      if (cle == null) return Object.fromEntries(donnees);
      if (typeof cle === 'string') return donnees.has(cle) ? { [cle]: donnees.get(cle) } : {};
      const out = {};
      for (const k of Array.isArray(cle) ? cle : Object.keys(cle)) {
        if (donnees.has(k)) out[k] = donnees.get(k);
      }
      return out;
    },
    set: async objet => { for (const [k, v] of Object.entries(objet)) donnees.set(k, v); },
    remove: async cle => { for (const k of [].concat(cle)) donnees.delete(k); }
  };
}

export function installerNavigateur() {
  const api = {
    runtime: {
      id: 'interceptor@test',
      getURL: chemin => 'moz-extension://test/' + String(chemin).replace(/^\//, ''),
      getManifest: () => ({ version: '0.0.0-test', name: 'INTERCEPTOR' }),
      sendMessage: async () => ({}),
      connect: () => ({ onMessage: evenement(), onDisconnect: evenement(), postMessage() {} }),
      reload() {},
      onMessage: evenement(),
      onConnect: evenement(),
      onInstalled: evenement()
    },
    storage: { local: stockage() },
    webRequest: {
      onBeforeRequest: evenement(),
      onBeforeSendHeaders: evenement(),
      onSendHeaders: evenement(),
      onHeadersReceived: evenement(),
      onAuthRequired: evenement(),
      onBeforeRedirect: evenement(),
      onResponseStarted: evenement(),
      onCompleted: evenement(),
      onErrorOccurred: evenement(),
      filterResponseData: () => ({ ondata: null, onstop: null, onerror: null, write() {}, disconnect() {} }),
      getSecurityInfo: async () => ({ state: 'insecure' })
    },
    webNavigation: {
      onBeforeNavigate: evenement(),
      onCommitted: evenement(),
      onCompleted: evenement(),
      onDOMContentLoaded: evenement(),
      onHistoryStateUpdated: evenement(),
      onReferenceFragmentUpdated: evenement(),
      onErrorOccurred: evenement()
    },
    cookies: { getAll: async () => [], onChanged: evenement() },
    tabs: {
      create: async () => ({ id: 1 }),
      update: async () => ({ id: 1 }),
      query: async () => [],
      executeScript: async () => []
    },
    windows: {
      create: async () => ({ id: 1 }),
      get: async () => ({ id: 1 }),
      update: async () => ({ id: 1 }),
      remove: async () => {},
      onRemoved: evenement(),
      onBoundsChanged: evenement()
    },
    browserAction: {
      setBadgeText() {}, setBadgeBackgroundColor() {}, setBadgeTextColor() {}, setPopup() {},
      onClicked: evenement()
    },
    sidebarAction: { open: async () => {} },
    menus: { create() {}, removeAll() {}, onClicked: evenement() },
    notifications: { create: async () => 'id' },
    permissions: { contains: async () => false, request: async () => false },
    downloads: { download: async () => 1, onChanged: evenement() },
    proxy: { onRequest: evenement(), onError: evenement() },
    dns: { resolve: async () => ({ addresses: [] }) },
    commands: { onCommand: evenement() },
    extension: { getURL: chemin => 'moz-extension://test/' + chemin }
  };
  globalThis.browser = api;
  globalThis.chrome = api;
  return api;
}

/* ------------------------------ DOM minimal ------------------------------- */
/* Assez pour l import des modules d interface : ils enregistrent des ecouteurs
   au chargement et construisent des noeuds a l appel. Ce n est pas un moteur
   de rendu : aucun test n affirme quoi que ce soit sur la mise en page. */
class Noeud {
  constructor(nom) {
    this.nodeName = String(nom).toUpperCase();
    /* `append` de ui/lib/dom.js reconnait un noeud a son `nodeType` : sans
       lui, chaque enfant devenait la chaine « [object Object] » et tout ce
       qui etait imbrique disparaissait du rendu sans erreur. Les valeurs
       sont celles du DOM : 1 element, 3 texte, 11 fragment. */
    this.nodeType = nom === '#text' ? 3 : (nom === '#fragment' ? 11 : 1);
    this.children = [];
    this.childNodes = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.classList = ensembleDeClasses(this);
    this.textContent = '';
    this.hidden = false;
    this.parentElement = null;
    /* Une geometrie plausible plutot que des zeros. Le tableau des requetes
       calcule sa fenetre virtuelle a partir de `clientHeight` et de la hauteur
       d une ligne : avec des zeros partout il n en dessinait aucune, et la vue
       la plus employee de la console restait hors de portee des tests. */
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.clientWidth = 1200;
    this.clientHeight = 800;
    this.offsetWidth = 1200;
    this.offsetHeight = 800;
  }
  /* `el` pose les classes avec `className`, le selecteur les lit dans
     `classList` : sans ce pont, les deux ne parlaient pas de la meme chose. */
  get className() { return [...this.classList._set].join(' '); }
  set className(valeur) {
    this.classList._set.clear();
    for (const c of String(valeur == null ? '' : valeur).split(/\s+/)) {
      if (c) this.classList._set.add(c);
    }
  }
  get parentNode() { return this.parentElement; }
  appendChild(n) {
    if (n == null) return n;
    /* Un fragment verse ses enfants et reste vide : c est tout son interet.
       L inserer tel quel faisait compter les LOTS au lieu des elements. */
    if (n.nodeType === 11) {
      for (const enfant of [...n.children]) this.appendChild(enfant);
      n.children.length = 0;
      n.childNodes.length = 0;
      return n;
    }
    this.children.push(n);
    this.childNodes.push(n);
    n.parentElement = this;
    return n;
  }
  append(...n) { for (const x of n) this.appendChild(x); }
  /* `liste-progressive.js` insere ses lots avant la sentinelle plutot que de
     redessiner : sans cette methode, la carte des sites ne se rendait pas. */
  insertBefore(n, reference) {
    if (n == null) return n;
    const i = reference == null ? -1 : this.childNodes.indexOf(reference);
    if (n.nodeType === 11) {
      const enfants = [...n.children];
      n.children.length = 0;
      n.childNodes.length = 0;
      for (const enfant of enfants) this.insertBefore(enfant, reference);
      return n;
    }
    if (i < 0) return this.appendChild(n);
    this.children.splice(i, 0, n);
    this.childNodes.splice(i, 0, n);
    n.parentElement = this;
    return n;
  }
  /* `clear` boucle sur firstChild jusqu au vide : sans lui, il ne vidait rien
     et deux rendus successifs s empilaient. */
  get firstChild() { return this.childNodes.length ? this.childNodes[0] : null; }
  removeChild(n) {
    const i = this.children.indexOf(n);
    if (i >= 0) { this.children.splice(i, 1); this.childNodes.splice(i, 1); }
    return n;
  }
  remove() { if (this.parentElement) this.parentElement.removeChild(this); }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  removeAttribute(k) { this.attributes.delete(k); }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
  querySelector(selecteur) { return chercherDans(this, selecteur)[0] || null; }
  querySelectorAll(selecteur) { return chercherDans(this, selecteur); }
  closest(selecteur) {
    for (let n = this; n; n = n.parentElement) if (correspond(n, selecteur)) return n;
    return null;
  }
  matches() { return false; }
  contains() { return false; }
  focus() {}
  click() {}
  scrollTo() {}
  /* La hauteur rendue est celle d une ligne de tableau : c est ce que
     `rowsize.js` mesure pour en deduire combien de lignes tiennent. */
  getBoundingClientRect() {
    return { top: 0, left: 0, right: 1200, bottom: 26, width: 1200, height: 26 };
  }
}

/* Un selecteur simple : « input », « .trow », « #pal-q », « div.kv ». Les
   combinaisons descendantes ne sont pas gerees — l interface n en cherche
   aucune dans un noeud qu elle vient de construire. Un selecteur qui
   depasserait cette grammaire ne doit pas rendre un faux negatif en silence,
   il doit se voir : d ou l erreur. */
function correspond(noeud, selecteur) {
  const brut = String(selecteur == null ? '' : selecteur).trim();
  if (!brut) return false;
  if (/[\s>+~[\]:,()]/.test(brut)) {
    throw new Error('selecteur trop riche pour le DOM du harnais : ' + brut);
  }
  for (const partie of brut.split(/(?=[.#])/)) {
    if (!partie) continue;
    if (partie[0] === '.') {
      if (!noeud.classList.contains(partie.slice(1))) return false;
    } else if (partie[0] === '#') {
      if (noeud.getAttribute('id') !== partie.slice(1)) return false;
    } else if (noeud.nodeName !== partie.toUpperCase()) {
      return false;
    }
  }
  return true;
}

/* En profondeur d abord, dans l ordre du document : c est l ordre que rend un
   vrai querySelectorAll, et le premier resultat doit etre le meme. */
function chercherDans(racine, selecteur) {
  const trouves = [];
  (function parcourir(n) {
    for (const enfant of n.children || []) {
      if (correspond(enfant, selecteur)) trouves.push(enfant);
      parcourir(enfant);
    }
  })(racine);
  return trouves;
}

function ensembleDeClasses(noeud) {
  const set = new Set();
  return {
    add: (...c) => c.forEach(x => set.add(x)),
    remove: (...c) => c.forEach(x => set.delete(x)),
    toggle: (c, force) => {
      const veut = force === undefined ? !set.has(c) : !!force;
      if (veut) set.add(c); else set.delete(c);
      return veut;
    },
    contains: c => set.has(c),
    get length() { return set.size; },
    _set: set,
    _noeud: noeud
  };
}

export function installerDom() {
  const document = {
    documentElement: new Noeud('html'),
    body: new Noeud('body'),
    head: new Noeud('head'),
    createElement: nom => new Noeud(nom),
    createTextNode: texte => Object.assign(new Noeud('#text'), { textContent: String(texte) }),
    createDocumentFragment: () => new Noeud('#fragment'),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; }
  };
  document.body.dataset = {};

  globalThis.document = document;
  globalThis.Node = Noeud;
  /* Node fournit deja Event et CustomEvent : les remplacer casserait tout ce
     qui s appuie dessus dans la plateforme, WebSocket compris. */
  if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    };
  }
  if (typeof globalThis.Event === 'undefined') globalThis.Event = globalThis.CustomEvent;
  globalThis.window = {
    document,
    addEventListener() {},
    removeEventListener() {},
    close() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    devicePixelRatio: 1,
    innerWidth: 1600,
    innerHeight: 900,
    location: { href: 'moz-extension://test/ui/console.html', search: '' }
  };
  if (!globalThis.navigator) globalThis.navigator = {};
  if (!globalThis.navigator.clipboard) {
    try {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: { writeText: async () => {}, readText: async () => '' },
        configurable: true
      });
    } catch { /* navigator scelle par Node : sans consequence pour ces tests */ }
  }
  globalThis.localStorage = {
    _d: new Map(),
    getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
    setItem(k, v) { this._d.set(k, String(v)); },
    removeItem(k) { this._d.delete(k); }
  };
  globalThis.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 0);
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  return document;
}

/** Le decor complet, dans l ordre attendu par les modules. */
export function installerTout() {
  installerNavigateur();
  installerDom();
}

/**
 * Pose dans le document les identifiants que les pages HTML declarent, pour
 * que les vues puissent se rendre pour de bon.
 *
 * Les vues commencent toutes par `clear($('#view-...'))` : sans ces noeuds,
 * elles levaient une erreur avant leur premiere ligne et aucun test ne
 * pouvait les executer. Les identifiants sont lus dans les fichiers reels —
 * jamais recopies — donc un renommage dans la page arrive ici le jour meme.
 *
 * @param racine  la racine du depot
 * @param pages   les pages a lire (par defaut la console et la popup)
 * @returns la carte identifiant -> noeud, pour inspecter un rendu
 */
export function installerPage(racine, pages = ['ui/console.html', 'ui/popup.html']) {
  const parId = new Map();
  for (const page of pages) {
    let source;
    try { source = fs.readFileSync(path.join(racine, page), 'utf8'); }
    catch { continue; }
    for (const m of source.matchAll(/\sid="([^"]+)"/g)) {
      if (parId.has(m[1])) continue;
      const noeud = new Noeud('div');
      noeud.setAttribute('id', m[1]);
      parId.set(m[1], noeud);
      document.body.appendChild(noeud);
    }
  }

  /* Seuls les selecteurs par identifiant sont resolus : c est ce que `$`
     cherche dans la page, et pretendre resoudre davantage donnerait un faux
     sentiment de fidelite. */
  document.getElementById = id => parId.get(id) || null;
  document.querySelector = selecteur => {
    const brut = String(selecteur || '').trim();
    return brut[0] === '#' ? (parId.get(brut.slice(1)) || null) : null;
  };
  document.querySelectorAll = selecteur => {
    const trouve = document.querySelector(selecteur);
    return trouve ? [trouve] : [];
  };
  return parId;
}

/* --------------------------- Donnees d exemple ---------------------------- */
/* Un enregistrement realiste, conforme a la forme produite par le noyau. Sert
   aux tests du noyau ET a la generation des captures d ecran. */
export function enregistrementExemple(patch = {}) {
  const debut = Date.UTC(2026, 0, 15, 10, 30, 0);
  return {
    id: 1,
    requestId: '1234',
    sources: ['webRequest'],
    url: 'https://api.exemple.fr/v2/comptes/42?champs=solde,devise',
    finalUrl: 'https://api.exemple.fr/v2/comptes/42?champs=solde,devise',
    method: 'POST',
    type: 'xmlhttprequest',
    scheme: 'https',
    host: 'api.exemple.fr',
    path: '/v2/comptes/42',
    tabId: 3,
    frameId: 0,
    parentFrameId: -1,
    windowId: 1,
    thirdParty: false,
    requestHeaders: [
      { name: 'Host', value: 'api.exemple.fr' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.signature' },
      { name: 'Accept', value: 'application/json' }
    ],
    requestBody: { size: 34, kind: 'texte', source: 'webRequest', text: '{"operation":"solde","devise":"EUR"}' },
    statusCode: 200,
    statusLine: 'HTTP/2 200 OK',
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Cache-Control', value: 'max-age=300, must-revalidate' },
      { name: 'Date', value: new Date(debut).toUTCString() },
      { name: 'ETag', value: '"a1b2c3"' },
      { name: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.exemple.fr" },
      { name: 'Set-Cookie', value: 'session=abc123; Path=/; HttpOnly' }
    ],
    responseBody: { size: 96, kind: 'texte', source: 'streamFilter', text: '{"solde":128000,"devise":"EUR"}' },
    mime: 'application/json',
    ip: '203.0.113.42',
    wireRequestSize: 512,
    wireResponseSize: 1024,
    fromCache: false,
    redirects: [],
    cookies: { set: [], changed: [] },
    rulesApplied: [],
    analysis: null,
    flag: false,
    note: '',
    color: '',
    startTime: debut,
    endTime: debut + 128,
    duration: 128,
    size: 96,
    state: 'complete',
    timeline: [],
    dedup: { signature: '', merged: 0, mergedFrom: [] },
    ...patch
  };
}
