/* Demonstration filmee — SWIFT (by D4RK)
 *
 *   node tools/demo.mjs
 *
 * Produit docs/demo.mp4 et docs/demo.gif : la vraie console, pilotee comme un
 * operateur la piloterait, filmee image par image. Une visite complete, en
 * chapitres : le tableau et sa recherche, les onglets du detail, les alertes,
 * la palette, chaque vue, la boite a outils, les regles et l interception, la
 * comparaison et l export, les reglages, les deux langues, les deux themes,
 * les emplacements de la console, le tutoriel et l aide.
 *
 * Rien n est joue : chaque frappe part dans la vraie interface, chaque vue se
 * dessine a partir du vrai noyau. On ne monte pas une demonstration, on en
 * filme une. Une action qui echoue arrete le tournage : mieux vaut pas de
 * film qu un film qui montre autre chose que ce qu il annonce.
 *
 * Le decoupage compte plus que la technique. Chaque plan tient assez
 * longtemps pour qu on lise ce qui vient de se passer, et une legende dit en
 * une ligne ce que l image montre.
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
/* Le GIF s affiche dans le README et se telecharge a chaque visite : moins
   d images par seconde et une largeur reduite le gardent leger. */
const GIF_PAR_SECONDE = 8;
const GIF_LARGEUR = 960;

/* La frappe se fait lettre par lettre : voir le mot s ecrire dit ce qui se
   passe bien mieux qu un champ qui se remplit d un coup. */
const MS_PAR_LETTRE = 80;

const scene = await ouvrirScene({ langue: 'en' });
const SORTIE = path.join(scene.RACINE, 'docs');
const IMAGES = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'swift-demo-'));
const VECTEURS_JOSE = JSON.parse(fs.readFileSync(path.join(scene.RACINE, 'tests', 'vecteurs-jose.json'), 'utf8'));
const VECTEURS_CLES = JSON.parse(fs.readFileSync(path.join(scene.RACINE, 'tests', 'vecteurs-cles.json'), 'utf8'));
/* Le nombre d assertions se relit dans le badge du README, comme le fait la
   banniere : un chiffre ecrit ici finirait par mentir. */
const ASSERTIONS = (fs.readFileSync(path.join(scene.RACINE, 'README.md'), 'utf8').match(/Assertions-([0-9]+)-/) || [])[1];
if (!ASSERTIONS) throw new Error('badge d assertions introuvable dans le README');

const navigateur = await ouvrirChrome({ largeur: LARGEUR, hauteur: HAUTEUR, echelle: 1 });
const page = navigateur.page;
/* Le film est en anglais : le navigateur aussi, pour que les formats qui
   suivent sa region (dates, nombres) ne sortent pas dans la langue du poste
   qui filme. */
await page('Emulation.setLocaleOverride', { locale: 'en-US' });

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

/** Execute dans la page ; une exception arrete le tournage. */
async function evaluer(expression, quoi = expression.slice(0, 80)) {
  const { result, exceptionDetails } = await page('Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) {
    throw new Error(quoi + ' : ' + (exceptionDetails.exception && exceptionDetails.exception.description
      || exceptionDetails.text));
  }
  return result && result.value;
}

/** Une action, puis quelques images pour la voir aboutir. */
async function agir(expression, secondes = 0.5) {
  await evaluer(expression);
  await tenir(secondes);
}

const touche = (cle, options = '') =>
  'document.dispatchEvent(new KeyboardEvent("keydown", { key: ' + JSON.stringify(cle)
  + ', bubbles: true' + (options ? ', ' + options : '') + ' }))';

/* La palette ecoute les fleches et Entree sur SON champ, pas sur le document :
   un evenement adresse au document ne redescend pas jusqu a lui. */
const toucheDansPalette = cle =>
  'document.getElementById("pal-q").dispatchEvent(new KeyboardEvent("keydown", { key: '
  + JSON.stringify(cle) + ', bubbles: true }))';

