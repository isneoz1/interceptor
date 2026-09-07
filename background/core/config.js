/* Configuration persistante — INTERCEPTOR (by D4RK)
 *
 * Regle du projet : toute option presente ici a un effet reel dans le code, et
 * toute option de l interface existe ici. Aucun reglage decoratif.
 * `setConfig` (api/rpc.js) refuse toute cle absente de DEFAULTS.
 */
import { B } from '../lib/util.js';
import { Emitter } from '../lib/emitter.js';

export const DEFAULTS = Object.freeze({
  capturing: true,

  /* ---------------------------- Corps ---------------------------- */
  captureRequestBodies: true,
  captureResponseBodies: true,
  maxRequestBodyBytes: 0,        // 0 = illimite
  maxResponseBodyBytes: 0,
  captureBinaryBodies: true,
  maxBinaryBodyBytes: 0,
  skipBodyTypes: [],             // types de ressource sans capture de corps

  /* ------------------------ Couches de capture -------------------- */
  captureWebRequest: true,
  capturePageHooks: true,
  captureWebSocketFrames: true,
  maxWebSocketFrames: 0,
  maxFrameBytes: 0,
  captureSse: true,
  maxSseMessages: 0,
  capturePerformance: true,
  captureNavigation: true,
  captureCookies: true,
  captureSecurityInfo: true,
  captureDns: true,
  captureProxy: false,
  captureStacks: true,
  captureWebRtc: true,
  captureWorkers: true,
  captureJsCookies: true,
  captureWebTransport: true,
  capturePageVitals: true,

  /* --------------------- Correlation / anti-doublon --------------- */
  dedupEnabled: true,
  dedupWindowMs: 15000,
  dedupSweepMs: 2000,

  /* ---------------------------- Stockage -------------------------- */
  maxRecords: 0,
  persist: false,
  persistMaxRecords: 0,

  /* ----------------------- Filtres d ingestion -------------------- */
  ignoreUrlPatterns: [],
  onlyUrlPatterns: [],
  ignoreTypes: [],
  ignoreOwnRequests: true,

  /* ---------------------------- Analyse --------------------------- */
  analyzerEnabled: true,
  analyzeSecrets: true,
  analyzeTransport: true,
  analyzeHeaders: true,
  analyzeCookies: true,
  analyzeTrackers: true,
  maskSecrets: true,
  extraTrackers: [],             // domaines supplementaires consideres pisteurs
  extraSecretPatterns: [],       // "Nom = expression = severite"

  /* ------------------------ Interception active ------------------- */
  rulesEnabled: false,
  rules: [],
  replayEnabled: false,          // rejouer une requete : sortie reseau volontaire

  /* Interception en direct : suspend le trafic. Inactive sans console ouverte. */
  interceptEnabled: false,
  interceptRequests: true,       // suspendre avant l emission
  interceptResponses: false,     // suspendre a la reception des entetes
  interceptFilter: '',           // expression reguliere ; vide = tout
  interceptTimeoutMs: 30000,     // echeance de securite, jamais illimitee

  /* ------------------------ Diagnostic interne --------------------- */
  debugEnabled: true,            // journal de diagnostic de l extension elle-meme
  debugMaxEntries: 5000,         // 0 = illimite
  debugCaptureErrors: true,      // erreurs, avertissements, promesses rejetees
  debugCaptureRpc: true,         // trace des commandes et de leur duree
  debugCaptureEvents: false,     // flot detaille des evenements internes

  /* ------------------------------ Tutoriel ------------------------- */
  tutorialAuto: true,            // proposer le tutoriel au premier lancement
  tutorialDone: [],              // lecons terminees

  /* ---------------------------- Interface ------------------------- */
  lang: 'fr',                    // fr | en
  simpleMode: false,             // masque les vues avancees
  sortKey: 'time',               // colonne de tri conservee
  sortDir: 'asc',                // sens du tri conserve
  detailHeight: 46,              // hauteur du panneau de detail, en pourcentage
  lastView: 'requests',          // vue rouverte au demarrage
  columnWidths: {},              // largeurs personnalisees, par colonne
  savedFilters: [],              // filtres nommes  [{ name, query }]
  searchHistory: [],             // dernieres recherches saisies
  clearOnNavigate: false,        // vider les lignes d un onglet a chaque navigation
  fontScale: 100,                // taille du texte, en pourcentage
  fontScaleAuto: true,           // ajuste en plus a la taille reelle de la fenetre
  highContrast: false,           // renfort de contraste
  theme: 'sombre',               // sombre | clair | auto
  density: 'confort',            // confort | compact
  timeFormat: 'clock',           // clock | relative | iso
  autoScroll: true,
  defaultScope: 'tab',           // tab | all
  columns: ['risk', 'time', 'method', 'status', 'host', 'path', 'type', 'size', 'duration', 'sources'],
  wrapBodies: true,
  prettyJson: true,
  /* Emplacement de la console, a la maniere de l ancrage des outils Firefox. */
  iconOpens: 'popup',            // popup | onglet | panneau | fenetre
  consolePosition: 'droite',     // droite | gauche | haut | bas | centre | plein | libre
  consoleBornes: null,           // { left, top, width, height } retenues en mode libre
  badgeMode: 'requests',         // requests | alerts | none
  notifyCritical: false          // notification bureau (permission facultative)
});

