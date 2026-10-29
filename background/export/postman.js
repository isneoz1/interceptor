/* Export au format Postman Collection v2.1 — SWIFT (by D4RK)
 *
 * Chaque requete capturee devient un element de collection, groupe par hote.
 * La reponse reellement observee est jointe : la collection est un dossier de
 * preuves, pas seulement un jeu d appels a rejouer. Les textes suivent la
 * langue de l interface, les dates le format de la region.
 */
import { t, tp, deuxPoints } from '../../ui/lib/i18n.js';

const SKIP_HEADERS = new Set(['content-length', 'connection', 'transfer-encoding']);

function urlObject(raw) {
  try {
    const u = new URL(raw);
    return {
      raw,
      protocol: u.protocol.replace(':', ''),
      host: u.hostname.split('.'),
      port: u.port || undefined,
      path: u.pathname.split('/').filter(Boolean),
      query: [...u.searchParams.entries()].map(([key, value]) => ({ key, value }))
    };
  } catch {
    return { raw };
  }
}

function headersOf(list) {
  return (list || [])
    .filter(h => !SKIP_HEADERS.has(String(h.name).toLowerCase()))
    .map(h => ({ key: h.name, value: String(h.value ?? '') }));
}

function bodyOf(rec) {
  const body = rec.requestBody;
  if (!body) return undefined;
  if (body.formData) {
    return {
      mode: 'urlencoded',
      urlencoded: Object.entries(body.formData).flatMap(
        ([key, values]) => values.map(value => ({ key, value: String(value) }))
      )
    };
  }
  if (body.text) {
    return {
      mode: 'raw',
      raw: body.text,
      options: { raw: { language: /json/i.test(body.contentType || '') ? 'json' : 'text' } }
    };
  }
  return undefined;
}

function responseOf(rec) {
  if (rec.statusCode == null) return [];
  return [{
    name: tp('Reponse observee le {date}', { date: new Date(rec.startTime || Date.now()).toLocaleString() }),
    originalRequest: {
      method: rec.method,
      header: headersOf(rec.requestHeaders),
      url: urlObject(rec.finalUrl || rec.url),
      body: bodyOf(rec)
    },
    status: (rec.statusLine || '').replace(/^\S+\s+\d+\s*/, '') || String(rec.statusCode),
    code: rec.statusCode,
    _postman_previewlanguage: /json/i.test(rec.mime || '') ? 'json' : 'text',
    header: headersOf(rec.responseHeaders),
    cookie: rec.cookies.set.map(c => ({
      name: c.name, value: c.value, domain: c.domain || undefined, path: c.path || undefined,
      secure: !!c.secure, httpOnly: !!c.httpOnly
    })),
    body: (rec.responseBody && rec.responseBody.text) || '',
    responseTime: rec.duration ?? undefined
  }];
}

export function buildPostman(records, meta = {}) {
  const folders = new Map();

  for (const rec of records) {
    const host = rec.host || t('sans-hote');
    if (!folders.has(host)) folders.set(host, []);
    folders.get(host).push({
      name: rec.method + ' ' + (rec.path || '/'),
      request: {
        method: rec.method,
        header: headersOf(rec.requestHeaders),
        url: urlObject(rec.finalUrl || rec.url),
        body: bodyOf(rec),
        description: [
          t('Capture par SWIFT (by D4RK).'),
          deuxPoints(t('Identifiant interne'), rec.id),
          rec.ip ? deuxPoints(t('Serveur'), rec.ip) : null,
          rec.security ? deuxPoints('TLS', rec.security.protocolVersion || t('inconnu')) : null,
          rec.analysis && rec.analysis.findings.length
            ? deuxPoints(t('Alertes'), rec.analysis.findings.map(f => f.severity + ' ' + t(f.title)).join(' | '))
            : null
        ].filter(Boolean).join('\n')
      },
      response: responseOf(rec)
    });
  }

  return {
    info: {
      name: 'SWIFT — ' + new Date(meta.startedAt || Date.now()).toLocaleString(),
      description: tp('Requetes capturees par SWIFT (by D4RK) : {n}. Les reponses jointes sont celles reellement observees.',
        { n: records.length }),
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: [...folders.entries()].map(([host, items]) => ({ name: host, item: items }))
  };
}
