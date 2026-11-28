/* Ce que disent les enregistrements DNS d un domaine — SWIFT (by D4RK)
 *
 * dns-message.js lit les octets ; ici, le sens. Chaque lecture suit le texte
 * qui definit l enregistrement, et ne dit que ce qu il permet d affirmer :
 *
 *   SPF      RFC 7208 — qui peut envoyer du courrier au nom du domaine ;
 *   DMARC    RFC 7489 — ce que doit faire un destinataire d un message qui
 *            echoue, et ou envoyer les rapports ;
 *   MTA-STS  RFC 8461 — le courrier entrant exige TLS ;
 *   TLS-RPT  RFC 8460 — ou recevoir les rapports d echec TLS ;
 *   DKIM     RFC 6376 (3.6.1) — la cle publique d un selecteur ;
 *   CAA      RFC 8659 — quelles autorites peuvent emettre un certificat ;
 *   MX       RFC 5321, et le MX nul de la RFC 7505 ;
 *   HTTPS    RFC 9460 — ALPN (HTTP/3), ECH, indices d adresses ;
 *   SOA      RFC 1035 (3.3.13).
 *
 * Les textes des faits sont des gabarits a trous, traduits par l interface.
 */

/* Le texte d un TXT : dns-message.js l ecrit en format de presentation —
   des chaines entre guillemets, separees par une espace, avec \" \\ et \DDD.
   Les chaines d un meme enregistrement se lisent bout a bout (RFC 7208 3.3). */
export function texteTxt(donnees) {
  const s = String(donnees == null ? '' : donnees);
  let sortie = '';
  let dedans = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!dedans) { if (c === '"') dedans = true; continue; }
    if (c === '"') { dedans = false; continue; }
    if (c === '\\' && i + 1 < s.length) {
      if (/[0-9]{3}/.test(s.substring(i + 1, i + 4))) { sortie += String.fromCharCode(Number(s.substring(i + 1, i + 4))); i += 3; }
      else { sortie += s[i + 1]; i++; }
      continue;
    }
    sortie += c;
  }
  return sortie;
}

/* Etiquettes « cle=valeur; » (DMARC, MTA-STS, TLS-RPT, DKIM, BIMI). */
function etiquettesTexte(texte) {
  const table = new Map();
  for (const morceau of String(texte).split(';')) {
    const k = morceau.indexOf('=');
    if (k <= 0) continue;
    table.set(morceau.substring(0, k).trim().toLowerCase(), morceau.substring(k + 1).trim());
  }
  return table;
}

/** Ce qu est un TXT, d apres son debut. */
export function classerTxt(texte) {
  const s = String(texte || '').trim();
  if (/^v=spf1(\s|$)/i.test(s)) return 'spf';
  if (/^v=DMARC1\s*(;|$)/i.test(s)) return 'dmarc';
  if (/^v=STSv1\s*(;|$)/i.test(s)) return 'mta-sts';
  if (/^v=TLSRPTv1\s*(;|$)/i.test(s)) return 'tls-rpt';
  if (/^v=DKIM1\s*(;|$)/i.test(s) || /(^|;)\s*p=[A-Za-z0-9+/=]*\s*(;|$)/.test(s) && /(^|;)\s*k=/.test(s)) return 'dkim';
  if (/^v=BIMI1\s*(;|$)/i.test(s)) return 'bimi';
  if (/^[a-z0-9-]+-(site|domain)-verification=|^MS=ms[0-9]+|^apple-domain-verification=|^[a-z0-9-]+-verification=/i.test(s)) return 'verification';
  return 'autre';
}

/* ----------------------------------- SPF ---------------------------------- */
export const FAITS_SPF = {
  finTout: 'politique finale {q}all : {sens}',
  sansAll: 'aucun mecanisme all : un expediteur non liste obtient « neutral » (RFC 7208 4.7)',
  redirection: 'redirection vers la politique de {domaine}',
  requetes: '{n} mecanisme(s) demandant une requete DNS (au plus dix, RFC 7208 4.6.4, sans compter ceux des include)',
  tropDeRequetes: 'plus de dix mecanismes demandant une requete DNS : l evaluation echoue (permerror, RFC 7208 4.6.4)',
  ptr: 'le mecanisme ptr est deconseille : lent, peu fiable (RFC 7208 5.5)',
  inconnu: 'terme inconnu « {terme} » : l evaluation echoue (permerror)',
  plusieurs: '{n} enregistrements SPF : un seul est permis, l evaluation echoue (permerror, RFC 7208 3.2)'
};
const SENS_ALL = new Map([
  ['-', 'tout autre expediteur est refuse (fail)'],
  ['~', 'tout autre expediteur est suspect (softfail)'],
  ['?', 'aucun avis sur les autres expediteurs (neutral) : pas de protection'],
  ['+', 'n importe quel expediteur est accepte (pass) : aucune protection, et une usurpation facile']
]);
const MECANISMES = new Set(['all', 'include', 'a', 'mx', 'ptr', 'ip4', 'ip6', 'exists']);

