/* Signaux HTTP, onglet En-tetes — SWIFT (by NeoZ)
 *
 * Ce qu un serveur dit, dans ses en-tetes, de la vie de l adresse, du debit
 * accorde, des liens a suivre, des caches traverses et de la priorite :
 *
 *   Avenir de l adresse  Deprecation (RFC 9745), Sunset (RFC 8594)
 *   Limites de debit     Retry-After (RFC 9110), RateLimit (brouillon IETF)
 *   Liens annonces       Link (RFC 8288), avec le registre IANA des relations
 *   Services alternatifs Alt-Svc (RFC 7838)
 *   Caches traverses     Cache-Status (RFC 9211), CDN-Cache-Control (RFC 9213)
 *   Priorite             Priority (RFC 9218)
 *
 * Chaque bloc n apparait que si l en-tete est la. Les lectures vivent dans
 * ui/lib ; ce module ne fait que les montrer.
 */
import { el, frag, kv, sec, add } from '../lib/dom.js';
import { t, tp, te, deuxPoints } from '../lib/i18n.js';
import { dureeLisible } from '../lib/temps.js';
import { state } from '../app.js';
/* Une reponse hostile peut porter des milliers de liens ou de caches : rendus
   par lots, ils ne figent pas l onglet, et rien n est coupe. */
import { parLots } from './detail-more.js';
import { lireCycleDeVie } from '../lib/cycle-vie.js';
import { lireLimitesDebit, UNITES_DEBIT } from '../lib/limites-debit.js';
import { lireLiens, valeursLink, suiviAnticipations } from '../lib/liens-http.js';
import { relationLien } from '../lib/ref-liens.js';
import { lireAltSvc, ALPN_CONNUS } from '../lib/alt-svc.js';
import { lireCacheStatus, lireCdnCacheControl } from '../lib/cache-status.js';
import { lirePriorite } from '../lib/priorite-http.js';

/** « 2023-06-30 23:59:59 UTC · il y a 3 j 4 h » */
export function quand(ms, maintenant = Date.now()) {
  /* Au-dela de 8,64e15 ms, une date JavaScript n existe plus : un Retry-After
     de trente chiffres y menait, et toISOString levait. */
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return '—';
  const absolu = new Date(ms).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  const ecart = Math.round((ms - maintenant) / 1000);
  if (Math.abs(ecart) < 1) return absolu;
  return absolu + '  ·  ' + (ecart > 0 ? tp('dans {d}', { d: dureeLisible(ecart) }) : tp('il y a {d}', { d: dureeLisible(-ecart) }));
}

/* Les valeurs d un fait, mises en forme : une date se lit, une duree aussi. */
function phrase(f) {
  const v = { ...f.valeurs };
  if (typeof v.date === 'number') v.date = quand(v.date);
  if (typeof v.duree === 'number') v.duree = dureeLisible(v.duree);
  if (typeof v.raison === 'string') v.raison = t(v.raison);
  if (typeof v.lecture === 'string') v.lecture = t(v.lecture);
  if (typeof v.type === 'string') v.type = t(v.type);
  return tp(f.texte, v);
}

function notes(box, faits) {
  if (!faits || !faits.length) return;
  /* Par lots : un en-tete hostile peut en produire des milliers. */
  const hote = el('div');
  box.appendChild(hote);
  parLots(hote, faits, f => el('p', { class: 'note' + (f.niveau === 'warn' ? ' warn' : ''), text: '•  ' + phrase(f) }));
}

const entete = (liste, nom) => {
  const h = (liste || []).find(x => x && String(x.name || '').toLowerCase() === nom);
  return h ? String(h.value ?? '') : null;
};

/* ------------------------- Avenir de l adresse ---------------------------- */
function blocCycleDeVie(rec) {
  const box = frag();
  const lu = lireCycleDeVie(rec.responseHeaders, { url: rec.finalUrl || rec.url });
  if (!lu) return box;
  box.appendChild(sec('Avenir de l adresse', 'RFC 9745 · RFC 8594'));
  notes(box, lu.faits);
  if (lu.deprecation) add(box, kv('Deprecation', lu.deprecation.brut, { copy: true }));
  if (lu.fin) add(box, kv('Sunset', lu.fin.brut, { copy: true }));
  for (const l of lu.liens) {
    add(box, kv(l.rel === 'deprecation' ? t('Documentation de la depreciation') : t('Politique de fin de service'), l.cible, { copy: true }));
  }
  return box;
}

