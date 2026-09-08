/* Emplacement de la console — INTERCEPTOR (by NeoZ)
 *
 * Le meme principe que l ancrage des outils de developpement de Firefox :
 * la console s ouvre la ou vous voulez, et elle y reste.
 *
 *   popup    fenetre compacte sous l icone
 *   onglet   console complete dans un onglet
 *   panneau  panneau lateral de Firefox (a gauche ou a droite selon Firefox)
 *   fenetre  fenetre detachee, posee a droite, a gauche, en haut, en bas,
 *            au centre, en plein ecran, ou a l endroit que vous lui donnez
 *
 * Une seule console reste ouverte a la fois : on reutilise et on ramene au
 * premier plan celle qui existe deja plutot que d en empiler dix.
 */
import { B } from '../lib/util.js';
import { config } from '../core/config.js';

export const EMPLACEMENTS = ['popup', 'onglet', 'panneau', 'fenetre'];
export const POSITIONS = ['droite', 'gauche', 'haut', 'bas', 'centre', 'plein', 'libre'];

const CONSOLE_URL = B.runtime.getURL('ui/console.html');
const MIN_LARGEUR = 480;
const MIN_HAUTEUR = 360;

let fenetreConsole = null;   // identifiant de la fenetre detachee en cours

/** Ancien nom conserve dans des configurations deja enregistrees. */
export function normaliserEmplacement(valeur) {
  if (valeur === 'console') return 'onglet';
  return EMPLACEMENTS.includes(valeur) ? valeur : 'popup';
}

/* --------------------------- Geometrie de l ecran ------------------------- */
/** Surface reellement disponible, barre des taches deduite. */
function ecran() {
  const s = (typeof window !== 'undefined' && window.screen) || null;
  const largeur = (s && (s.availWidth || s.width)) || 1280;
  const hauteur = (s && (s.availHeight || s.height)) || 800;
  const gauche = (s && Number.isFinite(s.availLeft)) ? s.availLeft : 0;
  const haut = (s && Number.isFinite(s.availTop)) ? s.availTop : 0;
  return { gauche, haut, largeur, hauteur };
}

/** Bornes de la fenetre pour une position donnee. Fonction pure : testable. */
export function bornesPour(position, zone, memoire) {
  const e = zone || ecran();
  const moitieL = Math.max(MIN_LARGEUR, Math.round(e.largeur / 2));
  const moitieH = Math.max(MIN_HAUTEUR, Math.round(e.hauteur / 2));

  switch (position) {
    case 'gauche':
      return { left: e.gauche, top: e.haut, width: moitieL, height: e.hauteur };
    case 'droite':
      return { left: e.gauche + e.largeur - moitieL, top: e.haut, width: moitieL, height: e.hauteur };
    case 'haut':
      return { left: e.gauche, top: e.haut, width: e.largeur, height: moitieH };
    case 'bas':
      return { left: e.gauche, top: e.haut + e.hauteur - moitieH, width: e.largeur, height: moitieH };
    case 'plein':
      return { left: e.gauche, top: e.haut, width: e.largeur, height: e.hauteur };
    case 'libre': {
      const m = memoire && Number.isFinite(memoire.width) ? memoire : null;
      if (m) {
        return {
          left: Math.round(m.left), top: Math.round(m.top),
          width: Math.max(MIN_LARGEUR, Math.round(m.width)),
          height: Math.max(MIN_HAUTEUR, Math.round(m.height))
        };
      }
      return bornesPour('centre', e, null);
    }
    default: {
      const largeur = Math.max(MIN_LARGEUR, Math.round(e.largeur * 0.82));
      const hauteur = Math.max(MIN_HAUTEUR, Math.round(e.hauteur * 0.86));
      return {
        left: e.gauche + Math.round((e.largeur - largeur) / 2),
        top: e.haut + Math.round((e.hauteur - hauteur) / 2),
        width: largeur, height: hauteur
      };
    }
  }
}

/* ------------------------------- Ouvertures ------------------------------- */
async function deposerIntention(intent) {
  if (!intent) return;
  const utile = intent.view || intent.query || intent.id != null;
  if (!utile) return;
  try { await B.storage.local.set({ consoleIntent: { ...intent, at: Date.now() } }); } catch {}
}

async function ongletExistant() {
  try {
    const trouves = await B.tabs.query({ url: CONSOLE_URL });
    return (trouves && trouves.length) ? trouves[0] : null;
  } catch { return null; }
}

async function ouvrirOnglet() {
  const existant = await ongletExistant();
  if (existant) {
    await B.tabs.update(existant.id, { active: true });
    try { await B.windows.update(existant.windowId, { focused: true }); } catch {}
    return { ok: true, emplacement: 'onglet', reutilise: true };
  }
  await B.tabs.create({ url: CONSOLE_URL, active: true });
  return { ok: true, emplacement: 'onglet', reutilise: false };
}

