/* Import d un fichier HAR — INTERCEPTOR (by NeoZ)
 *
 * Permet de relire une capture faite ailleurs (DevTools, Charles, Fiddler…)
 * dans la meme interface. Les fichiers exportes par INTERCEPTOR contiennent
 * l extension `_interceptor` : ils sont alors restaures a l identique, couches
 * de capture, TLS, analyse, trames WebSocket et chronologie comprises.
 *
 * Les lignes importees sont marquees `imported` et portent la couche `import` :
 * elles ne peuvent jamais etre confondues avec une capture en direct.
 */
import { store } from '../core/store.js';
import { analyze } from '../core/analyzer.js';
import { hostOf, pathOf, schemeOf } from '../lib/util.js';

/* ------------------------- Ce qui vient du fichier ------------------------ */
/* Un HAR est ecrit par quelqu un d autre : un autre outil, une version
   anterieure d INTERCEPTOR, ou une main. Rien n y garantit qu une liste soit
   une liste. Et une forme inattendue ne se voit pas a l import — elle se voit
   trois clics plus tard, quand un onglet du detail refuse de s afficher.
   On ramene donc chaque valeur a la forme attendue ici, une fois, plutot que
   de s en defendre a chaque endroit qui la lit. */
const listeObjets = v =>
  Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && !Array.isArray(x)) : [];
const objet = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
const listeTextes = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : [];
const entier = (v, defaut) => Number.isFinite(Number(v)) ? Number(v) : defaut;

/* Les deux flux portent une liste que l interface compte sans la verifier :
   un `websocket` valant `{}` vidait l onglet Flux au lieu de l afficher. */
function flux(v, cleListe) {
  const o = objet(v);
  if (!o) return null;
  const sortie = { ...o, [cleListe]: listeObjets(o[cleListe]) };
  if (cleListe === 'frames') sortie.protocols = listeTextes(o.protocols);
  return sortie;
}

function headerList(list) {
  return listeObjets(list).map(h => ({ name: String(h.name || ''), value: String(h.value ?? '') }));
}

function bodyFromPostData(post) {
  if (!objet(post)) return null;
  const text = post.text || '';
  const formData = {};
  const params = listeObjets(post.params);
  for (const p of params) {
    const key = String(p.name || '');
    if (!key) continue;
    (formData[key] = formData[key] || []).push(String(p.value ?? ''));
  }
  return {
    kind: params.length ? 'formData' : 'raw',
    text,
    size: text.length,
    truncated: false,
    contentType: post.mimeType || '',
    formData: params.length ? formData : undefined
  };
}

function bodyFromContent(content) {
  if (!objet(content)) return null;
  const text = content.encoding === 'base64' ? '' : (content.text || '');
  return {
    kind: content.encoding === 'base64' ? 'binary' : 'text',
    text,
    base64: content.encoding === 'base64' ? (content.text || null) : null,
    preview: null,
    size: content.size || text.length,
    stored: text.length,
    truncated: /tronque/i.test(content.comment || ''),
    mime: content.mimeType || '',
    charset: '',
    contentEncoding: '',
    decompressed: false,
    source: 'har'
  };
}

/**
 * @param {object} har  contenu JSON d un fichier HAR 1.2
 * @returns {{ imported:number, skipped:number, errors:string[] }}
 */
