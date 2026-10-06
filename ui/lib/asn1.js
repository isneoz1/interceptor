/* ASN.1 / DER et certificats X.509 — SWIFT (by NeoZ)
 *
 * Un bloc PEM colle depuis un serveur, une cle publique, une chaine de
 * certificats : tout cela est du DER. On le parcourt ici sans bibliotheque, et
 * on en tire l arbre reel plus un resume lisible du certificat.
 *
 * Firefox donne deja la chaine du site visite ; cet outil sert a lire un
 * certificat qu on a sous la main, ou a comprendre une cle publique.
 */
import { octetsVersHex, base64VersOctets, octetsVersBase64 } from './bytes.js';

/* --------------------------------- Types ---------------------------------- */
const TYPES = {
  1: 'BOOLEAN', 2: 'INTEGER', 3: 'BIT STRING', 4: 'OCTET STRING', 5: 'NULL',
  6: 'OBJECT IDENTIFIER', 10: 'ENUMERATED', 12: 'UTF8String', 16: 'SEQUENCE',
  17: 'SET', 19: 'PrintableString', 20: 'T61String', 22: 'IA5String',
  23: 'UTCTime', 24: 'GeneralizedTime', 26: 'VisibleString', 30: 'BMPString'
};

/* Les identifiants d objet que l on rencontre reellement dans un certificat. */
const OID = {
  '1.2.840.113549.1.1.1': 'rsaEncryption',
  '1.2.840.113549.1.1.5': 'sha1WithRSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.113549.1.1.11': 'sha256WithRSA',
  '1.2.840.113549.1.1.12': 'sha384WithRSA',
  '1.2.840.113549.1.1.13': 'sha512WithRSA',
  '1.2.840.10045.2.1': 'ecPublicKey',
  '1.2.840.10045.3.1.7': 'courbe P-256 (prime256v1)',
  '1.3.132.0.34': 'courbe P-384 (secp384r1)',
  '1.3.132.0.35': 'courbe P-521 (secp521r1)',
  '1.2.840.10045.4.3.2': 'ecdsaWithSHA256',
  '1.2.840.10045.4.3.3': 'ecdsaWithSHA384',
  '1.2.840.10045.4.3.4': 'ecdsaWithSHA512',
  '1.3.101.112': 'Ed25519',
  '2.16.840.1.101.3.4.2.1': 'SHA-256',
  '2.16.840.1.101.3.4.2.2': 'SHA-384',
  '2.16.840.1.101.3.4.2.3': 'SHA-512',
  '2.5.4.3': 'CN (nom commun)',
  '2.5.4.6': 'C (pays)',
  '2.5.4.7': 'L (localite)',
  '2.5.4.8': 'ST (region)',
  '2.5.4.10': 'O (organisation)',
  '2.5.4.11': 'OU (unite)',
  '2.5.4.5': 'serialNumber',
  '1.2.840.113549.1.9.1': 'emailAddress',
  '2.5.29.14': 'identifiant de la cle du sujet',
  '2.5.29.15': 'usage de la cle',
  '2.5.29.17': 'autres noms du sujet (SAN)',
  '2.5.29.19': 'contraintes de base',
  '2.5.29.31': 'points de distribution de CRL',
  '2.5.29.32': 'politiques de certification',
  '2.5.29.35': 'identifiant de la cle de l autorite',
  '2.5.29.37': 'usages etendus de la cle',
  '1.3.6.1.5.5.7.1.1': 'acces aux informations de l autorite',
  '1.3.6.1.5.5.7.3.1': 'authentification de serveur',
  '1.3.6.1.5.5.7.3.2': 'authentification de client',
  '1.3.6.1.5.5.7.3.3': 'signature de code',
  '1.3.6.1.5.5.7.3.4': 'protection du courrier',
  '1.3.6.1.5.5.7.48.1': 'OCSP',
  '1.3.6.1.5.5.7.48.2': 'certificat de l autorite',
  '1.3.6.1.4.1.11129.2.4.2': 'horodatages de transparence des certificats',
  '1.3.6.1.4.1.11129.2.4.3': 'poison de precertificat',
  '1.3.6.1.5.5.7.1.24': 'TLS Feature (OCSP Must-Staple)',
  '2.5.29.30': 'contraintes de noms',
  '2.5.29.32.0': 'anyPolicy',
  /* Politiques du CA/Browser Forum : le niveau de verification reel. */
  '2.23.140.1.1': 'EV (validation etendue)',
  '2.23.140.1.2.1': 'DV (domaine valide)',
  '2.23.140.1.2.2': 'OV (organisation validee)',
  '2.23.140.1.2.3': 'IV (individu valide)'
};

