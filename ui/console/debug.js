/* Vue « Journal interne » — INTERCEPTOR (by NeoZ)
 *
 * Cette vue n observe pas le trafic : elle observe l extension. Elle repond a
 * « qu est-ce qui a echoue chez INTERCEPTOR, et qu a-t-il fait ? ».
 *
 * A ne pas confondre avec « Etat du systeme », qui compte ce qui a ete
 * capture. Ici : erreurs internes, commandes et leur duree, evenements du
 * noyau. Le contenu se rafraichit a chaque battement de statistiques.
 */
import { $, el, clear, sec, button, kv, add, vide } from '../lib/dom.js';
import { clock, ms } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { state, cmd, toast, copy } from '../app.js';

const NIVEAUX = [
  ['error', 'Erreurs'], ['warn', 'Avertissements'],
  ['info', 'Informations'], ['trace', 'Evenements']
];

let filtreNiveau = null;
let filtreSource = null;
let recherche = '';
let cache = null;
let enCours = false;
let detailOuvert = new Set();
/* Ce que la derniere lecture a donne, quand elle a echoue. Sans cela, l ecran
   restait sur « Lecture du journal… » sans rien de plus a faire. */
let erreur = null;

/** Relit le journal du noyau puis redessine. */
export async function charger({ silencieux = false } = {}) {
  if (enCours) return;
  enCours = true;
  const res = await cmd('debugJournal', {
    niveau: filtreNiveau, source: filtreSource, recherche, limite: 3000
  });
  enCours = false;
  if (res.error) {
    erreur = res.error;
    if (!silencieux) toast(res.error, false);
    if (state.view === 'debug') render();
    return;
  }
  erreur = null;
  /* TOUJOURS une forme exploitable. Une reponse sans `journal` laissait
     `cache` vide, donc `render` redemandait un chargement, qui redemandait un
     rendu : la vue tournait en rond en microtaches et figeait l onglet. */
  cache = res.journal || { actif: false, entrees: [], compteurs: {} };
  render();
}

/** Rafraichissement automatique : appele par la coquille a chaque seconde. */
export function tick() {
  if (state.view === 'debug') charger({ silencieux: true });
}

