/* Moteur de regles d'interception active — INTERCEPTOR (by D4RK)
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
 *         | 'delay' | 'replaceBody',
 *   redirectUrl: 'https://...'        // accepte $1..$9 (groupes de urlRegex)
 *   requestHeaders:  [{ name, value|null, op:'set'|'remove' }],
 *   responseHeaders: [{ name, value|null, op:'set'|'remove' }],
 *   mock: { body: '...', contentType: 'application/json' },
 *   delayMs: 750,                     // latence injectee, plafonnee a 30 000
 *   replace: { find: 'regex', replace: 'texte', flags: 'g' }
 * }
 *
 * Le corps reel du serveur reste enregistre meme lorsqu'une simulation est
 * servie a la page : on ne perd jamais l'information d'origine.
 */
import { config } from '../core/config.js';
import { store } from '../core/store.js';

export const ruleStats = {
  evaluated: 0, blocked: 0, redirected: 0, upgraded: 0, headersModified: 0, mocked: 0,
  delayed: 0, delayMsTotal: 0, replaced: 0, replaceSkipped: 0
};

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

/** Vrai si l expression d URL de la regle est ecrite mais illisible. */
export function regleIllisible(rule) {
  return urlRegex(rule) === false;
}

/** Remplace $1..$9 par les groupes captures dans l URL de redirection. */
function expand(template, groups) {
  return String(template || '').replace(/\$([1-9])/g, (whole, index) => {
    const value = groups && groups[Number(index)];
    return value == null ? whole : value;
  });
}

function applyHeaderOps(list, ops) {
  if (!list || !ops) return { list, changed: 0 };
  let changed = 0;
  const out = list.slice();
  for (const op of ops) {
    const name = String(op.name || '').toLowerCase();
    if (!name) continue;
    const idx = out.findIndex(h => h.name.toLowerCase() === name);
    if (op.op === 'remove') {
      if (idx >= 0) { out.splice(idx, 1); changed++; }
    } else {
      if (idx >= 0) { out[idx] = { name: out[idx].name, value: String(op.value ?? '') }; changed++; }
      else { out.push({ name: op.name, value: String(op.value ?? '') }); changed++; }
    }
  }
  return { list: out, changed };
}

function activeRules() {
  if (!config.get('rulesEnabled')) return [];
  return (config.get('rules') || []).filter(r => r && r.enabled !== false);
}

/** Retourne un BlockingResponse, ou null si aucune regle ne s'applique. */
export function applyRules(rec, phase, details) {
  const rules = activeRules();
  if (!rules.length) return null;

  for (const rule of rules) {
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
        const r = applyHeaderOps(details.requestHeaders, rule.requestHeaders);
        if (r.changed) {
          ruleStats.headersModified += r.changed;
          rec.rulesApplied.push({ id: rule.id, name: rule.name, action: 'modifyRequestHeaders', count: r.changed, phase });
          store.mark(rec, 'rule:reqHeaders', Date.now(), { rule: rule.name, count: r.changed });
          return { requestHeaders: r.list };
        }
      }
      if (phase === 'onHeadersReceived' && rule.responseHeaders) {
        const r = applyHeaderOps(details.responseHeaders, rule.responseHeaders);
        if (r.changed) {
          ruleStats.headersModified += r.changed;
          rec.rulesApplied.push({ id: rule.id, name: rule.name, action: 'modifyResponseHeaders', count: r.changed, phase });
          store.mark(rec, 'rule:resHeaders', Date.now(), { rule: rule.name, count: r.changed });
          return { responseHeaders: r.list };
        }
      }
    }

    // Simulation : le type de contenu est impose des les entetes, le corps est
    // substitue par la couche StreamFilter (voir mockFor ci-dessous).
    if (rule.action === 'mock' && phase === 'onHeadersReceived' && rule.mock) {
      const type = rule.mock.contentType;
      if (type) {
        const r = applyHeaderOps(details.responseHeaders, [{ name: 'Content-Type', value: type, op: 'set' }]);
        if (r.changed) return { responseHeaders: r.list };
      }
    }
  }
  return null;
}

/**
 * Simulation de reponse applicable a cette requete, ou null.
 * Appelee par la couche StreamFilter au moment de brancher le filtre.
 */
export function mockFor(rec, details = {}) {
  for (const rule of activeRules()) {
    if (rule.action !== 'mock' || !rule.mock) continue;
    if (!matches(rule, rec, details)) continue;
    ruleStats.mocked++;
    rec.rulesApplied.push({
      id: rule.id, name: rule.name, action: 'mock', phase: 'streamFilter',
      count: String(rule.mock.body || '').length
    });
    store.mark(rec, 'rule:mock', Date.now(), { rule: rule.name });
    return {
      body: String(rule.mock.body ?? ''),
      contentType: rule.mock.contentType || 'text/plain; charset=utf-8',
      rule: rule.name || rule.id
    };
  }
  return null;
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
