/* Visite guidee de la console — SWIFT (by D4RK)
 *
 * Deux minutes pour savoir ou se trouve chaque chose. La visite eclaire, une
 * par une, les zones de la console telles qu elles sont a l ecran, et dit en
 * deux phrases a quoi chacune sert.
 *
 * Elle ne montre que ce qui existe vraiment : une zone absente a cette
 * largeur — le diagramme de debit disparait sous 860 px — est sautee plutot
 * qu eclairee dans le vide. Et elle ne fait rien a la place de l utilisateur :
 * elle montre, elle ne clique pas.
 *
 * Elle se lance d elle-meme a l installation, puis depuis l Aide, le Tutoriel,
 * le menu Actions, la palette (Ctrl+K) et un tableau encore vide.
 */
import { el, clear, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';

/* Les etapes. Une fonction et non une table : les textes suivent la langue
   courante a chaque ouverture. Sans `cible`, la bulle se pose au centre. */
function etapes() {
  return [
    { titre: t('Bienvenue dans SWIFT'),
      texte: t('Deux minutes pour savoir ou se trouve chaque chose. Avancez avec « Suivante » ou les fleches du clavier ; Echap quitte la visite a tout moment.') },
    { cible: '#capture', titre: t('La capture'),
      texte: t('SWIFT enregistre le trafic de Firefox des son demarrage, sans rien a regler. Ce bouton met la capture en pause et la relance — touche P.') },
    { cible: '#q', titre: t('La recherche'),
      texte: t('Du texte libre, ou des criteres precis : status:>=400, method:POST, host:api. Le bouton « ? » juste a cote propose des recherches toutes faites — touche / pour venir ici.') },
    { cible: '#facets', titre: t('Les filtres d un clic'),
      texte: t('Ces puces filtrent le tableau en un clic : API, erreurs, alertes, tiers, requetes lentes… Le chiffre de chacune dit combien de lignes elle garde.') },
    { cible: '#tablewrap', titre: t('Le tableau des requetes'),
      texte: t('Une ligne par requete reelle, jamais de doublon. Un clic ouvre tout ce qui a ete capture dans le panneau du bas ; un clic droit copie, filtre, bloque ou envoie a la boite a outils.') },
    { cible: '#scope', titre: t('Le perimetre'),
      texte: t('« Onglet actif » suit l onglet ou vous naviguez ; « Tout Firefox » montre tout ce qui a ete capture, tous onglets confondus.') },
    { cible: '#side', titre: t('Les vues'),
      texte: t('Cette colonne ouvre les autres vues : Securite, Synthese, Flux temps reel, Boite a outils, Regles… Chacune suit le trafic en direct, sans bouton a presser. Survolez une vue pour savoir ce qu elle montre ; les touches 1 a 9 y menent aussi.') },
    { cible: '#export', titre: t('Exporter'),
      texte: t('HAR fidele, HAR aux secrets masques pour partager, JSON, CSV, Postman, OpenAPI, rapport, ou script pour votre langage : sur les lignes filtrees, ou sur votre selection.') },
    { cible: '#more', titre: t('Le menu Actions'),
      texte: t('Importer un HAR ou une session, tout reanalyser, ouvrir le tutoriel ou cette visite, ouvrir SWIFT dans un onglet ou dans le panneau lateral.') },
    { cible: '#dock', titre: t('Ou s ouvre la console'),
      texte: t('Onglet, panneau lateral, fenetre detachee ou fenetre compacte : ce bouton choisit, et retient votre choix pour le clic sur l icone.') },
    { cible: '#prefs', titre: t('Les reglages'),
      texte: t('Langue, theme clair ou sombre, taille du texte, mode simple, et quatre profils prets a l emploi. Le bouton FR / EN juste avant change la langue de toute l interface.') },
    { cible: '#foot', titre: t('La barre d etat'),
      texte: t('Les compteurs du noyau, en direct : requetes enregistrees, fusions de doublons, alertes, octets echanges, corps captures.') },
    { titre: t('Ctrl+K pour tout trouver'),
      texte: t('La palette ouvre n importe quelle vue, outil ou action par son nom, et repond aux questions : tapez 429, cache-status ou PROPFIND. Pour aller plus loin, le Tutoriel propose douze lecons, et l Aide contient tout le mode d emploi.'),
      fin: true }
  ];
}

let liste = [];
let index = 0;
let calque = null;          // le voile, qui couvre la page
let trou = null;            // la zone eclairee
let bulle = null;           // le texte et les boutons
let focusAvant = null;      // rendu a la fermeture
let surTaille = null;
let rappels = {};

/** Ce que la visite propose a sa derniere etape : la coquille le fournit. */
export function definirRappels(r) { rappels = r || {}; }

export function estOuverte() { return calque !== null; }

/** Ouvre la visite sur sa premiere etape. */
export function demarrer() {
  if (typeof document === 'undefined' || !document.body) return;
  if (calque) fermer();
  /* Les zones decrites vivent dans la vue Requetes : on y va d abord. */
  document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests' } }));
  liste = etapes();
  index = 0;
  focusAvant = document.activeElement || null;
  construire();
  montrer(0, 1);
  surTaille = () => placer();
  window.addEventListener('resize', surTaille);
}

/** Referme la visite et rend le focus la ou il etait. */
export function fermer() {
  if (calque) calque.remove();
  calque = null;
  trou = null;
  bulle = null;
  if (surTaille) window.removeEventListener('resize', surTaille);
  surTaille = null;
  const avant = focusAvant;
  focusAvant = null;
  if (avant && avant.isConnected && typeof avant.focus === 'function') avant.focus();
}

/** Les touches, tant que la visite est ouverte : elle seule les recoit. */
export function clavier(ev) {
  if (!calque) return;
  if (ev.key === 'Escape') { ev.preventDefault(); fermer(); return; }
  if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { ev.preventDefault(); suivante(); return; }
  if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); precedente(); }
}

