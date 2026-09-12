/* Panneau « Reference » — INTERCEPTOR (by NeoZ)
 *
 * Les tables qu on va toujours chercher ailleurs : codes de statut, methodes,
 * entetes, types de media, ports. Elles vivent dans l extension, donc hors
 * ligne, et se cherchent depuis le texte de travail ou depuis le champ.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { STATUTS, METHODES, familleStatut } from '../lib/ref-http.js';
import { ENTETES, chercherEntetes } from '../lib/ref-entetes.js';
import { TYPES_MEDIA, chercherTypes } from '../lib/ref-mime.js';
import { PORTS, chercherPorts, plagePort } from '../lib/ref-ports.js';
import { SUITES_TLS, chercherSuitesTls, FERMETURES_WS, ERREURS_H2, ERREURS_FIREFOX }
  from '../lib/ref-reseau.js';
import { ALERTES_TLS, ERREURS_H3, ERREURS_QUIC, TYPES_DNS, RCODES_DNS }
  from '../lib/ref-protocoles.js';

/* Les quatorze familles, dans l ordre des boutons.
 *
 * Chaque ligne porte aussi sa table et de quoi etiqueter une entree : le
 * libelle qu on lit, et le mot qui la retrouve dans le champ de recherche.
 * C est ce qui permet a la palette de proposer les sept cents lignes sans
 * qu aucune liste soit recopiee — ajouter une table ici la rend cherchable
 * depuis Ctrl+K le jour meme.
 *
 * Les noms du protocole ne passent pas par `t` : « PROTOCOL_ERROR » ou « A »
 * s ecrivent pareil dans toutes les langues, et les traduire les rendrait
 * introuvables dans une documentation. Les fermetures WebSocket font
 * exception : leurs noms sont des phrases, et le dictionnaire les a. */
const FAMILLES = [
  /* « Tout » n a pas de table a elle : elle cherche dans les quatorze autres.
     C est la famille par defaut, parce que celui qui arrive ici avec une
     valeur en main ne sait pas toujours de quelle table elle releve. */
  ['tout', 'Tout', null, null],
  ['statuts', 'Codes de statut', () => STATUTS,
    s => [s.code + '  ' + s.nom, String(s.code), t(s.sens)]],
  ['methodes', 'Methodes', () => METHODES,
    m => [m.nom, m.nom, t(m.sens)]],
  ['entetes', 'Entetes', () => ENTETES,
    h => [h.nom, h.nom, t(h.sens) + '  ·  ' + t(h.description)]],
  ['types', 'Types de media', () => TYPES_MEDIA,
    m => [m.type, m.type, t(m.description) + (m.extensions ? '  ·  ' + m.extensions : '')]],
  ['ports', 'Ports', () => PORTS,
    p => [p.numero + '  ' + t(p.service), String(p.numero), p.protocole + '  ·  ' + t(p.note)]],
  ['tls', 'Suites TLS', () => SUITES_TLS,
    s => [s.nom, s.nom, s.version + '  ·  ' + t(s.chiffrement) + '  ·  ' + t(s.solidite)]],
  ['ws', 'Fermetures WebSocket', () => FERMETURES_WS,
    e => [e.code + '  ' + t(e.nom), String(e.code), t(e.sens)]],
  ['h2', 'Erreurs HTTP/2', () => ERREURS_H2,
    e => [e.nom, e.nom, t(e.sens)]],
  ['h3', 'Erreurs HTTP/3', () => ERREURS_H3,
    e => [e.nom, e.nom, t(e.sens)]],
  ['quic', 'Erreurs QUIC', () => ERREURS_QUIC,
    e => [e.nom, e.nom, t(e.sens)]],
  ['alertes', 'Alertes TLS', () => ALERTES_TLS,
    e => [e.nom, e.nom, t(e.sens)]],
  ['dns', 'Types DNS', () => TYPES_DNS,
    e => [e.nom, e.nom, t(e.sens)]],
  ['rcodes', 'Codes de reponse DNS', () => RCODES_DNS,
    e => [e.nom, e.nom, t(e.sens)]],
  ['erreurs', 'Erreurs reseau', () => ERREURS_FIREFOX,
    e => [e.code, e.code, t(e.sens)]]
];

/**
 * Toutes les lignes de reference, a plat, telles que la palette doit pouvoir
 * les atteindre.
 *
 * @returns [{ famille, groupe, libelle, question }] — `question` est ce qu on
 *          ecrit dans le champ de recherche pour retomber sur cette ligne.
 */
