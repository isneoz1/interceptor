/* Vue « Sites et chemins » — arborescence des hotes — INTERCEPTOR (by NeoZ)
 *
 * Le tableau des requetes montre le flux dans l ordre du temps. Cette vue
 * montre la meme matiere autrement : la structure du site observe, hote par
 * hote et chemin par chemin. C est la question « qu existe-t-il la-bas ? »,
 * a laquelle une liste chronologique ne repond pas.
 *
 * Aucune requete n est emise : l arborescence n est faite que de ce qui a
 * reellement ete observe.
 */
import { $, el, clear, sec, button, kv, add, vide } from '../lib/dom.js';
import { bytes } from '../lib/format.js';
import { t, tp } from '../lib/i18n.js';
import { listeProgressive } from '../lib/liste-progressive.js';
import { state, inScope, copy, toast } from '../app.js';

const ouverts = new Set();      // chemins deplies, conserves entre deux rendus
let filtreHote = '';
let seulementAlertes = false;

/* ------------------------------ Construction ------------------------------ */
function noeud(nom, chemin) {
  return {
    nom, chemin,
    enfants: new Map(),
    requetes: [],
    compteur: 0,
    octets: 0,
    alertes: 0,
    methodes: new Set(),
    statuts: new Set(),
    parametres: new Set()
  };
}

/** Arborescence hote -> segments de chemin, batie sur le perimetre courant. */
function construire() {
  const racines = new Map();
  let total = 0;

  for (const id of state.order) {
    const rec = state.records.get(id);
    if (!rec || !inScope(rec)) continue;
    if (!rec.host) continue;
    if (filtreHote && !rec.host.toLowerCase().includes(filtreHote.toLowerCase())) continue;
    if (seulementAlertes && !rec.findings) continue;
    total++;

    if (!racines.has(rec.host)) racines.set(rec.host, noeud(rec.host, rec.host));
    const hote = racines.get(rec.host);
    compter(hote, rec);

    // On separe le chemin de la chaine de requete : les parametres sont une
    // information a part, ils ne creent pas de branche dans l arbre.
    const brut = String(rec.path || '/');
    const coupe = brut.indexOf('?');
    const chemin = coupe >= 0 ? brut.slice(0, coupe) : brut;
    const requete = coupe >= 0 ? brut.slice(coupe + 1) : '';
    if (requete) {
      for (const cle of requete.split('&')) {
        const nom = cle.split('=')[0];
        if (nom) hote.parametres.add(nom);
      }
    }

    const segments = chemin.split('/').filter(Boolean);
    let courant = hote;
    let accumule = rec.host;
    for (const seg of segments) {
      accumule += '/' + seg;
      if (!courant.enfants.has(seg)) courant.enfants.set(seg, noeud(seg, accumule));
      courant = courant.enfants.get(seg);
      compter(courant, rec);
      if (requete) {
        for (const cle of requete.split('&')) {
          const nom = cle.split('=')[0];
          if (nom) courant.parametres.add(nom);
        }
      }
    }
    // La feuille porte la requete elle-meme : on peut l ouvrir depuis l arbre.
    courant.requetes.push(rec.id);
  }
  return { racines, total };
}

function compter(n, rec) {
  n.compteur++;
  n.octets += rec.size || 0;
  n.alertes += rec.findings || 0;
  if (rec.method) n.methodes.add(rec.method);
  if (rec.statusCode) n.statuts.add(rec.statusCode);
}

/* --------------------------------- Rendu ---------------------------------- */
export function render() {
  const pane = clear($('#view-sitemap'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  box.appendChild(sec('Sites et chemins', 'ce qui existe sur les sites visites'));

  /* -------------------------------- Filtres ------------------------------- */
  const champ = el('input', {
    type: 'search', class: 'field', spellcheck: 'false',
    placeholder: t('Filtrer par hote…'), value: filtreHote
  });
  let minuteur = null;
  champ.addEventListener('input', () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => { filtreHote = champ.value; render(); }, 220);
  });
  box.appendChild(el('div', { class: 'actions' }, champ));

  const { racines, total } = construire();
  const hotes = [...racines.values()].sort((a, b) => b.compteur - a.compteur);

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button(seulementAlertes ? 'Tous les hotes' : 'Seulement avec alertes', () => {
    seulementAlertes = !seulementAlertes;
    render();
  }));
  actions.appendChild(button('Tout deplier', () => {
    for (const h of hotes) deplierTout(h);
    render();
  }));
  actions.appendChild(button('Tout replier', () => { ouverts.clear(); render(); }));
  actions.appendChild(button('Copier les hotes', () => {
    if (!hotes.length) return toast('Aucun hote', false);
    copy(hotes.map(h => h.nom).join('\n'), hotes.length + ' hotes copies');
  }));
  box.appendChild(actions);

  /* -------------------------------- Resume -------------------------------- */
  const tuiles = el('div', { class: 'tiles' });
  tuiles.appendChild(tuile(hotes.length, 'Hotes'));
  tuiles.appendChild(tuile(total, 'Requetes'));
  tuiles.appendChild(tuile(hotes.reduce((n, h) => n + compterFeuilles(h), 0), 'Chemins distincts'));
  tuiles.appendChild(tuile(hotes.reduce((n, h) => n + h.alertes, 0), 'Alertes'));
  box.appendChild(tuiles);

  if (!hotes.length) {
    box.appendChild(vide('Aucun hote',
      'Rien a montrer sur le perimetre observe. Naviguez, ou elargissez le perimetre en haut a droite.'));
    return;
  }

  box.appendChild(sec('Arborescence', tp('{n} hote(s)', { n: hotes.length })));
  for (const hote of hotes) box.appendChild(rendreNoeud(hote, true));
}