export function lireSpf(texte) {
  const s = String(texte || '').trim();
  if (classerTxt(s) !== 'spf') return null;
  const termes = s.split(/\s+/).slice(1).filter(Boolean);
  const lu = { mecanismes: [], modificateurs: [], faits: [] };
  let requetes = 0;
  for (const terme of termes) {
    const mod = /^([a-z][a-z0-9_.-]*)=(.*)$/i.exec(terme);
    if (mod) {
      lu.modificateurs.push({ nom: mod[1].toLowerCase(), valeur: mod[2] });
      if (mod[1].toLowerCase() === 'redirect') requetes++;
      continue;
    }
    const m = /^([+?~-]?)([a-z0-9]+)(?::(.*?))?(\/\/?[0-9]+(?:\/\/[0-9]+)?)?$/i.exec(terme);
    const nom = m ? m[2].toLowerCase() : '';
    if (!m || !MECANISMES.has(nom)) {
      lu.faits.push({ cle: 'inconnu', texte: FAITS_SPF.inconnu, valeurs: { terme } });
      continue;
    }
    lu.mecanismes.push({ qualificatif: m[1] || '+', type: nom, valeur: (m[3] || '') + (m[4] || '') });
    if (['include', 'a', 'mx', 'ptr', 'exists'].includes(nom)) requetes++;
  }
  const tout = lu.mecanismes.find(x => x.type === 'all');
  const redirection = lu.modificateurs.find(x => x.nom === 'redirect');
  if (tout) lu.faits.push({ cle: 'finTout', texte: FAITS_SPF.finTout, valeurs: { q: tout.qualificatif, sens: SENS_ALL.get(tout.qualificatif) }, aTraduire: ['sens'] });
  else if (redirection) lu.faits.push({ cle: 'redirection', texte: FAITS_SPF.redirection, valeurs: { domaine: redirection.valeur } });
  else lu.faits.push({ cle: 'sansAll', texte: FAITS_SPF.sansAll, valeurs: {} });
  if (lu.mecanismes.some(x => x.type === 'ptr')) lu.faits.push({ cle: 'ptr', texte: FAITS_SPF.ptr, valeurs: {} });
  lu.requetes = requetes;
  lu.faits.push(requetes > 10
    ? { cle: 'tropDeRequetes', texte: FAITS_SPF.tropDeRequetes, valeurs: {} }
    : { cle: 'requetes', texte: FAITS_SPF.requetes, valeurs: { n: requetes } });
  lu.politique = tout ? tout.qualificatif + 'all' : (redirection ? 'redirect' : 'neutral');
  return lu;
}

/* ---------------------------------- DMARC --------------------------------- */
export const FAITS_DMARC = {
  politique: 'politique {p} : {sens}',
  sousDomaines: 'sous-domaines : {sp}',
  pourcentage: 'ne s applique qu a {pct} % des messages qui echouent',
  rapports: 'rapports agreges envoyes a {rua}',
  sansRapports: 'aucun rapport agrege demande (rua) : le domaine ne saura pas qui envoie en son nom',
  strict: 'alignement strict exige pour {quoi}',
  invalide: 'pas de politique p= valide : l enregistrement est ignore (RFC 7489 6.6.3)'
};
const SENS_DMARC = new Map([
  ['none', 'surveillance seulement, aucun message n est refuse'],
  ['quarantine', 'un message qui echoue est traite comme suspect (indesirables)'],
  ['reject', 'un message qui echoue est refuse']
]);

