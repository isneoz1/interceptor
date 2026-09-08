/* Panneau « Reference » — INTERCEPTOR (by NeoZ)
 *
 * Les tables qu on va toujours chercher ailleurs : codes de statut, methodes,
 * entetes, types de media, ports. Elles vivent dans l extension, donc hors
 * ligne, et se cherchent depuis le texte de travail ou depuis le champ.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { STATUTS, METHODES, familleStatut } from '../lib/ref-http.js';
import { ENTETES, chercherEntetes } from '../lib/ref-entetes.js';
import { TYPES_MEDIA, chercherTypes } from '../lib/ref-mime.js';
import { PORTS, chercherPorts, plagePort } from '../lib/ref-ports.js';
import { SUITES_TLS, chercherSuitesTls, FERMETURES_WS, ERREURS_H2, ERREURS_FIREFOX }
  from '../lib/ref-reseau.js';
import { ALERTES_TLS, ERREURS_H3, ERREURS_QUIC, TYPES_DNS, RCODES_DNS }
  from '../lib/ref-protocoles.js';

const FAMILLES = [
  ['statuts', 'Codes de statut'],
  ['methodes', 'Methodes'],
  ['entetes', 'Entetes'],
  ['types', 'Types de media'],
  ['ports', 'Ports'],
  ['tls', 'Suites TLS'],
  ['ws', 'Fermetures WebSocket'],
  ['h2', 'Erreurs HTTP/2'],
  ['h3', 'Erreurs HTTP/3'],
  ['quic', 'Erreurs QUIC'],
  ['alertes', 'Alertes TLS'],
  ['dns', 'Types DNS'],
  ['rcodes', 'Codes de reponse DNS'],
  ['erreurs', 'Erreurs reseau']
];

export function panneauReference(entree, etat, redessiner) {
  const box = frag();
  const famille = etat.familleRef || 'statuts';
  const question = etat.questionRef === undefined ? String(entree || '').trim() : etat.questionRef;

  box.appendChild(sec('Reference', 'tables completes, hors ligne'));

  const choix = el('div', { class: 'actions' });
  for (const [cle, libelle] of FAMILLES) {
    choix.appendChild(button(libelle, () => { etat.familleRef = cle; redessiner(); },
      { class: famille === cle ? 'on' : 'ghost' }));
  }
  box.appendChild(choix);

  const champ = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: t('chercher un code, un nom, un mot'), value: question
  });
  champ.addEventListener('input', () => { etat.questionRef = champ.value; redessiner(); });
  box.appendChild(el('div', { class: 'actions' }, [champ]));

  if (famille === 'statuts') return ecrireStatuts(box, question);
  if (famille === 'methodes') return ecrireMethodes(box, question);
  if (famille === 'entetes') return ecrireEntetes(box, question);
  if (famille === 'types') return ecrireTypes(box, question);
  if (famille === 'tls') return ecrireTls(box, question);
  if (famille === 'ws') return ecrireListe(box, question, FERMETURES_WS, 'Fermetures WebSocket', ['code', 'nom', 'sens']);
  if (famille === 'h2') return ecrireListe(box, question, ERREURS_H2, 'Erreurs HTTP/2', ['code', 'nom', 'sens']);
  if (famille === 'h3') return ecrireListe(box, question, ERREURS_H3, 'Erreurs HTTP/3 et QPACK', ['code', 'hex', 'nom', 'sens']);
  if (famille === 'quic') return ecrireListe(box, question, ERREURS_QUIC, 'Erreurs de transport QUIC', ['code', 'hex', 'nom', 'sens']);
  if (famille === 'alertes') return ecrireListe(box, question, ALERTES_TLS, 'Alertes TLS', ['code', 'nom', 'sens']);
  if (famille === 'dns') return ecrireListe(box, question, TYPES_DNS, 'Types d enregistrement DNS', ['code', 'nom', 'sens']);
  if (famille === 'rcodes') return ecrireListe(box, question, RCODES_DNS, 'Codes de reponse DNS', ['code', 'nom', 'sens']);
  if (famille === 'erreurs') return ecrireListe(box, question, ERREURS_FIREFOX, 'Erreurs reseau', ['code', 'sens']);
  return ecrirePorts(box, question);
}

function filtrer(liste, question, champs) {
  const q = String(question || '').trim().toLowerCase();
  if (!q) return liste;
  return liste.filter(x => champs.some(c => String(x[c]).toLowerCase().includes(q)));
}

function ecrireStatuts(box, question) {
  const trouves = filtrer(STATUTS, question, ['code', 'nom', 'sens']);
  box.appendChild(sec('Codes de statut', trouves.length + ' / ' + STATUTS.length));
  if (!trouves.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucun code ne correspond.') }));
    return box;
  }
  let famille = null;
  for (const s of trouves) {
    const f = familleStatut(s.code);
    if (f !== famille) { famille = f; box.appendChild(sec(f, '')); }
    box.appendChild(el('div', { class: 'find info' }, [
      el('h4', { text: s.code + '  ' + s.nom }),
      el('p', { class: 'note', text: t(s.sens) })
    ]));
  }
  return box;
}

function ecrireMethodes(box, question) {
  const trouves = filtrer(METHODES, question, ['nom', 'sens']);
  box.appendChild(sec('Methodes', trouves.length + ' / ' + METHODES.length));
  for (const m of trouves) {
    const carte = el('div', { class: 'find info' }, [
      el('h4', { text: m.nom }),
      el('p', { class: 'note', text: t(m.sens) })
    ]);
    add(carte, kv('Sure (ne modifie rien)', m.sure ? 'oui' : 'non'));
    add(carte, kv('Idempotente', m.idempotente ? 'oui' : 'non'));
    add(carte, kv('Reponse cachable', m.cachable ? 'oui' : 'non'));
    box.appendChild(carte);
  }
  if (!trouves.length) box.appendChild(el('p', { class: 'note', text: t('Aucune methode ne correspond.') }));
  return box;
}

function ecrireEntetes(box, question) {
  const trouves = chercherEntetes(question);
  box.appendChild(sec('Entetes', trouves.length + ' / ' + ENTETES.length));
  if (!trouves.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucun entete ne correspond.') }));
    return box;
  }
  for (const h of trouves) {
    box.appendChild(el('div', { class: 'find info' }, [
      el('h4', { text: h.nom + '   ·   ' + t(h.sens) }),
      el('p', { class: 'note', text: t(h.description) })
    ]));
  }
  return box;
}

function ecrireTypes(box, question) {
  const trouves = chercherTypes(question);
  box.appendChild(sec('Types de media', trouves.length + ' / ' + TYPES_MEDIA.length));
  if (!trouves.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucun type ne correspond.') }));
    return box;
  }
  for (const m of trouves) {
    const carte = el('div', { class: 'find info' }, [
      el('h4', { text: m.type }),
      el('p', { class: 'note', text: t(m.description) })
    ]);
    add(carte, kv('Extensions', m.extensions || null));
    box.appendChild(carte);
  }
  return box;
}

function ecrirePorts(box, question) {
  const trouves = chercherPorts(question);
  box.appendChild(sec('Ports', trouves.length + ' / ' + PORTS.length));
  if (!trouves.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucun port ne correspond.') }));
    return box;
  }
  for (const p of trouves) {
    const carte = el('div', { class: 'find info' }, [
      el('h4', { text: p.numero + '  ' + p.service + '   ·   ' + p.protocole }),
      el('p', { class: 'note', text: t(p.note) })
    ]);
    add(carte, kv('Plage', plagePort(p.numero)));
    box.appendChild(carte);
  }
  return box;
}

/* --------------------------- Familles reseau ------------------------------ */
function ecrireTls(box, question) {
  const trouves = chercherSuitesTls(question);
  box.appendChild(sec('Suites TLS', trouves.length + ' / ' + SUITES_TLS.length));
  if (!trouves.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucune suite ne correspond.') }));
    return box;
  }
  for (const s of trouves) {
    const carte = el('div', { class: 'find ' + (s.solidite === 'cassee' ? 'warn' : 'info') }, [
      el('h4', { text: s.nom })
    ]);
    add(carte, kv('Version', s.version));
    add(carte, kv('Echange de cle', s.echange));
    add(carte, kv('Authentification', s.authentification));
    add(carte, kv('Chiffrement', s.chiffrement));
    add(carte, kv('Integrite', s.integrite));
    add(carte, kv('Solidite', t(s.solidite), { hl: true }));
    add(carte, kv('Confidentialite persistante', s.pfs ? t('oui') : t('non')));
    box.appendChild(carte);
  }
  return box;
}

/** Rendu commun aux tables « code, nom, sens » : WebSocket, HTTP/2, erreurs. */
function ecrireListe(box, question, table, titre, champs) {
  const trouves = filtrer(table, question, champs);
  box.appendChild(sec(titre, trouves.length + ' / ' + table.length));
  if (!trouves.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucune entree ne correspond.') }));
    return box;
  }
  for (const e of trouves) {
    const tete = e.nom
      ? (typeof e.code === 'number' ? e.code + (e.hex ? '  ' + e.hex : '') + '  ' + e.nom : e.nom)
      : String(e.code);
    box.appendChild(el('div', { class: 'find info' }, [
      el('h4', { text: tete }),
      el('p', { class: 'note', text: t(e.sens) })
    ]));
  }
  return box;
}