/** Ecrire dans un champ, lettre par lettre, en filmant la frappe.
 *
 * L expression est enveloppee : `Runtime.evaluate` reutilise le meme contexte
 * d une frappe a l autre, et une declaration `const` y leverait des la
 * deuxieme lettre. */
async function taperDans(id, texte) {
  for (let i = 1; i <= texte.length; i++) {
    await evaluer('(() => {'
      + ' const champ = document.getElementById(' + JSON.stringify(id) + ');'
      + ' if (!champ) throw new Error("champ ' + id + ' absent");'
      + ' champ.value = ' + JSON.stringify(texte.slice(0, i)) + ';'
      + ' champ.dispatchEvent(new Event("input", { bubbles: true }));'
      + '})()', 'frappe « ' + texte + ' »');
    await tenir(MS_PAR_LETTRE / 1000);
  }
}

/** Ouvrir la palette, y taper, valider. */
async function palette(texte, attente = 0.9) {
  await agir(touche('k', 'ctrlKey: true'), 0.4);
  await taperDans('pal-q', texte);
  await tenir(attente);
  await agir(toucheDansPalette('Enter'), 0.6);
}

/** Aller a une vue, et verifier qu on y est. */
async function vue(nom, secondes = 0.6) {
  await agir('window.__vue(' + JSON.stringify(nom) + ')', secondes);
  const active = await evaluer('document.querySelector(".navbtn.on") && document.querySelector(".navbtn.on").textContent.trim()');
  if (!active) throw new Error('aucune vue active apres avoir vise « ' + nom + ' »');
  console.log('    vue : ' + active);
}

/** Cliquer le premier element de ce selecteur dont le texte correspond. */
const cliquerTexte = (selecteur, motif) => '(() => {'
  + ' const b = [...document.querySelectorAll(' + JSON.stringify(selecteur) + ')]'
  + '   .find(x => new RegExp(' + JSON.stringify(motif) + ').test(x.textContent.trim()));'
  + ' if (!b) throw new Error("introuvable : ' + selecteur.replace(/"/g, '') + ' ' + motif.replace(/"/g, '') + '");'
  + ' b.click();'
  + '})()';

/** Ouvrir une requete du tableau dans le detail. */
const ouvrirRequete = id => 'document.dispatchEvent(new CustomEvent("ic:goto",'
  + ' { detail: { view: "requests", id: ' + id + ' } }))';

/** Faire defiler un cadre en douceur, image par image. */
async function defiler(selecteur, jusqua, secondes) {
  const pas = Math.max(1, Math.round(secondes * PAR_SECONDE));
  const depart = await evaluer('(document.querySelector(' + JSON.stringify(selecteur) + ') || {}).scrollTop || 0');
  for (let i = 1; i <= pas; i++) {
    const y = Math.round(depart + (jusqua - depart) * (1 - Math.cos(Math.PI * i / pas)) / 2);
    await evaluer('(() => { const e = document.querySelector(' + JSON.stringify(selecteur) + ');'
      + ' if (e) e.scrollTop = ' + y + '; })()');
    await image();
  }
}

/** Poser une valeur dans la boite a outils et ouvrir l outil, comme le fait
 *  le menu d une ligne : la fonction de la console, pas une imitation. */
const outil = (valeur, vers, extra = '') => '(async () => {'
  + ' const m = await import("/ui/console/tools.js");'
  + ' m.poser(' + JSON.stringify(valeur) + ', { vers: ' + JSON.stringify(vers) + extra + ' });'
  + '})()';

/** Changer un reglage par la fonction de la console. */
const regler = patch => '(async () => {'
  + ' const app = await import("/ui/app.js");'
  + ' const r = await app.saveConfig(' + JSON.stringify(patch) + ');'
  + ' if (!r) throw new Error("reglage refuse");'
  + '})()';