/* Le niveau de validation que declare un certificat, par sa politique. */
const VALIDATION = {
  '2.23.140.1.1': 'EV', '2.23.140.1.2.1': 'DV', '2.23.140.1.2.2': 'OV', '2.23.140.1.2.3': 'IV'
};

/** Nom lisible d un identifiant d objet, ou l identifiant lui-meme. */
export function nomOid(oid) { return OID[oid] || oid; }

/* -------------------------------- Lecture --------------------------------- */
function lireLongueur(o, i) {
  let taille = o[i++];
  if (taille === 0x80) throw new Error('longueur indefinie : ce n est pas du DER');
  if (taille & 0x80) {
    const octets = taille & 0x7f;
    if (octets > 4) throw new Error('longueur trop grande');
    taille = 0;
    for (let k = 0; k < octets; k++) taille = (taille << 8) | o[i++];
  }
  return { taille, suite: i };
}

function lireOid(o) {
  if (!o.length) throw new Error('identifiant d objet vide');
  const parties = [Math.floor(o[0] / 40), o[0] % 40];
  let valeur = 0n;
  for (let i = 1; i < o.length; i++) {
    valeur = (valeur << 7n) | BigInt(o[i] & 0x7f);
    if (!(o[i] & 0x80)) { parties.push(valeur.toString()); valeur = 0n; }
  }
  return parties.join('.');
}

function lireDate(texte, type) {
  const s = String(texte).replace('Z', '');
  const siecle = type === 'UTCTime'
    ? (Number(s.slice(0, 2)) >= 50 ? '19' : '20')
    : '';
  const p = siecle + s;
  const iso = p.slice(0, 4) + '-' + p.slice(4, 6) + '-' + p.slice(6, 8) + 'T' +
    p.slice(8, 10) + ':' + p.slice(10, 12) + ':' + (p.slice(12, 14) || '00') + 'Z';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? texte : d.toISOString();
}

/**
 * Parcourt un bloc DER et rend l arbre complet. Chaque noeud porte son type,
 * sa longueur, sa valeur lisible et ses enfants.
 */