export function lireDmarc(texte) {
  if (classerTxt(texte) !== 'dmarc') return null;
  const e = etiquettesTexte(texte);
  const p = String(e.get('p') || '').toLowerCase();
  const lu = { p, sp: String(e.get('sp') || '').toLowerCase() || null, pct: e.has('pct') ? Number(e.get('pct')) : 100,
    rua: e.get('rua') || null, ruf: e.get('ruf') || null, adkim: (e.get('adkim') || 'r').toLowerCase(),
    aspf: (e.get('aspf') || 'r').toLowerCase(), faits: [] };
  if (!SENS_DMARC.has(p)) { lu.faits.push({ cle: 'invalide', texte: FAITS_DMARC.invalide, valeurs: {} }); return lu; }
  lu.faits.push({ cle: 'politique', texte: FAITS_DMARC.politique, valeurs: { p, sens: SENS_DMARC.get(p) }, aTraduire: ['sens'] });
  if (lu.sp && lu.sp !== p && SENS_DMARC.has(lu.sp)) lu.faits.push({ cle: 'sousDomaines', texte: FAITS_DMARC.sousDomaines, valeurs: { sp: lu.sp } });
  if (Number.isFinite(lu.pct) && lu.pct < 100) lu.faits.push({ cle: 'pourcentage', texte: FAITS_DMARC.pourcentage, valeurs: { pct: lu.pct } });
  lu.faits.push(lu.rua
    ? { cle: 'rapports', texte: FAITS_DMARC.rapports, valeurs: { rua: lu.rua } }
    : { cle: 'sansRapports', texte: FAITS_DMARC.sansRapports, valeurs: {} });
  const stricts = [lu.adkim === 's' ? 'DKIM' : null, lu.aspf === 's' ? 'SPF' : null].filter(Boolean);
  if (stricts.length) lu.faits.push({ cle: 'strict', texte: FAITS_DMARC.strict, valeurs: { quoi: stricts.join(', ') } });
  return lu;
}

/* --------------------------- MTA-STS, TLS-RPT, DKIM ----------------------- */
export function lireMtaSts(texte) {
  if (classerTxt(texte) !== 'mta-sts') return null;
  const e = etiquettesTexte(texte);
  return { id: e.get('id') || null };
}

export function lireTlsRpt(texte) {
  if (classerTxt(texte) !== 'tls-rpt') return null;
  const e = etiquettesTexte(texte);
  return { rua: e.get('rua') || null };
}

export function lireDkim(texte) {
  if (classerTxt(texte) !== 'dkim') return null;
  const e = etiquettesTexte(texte);
  const p = String(e.get('p') || '').replace(/\s+/g, '');
  let octets = 0;
  if (p) octets = Math.floor(p.replace(/=+$/, '').length * 3 / 4);
  return { k: (e.get('k') || 'rsa').toLowerCase(), revoquee: !p, octetsCle: octets, tests: (e.get('t') || '').includes('y') };
}

/* ----------------------------------- CAA ---------------------------------- */
export const FAITS_CAA = {
  issue: '{valeur} peut emettre des certificats pour ce domaine',
  personne: 'aucune autorite ne peut emettre de certificat (issue « ; »)',
  issuewild: '{valeur} peut emettre des certificats generiques (*.)',
  personneWild: 'aucune autorite ne peut emettre de certificat generique',
  iodef: 'les demandes refusees sont signalees a {valeur}',
  critique: 'propriete critique inconnue « {etiquette} » : une autorite qui ne la comprend pas doit refuser (RFC 8659 4.1)',
  autre: 'propriete « {etiquette} » : {valeur}'
};

export function lireCaa(donnees) {
  const m = /^([0-9]+)\s+([A-Za-z0-9]+)\s+(.*)$/.exec(String(donnees || '').trim());
  if (!m) return null;
  const drapeaux = Number(m[1]);
  const etiquette = m[2].toLowerCase();
  const valeur = texteTxt(m[3]).trim();
  const emetteur = valeur.split(';')[0].trim();
  let fait;
  if (etiquette === 'issue') fait = emetteur ? { cle: 'issue', texte: FAITS_CAA.issue, valeurs: { valeur: emetteur } } : { cle: 'personne', texte: FAITS_CAA.personne, valeurs: {} };
  else if (etiquette === 'issuewild') fait = emetteur ? { cle: 'issuewild', texte: FAITS_CAA.issuewild, valeurs: { valeur: emetteur } } : { cle: 'personneWild', texte: FAITS_CAA.personneWild, valeurs: {} };
  else if (etiquette === 'iodef') fait = { cle: 'iodef', texte: FAITS_CAA.iodef, valeurs: { valeur } };
  else if (drapeaux & 128) fait = { cle: 'critique', texte: FAITS_CAA.critique, valeurs: { etiquette } };
  else fait = { cle: 'autre', texte: FAITS_CAA.autre, valeurs: { etiquette, valeur } };
  return { drapeaux, critique: !!(drapeaux & 128), etiquette, valeur, emetteur, fait };
}

