/* Capture des corps de reponse via StreamFilter (API exclusive Firefox)
 * INTERCEPTOR (by D4RK)
 *
 * filterResponseData() ne peut etre appele que depuis un listener bloquant.
 * On privilegie onHeadersReceived (on connait alors Content-Type / Content-Length,
 * donc on decide en connaissance de cause) et on retombe automatiquement sur
 * onBeforeRequest si Firefox refuse ce point d'ancrage.
 */
import { B, bytesToBase64, concatChunks, decodeBytes, isTextualMime, looksBinary,
         maybeDecompress, parseContentType, headerGet } from '../lib/util.js';
import { config } from '../core/config.js';
import { store } from '../core/store.js';
import { hexPreview } from './bodies.js';
import { mockFor, replaceFor, noteReplace, noteReplaceSkipped } from '../rules/engine.js';

export const filterState = {
  supported: typeof B !== 'undefined' && !!(B.webRequest && B.webRequest.filterResponseData),
  anchor: 'onHeadersReceived',   // bascule sur 'onBeforeRequest' en cas d'echec
  active: 0,
  captured: 0,
  failed: 0,
  mocked: 0
};

const NO_BODY_TYPES = new Set(['websocket']);

function cap(limit) { return (!limit || limit <= 0) ? Infinity : limit; }

export function shouldCapture(rec) {
  if (!filterState.supported) return false;
  if (!config.get('captureResponseBodies')) return false;
  if (NO_BODY_TYPES.has(rec.type)) return false;
  if (!config.allowBodyForType(rec.type)) return false;
  return true;
}

/**
 * Branche un filtre sur la reponse. Le flux est TOUJOURS reecrit tel quel vers
 * la page : la capture est strictement passive, elle ne peut pas casser un site.
 */
