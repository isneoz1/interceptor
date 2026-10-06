/* Appels RPC sur HTTP : JSON-RPC 2.0 et SOAP — SWIFT (by NeoZ)
 *
 * Comme GraphQL, ces protocoles font passer des operations differentes par
 * une seule adresse : la methode (JSON-RPC) ou l operation (SOAP) est dans le
 * corps, et le statut HTTP ne dit rien de leur issue. Ce module lit l appel,
 * puis la reponse : resultat, erreur JSON-RPC, faute SOAP.
 *
 * Sources, lues dans le texte :
 *   JSON-RPC 2.0 Specification (jsonrpc.org) : §4 (requete, notification),
 *     §5 (reponse, erreurs), §6 (lots), §7 (exemples, repris par les tests)
 *   SOAP 1.1 (W3C Note, 2000) : l enveloppe, la faute (faultcode,
 *     faultstring, faultactor, detail), l en-tete SOAPAction, et §6.2 —
 *     une faute se sert avec HTTP 500
 *   SOAP 1.2 : l enveloppe, la faute (Code, Subcode, Reason, Node, Role,
 *     Detail), le type application/soap+xml et son parametre action
 *
 * Rien n est devine : une enveloppe SOAP est reconnue a l espace de noms de
 * son element racine, un message JSON-RPC au membre « jsonrpc » qui vaut
 * exactement « 2.0 ».
 */
import { sensErreurJsonRpc } from './sous-protocoles-plus.js';
import { desechapper, lireAttributs, morceauxXml, lireBalise } from './xml-lecture.js';

export const NS_SOAP11 = 'http://schemas.xmlsoap.org/soap/envelope/';
export const NS_SOAP12 = 'http://www.w3.org/2003/05/soap-envelope';
const SOAP_MAX = 4 * 1024 * 1024;
const TEXTE_MAX = 2000;
const JSONRPC = /"jsonrpc"\s*:\s*"2\.0"/;

const estObjet = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const possede = (o, cle) => Object.prototype.hasOwnProperty.call(o, cle);

function jsonDe(texte) {
  const s = String(texte || '').trim();
  if (!s || (s[0] !== '{' && s[0] !== '[')) return undefined;
  try { return JSON.parse(s); } catch { return undefined; }
}

/* Les phrases des faits, traduites a l affichage : exportees pour que le
   controle de traduction les verifie une a une. */
export const FAITS_RPC = {
  statut2xxErreurs: 'statut HTTP {statut}, mais {n} erreur(s) JSON-RPC dans le corps : le verdict est dans la reponse, pas dans le statut',
  notificationRepondue: 'reponse a une notification : un serveur ne doit pas repondre a une notification (JSON-RPC 2.0 §4.1)',
  sansReponse: 'aucune reponse pour la requete d id {id} : un objet reponse devrait exister pour chaque requete (JSON-RPC 2.0 §6)',
  idInattendu: 'la reponse porte l id {recu}, la requete l id {envoye}',
  lotVide: 'tableau vide en reponse a un lot : un serveur ne doit pas renvoyer de tableau vide (JSON-RPC 2.0 §6)',
  elementsInvalides: '{n} element(s) du lot ne sont pas des requetes JSON-RPC 2.0 valides',
  reponsesInvalides: '{n} element(s) de la reponse ne sont pas des reponses JSON-RPC 2.0 valides : il en faut exactement un parmi result et error (§5)',
  soap11Statut: 'faute SOAP 1.1 servie avec le statut {statut} : SOAP 1.1 (§6.2) demande HTTP 500 pour une reponse qui porte une faute',
  soapStatut2xx: 'statut HTTP {statut}, mais la reponse porte une faute SOAP : le verdict est dans l enveloppe',
  soapActionVide: 'SOAPAction vide : l intention est alors celle de l URL de la requete (SOAP 1.1)',
  soapIncomplet: 'enveloppe lue en partie : le corps capture s arrete avant la fin du XML'
};