/* ----------------------------------- MX ----------------------------------- */
export function lireMx(donnees) {
  const m = /^([0-9]+)\s+(\S+)$/.exec(String(donnees || '').trim());
  if (!m) return null;
  const hote = m[2];
  return { priorite: Number(m[1]), hote, nul: hote === '.' };
}

/* ------------------------------ HTTPS et SVCB ----------------------------- */
export const FAITS_SVCB = {
  alias: 'alias : le service est decrit sous {cible}',
  h3: 'HTTP/3 annonce (ALPN h3) : le navigateur peut s y connecter d emblee',
  alpn: 'protocoles annonces : {alpn}',
  ech: 'Encrypted Client Hello publie : le nom du site peut voyager chiffre',
  indices: 'indices d adresses fournis : la connexion peut commencer avant la resolution A/AAAA',
  port: 'service sur le port {port}'
};

export function lireSvcb(donnees) {
  const morceaux = String(donnees || '').trim().split(/\s+/);
  if (morceaux.length < 2 || !/^[0-9]+$/.test(morceaux[0])) return null;
  const params = new Map();
  for (const p of morceaux.slice(2)) {
    const k = p.indexOf('=');
    params.set(k < 0 ? p : p.substring(0, k), k < 0 ? '' : p.substring(k + 1));
  }
  const lu = { priorite: Number(morceaux[0]), cible: morceaux[1], params, faits: [] };
  if (lu.priorite === 0) { lu.faits.push({ cle: 'alias', texte: FAITS_SVCB.alias, valeurs: { cible: lu.cible } }); return lu; }
  const alpn = (params.get('alpn') || '').split(',').filter(Boolean);
  if (alpn.includes('h3')) lu.faits.push({ cle: 'h3', texte: FAITS_SVCB.h3, valeurs: {} });
  if (alpn.length) lu.faits.push({ cle: 'alpn', texte: FAITS_SVCB.alpn, valeurs: { alpn: alpn.join(', ') } });
  if (params.has('ech')) lu.faits.push({ cle: 'ech', texte: FAITS_SVCB.ech, valeurs: {} });
  if (params.has('ipv4hint') || params.has('ipv6hint')) lu.faits.push({ cle: 'indices', texte: FAITS_SVCB.indices, valeurs: {} });
  if (params.has('port')) lu.faits.push({ cle: 'port', texte: FAITS_SVCB.port, valeurs: { port: params.get('port') } });
  return lu;
}

/* ----------------------------------- SOA ---------------------------------- */
export function lireSoa(donnees) {
  const m = String(donnees || '').trim().split(/\s+/);
  if (m.length !== 7) return null;
  /* RNAME : le premier point non echappe separe la boite du domaine. */
  const rname = m[1].replace(/\.$/, '');
  const k = rname.search(/(?<!\\)\./);
  const courriel = k > 0 ? rname.substring(0, k).replace(/\\\./g, '.') + '@' + rname.substring(k + 1) : rname;
  return {
    primaire: m[0], courriel, serie: Number(m[2]), rafraichissement: Number(m[3]),
    nouvelEssai: Number(m[4]), expiration: Number(m[5]), ttlNegatif: Number(m[6])
  };
}

/* -------------------------------- Le bilan --------------------------------- */
/* Les questions que pose « Bilan du domaine » : le nom, son type, et le
   prefixe a ajouter au domaine (DMARC, MTA-STS, TLS-RPT vivent sous un nom
   a eux). */
export const QUESTIONS_BILAN = [
  ['', 'A'], ['', 'AAAA'], ['', 'CNAME'], ['', 'HTTPS'], ['', 'NS'], ['', 'SOA'], ['', 'MX'],
  ['', 'TXT'], ['', 'CAA'], ['_dmarc.', 'TXT'], ['_mta-sts.', 'TXT'], ['_smtp._tls.', 'TXT']
];