/* --------------------------- Limites de debit ----------------------------- */
function blocDebit(rec) {
  const box = frag();
  const lu = lireLimitesDebit(rec.responseHeaders, {
    statut: rec.statusCode, instantReponse: rec.endTime || rec.startTime, depuisCache: !!rec.fromCache
  });
  if (!lu) return box;
  box.appendChild(sec('Limites de debit', 'Retry-After · RateLimit'));
  notes(box, lu.faits);
  const unite = u => t(UNITES_DEBIT[u] || u);
  const politiques = el('div');
  box.appendChild(politiques);
  parLots(politiques, lu.politiques, p => {
    const texte = p.fenetre
      ? tp('{q} {unite} par {w}', { q: p.quota, unite: unite(p.unite), w: dureeLisible(p.fenetre) })
      : tp('{q} {unite}', { q: p.quota, unite: unite(p.unite) });
    return kv(p.nom ? deuxPoints(t('Politique'), p.nom) : t('Politique'), texte) || el('div');
  });
  const limites = el('div');
  box.appendChild(limites);
  parLots(limites, lu.limites, l => {
    const texte = l.fenetre != null
      ? tp('il reste {r} sur une fenetre de {t}', { r: l.restant, t: dureeLisible(l.fenetre) })
      : tp('il reste {r}', { r: l.restant });
    return kv(deuxPoints(t('Disponible'), l.nom), texte) || el('div');
  });
  if (lu.ancien) {
    if (lu.ancien.limite != null) add(box, kv('Limite', String(lu.ancien.limite)));
    if (lu.ancien.restant != null) add(box, kv('Restant', String(lu.ancien.restant)));
  }
  if (lu.retryAfter) add(box, kv('Retry-After', lu.retryAfter.brut, { copy: true }));
  return box;
}

/* ---------------------------- Liens annonces ------------------------------ */
/* Combien de requetes de la capture visent chaque adresse : de quoi dire si
   une ressource annoncee pour etre prechargee a ete demandee. */
function comptesUrls() {
  const compte = new Map();
  for (const r of state.records.values()) {
    const u = r.url;
    if (u) compte.set(u, (compte.get(u) || 0) + 1);
  }
  return compte;
}

function blocLiens(rec) {
  const box = frag();
  const valeurs = valeursLink(rec.responseHeaders);
  if (!valeurs.length) return box;
  const lu = lireLiens(valeurs, rec.finalUrl || rec.url);
  box.appendChild(sec('Liens annonces', tp('{n} lien(s) · RFC 8288', { n: lu.liens.length })));
  notes(box, lu.faits);
  const suivis = new Map(suiviAnticipations(lu.liens, comptesUrls()).map(l => [l.cible + ' ' + l.rel, l.requetes]));
  const hote = el('div');
  box.appendChild(hote);
  /* Le sens d une relation ne s ecrit qu une fois, sous son premier lien. */
  const expliquees = new Set();
  parLots(hote, lu.liens, l => {
    const bloc = el('div');
    const relation = relationLien(l.rel);
    const attributs = l.attributs.map(([n, v]) => n + '=' + v).join('  ·  ');
    let texte = l.cible + (attributs ? '  ·  ' + attributs : '');
    const vues = suivis.get(l.cible + ' ' + l.rel);
    if (vues != null) texte += '  ·  ' + (vues ? tp('{n} requete(s) vers cette adresse dans la capture', { n: vues }) : t('aucune requete vers cette adresse dans la capture'));
    /* rel=type est une ecriture du protocole : elle ne se traduit pas. */
    const etiquette = 'rel=' + l.rel;
    const ligne = kv(etiquette, texte, { copy: true });
    if (ligne && relation) ligne.title = t(relation.sens) + '  —  ' + relation.reference;
    add(bloc, ligne);
    if (relation && !expliquees.has(l.rel) && (l.rel === 'preload' || l.rel === 'preconnect' || l.rel === 'next' || l.rel === 'deprecation'
      || l.rel === 'sunset' || l.rel === 'canonical' || l.rel === 'service-desc' || l.rel === 'service-doc')) {
      expliquees.add(l.rel);
      bloc.appendChild(el('p', { class: 'note', text: t(relation.sens) }));
    }
    return bloc;
  });
  return box;
}

