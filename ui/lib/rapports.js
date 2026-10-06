/* Rapports du navigateur — SWIFT (by NeoZ)
 *
 * Un navigateur signale lui-meme ce qui ne va pas : une ressource bloquee par
 * la CSP, une erreur reseau, une API en voie de disparition. Il l envoie dans
 * une requete POST que personne ne lit d habitude. Ce module la lit.
 *
 *   Les rapports  application/reports+json (Reporting API) : une liste
 *                 d objets { age, type, url, user_agent, body } ;
 *                 application/csp-report (CSP, report-uri, deprecie) :
 *                 { "csp-report": { ... } } aux cles a tirets.
 *   La collecte   les en-tetes qui disent ou les envoyer : Reporting-Endpoints
 *                 (dictionnaire de champs structures), Report-To (JSON, d une
 *                 version anterieure de la Reporting API) et NEL (politique
 *                 de journalisation des erreurs reseau).
 *
 * Sources, lues dans le texte :
 *   W3C Reporting API §3.3 (traitement de Reporting-Endpoints), la
 *     serialisation des rapports
 *   W3C CSP niveau 3 : CSPViolationReportBody, et §5.3 la forme depreciee
 *   W3C Network Error Logging : la politique NEL, le corps et les types
 *   WICG Deprecation Reporting, Intervention Reporting ; W3C Permissions Policy
 *
 * Un type de rapport inconnu n est pas devine : ses champs sont montres tels
 * qu ils sont arrives.
 */
import { lireDictionnaire } from './champs-structures.js';

const estObjet = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/* Les phrases des faits, traduites a l affichage : exportees pour que le
   controle de traduction les verifie une a une. */
export const FAITS_RAPPORTS = {
  cspBloque: 'la directive {d} a bloque {u}',
  cspRapportSeul: 'politique en rapport seul (Report-Only) : {u} n a pas ete bloque, le navigateur l a seulement signale',
  cspDeprecie: 'forme application/csp-report, celle de report-uri : deprecie au profit de report-to et de la Reporting API (CSP §5.3)',
  nelSucces: 'echantillon de requete reussie : NEL rapporte aussi une part des succes (success_fraction)',
  nelEchec: 'erreur reseau {type} pendant la phase {phase} : {sens}',
  nelInconnu: 'erreur reseau {type} pendant la phase {phase}',
  vieux: 'rapport produit {s} s avant son envoi (age)',
  endpointNonChaine: 'Reporting-Endpoints : la valeur de {nom} n est pas une chaine, le navigateur ignore ce point de collecte (Reporting API §3.3)',
  endpointNonSur: 'Reporting-Endpoints : {nom} pointe vers {u}, une origine qui n est pas sure ; le navigateur l ignore (Reporting API §3.3)',
  endpointIllisible: 'Reporting-Endpoints : la valeur de {nom} n est pas une URL, le navigateur l ignore',
  reponseNonSure: 'reponse servie sans connexion sure : le navigateur ignore Reporting-Endpoints et NEL',
  reportToAncien: 'Report-To : forme d une version anterieure de la Reporting API, remplacee par Reporting-Endpoints',
  nelSuppression: 'NEL max_age 0 : la politique NEL de cette origine est supprimee du cache du navigateur',
  nelEchantillons: 'NEL : {s} % des succes et {e} % des echecs seront rapportes',
  nelSousDomaines: 'NEL : la politique s applique aussi aux sous-domaines (include_subdomains)',
  illisible: 'en-tete {nom} illisible : {raison}'
};