export function lireDer(octets, profondeur = 0) {
  const noeuds = [];
  let i = 0;
  while (i < octets.length) {
    if (profondeur > 24) throw new Error('imbrication ASN.1 trop profonde');
    const etiquette = octets[i++];
    const numero = etiquette & 0x1f;
    if (numero === 0x1f) throw new Error('etiquette longue non geree');
    const construit = !!(etiquette & 0x20);
    const classe = etiquette >> 6;
    const { taille, suite } = lireLongueur(octets, i);
    i = suite;
    if (i + taille > octets.length) throw new Error('longueur au-dela des donnees');
    const contenu = octets.subarray(i, i + taille);
    i += taille;

    const nom = classe === 0 ? (TYPES[numero] || 'type ' + numero)
      : classe === 2 ? '[' + numero + ']'
      : 'classe ' + classe + ' type ' + numero;
    const noeud = { type: nom, construit, octets: taille };
    /* Le contenu ENTIER, hors de l arbre affiche : `valeur` n en montre que
       24 octets, et un nom DNS de 40 caracteres lu depuis `valeur` sortait
       coupe comme s il etait complet. Non enumerable, il ne s ajoute pas au
       JSON de l arbre. */
    Object.defineProperty(noeud, 'contenu', { value: contenu, enumerable: false });

    if (construit) {
      noeud.enfants = lireDer(contenu, profondeur + 1);
    } else if (nom === 'OBJECT IDENTIFIER') {
      noeud.oid = lireOid(contenu);
      noeud.valeur = nomOid(noeud.oid);
    } else if (nom === 'INTEGER') {
      noeud.valeur = taille <= 8
        ? BigInt('0x' + (octetsVersHex(contenu) || '0')).toString()
        : '0x' + octetsVersHex(contenu);
    } else if (nom === 'BOOLEAN') {
      noeud.valeur = contenu[0] ? 'true' : 'false';
    } else if (nom === 'NULL') {
      noeud.valeur = 'null';
    } else if (['UTF8String', 'PrintableString', 'IA5String', 'VisibleString', 'T61String'].includes(nom)) {
      noeud.valeur = new TextDecoder().decode(contenu);
    } else if (nom === 'BMPString') {
      noeud.valeur = new TextDecoder('utf-16be').decode(contenu);
    } else if (nom === 'UTCTime' || nom === 'GeneralizedTime') {
      noeud.valeur = lireDate(new TextDecoder().decode(contenu), nom);
    } else if (nom === 'BIT STRING') {
      // Le premier octet compte les bits inutilises ; le reste est souvent une
      // structure a son tour (cle publique, signature).
      noeud.bitsInutilises = contenu[0];
      const corps = contenu.subarray(1);
      noeud.valeur = octetsVersHex(corps.subarray(0, 24), ' ') + (corps.length > 24 ? ' …' : '');
      if (profondeur < 12 && corps.length > 2) {
        try { noeud.enfants = lireDer(corps, profondeur + 1); } catch { /* donnees brutes */ }
      }
    } else if (nom === 'OCTET STRING') {
      noeud.valeur = octetsVersHex(contenu.subarray(0, 24), ' ') + (taille > 24 ? ' …' : '');
      if (profondeur < 12 && taille > 2) {
        try { noeud.enfants = lireDer(contenu, profondeur + 1); } catch { /* donnees brutes */ }
      }
    } else {
      noeud.valeur = octetsVersHex(contenu.subarray(0, 24), ' ') + (taille > 24 ? ' …' : '');
    }
    noeuds.push(noeud);
  }
  return noeuds;
}

/** Bloc PEM -> octets DER. Le premier bloc rencontre est retenu. */
export function pemVersOctets(texte) {
  const m = String(texte).match(/-----BEGIN ([^-]+)-----([\s\S]*?)-----END [^-]+-----/);
  if (!m) throw new Error('aucun bloc PEM (-----BEGIN ...-----) dans ce texte');
  return { etiquette: m[1].trim(), octets: base64VersOctets(m[2].replace(/[\s\r\n]+/g, '')) };
}

/* -------------------------------- X.509 ----------------------------------- */
const chercher = (noeuds, chemin) => chemin.reduce((n, i) => (n && n.enfants ? n.enfants[i] : null),
  { enfants: noeuds });

function nomDistingue(noeud) {
  if (!noeud || !noeud.enfants) return '';
  const morceaux = [];
  for (const ensemble of noeud.enfants) {
    for (const paire of ensemble.enfants || []) {
      const [type, valeur] = paire.enfants || [];
      if (!type || !valeur) continue;
      const etiquette = (nomOid(type.oid) || '').split(' ')[0];
      morceaux.push(etiquette + '=' + valeur.valeur);
    }
  }
  return morceaux.join(', ');
}

const USAGES = ['signature numerique', 'non-repudiation', 'chiffrement de cle',
  'chiffrement de donnees', 'accord de cle', 'signature de certificat',
  'signature de CRL', 'chiffrement seul', 'dechiffrement seul'];

/**
 * Resume d un certificat X.509 : ce qu on veut savoir en dix secondes.
 * Chaque valeur vient du DER, aucune n est deduite ni completee.
 */
