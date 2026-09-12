/* Palette de commandes — INTERCEPTOR (by NeoZ)
 *
 * Ctrl+K, on tape ce qu on veut faire, Entree. Dix-sept vues, vingt-trois
 * outils et les actions de l en-tete deviennent atteignables sans savoir ou
 * elles se trouvent.
 *
 * Les tables de reference y sont aussi : taper « cache-status », « 429 » ou
 * « PROPFIND » ouvre la reference sur cette ligne-la. Sept cents reponses a
 * une frappe, au lieu de quatre clics pour arriver au bon tableau.
 *
 * Le registre se construit a partir des tables reelles — VIEWS de console.js,
 * FAMILLES de tools.js — et jamais d une liste recopiee : une vue ajoutee
 * apparait ici sans que personne y pense, et une vue retiree en disparait.
 *
 * L appariement et le classement vivent dans ui/lib/palette.js, ou ils se
 * testent sans navigateur. Ce fichier ne fait que l habillage et le clavier.
 */
import { $, el, clear } from '../lib/dom.js';
import { t, lang } from '../lib/i18n.js';
import { filtrer, morceaux, deplacer } from '../lib/palette.js';

let ouverte = false;
let resultats = [];
let choisi = 0;
let fabriquerCommandes = () => [];

/* Le registre complet depasse sept cents entrees. Le refabriquer entre deux
   frappes serait du gaspillage : on le garde, et on ne le refait que si la
   langue a change — c est la seule chose qui puisse en modifier les libelles. */
let registre = null;
let registreLangue = null;

/* Ce qu une ligne de reference concede aux commandes a correspondance egale.
   Quinze points valent environ trois lettres : assez pour que « cookies »
   propose la vue avant l en-tete, trop peu pour cacher « Cache-Status », que
   rien d autre ne porte. */
const POIDS_REFERENCE = 15;

/* --------------------------- Le registre ---------------------------------- */
/**
 * @param sources.vues       { cle: { label, group, hidden } } — les vues reelles
 * @param sources.outils     [[famille, [[id, libelle], ...]], ...]
 * @param sources.actions    [{ libelle, groupe, faire }] — en-tete et capture
 * @param sources.reference  () -> [{ famille, groupe, libelle, question }] —
 *                           une fonction, car les libelles changent avec la langue
 * @param sources.allerVue   (cle) -> void
 * @param sources.allerOutil (id) -> void
 * @param sources.allerReference (famille, question) -> void
 */
export function definirSources(sources) {
  registre = null;
  fabriquerCommandes = () => {
    if (registre && registreLangue === lang()) return registre;
    const liste = [];

    for (const [cle, vue] of Object.entries(sources.vues || {})) {
      /* Une vue « hidden » n a pas d entree dans la barre laterale, mais elle
         s ouvre : la comparaison, par exemple. La palette y donne acces. */
      liste.push({
        id: 'vue:' + cle,
        libelle: t(vue.label),
        groupe: t(vue.group || 'Vues'),
        indice: vue.hint ? t(vue.hint) : null,
        faire: () => sources.allerVue(cle)
      });
    }

    for (const [famille, outils] of sources.outils || []) {
      for (const [id, libelle] of outils) {
        liste.push({
          id: 'outil:' + id,
          libelle: t(libelle),
          groupe: t(famille),
          faire: () => sources.allerOutil(id)
        });
      }
    }

    for (const action of sources.actions || []) {
      liste.push({
        id: 'action:' + action.id,
        libelle: t(action.libelle),
        groupe: t(action.groupe || 'Actions'),
        indice: action.indice ? t(action.indice) : null,
        faire: action.faire
      });
    }

    /* Les tables de reference en dernier, et minorees par leur poids : elles
       repondent a « qu est-ce que Cache-Status ? » sans jamais s interposer
       devant « ou est la vue Cookies ? ».

       Leurs libelles sont deja dans la langue voulue — la famille sait si son
       nom se traduit ou s il s ecrit pareil partout — donc pas de `t` ici. */
    const lignes = typeof sources.reference === 'function'
      ? sources.reference() : (sources.reference || []);
    for (const ligne of lignes) {
      liste.push({
        id: 'ref:' + ligne.famille + ':' + ligne.question,
        libelle: ligne.libelle,
        groupe: t(ligne.groupe),
        poids: POIDS_REFERENCE,
        faire: () => sources.allerReference(ligne.famille, ligne.question)
      });
    }

    registreLangue = lang();
    registre = liste;
    return liste;
  };
}

/* ---------------------------- L affichage --------------------------------- */
function dessiner() {
  const liste = clear($('#pal-list'));
  if (!resultats.length) {
    liste.appendChild(el('p', { class: 'pal-vide', text: t('Aucune commande ne correspond.') }));
    return;
  }

  resultats.forEach(({ commande, positions }, i) => {
    const ligne = el('div', {
      class: 'pal-item' + (i === choisi ? ' on' : ''),
      role: 'option', 'aria-selected': i === choisi ? 'true' : 'false'
    }, [
      el('span', { class: 'pal-nom' },
        morceaux(commande.libelle, positions).map(m =>
          el('span', { class: m.marque ? 'hit' : null, text: m.texte }))),
      el('span', { class: 'pal-groupe', text: commande.groupe })
    ]);
    /* La souris survole sans declencher : on aligne la selection dessus pour
       que le clic et Entree fassent toujours la meme chose. */
    ligne.addEventListener('mousemove', () => {
      if (choisi === i) return;
      choisi = i;
      dessiner();
    });
    ligne.addEventListener('click', () => lancer(i));
    liste.appendChild(ligne);
  });

  const actif = liste.children[choisi];
  if (actif && actif.scrollIntoView) actif.scrollIntoView({ block: 'nearest' });
}

function rechercher(texte) {
  resultats = filtrer(fabriquerCommandes(), texte);
  choisi = 0;
  dessiner();
}

function lancer(i) {
  const trouve = resultats[i];
  if (!trouve) return;
  /* On ferme AVANT d agir : la commande peut ouvrir une autre fenetre, et
     deux couches empilees laissent l operateur sans repere. */
  basculer(false);
  try { trouve.commande.faire(); } catch { /* la vue ciblee signalera l echec */ }
}

/* ------------------------------ Ouverture --------------------------------- */
export function basculer(vers = !ouverte) {
  const boite = $('#pal');
  if (!boite) return;
  ouverte = vers;
  boite.hidden = !vers;
  if (!vers) return;

  const champ = $('#pal-q');
  champ.value = '';
  rechercher('');
  champ.focus();
}

export function estOuverte() { return ouverte; }

export function init() {
  const champ = $('#pal-q');
  if (!champ) return;

  champ.addEventListener('input', () => rechercher(champ.value));
  champ.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); choisi = deplacer(choisi, 1, resultats.length); dessiner(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); choisi = deplacer(choisi, -1, resultats.length); dessiner(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); lancer(choisi); }
    else if (ev.key === 'Escape') { ev.preventDefault(); basculer(false); }
  });

  /* Cliquer en dehors ferme, comme la fenetre des raccourcis. */
  $('#pal').addEventListener('click', ev => { if (ev.target.id === 'pal') basculer(false); });
}
