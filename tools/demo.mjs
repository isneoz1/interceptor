/* Demonstration filmee — INTERCEPTOR (by NeoZ)
 *
 *   node tools/demo.mjs
 *
 * Produit docs/demo.mp4 et docs/demo.gif : la vraie console, pilotee comme un
 * operateur la piloterait, filmee image par image.
 *
 * Rien n est joue : chaque frappe part dans la vraie interface, chaque vue se
 * dessine a partir du vrai noyau. On ne monte pas une demonstration, on en
 * filme une.
 *
 * Le decoupage compte plus que la technique. Une demonstration d outil qui
 * enchaine les ecrans sans laisser le temps de lire ne montre rien : chaque
 * plan tient assez longtemps pour qu on suive ce qui vient de se passer.
 *
 * ffmpeg est requis pour l assemblage. Sans lui, les images restent sur le
 * disque et la commande le dit.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ouvrirScene } from './scene.mjs';
import { ouvrirChrome, patienter } from './chrome.mjs';

const LARGEUR = 1280;
const HAUTEUR = 800;
const PAR_SECONDE = 12;

/* La frappe se fait lettre par lettre : voir le mot s ecrire dit ce qui se
   passe bien mieux qu un champ qui se remplit d un coup. */
const MS_PAR_LETTRE = 90;

const scene = await ouvrirScene({ langue: 'en' });
const SORTIE = path.join(scene.RACINE, 'docs');
const IMAGES = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'interceptor-demo-'));

const navigateur = await ouvrirChrome({ largeur: LARGEUR, hauteur: HAUTEUR, echelle: 1 });
const page = navigateur.page;

await page('Page.addScriptToEvaluateOnNewDocument', {
  source: scene.scriptDeDemarrage(JSON.stringify({
    stats: scene.instantane.stats, config: scene.instantane.config,
    capabilities: scene.instantane.capabilities, version: scene.VERSION
  }))
});

const chargee = new Promise(r => navigateur.surEvenement('Page.loadEventFired', r));
await page('Page.navigate', { url: 'http://127.0.0.1:' + scene.port + '/ui/console.html' });
await chargee;
await patienter(1200);

/* ------------------------------ La pellicule ------------------------------ */
let numero = 0;
async function image() {
  const { data } = await page('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(IMAGES, String(numero++).padStart(5, '0') + '.png'),
    Buffer.from(data, 'base64'));
}

/** Tenir le plan : n secondes d images, pendant lesquelles rien ne change. */
async function tenir(secondes) {
  const combien = Math.round(secondes * PAR_SECONDE);
  for (let i = 0; i < combien; i++) await image();
}

/** Une action, puis quelques images pour la voir aboutir. */
async function agir(expression, secondes = 0.5) {
  await page('Runtime.evaluate', { expression });
  await tenir(secondes);
}

const touche = (cle, options = '') =>
  'document.dispatchEvent(new KeyboardEvent("keydown", { key: ' + JSON.stringify(cle)
  + ', bubbles: true' + (options ? ', ' + options : '') + ' }))';

/* La palette ecoute les fleches et Entree sur SON champ, pas sur le document :
   un evenement adresse au document ne redescend pas jusqu a lui. Le viser
   directement est ce que fait un vrai clavier, ou la mise au point est dans
   le champ. */
const toucheDansPalette = cle =>
  'document.getElementById("pal-q").dispatchEvent(new KeyboardEvent("keydown", { key: '
  + JSON.stringify(cle) + ', bubbles: true }))';

/** Ecrire dans la palette, lettre par lettre, en filmant la frappe.
 *
 * L expression est enveloppee : `Runtime.evaluate` reutilise le meme contexte
 * d une frappe a l autre, et une declaration `const` y leve des la deuxieme
 * lettre. Le mot ne s ecrivait alors jamais au-dela de son initiale. */
