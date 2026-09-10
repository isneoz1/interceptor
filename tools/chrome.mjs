/* Chromium sans interface, pilote par le protocole DevTools
 * INTERCEPTOR (by NeoZ)
 *
 * Quatre outils avaient besoin de la meme chose — trouver un Chrome, le
 * lancer sans fenetre, lui parler par CDP — et chacun en portait sa copie.
 * Quatre copies, c est quatre endroits ou corriger le jour ou le chemin de
 * Chrome change.
 *
 * Aucune dependance : le WebSocket natif de Node suffit a parler CDP.
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/** Le premier Chrome ou Chromium trouve sur cette machine, ou null. */
export function trouverChrome() {
  const candidats = [];
  /* Playwright en installe un dans le profil de l utilisateur : c est le plus
     probable sur une machine de developpement. */
  const pw = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(pw)) {
    for (const d of fs.readdirSync(pw).filter(n => n.startsWith('chromium-')).sort().reverse()) {
      candidats.push(path.join(pw, d, 'chrome-win64', 'chrome.exe'));
      candidats.push(path.join(pw, d, 'chrome-linux', 'chrome'));
    }
  }
  candidats.push('C:/Program Files/Google/Chrome/Application/chrome.exe');
  candidats.push('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe');
  candidats.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  return candidats.find(c => fs.existsSync(c)) || null;
}

/**
 * Lance un Chromium sans interface et rend de quoi le piloter.
 *
 * @param options.largeur  taille de la fenetre
 * @param options.hauteur
 * @param options.echelle  densite de pixels du rendu (2 pour du net)
 * @returns { envoyer, page, surEvenement, fermer }
 *          `page` adresse la cible attachee, `envoyer` le navigateur lui-meme.
 */
export async function ouvrirChrome(options = {}) {
  const largeur = options.largeur || 1600;
  const hauteur = options.hauteur || 1000;
  const echelle = options.echelle == null ? 2 : options.echelle;

  const chrome = trouverChrome();
  if (!chrome) throw new Error('aucun Chrome ou Chromium trouve sur cette machine');

  const profil = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'interceptor-'));
  const navigateur = spawn(chrome, [
    '--headless=new', '--remote-debugging-port=0', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    '--force-color-profile=srgb', '--user-data-dir=' + profil,
    '--window-size=' + largeur + ',' + hauteur, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  /* Chrome annonce son port de debogage sur sa sortie d erreur. */
  const adresse = await new Promise((resolve, reject) => {
    let tampon = '';
    const minuteur = setTimeout(
      () => reject(new Error('Chrome n a pas annonce son port de debogage')), 30000);
    navigateur.stderr.on('data', bloc => {
      tampon += bloc.toString();
      const m = /ws:\/\/[^\s]+/.exec(tampon);
      if (m) { clearTimeout(minuteur); resolve(m[0]); }
    });
  });

  const ws = new WebSocket(adresse);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let sequence = 0;
  const attentes = new Map();
  const evenements = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && attentes.has(msg.id)) {
      const { resoudre, rejeter } = attentes.get(msg.id);
      attentes.delete(msg.id);
      msg.error ? rejeter(new Error(msg.error.message)) : resoudre(msg.result);
    } else if (msg.method && evenements.has(msg.method)) {
      for (const f of evenements.get(msg.method)) f(msg.params);
    }
  };

  const envoyer = (methode, params = {}, sessionId) => {
    const id = ++sequence;
    return new Promise((resoudre, rejeter) => {
      attentes.set(id, { resoudre, rejeter });
      ws.send(JSON.stringify(
        sessionId ? { id, method: methode, params, sessionId } : { id, method: methode, params }));
    });
  };

  const cibles = await envoyer('Target.getTargets');
  const cible = cibles.targetInfos.find(t => t.type === 'page');
  const { sessionId } = await envoyer('Target.attachToTarget',
    { targetId: cible.targetId, flatten: true });

  const page = (methode, params) => envoyer(methode, params, sessionId);
  await page('Page.enable');
  await page('Emulation.setDeviceMetricsOverride',
    { width: largeur, height: hauteur, deviceScaleFactor: echelle, mobile: false });

  return {
    envoyer,
    page,
    /** S abonner a un evenement CDP. */
    surEvenement(nom, f) {
      if (!evenements.has(nom)) evenements.set(nom, []);
      evenements.get(nom).push(f);
    },
    fermer() {
      ws.close();
      navigateur.kill();
      /* Windows garde le profil verrouille un instant apres kill() : un echec
         de menage ne doit pas faire echouer un travail deja abouti. */
      try {
        fs.rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch { /* le systeme le reprendra */ }
    }
  };
}

/** Attendre, sans importer un minuteur dans chaque outil. */
export const patienter = ms => new Promise(r => setTimeout(r, ms));

/**
 * Rend une page HTML et rend son image.
 *
 * Trois outils du depot font exactement cela — la banniere, les vitrines,
 * l apercu de l icone : composer un gabarit, le photographier une fois. Ils
 * portaient chacun leur copie du lancement de Chrome.
 *
 * @param pages    [{ html, fichier }] — rendues l une apres l autre dans le
 *                 meme navigateur, ce qui evite d en relancer un par image
 * @param options.attendreMs  temps laisse a la page pour finir de peindre ;
 *                 les images incrustees en base64 ne sont pas pretes des le
 *                 chargement
 * @returns [{ fichier, octets }]
 */
export async function rendrePages(pages, options = {}) {
  const attendre = options.attendreMs == null ? 1200 : options.attendreMs;
  const navigateur = await ouvrirChrome(options);
  const sortie = [];
  try {
    for (const { html, fichier } of pages) {
      await navigateur.page('Page.navigate', {
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
      });
      await patienter(attendre);
      const { data } = await navigateur.page('Page.captureScreenshot', { format: 'png' });
      sortie.push({ fichier, octets: Buffer.from(data, 'base64') });
    }
  } finally {
    /* Meme si une page echoue, le navigateur doit etre rendu au systeme. */
    navigateur.fermer();
  }
  return sortie;
}
