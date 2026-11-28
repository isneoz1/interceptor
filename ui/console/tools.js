/* Vue « Boite a outils » — SWIFT (by D4RK)
 *
 * Un seul texte de travail, tous les outils dessus : on colle une valeur une
 * fois, et chaque panneau la regarde. Le texte peut venir du presse-papiers,
 * d une transformation precedente, ou d une requete capturee (menu contextuel
 * du tableau, onglets du detail).
 *
 * Tout se passe en local, sauf la famille « Interroger le reseau » — verifier
 * un site, une requete, une requete GraphQL, un flux, une connexion
 * WebSocket, une resolution DNS, une question RDAP — qui n emet rien sans un
 * clic, et, hors du resolveur de Firefox, sans l autorisation du rejeu.
 *
 * Sous le texte de travail, des suggestions disent quels outils sauront le
 * lire (lib/aiguillage.js) : un clic y mene.
 */
import { $, el, clear, sec, button } from '../lib/dom.js';
import { redessinerEnPlace } from '../lib/redessin.js';

import { t, tp, te } from '../lib/i18n.js';
import { toast, copy } from '../app.js';
import { TRANSFORMATIONS, GROUPES, transformer, transformerAsync } from '../lib/catalogue.js';
import { texteLong } from '../lib/texte-long.js';
import { panneauJwt, panneauEmpreintes, panneauMesures, panneauHex, panneauAnalyse, panneauRegex }
  from './tools-panels.js';
import { panneauHorodatage, panneauNombres } from './tools-temps.js';
import { panneauGenerateurs } from './tools-generer.js';
import { panneauImport } from './tools-import.js';
import { panneauUrl, panneauAdresse } from './tools-reseau.js';
import { panneauReference, entreesReference } from './tools-reference.js';
import { panneauCles, panneauIdentifier } from './tools-chiffres.js';
import { panneauChiffrement } from './tools-crypto.js';
import { panneauBinaire } from './tools-binaire.js';
import { panneauEntetes } from './tools-entetes.js';
import { panneauComparer } from './tools-diff.js';
import { panneauPatch } from './tools-patch.js';
import { panneauClePublique } from './tools-cle.js';
import { panneauMetadonnees } from './tools-metadonnees.js';
import { panneauChercher } from './tools-chercher.js';
import { panneauCode } from './tools-code.js';
import { panneauOtp } from './tools-otp.js';
import { panneauReponse } from './tools-reponse.js';
import { panneauRequete } from './tools-requete.js';
import { panneauDns } from './tools-dns.js';
import { panneauWebSocket } from './tools-websocket.js';
import { panneauVerifier } from './tools-verifier.js';
import { panneauGraphql } from './tools-graphql.js';
import { panneauSse } from './tools-sse.js';
import { panneauRdap } from './tools-rdap.js';
import { suggererOutils } from '../lib/aiguillage.js';

/* Les outils, ranges par intention plutot qu en une seule rangee de trente
   boutons. On cherche « ce que je veux faire », pas le nom de l outil : les
   familles portent donc des verbes, et chacune tient sur une ligne. */
/* Exporte pour la palette de commandes, qui construit son registre a partir
   de cette table plutot que d en recopier une. */
export const FAMILLES = [
  ['Decoder et convertir', [
    ['transformer', 'Transformer'],
    ['hex', 'Hexadecimal'],
    ['binaire', 'Binaire'],
    ['code', 'Code']
  ]],
  ['Chiffrement et empreintes', [
    ['empreintes', 'Empreintes'],
    ['chiffrement', 'Chiffrement'],
    ['cles', 'Cles et essais'],
    ['cle', 'Cle publique'],
    ['jwt', 'JWT'],
    ['otp', 'Codes OTP']
  ]],
  ['Reseau et HTTP', [
    ['url', 'URL'],
    ['adresse', 'Adresse IP'],
    ['entetes', 'Entetes'],
    ['reponse', 'Lire une reponse'],
    ['reference', 'Reference']
  ]],
  /* Les seuls outils qui emettent : regroupes, pour qu on sache d un regard
     lesquels touchent au reseau. */
  ['Interroger le reseau', [
    ['verifier', 'Verifier un site'],
    ['requete', 'Envoyer une requete'],
    ['graphql', 'Client GraphQL'],
    ['sse', 'Flux HTTP (SSE)'],
    ['websocket', 'Client WebSocket'],
    ['dns', 'Resolution DNS'],
    ['rdap', 'Whois (RDAP)']
  ]],
  ['Lire et mesurer', [
    ['analyse', 'Structures'],
    ['identifier', 'Identifier'],
    ['mesures', 'Mesures'],
    ['temps', 'Horodatage'],
    ['nombres', 'Nombres'],
    ['metadonnees', 'Metadonnees d image']
  ]],
  ['Chercher et comparer', [
    ['chercher', 'Chercher'],
    ['regex', 'Expression reguliere'],
    ['comparer', 'Comparer'],
    ['patch', 'JSON Patch']
  ]],
  ['Produire', [
    ['generer', 'Generer'],
    ['importer', 'Importer une requete']
  ]]
];