export function importHar(har) {
  const log = har && har.log;
  if (!log || !Array.isArray(log.entries)) {
    return { error: 'fichier HAR invalide : la cle log.entries est absente' };
  }

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const entry of log.entries) {
    /* `store.create` inscrit la ligne des sa creation. Une erreur a mi-chemin
       en laissait donc une a moitie remplie dans le tableau — comptee comme
       ignoree, et pourtant bien visible. On garde de quoi la retirer. */
    let rec = null;
    try {
      const req = objet(entry && entry.request) || {};
      const res = objet(entry && entry.response) || {};
      const url = req.url || '';
      if (!url) { skipped++; continue; }

      const extra = entry._interceptor || {};
      const started = Date.parse(entry.startedDateTime || '') || Date.now();
      const duration = typeof entry.time === 'number' && entry.time >= 0 ? Math.round(entry.time) : null;

      rec = store.create({
        requestId: null,
        sources: ['import', ...listeTextes(extra.sources)].filter((v, i, a) => a.indexOf(v) === i),
        url,
        finalUrl: url,
        method: String(req.method || 'GET').toUpperCase(),
        type: extra.type || 'other',
        tabId: entier(extra.tabId, -1),
        frameId: entier(extra.frameId, -1),
        thirdParty: !!extra.thirdParty,
        startTime: started,
        imported: true
      });

      rec.scheme = schemeOf(url);
      rec.host = hostOf(url);
      rec.path = pathOf(url);
      rec.requestHeaders = headerList(req.headers);
      rec.requestBody = bodyFromPostData(req.postData);
      rec.statusCode = res.status || null;
      rec.statusLine = res.statusText ? (res.httpVersion || 'HTTP/1.1') + ' ' + res.status + ' ' + res.statusText : null;
      rec.responseHeaders = headerList(res.headers);
      rec.responseBody = bodyFromContent(res.content);
      rec.mime = (res.content && res.content.mimeType) || '';
      rec.size = (res.content && res.content.size) || 0;
      rec.ip = entry.serverIPAddress || null;
      rec.duration = duration;
      rec.endTime = started + (duration || 0);
      rec.fromCache = !!extra.fromCache;
      rec.networkless = !!extra.networkless;

      if (objet(entry.timings)) {
        rec.perf = {
          initiatorType: null,
          nextHopProtocol: res.httpVersion || null,
          transferSize: Number.isFinite(Number(extra.transferSize))
            ? Number(extra.transferSize) : null,
          encodedBodySize: null, decodedBodySize: null,
          duration, startTime: null, redirectCount: listeObjets(extra.redirects).length,
          renderBlockingStatus: null, deliveryType: null, serverTiming: null,
          timings: objet(entry.timings), workerStart: null
        };
      }

      // Extensions INTERCEPTOR : restauration fidele de nos propres exports.
      rec.dns = objet(extra.dns);
      rec.security = objet(extra.security);
      rec.proxy = objet(extra.proxy);
      rec.auth = objet(extra.auth);
      rec.redirects = listeObjets(extra.redirects);
      rec.stack = objet(extra.stack);
      rec.ws = flux(extra.websocket, 'frames');
      rec.sse = flux(extra.sse, 'messages');
      rec.rulesApplied = listeObjets(extra.rulesApplied);
      rec.urlClassification = objet(extra.urlClassification);
      /* `null` et non `[]` : l interface n affiche la ligne « Cadres parents »
         que s il y en a, et une liste vide dirait qu on a regarde. */
      rec.frameAncestors = listeObjets(extra.frameAncestors).length
        ? listeObjets(extra.frameAncestors) : null;
      if (extra.cookiesChanged) rec.cookies.changed = listeObjets(extra.cookiesChanged);
      for (const c of listeObjets(res.cookies)) {
        rec.cookies.set.push({
          raw: c.name + '=' + (c.value ?? ''), name: c.name, value: c.value ?? '',
          domain: c.domain || null, path: c.path || null, expires: c.expires || null,
          maxAge: null, secure: !!c.secure, httpOnly: !!c.httpOnly, sameSite: c.sameSite || null
        });
      }
      for (const t of listeObjets(extra.timeline)) store.mark(rec, t.event, t.ts, t.detail);

      store.mark(rec, 'import:har', started, { fichier: log.creator ? log.creator.name : 'inconnu' });
      rec.state = res.status ? 'complete' : 'error';
      analyze(rec, { force: true });
      imported++;
    } catch (e) {
      if (rec) store.remove([rec.id]);
      errors.push(String(e && e.message || e));
      skipped++;
    }
  }

  return { imported, skipped, errors: errors.slice(0, 10), creator: log.creator || null };
}