/* ------------------------- Cartons et legendes ---------------------------- */
/* Un calque pose DANS la page, pas une image montee par-dessus : la console
   reste derriere, et rien n a besoin d etre recharge entre deux plans. Les
   proprietes de style sont posees une a une : le raccourci « font » exige une
   famille valide, et « inherit » n en est pas une. */
async function carton(titre, ligne, secondes, surtitre = '') {
  /* Les textes sont interpoles ICI, cote Node : les nommer dans l expression
     les ferait chercher dans la page, ou ils n existent pas. */
  await evaluer(`(() => {
    const c = document.createElement('div');
    c.id = 'demo-carton';
    c.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;'
      + 'flex-direction:column;align-items:center;justify-content:center;'
      + 'background:radial-gradient(ellipse at 50% 35%,#1A2240 0%,#0D1117 62%);text-align:center;padding:0 64px;'
      + 'font-family:Segoe UI,system-ui,-apple-system,sans-serif';

    const s = document.createElement('div');
    s.style.cssText = 'font-size:15px;font-weight:700;letter-spacing:3px;'
      + 'text-transform:uppercase;color:#7C8CFF;margin-bottom:18px';
    s.textContent = ${JSON.stringify(surtitre)};

    const t = document.createElement('div');
    t.style.cssText = 'font-size:52px;font-weight:800;line-height:1.15;'
      + 'color:#E6EDF3;letter-spacing:-1px';
    t.textContent = ${JSON.stringify(titre)};

    const l = document.createElement('div');
    l.style.cssText = 'margin-top:18px;font-size:21px;font-weight:400;'
      + 'line-height:1.55;color:#9BA7B4;max-width:820px';
    l.textContent = ${JSON.stringify(ligne)};

    if (s.textContent) c.appendChild(s);
    c.appendChild(t);
    c.appendChild(l);
    document.body.appendChild(c);
  })()`, 'carton « ' + titre + ' »');
  await tenir(secondes);
}

/** Retirer le carton et laisser voir ce qu il y a derriere. */
async function decouvrir(secondes = 0.3) {
  await evaluer('(() => { const c = document.getElementById("demo-carton"); if (c) c.remove(); })()');
  await tenir(secondes);
}

let chapitreCourant = 0;
const CHAPITRES = 11;
/** Un chapitre : son carton, puis la console. */
async function chapitre(titre, ligne) {
  chapitreCourant++;
  await carton(titre, ligne, 1.7, chapitreCourant + ' / ' + CHAPITRES);
  await decouvrir(0.2);
}

/** Une ligne en bas de l image : ce que le plan montre. */
async function legende(texte) {
  await evaluer(`(() => {
    let l = document.getElementById('demo-legende');
    if (!l) { l = document.createElement('div'); l.id = 'demo-legende'; document.body.appendChild(l); }
    l.style.cssText = 'position:fixed;left:50%;bottom:46px;transform:translateX(-50%);z-index:9998;'
      + 'max-width:1040px;padding:11px 22px;border-radius:12px;background:rgba(13,17,23,.94);'
      + 'border:1px solid rgba(124,140,255,.6);box-shadow:0 12px 34px rgba(0,0,0,.5);'
      + 'color:#E6EDF3;font-family:Segoe UI,system-ui,sans-serif;font-size:19px;font-weight:600;'
      + 'text-align:center;line-height:1.4;pointer-events:none';
    l.textContent = ${JSON.stringify(texte)};
  })()`, 'legende');
}

async function sansLegende() {
  await evaluer('(() => { const l = document.getElementById("demo-legende"); if (l) l.remove(); })()');
}

/* ------------------------------- Le decoupage ----------------------------- */
console.log('Tournage…');
const R = scene.instantane.records;
const trouver = (quoi, test) => {
  const rec = R.find(test);
  if (!rec) throw new Error('la scene n a pas de ' + quoi);
  return rec;
};
const panier = trouver('POST /v2/cart', r => r.method === 'POST' && /\/v2\/cart$/.test(r.url));
const catalogue = trouver('appel au catalogue', r => /\/v2\/catalog\?/.test(r.url));
const graphql = trouver('appel GraphQL', r => /\/graphql$/.test(r.url));
const socket = trouver('WebSocket', r => r.type === 'websocket');
const evenements = trouver('flux SSE', r => /\/v2\/events$/.test(r.url));
const profil = trouver('PUT /v2/profile', r => r.method === 'PUT');