class Config extends Emitter {
  constructor() {
    super();
    this.values = { ...DEFAULTS };
    this._ignore = [];
    this._only = [];
    this._skipBody = new Set(DEFAULTS.skipBodyTypes);
    this._ignoreTypes = new Set(DEFAULTS.ignoreTypes);
    this.ready = this._load();
  }

  async _load() {
    try {
      const stored = await B.storage.local.get('config');
      if (stored && stored.config) {
        // On ne restaure que des cles connues : une version anterieure ne peut
        // pas injecter d option fantome dans la configuration courante.
        for (const [k, v] of Object.entries(stored.config)) {
          if (k in DEFAULTS) this.values[k] = v;
        }
        // Une version anterieure nommait « console » l ouverture en onglet.
        if (this.values.iconOpens === 'console') this.values.iconOpens = 'onglet';
      }
    } catch (e) { console.warn('[INTERCEPTOR] lecture de la configuration', e); }
    this._compile();
    this.emit('change', this.values);
    return this.values;
  }

  _compile() {
    const compile = list => (list || []).map(p => {
      try { return new RegExp(p, 'i'); } catch { return null; }
    }).filter(Boolean);
    this._ignore = compile(this.values.ignoreUrlPatterns);
    this._only = compile(this.values.onlyUrlPatterns);
    this._skipBody = new Set(this.values.skipBodyTypes || []);
    this._ignoreTypes = new Set(this.values.ignoreTypes || []);
  }

  get(key) { return this.values[key]; }

  async set(patch) {
    Object.assign(this.values, patch);
    this._compile();
    try { await B.storage.local.set({ config: this.values }); }
    catch (e) { console.warn('[INTERCEPTOR] ecriture de la configuration', e); }
    this.emit('change', this.values);
    return this.values;
  }

  async reset() { return this.set({ ...DEFAULTS }); }

  allowUrl(url) {
    if (!url) return false;
    if (this._only.length && !this._only.some(r => r.test(url))) return false;
    if (this._ignore.some(r => r.test(url))) return false;
    return true;
  }

  allowType(type) { return !this._ignoreTypes.has(type); }

  allowBodyForType(type) { return !this._skipBody.has(type); }

  /** Options transmises aux sondes du monde page (content/hooks.js). */
  pageOptions() {
    return {
      wsFrames: this.values.captureWebSocketFrames,
      maxFrameBytes: this.values.maxFrameBytes,
      maxBodyBytes: this.values.maxResponseBodyBytes,
      perf: this.values.capturePerformance,
      stacks: this.values.captureStacks,
      sse: this.values.captureSse,
      rtc: this.values.captureWebRtc,
      workers: this.values.captureWorkers,
      jsCookies: this.values.captureJsCookies,
      webTransport: this.values.captureWebTransport,
      vitals: this.values.capturePageVitals
    };
  }
}

export const config = new Config();
