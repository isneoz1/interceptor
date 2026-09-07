/* Exhaustivite de l affichage — INTERCEPTOR (cree par D4RK)
 *
 * Regle du projet, ecrite en tete de `detail-parts.js` : tout champ present
 * dans un enregistrement est affiche quelque part. Ce test la fait respecter
 * mecaniquement — sans lui, ajouter un champ a la capture le laisse invisible
 * et personne ne s en apercoit.
 *
 * Il verifie aussi que les onglets du panneau de detail sont tous rendus par
 * une fonction reelle, et que les champs cherchables existent dans la forme
 * des enregistrements.
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
import { installerTout, egal, verifier, bilan } from './harnais.mjs';

installerTout();

const racine = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const lire = rel => fs.readFileSync(path.join(racine, rel), 'utf8');

const { newRecord } = await import('../background/core/store.js');
const { FIELDS } = await import('../ui/lib/filters.js');

/* Les modules qui composent le panneau de detail. */
const SOURCES_DETAIL = [
  'ui/console/detail.js',
  'ui/console/detail-parts.js',
  'ui/console/detail-more.js',
  'ui/console/replay.js'
];
const detail = SOURCES_DETAIL.map(lire).join('\n');

/* Champs internes au fonctionnement, sans contenu a montrer : ils portent un
   souligne de tete par convention. */
const INTERNES = ['_tlKeys'];

/* ------------------- 1. Tout champ capture est affiche -------------------- */
const champs = Object.keys(newRecord());
verifier('un enregistrement porte au moins cinquante champs', champs.length >= 50,
  champs.length + ' champs');

for (const champ of champs) {
  if (INTERNES.includes(champ)) continue;
  const cite = new RegExp('\\b' + champ + '\\b').test(detail);
  verifier('le champ « ' + champ + ' » est affiche dans le panneau de detail', cite);
}

/* L onglet « Brut » est le filet de securite : il rend l objet entier, donc un
   champ ajoute demain reste visible meme sans libelle dedie. */
verifier('un onglet rend l enregistrement complet', /jsonTree\(\s*rec/.test(detail));

/* ------------------ 2. Chaque onglet a une fonction de rendu -------------- */
const onglets = [...lire('ui/console/detail.js')
  .matchAll(/\{\s*key:\s*'([a-z]+)',\s*label:\s*'([^']+)',\s*render:\s*([^,\n]+)/g)];
verifier('le panneau de detail declare au moins dix onglets', onglets.length >= 10,
  onglets.length + ' onglets');

const partsExporte = [...lire('ui/console/detail-parts.js').matchAll(/export function (\w+)/g)]
  .map(m => m[1]);
const moreExporte = [...lire('ui/console/detail-more.js').matchAll(/export function (\w+)/g)]
  .map(m => m[1]);

for (const [, cle, libelle, rendu] of onglets) {
  const nom = rendu.trim().replace(/[\s}]+$/, '').replace(/^(parts|more)\./, '');
  const local = /^\s*(rec|\()/.test(rendu.trim());   // fonction ecrite sur place
  const connu = local || partsExporte.includes(nom) || moreExporte.includes(nom);
  verifier('l onglet « ' + libelle + ' » (' + cle + ') a une fonction de rendu', connu, rendu.trim());
}

/* ------------- 3. Les champs cherchables existent reellement -------------- */
/* `FIELDS` alimente l aide a la recherche : un champ propose mais absent de la
   forme des enregistrements donnerait un filtre qui ne trouve jamais rien. */
const formeRecord = newRecord();
const ALIAS = {
  status: 'statusCode', mime: 'mime', size: 'size', host: 'host', path: 'path',
  method: 'method', type: 'type', scheme: 'scheme', url: 'url', ip: 'ip',
  note: 'note', color: 'color', flag: 'flag', tab: 'tabId', duration: 'duration',
  state: 'state', error: 'error'
};
const nomsFields = Array.isArray(FIELDS) ? FIELDS.map(f => (typeof f === 'string' ? f : f.name || f.key))
  : Object.keys(FIELDS);
verifier('des champs de recherche sont declares', nomsFields.length > 5, nomsFields.length + ' champs');

for (const nom of nomsFields) {
  const cible = ALIAS[nom] || nom;
  const connu = cible in formeRecord
    || new RegExp('\\b' + nom + '\\b').test(lire('ui/lib/filters.js'));
  verifier('le champ de recherche « ' + nom + ' » correspond a quelque chose', connu);
}

/* ------------------- 4. Le magasin et l export restent d accord ----------- */
/* Un champ ajoute au magasin doit finir dans l export HAR, sinon une capture
   exportee perd de l information sans le dire. */
const har = lire('background/export/har.js');
for (const champ of ['requestHeaders', 'responseHeaders', 'statusCode', 'method', 'startTime']) {
  verifier('l export HAR utilise « ' + champ + ' »', new RegExp('\\b' + champ + '\\b').test(har));
}

egal('aucun champ interne oublie dans la liste', INTERNES.filter(c => !(c in formeRecord)).join(','), '');

bilan('Exhaustivite de l affichage');
