/* Commandes d outillage et de diagnostic — INTERCEPTOR (by NeoZ)
 *
 * Fusionnees dans la table de rpc.js par `...TOOLING_COMMANDS`, exactement
 * comme les commandes de fichiers : une commande d outillage s ajoute ici,
 * pas dans rpc.js.
 *
 *   importCurl    relit une commande cURL et en fait une requete
 *   debugJournal  lit le journal de diagnostic interne
 *   clearDebug    vide ce journal
 *   debugNote     y ecrit un repere depuis l interface
 */
import { store } from '../core/store.js';
import { analyze } from '../core/analyzer.js';
import { analyserCurl } from '../ingest/curl.js';
import { journal } from '../core/debug.js';
import { listeAttente, resoudre, relacherTout, enAttente, interceptStats } from '../rules/intercept.js';

export const TOOLING_COMMANDS = {
  /* ---------------------- Interception en direct ----------------------- */
  /** File des requetes actuellement suspendues. */
  interceptList: () => ({
    pending: listeAttente(), count: enAttente(), stats: { ...interceptStats }
  }),

  /** Laisser passer, abandonner, ou modifier une requete suspendue. */
  interceptResolve: ({ id, decision, changes }) => {
    if (!['forward', 'drop', 'modify'].includes(decision)) {
      return { error: 'decision inconnue : ' + decision };
    }
    return resoudre(id, decision, changes || {});
  },

  /** Bouton de secours : tout relacher d un coup. */
  interceptReleaseAll: () => ({ ok: true, released: relacherTout() }),

  /**
   * Annote une ligne : commentaire libre et marquage couleur. Les deux
   * survivent au tri, au filtrage et a l export, et se cherchent avec
   * `note:` et `color:` dans la barre de recherche.
   */
  annotateRecord: ({ id, note, color }) => {
    const rec = store.get(id);
    if (!rec) return { error: 'introuvable' };
    if (note !== undefined) rec.note = String(note == null ? '' : note).slice(0, 2000);
    if (color !== undefined) {
      const valides = ['', 'rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet'];
      const choisie = String(color == null ? '' : color);
      if (!valides.includes(choisie)) return { error: 'couleur inconnue : ' + choisie };
      rec.color = choisie;
    }
    store.touch(rec.id);
    return { ok: true, note: rec.note, color: rec.color };
  },

  /**
   * Import d une commande cURL collee dans l interface : le pendant du
   * generateur de code. La ligne creee decrit une requete qui n a jamais ete
   * emise — son etat reste « pending » tant qu on ne la rejoue pas.
   */
  importCurl: ({ commande }) => {
    let parsed;
    try { parsed = analyserCurl(commande); }
    catch (e) { return { error: String(e && e.message || e) }; }

    const rec = store.create({
      requestId: null,
      sources: ['import'],
      url: parsed.url,
      finalUrl: parsed.url,
      method: parsed.method,
      type: 'other',
      startTime: Date.now(),
      imported: true
    });
    rec.requestHeaders = parsed.headers;
    if (parsed.body != null) {
      rec.requestBody = {
        kind: 'raw', text: parsed.body, size: parsed.body.length,
        truncated: false, source: 'import:curl',
        contentType: (parsed.headers.find(h => h.name.toLowerCase() === 'content-type') || {}).value || ''
      };
    }
    store.mark(rec, 'import:curl', rec.startTime, { entetes: parsed.headers.length });
    analyze(rec, { force: true });
    store.touch(rec.id);
    return {
      ok: true, id: rec.id, method: rec.method, url: rec.url,
      headers: parsed.headers.length, warnings: parsed.warnings
    };
  },

  /* ------------------------ Diagnostic interne ------------------------- */
  /** Journal de l extension elle-meme : erreurs, commandes, evenements. */
  debugJournal: ({ niveau = null, source = null, limite = 2000, recherche = '' }) =>
    ({ journal: journal.instantane({ niveau, source, limite, recherche }) }),

  clearDebug: () => { journal.vider(); return { ok: true }; },

  /** Ecrit une entree depuis l interface : sert a marquer un instant precis. */
  debugNote: ({ message, niveau = 'info' }) => {
    const texte = String(message || '').trim();
    if (!texte) return { error: 'message vide' };
    const entree = journal.note(niveau, 'interface', texte);
    return entree ? { ok: true, entree } : { error: 'journal desactive' };
  }
};
