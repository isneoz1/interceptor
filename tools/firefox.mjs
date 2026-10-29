/* Firefox sans interface, pilote par WebDriver BiDi
 * SWIFT (by D4RK)
 *
 * SWIFT est une extension Firefox, mais les audits passaient par Chrome : un
 * comportement propre a Firefox leur echappait. Celui-ci, par exemple :
 * Chrome valide un champ modifie (« change ») quand on le retire de la page
 * pendant qu il a le focus, Firefox non. Un redessin qui remplacait ce champ
 * perdait donc ce qu on venait d y taper dans Firefox seulement.
 *
 * Firefox ne parle plus le protocole DevTools ; il parle WebDriver BiDi
 * (W3C), sur un WebSocket. Aucune dependance : le WebSocket natif de Node
 * suffit.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

/** Le premier Firefox trouve sur cette machine, ou null. */
export function trouverFirefox() {
  return [
    'C:/Program Files/Mozilla Firefox/firefox.exe',
    'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Mozilla Firefox', 'firefox.exe'),
    '/usr/bin/firefox', '/Applications/Firefox.app/Contents/MacOS/firefox'
  ].find(c => fs.existsSync(c)) || null;
}

/**
 * Lance un Firefox sans interface, avec un profil neuf, et rend de quoi le
 * piloter : evaluer dans la page, appuyer et relacher la souris, taper.
 *
 * @param options.largeur  taille de la fenetre
 * @param options.hauteur
 */
export async function ouvrirFirefox(options = {}) {
  const largeur = options.largeur || 1400;
  const hauteur = options.hauteur || 900;
  const firefox = trouverFirefox();
  if (!firefox) throw new Error('aucun Firefox trouve sur cette machine');

  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'swift-ff-'));
  fs.writeFileSync(path.join(profil, 'user.js'), [
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
    /* Sans fenetre active, Firefox deplace le focus sans emettre focus, blur
       ni change : un champ ne s enregistrerait jamais en perdant le focus. Le
       mode d essai de son gestionnaire de focus les emet comme dans une
       fenetre au premier plan. */
    'user_pref("focusmanager.testmode", true);'
  ].join('\n'));
  const navigateur = spawn(firefox, ['--headless', '--no-remote', '--profile', profil,
    '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });

  /* Firefox annonce son adresse BiDi sur sa sortie. */
  const adresse = await new Promise((resolve, reject) => {
    let tampon = '';
    const minuteur = setTimeout(
      () => reject(new Error('Firefox n a pas annonce WebDriver BiDi')), 60000);
    const lire = bloc => {
      tampon += bloc.toString();
      const m = /WebDriver BiDi listening on (ws:\/\/\S+)/.exec(tampon);
      if (m) { clearTimeout(minuteur); resolve(m[1].replace(/\/$/, '')); }
    };
    navigateur.stderr.on('data', lire);
    navigateur.stdout.on('data', lire);
  });

  const ws = new WebSocket(adresse + '/session');
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let sequence = 0;
  const attentes = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (!msg.id || !attentes.has(msg.id)) return;
    const { resoudre, rejeter } = attentes.get(msg.id);
    attentes.delete(msg.id);
    if (msg.type === 'error') rejeter(new Error(msg.error + ' : ' + msg.message));
    else resoudre(msg.result);
  };
  const envoyer = (method, params = {}) => new Promise((resoudre, rejeter) => {
    const id = ++sequence;
    attentes.set(id, { resoudre, rejeter });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await envoyer('session.new', { capabilities: {} });
  const { contexts } = await envoyer('browsingContext.getTree', {});
  const context = contexts[0].context;
  await envoyer('browsingContext.setViewport', { context, viewport: { width: largeur, height: hauteur } });
  /* Utile, pas indispensable : un Firefox qui ne la connait pas reste pilotable. */
  try { await envoyer('browsingContext.activate', { context }); } catch { /* sans effet sur la suite */ }
  const souris = actions => envoyer('input.performActions',
    { context, actions: [{ type: 'pointer', id: 'souris', parameters: { pointerType: 'mouse' }, actions }] });

  return {
    /** Un script a executer avant ceux de chaque page, comme l API d une extension. */
    precharger: source => envoyer('script.addPreloadScript', { functionDeclaration: '() => {' + source + '}' }),
    naviguer: url => envoyer('browsingContext.navigate', { context, url, wait: 'complete' }),
    /** Execute le corps d une fonction asynchrone dans la page ; rend sa valeur (JSON). */
    async dans(corps) {
      const r = await envoyer('script.evaluate', {
        expression: '(async () => JSON.stringify(await (async () => {' + corps + '})()))()',
        target: { context }, awaitPromise: true, resultOwnership: 'none'
      });
      if (r.type === 'exception') throw new Error(r.exceptionDetails.text);
      return r.result.value === undefined ? undefined : JSON.parse(r.result.value);
    },
    /* L etat des boutons persiste d un appel a l autre : on peut appuyer,
       faire autre chose, puis relacher. */
    appuyer: c => souris([{ type: 'pointerMove', x: Math.round(c.x), y: Math.round(c.y) }, { type: 'pointerDown', button: 0 }]),
    lacher: () => souris([{ type: 'pointerUp', button: 0 }]),
    async taper(texte) {
      const actions = [];
      for (const lettre of texte) actions.push({ type: 'keyDown', value: lettre }, { type: 'keyUp', value: lettre });
      await envoyer('input.performActions', { context, actions: [{ type: 'key', id: 'clavier', actions }] });
    },
    fermer() {
      ws.close();
      navigateur.kill();
      /* Windows garde le profil verrouille un instant apres kill(). */
      try {
        fs.rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch { /* le systeme le reprendra */ }
    }
  };
}