/* 0. L ouverture. Les deux premieres secondes sont celles ou le spectateur
      decide de rester : une phrase, et la console derriere. */
await vue('requests', 0.1);
await carton('SWIFT', 'Every request Firefox makes — captured, explained, rewritable.', 2.6,
  'A network workstation inside Firefox · by D4RK');
await decouvrir(0.4);

/* 1. Le tableau et sa recherche. */
await chapitre('Every request, once', 'Eight capture layers merged into one row per request — never twice.');
await legende('Live, from the first request: method, status, host, size, timing, risk');
await tenir(2.6);
await legende('Search like a search engine: method, status, host, size, regex');
await taperDans('q', 'status:5xx');
await tenir(1.4);
await agir('(() => { const q = document.getElementById("q"); q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true })); })()', 0.2);
await taperDans('q', 'method:POST host:api.');
await tenir(1.6);
await agir('(() => { const q = document.getElementById("q"); q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true })); })()', 0.4);
await legende('Quick filters: errors, alerts, third parties, streams, GraphQL, slow…');
await agir('document.querySelector("#facets .chip[data-key=err]").click()', 1.5);
await agir('document.querySelector("#facets .chip[data-key=err]").click()', 0.2);
await agir('document.querySelector("#facets .chip[data-key=risk]").click()', 1.5);
await agir('document.querySelector("#facets .chip[data-key=risk]").click()', 0.4);
await sansLegende();

/* 2. Une requete, de part en part : chaque onglet du detail. */
await chapitre('Everything about one request', 'Headers, bodies off the wire, cookies, TLS, findings, timeline, JavaScript stack, replay.');
/* Un detail plus haut le temps du chapitre : la legende ne cache plus son
   contenu. La hauteur est posee avant d ouvrir la requete, pour que sa ligne
   soit amenee dans le tableau. */
await agir('document.getElementById("detail").style.height = "64%"', 0.1);
await agir(ouvrirRequete(panier.id), 1.0);
const onglets = await evaluer('[...document.querySelectorAll("#dtabs .dtab")].map(b => b.textContent.trim())');
if (!onglets || onglets.length < 8) throw new Error('detail : onglets introuvables');
await legende('One request, ' + onglets.length + ' tabs — everything that was captured about it');
for (let i = 0; i < onglets.length; i++) {
  await agir('document.querySelectorAll("#dtabs .dtab")[' + i + '].click()', 0.4);
  /* L onglet des en-tetes est le plus riche : on le parcourt. */
  if (/^Headers/.test(onglets[i])) {
    await legende('The JWT this request carries: algorithm, claims, and how its signature can be checked');
    await defiler('#dbody', 1400, 2.4);
    await tenir(0.6);
    await legende('One request, ' + onglets.length + ' tabs — everything that was captured about it');
  } else {
    await tenir(1.1);
  }
}
await legende('What the server announces: deprecation, rate limits, links, caching');
await agir(ouvrirRequete(catalogue.id), 0.6);
await agir(cliquerTexte('#dtabs .dtab', '^Headers'), 0.4);
await agir('(() => { const c = document.querySelector("#dbody");'
  + ' const s = [...c.querySelectorAll(".sec")].find(x => x.textContent.startsWith("Future of the address"));'
  + ' if (!s) throw new Error("section Future of the address absente");'
  + ' c.scrollTop = s.offsetTop - c.offsetTop - 8; })()', 2.8);