async function ouvrirPanneau() {
  if (!B.sidebarAction || !B.sidebarAction.open) {
    return { ok: false, emplacement: 'panneau', erreur: 'panneau lateral indisponible' };
  }
  // `open` exige un geste de l utilisateur : le clic sur l icone en est un.
  await B.sidebarAction.open();
  return { ok: true, emplacement: 'panneau', reutilise: true };
}

async function ouvrirFenetre(position, memoire) {
  const bornes = bornesPour(position, null, memoire);

  if (fenetreConsole != null) {
    try {
      await B.windows.get(fenetreConsole);
      await B.windows.update(fenetreConsole, { focused: true, state: 'normal', ...bornes });
      return { ok: true, emplacement: 'fenetre', reutilise: true, bornes };
    } catch { fenetreConsole = null; }
  }

  const creee = await B.windows.create({ url: CONSOLE_URL, type: 'popup', ...bornes });
  fenetreConsole = creee && creee.id != null ? creee.id : null;
  return { ok: true, emplacement: 'fenetre', reutilise: false, bornes };
}

/**
 * Ouvre la console la ou l utilisateur l a demandee.
 * `emplacement` force une surface pour un seul appel (boutons d ancrage).
 */
export async function ouvrirSurface(intent = null, emplacement = null) {
  await deposerIntention(intent);
  const choisi = normaliserEmplacement(emplacement || config.get('iconOpens'));
  try {
    if (choisi === 'panneau') return await ouvrirPanneau();
    if (choisi === 'fenetre') {
      return await ouvrirFenetre(config.get('consolePosition'), config.get('consoleBornes'));
    }
    // « popup » ne s ouvre pas par programme dans Firefox : le clic sur l icone
    // l affiche seul. Toute autre demande retombe donc sur l onglet complet.
    return await ouvrirOnglet();
  } catch (e) {
    return { ok: false, emplacement: choisi, erreur: String((e && e.message) || e) };
  }
}

/** Referme la fenetre detachee si elle existe (bouton « ancrer ailleurs »). */
export async function fermerFenetre() {
  if (fenetreConsole == null) return { ok: true, ferme: false };
  try { await B.windows.remove(fenetreConsole); } catch {}
  fenetreConsole = null;
  return { ok: true, ferme: true };
}

/** Deplace la console vers un autre emplacement sans perdre l etat. */
export async function deplacerConsole(emplacement, position) {
  const cible = normaliserEmplacement(emplacement);
  const patch = { iconOpens: cible };
  if (position && POSITIONS.includes(position)) patch.consolePosition = position;
  await config.set(patch);
  if (cible !== 'fenetre') await fermerFenetre();
  return ouvrirSurface(null, cible);
}

/* --------- Memoire de la position quand l utilisateur deplace la fenetre --- */
/** Retient les bornes de la fenetre detachee pour la position « libre ». */
export function suivreFenetre() {
  if (!B.windows || !B.windows.onRemoved) return;
  B.windows.onRemoved.addListener(id => {
    if (id === fenetreConsole) fenetreConsole = null;
  });
  if (!B.windows.onBoundsChanged) return;
  let attente = null;
  B.windows.onBoundsChanged.addListener(fenetre => {
    if (!fenetre || fenetre.id !== fenetreConsole) return;
    clearTimeout(attente);
    attente = setTimeout(async () => {
      const bornes = {
        left: fenetre.left, top: fenetre.top,
        width: fenetre.width, height: fenetre.height
      };
      if (!Number.isFinite(bornes.width) || !Number.isFinite(bornes.height)) return;
      await config.set({ consoleBornes: bornes, consolePosition: 'libre' });
    }, 400);
  });
}

/** Etat courant, pour que l interface coche le bon bouton d ancrage. */
export function etatSurface() {
  return {
    emplacement: normaliserEmplacement(config.get('iconOpens')),
    position: config.get('consolePosition') || 'droite',
    bornes: config.get('consoleBornes') || null,
    fenetreOuverte: fenetreConsole != null,
    panneauDisponible: !!(B.sidebarAction && B.sidebarAction.open)
  };
}

export const SURFACE_COMMANDS = {
  surfaceEtat: () => ({ surface: etatSurface() }),
  surfaceOuvrir: async ({ emplacement = null, view = null, query = null, id = null }) =>
    ouvrirSurface({ view, query, id }, emplacement),
  surfaceDeplacer: async ({ emplacement, position = null }) => {
    const r = await deplacerConsole(emplacement, position);
    return { ...r, surface: etatSurface() };
  }
};
