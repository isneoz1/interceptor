/* Rejouer une requete — INTERCEPTOR (by NeoZ)
 *
 * SEULE fonction de l extension qui emet volontairement du trafic, et la seule
 * a le faire vers une destination choisie. Elle est :
 *   - desactivee par defaut (reglage `replayEnabled`) ;
 *   - toujours declenchee explicitement par un clic, jamais automatiquement ;
 *   - executee par la page d arriere-plan, ce qui rend la requete visible par
 *     nos propres couches de capture : le rejeu apparait dans la liste.
 *
 * L entete X-Interceptor-Replay marque la requete pour qu elle ne puisse jamais
 * etre confondue avec un trafic reel du site.
 */
import { config } from '../core/config.js';
import { store } from '../core/store.js';
import { analyze } from '../core/analyzer.js';

export const replayStats = { sent: 0, failed: 0 };

/* Entetes que le navigateur refuse de laisser definir par fetch(). */
const FORBIDDEN = new Set([
  'accept-charset', 'accept-encoding', 'access-control-request-headers',
  'access-control-request-method', 'connection', 'content-length', 'cookie',
  'cookie2', 'date', 'dnt', 'expect', 'host', 'keep-alive', 'origin',
  'referer', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via'
]);

function buildHeaders(list) {
  const headers = {};
  const refused = [];
  for (const h of list || []) {
    const name = String(h.name || '').trim();
    if (!name) continue;
    if (FORBIDDEN.has(name.toLowerCase()) || /^proxy-|^sec-/i.test(name)) { refused.push(name); continue; }
    headers[name] = String(h.value ?? '');
  }
  headers['X-Interceptor-Replay'] = '1';
  return { headers, refused };
}

/**
 * @param {object} args
 * @param {number} args.id           enregistrement d origine
 * @param {object} [args.overrides]  { method, url, headers, body } modifies dans l interface
 */
export async function replay({ id, overrides = {} }) {
  if (!config.get('replayEnabled')) {
    return { error: 'Le rejeu est desactive. Reglages -> Interception active -> Autoriser le rejeu.' };
  }
  const source = store.get(id);
  if (!source && !overrides.url) return { error: 'enregistrement introuvable' };

  const method = String(overrides.method || (source && source.method) || 'GET').toUpperCase();
  const url = String(overrides.url || (source && (source.finalUrl || source.url)) || '');
  if (!/^https?:/i.test(url)) return { error: 'seules les URL http et https peuvent etre rejouees' };

  const headerList = overrides.headers || (source && source.requestHeaders) || [];
  const { headers, refused } = buildHeaders(headerList);

  const body = overrides.body != null
    ? String(overrides.body)
    : (source && source.requestBody && source.requestBody.text) || null;

  const init = {
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
    redirect: 'follow'
  };
  if (body != null && !['GET', 'HEAD'].includes(method)) init.body = body;

  const startedAt = Date.now();
  try {
    const res = await fetch(url, init);
    const text = await res.text().catch(() => '');
    const outHeaders = [];
    res.headers.forEach((value, name) => outHeaders.push({ name, value }));

    replayStats.sent++;
    const summary = {
      at: startedAt,
      duration: Date.now() - startedAt,
      method, url,
      status: res.status,
      statusText: res.statusText,
      headers: outHeaders,
      bodySize: text.length,
      body: text.length > 200000 ? text.slice(0, 200000) : text,
      truncated: text.length > 200000,
      refusedHeaders: refused
    };

    // La trace est rattachee a l enregistrement d origine : on garde l historique
    // des rejeux au meme endroit que la requete initiale.
    if (source) {
      source.replay = source.replay || { runs: [] };
      source.replay.runs.push(summary);
      store.mark(source, 'replay', startedAt, { status: res.status });
      analyze(source, { force: true });
      store.touch(source.id);
    }
    return { ok: true, result: summary };
  } catch (e) {
    replayStats.failed++;
    return { error: 'echec du rejeu : ' + String(e && e.message || e) };
  }
}