await legende('A 200 that hides a GraphQL error — said plainly');
await agir(ouvrirRequete(graphql.id), 0.6);
await agir(cliquerTexte('#dtabs .dtab', '^Response'), 2.8);
await legende('A WebSocket session, message by message');
await agir(ouvrirRequete(socket.id), 0.6);
await agir(cliquerTexte('#dtabs .dtab', '^Streams'), 2.4);
await legende('Server-Sent Events, with their event names and ids');
await agir(ouvrirRequete(evenements.id), 0.6);
await agir(cliquerTexte('#dtabs .dtab', '^Streams'), 2.4);
await agir('document.getElementById("detail").style.height = ""', 0.1);
await sansLegende();

/* 3. Les alertes. */
await chapitre('Findings that carry their proof', 'Only what the capture proves. A missing header is not a vulnerability.');
await palette('secu');
await legende('Each finding points to the request that proves it');
await tenir(3.0);
await defiler('#view-alerts .pane', 700, 2.0);
await tenir(1.0);
await sansLegende();

/* 4. La palette. */
await chapitre('Ask anything — Ctrl+K', 'Every view, every tool, every status code and header, from one field.');
await palette('429');
await legende('« 429 », Enter: the status code, explained');
await tenir(2.6);
await agir(touche('k', 'ctrlKey: true'), 0.3);
await taperDans('pal-q', 'cookie');
await legende('Views, tools and the reference — ranked as you type');
await tenir(2.2);
await agir(touche('Escape'), 0.3);
await sansLegende();

/* 5. Chaque vue. */
await chapitre('The whole picture', 'Summary, sites, live streams, cookies, navigation, workers and WebRTC.');
for (const [nom, texte] of [
  ['summary', 'Summary: volumes, statuses, hosts, timings — at a glance'],
  ['sitemap', 'Sites and paths: the map of everything that was called'],
  ['streams', 'Live streams: every WebSocket and SSE session'],
  ['cookies', 'Cookie log: every set, change and removal — JavaScript ones included'],
  ['navigation', 'Navigation: the eight webNavigation events, frame by frame'],
  ['context', 'Workers, Service Workers and WebRTC: what the network alone does not show']
]) {
  await vue(nom, 0.2);
  await legende(texte);
  await tenir(2.4);
}
await sansLegende();

/* 6. La boite a outils. */
await chapitre('Twenty-five tools, all local', 'Decode, verify, convert, compare, generate — nothing leaves your machine.');
await vue('tools', 0.2);
await legende('Six families, twenty-five tools — paste anything');
await tenir(2.0);
const jeton = VECTEURS_JOSE.rfc7515 && JSON.stringify(VECTEURS_JOSE.rfc7515).match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
if (!jeton) throw new Error('jeton de la RFC 7515 introuvable dans les vecteurs');
const certificat = VECTEURS_CLES.ec256 && VECTEURS_CLES.ec256.certificat;
if (!certificat) throw new Error('certificat P-256 introuvable dans les vecteurs');
/* Ou commence le resultat : sous la grille des outils, ou sous une section
   precise quand le resultat utile vient plus bas. */
const debutResultat = (section = '') => '(() => {'
  + ' const p = document.querySelector("#view-tools .pane");'
  + ' const repere = ' + (section
    ? '[...document.querySelectorAll("#view-tools .sec")].find(s => s.textContent.startsWith(' + JSON.stringify(section) + '))'
    : 'document.querySelector("#view-tools .familles")') + ';'
  + ' if (!p || !repere) throw new Error("repere du resultat absent : ' + section.replace(/"/g, '') + '");'
  + ' const r = repere.getBoundingClientRect(), q = p.getBoundingClientRect();'
  + ' return Math.max(0, Math.round(p.scrollTop + (' + (section ? 'r.top' : 'r.bottom') + ' - q.top) - 10));'
  + '})()';
