/* Exports tabulaires et rapport d alertes — INTERCEPTOR (by NeoZ) */

const CSV_HEAD = [
  'id', 'heure', 'methode', 'statut', 'hote', 'chemin', 'type', 'mime',
  'taille', 'duree_ms', 'ip', 'couches', 'risque', 'marqueurs', 'alertes'
];

const cell = v => {
  const s = String(v ?? '');
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function buildCsv(records) {
  const lines = [CSV_HEAD.join(';')];
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
      (r.analysis && r.analysis.findings || []).map(f => f.title).join(' | ')
    ].map(cell).join(';'));
  }
  // BOM pour que les tableurs ouvrent l UTF-8 sans se tromper d encodage.
  return '\uFEFF' + lines.join('\r\n');
}

const ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function buildFindingsReport(records) {
  const flagged = records.filter(r => r.analysis && r.analysis.findings.length);
  const lines = [
    '# INTERCEPTOR — rapport d alertes',
    '',
    '_genere par INTERCEPTOR (by NeoZ) le ' + new Date().toLocaleString('fr-FR') + '_',
    '',
    '- Requetes analysees : ' + records.length,
    '- Requetes porteuses d au moins une alerte : ' + flagged.length,
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
      lines.push('- **' + f.title + '** — `' + f.where + '`' + (f.sample ? ' — `' + f.sample + '`' : ''));
      lines.push('  - ' + r.method + ' ' + (r.finalUrl || r.url));
      if (r.ip) lines.push('  - serveur ' + r.ip);
    }
    lines.push('');
  }

  if (!flagged.length) lines.push('Aucune alerte detectee sur le perimetre analyse.');
  return lines.join('\n');
}