/* La liste a plat reste utile : `poser` verifie qu un onglet existe. */
const ONGLETS = FAMILLES.flatMap(([, outils]) => outils);

let entree = '';
let onglet = 'transformer';
let transformation = 'base64-dec';
let sortie = null;            // { ok, valeur } ou { ok:false, erreur }

/* Etat propre a chaque panneau : cles saisies, choix d affichage, resultats
   calcules a la demande. Un seul objet, pour que « poser » sache tout remettre
   a zero quand la matiere change. */
const etat = {
  empreintes: {}, cleHmac: '', algoHmac: 'SHA-256', hmac: null,
  cleJwt: '', jwtVerdict: null,
  fabEntete: null, fabCharge: null, fabCle: '', fabResultat: null, fabErreur: null,
  motif: '', options: 'gi', remplacement: '',
  cleXor: '', xorHex: false, xorCandidats: null, cleVigenere: '',
  base: 10, prefixeTest: '',
  familleRef: 'tout', questionRef: undefined,
  modeAes: 'AES-GCM', cleAes: '', formeCleAes: 'hex', ivAes: '', aadAes: '',
  sortieAes: null, erreurAes: null,
  mdpKdf: '', selKdf: '', iterations: '100000', hashKdf: 'SHA-256', bitsKdf: '256',
  sortieKdf: null, erreurKdf: null,
  signature: '', cleSignature: '', algoSignature: 'RSASSA-PKCS1-v1_5',
  hashSignature: 'SHA-256', verdictSignature: null,
  familleBinaire: 'auto', arbreDer: false, jeuChoisi: 'utf-8',
  autreTexte: '', motifChoisi: '', numeroLuhn: '', cheminJson: '',
  selecteur: '', typeSelecteur: 'css',
  sousPrefixe: 26, decoupe: false, listePrefixes: '', plageDebut: '', plageFin: '',
  longueurMdp: 24, jeuxMdp: ['minuscules', 'majuscules', 'chiffres', 'symboles'], dernierMdp: null,
  importBrut: false,
  codeSens: 'lisible', codeStyle: 'securise', codeEmbellir: true, codeSortie: null,
  otpForme: 'base32', otpAlgo: 'SHA-1', otpChiffres: 6, otpPas: 30, otpSecret: null,
  otpResultat: null, otpVoisins: null, otpCompteur: 0,
  reponseUrl: '', reponseType: 'main_frame',
  reqMethode: null, reqUrl: null, reqEntetes: null, reqCorps: null, reqResultats: [], reqEnvoi: false, reqErreur: null,
  wsUrl: null, wsProtocoles: '', wsMessage: '', wsHex: false,
  dnsNom: null, dnsFamille: '', dnsSansCache: false, dnsResultats: [], dnsEnCours: false, dnsErreur: null,
  dnsMode: 'firefox', dnsType: 'A', dnsResolveur: 'cloudflare', dnsAdresse: '', dnsDnssec: false,
  dohResultats: [], dnsBilan: null, dnsBilanEnCours: false,
  reqVariables: null, reqCollection: null, reqNom: '',
  verifHote: null, verifEnCours: false, verifErreur: null, verifResultat: null,
  gqlUrl: '', gqlEntetes: '', gqlRequete: null, gqlVariables: '', gqlOperation: '', gqlEnvoi: false,
  gqlIntrospection: false, gqlErreur: null, gqlReponse: null, gqlSchema: null, gqlFiltre: '',
  sseUrl: null, sseMethode: 'GET', sseEntetes: '', sseCorps: '', sseForme: 'auto', sseId: '',
  rdapRequete: null, rdapServeur: '', rdapEnCours: false, rdapErreur: null, rdapResultats: []
};

/** Ouvre la reference sur une question deja posee : la famille et le mot
 *  cherche arrivent ensemble, donc la reponse est a l ecran sans un clic de
 *  plus. C est ce dont la palette se sert pour repondre en une frappe. */
export function ouvrirReference(famille, question) {
  etat.familleRef = famille;
  etat.questionRef = String(question == null ? '' : question);
  onglet = 'reference';
  document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'tools' } }));
}