export const FAITS_BILAN = {
  adresses: '{n} adresse(s) IPv4, {m} IPv6',
  sansIpv6: 'aucune adresse IPv6 (AAAA)',
  sansAdresse: 'aucune adresse : le nom ne mene a aucun serveur web',
  alias: 'alias (CNAME) vers {cible}',
  sansMx: 'aucun MX : les messages vont a l adresse du domaine lui-meme (RFC 5321 5.1), s il en a une',
  mxNul: 'MX nul : ce domaine ne recoit aucun courrier (RFC 7505)',
  mx: '{n} serveur(s) de courrier, le premier essaye : {hote}',
  sansSpf: 'aucun SPF : n importe qui peut envoyer au nom de ce domaine sans etre contredit',
  sansDmarc: 'aucun DMARC : rien ne dit aux destinataires quoi faire d un message usurpe',
  mtaSts: 'MTA-STS publie : le courrier entrant exige TLS (identifiant {id})',
  tlsRpt: 'rapports d echec TLS envoyes a {rua}',
  sansCaa: 'aucun CAA : toute autorite peut emettre un certificat pour ce domaine',
  dnssecValide: 'reponses validees par DNSSEC selon le resolveur (drapeau AD)',
  dnssecAbsent: 'reponses non validees par DNSSEC (pas de drapeau AD)',
  ns: '{n} serveur(s) de noms : {liste}',
  soa: 'zone geree par {primaire}, contact {courriel}, serie {serie}',
  inexistant: 'le domaine n existe pas (NXDOMAIN)'
};

const donneesDe = (msg, type) => (msg && Array.isArray(msg.reponses) ? msg.reponses : [])
  .filter(r => r.typeNom === type).map(r => r.donnees);

/**
 * Le bilan d un domaine a partir des reponses aux QUESTIONS_BILAN.
 * @param reponses  Map « prefixe|TYPE » -> message lu par lireMessageDns, ou null
 * @returns { sections: [{ nom, lignes: [{ etat, texte, valeurs, aTraduire }] }] }
 */