async function taper(texte) {
  for (let i = 1; i <= texte.length; i++) {
    const { exceptionDetails } = await page('Runtime.evaluate', {
      expression: '(() => {'
        + ' const champ = document.getElementById("pal-q");'
        + ' if (!champ) throw new Error("palette fermee");'
        + ' champ.value = ' + JSON.stringify(texte.slice(0, i)) + ';'
        + ' champ.dispatchEvent(new Event("input", { bubbles: true }));'
        + '})()'
    });
    /* Une frappe qui echoue fait derailler tout le decoupage : mieux vaut
       arreter le tournage que livrer une demonstration qui montre autre
       chose que ce qu elle annonce. */
    if (exceptionDetails) {
      throw new Error('frappe « ' + texte + ' » impossible : '
        + (exceptionDetails.exception && exceptionDetails.exception.description
           || exceptionDetails.text));
    }
    await tenir(MS_PAR_LETTRE / 1000);
  }
}

/** Verifie qu on est bien sur la vue attendue avant de continuer. */
async function exigerVue(nom) {
  const { result } = await page('Runtime.evaluate', {
    expression: 'document.querySelector(".navbtn.on") && '
      + 'document.querySelector(".navbtn.on").textContent.trim()',
    returnByValue: true
  });
  if (!result.value) throw new Error('aucune vue active apres avoir vise « ' + nom + ' »');
  console.log('    vue : ' + result.value);
}

/* ------------------------------- Les cartons ------------------------------ */
/* Un calque pose DANS la page, pas une image montee par-dessus : la console
   reste derriere, et rien n a besoin d etre recharge entre deux plans. */
/* Les proprietes de style sont posees une a une plutot qu avec le raccourci
   « font » : celui-ci exige une famille valide, et « inherit » n en est pas
   une. Toute la declaration etait ignoree, et le carton s affichait en corps
   par defaut. */
async function carton(titre, ligne, secondes) {
  /* Les deux textes sont interpoles ICI, cote Node : les nommer dans
     l expression les ferait chercher dans le contexte de la page, ou ils
     n existent pas. Le carton restait alors invisible, sans erreur visible. */
  const expression = `(() => {
    const c = document.createElement('div');
    c.id = 'demo-carton';
    c.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;'
      + 'flex-direction:column;align-items:center;justify-content:center;'
      + 'background:#0D1117;text-align:center;padding:0 64px;'
      + 'font-family:Segoe UI,system-ui,-apple-system,sans-serif';

    const t = document.createElement('div');
    t.style.cssText = 'font-size:52px;font-weight:800;line-height:1.15;'
      + 'color:#E6EDF3;letter-spacing:-1px';
    t.textContent = ${JSON.stringify(titre)};

    const l = document.createElement('div');
    l.style.cssText = 'margin-top:18px;font-size:21px;font-weight:400;'
      + 'line-height:1.55;color:#9BA7B4;max-width:780px';
    l.textContent = ${JSON.stringify(ligne)};

    c.appendChild(t);
    c.appendChild(l);
    document.body.appendChild(c);
  })()`;

  const { exceptionDetails } = await page('Runtime.evaluate', { expression });
  if (exceptionDetails) {
    throw new Error('carton « ' + titre + ' » impossible : '
      + (exceptionDetails.exception && exceptionDetails.exception.description
         || exceptionDetails.text));
  }
  await tenir(secondes);
}

/** Retirer le carton et laisser voir ce qu il y a derriere. */
async function decouvrir(secondes = 0.3) {
  await page('Runtime.evaluate', {
    expression: '(() => { const c = document.getElementById("demo-carton"); if (c) c.remove(); })()'
  });
  await tenir(secondes);
}

/* ------------------------------- Le decoupage ----------------------------- */
console.log('Tournage…');

/* 0. Un carton d une ligne. Les deux premieres secondes sont celles ou le
      spectateur decide de rester : lui faire chercher ce qu il regarde les
      gaspille. */
await agir('window.__vue("requests")', 0.1);
await carton('INTERCEPTOR',
  'Every request Firefox makes — captured, explained, rewritable.', 2.0);
await decouvrir(0.4);

/* 1. Le tableau. C est la vue ou l operateur passera l essentiel de son temps,
      elle merite qu on la laisse se lire. */
await tenir(2.4);

/* 2. La palette. Le plan qui montre qu on n a rien a chercher. */
await agir(touche('k', 'ctrlKey: true'), 0.6);
await taper('secu');
await tenir(1.1);
await agir(toucheDansPalette('Enter'), 1.0);
await exigerVue('Security');

/* 3. Les alertes. Le plan le plus fort de la demonstration : quatre
      constats reels, chacun avec la requete qui le prouve. On lui laisse
      le temps qu il faut pour en lire trois. */