function tuile(valeur, libelle) {
  return el('div', { class: 'tile' }, [
    el('b', { text: String(valeur) }),
    el('label', { text: t(libelle) })
  ]);
}

function compterFeuilles(n) {
  if (!n.enfants.size) return n.requetes.length ? 1 : 0;
  let total = n.requetes.length ? 1 : 0;
  for (const enfant of n.enfants.values()) total += compterFeuilles(enfant);
  return total;
}

function deplierTout(n) {
  ouverts.add(n.chemin);
  for (const enfant of n.enfants.values()) deplierTout(enfant);
}

function rendreNoeud(n, estHote) {
  const enfants = [...n.enfants.values()].sort((a, b) => b.compteur - a.compteur);
  const feuille = !enfants.length;

  const resume = [
    n.compteur + ' req',
    n.methodes.size ? [...n.methodes].join('/') : null,
    n.octets ? bytes(n.octets) : null,
    n.alertes ? n.alertes + ' alerte(s)' : null
  ].filter(Boolean).join('  ·  ');

  const bloc = el('details', { open: ouverts.has(n.chemin) || estHote && ouverts.has(n.chemin) });
  const titre = el('summary', {
    class: n.alertes ? 'risque' : null,
    text: (estHote ? n.nom : '/' + n.nom) + '   —   ' + resume
  });
  titre.addEventListener('click', () => {
    // L etat d ouverture survit au redessin : sans cela, chaque battement de
    // statistiques refermerait l arbre sous les doigts.
    if (ouverts.has(n.chemin)) ouverts.delete(n.chemin); else ouverts.add(n.chemin);
  });
  bloc.appendChild(titre);

  const corps = el('div', { class: 'tree' });

  if (estHote) {
    add(corps, kv('Methodes', [...n.methodes].join(', ')));
    add(corps, kv('Statuts', [...n.statuts].sort((a, b) => a - b).join(', ')));
    add(corps, kv('Parametres vus', n.parametres.size ? [...n.parametres].sort().join(', ') : null));
    const acts = el('div', { class: 'actions' });
    acts.appendChild(button('Voir les requetes', () => {
      document.dispatchEvent(new CustomEvent('ic:goto', {
        detail: { view: 'requests', query: 'host:' + n.nom }
      }));
    }));
    acts.appendChild(button('Copier l hote', () => copy(n.nom, 'Hote copie')));
    corps.appendChild(acts);
  } else if (n.parametres.size) {
    add(corps, kv('Parametres', [...n.parametres].sort().join(', ')));
  }

  // Les requetes attachees a ce niveau exact : on peut les ouvrir directement.
  if (n.requetes.length) {
    /* Toutes les requetes de ce niveau, par lots : un chemin tres frequente
       en compte parfois des milliers, et aucune ne doit disparaitre. */
    const liste = el('div');
    listeProgressive(liste, n.requetes, id => {
      const rec = state.records.get(id);
      if (!rec) return null;
      const ligne = el('div', {
        class: 'kv copyable',
        title: t('Cliquer pour ouvrir cette requete')
      }, [
        el('span', { text: rec.method + '  ' + (rec.statusCode || rec.state) }),
        el('b', { text: (rec.path || '/') + (rec.findings ? '   ⚠ ' + rec.findings : '') })
      ]);
      ligne.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests', id } }));
      });
      return ligne;
    });
    corps.appendChild(liste);
  }

  for (const enfant of enfants) corps.appendChild(rendreNoeud(enfant, false));
  bloc.appendChild(corps);
  return bloc;
}
