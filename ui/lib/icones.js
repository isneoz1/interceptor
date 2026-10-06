/* Icones de l interface — SWIFT (by NeoZ)
 *
 * Dessins originaux, traces sur une grille de 24 unites, d un seul trait a
 * bouts ronds : la meme main pour toutes. Les symboles Unicode employes
 * jusqu ici changeaient de forme et de graisse d une police a l autre, et
 * certains devenaient des emoji en couleur selon le systeme.
 *
 * Une icone ne porte jamais seule le sens : elle accompagne un libelle ou un
 * aria-label. Elle est donc cachee aux lecteurs d ecran.
 *
 * Construite element par element (createElementNS), jamais par du HTML :
 * la regle de tout le dossier `ui/`.
 */
const NS = 'http://www.w3.org/2000/svg';

/* Un point plein : les puces, les pastilles, le point d un « ? » ou d un « ! ». */
const point = (cx, cy, r = 1) => ['circle', { cx, cy, r, fill: 'currentColor', stroke: 'none' }];

const TRACES = {
  /* Navigation */
  requetes: [
    ['path', { d: 'M9 6h11M9 12h11M9 18h11' }],
    point(4.5, 6, 1.1), point(4.5, 12, 1.1), point(4.5, 18, 1.1)
  ],
  securite: [
    ['path', { d: 'M12 3.5l7 2.6v5.3c0 4.3-2.9 7.6-7 9.1-4.1-1.5-7-4.8-7-9.1V6.1z' }],
    ['path', { d: 'M12 8.5v4' }],
    point(12, 15.8)
  ],
  synthese: [
    ['path', { d: 'M4 20h16M7.5 16.5v-5M12 16.5v-9M16.5 16.5V10' }]
  ],
  sites: [
    ['rect', { x: 9.5, y: 3.5, width: 5, height: 4.5, rx: 1 }],
    ['rect', { x: 3.5, y: 16, width: 5, height: 4.5, rx: 1 }],
    ['rect', { x: 15.5, y: 16, width: 5, height: 4.5, rx: 1 }],
    ['path', { d: 'M12 8v4M6 16v-4h12v4' }]
  ],
  flux: [
    ['path', { d: 'M3 12h4l2.5-6 5 12 2.5-6h4' }]
  ],
  comparaison: [
    ['path', { d: 'M4 8h15M15.5 4.5L19 8l-3.5 3.5M20 16H5M8.5 12.5L5 16l3.5 3.5' }]
  ],
  cookies: [
    ['path', { d: 'M20.5 12A8.5 8.5 0 1 1 12 3.5a2.5 2.5 0 0 0 3 3 2.5 2.5 0 0 0 3 3 2.5 2.5 0 0 0 2.5 2.5z' }],
    point(8.5, 10), point(13, 15), point(8.5, 15.5)
  ],
  navigation: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M15.5 8.5l-2 5-5 2 2-5z' }]
  ],
  contexte: [
    ['rect', { x: 7, y: 7, width: 10, height: 10, rx: 1.5 }],
    ['path', { d: 'M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5' }]
  ],
  outils: [
    ['rect', { x: 3.5, y: 7.5, width: 17, height: 12, rx: 2 }],
    ['path', { d: 'M9 7.5v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3.5 12.5h17M12 11v3' }]
  ],
  regles: [
    ['path', { d: 'M4 5h16l-6.2 7.4V18l-3.6 2v-7.6z' }]
  ],
  interception: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M10 9v6M14 9v6' }]
  ],
  etat: [
    ['path', { d: 'M4.2 17.5a8.5 8.5 0 1 1 15.6 0M12 13.5l3.5-4' }],
    point(12, 13.5, 1.2)
  ],
  journal: [
    ['rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 }],
    ['path', { d: 'M7.5 9.5l3 2.5-3 2.5M13 15h3.5' }]
  ],
  reglages: [
    ['path', { d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }],
    ['circle', { cx: 15, cy: 7, r: 2 }],
    ['circle', { cx: 9, cy: 17, r: 2 }]
  ],
  tutoriel: [
    ['path', { d: 'M2.5 9.5L12 5l9.5 4.5L12 14zM21.5 9.5v5' }],
    ['path', { d: 'M6.5 11.6V16c0 1.3 2.5 2.5 5.5 2.5s5.5-1.2 5.5-2.5v-4.4' }]
  ],
  aide: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4' }],
    point(12, 16.6)
  ],

  /* Barre d en-tete et panneau de detail */
  etoile: [
    ['path', { d: 'M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z' }]
  ],
  ancrage: [
    ['rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 }],
    ['path', { d: 'M14.5 4.5v15' }]
  ],
  haut: [['path', { d: 'M6.5 14.5L12 9l5.5 5.5' }]],
  bas: [['path', { d: 'M6.5 9.5L12 15l5.5-5.5' }]],
  fermer: [['path', { d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' }]]
};

/** Les noms connus, pour les tests et la palette. */
export const NOMS_ICONES = Object.freeze(Object.keys(TRACES));

/**
 * Une icone SVG prete a inserer. Un nom inconnu donne `null` : l appelant
 * garde alors son libelle seul, plutot qu un carre vide.
 * @param {string} nom
 * @param {string} [classe]
 * @returns {SVGElement|null}
 */
export function icone(nom, classe = 'ico') {
  const trace = TRACES[nom];
  if (!trace || typeof document === 'undefined' || !document.createElementNS) return null;
  const svg = document.createElementNS(NS, 'svg');
  const attributs = {
    viewBox: '0 0 24 24', class: classe, 'aria-hidden': 'true', focusable: 'false',
    fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  };
  for (const [k, v] of Object.entries(attributs)) svg.setAttribute(k, v);
  for (const [balise, proprietes] of trace) {
    const forme = document.createElementNS(NS, balise);
    for (const [k, v] of Object.entries(proprietes)) forme.setAttribute(k, String(v));
    svg.appendChild(forme);
  }
  return svg;
}

/**
 * Pose l icone nommee par `data-icone` dans chaque element qui la demande.
 * Le bouton garde son nom accessible (aria-label ou title) : l icone n en
 * est que l image.
 * @param {ParentNode} racine
 */
export function poserIcones(racine) {
  for (const noeud of racine.querySelectorAll('[data-icone]')) {
    const dessin = icone(noeud.dataset.icone);
    if (!dessin) continue;
    while (noeud.firstChild) noeud.removeChild(noeud.firstChild);
    noeud.appendChild(dessin);
  }
}