export function resumerCertificat(octets) {
  const racine = lireDer(octets);
  const cert = racine[0];
  if (!cert || !cert.enfants || cert.enfants.length < 3) throw new Error('ce bloc n est pas un certificat X.509');
  const tbs = cert.enfants[0];
  const champs = tbs.enfants || [];
  const explicite = champs[0] && champs[0].type === '[0]';
  const decalage = explicite ? 1 : 0;

  const version = explicite && champs[0].enfants && champs[0].enfants[0]
    ? Number(champs[0].enfants[0].valeur) + 1 : 1;
  const serie = champs[decalage];
  const validite = champs[decalage + 3];
  const spki = champs[decalage + 5];

  const resume = {
    version: 'v' + version,
    numeroDeSerie: serie ? serie.valeur : null,
    algorithmeDeSignature: chercher(champs, [decalage + 1, 0])
      ? nomOid(chercher(champs, [decalage + 1, 0]).oid) : null,
    emetteur: nomDistingue(champs[decalage + 2]),
    sujet: nomDistingue(champs[decalage + 4]),
    valideDes: validite && validite.enfants ? validite.enfants[0].valeur : null,
    valideJusqua: validite && validite.enfants ? validite.enfants[1].valeur : null,
    algorithmeDeCle: chercher([spki], [0, 0, 0]) && chercher([spki], [0, 0, 0]).oid
      ? nomOid(chercher([spki], [0, 0, 0]).oid) : null,
    courbe: chercher([spki], [0, 0, 1]) && chercher([spki], [0, 0, 1]).oid
      ? nomOid(chercher([spki], [0, 0, 1]).oid) : null,
    tailleDeCle: null,
    noms: [],
    adressesIp: [],
    courriels: [],
    uris: [],
    usages: [],
    usagesEtendus: [],
    autorite: null,
    ocsp: [],
    emetteurCa: [],
    crl: [],
    politiques: [],
    validation: null,
    identifiantCle: null,
    identifiantCleAutorite: null,
    sct: [],
    extensions: []
  };

  resume.tailleDeCle = tailleCle(spki, resume.courbe);

  if (resume.valideJusqua) {
    const fin = new Date(resume.valideJusqua).getTime();
    resume.expire = fin < Date.now();
    resume.joursRestants = Math.round((fin - Date.now()) / 86400000);
  }

  const conteneur = champs.find(c => c.type === '[3]');
  for (const ext of (conteneur && conteneur.enfants && conteneur.enfants[0]
    ? conteneur.enfants[0].enfants || [] : [])) {
    const parties = ext.enfants || [];
    const oid = parties[0] ? parties[0].oid : null;
    if (!oid) continue;
    const critique = parties.length === 3;
    resume.extensions.push({ oid, nom: nomOid(oid), critique });
    const valeur = parties[parties.length - 1];

    /* La valeur d une extension est du DER dans une OCTET STRING. Le lecteur
       generique ne descend que dans un contenu de plus de deux octets : un
       « CA:FALSE », code `30 00`, restait donc non lu — et « autorite de
       certification : non » n apparaissait jamais. On relit ici le contenu. */
    let interieur = valeur.enfants && valeur.enfants[0] ? valeur.enfants[0] : null;
    if (!interieur && valeur.contenu && valeur.contenu.length) {
      try { interieur = lireDer(valeur.contenu)[0] || null; } catch { interieur = null; }
    }

    /* RFC 5280, 4.2.1.6 : chaque GeneralName dit son type par son etiquette. */
    if (oid === '2.5.29.17' && interieur) {
      for (const nom of interieur.enfants || []) {
        if (nom.type === '[2]') resume.noms.push(ascii(nom.contenu));
        else if (nom.type === '[7]') resume.adressesIp.push(adresseIp(nom.contenu));
        else if (nom.type === '[1]') resume.courriels.push(ascii(nom.contenu));
        else if (nom.type === '[6]') resume.uris.push(ascii(nom.contenu));
      }
    }
    /* 4.2.2.1 : ou demander l etat de revocation (OCSP), et ou trouver le
       certificat de l autorite qui a signe celui-ci. */
    if (oid === '1.3.6.1.5.5.7.1.1' && interieur) {
      for (const acces of interieur.enfants || []) {
        const [methode, lieu] = acces.enfants || [];
        if (!methode || !lieu || lieu.type !== '[6]') continue;
        if (methode.oid === '1.3.6.1.5.5.7.48.1') resume.ocsp.push(ascii(lieu.contenu));
        if (methode.oid === '1.3.6.1.5.5.7.48.2') resume.emetteurCa.push(ascii(lieu.contenu));
      }
    }
    /* 4.2.1.13 : DistributionPoint > [0] distributionPoint > [0] fullName >
       [6] URI. Seul ce chemin designe une liste de revocation. */
    if (oid === '2.5.29.31' && interieur) {
      for (const point of interieur.enfants || []) {
        const nomPoint = (point.enfants || []).find(n => n.type === '[0]');
        const complet = nomPoint && (nomPoint.enfants || []).find(n => n.type === '[0]');
        for (const n of (complet && complet.enfants) || []) {
          if (n.type === '[6]') resume.crl.push(ascii(n.contenu));
        }
      }
    }
    /* 4.2.1.4 : la politique dit le niveau de verification reel (DV, OV, EV). */
    if (oid === '2.5.29.32' && interieur) {
      for (const politique of interieur.enfants || []) {
        const id = politique.enfants && politique.enfants[0] && politique.enfants[0].oid;
        if (!id) continue;
        resume.politiques.push({ oid: id, nom: nomOid(id) });
        if (VALIDATION[id] && !resume.validation) resume.validation = VALIDATION[id];
      }
    }
    if (oid === '2.5.29.14' && interieur && interieur.contenu) {
      resume.identifiantCle = octetsVersHex(interieur.contenu, ':').toUpperCase();
    }
    if (oid === '2.5.29.35' && interieur) {
      const id = (interieur.enfants || []).find(n => n.type === '[0]');
      if (id) resume.identifiantCleAutorite = octetsVersHex(id.contenu, ':').toUpperCase();
    }
    /* RFC 6962, 3.3 : les preuves d inscription aux journaux de transparence,
       dans une structure TLS glissee dans une OCTET STRING. */
    if (oid === '1.3.6.1.4.1.11129.2.4.2' && interieur && interieur.contenu) {
      resume.sct = lireListeSct(interieur.contenu);
    }
    if (oid === '2.5.29.19' && interieur) {
      const contraintes = interieur.enfants || [];
      resume.autorite = contraintes.some(c => c.type === 'BOOLEAN' && c.valeur === 'true');
    }
    if (oid === '2.5.29.37' && interieur) {
      for (const u of interieur.enfants || []) if (u.oid) resume.usagesEtendus.push(nomOid(u.oid));
    }
    if (oid === '2.5.29.15' && interieur) {
      resume.usages = lireUsages(interieur);
    }
  }
  return resume;
}