export function attachFilter(rec, requestId, headers) {
  if (!shouldCapture(rec)) return false;

  let filter;
  try {
    filter = B.webRequest.filterResponseData(requestId);
  } catch (e) {
    filterState.failed++;
    if (filterState.anchor === 'onHeadersReceived') {
      filterState.anchor = 'onBeforeRequest';
      console.warn('[INTERCEPTOR] StreamFilter: bascule sur onBeforeRequest', e && e.message);
    }
    return false;
  }

  const ctHeader = headerGet(headers, 'content-type');
  const ceHeader = headerGet(headers, 'content-encoding');
  const { mime, charset } = parseContentType(ctHeader);
  const limit = cap(config.get('maxResponseBodyBytes'));

  // Simulation eventuelle : la page recevra un corps de remplacement, mais le
  // corps reel du serveur reste enregistre — aucune information n est perdue.
  const mock = mockFor(rec, { url: rec.finalUrl || rec.url });

  /* Chercher-remplacer dans le corps servi a la page. Il faut tout accumuler
     avant d ecrire : une substitution peut chevaucher deux morceaux du flux.
     Une simulation l emporte sur un remplacement — inutile de reecrire un
     corps qu on s apprete a jeter. */
  const remplacement = mock ? null : replaceFor(rec, { url: rec.finalUrl || rec.url });
  const compresse = !!(ceHeader && /gzip|deflate|br|zstd/i.test(ceHeader));
  const remplacable = !!remplacement && !compresse && isTextualMime(mime);
  if (remplacement && !remplacable) {
    // On ne touche pas au flux, et on dit pourquoi plutot que d echouer en silence.
    noteReplaceSkipped(rec, remplacement,
      compresse ? 'reponse compressee (' + ceHeader + ')' : 'type non textuel (' + (mime || 'inconnu') + ')');
  }
  const retenir = !!mock || remplacable;

  const chunks = [];
  /* Quand on doit reecrire le corps, on garde TOUT le flux a part, sans se
     soucier de la limite de capture : la limite decide de ce qu on conserve
     dans l enregistrement, jamais de ce que la page recoit. Sans ce tampon
     separe, une limite active servirait a la page un corps tronque. */
  const flotComplet = [];
  let flotLongueur = 0;
  let remplace = null;          // corps reellement servi apres substitution
  let total = 0;
  let kept = 0;
  let truncated = false;
  let done = false;

  filterState.active++;
  if (mock) filterState.mocked++;

  filter.ondata = event => {
    const bytes = new Uint8Array(event.data);
    total += bytes.length;
    if (remplacable) { flotComplet.push(bytes); flotLongueur += bytes.length; }
    if (kept < limit) {
      if (kept + bytes.length <= limit) { chunks.push(bytes); kept += bytes.length; }
      else {
        const room = limit - kept;
        if (room > 0) { chunks.push(bytes.subarray(0, room)); kept += room; }
        truncated = true;
      }
    } else truncated = true;
    // Reecriture integrale : la page recoit exactement ce que le serveur a envoye,
    // sauf simulation explicite, ou le corps d origine est retenu ici.
    if (!retenir) filter.write(event.data);
  };

  const finish = async (status) => {
    if (done) return;
    done = true;
    filterState.active--;
    try {
      let bytes = concatChunks(chunks, kept);
      let decompressed = false;
      if (bytes.length) {
        const r = await maybeDecompress(bytes, ceHeader);
        bytes = r.bytes;
        decompressed = r.decompressed;
      }
      applyResponseBody(rec, bytes, {
        mime, charset, total, truncated, decompressed,
        contentEncoding: ceHeader || '', status
      });
      if (mock && rec.responseBody) {
        rec.responseBody.replacedBy = {
          rule: mock.rule, contentType: mock.contentType,
          body: mock.body, size: mock.body.length
        };
      }
      // Le corps enregistre reste celui du serveur : on note a cote ce que la
      // page a reellement recu, pour ne perdre aucune des deux verites.
      if (remplace != null && rec.responseBody) {
        rec.responseBody.replacedBy = {
          rule: remplacement.rule, contentType: mime || 'text/plain',
          body: remplace.length > 200000 ? remplace.slice(0, 200000) : remplace,
          size: remplace.length
        };
      }
      filterState.captured++;
    } catch (e) {
      filterState.failed++;
      console.warn('[INTERCEPTOR] finalisation corps', e);
    }
  };

  filter.onstop = () => {
    if (mock) {
      // Substitution complete : on ecrit notre corps puis on ferme le flux.
      try {
        filter.write(new TextEncoder().encode(mock.body));
        filter.close();
      } catch (e) {
        filterState.failed++;
        try { filter.disconnect(); } catch {}
      }
    } else if (remplacable) {
      // Rien n a encore ete ecrit : on rend le corps substitue, ou le corps
      // d origine intact si quoi que ce soit echoue. La page recoit toujours
      // quelque chose de coherent.
      const original = concatChunks(flotComplet, flotLongueur);
      try {
        const avant = decodeBytes(original, charset);
        remplacement.re.lastIndex = 0;
        const apres = avant.replace(remplacement.re, remplacement.par);
        if (apres === avant) {
          noteReplaceSkipped(rec, remplacement, 'aucune correspondance');
          filter.write(original);
        } else {
          remplacement.re.lastIndex = 0;
          const combien = (avant.match(remplacement.re) || []).length;
          noteReplace(rec, remplacement, combien);
          filter.write(new TextEncoder().encode(apres));
          remplace = apres;
        }
        filter.close();
      } catch (e) {
        filterState.failed++;
        noteReplaceSkipped(rec, remplacement, 'echec : ' + String(e && e.message || e));
        try { filter.write(original); filter.close(); }
        catch { try { filter.disconnect(); } catch {} }
      }
    } else {
      try { filter.disconnect(); } catch {}
    }
    finish('stop');
  };
  filter.onerror = () => {
    filterState.failed++;
    rec.bodyFilterError = filter.error || 'stream error';
    finish('error');
  };

  return true;
}

export function applyResponseBody(rec, bytes, meta) {
  const text = bytes.length ? decodeBytes(bytes, meta.charset) : '';
  const textual = isTextualMime(meta.mime) && !looksBinary(text);

  const body = {
    kind: textual ? 'text' : 'binary',
    text: textual ? text : '',
    base64: null,
    preview: null,
    size: meta.total,
    stored: bytes.length,
    truncated: !!meta.truncated,
    mime: meta.mime || '',
    charset: meta.charset || '',
    contentEncoding: meta.contentEncoding || '',
    decompressed: !!meta.decompressed,
    source: 'streamFilter'
  };

  if (!textual && config.get('captureBinaryBodies')) {
    const blimit = cap(config.get('maxBinaryBodyBytes'));
    const slice = bytes.length > blimit ? bytes.subarray(0, blimit) : bytes;
    body.base64 = bytesToBase64(slice);
    body.preview = hexPreview(bytes);
    if (slice.length < bytes.length) body.truncated = true;
  }

  rec.responseBody = body;
  if (!rec.mime) rec.mime = body.mime;
  if (meta.total > 0) {
    rec.size = Math.max(rec.size || 0, meta.total);
    store.stats.bytesDown += meta.total;
  }
  store.mark(rec, 'body:captured', Date.now(), { bytes: meta.total, truncated: body.truncated });
  store.touch(rec.id);
}
