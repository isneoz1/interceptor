/* Analyse automatique de chaque requete — INTERCEPTOR (by D4RK)
 *
 * Aucune action de l'utilisateur : chaque enregistrement termine est audite.
 * Ce module orchestre — reglages, motifs personnels, compteurs, mise en cache ;
 * les regles elles-memes vivent dans analyzer-regles.js.
 *
 * Principe tenu par les deux modules : une alerte doit etre DEMONTRABLE a
 * partir de ce qui a ete capture, et correspondre a une faille exploitable.
 * Les faits exacts qui ne sont pas des failles (pisteurs, requete tierce,
 * redirection croisee) restent des etiquettes, jamais des alertes.
 */
import { store } from './store.js';
import { config } from './config.js';
import { appliquerRegles } from './analyzer-regles.js';

export const SEVERITY = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const LEVELS = ['critical', 'high', 'medium', 'low', 'info'];

/* Les deux catalogues (secrets de fournisseur, pisteurs) vivent dans
   core/secrets.js ; les regles qui s en servent, dans analyzer-regles.js. */

/* ---------------- Motifs supplementaires definis par l utilisateur ----------------
 * Format d une ligne :  Nom = expression reguliere [= severite]
 * Une expression invalide est signalee dans les statistiques, jamais silencieuse. */
let customSecrets = [];
let customTrackers = [];
export const customState = { patterns: 0, invalid: [], trackers: 0 };

function compileCustom() {
  customSecrets = [];
  customState.invalid = [];
  for (const raw of config.get('extraSecretPatterns') || []) {
    const line = String(raw || '').trim();
    if (!line) continue;
    const parts = line.split('=');
    const label = (parts.shift() || '').trim() || 'Motif personnalise';
    const rest = parts.join('=').trim();
    if (!rest) { customState.invalid.push(line); continue; }
    const bits = rest.split('=');
    const maybeSeverity = bits.length > 1 ? bits[bits.length - 1].trim().toLowerCase() : '';
    const severity = LEVELS.includes(maybeSeverity) ? maybeSeverity : 'high';
    const source = LEVELS.includes(maybeSeverity) ? bits.slice(0, -1).join('=').trim() : rest;
    try { customSecrets.push([new RegExp(source, 'gi'), label, severity]); }
    catch { customState.invalid.push(line); }
  }
  customTrackers = (config.get('extraTrackers') || [])
    .map(t => String(t || '').trim().toLowerCase()).filter(Boolean);
  customState.patterns = customSecrets.length;
  customState.trackers = customTrackers.length;
}
compileCustom();
config.on('change', compileCustom);

/* ------------------------------------------------------------------ */
/* Analyse principale : lancee automatiquement a la fin de chaque requete */
/* ------------------------------------------------------------------ */
export const analyzerStats = {
  analyzed: 0, findings: 0,
  bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
};

export function analyze(rec, { force = false } = {}) {
  // `force` sert quand une couche apporte des donnees apres la cloture reseau
  // (corps remonte par une sonde page, trames WebSocket, entrees perf).
  if (!config.get('analyzerEnabled')) return null;
  if (rec.analysis && !force) return rec.analysis;

  const findings = [];
  const seen = new Set();
  const tags = new Set();
  const reqH = headersToObject(rec.requestHeaders);
  const resH = headersToObject(rec.responseHeaders);

  appliquerRegles({ rec, reqH, resH, findings, seen, tags, customSecrets, customTrackers });

  /* --- Anomalies de la requete elle-meme --- */
  if (rec.statusCode >= 500) tags.add('server-error');
  else if (rec.statusCode >= 400) tags.add('client-error');
  if (rec.error) tags.add('failed');
  if (rec.duration != null && rec.duration > 3000) tags.add('slow');
  if (rec.size > 5 * 1024 * 1024) tags.add('heavy');
  if (rec.ws) tags.add('websocket');
  if (rec.sse) tags.add('sse');
  if (rec.replay) tags.add('rejoue');
  if (rec.rulesApplied.length) tags.add('regle-appliquee');
  if (rec.sources.includes('page') && !rec.sources.includes('webRequest')) tags.add('js-only');

  const maxSeverity = findings.reduce((acc, f) => Math.max(acc, SEVERITY[f.severity] ?? 0), -1);
  const previous = rec.analysis;
  const analysis = {
    findings,
    tags: [...tags],
    risk: maxSeverity < 0 ? 'none' : LEVELS.find(k => SEVERITY[k] === maxSeverity),
    score: maxSeverity < 0 ? 0 : maxSeverity,
    at: Date.now()
  };

  // Une reanalyse remplace le resultat precedent : les compteurs globaux
  // defalquent l ancien pour ne jamais compter deux fois la meme alerte.
  if (previous) {
    analyzerStats.findings -= previous.findings.length;
    for (const f of previous.findings) analyzerStats.bySeverity[f.severity]--;
  } else {
    analyzerStats.analyzed++;
  }

  rec.analysis = analysis;
  analyzerStats.findings += findings.length;
  for (const f of findings) analyzerStats.bySeverity[f.severity]++;
  store.touch(rec.id);
  return analysis;
}

/** Recalcule l analyse de tout le magasin (bouton « Tout reanalyser »). */
export function analyzeAll() {
  let n = 0;
  for (const id of store.order) {
    const rec = store.records.get(id);
    if (!rec) continue;
    analyze(rec, { force: true });
    n++;
  }
  return n;
}

function headersToObject(list) {
  const out = {};
  if (!list) return out;
  for (const h of list) {
    const k = String(h.name || '').toLowerCase();
    out[k] = k in out ? out[k] + ', ' + h.value : h.value;
  }
  return out;
}