function suivante() { montrer(index + 1, 1); }
function precedente() { montrer(index - 1, -1); }

/* ------------------------------- Mesures ---------------------------------- */
/* La zone d une etape, si elle est reellement a l ecran : un element masque
   n a pas de surface, et un element hors de la fenetre n a rien a montrer. */
function zone(selecteur) {
  if (!selecteur) return null;
  const noeud = document.querySelector(selecteur);
  if (!noeud || typeof noeud.getBoundingClientRect !== 'function') return null;
  const r = noeud.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return null;
  if (r.bottom <= 0 || r.right <= 0 || r.top >= window.innerHeight || r.left >= window.innerWidth) return null;
  return r;
}

/* La prochaine etape montrable dans un sens donne. Aucune vers l arriere :
   on reste ou l on est ; aucune vers l avant : la visite est finie. */
function montrer(depart, sens) {
  let i = depart;
  while (i >= 0 && i < liste.length && liste[i].cible && !zone(liste[i].cible)) i += sens;
  if (i < 0) return;
  if (i >= liste.length) { fermer(); return; }
  index = i;
  dessiner();
}

/* ------------------------------- Dessin ----------------------------------- */
function construire() {
  trou = el('div', { class: 'visite-trou', hidden: true });
  bulle = el('div', { class: 'visite-bulle', role: 'document' });
  calque = el('div', {
    class: 'visite', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'visite-titre'
  }, [trou, bulle]);
  document.body.appendChild(calque);
}

function dessiner() {
  if (!bulle) return;
  const etape = liste[index];
  clear(bulle);
  bulle.appendChild(el('div', { class: 'visite-compte', text: (index + 1) + ' / ' + liste.length }));
  bulle.appendChild(el('h3', { id: 'visite-titre', text: etape.titre }));
  bulle.appendChild(el('p', { text: etape.texte }));

  const nav = el('div', { class: 'visite-nav' });
  const avant = button('Precedente', precedente, { class: 'ghost' });
  if (index === 0) avant.disabled = true;
  nav.appendChild(avant);
  nav.appendChild(el('span', { class: 'grow' }));
  nav.appendChild(button('Quitter la visite', fermer, { class: 'ghost' }));
  const apres = button(etape.fin ? 'Terminer' : 'Suivante', etape.fin ? fermer : suivante, { class: 'accent' });
  nav.appendChild(apres);
  bulle.appendChild(nav);

  /* La derniere etape ouvre la suite : le tutoriel, ou la palette elle-meme. */
  if (etape.fin) {
    const suite = el('div', { class: 'actions visite-suite' });
    if (typeof rappels.tutoriel === 'function') {
      suite.appendChild(button('Ouvrir le tutoriel', () => { fermer(); rappels.tutoriel(); }));
    }
    if (typeof rappels.palette === 'function') {
      suite.appendChild(button('Ouvrir la palette (Ctrl+K)', () => { fermer(); rappels.palette(); }));
    }
    if (suite.childNodes.length) bulle.appendChild(suite);
  }

  placer();
  if (typeof apres.focus === 'function') apres.focus();
}

/* La bulle se pose sous la zone, ou au-dessus faute de place, ou dedans
   quand la zone occupe l ecran (le tableau) ; jamais hors de la fenetre. */
function placer() {
  if (!calque || !bulle) return;
  const etape = liste[index];
  const r = etape ? zone(etape.cible) : null;
  if (!r) {
    calque.classList.add('centre');
    trou.hidden = true;
    bulle.style.left = '';
    bulle.style.top = '';
    return;
  }
  calque.classList.remove('centre');
  trou.hidden = false;
  const MARGE = 6;
  const ECART = 14;
  trou.style.left = (r.left - MARGE) + 'px';
  trou.style.top = (r.top - MARGE) + 'px';
  trou.style.width = (r.width + 2 * MARGE) + 'px';
  trou.style.height = (r.height + 2 * MARGE) + 'px';

  const largeur = window.innerWidth;
  const hauteur = window.innerHeight;
  const lb = bulle.offsetWidth || 360;
  const hb = bulle.offsetHeight || 200;
  let haut = r.bottom + ECART;
  if (haut + hb > hauteur - 8) haut = r.top - hb - ECART;
  if (haut < 8) haut = Math.min(hauteur - hb - 8, r.top + ECART);
  let gauche = r.left + r.width / 2 - lb / 2;
  gauche = Math.max(8, Math.min(largeur - lb - 8, gauche));
  bulle.style.left = Math.round(gauche) + 'px';
  bulle.style.top = Math.round(Math.max(8, haut)) + 'px';
}

/** Le nombre d etapes au plus : certaines sont sautees en fenetre etroite. */
export function nombreEtapes() { return etapes().length; }
