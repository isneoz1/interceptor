/* Commandes de fichiers — INTERCEPTOR (by D4RK)
 *
 * Exports (HAR, JSON, CSV, Markdown, Postman, URL, reglages, et un script
 * dans chacun des langages du generateur de code), import
 * d une capture HAR externe, import d une session JSON, lecture des cookies
 * d une URL. Tout est construit et ecrit par la page d arriere-plan : fermer
 * une fenetre n interrompt jamais une ecriture en cours.
 */
import { B } from '../lib/util.js';
import { config } from '../core/config.js';
import { journal } from '../core/debug.js';
import { store, detail } from '../core/store.js';
import { buildHar } from '../export/har.js';
import { buildPostman } from '../export/postman.js';
import { buildCsv, buildFindingsReport } from '../export/report.js';
import { generateScript } from '../export/codegen.js';
import { saveFile } from '../export/save.js';
import { importHar } from '../ingest/har.js';
import { collectStats } from './status.js';

function pickRecords(ids, tabId) {
  if (ids && ids.length) return ids.map(id => store.get(id)).filter(Boolean);
  const all = store.all();
  return tabId == null ? all : all.filter(r => r.tabId === tabId);
}

export const FILE_COMMANDS = {
  /* Un seul point d export : le contenu est construit ici et ecrit sur le
     disque par la page d arriere-plan, jamais par une fenetre qui peut se fermer. */
  exportFile: async ({ format, ids = null, tabId = null }) => {
    if (format === 'config') {
      const content = JSON.stringify(config.values, null, 2);
      const res = await saveFile('reglages', 'json', content, 'application/json');
      return res.ok ? { ok: true, count: 1, filename: res.filename, bytes: res.bytes } : { error: res.error };
    }

    // Le journal de diagnostic s exporte meme sans aucune requete capturee :
    // c est justement quand rien ne marche qu on en a besoin.
    if (format === 'debug') {
      const instantane = journal.instantane({ limite: 0 });
      const content = JSON.stringify({
        tool: 'INTERCEPTOR', author: 'D4RK', exportedAt: new Date().toISOString(),
        journal: instantane
      }, null, 2);
      const res = await saveFile('diagnostic', 'json', content, 'application/json');
      return res.ok
        ? { ok: true, count: instantane.entrees.length, filename: res.filename, bytes: res.bytes }
        : { error: res.error };
    }

    const records = pickRecords(ids, tabId);
    if (!records.length) return { error: 'aucune requete a exporter' };

    let content, extension, mime;
    switch (format) {
      case 'har':
        content = JSON.stringify(buildHar(records, { startedAt: store.stats.startedAt }), null, 2);
        extension = 'har'; mime = 'application/json';
        break;
      case 'json':
        content = JSON.stringify({
          tool: 'INTERCEPTOR', author: 'D4RK', exportedAt: new Date().toISOString(),
          stats: collectStats(), records: records.map(detail)
        }, null, 2);
        extension = 'json'; mime = 'application/json';
        break;
      case 'csv':
        content = buildCsv(records); extension = 'csv'; mime = 'text/csv';
        break;
      case 'findings':
        content = buildFindingsReport(records); extension = 'md'; mime = 'text/markdown';
        break;
      case 'postman':
        content = JSON.stringify(buildPostman(records, { startedAt: store.stats.startedAt }), null, 2);
        extension = 'postman_collection.json'; mime = 'application/json';
        break;
      case 'urls':
        content = records.map(r => r.finalUrl || r.url).join(String.fromCharCode(10));
        extension = 'txt'; mime = 'text/plain';
        break;
      default: {
        // Tout generateur de code est aussi un format d export : un langage
        // disponible pour une requete l est pour un lot entier.
        const script = generateScript(format, records);
        if (!script) return { error: 'format inconnu : ' + format };
        content = script.content; extension = script.extension; mime = script.mime;
      }
    }

    const res = await saveFile(format, extension, content, mime);
    return res.ok ? { ok: true, count: records.length, filename: res.filename, bytes: res.bytes }
                  : { error: res.error };
  },

  /** Cookies reellement disponibles pour une URL, HttpOnly compris. */
  cookiesFor: async ({ url }) => {
    if (!url || !/^https?:/i.test(url)) return { error: 'URL http ou https attendue' };
    try {
      const list = await B.cookies.getAll({ url });
      return {
        cookies: list.map(c => ({
          name: c.name, value: c.value, domain: c.domain, path: c.path,
          secure: !!c.secure, httpOnly: !!c.httpOnly, sameSite: c.sameSite || null,
          session: !!c.session, expirationDate: c.expirationDate || null,
          storeId: c.storeId || null, firstPartyDomain: c.firstPartyDomain || null,
          partitionKey: c.partitionKey || null
        }))
      };
    } catch (e) { return { error: String(e && e.message || e) }; }
  },

  /** Import d une capture externe au format HAR. */
  importHar: ({ har }) => {
    if (!har || typeof har !== 'object') return { error: 'contenu HAR invalide' };
    const res = importHar(har);
    return res.error ? res : { ok: true, ...res, stats: collectStats() };
  },

  /** Restauration d une session exportee en JSON par INTERCEPTOR. */
  importSession: ({ session }) => {
    const list = session && Array.isArray(session.records) ? session.records : null;
    if (!list) return { error: 'fichier de session invalide : la cle records est absente' };
    let imported = 0;
    for (const raw of list) {
      try {
        const rec = store.create({ ...raw, id: undefined, requestId: null, imported: true });
        rec.sources = [...new Set(['import', ...(raw.sources || [])])];
        rec._tlKeys = new Set((raw.timeline || []).map(t => t.event + '@' + (t.ts | 0)));
        imported++;
      } catch { /* une ligne illisible ne doit jamais interrompre l import */ }
    }
    return { ok: true, imported, total: list.length, stats: collectStats() };
  },
};
