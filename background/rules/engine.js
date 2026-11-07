/* Moteur de regles d'interception active — SWIFT (by D4RK)
 *
 * Desactive par defaut : l'extension observe sans jamais alterer le trafic.
 * Une fois active, chaque regle peut bloquer, rediriger, forcer le HTTPS,
 * reecrire des entetes, substituer le corps de la reponse, injecter de la
 * latence, ou remplacer un motif dans le corps servi a la page.
 *
 * Forme d'une regle :
 * {
 *   id, enabled, name,
 *   match: { urlRegex, method, type, host },
 *   action: 'block' | 'redirect' | 'upgrade' | 'modifyHeaders' | 'mock'
 *         | 'delay' | 'replaceBody' | 'modifyQuery',
 *   redirectUrl: 'https://...'        // accepte $1..$9 (groupes de urlRegex)
 *   requestHeaders:  [{ name, value|null, op:'set'|'remove' }],
 *   responseHeaders: [{ name, value|null, op:'set'|'remove' }],
 *   query: [{ name, value|null, op:'set'|'remove' }],   // parametres d URL
 *   mock: { body: '...', contentType: 'application/json' },
 *         // ou { base64: '...' } : le contenu d un fichier binaire
 *   delayMs: 750,                     // latence injectee, plafonnee a 30 000
 *   replace: { find: 'regex', replace: 'texte', flags: 'g' }
 * }
 *
 * Le corps reel du serveur reste enregistre meme lorsqu'une simulation est
 * servie a la page : on ne perd jamais l'information d'origine.
 */
import { config } from '../core/config.js';
import { store } from '../core/store.js';
import { base64VersOctets } from '../../ui/lib/bytes.js';
import { debitKo } from '../../ui/lib/format.js';

export const ruleStats = {
  evaluated: 0, blocked: 0, redirected: 0, upgraded: 0, headersModified: 0, mocked: 0,
  delayed: 0, delayMsTotal: 0, replaced: 0, replaceSkipped: 0, queryModified: 0, throttled: 0
};

/* Le nom d un parametre tel qu on le lit : « + » vaut une espace dans une
   requete de formulaire, et un echappement mal forme reste tel quel. */
function nomLu(brut) {
  try { return decodeURIComponent(brut.replace(/\+/g, ' ')); } catch { return brut; }
}

/* La valeur, lue de la meme facon ; « nocache » seul vaut une valeur vide. */
function valeurLue(partie) {
  const egal = partie.indexOf('=');
  return egal < 0 ? '' : nomLu(partie.slice(egal + 1));
}

/* encodeURIComponent laisse « ! ' ( ) * » tels quels ; le navigateur, lui,
   encode l apostrophe dans la requete d une adresse http(s) (norme URL du
   WHATWG). Ecrits encodes d emblee, ils reviennent tels qu on les a ecrits. */