export function entreesReference() {
  const sortie = [];
  for (const [cle, titre, table, etiqueter] of FAMILLES) {
    if (!table) continue;   /* « Tout » n enumere rien : elle agrege. */
    for (const ligne of table()) {
      const [libelle, question] = etiqueter(ligne);
      sortie.push({ famille: cle, groupe: titre, libelle: String(libelle), question });
    }
  }
  return sortie;
}

export function panneauReference(entree, etat, redessiner) {
  const box = frag();
  const famille = etat.familleRef || 'tout';
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

  if (famille === 'tout') return ecrireTout(box, question);
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

/* Nombre de resultats affiches par « Tout ». Au-dela, la liste cesse d etre
   une reponse et redevient un tableau a parcourir : mieux vaut dire combien
   il en reste et laisser preciser la recherche. */
const MAX_TOUT = 60;

/** Les quatorze tables a la fois, pour qui ne sait pas dans laquelle chercher. */
function ecrireTout(box, question) {
  const q = String(question || '').trim().toLowerCase();
  const lignes = [];
  let total = 0;

  for (const [, titre, table, etiqueter] of FAMILLES) {
    if (!table) continue;
    for (const entree of table()) {
      total++;
      const [libelle, , explication] = etiqueter(entree);
      if (!q) continue;
      if (!String(libelle).toLowerCase().includes(q)
        && !String(explication).toLowerCase().includes(q)) continue;
      lignes.push({ titre, libelle: String(libelle), explication: String(explication) });
    }
  }

  /* Sans question, une liste de six cent quatre-vingt-onze lignes n apprend
     rien. On dit ce qu il y a, et ce qu il faut taper pour y arriver. */
  if (!q) {
    box.appendChild(sec('Tout', tp('{n} lignes, quatorze tables', { n: total })));
    box.appendChild(el('p', { class: 'note',
      text: t('Tapez un nom, un code ou un mot : les quatorze tables sont cherchees en meme temps. Ctrl+K fait la meme chose depuis n importe quelle vue.') }));
    for (const [, titre, table] of FAMILLES) {
      if (!table) continue;
      box.appendChild(kv(titre, table().length));
    }
    return box;
  }

  box.appendChild(sec('Tout', lignes.length + ' / ' + total));
  if (!lignes.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucune entree ne correspond.') }));
    return box;
  }

  for (const ligne of lignes.slice(0, MAX_TOUT)) {
    box.appendChild(el('div', { class: 'find info' }, [
      el('h4', { text: ligne.libelle + '   ·   ' + t(ligne.titre) }),
      el('p', { class: 'note', text: ligne.explication })
    ]));
  }
  if (lignes.length > MAX_TOUT) {
    box.appendChild(el('p', { class: 'note',
      text: tp('{n} autres entrees correspondent : precisez la recherche, ou choisissez une table.',
        { n: lignes.length - MAX_TOUT }) }));
  }
  return box;
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
    add(carte, kv('Sure (ne modifie rien)', m.sure ? t('oui') : t('non')));
    add(carte, kv('Idempotente', m.idempotente ? t('oui') : t('non')));
    add(carte, kv('Reponse cachable', m.cachable ? t('oui') : t('non')));
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
      el('h4', { text: p.numero + '  ' + t(p.service) + '   ·   ' + p.protocole }),
      el('p', { class: 'note', text: t(p.note) })
    ]);
    add(carte, kv('Plage', t(plagePort(p.numero))));
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
    /* « certificat » et « AES-128-CCM court » sont les deux seules valeurs
       de cette table qui portent un mot de langue ; les autres sont des noms
       d algorithme, identiques partout, que `t` laisse passer tels quels. */
    add(carte, kv('Authentification', t(s.authentification)));
    add(carte, kv('Chiffrement', t(s.chiffrement)));
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
    /* Le nom se traduit quand le dictionnaire le connait : « Fermeture
       normale » a une entree, « PROTOCOL_ERROR » n en a pas et n en veut pas.
       Sans ce `t`, la table des fermetures WebSocket restait en francais. */
    const nom = e.nom ? t(e.nom) : null;
    const tete = nom
      ? (typeof e.code === 'number' ? e.code + (e.hex ? '  ' + e.hex : '') + '  ' + nom : nom)
      : String(e.code);
    box.appendChild(el('div', { class: 'find info' }, [
      el('h4', { text: tete }),
      el('p', { class: 'note', text: t(e.sens) })
    ]));
  }
  return box;
}
