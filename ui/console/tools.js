/* Vue « Boite a outils » — INTERCEPTOR (by NeoZ)
 *
 * Un seul texte de travail, tous les outils dessus : on colle une valeur une
 * fois, et chaque panneau la regarde. Le texte peut venir du presse-papiers,
 * d une transformation precedente, ou d une requete capturee (menu contextuel
 * du tableau, onglets du detail).
 *
 * Tout se passe en local : aucune de ces fonctions n emet de trafic.
 */
import { $, el, clear, sec, button } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { toast, copy } from '../app.js';
import { TRANSFORMATIONS, GROUPES, transformer, transformerAsync } from '../lib/catalogue.js';
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
import { panneauChercher } from './tools-chercher.js';
import { panneauCode } from './tools-code.js';
import { panneauOtp } from './tools-otp.js';

/* Les outils, ranges par intention plutot qu en une seule rangee de vingt-trois
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
    ['jwt', 'JWT'],
    ['otp', 'Codes OTP']
  ]],
  ['Reseau et HTTP', [
    ['url', 'URL'],
    ['adresse', 'Adresse IP'],
    ['entetes', 'Entetes'],
    ['reference', 'Reference']
  ]],
  ['Lire et mesurer', [
    ['analyse', 'Structures'],
    ['identifier', 'Identifier'],
    ['mesures', 'Mesures'],
    ['temps', 'Horodatage'],
    ['nombres', 'Nombres']
  ]],
  ['Chercher et comparer', [
    ['chercher', 'Chercher'],
    ['regex', 'Expression reguliere'],
    ['comparer', 'Comparer']
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
  otpResultat: null, otpVoisins: null, otpCompteur: 0
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

/** Charge un texte dans la boite a outils depuis n importe quelle autre vue. */
export function poser(texte, { bascule = true, vers = null } = {}) {
  entree = String(texte == null ? '' : texte);
  etat.empreintes = {};
  etat.hmac = null;
  etat.jwtVerdict = null;
  etat.xorCandidats = null;
  etat.questionRef = undefined;
  sortie = null;
  if (vers && ONGLETS.some(([cle]) => cle === vers)) onglet = vers;
  if (bascule) document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'tools' } }));
  else render();
}

export function render() {
  const pane = clear($('#view-tools'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  box.appendChild(sec('Boite a outils',
    tp('{t} transformations en {f} familles d outils — tout se calcule en local',
      { t: TRANSFORMATIONS.length, f: FAMILLES.length })));

  /* ---------------------------- Texte de travail ------------------------- */
  const zone = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '7',
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
  else if (onglet === 'jwt') box.appendChild(panneauJwt(entree, etat, redessiner));
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
  else if (onglet === 'url') box.appendChild(panneauUrl(entree));
  else if (onglet === 'adresse') box.appendChild(panneauAdresse(entree, etat, redessiner, reprendre));
  else if (onglet === 'reference') box.appendChild(panneauReference(entree, etat, redessiner));
  else if (onglet === 'generer') box.appendChild(panneauGenerateurs(reprendre, etat, redessiner));
  else if (onglet === 'importer') box.appendChild(panneauImport(entree, etat, redessiner));
}

/* ---------------------------- Onglet Transformer --------------------------- */
function panneauTransformer() {
  const box = el('div');
  box.appendChild(sec('Transformation',
    tp('{t} disponibles, reparties en {f} groupes',
      { t: TRANSFORMATIONS.length, f: GROUPES.length })));

  const select = el('select');
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
    { title: 'Applique chaque decodage et ne garde que ceux qui rendent un resultat lisible' }));
  box.appendChild(actions);

  if (sortie) {
    if (!sortie.ok) {
      box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + sortie.erreur }));
    } else if (sortie.multiple) {
      box.appendChild(sec('Resultats lisibles', sortie.multiple.length));
      if (!sortie.multiple.length) {
        box.appendChild(el('p', { class: 'note', text:
          t('Aucun decodage ne rend un resultat lisible : le texte est probablement deja en clair.') }));
      }
      for (const r of sortie.multiple) {
        const carte = el('div', { class: 'find info' }, [
          el('h4', { text: r.libelle }),
          el('pre', { class: 'pre', text: r.valeur.length > 4000 ? r.valeur.slice(0, 4000) + '…' : r.valeur })
        ]);
        const acts = el('div', { class: 'actions' });
        acts.appendChild(button('Copier', () => copy(r.valeur, 'Resultat copie')));
        acts.appendChild(button('Reprendre comme entree', () => poser(r.valeur, { bascule: false })));
        carte.appendChild(acts);
        box.appendChild(carte);
      }
    } else {
      box.appendChild(sec('Resultat', sortie.valeur.length + ' caracteres'));
      box.appendChild(el('pre', { class: 'pre', text: sortie.valeur }));
      const acts = el('div', { class: 'actions' });
      acts.appendChild(button('Copier le resultat', () => copy(sortie.valeur, 'Resultat copie')));
      acts.appendChild(button('Reprendre comme entree', () => poser(sortie.valeur, { bascule: false })));
      box.appendChild(acts);
    }
  } else {
    box.appendChild(el('p', { class: 'note', text:
      t('Choisissez une transformation, ou « Tout essayer » pour laisser INTERCEPTOR reconnaitre l encodage.') }));
  }
  return box;
}

async function appliquer() {
  if (!entree) { toast('Texte de travail vide', false); return; }
  sortie = await transformerAsync(transformation, entree);
  if (!sortie.ok) toast(sortie.erreur, false);
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