/** Ouvre la boite a outils sur un onglet precis, sans toucher a l entree. */
export function ouvrir(cle) {
  if (ONGLETS.some(([id]) => id === cle)) onglet = cle;
  document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'tools' } }));
}

/* La palette a besoin des lignes de reference ; elle les prend ici plutot
   que d aller fouiller le panneau. */
export { entreesReference };

/** Charge un texte dans la boite a outils depuis n importe quelle autre vue.
 *  `transformation` : la cle d une transformation a choisir et appliquer
 *  aussitot — le resultat est a l ecran sans la chercher parmi toutes. */
export function poser(texte, { bascule = true, vers = null, famille = null, transformation: cle = null } = {}) {
  entree = String(texte == null ? '' : texte);
  /* Un certificat envoye depuis l onglet Securite s ouvre directement dans
     le lecteur ASN.1, pas dans la reconnaissance generique. */
  if (famille) etat.familleBinaire = famille;
  etat.empreintes = {};
  etat.hmac = null;
  etat.jwtVerdict = null;
  /* Un nouveau jeton colle : le fabricant repart de son entete et de sa
     charge. La cle reste, elle ne depend pas du jeton. */
  etat.fabEntete = null;
  etat.fabCharge = null;
  etat.fabResultat = null;
  etat.fabErreur = null;
  etat.xorCandidats = null;
  /* Un formulaire vide se remplit du nouveau texte (une commande cURL, une
     adresse) ; un formulaire deja ecrit a la main n est jamais ecrase. */
  if (!etat.reqUrl) etat.reqUrl = null;
  if (!etat.dnsNom) etat.dnsNom = null;
  if (!etat.wsUrl) etat.wsUrl = null;
  if (!etat.verifHote) etat.verifHote = null;
  if (!etat.gqlRequete) etat.gqlRequete = null;
  if (!etat.sseUrl) etat.sseUrl = null;
  if (!etat.rdapRequete) etat.rdapRequete = null;
  etat.questionRef = undefined;
  sortie = null;
  if (vers && ONGLETS.some(([id]) => id === vers)) onglet = vers;
  const choisie = cle ? TRANSFORMATIONS.find(tr => tr.cle === cle) : null;
  if (choisie) {
    transformation = choisie.cle;
    onglet = 'transformer';
    if (!choisie.asynchrone) sortie = transformer(choisie.cle, entree);
  }
  if (bascule) document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'tools' } }));
  else render();
}

/* Redessiner recree le cadre qui defile et le champ de filtre :
   redessinerEnPlace garde la position du lecteur, le focus et le curseur.
   Sans cela, le lecteur remontait en haut a chaque redessin, et seule la
   premiere lettre tapee dans le filtre comptait. */
export function render() { return redessinerEnPlace($('#view-tools'), dessiner); }

