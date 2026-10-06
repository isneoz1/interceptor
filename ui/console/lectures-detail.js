/* Verdict, provenance, effacement, carte de source — SWIFT (by NeoZ)
 *
 *   Resume    le verdict en une phrase, en tete, avec l onglet qui en donne
 *             le detail ; puis la provenance declaree par Firefox
 *             (Sec-Fetch-*)
 *   En-tetes  ce qu un Clear-Site-Data fait effacer
 *   Reponse   la carte de source annoncee par un script ou une feuille de
 *             style
 *
 * Les lectures vivent dans ui/lib (verdict.js, fetch-metadata.js,
 * clear-site-data.js, source-map.js) ; ce module ne fait que les montrer.
 */
import { el, frag, kv, sec, add } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { ms } from '../lib/format.js';
import { verdictDe, alertesDe } from '../lib/verdict.js';
import { lireFetchMetadata } from '../lib/fetch-metadata.js';
import { lireClearSiteData, TYPES_CSD } from '../lib/clear-site-data.js';
import { lireSourceMap } from '../lib/source-map.js';

/* Le nom des onglets vers lesquels un verdict renvoie. */
const ONGLETS = { response: 'Reponse', headers: 'En-tetes', analysis: 'Alertes', streams: 'Flux' };

const allerA = onglet => document.dispatchEvent(new CustomEvent('ic:onglet', { detail: { onglet } }));

function ligneVerdict(v) {
  const valeurs = { ...v.valeurs };
  if (typeof valeurs.duree === 'number') valeurs.duree = ms(valeurs.duree);
  for (const cle of v.aTraduire || []) valeurs[cle] = t(valeurs[cle]);
  const ligne = el('p', { class: 'verdict-ligne' }, [el('span', { text: tp(v.texte, valeurs) })]);
  if (v.onglet && ONGLETS[v.onglet]) {
    ligne.appendChild(el('button', { class: 'btn sm ghost', type: 'button', on: { click: () => allerA(v.onglet) } },
      tp('Voir l onglet {onglet}', { onglet: t(ONGLETS[v.onglet]) })));
  }
  return ligne;
}

/** En tete de l onglet Resume : ce qui s est passe, en une phrase. */
export function blocVerdict(rec) {
  const v = verdictDe(rec);
  const bloc = el('div', { class: 'verdict ' + v.ton, role: 'status' }, [ligneVerdict(v)]);
  const alertes = alertesDe(rec);
  if (alertes) bloc.appendChild(ligneVerdict(alertes));
  return bloc;
}

/** La provenance declaree par Firefox, dans l onglet Resume. */
export function blocProvenance(rec) {
  const box = frag();
  const p = lireFetchMetadata(rec.requestHeaders);
  if (!p) return box;
  box.appendChild(sec('Provenance declaree par le navigateur', 'Sec-Fetch-*'));
  const avecSens = (valeur, sens) => (valeur === null ? null : sens ? valeur + '  —  ' + t(sens) : valeur);
  add(box, kv('Site d origine', avecSens(p.site, p.sensSite)));
  add(box, kv('Mode', avecSens(p.mode, p.sensMode)));
  add(box, kv('Destination', avecSens(p.dest, p.sensDest)));
  add(box, kv('Action de l utilisateur', p.utilisateur ? t('oui : navigation declenchee par un clic ou une touche') : null));
  return box;
}

/** Ce qu un Clear-Site-Data fait effacer, dans l onglet En-tetes. */
export function blocEffacement(rec) {
  const box = frag();
  const lu = lireClearSiteData(rec.responseHeaders, rec.finalUrl || rec.url);
  if (!lu) return box;
  box.appendChild(sec('Effacement demande', 'Clear-Site-Data'));
  for (const f of lu.faits) box.appendChild(el('p', { class: 'note warn', text: '•  ' + tp(f.texte, f.valeurs) }));
  for (const type of lu.types) add(box, kv('"' + type + '"', t(TYPES_CSD[type])));
  if (!lu.types.length && !lu.faits.length) box.appendChild(el('p', { class: 'note', text: t('aucun type reconnu : rien ne sera efface') }));
  return box;
}

/** La carte de source d un script ou d une feuille de style, onglet Reponse. */
export function blocSourceMap(rec) {
  const box = frag();
  const type = String(rec.mime || '');
  if (!/javascript|ecmascript|css/i.test(type) && !(rec.responseHeaders || []).some(h => /^(x-)?sourcemap$/i.test(h.name || ''))) return box;
  const corps = rec.responseBody;
  const lu = lireSourceMap({
    entetes: rec.responseHeaders, texte: corps && typeof corps.text === 'string' ? corps.text : '',
    type, url: rec.finalUrl || rec.url
  });
  if (!lu) return box;
  box.appendChild(sec('Carte de source', 'ECMA-426'));
  for (const f of lu.faits) box.appendChild(el('p', { class: 'note', text: '•  ' + t(f.texte) }));
  add(box, kv('Adresse de la carte', lu.adresse, { copy: !lu.integree }));
  add(box, kv('Annoncee par', t(lu.source === 'commentaire' ? 'un commentaire sourceMappingURL' : 'l en-tete HTTP')));
  return box;
}