export function bilanDomaine(reponses) {
  const get = (prefixe, type) => reponses.get(prefixe + '|' + type) || null;
  const ligne = (etat, texte, valeurs = {}, aTraduire) => ({ etat, texte, valeurs, aTraduire });
  const sections = [];
  const principal = get('', 'A') || get('', 'SOA');
  if (principal && principal.rcode === 3) {
    sections.push({ nom: 'Domaine', lignes: [ligne('inoperant', FAITS_BILAN.inexistant)] });
    return { sections, inexistant: true };
  }

  /* Le web : adresses, alias, HTTPS. */
  const web = [];
  const a = donneesDe(get('', 'A'), 'A');
  const aaaa = donneesDe(get('', 'AAAA'), 'AAAA');
  const cname = donneesDe(get('', 'CNAME'), 'CNAME').concat(donneesDe(get('', 'A'), 'CNAME'));
  if (cname.length) web.push(ligne('info', FAITS_BILAN.alias, { cible: cname[0] }));
  if (!a.length && !aaaa.length) web.push(ligne('absent', FAITS_BILAN.sansAdresse));
  else {
    web.push(ligne('present', FAITS_BILAN.adresses, { n: a.length, m: aaaa.length }));
    if (!aaaa.length) web.push(ligne('partiel', FAITS_BILAN.sansIpv6));
  }
  for (const d of donneesDe(get('', 'HTTPS'), 'HTTPS')) {
    const lu = lireSvcb(d);
    if (lu) for (const f of lu.faits) web.push(ligne('present', f.texte, f.valeurs));
  }
  sections.push({ nom: 'Web', lignes: web });

  /* Le courrier : MX, SPF, DMARC, MTA-STS, TLS-RPT. */
  const courrier = [];
  const mx = donneesDe(get('', 'MX'), 'MX').map(lireMx).filter(Boolean).sort((x, y) => x.priorite - y.priorite);
  if (mx.some(m => m.nul)) courrier.push(ligne('info', FAITS_BILAN.mxNul));
  else if (!mx.length) courrier.push(ligne('info', FAITS_BILAN.sansMx));
  else courrier.push(ligne('present', FAITS_BILAN.mx, { n: mx.length, hote: mx[0].hote }));
  const txt = donneesDe(get('', 'TXT'), 'TXT').map(texteTxt);
  const spf = txt.filter(x => classerTxt(x) === 'spf');
  if (!spf.length) courrier.push(ligne('absent', FAITS_BILAN.sansSpf));
  else if (spf.length > 1) courrier.push(ligne('inoperant', FAITS_SPF.plusieurs, { n: spf.length }));
  else {
    const lu = lireSpf(spf[0]);
    for (const f of lu.faits) {
      const etat = f.cle === 'tropDeRequetes' || f.cle === 'inconnu' ? 'inoperant'
        : f.cle === 'finTout' ? (lu.politique === '-all' ? 'present' : lu.politique === '~all' ? 'partiel' : 'inoperant')
          : f.cle === 'sansAll' || f.cle === 'ptr' ? 'partiel' : 'info';
      courrier.push(ligne(etat, f.texte, f.valeurs, f.aTraduire));
    }
  }
  const dmarc = donneesDe(get('_dmarc.', 'TXT'), 'TXT').map(texteTxt).map(lireDmarc).filter(Boolean);
  if (!dmarc.length) courrier.push(ligne('absent', FAITS_BILAN.sansDmarc));
  else {
    for (const f of dmarc[0].faits) {
      const etat = f.cle === 'invalide' ? 'inoperant' : f.cle === 'sansRapports' ? 'partiel'
        : f.cle === 'politique' ? (dmarc[0].p === 'none' ? 'partiel' : 'present') : 'info';
      courrier.push(ligne(etat, f.texte, f.valeurs, f.aTraduire));
    }
  }
  const sts = donneesDe(get('_mta-sts.', 'TXT'), 'TXT').map(texteTxt).map(lireMtaSts).filter(Boolean);
  if (sts.length) courrier.push(ligne('present', FAITS_BILAN.mtaSts, { id: sts[0].id || '?' }));
  const rpt = donneesDe(get('_smtp._tls.', 'TXT'), 'TXT').map(texteTxt).map(lireTlsRpt).filter(Boolean);
  if (rpt.length && rpt[0].rua) courrier.push(ligne('present', FAITS_BILAN.tlsRpt, { rua: rpt[0].rua }));
  sections.push({ nom: 'Courrier', lignes: courrier });

  /* La securite : CAA, DNSSEC. */
  const securite = [];
  const caa = donneesDe(get('', 'CAA'), 'CAA').map(lireCaa).filter(Boolean);
  if (!caa.length) securite.push(ligne('partiel', FAITS_BILAN.sansCaa));
  for (const c of caa) securite.push(ligne(c.fait.cle === 'critique' ? 'partiel' : 'present', c.fait.texte, c.fait.valeurs));
  if (principal) securite.push(principal.drapeaux && principal.drapeaux.AD
    ? ligne('present', FAITS_BILAN.dnssecValide) : ligne('info', FAITS_BILAN.dnssecAbsent));
  sections.push({ nom: 'Securite', lignes: securite });

  /* La zone : NS, SOA. */
  const zone = [];
  const ns = donneesDe(get('', 'NS'), 'NS');
  if (ns.length) zone.push(ligne('info', FAITS_BILAN.ns, { n: ns.length, liste: ns.join(', ') }));
  const soa = donneesDe(get('', 'SOA'), 'SOA').map(lireSoa).filter(Boolean);
  if (soa.length) zone.push(ligne('info', FAITS_BILAN.soa, { primaire: soa[0].primaire, courriel: soa[0].courriel, serie: soa[0].serie }));
  if (zone.length) sections.push({ nom: 'Zone', lignes: zone });
  return { sections, inexistant: false };
}

/* Tous les gabarits et sens que ce module peut produire : le controle de
   traduction les verifie un a un. */
export const TEXTES_DNS_LECTURES = [
  ...Object.values(FAITS_SPF), ...SENS_ALL.values(), ...Object.values(FAITS_DMARC), ...SENS_DMARC.values(),
  ...Object.values(FAITS_CAA), ...Object.values(FAITS_SVCB), ...Object.values(FAITS_BILAN),
  'Domaine', 'Web', 'Courrier', 'Securite', 'Zone'
];
