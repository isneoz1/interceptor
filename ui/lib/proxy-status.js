/* Les intermediaires traverses — SWIFT (by NeoZ)
 *
 * Proxy-Status (RFC 9209) : chaque intermediaire qui traite une reponse peut
 * ajouter un membre a la liste. Le premier est le plus proche de l origine, le
 * dernier le plus proche de l utilisateur (§2). Un membre est une chaine ou un
 * jeton qui nomme l intermediaire ; ses parametres disent ce qu il a fait :
 *   error             le type d erreur rencontre (§2.1.1, registre IANA)
 *   next-hop          le saut suivant choisi (§2.1.2)
 *   next-protocol     l identifiant ALPN employe vers lui (§2.1.3)
 *   received-status   le statut que ce saut a rendu (§2.1.4)
 *   details           le reste, en texte libre (§2.1.5)
 *   next-hop-aliases  les CNAME rencontres en le resolvant (RFC 9532)
 * Un parametre inconnu est ignore (§2.1). Rien de tout cela n est verifie :
 * c est ce que l intermediaire dit de lui-meme (§4).
 *
 * L exemple du §2.1.5 ecrit error entre guillemets ; l erratum 9168 (signale
 * le 9 septembre 2026) rappelle que le §2.1.1 veut un jeton. Une chaine est
 * donc lue, et signalee.
 */
import { lireListe, decrireArticle } from './champs-structures.js';
import { erreurProxy, EXTRAS_PROXY } from './ref-proxy-status.js';
import { ALPN_CONNUS } from './alt-svc.js';
import { decrireAlerteTls } from './ref-protocoles.js';

export const FAITS_PROXY_STATUS = {
  illisible: 'Proxy-Status illisible : une liste de champ structure est attendue (RFC 9209 §2)',
  identifiant: 'membre d un type {type} : une chaine ou un jeton nomme l intermediaire (RFC 9209 §2)',
  erreur: 'erreur {erreur} : {sens}',
  erreurInconnue: 'erreur {erreur}, absente du registre IANA des types d erreur',
  erreurType: 'error d un type {type} : un jeton est attendu (RFC 9209 §2.1.1)',
  produite: 'reponse produite par cet intermediaire lui-meme : l origine ne l a pas fournie',
  peutEtreAmont: 'cette erreur peut aussi accompagner une reponse, meme partielle, venue de plus loin',
  statutRecommande: 'statut {statut} : la RFC 9209 recommande {attendu} pour cette erreur (§2.1.1)',
  statutNon4xx: 'statut {statut} : cette erreur accompagne une reponse 4xx produite au nom de l origine (§2.3.16)',
  sautSuivant: 'saut suivant : {hote}',
  protocole: 'protocole vers le saut suivant : {protocole}',
  protocoleType: 'next-protocol d un type {type} : un jeton ou une suite d octets est attendu (RFC 9209 §2.1.3)',
  recu: 'le saut suivant a repondu {statut}',
  recuType: 'received-status d un type {type} : un entier est attendu (RFC 9209 §2.1.4)',
  details: 'details : {details}',
  alias: 'noms rencontres en resolvant le saut suivant : {noms}',
  aliasVide: 'aucun CNAME rencontre en resolvant le saut suivant (RFC 9532 §2)',
  extra: '{cle} = {valeur} : {sens}',
  extraIgnore: '{cle} : sans objet pour cette erreur, ignore (RFC 9209 §2.1.1)',
  inconnu: 'parametre {cle} inconnu des registres : ignore (RFC 9209 §2.1)',
  rien: 'aucun parametre : cet intermediaire signale seulement son passage'
};

const valeursDe = (entetes, nom) => (entetes || []).filter(h => h && String(h.name || '').toLowerCase() === nom)
  .map(h => String(h.value ?? ''));
const texteDe = p => (p.type === 'chaine' || p.type === 'jeton' ? String(p.valeur) : decrireArticle(p));
const CONNUS = new Set(['error', 'next-hop', 'next-protocol', 'received-status', 'details', 'next-hop-aliases']);

/* Un identifiant ALPN en suite d octets : lisible s il est en ASCII imprimable. */
function alpnDe(p) {
  let id;
  if (p.type === 'jeton') id = String(p.valeur);
  else {
    const octets = p.valeur instanceof Uint8Array ? p.valeur : new Uint8Array(0);
    id = [...octets].every(o => o >= 0x21 && o <= 0x7e) ? String.fromCharCode(...octets)
      : [...octets].map(o => o.toString(16).padStart(2, '0')).join(' ');
  }
  return ALPN_CONNUS[id] ? id + ' — ' + ALPN_CONNUS[id] : id;
}

