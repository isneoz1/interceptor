/* Onglets « Cookies », « Securite », « Alertes », « Flux », « Chronologie »,
 * « Pile JS » et « Brut » du panneau de detail — INTERCEPTOR (by NeoZ)
 *
 * Suite de detail-parts.js : meme principe, tout champ present est affiche.
 */
import { el, frag, kv, sec, jsonTree, add } from '../lib/dom.js';
import { bytes, ms, clock, middle, preuveLisible } from '../lib/format.js';
import { copy, cmd, toast } from '../app.js';
import { allRows } from './detail-parts.js';
import { t } from '../lib/i18n.js';
import { decrireSuiteTls } from '../lib/ref-reseau.js';

function clearNode(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/* ------------------------------- 4. Cookies -------------------------------- */
export function cookies(rec) {
  const box = frag();
  const set = (rec.cookies && rec.cookies.set) || [];
  const changed = (rec.cookies && rec.cookies.changed) || [];

  box.appendChild(sec('Set-Cookie', set.length));
  if (!set.length) box.appendChild(el('p', { class: 'note', text: 'Cette reponse ne pose aucun cookie.' }));
  for (const c of set) {
    const flags = [c.secure ? 'Secure' : null, c.httpOnly ? 'HttpOnly' : null,
                   c.sameSite ? 'SameSite=' + c.sameSite : 'SameSite absent'].filter(Boolean);
    add(box, kv(c.name, (c.domain || '(hote courant)') + (c.path || '/') + '  [' + flags.join(' ') + ']'));
    add(box, kv('  valeur', c.value, { copy: true }));
    add(box, kv('  expiration', c.expires || (c.maxAge ? 'max-age=' + c.maxAge : 'session')));
  }

  /* Etat reel du pot de cookies pour cette URL, HttpOnly compris : demande au
     noyau seulement sur clic, jamais en arriere-plan. */
  const jar = el('div');
  box.appendChild(el('div', { class: 'actions' }, el('button', {
    class: 'btn sm', type: 'button',
    on: { click: async () => {
      const res = await cmd('cookiesFor', { url: rec.finalUrl || rec.url });
      clearNode(jar);
      if (res.error) { toast(res.error, false); return; }
      jar.appendChild(sec('Cookies du domaine', res.cookies.length + ' cookie(s)'));
      if (!res.cookies.length) {
        jar.appendChild(el('p', { class: 'note', text: 'Aucun cookie enregistre pour cette URL.' }));
      }
      for (const c of res.cookies) {
        const flags = [c.secure ? 'Secure' : null, c.httpOnly ? 'HttpOnly' : null,
                       c.sameSite ? 'SameSite=' + c.sameSite : 'SameSite absent',
                       c.session ? 'session' : null].filter(Boolean).join(' ');
        add(jar, kv(c.name, c.domain + (c.path || '') + '  [' + flags + ']'));
        add(jar, kv('  valeur', c.value, { copy: true }));
      }
    } }
  }, 'Voir les cookies du domaine')));
  box.appendChild(jar);

  box.appendChild(sec('Mutations observees', changed.length));
  if (!changed.length) box.appendChild(el('p', { class: 'note', text: 'Aucune mutation de cookie rattachee a cette requete.' }));
  for (const c of changed) {
    add(box, kv(clock(c.ts), (c.removed ? 'supprime ' : 'pose ') + c.name + ' @' + c.domain + (c.path || '') +
      ' [' + (c.secure ? 'Secure ' : '') + (c.httpOnly ? 'HttpOnly ' : '') + (c.sameSite || 'SameSite?') + '] · ' + c.cause));
  }
  return box;
}

/* ------------------------------ 5. Securite -------------------------------- */
export function security(rec) {
  const box = frag();
  if (!rec.security) {
    box.appendChild(sec('Transport'));
    box.appendChild(el('p', { class: 'note', text:
      rec.scheme === 'https'
        ? 'Aucune information TLS : la couche est desactivee, ou la reponse vient du cache.'
        : 'Requete non chiffree (' + (rec.scheme || 'inconnu') + ') : il n y a pas de session TLS.' }));
    return box;
  }
  const s = rec.security;
  box.appendChild(sec('Session TLS', s.state));
  box.appendChild(allRows(s, {
    state: 'Etat', protocolVersion: 'Version', cipherSuite: 'Suite de chiffrement',
    keaGroupName: 'Echange de cles', signatureSchemeName: 'Schema de signature',
    secretKeyLength: 'Longueur de cle', isDomainMismatch: 'Domaine non concordant',
    isExtendedValidation: 'Validation etendue', isNotValidAtThisTime: 'Hors periode de validite',
    isUntrusted: 'Certificat non fiable', certificateTransparencyStatus: 'Certificate Transparency',
    hsts: 'HSTS', hpkp: 'HPKP', usedDelegatedCredentials: 'Credentials delegues',
    usedEch: 'ECH', usedOcsp: 'OCSP', usedPrivateDns: 'DNS prive', fromCache: 'Depuis le cache TLS'
  }, ['certificates']));

  /* La table de reference dit ce que vaut la suite negociee : sans elle, un
     nom comme TLS_RSA_WITH_3DES_EDE_CBC_SHA ne dit rien a personne. */
  const suite = decrireSuiteTls(s.cipherSuite);
  if (suite) {
    box.appendChild(sec('Ce que vaut cette suite', suite.nom));
    add(box, kv('Version', suite.version));
    add(box, kv('Echange de cle', suite.echange));
    add(box, kv('Chiffrement', suite.chiffrement));
    add(box, kv('Integrite', suite.integrite));
    add(box, kv('Solidite', t(suite.solidite), { hl: true }));
    add(box, kv('Confidentialite persistante', t(suite.pfs ? 'oui' : 'non')));
    if (suite.solidite === 'cassee') {
      box.appendChild(el('p', { class: 'note warn', text:
        t('Cette suite est cassee : le chiffrement negocie ne protege plus rien.') }));
    }
  }

  const certs = s.certificates || [];
  box.appendChild(sec('Chaine de certificats', certs.length));
  certs.forEach((c, i) => {
    box.appendChild(sec(i === 0 ? 'Certificat du serveur' : 'Autorite ' + i, c.isBuiltInRoot ? 'racine integree' : ''));
    box.appendChild(allRows(c, {
      subject: 'Sujet', issuer: 'Emetteur', serialNumber: 'Numero de serie',
      fingerprintSha1: 'Empreinte SHA-1', fingerprintSha256: 'Empreinte SHA-256',
      validityStart: 'Valide depuis', validityEnd: 'Valide jusqu au',
      subjectPublicKeyInfoDigest: 'Empreinte de cle publique', isBuiltInRoot: 'Racine integree'
    }));
  });
  return box;
}

/* ------------------------------- 6. Analyse -------------------------------- */
export function analysis(rec) {
  const box = frag();
  const a = rec.analysis;
  if (!a || (!a.findings.length && !a.tags.length)) {
    box.appendChild(sec('Analyse'));
    box.appendChild(el('p', { class: 'note', text: 'Aucune alerte sur cette requete.' }));
    return box;
  }
  box.appendChild(sec('Alertes', a.risk + ' · ' + a.findings.length));
  const sorted = [...a.findings].sort((x, y) => SEV_ORDER[x.severity] - SEV_ORDER[y.severity]);
  for (const f of sorted) {
    box.appendChild(el('div', { class: 'find ' + f.severity }, [
      el('h4', { text: t(f.title) }),
      el('p', { text: f.severity.toUpperCase() + '  ·  ' + f.where + (f.sample ? '  ·  ' + f.sample : '') }),
      f.preuve ? el('p', { class: 'note', text: t('Preuve : ') + preuveLisible(f) }) : null
    ]));
  }
  if (a.tags.length) {
    box.appendChild(sec('Marqueurs', a.tags.length));
    const wrap = el('div');
    for (const t of a.tags) wrap.appendChild(el('span', { class: 'tag', text: t }));
    box.appendChild(wrap);
  }
  add(box, kv('Analysee le', clock(a.at)));
  return box;
}

/* -------------------------------- 7. Flux ---------------------------------- */
export function streams(rec) {
  const box = frag();
  if (rec.ws) {
    const w = rec.ws;
    box.appendChild(sec('WebSocket', w.sent + ' envoyees / ' + w.received + ' recues'));
    add(box, kv('Protocoles', Array.isArray(w.protocols) ? w.protocols.join(', ') : w.protocols));
    add(box, kv('Ouverte', w.openedAt ? clock(w.openedAt) : null));
    add(box, kv('Fermee', w.closedAt ? clock(w.closedAt) : null));
    if (w.close) add(box, kv('Fermeture', 'code ' + w.close.code + (w.close.reason ? ' · ' + w.close.reason : '') + (w.close.wasClean ? ' · propre' : ' · brutale')));
    add(box, kv('Octets envoyes', bytes(w.bytesSent)));
    add(box, kv('Octets recus', bytes(w.bytesReceived)));

    box.appendChild(sec('Trames', w.frames.length));
    for (const f of w.frames) {
      box.appendChild(el('div', { class: 'frame ' + (f.dir === 'send' ? 'send' : 'recv') }, [
        el('b', { text: (f.dir === 'send' ? '↑ ' : '↓ ') + clock(f.ts) }),
        el('span', { text: (f.data != null ? f.data : '[' + f.opcode + ' ' + bytes(f.size) + ']') + (f.truncated ? ' …tronque' : '') })
      ]));
    }
  }
  if (rec.sse) {
    box.appendChild(sec('Server-Sent Events', rec.sse.messages.length + (rec.sse.dropped ? ' (+' + rec.sse.dropped + ' non conserves)' : '')));
    add(box, kv('Ouverte', rec.sse.openedAt ? clock(rec.sse.openedAt) : null));
    add(box, kv('Fermee', rec.sse.closedAt ? clock(rec.sse.closedAt) : null));
    add(box, kv('Avec credentials', rec.sse.withCredentials ? 'oui' : null));
    for (const m of rec.sse.messages) {
      box.appendChild(el('div', { class: 'frame recv' }, [
        el('b', { text: m.event }),
        el('span', { text: m.data + (m.lastEventId ? '  (id ' + m.lastEventId + ')' : '') })
      ]));
    }
  }
  if (!rec.ws && !rec.sse) {
    box.appendChild(sec('Flux'));
    box.appendChild(el('p', { class: 'note', text: 'Cette requete ne transporte ni trame WebSocket ni message SSE.' }));
  }
  return box;
}

/* ----------------------------- 8. Chronologie ------------------------------ */
export function timeline(rec) {
  const box = frag();

  if (rec.perf && rec.perf.timings) {
    const t = rec.perf.timings;
    const labels = { blocked: 'Attente', dns: 'DNS', connect: 'Connexion', ssl: 'TLS', send: 'Envoi', wait: 'Reponse', receive: 'Reception' };
    const total = Object.values(t).reduce((a, b) => a + (b > 0 ? b : 0), 0) || 1;
    box.appendChild(sec('Chronometrage reseau', ms(Math.round(total))));
    const bars = el('div', { class: 'bars' });
    for (const [key, label] of Object.entries(labels)) {
      const value = t[key];
      if (value == null || value < 0) continue;
      bars.appendChild(el('span', { text: t(label) }));
      bars.appendChild(el('div', { class: 'track' }, el('div', { class: 'fill', style: 'width:' + Math.max(1, (value / total) * 100) + '%' })));
      bars.appendChild(el('span', { class: 'val', text: ms(Math.round(value)) }));
    }
    box.appendChild(bars);
  }

  if (rec.perf && rec.perf.serverTiming && rec.perf.serverTiming.length) {
    box.appendChild(sec('Server-Timing', rec.perf.serverTiming.length));
    for (const st of rec.perf.serverTiming) {
      add(box, kv(st.name, ms(Math.round(st.duration)) + (st.description ? ' · ' + st.description : '')));
    }
  }

  if (rec.redirects && rec.redirects.length) {
    box.appendChild(sec('Chaine de redirection', rec.redirects.length));
    for (const r of rec.redirects) {
      add(box, kv(String(r.statusCode), middle(r.from, 70) + '  ->  ' + middle(r.to, 70), { copy: true }));
    }
  }

  box.appendChild(sec('Evenements observes', (rec.timeline || []).length));
  const t0 = rec.timeline && rec.timeline.length ? rec.timeline[0].ts : 0;
  for (const ev of rec.timeline || []) {
    const detailText = ev.detail ? '  ' + JSON.stringify(ev.detail) : '';
    add(box, kv('+' + (ev.ts - t0) + ' ms', ev.event + detailText));
  }
  return box;
}

/* -------------------------------- 9. Pile ---------------------------------- */
export function stack(rec) {
  const box = frag();
  box.appendChild(sec('Pile d appel JavaScript'));
  if (!rec.stack) {
    box.appendChild(el('p', { class: 'note', text:
      'Aucune pile : requete emise hors JavaScript (navigation, ressource HTML), depuis un Worker, ou capture des piles desactivee.' }));
    return box;
  }
  box.appendChild(el('pre', { class: 'pre stack', text: rec.stack }));
  box.appendChild(el('div', { class: 'actions' },
    el('button', { class: 'btn sm', type: 'button', on: { click: () => copy(rec.stack, 'Pile copiee') } }, 'Copier la pile')));
  return box;
}

/* --------------------------------- 10. Brut -------------------------------- */
export function raw(rec) {
  const box = frag();
  box.appendChild(sec('Enregistrement complet', 'tout ce que le noyau conserve'));
  box.appendChild(el('p', { class: 'note', text:
    'Chaque champ conserve par INTERCEPTOR figure ici, y compris ceux qui n ont pas de presentation dediee.' }));
  box.appendChild(el('div', { class: 'tree' }, jsonTree(rec)));
  return box;
}