/* ------------------------------- JSON-RPC --------------------------------- */
/**
 * L appel JSON-RPC 2.0 que porte un corps de requete, ou null. Un lot peut
 * melanger des requetes valides et des elements invalides — l exemple du §7
 * le fait : on les compte, on ne les ecarte pas en silence.
 */
export function lireAppelJsonRpc(texte) {
  if (typeof texte !== 'string' || !JSONRPC.test(texte)) return null;
  const v = jsonDe(texte);
  if (v === undefined) return null;
  const liste = Array.isArray(v) ? v : [v];
  const appels = liste.map(e => (estObjet(e) && e.jsonrpc === '2.0' && typeof e.method === 'string'
    ? { methode: e.method, notification: !possede(e, 'id'), id: possede(e, 'id') ? e.id : undefined, params: e.params }
    : { invalide: true }));
  if (!appels.some(a => !a.invalide)) return null;
  return { protocole: 'JSON-RPC', lot: Array.isArray(v), appels };
}

/** La reponse JSON-RPC 2.0 d un corps, ou null. */
export function lireReponseJsonRpc(texte) {
  const v = jsonDe(texte);
  if (Array.isArray(v) && v.length === 0) return { lot: true, reponses: [], vide: true };
  if (v === undefined) return null;
  const liste = Array.isArray(v) ? v : [v];
  const reponses = liste.map(e => {
    if (!estObjet(e) || e.jsonrpc !== '2.0') return { invalide: true };
    const aResultat = possede(e, 'result');
    const aErreur = possede(e, 'error');
    if (aResultat && !aErreur) return { id: e.id, resultat: e.result };
    if (aErreur && !aResultat && estObjet(e.error)) {
      return { id: e.id, erreur: {
        code: e.error.code,
        message: typeof e.error.message === 'string' ? e.error.message : null,
        sens: sensErreurJsonRpc(e.error.code),
        donnees: e.error.data
      } };
    }
    return { invalide: true };
  });
  if (!reponses.some(r => !r.invalide)) return null;
  return { lot: Array.isArray(v), reponses };
}

const memeId = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Les faits d un echange JSON-RPC. */
export function faitsJsonRpc(appel, reponse, { statut = null } = {}) {
  const faits = [];
  const dire = (cle, valeurs = {}) => faits.push({ cle, texte: FAITS_RPC[cle], valeurs });
  if (appel) {
    const invalides = appel.appels.filter(a => a.invalide).length;
    if (invalides) dire('elementsInvalides', { n: invalides });
  }
  if (!reponse) return faits;
  if (reponse.vide) { if (appel && appel.lot) dire('lotVide'); return faits; }
  const invalides = reponse.reponses.filter(r => r.invalide).length;
  if (invalides) dire('reponsesInvalides', { n: invalides });
  const erreurs = reponse.reponses.filter(r => r.erreur).length;
  if (erreurs && statut >= 200 && statut < 300) dire('statut2xxErreurs', { statut, n: erreurs });
  if (!appel) return faits;

  const valides = appel.appels.filter(a => !a.invalide);
  if (valides.length && valides.every(a => a.notification) && reponse.reponses.some(r => !r.invalide)) {
    dire('notificationRepondue');
    return faits;
  }
  /* Une seule erreur d id null repond a tout le lot (JSON illisible, requete
     invalide) : ce n est pas une reponse manquante par requete. */
  const globale = reponse.reponses.length === 1 && reponse.reponses[0].erreur && reponse.reponses[0].id === null;
  if (!appel.lot && !reponse.lot && valides.length === 1 && !valides[0].notification && !globale) {
    const recue = reponse.reponses[0];
    if (!recue.invalide && !memeId(recue.id, valides[0].id)) {
      dire('idInattendu', { recu: JSON.stringify(recue.id), envoye: JSON.stringify(valides[0].id) });
    }
  }
  if (appel.lot && !globale) {
    for (const a of valides) {
      if (a.notification) continue;
      if (!reponse.reponses.some(r => !r.invalide && memeId(r.id, a.id))) dire('sansReponse', { id: JSON.stringify(a.id) });
    }
  }
  return faits;
}