await tenir(4.2);

/* 4. Retour au tableau, puis le detail d une requete : la profondeur. */
await agir(touche('k', 'ctrlKey: true'), 0.5);
await taper('req');
await tenir(0.7);
await agir(toucheDansPalette('Enter'), 0.9);

const cible = scene.instantane.records.find(r => r.method === 'POST');
if (cible) {
  await agir('document.dispatchEvent(new CustomEvent("ic:goto",'
    + ' { detail: { view: "requests", id: ' + cible.id + ' } }))', 1.2);
  await tenir(2.6);
}

/* 5. La boite a outils : ce qu on peut faire d une valeur une fois trouvee. */
await agir(touche('k', 'ctrlKey: true'), 0.5);
await taper('tool');
await tenir(0.7);
await agir(toucheDansPalette('Enter'), 1.0);
await exigerVue('Toolbox');
await tenir(2.0);

/* 5 bis. La meme boite repond aussi aux questions. « 429 », Entree, et la
      reference s ouvre sur ce code-la, deja explique. Trois lettres au lieu
      d un onglet a trouver puis d un tableau a choisir. */
await agir(touche('k', 'ctrlKey: true'), 0.5);
await taper('429');
await tenir(0.9);
await agir(toucheDansPalette('Enter'), 1.0);
await exigerVue('Toolbox');
await tenir(2.6);

/* 6. Retour au tableau, puis le carton de fin. Une demonstration qui
      s arrete net laisse le spectateur sans rien a faire de ce qu il vient
      de voir. */
await agir(touche('k', 'ctrlKey: true'), 0.4);
await taper('req');
await agir(toucheDansPalette('Enter'), 1.4);
await carton('github.com/isneoz1/interceptor',
  'Open source · MIT · no telemetry · no dependencies', 2.6);

navigateur.fermer();
scene.fermer();
console.log('  ' + numero + ' images, ' + (numero / PAR_SECONDE).toFixed(1) + ' s');

/* ------------------------------- L assemblage ----------------------------- */
function ffmpeg(args, quoi) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    console.error('  ' + quoi + ' : echec');
    if (r.stderr) console.error(String(r.stderr).split('\n').slice(-6).join('\n'));
    return false;
  }
  return true;
}

const entree = path.join(IMAGES, '%05d.png');
const mp4 = path.join(SORTIE, 'demo.mp4');
const gif = path.join(SORTIE, 'demo.gif');
const palette = path.join(IMAGES, 'palette.png');

/* Le MP4 : pleine taille, pour la page de version et le partage. `yuv420p` et
   la dimension paire sont ce que les lecteurs attendent tous. */
const mp4Fait = ffmpeg(['-y', '-framerate', String(PAR_SECONDE), '-i', entree,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], 'MP4');

/* Le GIF : plus petit, car il s affiche dans le README et se telecharge a
   chaque visite. Une palette calculee sur toute la sequence evite le
   tramage sale des degrades sombres. */
let gifFait = ffmpeg(['-y', '-i', entree, '-vf',
  'fps=' + PAR_SECONDE + ',scale=900:-1:flags=lanczos,palettegen=stats_mode=diff',
  palette], 'palette du GIF');
if (gifFait) {
  gifFait = ffmpeg(['-y', '-framerate', String(PAR_SECONDE), '-i', entree, '-i', palette,
    '-lavfi', 'fps=' + PAR_SECONDE + ',scale=900:-1:flags=lanczos[x];[x][1:v]'
      + 'paletteuse=dither=bayer:bayer_scale=3',
    '-loop', '0', gif], 'GIF');
}

for (const [fait, fichier] of [[mp4Fait, mp4], [gifFait, gif]]) {
  if (!fait) continue;
  console.log('  ' + path.relative(scene.RACINE, fichier).replace(/\\/g, '/')
    + '  (' + Math.round(fs.statSync(fichier).size / 1024) + ' Ko)');
}

if (mp4Fait && gifFait) {
  fs.rmSync(IMAGES, { recursive: true, force: true });
  console.log('Demonstration terminee.');
} else {
  console.log('Images conservees dans ' + IMAGES
    + ' — ffmpeg est-il installe et accessible ?');
}