function dessiner() {
  const pane = clear($('#view-tools'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  box.appendChild(sec('Boite a outils',
    tp('{t} transformations en {f} familles d outils — tout se calcule en local, sauf ce que vous envoyez',
      { t: TRANSFORMATIONS.length, f: FAMILLES.length })));

  /* ---------------------------- Texte de travail ------------------------- */
  const zone = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '7', dataset: { champ: 'outils-entree' },
    placeholder: t('Collez ici une valeur : jeton, corps de requete, entetes, chaine encodee…')
  });
  zone.value = entree;
  zone.addEventListener('change', () => { poser(zone.value, { bascule: false }); });
  box.appendChild(zone);

  const barre = el('div', { class: 'actions' });
  barre.appendChild(button('Depuis le presse-papiers', async () => {
    try {
      const texte = await navigator.clipboard.readText();
      poser(texte, { bascule: false });
      toast('Texte colle depuis le presse-papiers');
    } catch { toast('Lecture du presse-papiers refusee par le navigateur', false); }
  }));
  barre.appendChild(button('Copier', () => {
    if (!entree) return toast('Texte de travail vide', false);
    copy(entree, 'Texte de travail copie');
  }));
  barre.appendChild(button('Vider', () => poser('', { bascule: false }), { class: 'ghost' }));
  box.appendChild(barre);

  /* -------------------------- Outils suggeres ---------------------------- */
  /* Ce que la forme du texte laisse deviner, et l outil qui le lit : un clic
     y mene. L outil ouvert n est pas propose. */
  const suggestions = entree.trim() ? suggererOutils(entree).filter(x => x.outil !== onglet) : [];
  if (suggestions.length) {
    const rangee = el('div', { class: 'actions suggestions' }, [el('span', { class: 'note', text: t('Ce texte ressemble a :') })]);
    for (const x of suggestions) {
      const outil = ONGLETS.find(([id]) => id === x.outil);
      if (!outil) continue;
      const btn = el('button', { class: 'chip', type: 'button', dataset: { outil: x.outil } },
        tp('{raison} → {outil}', { raison: t(x.raison), outil: t(outil[1]) }));
      btn.addEventListener('click', () => { onglet = x.outil; render(); });
      rangee.appendChild(btn);
    }
    box.appendChild(rangee);
  }

  /* ------------------------------- Onglets -------------------------------- */
  const familles = el('div', { class: 'familles' });
  for (const [nom, outils] of FAMILLES) {
    const groupe = el('div', { class: 'famille' }, [
      el('span', { class: 'famille-nom', text: t(nom) })
    ]);
    const rangee = el('div', { class: 'dtabs wrap' });
    for (const [cle, libelle] of outils) {
      const btn = el('button', { class: 'dtab' + (onglet === cle ? ' on' : ''), type: 'button' },
        el('span', { text: t(libelle) }));
      btn.addEventListener('click', () => { onglet = cle; render(); });
      rangee.appendChild(btn);
    }
    groupe.appendChild(rangee);
    familles.appendChild(groupe);
  }
  box.appendChild(familles);

  const redessiner = () => render();
  const reprendre = valeur => poser(valeur, { bascule: false });

  if (onglet === 'transformer') box.appendChild(panneauTransformer());
  else if (onglet === 'cles') box.appendChild(panneauCles(entree, etat, redessiner, reprendre));
  else if (onglet === 'chiffrement') box.appendChild(panneauChiffrement(entree, etat, redessiner, reprendre));
  else if (onglet === 'jwt') box.appendChild(panneauJwt(entree, etat, redessiner, reprendre));
  else if (onglet === 'empreintes') box.appendChild(panneauEmpreintes(entree, redessiner, etat));
  else if (onglet === 'mesures') box.appendChild(panneauMesures(entree));
  else if (onglet === 'hex') box.appendChild(panneauHex(entree));
  else if (onglet === 'binaire') box.appendChild(panneauBinaire(entree, etat, redessiner, reprendre));
  else if (onglet === 'code') box.appendChild(panneauCode(entree, etat, redessiner, reprendre));
  else if (onglet === 'otp') box.appendChild(panneauOtp(entree, etat, redessiner));
  else if (onglet === 'identifier') box.appendChild(panneauIdentifier(entree));
  else if (onglet === 'temps') box.appendChild(panneauHorodatage(entree));
  else if (onglet === 'nombres') box.appendChild(panneauNombres(entree, etat, redessiner));
  else if (onglet === 'analyse') box.appendChild(panneauAnalyse(entree));
  else if (onglet === 'entetes') box.appendChild(panneauEntetes(entree));
  else if (onglet === 'chercher') box.appendChild(panneauChercher(entree, etat, redessiner, reprendre));
  else if (onglet === 'regex') box.appendChild(panneauRegex(entree, etat, redessiner));
  else if (onglet === 'comparer') box.appendChild(panneauComparer(entree, etat, redessiner, reprendre));
  else if (onglet === 'patch') box.appendChild(panneauPatch(entree, etat, redessiner, reprendre));
  else if (onglet === 'cle') box.appendChild(panneauClePublique(entree, etat, redessiner));
  else if (onglet === 'metadonnees') box.appendChild(panneauMetadonnees(entree, etat, redessiner));
  else if (onglet === 'url') box.appendChild(panneauUrl(entree));
  else if (onglet === 'adresse') box.appendChild(panneauAdresse(entree, etat, redessiner, reprendre));
  else if (onglet === 'reference') box.appendChild(panneauReference(entree, etat, redessiner));
  else if (onglet === 'reponse') box.appendChild(panneauReponse(entree, etat, redessiner));
  else if (onglet === 'requete') box.appendChild(panneauRequete(entree, etat, redessiner));
  else if (onglet === 'websocket') box.appendChild(panneauWebSocket(entree, etat, redessiner));
  else if (onglet === 'dns') box.appendChild(panneauDns(entree, etat, redessiner));
  else if (onglet === 'verifier') box.appendChild(panneauVerifier(entree, etat, redessiner));
  else if (onglet === 'graphql') box.appendChild(panneauGraphql(entree, etat, redessiner));
  else if (onglet === 'sse') box.appendChild(panneauSse(entree, etat, redessiner));
  else if (onglet === 'rdap') box.appendChild(panneauRdap(entree, etat, redessiner));
  else if (onglet === 'generer') box.appendChild(panneauGenerateurs(reprendre, etat, redessiner));
  else if (onglet === 'importer') box.appendChild(panneauImport(entree, etat, redessiner));
}