export function render() {
  const pane = clear($('#view-debug'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  box.appendChild(sec('Journal interne', 'INTERCEPTOR observe par lui-meme'));

  if (!cache) {
    if (erreur) {
      box.appendChild(vide('Journal indisponible', erreur));
      box.appendChild(el('div', { class: 'actions' },
        button('Reessayer', () => { erreur = null; charger(); })));
      return;
    }
    box.appendChild(el('p', { class: 'note', text: t('Lecture du journal…') }));
    charger();
    return;
  }

  if (!cache.actif) {
    box.appendChild(vide('Journal desactive',
      'Activez « Journal interne » dans Reglages -> Journal interne pour enregistrer les erreurs et les commandes du noyau.'));
    return;
  }

  /* ------------------------- Compteurs cliquables ------------------------ */
  const tuiles = el('div', { class: 'tiles' });
  for (const [cle, libelle] of NIVEAUX) {
    const n = (cache.compteurs && cache.compteurs[cle]) || 0;
    const tuile = el('div', {
      class: 'tile' + (cle === 'error' ? ' alert' : '') + (cle === 'error' && n ? ' hot' : ''),
      title: t('Cliquer pour ne garder que ce niveau')
    }, [el('b', { text: String(n) }), el('label', { text: t(libelle) })]);
    if (filtreNiveau === cle) tuile.style.borderColor = 'var(--accent)';
    tuile.addEventListener('click', () => {
      filtreNiveau = filtreNiveau === cle ? null : cle;
      charger();
    });
    tuiles.appendChild(tuile);
  }
  box.appendChild(tuiles);

  /* ------------------------------- Actions ------------------------------- */
  const champ = el('input', {
    type: 'search', class: 'field', spellcheck: 'false',
    placeholder: t('Chercher dans le journal…'), value: recherche
  });
  let minuteur = null;
  champ.addEventListener('input', () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => { recherche = champ.value; charger(); }, 220);
  });
  box.appendChild(el('div', { class: 'actions' }, champ));

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Actualiser', () => charger()));
  actions.appendChild(button('Vider le journal', async () => {
    const res = await cmd('clearDebug', {});
    if (res.error) return toast(res.error, false);
    detailOuvert.clear();
    toast('Journal vide');
    charger();
  }, { class: 'danger' }));
  actions.appendChild(button('Poser un repere', async () => {
    const res = await cmd('debugNote', { message: 'repere pose depuis la console', niveau: 'info' });
    if (res.error) return toast(res.error, false);
    toast('Repere pose dans le journal');
    charger();
  }, { title: 'Ecrit une ligne horodatee : sert a marquer le moment d un test' }));
  actions.appendChild(button('Exporter le journal', async () => {
    const res = await cmd('exportFile', { format: 'debug' });
    if (res.error) return toast(res.error, false);
    toast('Journal ecrit — ' + res.filename);
  }));
  actions.appendChild(button('Copier', () => {
    const lignes = (cache.entrees || []).map(ligneTexte);
    if (!lignes.length) return toast('Journal vide', false);
    copy(lignes.join('\n'), lignes.length + ' lignes copiees');
  }));
  if (filtreNiveau || filtreSource || recherche) {
    actions.appendChild(button('Retirer les filtres', () => {
      filtreNiveau = null; filtreSource = null; recherche = '';
      charger();
    }));
  }
  box.appendChild(actions);

  /* ------------------------------- Sources ------------------------------- */
  if (cache.sources && cache.sources.length) {
    const puces = el('div', { class: 'facets' });
    for (const s of cache.sources) {
      const puce = el('div', { class: 'chip' + (filtreSource === s.nom ? ' on' : '') }, [
        el('span', { text: s.nom }),
        el('span', { class: 'n', text: String(s.n) })
      ]);
      puce.addEventListener('click', () => {
        filtreSource = filtreSource === s.nom ? null : s.nom;
        charger();
      });
      puces.appendChild(puce);
    }
    box.appendChild(puces);
  }

  /* ------------------------------- Etat ---------------------------------- */
  const etat = el('div');
  add(etat, kv('Entrees conservees', cache.retenues, { always: true }));
  add(etat, kv('Entrees ecartees faute de place', cache.perdues || null));
  add(etat, kv('Plafond du journal', cache.plafond ? cache.plafond + ' entrees' : 'illimite', { always: true }));
  add(etat, kv('Journal demarre a', clock(cache.depuis), { always: true }));
  box.appendChild(etat);

  /* -------------------------- Commandes les plus lentes ------------------ */
  if (cache.lentes && cache.lentes.length) {
    box.appendChild(sec('Commandes les plus lentes', cache.lentes.length));
    const bloc = el('div');
    for (const l of cache.lentes) {
      add(bloc, kv(l.nom, ms(l.ms) + (l.erreur ? '  ·  ' + l.erreur : '') + '  ·  ' + clock(l.ts)));
    }
    box.appendChild(bloc);
  }

  /* ------------------------------- Journal ------------------------------- */
  const entrees = cache.entrees || [];
  box.appendChild(sec('Journal', entrees.length + ' / ' + cache.total + ' ligne(s)'));

  if (!entrees.length) {
    box.appendChild(vide('Journal vide',
      'Rien a signaler : aucune erreur interne, ou les filtres ecartent tout.'));
    return;
  }

  // Les lignes recentes en premier : c est ce qu on vient chercher.
  for (const e of [...entrees].reverse()) {
    const ligne = el('div', { class: 'find ' + gravite(e.niveau) }, [
      el('h4', { text: e.source + '  ·  ' + e.message }),
      el('p', { text: e.niveau.toUpperCase() + '  ·  ' + clock(e.ts) + '  ·  #' + e.n })
    ]);
    if (e.detail) {
      ligne.title = t('Cliquer pour afficher le detail');
      ligne.addEventListener('click', () => {
        if (detailOuvert.has(e.n)) detailOuvert.delete(e.n); else detailOuvert.add(e.n);
        render();
      });
      if (detailOuvert.has(e.n)) {
        ligne.appendChild(el('pre', { class: 'pre', text: JSON.stringify(e.detail, null, 2) }));
      }
    }
    box.appendChild(ligne);
  }
}

/** Correspondance niveau -> classe de gravite deja definie par le theme. */
function gravite(niveau) {
  if (niveau === 'error') return 'critical';
  if (niveau === 'warn') return 'high';
  if (niveau === 'info') return 'low';
  return 'info';
}

function ligneTexte(e) {
  return clock(e.ts) + '  [' + e.niveau + ']  ' + e.source + '  ' + e.message +
         (e.detail ? '  ' + JSON.stringify(e.detail) : '');
}

/** Nombre d erreurs : sert a la pastille de la barre laterale. */
export function erreurs() {
  return cache && cache.compteurs ? cache.compteurs.error : 0;
}