/** L usage de la cle est une suite de bits : chaque bit leve a un nom. */
function lireUsages(bitString) {
  const octets = hexVers(bitString.valeur || '');
  const inutilises = Number(bitString.bitsInutilises || 0);
  const total = octets.length * 8 - inutilises;
  const trouves = [];
  for (let bit = 0; bit < total && bit < USAGES.length; bit++) {
    if (octets[bit >> 3] & (0x80 >> (bit & 7))) trouves.push(USAGES[bit]);
  }
  return trouves;
}

/**
 * Taille reelle de la cle : longueur du module pour RSA, taille de la courbe
 * pour une cle elliptique. Rien n est deduit du reste : sans certitude, on
 * n annonce pas de taille.
 */
function tailleCle(spki, courbe) {
  const nom = String(courbe || '');
  const m = nom.match(/P-(256|384|521)/);
  if (m) return m[1] + ' bits (courbe)';
  const cle = chercher([spki], [0, 1]);
  const rsa = cle && cle.enfants && cle.enfants[0] && cle.enfants[0].enfants
    ? cle.enfants[0].enfants[0] : null;
  if (rsa && rsa.type === 'INTEGER' && typeof rsa.valeur === 'string' && rsa.valeur.startsWith('0x')) {
    return (rsa.valeur.slice(2).replace(/^00/, '').length * 4) + ' bits (module RSA)';
  }
  return null;
}

/* IA5String : de l ASCII. Le contenu entier, jamais l apercu tronque. */
function ascii(octets) { return new TextDecoder().decode(octets || new Uint8Array(0)); }

/** Une adresse d un SAN : 4 octets en IPv4, 16 en IPv6 (forme RFC 5952). */
function adresseIp(octets) {
  if (!octets) return '';
  if (octets.length === 4) return Array.from(octets).join('.');
  if (octets.length !== 16) return octetsVersHex(octets, ':');
  const groupes = [];
  for (let i = 0; i < 16; i += 2) groupes.push(((octets[i] << 8) | octets[i + 1]).toString(16));
  /* La plus longue suite d au moins deux groupes nuls devient « :: ». */
  let debut = -1, longueur = 0;
  for (let i = 0; i < 8;) {
    if (groupes[i] !== '0') { i++; continue; }
    let j = i;
    while (j < 8 && groupes[j] === '0') j++;
    if (j - i > longueur && j - i >= 2) { debut = i; longueur = j - i; }
    i = j;
  }
  if (debut < 0) return groupes.join(':');
  return groupes.slice(0, debut).join(':') + '::' + groupes.slice(debut + longueur).join(':');
}