for (const [valeur, vers, texte, bouton, section] of [
  ['eyJ1c2VyIjoiYWRhIiwicm9sZSI6ImFkbWluIn0', 'transformer', 'Try everything: SWIFT recognises the encoding', '^Try everything$'],
  [jeton[0], 'jwt', 'JWT: header, claims and dates, read'],
  [certificat, 'cle', 'Public key: PEM, JWK, OpenSSH, pins and fingerprints — from one paste'],
  ['SWIFT by D4RK', 'empreintes', 'Hashes: MD5, the SHA-2 and SHA-3 families, and more', '^Compute all$'],
  ['1761759600', 'temps', 'A number read as a date: every possible reading of it', null, 'Readings of'],
  ['https://api.example.com/v2/catalog?page=1&sort=price&utm_source=mail#reviews', 'url', 'A URL, taken apart'],
  ['203.0.113.42/24', 'adresse', 'An IP address and its network'],
  ['0190a6f2-7c3e-7b8a-9f00-2b1c3d4e5f60', 'identifier', 'Identify: what is this string?'],
  ['curl -X POST https://api.example.com/v2/cart -H "Content-Type: application/json" -d \'{"item":"REF-8842","quantity":2}\'', 'importer', 'Paste a cURL command: it becomes a request'],
  ['otpauth://totp/Shop:ada@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Shop', 'otp', 'One-time codes, from an otpauth address',
    '^Read the pasted otpauth link$', 'OTP codes']
]) {
  await agir('(() => { const p = document.querySelector("#view-tools .pane"); if (p) p.scrollTop = 0; })()', 0);
  await agir(outil(valeur, vers), 0.4);
  if (bouton) await agir(cliquerTexte('#view-tools button', bouton), 0.4);
  await legende(texte);
  await defiler('#view-tools .pane', await evaluer(debutResultat(section || '')), 0.6);
  await tenir(2.0);
}
await sansLegende();

/* 7. Agir sur le trafic. */
await chapitre('Act on the traffic', 'Block, delay, mock or rewrite — or pause a request and edit it.');
await vue('rules', 0.2);
await legende('Rules: block, delay, mock, rewrite — each one says what it does');
await tenir(2.8);
await vue('intercept', 0.2);
await legende('Interception: pause a request, edit it, release it');
await tenir(2.6);
await sansLegende();

/* 8. Comparer et exporter. */
await chapitre('Compare, replay, export', 'Two requests side by side. HAR, Postman, OpenAPI — and code in 39 formats.');
await vue('requests', 0.3);
await agir('(() => {'
  + ' for (const id of [' + panier.id + ', ' + profil.id + ']) {'
  + '   const ligne = document.querySelector(\'.trow[data-id="\' + id + \'"]\');'
  + '   if (!ligne) throw new Error("ligne " + id + " absente");'
  + '   ligne.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));'
  + ' } })()', 0.8);
await legende('Two rows selected — Compare');
await tenir(0.8);
await agir('document.getElementById("compare").click()', 0.6);
await legende('Compare: headers, bodies and timings — exactly what differs');
await tenir(3.0);
await vue('requests', 0.3);
await agir('document.getElementById("sel-none").click()', 0.2);
await agir('document.getElementById("export").click()', 0.4);
await legende('Export: HAR, sanitised HAR, JSON, CSV, Postman, OpenAPI 3.1, findings report…');
await tenir(2.8);
await agir('document.body.click()', 0.2);
await agir('document.getElementById("more").click()', 0.4);
await legende('Actions: import a HAR or a session, analyse again, test the coverage, open in a tab or the sidebar');
await tenir(2.0);
await agir('document.body.click()', 0.3);
await sansLegende();