/* ------------------------- Services alternatifs --------------------------- */
function blocAltSvc(rec) {
  const box = frag();
  const age = Number(entete(rec.responseHeaders, 'age')) || 0;
  const lu = lireAltSvc(rec.responseHeaders, { age, protocole: rec.perf && rec.perf.nextHopProtocol });
  if (!lu) return box;
  box.appendChild(sec('Services alternatifs', 'Alt-Svc · RFC 7838'));
  notes(box, lu.faits);
  const hote = el('div');
  box.appendChild(hote);
  parLots(hote, lu.services.map((s, rang) => ({ s, rang })), ({ s, rang }) => {
    const ou = (s.hote || t('meme hote')) + ':' + s.port;
    const validite = s.reste > 0 ? tp('valable encore {duree}', { duree: dureeLisible(s.reste) }) : t('deja perimee a la reception');
    const morceaux = [ALPN_CONNUS[s.alpn] || s.alpn, ou, validite];
    if (s.persist) morceaux.push(t('a garder meme apres un changement de reseau (persist=1)'));
    return kv(rang === 0 ? t('Prefere') : tp('Choix {n}', { n: rang + 1 }), morceaux.join('  ·  ')) || el('div');
  });
  return box;
}

/* --------------------------- Caches traverses ----------------------------- */
function blocCaches(rec) {
  const box = frag();
  const statut = lireCacheStatus(rec.responseHeaders, { statut: rec.statusCode });
  const cdn = lireCdnCacheControl(rec.responseHeaders);
  if (!statut && !cdn) return box;
  box.appendChild(sec('Caches traverses', 'Cache-Status · CDN-Cache-Control'));
  if (statut) {
    notes(box, statut.faits);
    if (statut.caches.length > 1) {
      box.appendChild(el('p', { class: 'note', text: t('du plus proche de l origine au plus proche de vous (RFC 9211 §2)') }));
    }
    const hote = el('div');
    box.appendChild(hote);
    parLots(hote, statut.caches, c => {
      const morceaux = c.notes.map(phrase);
      if (c.detail) morceaux.push('detail=' + c.detail);
      if (c.cle) morceaux.push('key=' + c.cle);
      return kv(c.nom, morceaux.join('  ·  ')) || el('div');
    });
  }
  if (cdn) {
    notes(box, cdn.faits);
    if (!cdn.ignore) {
      add(box, kv('CDN-Cache-Control', cdn.directives.map(d => d.valeur == null ? d.cle : d.cle + '=' + d.valeur).join(', '), { copy: true }));
      const ordinaire = entete(rec.responseHeaders, 'cache-control');
      add(box, kv(t('Cache-Control pour les autres caches'), ordinaire || t('absent')));
    }
  }
  return box;
}

/* -------------------------------- Priorite -------------------------------- */
function blocPriorite(rec) {
  const box = frag();
  const demande = lirePriorite(entete(rec.requestHeaders, 'priority'), 'requete');
  const reponse = lirePriorite(entete(rec.responseHeaders, 'priority'), 'reponse');
  if (!demande && !reponse) return box;
  box.appendChild(sec('Priorite', 'Priority · RFC 9218'));
  if (demande) {
    add(box, kv(t('Demandee par le navigateur'), entete(rec.requestHeaders, 'priority')));
    notes(box, demande.faits);
  }
  if (reponse) {
    add(box, kv(t('Avis du serveur'), entete(rec.responseHeaders, 'priority')));
    notes(box, reponse.faits);
  }
  return box;
}

/** Les signaux de la reponse, dans l ordre ou on les cherche. */
export function signaux(rec) {
  const box = frag();
  for (const bloc of [blocCycleDeVie, blocDebit, blocLiens, blocAltSvc, blocCaches, blocPriorite]) {
    /* Une lecture qui echoue ne doit pas emporter l onglet : elle le dit, a sa place. */
    try { box.appendChild(bloc(rec)); }
    catch (e) { box.appendChild(el('p', { class: 'note ko', text: tp('Lecture impossible : {raison}', { raison: te(e) }) })); }
  }
  return box;
}