/* Les types d erreur reseau predefinis par NEL, avec leur phase et leur sens. */
export const TYPES_NEL = {
  'ok': ['application', 'requete reussie'],
  'dns.unreachable': ['dns', 'le serveur DNS est injoignable'],
  'dns.name_not_resolved': ['dns', 'le serveur DNS a repondu mais ne resout pas l adresse'],
  'dns.failed': ['dns', 'la requete au serveur DNS a echoue pour une autre raison'],
  'dns.address_changed': ['dns', 'l adresse IP resolue a change depuis la reception de la politique NEL'],
  'tcp.timed_out': ['connection', 'la connexion TCP au serveur a expire'],
  'tcp.closed': ['connection', 'le serveur a ferme la connexion TCP'],
  'tcp.reset': ['connection', 'la connexion TCP a ete reinitialisee'],
  'tcp.refused': ['connection', 'le serveur a refuse la connexion TCP'],
  'tcp.aborted': ['connection', 'la connexion TCP a ete interrompue'],
  'tcp.address_invalid': ['connection', 'l adresse IP est invalide'],
  'tcp.address_unreachable': ['connection', 'l adresse IP est injoignable'],
  'tcp.failed': ['connection', 'la connexion TCP a echoue pour une autre raison'],
  'tls.version_or_cipher_mismatch': ['connection', 'TLS interrompu : version ou suite de chiffrement incompatible'],
  'tls.bad_client_auth_cert': ['connection', 'TLS interrompu : certificat client invalide'],
  'tls.cert.name_invalid': ['connection', 'TLS interrompu : nom invalide dans le certificat'],
  'tls.cert.date_invalid': ['connection', 'TLS interrompu : date du certificat invalide'],
  'tls.cert.authority_invalid': ['connection', 'TLS interrompu : autorite emettrice invalide'],
  'tls.cert.invalid': ['connection', 'TLS interrompu : certificat invalide'],
  'tls.cert.revoked': ['connection', 'TLS interrompu : certificat du serveur revoque'],
  'tls.cert.pinned_key_not_in_cert_chain': ['connection', 'TLS interrompu : erreur d epinglage de cle'],
  'tls.protocol.error': ['connection', 'TLS interrompu : erreur de protocole TLS'],
  'tls.failed': ['connection', 'la connexion TLS a echoue pour une autre raison'],
  'http.error': ['application', 'reponse recue, mais avec un statut 4xx ou 5xx'],
  'http.protocol.error': ['application', 'connexion interrompue par une erreur de protocole HTTP'],
  'http.response.invalid': ['application', 'reponse vide, longueur ou encodage incorrects'],
  'http.response.redirect_loop': ['application', 'requete abandonnee : boucle de redirections'],
  'http.failed': ['application', 'echec du protocole HTTP pour une autre raison'],
  'abandoned': ['application', 'chargement abandonne par l utilisateur avant la fin'],
  'unknown': ['application', 'type d erreur inconnu']
};

/* Les champs de chaque type connu, dans l ordre ou on les lit, avec leur
   libelle. Un champ absent du rapport n est pas affiche. */
export const CHAMPS_RAPPORTS = {
  'csp-violation': [
    ['effectiveDirective', 'Directive enfreinte'], ['blockedURL', 'Adresse bloquee'],
    ['disposition', 'Disposition'], ['documentURL', 'Document'], ['sourceFile', 'Fichier source'],
    ['lineNumber', 'Ligne'], ['columnNumber', 'Colonne'], ['sample', 'Extrait'],
    ['statusCode', 'Statut du document'], ['referrer', 'Referent'], ['originalPolicy', 'Politique']
  ],
  'network-error': [
    ['phase', 'Phase'], ['type', 'Type d erreur'], ['elapsed_time', 'Duree ecoulee (ms)'],
    ['server_ip', 'Serveur'], ['protocol', 'Protocole'], ['method', 'Methode'],
    ['status_code', 'Statut'], ['referrer', 'Referent'], ['sampling_fraction', 'Echantillonnage']
  ],
  'deprecation': [
    ['id', 'Identifiant'], ['message', 'Message'], ['anticipatedRemoval', 'Retrait prevu'],
    ['sourceFile', 'Fichier source'], ['lineNumber', 'Ligne'], ['columnNumber', 'Colonne']
  ],
  'intervention': [
    ['id', 'Identifiant'], ['message', 'Message'],
    ['sourceFile', 'Fichier source'], ['lineNumber', 'Ligne'], ['columnNumber', 'Colonne']
  ],
  'permissions-policy-violation': [
    ['featureId', 'Fonction'], ['disposition', 'Disposition'], ['sourceFile', 'Fichier source'],
    ['lineNumber', 'Ligne'], ['columnNumber', 'Colonne'], ['allowAttribute', 'Attribut allow'],
    ['srcAttribute', 'Attribut src']
  ]
};

/* La forme depreciee de la CSP, ramenee aux noms de la Reporting API. */
const CSP_ANCIENNE = {
  'document-uri': 'documentURL', 'referrer': 'referrer', 'blocked-uri': 'blockedURL',
  'effective-directive': 'effectiveDirective', 'violated-directive': 'violatedDirective',
  'original-policy': 'originalPolicy', 'disposition': 'disposition', 'status-code': 'statusCode',
  'script-sample': 'sample', 'source-file': 'sourceFile', 'line-number': 'lineNumber',
  'column-number': 'columnNumber'
};

export const NOMS_TYPES = {
  'csp-violation': 'Violation de la CSP',
  'network-error': 'Erreur reseau (NEL)',
  'deprecation': 'API depreciee',
  'intervention': 'Intervention du navigateur',
  'permissions-policy-violation': 'Violation de Permissions-Policy',
  'crash': 'Plantage',
  'coep': 'Violation de COEP',
  'coop': 'Violation de COOP',
  'document-policy-violation': 'Violation de Document-Policy'
};