/* ---------------------------- Onglet Transformer --------------------------- */
function panneauTransformer() {
  const box = el('div');
  box.appendChild(sec('Transformation',
    tp('{t} disponibles, reparties en {f} groupes',
      { t: TRANSFORMATIONS.length, f: GROUPES.length })));

  const select = el('select', { dataset: { champ: 'outils-transformation' } });
  let groupeCourant = null;
  let hote = select;
  for (const tr of TRANSFORMATIONS) {
    if (tr.groupe !== groupeCourant) {
      groupeCourant = tr.groupe;
      hote = el('optgroup', { label: t(groupeCourant) });
      select.appendChild(hote);
    }
    hote.appendChild(el('option', {
      value: tr.cle, text: t(tr.libelle), selected: tr.cle === transformation
    }));
  }
  select.addEventListener('change', () => { transformation = select.value; appliquer(); });

  const actions = el('div', { class: 'actions' }, [select]);
  actions.appendChild(button('Appliquer', appliquer));
  actions.appendChild(button('Tout essayer', essayerTout,
    { title: 'Applique chaque decodage (sauf DNS et WebAuthn, qui liraient n importe quels octets) et ne garde que ceux qui rendent un resultat lisible' }));
  box.appendChild(actions);

  if (sortie) {
    if (!sortie.ok) {
      box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + te(sortie.erreur) }));
    } else if (sortie.multiple) {
      box.appendChild(sec('Resultats lisibles', sortie.multiple.length));
      if (!sortie.multiple.length) {
        box.appendChild(el('p', { class: 'note', text:
          t('Aucun decodage ne rend un resultat lisible : le texte est probablement deja en clair.') }));
      }
      for (const r of sortie.multiple) {
        const carte = el('div', { class: 'find info' }, [
          el('h4', { text: t(r.libelle) }),
          texteLong(r.valeur, { seuil: 4000 })
        ]);
        const acts = el('div', { class: 'actions' });
        acts.appendChild(button('Copier', () => copy(r.valeur, 'Resultat copie')));
        acts.appendChild(button('Reprendre comme entree', () => poser(r.valeur, { bascule: false })));
        carte.appendChild(acts);
        box.appendChild(carte);
      }
    } else {
      box.appendChild(sec('Resultat', tp('{n} caracteres', { n: sortie.valeur.length })));
      box.appendChild(el('pre', { class: 'pre', text: sortie.valeur }));
      const acts = el('div', { class: 'actions' });
      acts.appendChild(button('Copier le resultat', () => copy(sortie.valeur, 'Resultat copie')));
      acts.appendChild(button('Reprendre comme entree', () => poser(sortie.valeur, { bascule: false })));
      box.appendChild(acts);
    }
  } else {
    box.appendChild(el('p', { class: 'note', text:
      t('Choisissez une transformation, ou « Tout essayer » pour laisser SWIFT reconnaitre l encodage.') }));
  }
  return box;
}

async function appliquer() {
  if (!entree) { toast('Texte de travail vide', false); return; }
  sortie = await transformerAsync(transformation, entree);
  if (!sortie.ok) toast(te(sortie.erreur), false);
  render();
}

/**
 * Essaie tous les decodages et ne retient que ceux qui produisent un texte
 * different et lisible. Evite de deviner : on montre les candidats, l oeil
 * humain tranche.
 */
async function essayerTout() {
  if (!entree) { toast('Texte de travail vide', false); return; }
  const gardes = [];
  for (const tr of TRANSFORMATIONS) {
    if (!tr.decode) continue;                        // seuls les decodages
    const res = tr.asynchrone
      ? await transformerAsync(tr.cle, entree)
      : transformer(tr.cle, entree);
    if (!res.ok || !res.valeur) continue;
    if (res.valeur === entree) continue;             // rien n a change
    if (!lisible(res.valeur)) continue;
    if (gardes.some(g => g.valeur === res.valeur)) continue;   // aucun doublon
    gardes.push({ libelle: tr.libelle, valeur: res.valeur });
  }
  sortie = { ok: true, multiple: gardes };
  render();
}

/** Un resultat est retenu s il est majoritairement imprimable. */
function lisible(texte) {
  const echantillon = texte.length > 2000 ? texte.slice(0, 2000) : texte;
  if (!echantillon) return false;
  let bons = 0;
  for (let i = 0; i < echantillon.length; i++) {
    const c = echantillon.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127)) bons++;
  }
  return bons / echantillon.length > 0.9;
}