/* --------------------------------- SOAP ----------------------------------- */
/* Les elements de la faute, par version, et ce qu on en garde. */
const FAUTE_11 = { faultcode: 'code', faultstring: 'message', faultactor: 'acteur', detail: 'detail' };
const FAUTE_12 = { Reason: 'message', Node: 'noeud', Role: 'role', Detail: 'detail' };

/**
 * L enveloppe SOAP d un corps XML, ou null : la version, l operation (premier
 * element du Body), les blocs d en-tete, et la faute s il y en a une.
 */
export function lireSoap(texte) {
  if (typeof texte !== 'string' || texte.length > SOAP_MAX || !texte.includes('Envelope')) return null;
  const pile = [];
  const r = { version: null, operation: null, entetes: [], faute: null, incomplet: false };
  let nsSoap = null;
  let capte = null;
  let tampon = '';
  try {
    for (const m of morceauxXml(texte)) {
      if (m.texte !== undefined) {
        if (capte && tampon.length < TEXTE_MAX) tampon += m.brut ? m.texte : desechapper(m.texte);
        continue;
      }
      const b = lireBalise(m.balise);
      if (!b) continue;
      if (b.fermante) {
        if (capte && capte.profondeur === pile.length && capte.nom === b.nom) {
          const valeur = tampon.replace(/\s+/g, ' ').trim().slice(0, TEXTE_MAX);
          if (r.faute && valeur && r.faute[capte.cle] == null) r.faute[capte.cle] = valeur;
          capte = null;
          tampon = '';
        }
        pile.pop();
        continue;
      }
      /* Les declarations d espace de noms valent pour l element et sa
         descendance : chaque element herite de la portee de son parent. */
      const attrs = lireAttributs(b.attrs);
      const parent = pile.length ? pile[pile.length - 1] : null;
      let portee = parent ? parent.portee : new Map();
      for (const cle of Object.keys(attrs)) {
        if (cle !== 'xmlns' && !cle.startsWith('xmlns:')) continue;
        if (parent && portee === parent.portee) portee = new Map(portee);
        portee.set(cle === 'xmlns' ? '' : cle.slice(6), attrs[cle]);
      }
      const ns = portee.get(b.prefixe || '') || null;
      const profondeur = pile.length;
      let zone = parent ? parent.zone : null;

      if (profondeur === 0) {
        if (b.nom !== 'Envelope' || (ns !== NS_SOAP11 && ns !== NS_SOAP12)) return null;
        nsSoap = ns;
        r.version = ns === NS_SOAP11 ? '1.1' : '1.2';
      } else if (profondeur === 1 && ns === nsSoap && (b.nom === 'Header' || b.nom === 'Body')) {
        zone = b.nom;
      } else if (profondeur === 2 && zone === 'Header') {
        r.entetes.push(b.nom);
      } else if (profondeur === 2 && zone === 'Body' && !r.operation && !r.faute) {
        if (b.nom === 'Fault' && ns === nsSoap) {
          r.faute = { code: null, sousCode: null, message: null, acteur: null, noeud: null, role: null, detail: null };
          zone = 'Fault';
        } else {
          r.operation = { nom: b.nom, espace: ns };
        }
      } else if (zone === 'Fault' && !capte) {
        const cle = r.version === '1.1'
          ? (profondeur === 3 ? FAUTE_11[b.nom] : null)
          : (profondeur === 3 ? FAUTE_12[b.nom]
            : profondeur === 4 && b.nom === 'Value' && parent.nom === 'Code' ? 'code'
              : profondeur === 5 && b.nom === 'Value' && parent.nom === 'Subcode' ? 'sousCode'
                : profondeur === 4 && b.nom === 'Text' && parent.nom === 'Reason' ? 'message' : null);
        /* Reason porte un Text par langue : on garde le premier. */
        if (cle && !(r.version === '1.2' && b.nom === 'Reason') && !b.autofermante) {
          capte = { nom: b.nom, profondeur: profondeur + 1, cle };
          tampon = '';
        }
      }
      if (!b.autofermante) pile.push({ nom: b.nom, portee, zone });
    }
  } catch {
    if (!r.version) return null;
    r.incomplet = true;
  }
  if (!r.version) return null;
  if (pile.length && !r.incomplet) r.incomplet = true;
  return r;
}