const texteDe = v => (v === null || v === undefined ? null
  : typeof v === 'object' ? JSON.stringify(v) : String(v));

function jsonDe(texte) {
  if (typeof texte !== 'string') return undefined;
  const s = texte.trim();
  if (!s || (s[0] !== '{' && s[0] !== '[')) return undefined;
  try { return JSON.parse(s); } catch { return undefined; }
}

/** Les lignes « libelle, valeur » d un corps de rapport, dans l ordre du type. */
function lignesDe(type, corps) {
  const connus = CHAMPS_RAPPORTS[type];
  const lignes = [];
  const vus = new Set();
  for (const [cle, libelle] of connus || []) {
    if (!(cle in corps)) continue;
    vus.add(cle);
    const valeur = texteDe(corps[cle]);
    if (valeur !== null && valeur !== '') lignes.push([libelle, valeur, cle]);
  }
  /* Ce que le type ne prevoit pas, ou un type inconnu : montre tel quel. */
  for (const [cle, v] of Object.entries(corps)) {
    if (vus.has(cle)) continue;
    const valeur = texteDe(v);
    if (valeur !== null && valeur !== '') lignes.push([cle, valeur, cle]);
  }
  return lignes;
}

function faitsDe(type, corps, age) {
  const faits = [];
  const dire = (cle, valeurs = {}) => faits.push({ cle, texte: FAITS_RAPPORTS[cle], valeurs });
  if (type === 'csp-violation') {
    const d = corps.effectiveDirective || corps.violatedDirective || '?';
    const u = corps.blockedURL || '?';
    if (corps.disposition === 'report') dire('cspRapportSeul', { u });
    else if (corps.disposition === 'enforce') dire('cspBloque', { d, u });
  }
  if (type === 'network-error' && typeof corps.type === 'string') {
    const phase = corps.phase || '?';
    if (corps.type === 'ok') dire('nelSucces');
    else if (TYPES_NEL[corps.type]) {
      dire('nelEchec', { type: corps.type, phase, sens: TYPES_NEL[corps.type][1] });
      faits[faits.length - 1].aTraduire = ['sens'];
    }
    else dire('nelInconnu', { type: corps.type, phase });
  }
  if (Number.isFinite(age) && age >= 60000) dire('vieux', { s: Math.round(age / 1000) });
  return faits;
}

/**
 * Les rapports que porte un corps de requete, ou null s il n en porte pas.
 * La forme est reconnue a sa structure, pas seulement au type declare : un
 * HAR importe garde rarement le Content-Type d origine.
 * @param {string} texte
 * @param {string} [typeMedia]
 */
export function lireRapports(texte, typeMedia = '') {
  const valeur = jsonDe(texte);
  const type = String(typeMedia || '').toLowerCase();

  /* La forme depreciee de report-uri. */
  if (estObjet(valeur) && estObjet(valeur['csp-report'])) {
    const brut = valeur['csp-report'];
    const corps = {};
    for (const [cle, v] of Object.entries(brut)) corps[CSP_ANCIENNE[cle] || cle] = v;
    const faits = faitsDe('csp-violation', corps, null);
    faits.unshift({ cle: 'cspDeprecie', texte: FAITS_RAPPORTS.cspDeprecie, valeurs: {} });
    return {
      forme: 'csp-report',
      rapports: [{
        type: 'csp-violation', url: corps.documentURL || null, age: null, agent: null,
        lignes: lignesDe('csp-violation', corps).map(([l, v, cle]) => [cle === 'violatedDirective' ? 'Directive declaree' : l, v]),
        faits
      }]
    };
  }

  /* La Reporting API : une liste de rapports. */
  const liste = Array.isArray(valeur) ? valeur : null;
  const estRapport = r => estObjet(r) && typeof r.type === 'string' && estObjet(r.body)
    && (typeof r.url === 'string' || type.startsWith('application/reports+json'));
  if (!liste || !liste.length || !liste.every(estRapport)) return null;
  return {
    forme: 'reporting',
    rapports: liste.map(r => ({
      type: r.type,
      url: typeof r.url === 'string' ? r.url : null,
      age: Number.isFinite(r.age) ? r.age : null,
      agent: typeof r.user_agent === 'string' ? r.user_agent : null,
      lignes: lignesDe(r.type, r.body).map(([l, v]) => [l, v]),
      faits: faitsDe(r.type, r.body, r.age)
    }))
  };
}

/* ------------------------------- La collecte ------------------------------ */
/** Une origine « potentiellement digne de confiance », au sens des contextes
 *  surs : https et wss, et le bouclage local. */
