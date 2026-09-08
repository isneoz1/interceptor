/* INTERCEPTOR (by NeoZ) — utilitaires partages (cree par NeoZ) */

export const B = typeof browser !== 'undefined' ? browser : chrome;

export function headerGet(list, name) {
  if (!list) return undefined;
  const target = name.toLowerCase();
  for (const h of list) if (h && h.name && h.name.toLowerCase() === target) return h.value;
  return undefined;
}

export function headersToObject(list) {
  const out = {};
  if (!list) return out;
  for (const h of list) {
    const k = String(h.name || '').toLowerCase();
    out[k] = k in out ? out[k] + ', ' + h.value : h.value;
  }
  return out;
}

export function parseContentType(value) {
  if (!value) return { mime: '', charset: '' };
  const [rawMime, ...params] = String(value).split(';');
  let charset = '';
  for (const p of params) {
    const m = /^\s*charset\s*=\s*"?([^";]+)"?/i.exec(p);
    if (m) charset = m[1].trim().toLowerCase();
  }
  return { mime: rawMime.trim().toLowerCase(), charset };
}

const TEXTUAL = /^(text\/|image\/svg|application\/(json|.*\+json|javascript|x-javascript|ecmascript|xml|.*\+xml|xhtml|x-www-form-urlencoded|graphql|x-ndjson|ndjson|csv|yaml|x-yaml|toml|x-sh|sql))/i;

export function isTextualMime(mime) {
  if (!mime) return true; // pas de type => on tente le texte, on retombe en binaire si echec
  return TEXTUAL.test(mime);
}

const BINARY_HINT = /[\u0000-\u0008\u000E-\u001F]/;
export function looksBinary(text) {
  if (!text) return false;
  const sample = text.length > 4096 ? text.slice(0, 4096) : text;
  if (!BINARY_HINT.test(sample)) return false;
  let ctrl = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 0 || (c < 9) || (c > 13 && c < 32)) ctrl++;
  }
  return ctrl / sample.length > 0.02;
}

export function bytesToBase64(u8) {
  let out = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) {
    out += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  }
  return btoa(out);
}

export function concatChunks(chunks, total) {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/** URL normalisee servant de cle de correlation entre les couches de capture. */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch { return String(url || ''); }
}

export function hostOf(url) {
  try { return new URL(url).host; } catch { return ''; }
}

export function pathOf(url) {
  try { const u = new URL(url); return (u.pathname || '/') + (u.search || ''); }
  catch { return String(url || ''); }
}

export function schemeOf(url) {
  try { return new URL(url).protocol.replace(':', ''); } catch { return ''; }
}

export function truncateText(text, max) {
  if (typeof text !== 'string') return { text: '', truncated: false, size: 0 };
  const size = text.length;
  if (size <= max) return { text, truncated: false, size };
  return { text: text.slice(0, max), truncated: true, size };
}

export function throttleFlush(fn, ms) {
  let timer = null;
  return () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; fn(); }, ms);
  };
}

/** Decompression best-effort si le flux brut arrive encore encode. */
export async function maybeDecompress(bytes, contentEncoding) {
  const enc = String(contentEncoding || '').toLowerCase().trim();
  const isGzipMagic = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const isZlibMagic = bytes.length > 2 && bytes[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(bytes[1]);
  let format = null;
  if (isGzipMagic && enc.includes('gzip')) format = 'gzip';
  else if (isZlibMagic && (enc.includes('deflate') || enc.includes('zlib'))) format = 'deflate';
  if (!format || typeof DecompressionStream === 'undefined') return { bytes, decompressed: false };
  try {
    const ds = new DecompressionStream(format);
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return { bytes: new Uint8Array(buf), decompressed: true };
  } catch {
    return { bytes, decompressed: false };
  }
}

export function decodeBytes(bytes, charset) {
  const cs = charset && charset !== 'utf8' ? charset : 'utf-8';
  try { return new TextDecoder(cs, { fatal: false }).decode(bytes); }
  catch { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); }
}