/** L action d un appel SOAP : SOAPAction (1.1) ou le parametre action (1.2). */
export function actionSoap(entetes, typeContenu) {
  const valeur = nom => {
    const h = (entetes || []).find(x => x && String(x.name || '').toLowerCase() === nom);
    return h ? String(h.value ?? '') : null;
  };
  const soapAction = valeur('soapaction');
  if (soapAction !== null) return { source: 'SOAPAction', valeur: soapAction.trim().replace(/^"(.*)"$/, '$1') };
  const m = /;\s*action\s*=\s*("([^"]*)"|[^;\s]+)/i.exec(String(typeContenu || valeur('content-type') || ''));
  return m ? { source: 'action', valeur: m[2] !== undefined ? m[2] : m[1] } : null;
}

/** Les faits d un echange SOAP. */
export function faitsSoap(appel, reponse, { statut = null, action = null } = {}) {
  const faits = [];
  const dire = (cle, valeurs = {}) => faits.push({ cle, texte: FAITS_RPC[cle], valeurs });
  if (appel && appel.version === '1.1' && action && action.source === 'SOAPAction' && action.valeur === '') dire('soapActionVide');
  if (appel && appel.incomplet) dire('soapIncomplet');
  if (!reponse) return faits;
  if (reponse.incomplet) dire('soapIncomplet');
  if (reponse.faute) {
    if (statut >= 200 && statut < 300) dire('soapStatut2xx', { statut });
    if (reponse.version === '1.1' && statut != null && statut !== 500) dire('soap11Statut', { statut });
  }
  return faits;
}

/* ------------------------------ Pour le noyau ----------------------------- */
const typeDe = corps => String((corps && corps.contentType) || '').toLowerCase();

/**
 * L appel RPC que porte une requete, ou null : JSON-RPC 2.0, ou SOAP 1.1 et
 * 1.2. `corps` est le corps d un enregistrement ({ text, contentType }).
 */
export function lireAppelRpc(corps, entetes = []) {
  const texte = corps && typeof corps.text === 'string' ? corps.text : '';
  if (!texte) return null;
  const jsonrpc = lireAppelJsonRpc(texte);
  if (jsonrpc) return jsonrpc;
  const type = typeDe(corps) || String(((entetes || []).find(h => String(h.name || '').toLowerCase() === 'content-type') || {}).value || '').toLowerCase();
  if (!/xml/.test(type) && !/^\s*</.test(texte)) return null;
  const soap = lireSoap(texte);
  return soap ? { protocole: 'SOAP', ...soap } : null;
}

/** Le resume d un appel pour le tableau et la recherche. */
export function resumeRpc(appel) {
  if (!appel) return null;
  if (appel.protocole === 'JSON-RPC') {
    return { protocole: 'JSON-RPC', ops: appel.appels.filter(a => !a.invalide).map(a => a.methode) };
  }
  return { protocole: 'SOAP ' + appel.version, ops: appel.operation ? [appel.operation.nom] : [] };
}

/** « JSON-RPC eth_call, eth_getBalance » ; au-dela de trois, le compte. */
export function texteRpc(resume) {
  if (!resume) return '';
  const ops = resume.ops || [];
  const vus = ops.slice(0, 3).join(', ');
  return resume.protocole + (vus ? ' ' + vus : '') + (ops.length > 3 ? ' +' + (ops.length - 3) : '');
}
