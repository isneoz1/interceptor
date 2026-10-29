/* Exports tabulaires et rapport d alertes — SWIFT (by D4RK)
 *
 * Les deux suivent la langue de l interface ; le CSV suit en plus la region :
 * son separateur est celui que le tableur de l utilisateur attend.
 */
import { t, tp, lang, deuxPoints } from '../../ui/lib/i18n.js';

/* Les noms de colonnes sont des identifiants : une table par langue plutot
   que des entrees du dictionnaire, qu un autre texte pourrait partager. */
const CSV_HEAD = {
  fr: ['id', 'heure', 'methode', 'statut', 'hote', 'chemin', 'type', 'mime',
    'taille', 'duree_ms', 'ip', 'couches', 'risque', 'marqueurs', 'alertes'],
  en: ['id', 'time', 'method', 'status', 'host', 'path', 'type', 'mime',
    'size', 'duration_ms', 'ip', 'layers', 'risk', 'markers', 'alerts']
};

/**
 * Le separateur d un CSV qui s ouvre d un double clic : un point-virgule la ou
 * la virgule marque les decimales (France, Allemagne, Espagne, Bresil…), une
 * virgule ailleurs (Etats-Unis, Royaume-Uni, Japon, Inde…). Sans region
 * donnee, celle du navigateur.
 */
export function separateurCsv(region) {
  try {
    const decimale = new Intl.NumberFormat(region).formatToParts(1.5).find(p => p.type === 'decimal');
    return decimale && decimale.value === ',' ? ';' : ',';
  } catch { return ','; }
}

/* Un texte qui commence par = + - @ (ou une tabulation, un retour) est lu comme
   une formule par les tableurs : un Content-Type choisi par le serveur pourrait
   s y executer a l ouverture. Une apostrophe en tete le garde comme texte
   (OWASP, CSV Injection). Les nombres ne sont pas touches. */
const cell = (v, separateur) => {
  const brut = String(v ?? '');
  const s = typeof v === 'string' && /^[=+\-@\t\r]/.test(brut) ? "'" + brut : brut;
  return s.includes(separateur) || /["\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function buildCsv(records, { separateur = separateurCsv() } = {}) {
  const lines = [CSV_HEAD[lang()].join(separateur)];
  for (const r of records) {
    lines.push([
      r.id,
      new Date(r.startTime || Date.now()).toISOString(),
      r.method,
      r.statusCode ?? (r.error || ''),
      r.host,
      r.path,
      r.type,
      r.mime || '',
      r.size || 0,
      r.duration ?? '',
      r.ip || '',
      (r.sources || []).join('+'),
      (r.analysis && r.analysis.risk) || '',
      (r.analysis && r.analysis.tags || []).join('|'),
      (r.analysis && r.analysis.findings || []).map(f => t(f.title)).join(' | ')
    ].map(v => cell(v, separateur)).join(separateur));
  }
  // BOM pour que les tableurs ouvrent l UTF-8 sans se tromper d encodage.
  return '\uFEFF' + lines.join('\r\n');
}

const ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function buildFindingsReport(records) {
  const flagged = records.filter(r => r.analysis && r.analysis.findings.length);
  const lines = [
    '# ' + t('SWIFT — rapport d alertes'),
    '',
    // La date au format de la region de l utilisateur, quelle que soit sa langue.
    '_' + tp('genere par SWIFT (by D4RK) le {date}', { date: new Date().toLocaleString() }) + '_',
    '',
    '- ' + deuxPoints(t('Requetes analysees'), records.length),
    '- ' + deuxPoints(t('Requetes porteuses d au moins une alerte'), flagged.length),
    ''
  ];

  const bySeverity = {};
  for (const r of flagged) {
    for (const f of r.analysis.findings) {
      (bySeverity[f.severity] = bySeverity[f.severity] || []).push({ f, r });
    }
  }

  for (const severity of Object.keys(ORDER)) {
    const list = bySeverity[severity];
    if (!list || !list.length) continue;
    lines.push('## ' + severity.toUpperCase() + ' (' + list.length + ')', '');
    for (const { f, r } of list) {
      lines.push('- **' + t(f.title) + '** — `' + f.where + '`' + (f.sample ? ' — `' + f.sample + '`' : ''));
      lines.push('  - ' + r.method + ' ' + (r.finalUrl || r.url));
      if (r.ip) lines.push('  - ' + t('serveur') + ' ' + r.ip);
    }
    lines.push('');
  }

  if (!flagged.length) lines.push(t('Aucune alerte detectee sur le perimetre analyse.'));
  return lines.join('\n');
}