export function origineSure(adresse) {
  let u;
  try { u = new URL(adresse); } catch { return false; }
  if (u.protocol === 'https:' || u.protocol === 'wss:') return true;
  const hote = u.hostname.replace(/^\[|\]$/g, '');
  return hote === 'localhost' || hote.endsWith('.localhost') || /^127\./.test(hote) || hote === '::1';
}

const valeursDe = (entetes, nom) => (entetes || [])
  .filter(h => h && String(h.name || '').toLowerCase() === nom)
  .map(h => String(h.value ?? ''));

/**
 * Ou une reponse demande d envoyer les rapports : Reporting-Endpoints,
 * Report-To et NEL, avec ce que le navigateur en fera.
 * @param {{name:string, value:string}[]} entetes  les en-tetes de la reponse
 * @param {string} urlReponse                     pour resoudre les adresses relatives
 * @returns {null|{points:object[], groupes:object[], nel:object|null, faits:object[]}}
 */
export function lireCollecte(entetes, urlReponse = '') {
  const endpoints = valeursDe(entetes, 'reporting-endpoints');
  const reportTo = valeursDe(entetes, 'report-to');
  const nelBrut = valeursDe(entetes, 'nel');
  if (!endpoints.length && !reportTo.length && !nelBrut.length) return null;

  const faits = [];
  const dire = (cle, valeurs = {}) => faits.push({ cle, texte: FAITS_RAPPORTS[cle], valeurs });
  const sure = origineSure(urlReponse);
  if ((endpoints.length || nelBrut.length) && urlReponse && !sure) dire('reponseNonSure');

  /* Reporting-Endpoints : un dictionnaire de champs structures ; plusieurs
     lignes se lisent comme une seule, jointes par des virgules. La derniere
     occurrence d une cle l emporte (RFC 9651). */
  const points = [];
  if (endpoints.length) {
    try {
      const membres = new Map();
      for (const m of lireDictionnaire(endpoints.join(', '))) membres.set(m.cle, m);
      for (const [nom, m] of membres) {
        if (m.type !== 'chaine') { dire('endpointNonChaine', { nom }); continue; }
        let adresse;
        try { adresse = new URL(m.valeur, urlReponse || undefined).href; }
        catch { dire('endpointIllisible', { nom }); continue; }
        const ok = origineSure(adresse);
        if (!ok) dire('endpointNonSur', { nom, u: adresse });
        points.push({ nom, url: adresse, sure: ok });
      }
    } catch (e) {
      dire('illisible', { nom: 'Reporting-Endpoints', raison: String(e && e.message || e) });
    }
  }

  /* Report-To : un ou plusieurs objets JSON, separes par des virgules. */
  const groupes = [];
  if (reportTo.length) {
    dire('reportToAncien');
    const valeur = jsonDe('[' + reportTo.join(',') + ']');
    if (!Array.isArray(valeur)) {
      dire('illisible', { nom: 'Report-To', raison: 'JSON invalide' });
    } else {
      for (const g of valeur.filter(estObjet)) {
        groupes.push({
          groupe: typeof g.group === 'string' ? g.group : 'default',
          maxAge: Number.isFinite(g.max_age) ? g.max_age : null,
          sousDomaines: g.include_subdomains === true,
          urls: Array.isArray(g.endpoints) ? g.endpoints.filter(estObjet).map(e => String(e.url || '')).filter(Boolean) : []
        });
      }
    }
  }

  /* NEL : un objet JSON. Valeurs par defaut de la specification :
     success_fraction 0, failure_fraction 1, include_subdomains faux. */
  let nel = null;
  if (nelBrut.length) {
    const valeur = jsonDe(nelBrut[0]);
    if (!estObjet(valeur)) {
      dire('illisible', { nom: 'NEL', raison: 'JSON invalide' });
    } else {
      const fraction = (v, defaut) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : defaut);
      nel = {
        groupe: typeof valeur.report_to === 'string' ? valeur.report_to : null,
        maxAge: Number.isFinite(valeur.max_age) ? valeur.max_age : null,
        sousDomaines: valeur.include_subdomains === true,
        succes: fraction(valeur.success_fraction, 0),
        echecs: fraction(valeur.failure_fraction, 1)
      };
      if (nel.maxAge === 0) dire('nelSuppression');
      else {
        const pourcent = v => String(Math.round(v * 1000) / 10);
        dire('nelEchantillons', { s: pourcent(nel.succes), e: pourcent(nel.echecs) });
        if (nel.sousDomaines) dire('nelSousDomaines');
      }
    }
  }
  return { points, groupes, nel, faits };
}
