/* Onglets « Cookies », « Securite », « Alertes », « Flux », « Chronologie »,
 * « Pile JS » et « Brut » du panneau de detail — INTERCEPTOR (by NeoZ)
 *
 * Suite de detail-parts.js : meme principe, tout champ present est affiche.
 */
import { el, frag, kv, sec, jsonTree, add } from '../lib/dom.js';
import { listeProgressive } from '../lib/liste-progressive.js';
import { base64VersOctets, octetsVersHex } from '../lib/bytes.js';
import { essayerFormats } from '../lib/binaires.js';
import { poser } from './tools.js';
import { bytes, ms, clock, middle, preuveLisible } from '../lib/format.js';
import { copy, cmd, toast } from '../app.js';
import { allRows } from './detail-parts.js';
import { t, tp } from '../lib/i18n.js';
import { decrireSuiteTls } from '../lib/ref-reseau.js';

function clearNode(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

/* Les trois listes sans plafond de ce panneau : trames WebSocket, messages SSE
   et evenements de la chronologie. Aucune n est bornee par les reglages —
   `maxWebSocketFrames` vaut zero, c est-a-dire sans limite — et une session
   longue en compte des dizaines de milliers. Les construire toutes d un coup
   coutait 92 ms et soixante mille noeuds a l ouverture de l onglet.

   Le rendu par lots efface cet a-coup sans rien ecarter : la suite arrive au
   defilement.

   Le cadre qui defile est trouve tout seul : le module attend que l onglet
   soit insere avant de brancher son observateur, parce qu une racine qui
   n est pas encore un ancetre rend « jamais visible » pour de bon. */
let enCoursDeRendu = [];
/* La liste des trames du dernier rendu, et combien en comptait alors
   l enregistrement : c est ce qui permet d ajouter la suite sans redessiner. */
let listeTrames = null;
let tramesRendues = 0;

function parLots(hote, elements, fabriquer) {
  const liste = listeProgressive(hote, elements, fabriquer);
  enCoursDeRendu.push(liste);
  return liste;
}

/**
 * Ajoute au panneau les trames arrivees depuis son dessin.
 *
 * @param rec  l enregistrement, rafraichi
 * @returns le nombre de trames ajoutees
 */
export function suivreTrames(rec) {
  if (!listeTrames) return 0;
  const trames = rec && rec.ws && Array.isArray(rec.ws.frames) ? rec.ws.frames : null;
  if (!trames || trames.length <= tramesRendues) return 0;
  const nouvelles = trames.slice(tramesRendues);
  tramesRendues = trames.length;
  listeTrames.ajouter(nouvelles);
  return nouvelles.length;
}

/** A appeler avant de redessiner un onglet : coupe les observateurs laisses
 *  par le precedent, qui n ont plus rien a observer. */
export function arreterListes() {
  for (const liste of enCoursDeRendu) liste.arreter();
  enCoursDeRendu = [];
  listeTrames = null;
  tramesRendues = 0;
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/* Au-dela, on ne tente plus de reconnaitre le format d une trame : le cout se
   sent au defilement, et une trame de cette taille ne se lit pas du coin de
   l oeil — la boite a outils est la pour cela. */
const MAX_DECODAGE = 8192;

/**
 * Ce qu on peut dire d une trame binaire sans quitter le panneau.
 *
 * @returns { format, apercu, octets } — `format` est null si aucun des trois
 *          lecteurs ne reconnait la trame.
 */
function lireTrameBinaire(base64) {
  try {
    const octets = base64VersOctets(base64);
    const apercu = octetsVersHex(octets.subarray(0, 24), ' ')
      + (octets.length > 24 ? ' …' : '');
    if (octets.length > MAX_DECODAGE) return { format: null, apercu, octets };
    const trouves = essayerFormats(octets);
    return { format: trouves.length ? trouves[0].format : null, apercu, octets };
  } catch {
    /* Base64 illisible : la trame reste comptee, on ne pretend rien de plus. */
    return { format: null, apercu: null, octets: null };
  }
}

/** Le corps d une ligne de trame : texte tel quel, ou lecture du binaire. */
function corpsDeTrame(f) {
  if (f.data != null) {
    return { texte: f.data + (f.truncated ? ' …tronque' : ''), base64: null, format: null };
  }
  if (f.base64) {
    const lu = lireTrameBinaire(f.base64);
    const tete = '[' + f.opcode + ' ' + bytes(f.size)
      + (lu.format ? '  ·  ' + lu.format : '') + (f.truncated ? '  ·  tronque' : '') + ']';
    return { texte: tete + (lu.apercu ? '   ' + lu.apercu : ''), base64: f.base64, format: lu.format };
  }
  return { texte: '[' + f.opcode + ' ' + bytes(f.size) + ']'
    + (f.truncated ? ' …tronque' : ''), base64: null, format: null };
}

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
    for (const marqueur of a.tags) wrap.appendChild(el('span', { class: 'tag', text: marqueur }));
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
    /* Un canal de donnees WebRTC emprunte le meme chemin que le WebSocket :
       memes trames, memes compteurs. Dire « WebSocket » a son propos serait
       faux — le transport le distingue. */
    const canalRtc = w.transport === 'rtc';
    const titreFlux = w.transport === 'rtc' ? 'Canal de donnees WebRTC'
      : w.transport === 'webtransport' ? 'WebTransport — datagrammes'
      : 'WebSocket';
    box.appendChild(sec(titreFlux,
      tp('{envoyees} envoyees / {recues} recues', { envoyees: w.sent, recues: w.received })));
    add(box, kv(canalRtc ? 'Sous-protocole du canal' : 'Protocoles',
      Array.isArray(w.protocols) ? w.protocols.join(', ') : w.protocols));
    add(box, kv('Ouverte', w.openedAt ? clock(w.openedAt) : null));
    add(box, kv('Fermee', w.closedAt ? clock(w.closedAt) : null));
    if (w.close) add(box, kv('Fermeture', 'code ' + w.close.code + (w.close.reason ? ' · ' + w.close.reason : '') + (w.close.wasClean ? ' · propre' : ' · brutale')));
    add(box, kv('Octets envoyes', bytes(w.bytesSent)));
    add(box, kv('Octets recus', bytes(w.bytesReceived)));

    box.appendChild(sec('Trames', w.frames.length));
    const trames = el('div');
    box.appendChild(trames);
    tramesRendues = w.frames.length;
    listeTrames = parLots(trames, w.frames, f => {
      const corps = corpsDeTrame(f);
      const ligne = el('div', {
        class: 'frame ' + (f.dir === 'send' ? 'send' : 'recv')
          + (corps.base64 ? ' copyable' : ''),
        title: corps.base64 ? t('Cliquer pour ouvrir cette trame dans la boite a outils') : null
      }, [
        el('b', { text: (f.dir === 'send' ? '↑ ' : '↓ ') + clock(f.ts) }),
        el('span', { text: corps.texte })
      ]);
      /* Une trame binaire s ouvre dans la boite a outils, ou l hexadecimal,
         les empreintes et les trois lecteurs binaires l attendent deja. */
      if (corps.base64) {
        ligne.addEventListener('click', () => poser(corps.base64, { vers: 'binaire' }));
      }
      return ligne;
    });
  }
  if (rec.sse) {
    box.appendChild(sec('Server-Sent Events', rec.sse.messages.length + (rec.sse.dropped ? ' (+' + rec.sse.dropped + ' non conserves)' : '')));
    add(box, kv('Ouverte', rec.sse.openedAt ? clock(rec.sse.openedAt) : null));
    add(box, kv('Fermee', rec.sse.closedAt ? clock(rec.sse.closedAt) : null));
    add(box, kv('Avec credentials', rec.sse.withCredentials ? 'oui' : null));
    const messages = el('div');
    box.appendChild(messages);
    parLots(messages, rec.sse.messages, m => el('div', { class: 'frame recv' }, [
      el('b', { text: m.event }),
      el('span', { text: m.data + (m.lastEventId ? '  (id ' + m.lastEventId + ')' : '') })
    ]));
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
    /* Surtout pas `t` : c est le nom de la fonction de traduction importee en
       tete de fichier. La nommer ainsi ici la masquait, et l appel a `t(label)`
       deux lignes plus bas invoquait l objet des temps. L onglet se vidait des
       qu une requete portait un chronometrage — c est-a-dire a chaque import
       de fichier HAR, DevTools, Charles et Fiddler l ecrivant tous. */
    const temps = rec.perf.timings;
    const labels = { blocked: 'Attente', dns: 'DNS', connect: 'Connexion', ssl: 'TLS', send: 'Envoi', wait: 'Reponse', receive: 'Reception' };
    const total = Object.values(temps).reduce((a, b) => a + (b > 0 ? b : 0), 0) || 1;
    box.appendChild(sec('Chronometrage reseau', ms(Math.round(total))));
    const bars = el('div', { class: 'bars' });
    for (const [key, label] of Object.entries(labels)) {
      const value = temps[key];
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

  const evenements = Array.isArray(rec.timeline) ? rec.timeline : [];
  box.appendChild(sec('Evenements observes', evenements.length));
  const t0 = evenements.length ? evenements[0].ts : 0;
  const liste = el('div');
  box.appendChild(liste);
  parLots(liste, evenements, ev => {
    const detailText = ev.detail ? '  ' + JSON.stringify(ev.detail) : '';
    return kv('+' + (ev.ts - t0) + ' ms', ev.event + detailText);
  });
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
