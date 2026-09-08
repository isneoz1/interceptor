/* Contenu des onglets du panneau de detail — INTERCEPTOR (by NeoZ)
 *
 * Principe : tout champ present dans l enregistrement est affiche. Les blocs
 * connus recoivent un libelle francais ; tout champ inconnu est neanmoins
 * rendu par `allRows`, et l onglet « Brut » montre l objet complet. Rien ne
 * peut donc rester invisible, meme apres l ajout d une nouvelle donnee.
 */
import { el, frag, kv, sec, jsonTree, add } from '../lib/dom.js';
import { bytes, ms, clock, iso, pretty, typeLabel } from '../lib/format.js';
import { state, copy, cmd, toast } from '../app.js';
import { poser } from './tools.js';
import { t, tp } from '../lib/i18n.js';
import { decrireStatut, familleStatut } from '../lib/ref-http.js';
import { decrireEntete } from '../lib/ref-entetes.js';
import { decrireType } from '../lib/ref-mime.js';
import { decrireErreurReseau } from '../lib/ref-reseau.js';
import { analyserCsp } from '../lib/csp.js';
import { analyserFraicheur, resumerFraicheur } from '../lib/cache-http.js';
import { analyserMultipart } from '../lib/multipart.js';

/** Rend toutes les cles d un objet, y compris celles qu on n a pas prevues. */
export function allRows(obj, labels = {}, skip = []) {
  const out = frag();
  if (!obj) return out;
  for (const [key, value] of Object.entries(obj)) {
    if (skip.includes(key) || value == null || value === '' || value === false) continue;
    const label = labels[key] || key;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      if (value.every(v => typeof v !== 'object')) {
        add(out, kv(label, value.join(', ')));
      } else {
        add(out, kv(label, value.length + ' element(s)'));
        out.appendChild(el('div', { class: 'tree' }, jsonTree(value, label)));
      }
      continue;
    }
    if (typeof value === 'object') {
      out.appendChild(el('div', { class: 'tree' }, jsonTree(value, label)));
      continue;
    }
    add(out, kv(label, value === true ? 'oui' : value));
  }
  return out;
}