/* RFC 9532 §2.1 : les noms sont separes par des virgules, et chacun est
   encode en pourcent ; « \. » reste dans le nom, c est un point dans une
   etiquette. */
function aliasDe(texte) {
  return String(texte).split(',').filter(s => s.length).map(s => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
}

/* La valeur d un parametre supplementaire, avec le nom de l alerte TLS
   quand c en est une. */
function valeurExtra(cle, p) {
  const brut = texteDe(p);
  if (cle === 'alert-id' && p.type === 'entier') {
    const alerte = decrireAlerteTls(p.valeur);
    if (alerte) return brut + ' (' + alerte.nom + ')';
  }
  return brut;
}

/**
 * @param options.statut  statut de la reponse, compare au statut recommande
 * @returns null sans en-tete, sinon { intermediaires, faits, produitePar }
 *          `produitePar` : le premier intermediaire qui dit avoir produit
 *          lui-meme la reponse, ou null
 */
export function lireProxyStatus(entetes, options = {}) {
  const valeurs = valeursDe(entetes, 'proxy-status');
  if (!valeurs.length) return null;
  const faits = [];
  let membres;
  try { membres = lireListe(valeurs.join(', ')); }
  catch {
    faits.push({ cle: 'illisible', texte: FAITS_PROXY_STATUS.illisible, valeurs: {} });
    return { intermediaires: [], faits, produitePar: null };
  }
  const statut = Number(options.statut) || null;
  let produitePar = null;
  const intermediaires = membres.map((m, rang) => {
    const notes = [];
    const dire = (cle, v = {}) => notes.push({ cle, texte: FAITS_PROXY_STATUS[cle], valeurs: v });
    const nom = m.type === 'chaine' || m.type === 'jeton' ? String(m.valeur) : decrireArticle(m);
    if (m.type !== 'chaine' && m.type !== 'jeton') faits.push({ cle: 'identifiant', texte: FAITS_PROXY_STATUS.identifiant, valeurs: { type: m.type } });

    /* La derniere occurrence d une cle l emporte (RFC 9651 §3.1.2). */
    const params = new Map();
    for (const p of m.parametres || []) params.set(p.cle, p);
    const err = params.get('error');
    let erreur = null;
    if (err) {
      const nomErreur = err.type === 'jeton' || err.type === 'chaine' ? String(err.valeur) : decrireArticle(err);
      if (err.type !== 'jeton') dire('erreurType', { type: err.type });
      const connue = erreurProxy(nomErreur);
      erreur = { nom: nomErreur, connue };
      if (connue) {
        dire('erreur', { erreur: nomErreur, sens: connue.sens });
        if (connue.intermediaire) {
          dire('produite');
          if (produitePar === null) produitePar = { nom, erreur: nomErreur };
          if (statut && connue.statut != null && statut !== connue.statut) dire('statutRecommande', { statut, attendu: connue.statut });
          if (statut && connue.nom === 'http_request_error' && (statut < 400 || statut > 499)) dire('statutNon4xx', { statut });
        } else dire('peutEtreAmont');
      } else dire('erreurInconnue', { erreur: nomErreur });
    }
    const saut = params.get('next-hop');
    if (saut) dire('sautSuivant', { hote: texteDe(saut) });
    const proto = params.get('next-protocol');
    if (proto) {
      if (proto.type === 'jeton' || proto.type === 'suite d octets') dire('protocole', { protocole: alpnDe(proto) });
      else dire('protocoleType', { type: proto.type });
    }
    const recu = params.get('received-status');
    if (recu) {
      if (recu.type === 'entier') dire('recu', { statut: recu.valeur });
      else dire('recuType', { type: recu.type });
    }
    const details = params.get('details');
    if (details) dire('details', { details: texteDe(details) });
    const alias = params.get('next-hop-aliases');
    if (alias) {
      const noms = alias.type === 'chaine' ? aliasDe(alias.valeur) : [texteDe(alias)];
      if (alias.type === 'chaine' && !noms.length) dire('aliasVide');
      else dire('alias', { noms: noms.join(', ') });
    }
    /* Les parametres supplementaires : ceux du type d erreur se lisent, les
       autres sont ignores, comme la RFC le demande. */
    const propres = new Map(((erreur && erreur.connue) ? erreur.connue.extras : []).map(x => [x.cle, x]));
    for (const [cle, p] of params) {
      if (CONNUS.has(cle)) continue;
      if (propres.has(cle)) dire('extra', { cle, valeur: valeurExtra(cle, p), sens: propres.get(cle).sens });
      else if (EXTRAS_PROXY.has(cle)) dire('extraIgnore', { cle });
      else dire('inconnu', { cle });
    }
    if (!params.size) dire('rien');
    return { nom, rang, erreur, notes };
  });
  return { intermediaires, faits, produitePar };
}