/* 9. A son gout, dans sa langue. */
await chapitre('Yours, in your language', 'Ten groups of settings, two languages, two themes, four windows.');
await vue('settings', 0.2);
await legende('Ten groups of settings, and four quick profiles');
await tenir(1.4);
await defiler('#view-settings .pane', 2600, 3.2);
await tenir(0.4);
await defiler('#view-settings .pane', 0, 0.8);
await vue('requests', 0.3);
await agir('document.getElementById("lang").click()', 0.8);
await legende('Français or English — Firefox\'s language from the first launch');
await tenir(2.4);
await agir('document.getElementById("lang").click()', 0.6);
await agir(regler({ theme: 'clair' }), 0.4);
await legende('Light, dark, or the system\'s');
await tenir(2.2);
await agir(regler({ theme: 'sombre' }), 0.4);
await agir('document.getElementById("dock").click()', 0.4);
await legende('A tab, the sidebar, a detached window — or the compact popup');
await tenir(2.2);
await agir('document.body.click()', 0.2);
/* La petite fenetre, dans sa taille reelle, posee devant la console. */
const taillePopup = (() => {
  const css = fs.readFileSync(path.join(scene.RACINE, 'ui', 'popup.css'), 'utf8');
  const m = /body\s*\{[^}]*?width:\s*(\d+)px;\s*height:\s*(\d+)px/.exec(css);
  if (!m) throw new Error('taille de la popup introuvable dans ui/popup.css');
  return { largeur: Number(m[1]), hauteur: Number(m[2]) };
})();
await evaluer(`(() => {
  const f = document.createElement('iframe');
  f.id = 'demo-popup';
  f.src = '/ui/popup.html';
  f.style.cssText = 'position:fixed;top:64px;right:28px;z-index:9997;border:1px solid #30373F;'
    + 'border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.6);background:#0D1117;'
    + 'width:${taillePopup.largeur}px;height:${Math.min(taillePopup.hauteur, HAUTEUR - 140)}px';
  document.body.appendChild(f);
})()`, 'popup');
await tenir(1.0);
await legende('The compact window: capture, counters, alerts and export, one click away');
await tenir(2.6);
await evaluer('document.getElementById("demo-popup").remove()');
await sansLegende();

/* 10. Apprendre. */
await chapitre('Learn as you go', 'A guided tutorial, a complete manual, and SWIFT\'s own state.');
await vue('tutorial', 0.2);
await legende('Twelve guided lessons — their buttons act on your real capture');
await tenir(2.6);
await vue('help', 0.2);
await legende('The complete manual, offline, in both languages');
await tenir(1.0);
await defiler('#view-help .pane', 1800, 2.4);
await tenir(0.4);
await vue('stats', 0.2);
await legende('System state: every layer, every counter');
await tenir(2.2);
await vue('debug', 0.2);
await legende('Its own diagnostic log, ready for a bug report');
await tenir(2.0);
await sansLegende();

/* 11. La fin : ce qu on emporte. */
await vue('requests', 0.2);
await chapitre('Free, open, and yours', 'Nothing leaves your machine.');
await carton('No telemetry · no dependencies · no account',
  ASSERTIONS + ' automated checks · MIT licence · English and French', 2.8);
await carton('github.com/isneoz1/interceptor',
  'SWIFT by D4RK · Firefox 115 or later', 3.4);

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
const palettePng = path.join(IMAGES, 'palette.png');

/* Le MP4 : pleine taille, pour la page de version et le partage. `yuv420p` et
   la dimension paire sont ce que les lecteurs attendent tous. */
const mp4Fait = ffmpeg(['-y', '-framerate', String(PAR_SECONDE), '-i', entree,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], 'MP4');

/* Le GIF : plus leger, car il s affiche dans le README. Une palette calculee
   sur toute la sequence evite le tramage sale des degrades sombres. */
let gifFait = ffmpeg(['-y', '-framerate', String(PAR_SECONDE), '-i', entree, '-vf',
  'fps=' + GIF_PAR_SECONDE + ',scale=' + GIF_LARGEUR + ':-1:flags=lanczos,palettegen=stats_mode=diff',
  palettePng], 'palette du GIF');
if (gifFait) {
  gifFait = ffmpeg(['-y', '-framerate', String(PAR_SECONDE), '-i', entree, '-i', palettePng,
    '-lavfi', 'fps=' + GIF_PAR_SECONDE + ',scale=' + GIF_LARGEUR + ':-1:flags=lanczos[x];[x][1:v]'
      + 'paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
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