function headerBlock(title, list) {
  const box = frag();
  box.appendChild(sec(title, (list || []).length + ' entete(s)'));
  if (!list || !list.length) {
    box.appendChild(el('p', { class: 'note', text: 'Aucun entete capture pour cette phase.' }));
    return box;
  }
  const sorted = [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  for (const h of sorted) {
    const ligne = kv(h.name, h.value, { copy: true });
    // La table de reference explique l entete au survol : le sens d un entete
    // rare ne demande plus de quitter la console.
    const connu = ligne ? decrireEntete(h.name) : null;
    if (connu) ligne.title = t(connu.description);
    add(box, ligne);
  }
  return box;
}

/* ------------------------------- 1. Resume -------------------------------- */
export function resume(rec) {
  const box = frag();

  box.appendChild(sec('Identite', typeLabel(rec.type)));
  add(box, kv('Methode', rec.method, { hl: true }));
  add(box, kv('URL', rec.url, { copy: true }));
  if (rec.finalUrl && rec.finalUrl !== rec.url) add(box, kv('URL finale', rec.finalUrl, { copy: true }));
  add(box, kv('Statut', rec.statusLine || rec.statusCode || rec.error || 'en cours', { hl: true }));
  const statut = decrireStatut(rec.statusCode);
  if (statut) add(box, kv('Sens du statut', statut.nom + '  —  ' + t(statut.sens)));
  if (rec.statusCode) add(box, kv('Famille du statut', t(familleStatut(rec.statusCode))));
  add(box, kv('Etat', rec.state));
  add(box, kv('Erreur', rec.error));
  const causeReseau = decrireErreurReseau(rec.error);
  if (causeReseau) add(box, kv('Sens de l erreur', t(causeReseau.sens)));
  add(box, kv('Type MIME', rec.mime));
  const media = decrireType(rec.mime);
  if (media) add(box, kv('Type de media', t(media.description)));
  add(box, kv('Taille', rec.size ? bytes(rec.size) : null));
  add(box, kv('Duree', rec.duration != null ? ms(rec.duration) : null));
  add(box, kv('Debut', clock(rec.startTime)));
  add(box, kv('Fin', rec.endTime ? clock(rec.endTime) : null));
  add(box, kv('Horodatage', iso(rec.startTime)));
  add(box, kv('Identifiant', rec.id));
  add(box, kv('requestId Firefox', rec.requestId));
  add(box, kv('Epinglee', rec.flag ? 'oui' : null));
  add(box, kv('Annotation', rec.note || null));
  add(box, kv('Marquage couleur', rec.color || null));
  box.appendChild(annotation(rec));

  box.appendChild(sec('Reseau'));
  add(box, kv('Adresse IP', rec.ip, { hl: true, copy: true }));
  add(box, kv('Protocole reel', rec.perf && rec.perf.nextHopProtocol));
  add(box, kv('Depuis le cache', rec.fromCache ? 'oui' : null));
  add(box, kv('Sans trace reseau', rec.networkless ? 'oui (cache, Service Worker ou requete bloquee)' : null));
  if (rec.dns) {
    add(box, kv('Nom canonique', rec.dns.canonicalName));
    add(box, kv('Adresses resolues', (rec.dns.addresses || []).join(', ')));
  }
  add(box, kv('Emis sur le fil', rec.wireRequestSize ? bytes(rec.wireRequestSize) : null));
  add(box, kv('Recu sur le fil', rec.wireResponseSize ? bytes(rec.wireResponseSize) : null));
  if (rec.perf) {
    add(box, kv('Transfere', rec.perf.transferSize != null ? bytes(rec.perf.transferSize) : null));
    add(box, kv('Encode', rec.perf.encodedBodySize != null ? bytes(rec.perf.encodedBodySize) : null));
    add(box, kv('Decode', rec.perf.decodedBodySize != null ? bytes(rec.perf.decodedBodySize) : null));
    add(box, kv('Type d initiateur', rec.perf.initiatorType));
    add(box, kv('Blocage du rendu', rec.perf.renderBlockingStatus));
    add(box, kv('Mode de livraison', rec.perf.deliveryType));
  }

  box.appendChild(sec('Contexte'));
  add(box, kv('Onglet', rec.tabId));
  add(box, kv('Fenetre', rec.windowId >= 0 ? rec.windowId : null));
  add(box, kv('Cadre', rec.frameId + (rec.parentFrameId >= 0 ? '  (parent ' + rec.parentFrameId + ')' : '')));
  add(box, kv('Document', rec.documentUrl, { copy: true }));
  add(box, kv('Origine', rec.originUrl, { copy: true }));
  add(box, kv('Tierce partie', rec.thirdParty ? 'oui' : null));
  add(box, kv('Classement de pistage Firefox', rec.urlClassification
    ? [...new Set([...(rec.urlClassification.firstParty || []), ...(rec.urlClassification.thirdParty || [])])].join(', ')
    : null, { hl: true }));
  add(box, kv('Cadres parents', rec.frameAncestors && rec.frameAncestors.length
    ? rec.frameAncestors.map(f => f.url).join('  <-  ') : null));
  add(box, kv('Origine de la ligne', rec.imported ? 'importee depuis un fichier HAR' : null));
  add(box, kv('Navigation privee', rec.incognito ? 'oui' : null));
  add(box, kv('Conteneur', rec.cookieStoreId));
  add(box, kv('Couches de capture', (rec.sources || []).join(' + '), { hl: true }));
  add(box, kv('Fusions', rec.dedup && rec.dedup.merged ? rec.dedup.merged + ' (' + (rec.dedup.mergedFrom || []).join(', ') + ')' : null));
  add(box, kv('Signature de correlation', rec.dedup && rec.dedup.signature));

  if (rec.pageMeta) {
    box.appendChild(sec('Contexte JavaScript', rec.pageMeta.api || ''));
    box.appendChild(allRows(rec.pageMeta, {
      api: 'API utilisee', initiatorUrl: 'Document appelant', credentials: 'Credentials',
      mode: 'Mode', cache: 'Cache', redirect: 'Redirection', referrer: 'Referrer',
      referrerPolicy: 'Politique de referrer', integrity: 'Integrite', keepalive: 'Keepalive',
      destination: 'Destination', async: 'Asynchrone', startedAt: 'Debut (ms)',
      endedAt: 'Fin (ms)', jsDuration: 'Duree mesuree en JS (ms)', status: 'Statut vu par JS',
      statusText: 'Texte du statut', responseType: 'Type de reponse', responseUrl: 'URL de reponse',
      fromServiceWorker: 'Servi par un Service Worker', error: 'Erreur JavaScript'
    }, ['requestHeaders']));
  }

  if (rec.auth) {
    box.appendChild(sec('Authentification demandee', rec.auth.statusCode || ''));
    box.appendChild(allRows(rec.auth, {
      scheme: 'Schema', realm: 'Domaine de securite', isProxy: 'Demande par le proxy',
      challenger: 'Serveur demandeur', statusCode: 'Statut'
    }));
  }

  if (rec.proxy) {
    box.appendChild(sec('Proxy'));
    box.appendChild(allRows(rec.proxy, { ts: 'Horodatage', type: 'Type', method: 'Methode', url: 'URL' }));
  }

  if (rec.rulesApplied && rec.rulesApplied.length) {
    box.appendChild(sec('Regles appliquees', rec.rulesApplied.length));
    for (const r of rec.rulesApplied) {
      add(box, kv(r.name || r.id, r.action + ' · ' + r.phase + (r.to ? ' -> ' + r.to : '') + (r.count ? ' (' + r.count + ')' : '')));
    }
  }

  if (rec.replay && rec.replay.runs && rec.replay.runs.length) {
    box.appendChild(sec('Rejeux', rec.replay.runs.length));
    for (const run of rec.replay.runs) {
      add(box, kv(clock(run.at), run.method + ' -> ' + run.status + ' ' + run.statusText + ' · ' + ms(run.duration)));
    }
  }
  return box;
}

/* ------------------------------ 2. En-tetes ------------------------------- */
export function headers(rec) {
  const box = frag();
  const url = rec.finalUrl || rec.url;
  let params = [];
  try { params = [...new URL(url).searchParams.entries()]; } catch {}

  if (params.length) {
    box.appendChild(sec('Parametres de l URL', params.length));
    for (const [name, value] of params) add(box, kv(name, value, { copy: true }));
  }
  box.appendChild(headerBlock('Entetes envoyees', rec.requestHeaders));
  box.appendChild(headerBlock('Entetes recues', rec.responseHeaders));
  if (rec.pageMeta && rec.pageMeta.requestHeaders && rec.pageMeta.requestHeaders.length) {
    box.appendChild(headerBlock('Entetes vues par le code JavaScript', rec.pageMeta.requestHeaders));
  }
  box.appendChild(fraicheur(rec));
  box.appendChild(politique(rec));
  return box;
}

/** Les entetes d une phase en objet { nom-minuscule: valeur }, valeurs
 *  repetees jointes par une virgule comme le veut la RFC 9110. */
function objetEntetes(liste) {
  const out = {};
  for (const h of liste || []) {
    const cle = String(h.name || '').toLowerCase();
    if (!cle) continue;
    out[cle] = cle in out ? out[cle] + ', ' + h.value : String(h.value);
  }
  return out;
}

/* ------------------------- Fraicheur (RFC 9111) --------------------------- */
/* Le navigateur ne dit jamais « cette reponse est fraiche encore 42 s ». Les
   chiffres ci-dessous sortent des formules de la RFC 9111 appliquees aux
   entetes reellement recus et aux horodatages reellement mesures. */
function fraicheur(rec) {
  const box = frag();
  const recu = objetEntetes(rec.responseHeaders);
  const parle = recu['cache-control'] || recu.expires || recu.etag
    || recu['last-modified'] || recu.age || recu.vary;
  if (!parle) return box;

  let r;
  try {
    r = analyserFraicheur({
      reponse: recu,
      requete: objetEntetes(rec.requestHeaders),
      instantRequete: rec.startTime || undefined,
      instantReponse: rec.endTime || rec.startTime || undefined,
      partage: false            // le cache du navigateur, pas un cache partage
    });
  } catch { return box; }

  box.appendChild(sec('Fraicheur HTTP', t(resumerFraicheur(r))));
  add(box, kv('Stockable en cache', r.stockable ? 'oui' : 'non', { hl: !r.stockable }));
  add(box, kv('Duree de fraicheur', r.duree != null ? r.duree + ' s' : null));
  add(box, kv('Determinee par', r.source ? t(r.source) : null));
  add(box, kv('Age courant', r.ageCourant + ' s', { always: true }));
  if (r.restant != null) {
    add(box, kv(r.fraiche ? 'Encore fraiche pendant' : 'Perimee depuis',
      Math.abs(r.restant) + ' s', { hl: !r.fraiche }));
  }
  add(box, kv('Age annonce par l entete Age', r.detailAge.ageEntete + ' s'));
  add(box, kv('Age apparent (Date de la reponse)', r.detailAge.ageApparent + ' s'));
  add(box, kv('Delai de reponse mesure', r.detailAge.delaiReponse + ' s'));
  add(box, kv('Temps de residence en cache', r.detailAge.residence + ' s'));
  add(box, kv('Validateurs', r.validateurs.length ? r.validateurs.join('   ·   ') : null, { copy: true }));
  add(box, kv('Vary', r.vary || null));
  const directives = Object.entries(r.directives)
    .map(([nom, valeur]) => valeur === true ? nom : nom + '=' + valeur);
  add(box, kv('Directives Cache-Control', directives.length ? directives.join('   ·   ') : null));
  for (const fait of r.faits) box.appendChild(el('p', { class: 'note', text: t(fait) }));
  return box;
}

/* -------------------- Politique de securite du contenu -------------------- */
/* On ne dit pas « faille » : on decrit ce que la politique laisse passer, en
   citant la directive concernee. A l operateur de juger si c est voulu. */
function politique(rec) {
  const box = frag();
  const recu = objetEntetes(rec.responseHeaders);
  const sources = [
    ['content-security-policy', 'Politique de securite du contenu (CSP)', false],
    ['content-security-policy-report-only', 'Politique CSP en observation', true]
  ];

  for (const [entete, titre, observation] of sources) {
    const valeur = recu[entete];
    if (!valeur) continue;
    let lu;
    try { lu = analyserCsp(valeur); } catch { continue; }

    box.appendChild(sec(titre, lu.directives.length + ' ' + t('directive(s)')));
    if (observation) {
      box.appendChild(el('p', { class: 'note', text:
        t('Politique en observation : rien n est bloque, les violations sont seulement signalees.') }));
    }
    for (const d of lu.directives) {
      const ligne = kv(d.nom, d.sources.join(' ') || t('(aucune source)'), { copy: true, always: true });
      if (ligne && d.sens) ligne.title = t(d.sens);
      if (ligne && (!d.connu || d.deprecie || d.doublon)) ligne.classList.add('hl');
      add(box, ligne);
    }
    // Une politique sans permission large produit une seule phrase neutre :
    // la teinte d alerte serait alors trompeuse.
    const neutre = lu.faits.length === 1 && /aucune permission large/.test(lu.faits[0].texte);
    for (const fait of lu.faits) {
      box.appendChild(el('p', { class: neutre ? 'note' : 'note warn',
        text: tp(fait.texte, fait.valeurs) }));
    }
  }
  return box;
}

/* -------------------------------- 3. Corps -------------------------------- */
function bodyViewer(body, title, mimeHint) {
  const box = frag();
  if (!body) {
    box.appendChild(sec(title));
    box.appendChild(el('p', { class: 'note', text: 'Aucun corps pour cette requete.' }));
    return box;
  }

  box.appendChild(sec(title, bytes(body.size) + (body.truncated ? ' · tronque' : '')));
  if (body.replacedBy) {
    box.appendChild(el('p', { class: 'note warn', text:
      'Une regle de simulation (« ' + body.replacedBy.rule + ' ») a remplace ce corps pour la page. ' +
      'Le contenu ci-dessous est celui reellement envoye par le serveur ; la page, elle, a recu ' +
      body.replacedBy.size + ' octets de type ' + body.replacedBy.contentType + '.' }));
    box.appendChild(el('pre', { class: 'pre', text: body.replacedBy.body }));
  }
  add(box, kv('Nature', body.kind));
  add(box, kv('Source', body.source));
  add(box, kv('Type declare', body.mime || body.contentType || mimeHint));
  add(box, kv('Encodage', body.charset));
  add(box, kv('Compression', body.contentEncoding ? body.contentEncoding + (body.decompressed ? ' (decompresse)' : ' (non decompresse)') : null));
  add(box, kv('Octets conserves', body.stored != null ? bytes(body.stored) : null));
  add(box, kv('Fichier joint', body.hasFileUpload ? 'oui — le contenu des fichiers n est pas lisible par une extension' : null));
  add(box, kv('Remarque', body.note));

  if (body.formData) {
    box.appendChild(sec('Champs de formulaire', Object.keys(body.formData).length));
    for (const [name, values] of Object.entries(body.formData)) {
      add(box, kv(name, values.join('  |  '), { copy: true }));
    }
  }

  const mime = body.mime || body.contentType || mimeHint || '';

  /* Un corps multipart est illisible tel quel : une frontiere, des en-tetes de
     partie, puis le contenu. On le decoupe pour montrer chaque champ et chaque
     fichier separement, sans rien envoyer. */
  if (/multipart\//i.test(mime) && body.text) {
    add(box, partiesMultipart(body.text, mime));
  }

  if (body.base64 && /^image\//i.test(mime)) {
    box.appendChild(el('img', {
      class: 'preview-img', alt: 'apercu',
      src: 'data:' + mime + ';base64,' + body.base64
    }));
  }

  const text = body.text || '';
  if (text) {
    const wrap = el('div');
    const bar = el('div', { class: 'actions' });
    const pre = el('pre', { class: 'pre' });
    const wrapMode = !state.config || state.config.wrapBodies;
    const prettyMode = !state.config || state.config.prettyJson;
    let mode = prettyMode ? 'pretty' : 'raw';

    const paint = () => {
      pre.textContent = mode === 'pretty' ? pretty(text, mime) : text;
      pre.classList.toggle('nowrap', !wrapMode);
    };
    bar.appendChild(el('button', { class: 'btn sm', type: 'button', on: { click: () => { mode = 'pretty'; paint(); } } }, 'Mise en forme'));
    bar.appendChild(el('button', { class: 'btn sm', type: 'button', on: { click: () => { mode = 'raw'; paint(); } } }, 'Brut'));
    bar.appendChild(el('button', { class: 'btn sm', type: 'button', on: { click: () => copy(text, 'Corps copie') } }, 'Copier'));
    bar.appendChild(el('button', { class: 'btn sm', type: 'button',
      title: 'Decoder, hacher, mesurer ce corps dans la boite a outils',
      on: { click: () => poser(text) } }, 'Boite a outils'));
    paint();
    wrap.appendChild(bar);
    wrap.appendChild(pre);
    box.appendChild(wrap);
  }

  if (body.preview) {
    box.appendChild(sec('Apercu hexadecimal'));
    box.appendChild(el('pre', { class: 'pre nowrap', text: body.preview }));
  }
  if (body.base64) {
    box.appendChild(sec('Base64', bytes(body.base64.length)));
    const pre = el('pre', { class: 'pre', text: body.base64.slice(0, 20000) + (body.base64.length > 20000 ? '\n… (tronque a l affichage)' : '') });
    box.appendChild(pre);
    box.appendChild(el('div', { class: 'actions' },
      el('button', { class: 'btn sm', type: 'button', on: { click: () => copy(body.base64, 'Base64 copie') } }, 'Copier le base64')));
  }
  if (!text && !body.preview && !body.base64 && !body.formData) {
    box.appendChild(el('p', { class: 'note', text: 'Corps present mais non textuel, ou capture desactivee dans les reglages.' }));
  }
  return box;
}

/** Les parties d un corps multipart/form-data (RFC 7578), une par carte. */
function partiesMultipart(texte, contentType) {
  let lu;
  try { lu = analyserMultipart(texte, '', contentType); }
  catch { return null; }
  if (!lu.parties.length) return null;

  const box = frag();
  box.appendChild(sec('Parties du formulaire', lu.parties.length));
  add(box, kv('Frontiere', lu.frontiere, { copy: true }));
  add(box, kv('Marqueur de fin present', lu.termine ? 'oui' : 'non', { hl: !lu.termine }));

  for (const partie of lu.parties) {
    const carte = el('div', { class: 'find info' }, [
      el('h4', { text: (partie.nom || t('(champ sans nom)')) + (partie.estFichier ? '   ·   ' + t('fichier') : '') })
    ]);
    add(carte, kv('Nom du champ', partie.nom || null, { copy: true }));
    add(carte, kv('Nom de fichier', partie.fichier || null, { copy: true }));
    add(carte, kv('Type declare', partie.type || null));
    add(carte, kv('Encodage de transfert', partie.encodage || null));
    add(carte, kv('Taille', bytes(partie.taille), { always: true }));
    if (partie.contenu) {
      carte.appendChild(el('pre', { class: 'pre', text: partie.contenu.slice(0, 4000) }));
      carte.appendChild(el('div', { class: 'actions' }, [
        el('button', { class: 'btn sm', type: 'button',
          on: { click: () => copy(partie.contenu, 'Partie copiee') } }, 'Copier'),
        el('button', { class: 'btn sm', type: 'button',
          title: 'Decoder, hacher ou mesurer cette partie',
          on: { click: () => poser(partie.contenu) } }, 'Boite a outils')
      ]));
    }
    box.appendChild(carte);
  }
  for (const remarque of lu.remarques) {
    box.appendChild(el('p', { class: 'note', text: t(remarque) }));
  }
  return box;
}

export function requestBody(rec) { return bodyViewer(rec.requestBody, 'Corps envoye', rec.requestBody && rec.requestBody.contentType); }
export function responseBody(rec) { return bodyViewer(rec.responseBody, 'Corps recu', rec.mime); }

/* Annotation d une ligne : commentaire libre et marquage couleur. Les deux
   sont cherchables (`note:` et `color:`) et suivent la ligne partout. */
function annotation(rec) {
  const box = frag();
  const champ = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: 'Annoter cette requete…'
  });
  champ.value = rec.note || '';
  champ.addEventListener('change', async () => {
    const res = await cmd('annotateRecord', { id: rec.id, note: champ.value });
    if (res.error) return toast(res.error, false);
    rec.note = res.note;
    const resume = state.records.get(rec.id);
    if (resume) resume.note = res.note;
    toast(res.note ? 'Annotation enregistree' : 'Annotation effacee');
  });
  box.appendChild(el('div', { class: 'actions' }, champ));

  const couleurs = el('div', { class: 'actions' });
  for (const [cle, libelle] of [['', 'Aucune'], ['rouge', 'Rouge'], ['orange', 'Orange'],
                                ['jaune', 'Jaune'], ['vert', 'Vert'], ['bleu', 'Bleu'],
                                ['violet', 'Violet']]) {
    const btn = el('button', {
      class: 'btn sm' + (rec.color === cle ? ' on' : ''), type: 'button', title: libelle
    }, (rec.color === cle ? '● ' : '○ ') + libelle);
    btn.addEventListener('click', async () => {
      const res = await cmd('annotateRecord', { id: rec.id, color: cle });
      if (res.error) return toast(res.error, false);
      rec.color = res.color;
      const resume = state.records.get(rec.id);
      if (resume) resume.color = res.color;
      toast(cle ? 'Ligne marquee' : 'Marquage retire');
    });
    couleurs.appendChild(btn);
  }
  box.appendChild(couleurs);
  return box;
}