const HACHAGES_TLS = { 0: 'none', 1: 'MD5', 2: 'SHA-1', 3: 'SHA-224', 4: 'SHA-256', 5: 'SHA-384', 6: 'SHA-512' };
const SIGNATURES_TLS = { 0: 'anonymous', 1: 'RSA', 2: 'DSA', 3: 'ECDSA' };

/**
 * SignedCertificateTimestampList (RFC 6962, 3.3) : une longueur totale sur
 * deux octets, puis chaque SCT precede de sa propre longueur. Un SCT v1 :
 * version, identifiant du journal (32 octets), horodatage en millisecondes
 * (8 octets), extensions, puis la signature.
 */
function lireListeSct(o) {
  const liste = [];
  if (!o || o.length < 2) return liste;
  const total = (o[0] << 8) | o[1];
  let i = 2;
  const fin = Math.min(o.length, 2 + total);
  while (i + 2 <= fin) {
    const n = (o[i] << 8) | o[i + 1];
    const debut = i + 2;
    i = debut + n;
    if (i > fin || n < 1) break;                   // liste tronquee : on s arrete
    const s = o.subarray(debut, debut + n);
    /* RFC 6962 ne definit que la version v1 (octet 0). Une autre valeur n a
       pas de disposition connue : on la signale, sans lire ses octets avec
       celle de la v1 — ce serait presenter comme lu ce qui ne l est pas. */
    if (s[0] !== 0) {
      liste.push({ version: null, octetDeVersion: s[0] });
      continue;
    }
    /* Un SCT v1 compte au moins 47 octets : version, journal, horodatage,
       extensions et en-tete de signature. En dessous, il est tronque. */
    if (n < 47) {
      liste.push({ version: 'v1', tronque: true });
      continue;
    }
    let ms = 0;
    for (let k = 33; k < 41; k++) ms = ms * 256 + s[k];
    const ext = (s[41] << 8) | s[42];
    const apres = 43 + ext;
    liste.push({
      version: 'v1',
      journal: octetsVersBase64(s.subarray(1, 33)),
      horodatage: new Date(ms).toISOString(),
      signature: apres + 1 < s.length
        ? (HACHAGES_TLS[s[apres]] || s[apres]) + ' / ' + (SIGNATURES_TLS[s[apres + 1]] || s[apres + 1])
        : null
    });
  }
  return liste;
}

/* Les noms DNS d un SAN sont rendus en hexadecimal par le lecteur generique :
   on les retransforme en octets pour les relire en texte. */
function hexVers(valeurHex) {
  const net = String(valeurHex).replace(/[^0-9a-f]/gi, '');
  const out = new Uint8Array(net.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(net.substr(i * 2, 2), 16);
  return out;
}

/* --------------------- Entree texte pour le catalogue --------------------- */
/**
 * Bloc PEM ou base64 -> structure ASN.1 en JSON. C est la forme qui entre dans
 * le catalogue des transformations, ou tout se manipule en texte.
 */
export function derVersJson(texte) {
  const brut = String(texte || '').trim();
  if (!brut) throw new Error('rien a decoder');
  const octets = brut.includes('-----BEGIN')
    ? pemVersOctets(brut).octets
    : base64VersOctets(brut.replace(/[\s]+/g, ''));
  return JSON.stringify(lireDer(octets), null, 2);
}

/** Bloc PEM d un certificat -> resume lisible en JSON. */
export function certificatVersJson(texte) {
  const brut = String(texte || '').trim();
  const octets = brut.includes('-----BEGIN')
    ? pemVersOctets(brut).octets
    : base64VersOctets(brut.replace(/[\s]+/g, ''));
  return JSON.stringify(resumerCertificat(octets), null, 2);
}
