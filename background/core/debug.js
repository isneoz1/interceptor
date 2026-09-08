/* Journal de diagnostic interne — INTERCEPTOR (by NeoZ)
 *
 * Ce module observe l extension elle-meme, pas le trafic. Il repond a une
 * question que rien d autre ne couvrait : « que fait INTERCEPTOR, et qu est-ce
 * qui a echoue chez lui ? »
 *
 * Jusqu ici, chaque `console.warn('[INTERCEPTOR] ...')` du code partait dans la
 * console de la page d arriere-plan, invisible sans passer par about:debugging.
 * On detourne donc console.error / warn / info : toutes les erreurs deja
 * ecrites dans le code existant arrivent ici sans qu il faille les modifier.
 *
 * Rien n est envoye nulle part : le journal vit en memoire, borne, et se vide
 * a la demande.
 */
import { Emitter } from '../lib/emitter.js';
import { config } from './config.js';

export const NIVEAUX = ['error', 'warn', 'info', 'trace'];

class Journal extends Emitter {
  constructor() {
    super();
    this.entrees = [];
    this.seq = 0;
    this.perdues = 0;             // entrees ecartees faute de place
    this.compteurs = { error: 0, warn: 0, info: 0, trace: 0 };
    this.parSource = new Map();   // source -> nombre
    this.lentes = [];             // commandes les plus lentes observees
    this.demarreA = Date.now();
    this.installe = false;
  }

  /** Taille maximale du journal. 0 = illimite, comme partout dans le projet. */
  _plafond() {
    const n = Number(config.get('debugMaxEntries'));
    return Number.isFinite(n) && n > 0 ? n : Infinity;
  }

  note(niveau, source, message, detail = null) {
    if (!config.get('debugEnabled')) return null;
    if (!NIVEAUX.includes(niveau)) niveau = 'info';

    const entree = {
      n: ++this.seq,
      ts: Date.now(),
      niveau,
      source: String(source || 'noyau'),
      message: String(message == null ? '' : message).slice(0, 2000),
      detail: detail == null ? null : detail
    };

    this.entrees.push(entree);
    this.compteurs[niveau]++;
    this.parSource.set(entree.source, (this.parSource.get(entree.source) || 0) + 1);

    const plafond = this._plafond();
    while (this.entrees.length > plafond) { this.entrees.shift(); this.perdues++; }

    this.emit('entree', entree);
    return entree;
  }

  /** Duree d une commande : sert au classement des lenteurs. */
  mesure(nom, ms, erreur) {
    if (!config.get('debugEnabled')) return;
    this.lentes.push({ nom, ms, erreur: erreur || null, ts: Date.now() });
    this.lentes.sort((a, b) => b.ms - a.ms);
    if (this.lentes.length > 25) this.lentes.length = 25;
  }

  vider() {
    this.entrees.length = 0;
    this.lentes.length = 0;
    this.seq = 0;
    this.perdues = 0;
    this.compteurs = { error: 0, warn: 0, info: 0, trace: 0 };
    this.parSource.clear();
    this.demarreA = Date.now();
    this.emit('vide');
  }

  /** Instantane complet, pret pour l interface ou pour un export. */
  instantane({ niveau = null, source = null, limite = 2000, recherche = '' } = {}) {
    const q = String(recherche || '').toLowerCase();
    let liste = this.entrees;
    if (niveau) liste = liste.filter(e => e.niveau === niveau);
    if (source) liste = liste.filter(e => e.source === source);
    if (q) {
      liste = liste.filter(e =>
        e.message.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        (e.detail ? JSON.stringify(e.detail).toLowerCase().includes(q) : false));
    }
    const total = liste.length;
    if (limite > 0 && liste.length > limite) liste = liste.slice(-limite);
    return {
      entrees: liste,
      total,
      retenues: this.entrees.length,
      perdues: this.perdues,
      compteurs: { ...this.compteurs },
      sources: [...this.parSource.entries()].map(([nom, n]) => ({ nom, n })).sort((a, b) => b.n - a.n),
      lentes: this.lentes.slice(0, 25),
      actif: !!config.get('debugEnabled'),
      depuis: this.demarreA,
      plafond: config.get('debugMaxEntries') || 0
    };
  }
}

export const journal = new Journal();

/* ------------------------------------------------------------------ */
/* Detournement des sorties console de la page d arriere-plan           */
/* ------------------------------------------------------------------ */
const ORIGINE = {};

function texteDe(args) {
  return args.map(a => {
    if (a instanceof Error) return a.message;
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
}

function detailDe(args) {
  const erreur = args.find(a => a instanceof Error);
  if (!erreur) return null;
  return { nom: erreur.name, message: erreur.message, pile: String(erreur.stack || '').slice(0, 4000) };
}

/**
 * Installe la capture. Appele une seule fois au demarrage du noyau.
 * La sortie console d origine est toujours appelee : on ajoute une oreille,
 * on ne prive personne de about:debugging.
 */
export function installerDebug() {
  if (journal.installe) return;
  journal.installe = true;

  for (const niveau of ['error', 'warn', 'info']) {
    ORIGINE[niveau] = console[niveau] ? console[niveau].bind(console) : () => {};
    console[niveau] = (...args) => {
      ORIGINE[niveau](...args);
      if (!config.get('debugCaptureErrors')) return;
      try {
        const brut = texteDe(args);
        // Les messages du projet portent tous le meme prefixe : on s en sert
        // comme nom de source quand il est present.
        const marque = /^\[INTERCEPTOR\]\s*/.test(brut);
        journal.note(niveau, marque ? 'interceptor' : 'console',
                     brut.replace(/^\[INTERCEPTOR\]\s*/, ''), detailDe(args));
      } catch { /* le journal ne doit jamais casser l appelant */ }
    };
  }

  const surErreur = (message, detail) => {
    if (!config.get('debugCaptureErrors')) return;
    try { journal.note('error', 'non-capturee', message, detail); } catch {}
  };

  if (typeof self !== 'undefined' && self.addEventListener) {
    self.addEventListener('error', ev => {
      surErreur(ev.message || 'erreur JavaScript', {
        fichier: ev.filename || null, ligne: ev.lineno || null, colonne: ev.colno || null,
        pile: ev.error && ev.error.stack ? String(ev.error.stack).slice(0, 4000) : null
      });
    });
    self.addEventListener('unhandledrejection', ev => {
      const r = ev.reason;
      surErreur(r instanceof Error ? r.message : String(r),
                { type: 'promesse rejetee', pile: r && r.stack ? String(r.stack).slice(0, 4000) : null });
    });
  }

  journal.note('info', 'noyau', 'journal de diagnostic actif');
}

/* Raccourcis utilises par le reste du noyau.
   `trace` est le seul a dependre de `debugCaptureEvents` : c est le flot des
   evenements internes, volumineux, qu on veut pouvoir couper seul. */
export const debug = {
  erreur: (source, message, detail) => journal.note('error', source, message, detail),
  alerte: (source, message, detail) => journal.note('warn', source, message, detail),
  info: (source, message, detail) => journal.note('info', source, message, detail),
  trace: (source, message, detail) =>
    config.get('debugCaptureEvents') ? journal.note('trace', source, message, detail) : null
};
