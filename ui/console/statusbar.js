/* Pied de page et diagramme de debit — INTERCEPTOR (by D4RK)
 *
 * Deux affichages temps reel, alimentes uniquement par les chiffres du noyau :
 * aucune valeur n est lissee, interpolee ni inventee.
 */
import { $, el, clear } from '../lib/dom.js';
import { uptime, bytes } from '../lib/format.js';
import { state } from '../app.js';

/** Bandeau du bas : compteurs de la session en cours. */
export function renderFoot() {
  const s = state.stats;
  const foot = clear($('#foot'));
  if (!s) { foot.appendChild(el('span', { text: 'Connexion au noyau…' })); return; }

  const add = (label, value, cls) => {
    foot.appendChild(el('span', {}, [label + ' ', el('b', { class: cls || null, text: String(value) })]));
  };
  add('Enregistrees', s.store.total);
  add('En memoire', s.store.live);
  add('Debit', state.rate + '/s');
  add('Fusions', s.dedup.merged);
  add('Alertes', s.analyzer.findings, s.analyzer.bySeverity.critical ? 'ko' : null);
  add('Entrant', bytes(s.store.bytesDown));
  add('Sortant', bytes(s.store.bytesUp));
  add('Corps', s.streamFilter.captured);
  add('Sondes page', s.page.events);
  if (s.streamFilter.mocked) add('Simulees', s.streamFilter.mocked, 'ko');
  if (s.store.dropped) add('Purgees', s.store.dropped);

  foot.appendChild(el('span', { class: 'right' }, [
    s.capturing ? el('b', { class: 'ok', text: 'Capture' }) : el('b', { class: 'ko', text: 'En pause' }),
    '  ·  actif depuis ' + uptime(s.uptimeMs)
  ]));
}

/** Diagramme du debit : une barre par mesure reelle, 30 secondes glissantes. */
export function renderSpark() {
  const host = clear($('#spark'));
  const values = state.rates.length ? state.rates : [0];
  const max = Math.max(...values, 1);
  for (const value of values) {
    host.appendChild(el('i', {
      class: value ? null : 'zero',
      style: 'height:' + Math.max(4, (value / max) * 100) + '%',
      title: value + ' requetes/s'
    }));
  }
  host.title = 'Debit : ' + state.rate + ' requetes par seconde — pointe a ' + max + '/s sur 30 s';
}
