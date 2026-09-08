/* Decodage des corps de requete fournis par webRequest — INTERCEPTOR (by NeoZ) */
import { config } from '../core/config.js';
import { bytesToBase64, decodeBytes, looksBinary, truncateText } from '../lib/util.js';

function cap(limit) { return (!limit || limit <= 0) ? Infinity : limit; }

/**
 * details.requestBody peut contenir :
 *   - formData : champs deja parses (multipart / urlencoded)
 *   - raw      : liste d'ArrayBuffer (+ eventuellement des `file` non lisibles)
 *   - error    : Firefox n'a pas pu lire le corps
 */
export function decodeRequestBody(requestBody, contentType) {
  if (!requestBody) return null;

  if (requestBody.error) {
    return { kind: 'error', error: requestBody.error, size: 0, truncated: false, text: '' };
  }

  if (requestBody.formData) {
    const formData = {};
    let size = 0;
    for (const [k, v] of Object.entries(requestBody.formData)) {
      formData[k] = Array.isArray(v) ? v : [String(v)];
      size += k.length;
      for (const item of formData[k]) size += String(item).length;
    }
    const text = Object.entries(formData)
      .map(([k, vals]) => vals.map(v => k + '=' + v).join('\n'))
      .join('\n');
    return { kind: 'formData', formData, text, size, truncated: false, contentType: contentType || '' };
  }

  if (requestBody.raw && requestBody.raw.length) {
    const limit = cap(config.get('maxRequestBodyBytes'));
    const parts = [];
    let total = 0;
    let truncated = false;
    let hasFile = false;

    for (const chunk of requestBody.raw) {
      if (chunk.file) { hasFile = true; continue; }
      if (!chunk.bytes) continue;
      const u8 = new Uint8Array(chunk.bytes);
      total += u8.length;
      if (total > limit) {
        const room = Math.max(0, limit - (total - u8.length));
        if (room > 0) parts.push(u8.subarray(0, room));
        truncated = true;
        break;
      }
      parts.push(u8);
    }

    const merged = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) { merged.set(p, off); off += p.length; }

    const text = decodeBytes(merged, 'utf-8');
    const binary = looksBinary(text);
    const out = {
      kind: binary ? 'binary' : 'raw',
      size: total,
      truncated,
      contentType: contentType || '',
      text: binary ? '' : text,
      base64: null,
      hasFileUpload: hasFile
    };
    if (binary && config.get('captureBinaryBodies')) {
      const blimit = cap(config.get('maxBinaryBodyBytes'));
      const slice = merged.length > blimit ? merged.subarray(0, blimit) : merged;
      out.base64 = bytesToBase64(slice);
      if (slice.length < merged.length) out.truncated = true;
      out.preview = hexPreview(merged);
    }
    return out;
  }

  return { kind: 'empty', size: 0, truncated: false, text: '' };
}

/** Corps remonte par les hooks page (fetch / XHR / beacon) : deja du texte. */
export function normalizePageBody(body) {
  if (body == null) return null;
  if (typeof body === 'string') {
    const t = truncateText(body, cap(config.get('maxRequestBodyBytes')));
    return { kind: 'page', text: t.text, size: t.size, truncated: t.truncated };
  }
  return {
    kind: body.kind || 'page',
    text: body.text || '',
    size: body.size || (body.text ? body.text.length : 0),
    truncated: !!body.truncated,
    contentType: body.contentType || '',
    note: body.note || null
  };
}

export function hexPreview(u8, maxRows = 24) {
  const rows = [];
  const len = Math.min(u8.length, maxRows * 16);
  for (let i = 0; i < len; i += 16) {
    const slice = u8.subarray(i, Math.min(i + 16, len));
    const hex = [...slice].map(b => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = [...slice].map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    rows.push(i.toString(16).padStart(8, '0') + '  ' + hex.padEnd(47, ' ') + '  |' + ascii + '|');
  }
  if (u8.length > len) rows.push('... (' + (u8.length - len) + ' octets supplementaires)');
  return rows.join('\n');
}