function encoder(texte) {
  return encodeURIComponent(texte).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Ajoute, remplace ou retire des parametres d URL. Seuls les parametres vises
 * sont reecrits : les autres gardent leur ecriture exacte (« %20 » ou « + »),
 * et une seconde application ne change plus rien — une regle ne peut donc pas
 * relancer sans fin la redirection qu elle provoque.
 * @returns {{ url: string, changed: boolean }}
 */
export function appliquerParametres(url, ops) {
  const brute = String(url || '');
  if (!/^https?:\/\//i.test(brute) || !Array.isArray(ops)) return { url: brute, changed: false };
  const diese = brute.indexOf('#');
  const fragment = diese < 0 ? '' : brute.slice(diese);
  const sansFragment = diese < 0 ? brute : brute.slice(0, diese);
  const point = sansFragment.indexOf('?');
  const base = point < 0 ? sansFragment : sansFragment.slice(0, point);
  let parties = point < 0 || point === sansFragment.length - 1 ? [] : sansFragment.slice(point + 1).split('&');
  const avant = parties.join('&');
  for (const op of ops) {
    const nom = String((op && op.name) || '');
    if (!nom) continue;
    const vise = p => nomLu(p.split('=')[0]) === nom;
    if (op.op === 'remove') { parties = parties.filter(p => !vise(p)); continue; }
    const voulue = String(op.value ?? '');
    const premier = parties.findIndex(vise);
    if (premier < 0) { parties = [...parties, encoder(nom) + '=' + encoder(voulue)]; continue; }
    /* La bonne valeur deja la, ecrite autrement (« a+b » pour « a b », « ' »
       pour « %27 ») : elle reste telle quelle. La reecrire relancerait la
       redirection, et le navigateur la rendrait encore autrement — sans fin. */
    const gardee = valeurLue(parties[premier]) === voulue ? parties[premier] : encoder(nom) + '=' + encoder(voulue);
    parties = parties.flatMap((p, i) => (i === premier ? [gardee] : vise(p) ? [] : [p]));
  }
  /* Rien de change : pas de redirection, meme pour un « ? » seul a la fin. */
  if (parties.join('&') === avant) return { url: brute, changed: false };
  return { url: base + (parties.length ? '?' + parties.join('&') : '') + fragment, changed: true };
}

/* id -> RegExp compilee, `false` si l expression est ecrite mais illisible,
   `null` si la regle n en porte pas. La distinction compte : une expression
   illisible doit rendre la regle inerte, jamais l elargir. */
const compiled = new Map();

function urlRegex(rule) {
  const src = rule.match && rule.match.urlRegex;
  if (!src) return null;
  if (!compiled.has(rule.id)) {
    try { compiled.set(rule.id, new RegExp(src, 'i')); }
    catch { compiled.set(rule.id, false); }
  }
  return compiled.get(rule.id);
}

/** Retourne les groupes captures si la regle correspond, [] sinon, null si non. */
function matches(rule, rec, details) {
  const m = rule.match || {};
  const re = urlRegex(rule);

  /* Une expression ecrite mais illisible ne peut correspondre a rien. Sans
     cette garde, une parenthese oubliee ferait passer la regle de « cette
     URL-la » a « toutes les URL » : l inverse de l intention. */
  if (re === false) return null;

  if (m.method && m.method.toUpperCase() !== rec.method) return null;
  if (m.type && m.type !== rec.type) return null;
  if (m.host && !rec.host.includes(m.host)) return null;
  if (!re) return [];
  const hit = re.exec(details.url || rec.url);
  return hit ? hit : null;
}

/** Remplace $1..$9 par les groupes captures dans l URL de redirection. */
function expand(template, groups) {
  return String(template || '').replace(/\$([1-9])/g, (whole, index) => {
    const value = groups && groups[Number(index)];
    return value == null ? whole : value;
  });
}

/* « Retirer » retire toutes les occurrences d un en-tete ; « poser » en garde
   une seule, a la place de la premiere. Un en-tete peut figurer deux fois :
   ne toucher que le premier laissait vivre le second (un Cache-Control
   max-age apres le no-cache de No Caching). */
function applyHeaderOps(list, ops) {
  if (!list || !ops) return { list, changed: 0 };
  let changed = 0;
  let out = list.slice();
  for (const op of ops) {
    const name = String(op.name || '').toLowerCase();
    if (!name) continue;
    const meme = h => String(h.name || '').toLowerCase() === name;
    const idx = out.findIndex(meme);
    if (op.op === 'remove') {
      if (idx >= 0) { changed += out.filter(meme).length; out = out.filter(h => !meme(h)); }
    } else {
      const entete = { name: idx >= 0 ? out[idx].name : op.name, value: String(op.value ?? '') };
      out = idx >= 0 ? out.flatMap((h, i) => (i === idx ? [entete] : meme(h) ? [] : [h])) : [...out, entete];
      changed++;
    }
  }
  return { list: out, changed };
}

function activeRules() {
  if (!config.get('rulesEnabled')) return [];
  return (config.get('rules') || []).filter(r => r && r.enabled !== false);
}

/**
 * Retourne un BlockingResponse, ou null si aucune regle ne s'applique.
 *
 * Bloquer, rediriger, forcer le HTTPS : la premiere regle qui s applique
 * decide. Les regles d entetes et de parametres d URL, elles, se cumulent :
 * « No Caching » et « Block Cookies » sur le meme hote agissent toutes deux,
 * et deux regles de parametres contraires (poser puis retirer « debug »)
 * donnent une seule adresse — sinon chacune defaisait l autre a chaque
 * redirection, sans fin.
 */
export function applyRules(rec, phase, details) {
  const rules = activeRules();
  if (!rules.length) return null;
  let requestHeaders = null;
  let responseHeaders = null;
  let parametresVus = false;
  let typeSimule = false;

  for (const [index, rule] of rules.entries()) {
    ruleStats.evaluated++;
    const groups = matches(rule, rec, details);
    if (!groups) continue;

    if (rule.action === 'block' && phase === 'onBeforeRequest') {
      ruleStats.blocked++;
      rec.rulesApplied.push({ id: rule.id, name: rule.name, action: 'block', phase });
      store.mark(rec, 'rule:block', Date.now(), { rule: rule.name });
      return { cancel: true };
    }

    if (rule.action === 'redirect' && phase === 'onBeforeRequest' && rule.redirectUrl) {
      const target = expand(rule.redirectUrl, groups);
      ruleStats.redirected++;
      rec.rulesApplied.push({ id: rule.id, name: rule.name, action: 'redirect', to: target, phase });
      store.mark(rec, 'rule:redirect', Date.now(), { rule: rule.name, to: target });
      return { redirectUrl: target };
    }

    if (rule.action === 'modifyQuery' && phase === 'onBeforeRequest') {
      if (parametresVus) continue;
      parametresVus = true;
      /* Cette regle et les suivantes qui s appliquent aussi, en une fois. */
      const ensemble = rules.slice(index).filter(r => r.action === 'modifyQuery' && (r === rule || matches(r, rec, details)));
      const r = appliquerParametres(details.url || rec.url, ensemble.flatMap(x => (Array.isArray(x.query) ? x.query : [])));
      if (!r.changed) continue;                     // deja conforme : rien a faire
      ruleStats.queryModified++;
      for (const x of ensemble) rec.rulesApplied.push({ id: x.id, name: x.name, action: 'modifyQuery', to: r.url, phase });
      store.mark(rec, 'rule:query', Date.now(), { rule: ensemble.map(x => x.name).join(', '), to: r.url });
      return { redirectUrl: r.url };
    }

    if (rule.action === 'upgrade' && phase === 'onBeforeRequest') {
      const url = details.url || rec.url;
      if (!/^http:\/\//i.test(url)) continue;      // deja chiffre : rien a faire
      const target = url.replace(/^http:\/\//i, 'https://');
      ruleStats.upgraded++;
      rec.rulesApplied.push({ id: rule.id, name: rule.name, action: 'upgrade', to: target, phase });
      store.mark(rec, 'rule:upgrade', Date.now(), { rule: rule.name, to: target });
      return { redirectUrl: target };
    }

    if (rule.action === 'modifyHeaders') {
      if (phase === 'onBeforeSendHeaders' && rule.requestHeaders) {
        const r = applyHeaderOps(requestHeaders || details.requestHeaders, rule.requestHeaders);
        if (r.changed) {
          ruleStats.headersModified += r.changed;
          rec.rulesApplied.push({ id: rule.id, name: rule.name, action: 'modifyRequestHeaders', count: r.changed, phase });
          store.mark(rec, 'rule:reqHeaders', Date.now(), { rule: rule.name, count: r.changed });
          requestHeaders = r.list;
        }
      }
      if (phase === 'onHeadersReceived' && rule.responseHeaders) {
        const r = applyHeaderOps(responseHeaders || details.responseHeaders, rule.responseHeaders);
        if (r.changed) {
          ruleStats.headersModified += r.changed;
          rec.rulesApplied.push({ id: rule.id, name: rule.name, action: 'modifyResponseHeaders', count: r.changed, phase });
          store.mark(rec, 'rule:resHeaders', Date.now(), { rule: rule.name, count: r.changed });
          responseHeaders = r.list;
        }
      }
      continue;
    }

    // Simulation : le type de contenu est impose des les entetes, le corps est
    // substitue par la couche StreamFilter (voir mockFor ci-dessous). La
    // premiere simulation decide, comme pour le corps.
    if (rule.action === 'mock' && phase === 'onHeadersReceived' && !typeSimule) {
      const mock = contenuDuMock(rule);
      if (!octetsDuMock(mock)) continue;           // illisible : la regle n agit pas
      typeSimule = true;
      const type = mock.contentType;
      if (type) {
        const r = applyHeaderOps(responseHeaders || details.responseHeaders, [{ name: 'Content-Type', value: type, op: 'set' }]);
        if (r.changed) responseHeaders = r.list;
      }
    }
  }
  if (requestHeaders) return { requestHeaders };
  if (responseHeaders) return { responseHeaders };
  return null;
}

/**
 * Simulation de reponse applicable a cette requete, ou null.
 * Appelee par la couche StreamFilter au moment de brancher le filtre.
 */
export function mockFor(rec, details = {}) {
  for (const rule of activeRules()) {
    if (rule.action !== 'mock') continue;
    if (!matches(rule, rec, details)) continue;
    /* Sans contenu, la regle sert un corps vide : c est ce que l editeur
       affiche et ce que la description annonce (« 0 octet »). */
    const mock = contenuDuMock(rule);
    const octets = octetsDuMock(mock);
    if (!octets) continue;                          // base64 illisible : la regle n agit pas
    ruleStats.mocked++;
    rec.rulesApplied.push({
      id: rule.id, name: rule.name, action: 'mock', phase: 'streamFilter', count: octets.length
    });
    store.mark(rec, 'rule:mock', Date.now(), { rule: rule.name });
    return {
      body: mock.base64 ? '' : String(mock.body ?? ''),
      base64: mock.base64 || null,
      octets,
      contentType: mock.contentType || 'text/plain; charset=utf-8',
      rule: rule.name || rule.id
    };
  }
  return null;
}

/* Le contenu d une simulation ; un fichier de reglages importe peut y mettre
   n importe quoi, et une regle mal formee ne doit pas casser la requete. */
function contenuDuMock(rule) {
  return rule.mock && typeof rule.mock === 'object' ? rule.mock : {};
}

/* Les octets d une simulation, decodes une fois par contenu : un fichier de
   5 Mo n est pas relu en base64 a chaque requete. La table oublie d elle-meme
   le contenu d une regle remplacee. */
const octetsDejaLus = new WeakMap();
function octetsDuMock(mock) {
  if (octetsDejaLus.has(mock)) return octetsDejaLus.get(mock);
  let octets = null;
  try {
    octets = mock.base64 ? base64VersOctets(mock.base64) : new TextEncoder().encode(String(mock.body ?? ''));
  } catch { octets = null; }
  octetsDejaLus.set(mock, octets);
  return octets;
}

/**
 * Latence a injecter avant l emission de la requete, en millisecondes.
 * Sert a reproduire un reseau lent sans changer quoi que ce soit d autre.
 * Plafonnee a 30 s : au-dela, on ne simule plus, on gele la navigation.
 */
export const DELAI_MAX_MS = 30000;

export function delayFor(rec, details = {}) {
  for (const rule of activeRules()) {
    if (rule.action !== 'delay') continue;
    if (!matches(rule, rec, details)) continue;
    const demande = Number(rule.delayMs);
    if (!Number.isFinite(demande) || demande <= 0) continue;
    const ms = Math.min(DELAI_MAX_MS, Math.round(demande));
    ruleStats.delayed++;
    ruleStats.delayMsTotal += ms;
    rec.rulesApplied.push({
      id: rule.id, name: rule.name, action: 'delay', phase: 'onBeforeRequest', count: ms
    });
    store.mark(rec, 'rule:delay', Date.now(), { rule: rule.name, ms });
    return ms;
  }
  return 0;
}

/**
 * Remplacement dans le corps de reponse servi a la page (« chercher-remplacer »).
 *
 * Volontairement limite au texte non compresse : reecrire un flux compresse
 * demanderait de le recompresser a l identique, et un echec casserait la page.
 * Quand la substitution ne peut pas s appliquer, le flux passe intact et la
 * raison est inscrite sur l enregistrement — jamais un silence.
 */
export function replaceFor(rec, details = {}) {
  for (const rule of activeRules()) {
    if (rule.action !== 'replaceBody' || !rule.replace) continue;
    if (!matches(rule, rec, details)) continue;
    const motif = String(rule.replace.find ?? '');
    if (!motif) continue;
    let re;
    try { re = new RegExp(motif, rule.replace.flags || 'g'); }
    catch { ruleStats.replaceSkipped++; continue; }
    return {
      re,
      par: String(rule.replace.replace ?? ''),
      rule: rule.name || rule.id,
      id: rule.id
    };
  }
  return null;
}

/**
 * Debit auquel remettre le corps de la reponse a la page (« Throttle » de
 * Charles), en octets par seconde, ou null. 1 ko = 1 000 octets ; un debit
 * nul ou illisible n agit pas : il bloquerait la page au lieu de la ralentir.
 */
export const DEBIT_MAX_KO = 100000;

export function throttleFor(rec, details = {}) {
  for (const rule of activeRules()) {
    if (rule.action !== 'throttle') continue;
    if (!matches(rule, rec, details)) continue;
    const ko = debitKo(rule);
    if (!Number.isFinite(ko) || ko <= 0) continue;
    const octetsParSeconde = Math.max(1, Math.round(Math.min(DEBIT_MAX_KO, ko) * 1000));
    ruleStats.throttled++;
    rec.rulesApplied.push({ id: rule.id, name: rule.name, action: 'throttle', phase: 'streamFilter', count: octetsParSeconde });
    store.mark(rec, 'rule:throttle', Date.now(), { rule: rule.name, octetsParSeconde });
    return { octetsParSeconde, rule: rule.name || rule.id };
  }
  return null;
}

/**
 * Vrai quand une regle active doit toucher au corps de cette reponse
 * (simulation, remplacement, debit). Sans effet de bord : sert a decider
 * d ouvrir le flux meme lorsque la capture des corps est coupee.
 */
export function fluxNecessaire(rec, details = {}) {
  return activeRules().some(rule => {
    if (!matches(rule, rec, details)) return false;
    if (rule.action === 'mock') return !!octetsDuMock(contenuDuMock(rule));
    if (rule.action === 'replaceBody') return !!(rule.replace && rule.replace.find);
    if (rule.action === 'throttle') return debitKo(rule) > 0;
    return false;
  });
}

/** Comptabilise une substitution effectivement appliquee au flux. */
export function noteReplace(rec, info, count) {
  ruleStats.replaced++;
  rec.rulesApplied.push({
    id: info.id, name: info.rule, action: 'replaceBody', phase: 'streamFilter', count
  });
  store.mark(rec, 'rule:replaceBody', Date.now(), { rule: info.rule, count });
}

/** Comptabilise une substitution impossible, avec sa raison. */
export function noteReplaceSkipped(rec, info, raison) {
  ruleStats.replaceSkipped++;
  rec.rulesApplied.push({
    id: info.id, name: info.rule, action: 'replaceBody:ignore', phase: 'streamFilter', to: raison
  });
  store.mark(rec, 'rule:replaceBody:ignore', Date.now(), { rule: info.rule, raison });
}

export function invalidateRuleCache() { compiled.clear(); }
