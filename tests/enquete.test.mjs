/* Enqueter sur un site — SWIFT (by D4RK)
 *
 *   node tests/enquete.test.mjs
 *
 * Ce que la 6.2 ajoute, verifie contre les textes qui le definissent, puis
 * par le chemin reel du code — du clic dans le panneau jusqu au repartiteur
 * de commandes du noyau. Seul fetch est imite, pour observer ce qui partirait
 * sans rien envoyer.
 *
 *   1. les flux : Server-Sent Events selon la norme HTML du WHATWG (fins de
 *      ligne, BOM, commentaires, id, retry, evenement inacheve), coupes en
 *      morceaux au hasard ; lignes JSON ;
 *   2. DNS sur HTTPS : la question ecrite octet pour octet comme l exemple
 *      de la RFC 8484 (4.1.1), EDNS, bit DO, rembourrage a 128 octets
 *      (RFC 8467), noms PTR ; les lectures en clair — SPF (RFC 7208), DMARC
 *      (RFC 7489), CAA (RFC 8659), MX nul (RFC 7505), HTTPS (RFC 9460),
 *      SOA — sur une reponse fabriquee par dnspython, et le bilan d un
 *      domaine ;
 *   3. RDAP : le serveur choisi dans une amorce de l IANA (RFC 9224), une
 *      reponse lue selon la RFC 9083, jCard comprise (RFC 7095) ;
 *   4. le choix d un outil pour un texte colle ;
 *   5. le schema GraphQL lu par introspection, et la requete qu il ecrit ;
 *   6. les variables et les collections, Postman compris ;
 *   7. le bilan d un site : TLS, certificat (RFC 6125 pour les noms),
 *      redirections, protections, cookies, HTTP/3, security.txt ;
 *   8. les commandes du noyau — verifierSite, dnsDoh, rdap — par le vrai
 *      repartiteur ;
 *   9. chaque panneau mene au clic, et le texte de travail qui propose son
 *      outil ;
 *  10. tout cela en anglais, sans un mot de francais.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { installerTout, installerPage, egal, memeListe, verifier, leve, bilan, dejaAnglais } from './harnais.mjs';

installerTout();
const racine = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
installerPage(racine);

const { setLang, surManque, te } = await import('../ui/lib/i18n.js');
const { EN } = await import('../ui/lib/dict-en.js');
const { state } = await import('../ui/app.js');
const { creerLecteurSse, creerLecteurLignes, formeDuFlux } = await import('../ui/lib/flux-sse.js');
const { construireRequeteDns, codeTypeDns, nomPourPtr, TYPES_DNS } = await import('../ui/lib/dns-requete.js');
const { lireMessageDns } = await import('../ui/lib/dns-message.js');
const L = await import('../ui/lib/dns-lectures.js');
const R = await import('../ui/lib/rdap.js');
const { suggererOutils, RAISONS_AIGUILLAGE } = await import('../ui/lib/aiguillage.js');
const G = await import('../ui/lib/graphql-schema.js');
const { operationsGraphql } = await import('../ui/lib/graphql-http.js');
const C = await import('../ui/lib/collection-requetes.js');
const V = await import('../ui/lib/verification-site.js');
const { base64VersOctets, octetsVersBase64 } = await import('../ui/lib/bytes.js');
const { startRpc } = await import('../background/api/rpc.js');
const { config } = await import('../background/core/config.js');
const { store } = await import('../background/core/store.js');
const { oublierAmorces } = await import('../background/api/enquete.js');

await config.set({ lang: 'fr' });
setLang('fr');

/* --------------------------- Outillage commun ----------------------------- */
const texte = n => (n ? (n.textContent || '') + ' ' + (n.children || []).map(texte).join(' ') : '');
const plat = n => texte(n).replace(/\s+/g, ' ').trim();
const cherche = (n, pred) => (n && pred(n) ? n : ((n && n.children) || []).map(c => cherche(c, pred)).find(Boolean) || null);
const tous = (n, pred, sortie = []) => {
  if (!n) return sortie;
  if (pred(n)) sortie.push(n);
  for (const c of n.children || []) tous(c, pred, sortie);
  return sortie;
};
const champ = (n, nom) => cherche(n, x => x.dataset && x.dataset.champ === nom);
const bouton = (n, libelle) => cherche(n, x => x.nodeName === 'BUTTON' && plat(x) === libelle);
const attendre = ms => new Promise(r => setTimeout(r, ms));
const proto = Object.getPrototypeOf(document.createElement('div'));
const ecouteurDuHarnais = proto.addEventListener;
function proprietes(n) {
  if (!n) return;
  if (n.nodeName === 'INPUT') {
    if (n.value === undefined) n.value = n.getAttribute('value') || '';
    if (n.checked === undefined) n.checked = n.getAttribute('checked') != null;
  } else if (n.nodeName === 'SELECT' && n.value === undefined) {
    const options = tous(n, x => x.nodeName === 'OPTION');
    const choisie = options.find(o => o.getAttribute('selected') != null) || options[0];
    n.value = choisie ? choisie.getAttribute('value') : '';
  } else if (n.nodeName === 'TEXTAREA' && n.value === undefined) n.value = '';
  for (const c of n.children || []) proprietes(c);
}
function rendre(fabriquer) {
  proto.addEventListener = function (type, rappel) { (this._ecouteurs ||= {})[type] = rappel; };
  try {
    const hote = document.createElement('div');
    hote.appendChild(fabriquer());
    proprietes(hote);
    return hote;
  } finally { proto.addEventListener = ecouteurDuHarnais; }
}
function cliquer(vue, libelle) {
  const b = bouton(vue, libelle);
  if (!b || !b._ecouteurs || !b._ecouteurs.click) {
    verifier('le bouton « ' + libelle + ' » est la', false, plat(vue).substring(0, 300));
    return undefined;
  }
  return b._ecouteurs.click();
}
const changer = (vue, nom, valeur) => {
  const c = champ(vue, nom);
  if (!c) { verifier('le champ ' + nom + ' est la', false); return; }
  if (c.type === 'checkbox') c.checked = !!valeur; else c.value = valeur;
  if (c._ecouteurs && c._ecouteurs.change) c._ecouteurs.change();
};
const dernierToast = () => { const n = document.getElementById('toast'); return n ? String(n.textContent || '') : ''; };

/* Le vrai repartiteur du noyau, comme depuis une page de l extension. */
startRpc();
const expediteur = { url: 'moz-extension://test/ui/console.html', id: 'swift@test' };
const commandes = [];
globalThis.browser.runtime.sendMessage = async message => {
  if (message && message.cmd) commandes.push(message.cmd);
  const reponses = globalThis.browser.runtime.onMessage.emettre(message, expediteur).filter(r => r !== undefined);
  return reponses.length ? reponses[0] : undefined;
};
const compter = nom => commandes.filter(c => c === nom).length;

/* fetch observe : chaque appel est garde, la reponse vient du test. */
const appels = [];
let repondre = () => new Response('', { status: 204 });
globalThis.fetch = async (adresse, init = {}) => {
  appels.push({ url: String(adresse), init });
  return repondre(String(adresse), init);
};

/* ====================== 1. Flux : SSE et lignes JSON ====================== */
{
  /* Les exemples de la norme HTML (WHATWG, « Server-sent events »). */
  const lire = morceaux => {
    const l = creerLecteurSse();
    const sortie = [];
    for (const m of morceaux) sortie.push(...l.pousser(m));
    return { sortie, fin: l.finir(), etat: l.etat };
  };
  const a = lire(['data: YHOO\ndata: +2\ndata: 10\n\n']);
  memeListe('WHATWG : trois lignes data forment un evenement, joint par LF', a.sortie.map(e => [e.type, e.data]), [['message', 'YHOO\n+2\n10']]);
  const b = lire([': test stream\n\ndata: first event\nid: 1\n\ndata:second event\nid\n\ndata:  third event\n']);
  memeListe('WHATWG : commentaire, id, id vide, espace retiree une fois', b.sortie.map(e => [e.data, e.id]),
    [['first event', '1'], ['second event', ''], [' third event', '']].filter((_, i) => i < 2));
  egal('WHATWG : le dernier evenement, sans ligne vide, n est pas distribue', b.fin.inacheve, true);
  const c = lire(['data\n\ndata\ndata\n\ndata:']);
  memeListe('WHATWG : « data » sans deux-points, puis deux : "" puis "\\n"', c.sortie.map(e => e.data), ['', '\n']);
  const d = lire(['data:test\n\ndata: test\n\n']);
  memeListe('WHATWG : « data:test » et « data: test » donnent la meme chose', d.sortie.map(e => e.data), ['test', 'test']);
  const e = lire(['﻿event: add\r\ndata: 73857293\r\n\r\nevent: remove\rdata: 2153\r\rretry: 3000\nretry: 30s\nid: a\u0000b\nfoo: bar\ndata: x\n\n']);
  memeListe('BOM retire, CR LF et CR seul, types d evenement', e.sortie.map(x => [x.type, x.data]), [['add', '73857293'], ['remove', '2153'], ['message', 'x']]);
  egal('retry : seulement des chiffres ; un id avec NUL est ignore ; un champ inconnu compte', [e.etat.retry, JSON.stringify(e.sortie[2].id), e.etat.champsIgnores].join(' '), '3000 "" 1');
  egal('un evenement sans donnees n est pas distribue, et son type est oublie', lire(['event: vide\n\ndata: y\n\n']).sortie.map(x => x.type).join(), 'message');

  /* Le meme flux, coupe en morceaux au hasard — y compris entre CR et LF. */
  const flux = 'retry: 5\r\n: c\r\nevent: a\r\ndata: 1\r\ndata: 2\r\n\r\nid: 7\ndata: {"k": "v"}\n\ndata: fin\r\r';
  const reference = JSON.stringify(lire([flux]).sortie);
  let graine = 6202;
  const hasard = n => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine % n; };
  let pareils = 0;
  for (let k = 0; k < 500; k++) {
    const morceaux = [];
    let i = 0;
    while (i < flux.length) { const n = 1 + hasard(6); morceaux.push(flux.substring(i, i + n)); i += n; }
    if (JSON.stringify(lire(morceaux).sortie) === reference) pareils++;
  }
  egal('500 decoupages au hasard rendent les memes evenements', pareils, 500);

  const lignes = creerLecteurLignes();
  const lues = [...lignes.pousser('{"a":1}\n{"b"'), ...lignes.pousser(':2}\r\n\nnon json\n'), ...lignes.pousser('{"c":3}'), ...lignes.finir()];
  memeListe('lignes JSON : coupees, CR retire, ligne vide sautee, la derniere sans saut lue a la fin',
    lues.map(l => (l.json !== undefined ? JSON.stringify(l.json) : 'erreur')), ['{"a":1}', '{"b":2}', 'erreur', '{"c":3}']);
  memeListe('la forme du flux d apres son type', ['text/event-stream; charset=utf-8', 'application/x-ndjson', 'application/jsonl', 'text/plain', ''].map(formeDuFlux),
    ['sse', 'lignes', 'lignes', 'texte', 'texte']);
}

/* ============================ 2. DNS sur HTTPS ============================ */
{
  const b64url = o => Buffer.from(o).toString('base64url');
  /* RFC 8484 4.1.1 : « www.example.com », type A, identifiant 0, RD. */
  egal('RFC 8484 4.1.1 : la question, octet pour octet', b64url(construireRequeteDns('www.example.com', 1, { edns: false })),
    'AAABAAABAAAAAAAAA3d3dwdleGFtcGxlA2NvbQAAAQAB');
  const tailles = new Set();
  for (const nom of ['a.fr', 'example.com', 'un-nom-bien-plus-long.sous-domaine.example.org', 'x'.repeat(63) + '.' + 'y'.repeat(63) + '.com']) {
    const q = construireRequeteDns(nom, 16, { dnssec: true });
    tailles.add(q.length % 128);
    const m = lireMessageDns(q);
    verifier('question relue : ' + nom.substring(0, 20), m.questions[0].nom === nom + '.' && m.questions[0].typeNom === 'TXT' && m.opt.dnssecOk
      && m.opt.tailleUdp === 1232 && m.id === 0 && m.drapeaux.RD && m.faits.some(f => /rembourre/.test(f.texte)));
  }
  memeListe('RFC 8467 : chaque question rembourree a un multiple de 128 octets', [...tailles], [0]);
  egal('sans DNSSEC, pas de bit DO', lireMessageDns(construireRequeteDns('example.com', 1)).opt.dnssecOk, false);
  egal('RFC 1035 3.5 : le nom PTR d une adresse IPv4', nomPourPtr('192.0.2.1'), '1.2.0.192.in-addr.arpa');
  egal('RFC 3596 2.5 : le nom PTR d une adresse IPv6', nomPourPtr('2001:db8::1'), '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa');
  egal('pas de nom PTR pour un nom', nomPourPtr('example.com'), null);
  memeListe('types par nom ou par numero', ['mx', 'HTTPS', 'TYPE65', '257', 'ABC', '70000'].map(codeTypeDns), [15, 65, 65, 257, null, null]);
  verifier('les types proposes sont tous connus', TYPES_DNS.every(([n, c]) => codeTypeDns(n) === c));
  leve('une etiquette de 64 octets est refusee', () => construireRequeteDns('x'.repeat(64) + '.com', 1));
  leve('une etiquette vide est refusee', () => construireRequeteDns('a..com', 1));
  leve('un type hors de 1 a 65535 est refuse', () => construireRequeteDns('a.com', 0));

  /* Une reponse fabriquee par dnspython : HTTPS, A, AAAA, MX, TXT, SRV, CAA, DS. */
  const v = JSON.parse(fs.readFileSync(path.join(racine, 'tests', 'vecteurs-dns.json'), 'utf8'));
  const m = lireMessageDns(Uint8Array.from(Buffer.from(v.reponse, 'base64url')));
  const de = type => m.reponses.filter(r => r.typeNom === type).map(r => r.donnees);
  const https = L.lireSvcb(de('HTTPS')[0]);
  memeListe('RFC 9460 : HTTP/3, protocoles, ECH, indices, port lus dans la reponse dnspython', https.faits.map(f => f.cle), ['h3', 'alpn', 'ech', 'indices', 'port']);
  egal('RFC 9460 : les protocoles dans l ordre annonce', https.faits[1].valeurs.alpn, 'h3, h2');
  egal('RFC 9460 : un enregistrement de priorite 0 est un alias', L.lireSvcb('0 foosvc.example.').faits[0].cle, 'alias');
  const txt = L.texteTxt(de('TXT')[0]);
  egal('RFC 7208 3.3 : les chaines d un TXT se lisent bout a bout, echappements compris', txt, 'v=spf1 -allsecond "texte"');
  egal('…et ce SPF, ainsi recolle, contient un terme inconnu : permerror', L.lireSpf(txt).faits.some(f => f.cle === 'inconnu'), true);
  egal('RFC 8659 : l autorite permise', L.lireCaa(de('CAA')[0]).fait.valeurs.valeur, 'letsencrypt.org');
  memeListe('MX : priorite et hote', L.lireMx(de('MX')[0]), { priorite: 10, hote: 'mail.example.com.', nul: false });
  const soa = m.autorite.find(r => r.typeNom === 'SOA');
  egal('SOA : la boite du responsable devient une adresse', soa && L.lireSoa(soa.donnees).courriel, 'hostmaster@example.com');
  egal('SOA : un point echappe reste dans la boite (RFC 1035 8)', L.lireSoa('ns.example. john\\.doe.example.com. 1 2 3 4 5').courriel, 'john.doe@example.com');

  /* SPF : des exemples de la RFC 7208 (annexe A). */
  const spf = L.lireSpf('v=spf1 +mx a:colo.example.com/28 -all');
  egal('SPF : -all refuse les autres expediteurs', spf.politique + ' ' + spf.faits[0].valeurs.sens, '-all tout autre expediteur est refuse (fail)');
  memeListe('SPF : mecanismes, qualificatifs et masques', spf.mecanismes.map(x => x.qualificatif + x.type + (x.valeur ? ':' + x.valeur : '')), ['+mx', '+a:colo.example.com/28', '-all']);
  egal('SPF : deux mecanismes demandent une requete DNS', spf.requetes, 2);
  egal('SPF : ~all marque comme suspect', L.lireSpf('v=spf1 include:_spf.example.com ~all').politique, '~all');
  egal('SPF : redirect sans all', L.lireSpf('v=spf1 redirect=_spf.example.com').faits[0].cle, 'redirection');
  egal('SPF : sans all ni redirect, neutre (RFC 7208 4.7)', L.lireSpf('v=spf1 mx').faits[0].cle, 'sansAll');
  egal('SPF : plus de dix requetes, permerror (RFC 7208 4.6.4)',
    L.lireSpf('v=spf1 ' + Array.from({ length: 11 }, (_, i) => 'include:s' + i + '.example').join(' ') + ' -all').faits.some(f => f.cle === 'tropDeRequetes'), true);
  egal('SPF : ptr deconseille (RFC 7208 5.5)', L.lireSpf('v=spf1 ptr -all').faits.some(f => f.cle === 'ptr'), true);
  egal('SPF : ip6 avec masque', L.lireSpf('v=spf1 ip6:2001:db8::/32 -all').mecanismes[0].valeur, '2001:db8::/32');
  egal('un texte qui n est pas un SPF', L.lireSpf('v=spf10 -all'), null);

  /* DMARC : d apres les exemples de la RFC 7489 (annexe B). */
  const dm = L.lireDmarc('v=DMARC1; p=none; rua=mailto:dmarc-feedback@example.com');
  memeListe('DMARC p=none : surveillance, rapports', dm.faits.map(f => f.cle), ['politique', 'rapports']);
  const dq = L.lireDmarc('v=DMARC1; p=quarantine; rua=mailto:dmarc-feedback@example.com; pct=25; sp=reject; adkim=s');
  memeListe('DMARC quarantine, pct, sp, alignement strict', dq.faits.map(f => f.cle), ['politique', 'sousDomaines', 'pourcentage', 'rapports', 'strict']);
  egal('DMARC sans p= valide : ignore (RFC 7489 6.6.3)', L.lireDmarc('v=DMARC1; p=hold').faits[0].cle, 'invalide');
  egal('DMARC sans rua : le domaine ne saura rien', L.lireDmarc('v=DMARC1; p=reject').faits.some(f => f.cle === 'sansRapports'), true);

  /* CAA : les exemples de la RFC 8659 (4). */
  egal('CAA issue avec parametre', L.lireCaa('0 issue "ca.example.net; account=230123"').fait.valeurs.valeur, 'ca.example.net');
  egal('CAA issue « ; » : personne', L.lireCaa('0 issue ";"').fait.cle, 'personne');
  egal('CAA iodef', L.lireCaa('0 iodef "mailto:security@example.com"').fait.valeurs.valeur, 'mailto:security@example.com');
  egal('CAA critique inconnue (drapeau 128)', L.lireCaa('128 tbs "Unknown"').fait.cle, 'critique');
  egal('RFC 7505 : MX nul', L.lireMx('0 .').nul, true);
  memeListe('classer les TXT', ['v=spf1 -all', 'v=DMARC1; p=none', 'v=STSv1; id=2026', 'v=TLSRPTv1; rua=mailto:t@example.com', 'v=DKIM1; k=rsa; p=MIIB',
    'v=BIMI1; l=https://x', 'google-site-verification=abc', 'bonjour'].map(L.classerTxt),
  ['spf', 'dmarc', 'mta-sts', 'tls-rpt', 'dkim', 'bimi', 'verification', 'autre']);
  egal('DKIM : p= vide, cle revoquee (RFC 6376 3.6.1)', L.lireDkim('v=DKIM1; k=rsa; p=').revoquee, true);

  /* Le bilan d un domaine. */
  const rep = (type, ...donnees) => ({ rcode: 0, drapeaux: { AD: true }, reponses: donnees.map(d => ({ typeNom: type, donnees: d })) });
  const complet = new Map([
    ['|A', rep('A', '192.0.2.1')], ['|AAAA', rep('AAAA', '2001:db8::1')], ['|HTTPS', rep('HTTPS', '1 . alpn=h3,h2 ech=AEX+DQ')],
    ['|MX', rep('MX', '20 mx2.example.com.', '10 mx1.example.com.')], ['|TXT', rep('TXT', '"v=spf1 mx -all"', '"google-site-verification=x"')],
    ['_dmarc.|TXT', rep('TXT', '"v=DMARC1; p=reject; rua=mailto:d@example.com"')], ['_mta-sts.|TXT', rep('TXT', '"v=STSv1; id=20260101"')],
    ['|CAA', rep('CAA', '0 issue "letsencrypt.org"')], ['|NS', rep('NS', 'a.iana-servers.net.', 'b.iana-servers.net.')],
    ['|SOA', rep('SOA', 'ns.example. hostmaster.example.com. 7 1 1 1 1')]
  ]);
  const b = L.bilanDomaine(complet);
  memeListe('bilan : web, courrier, securite, zone', b.sections.map(s => s.nom), ['Web', 'Courrier', 'Securite', 'Zone']);
  const lignesDe = nom => b.sections.find(s => s.nom === nom).lignes;
  egal('bilan : le premier MX essaye est celui de plus petite priorite', lignesDe('Courrier')[0].valeurs.hote, 'mx1.example.com.');
  verifier('bilan : SPF -all, DMARC reject, MTA-STS presents', ['finTout', 'politique', 'mtaSts'].every(c => lignesDe('Courrier').some(l => l.etat === 'present'
    && (l.texte === L.FAITS_SPF[c] || l.texte === L.FAITS_DMARC[c] || l.texte === L.FAITS_BILAN[c]))));
  verifier('bilan : HTTP/3 et ECH lus dans HTTPS', lignesDe('Web').some(l => l.texte === L.FAITS_SVCB.h3) && lignesDe('Web').some(l => l.texte === L.FAITS_SVCB.ech));
  verifier('bilan : DNSSEC valide d apres le drapeau AD', lignesDe('Securite').some(l => l.texte === L.FAITS_BILAN.dnssecValide));
  const nu = L.bilanDomaine(new Map([['|A', rep('A', '192.0.2.1')], ['|TXT', rep('TXT', '"v=spf1 -all"', '"v=spf1 ~all"')]]));
  const courrierNu = nu.sections.find(s => s.nom === 'Courrier').lignes;
  verifier('bilan : deux SPF, permerror ; pas de DMARC, dit', courrierNu.some(l => l.etat === 'inoperant' && l.texte === L.FAITS_SPF.plusieurs)
    && courrierNu.some(l => l.etat === 'absent' && l.texte === L.FAITS_BILAN.sansDmarc));
  verifier('bilan : pas de CAA, pas d IPv6, dits', nu.sections.find(s => s.nom === 'Securite').lignes.some(l => l.texte === L.FAITS_BILAN.sansCaa)
    && nu.sections.find(s => s.nom === 'Web').lignes.some(l => l.texte === L.FAITS_BILAN.sansIpv6));
  egal('bilan : NXDOMAIN, et rien d autre', L.bilanDomaine(new Map([['|A', { rcode: 3, drapeaux: {}, reponses: [] }]])).inexistant, true);
}

/* ================================= 3. RDAP ================================ */
{
  memeListe('requete : domaine depuis une adresse', R.requeteRdap('https://Www.Example.COM/chemin?x=1'), { type: 'domain', valeur: 'www.example.com', amorce: 'dns', chemin: 'domain/www.example.com' });
  memeListe('requete : numero AS', R.requeteRdap('as15169'), { type: 'autnum', valeur: '15169', amorce: 'asn', chemin: 'autnum/15169' });
  egal('requete : IPv6 entre crochets', R.requeteRdap('[2001:db8::1]').chemin, 'ip/2001:db8::1');
  egal('requete : deux mots, rien', R.requeteRdap('deux mots'), null);
  /* RFC 9224 : la plus longue etiquette, le bloc le plus precis, https. */
  const dns = { services: [[['com', 'net'], ['https://rdap.verisign.com/com/v1/']], [['uk'], ['https://rdap.nominet.uk/uk/']],
    [['co.uk'], ['http://plain.example/', 'https://rdap.example/co.uk/']]] };
  egal('RFC 9224 : le domaine de premier niveau', R.choisirServeurRdap(dns, R.requeteRdap('a.example.com')), 'https://rdap.verisign.com/com/v1/');
  egal('RFC 9224 : l entree la plus longue l emporte, en https', R.choisirServeurRdap(dns, R.requeteRdap('a.b.co.uk')), 'https://rdap.example/co.uk/');
  egal('RFC 9224 : rien pour un domaine inconnu', R.choisirServeurRdap(dns, R.requeteRdap('a.example.invalid')), null);
  const ipv4 = { services: [[['8.0.0.0/8'], ['https://rdap.large.example/']], [['8.8.0.0/16'], ['https://rdap.precis.example/']]] };
  egal('RFC 9224 : le bloc le plus precis', R.choisirServeurRdap(ipv4, R.requeteRdap('8.8.8.8')), 'https://rdap.precis.example/');
  const ipv6 = { services: [[['2001:db8::/32'], ['https://rdap.v6.example/']]] };
  egal('RFC 9224 : IPv6', R.choisirServeurRdap(ipv6, R.requeteRdap('2001:db8::1')), 'https://rdap.v6.example/');
  const asn = { services: [[['1-1876', '1902-2042'], ['https://rdap.arin.example/']], [['15000-16000'], ['https://rdap.autre.example/']]] };
  egal('RFC 9224 : la plage AS', R.choisirServeurRdap(asn, R.requeteRdap('AS15169')), 'https://rdap.autre.example/');

  /* Une reponse de la forme de l exemple de la RFC 9083 (5.3). */
  const domaine = {
    objectClassName: 'domain', handle: 'XXXX', ldhName: 'xn--fo-5ja.example', unicodeName: 'fóo.example',
    status: ['locked', 'transfer prohibited', 'client transfer prohibited', 'constructor'],
    events: [{ eventAction: 'registration', eventDate: '1990-12-31T23:59:59Z' }, { eventAction: 'last changed', eventDate: '1991-12-31T23:59:59Z', eventActor: 'joe@example.com' },
      { eventAction: 'expiration', eventDate: '2099-01-01T00:00:00Z' }],
    nameservers: [{ objectClassName: 'nameserver', ldhName: 'NS1.EXAMPLE.COM', ipAddresses: { v4: ['192.0.2.1'], v6: ['2001:db8::123'] } }, { objectClassName: 'nameserver', ldhName: 'ns2.example.com' }],
    secureDNS: { zoneSigned: true, delegationSigned: true, maxSigLife: 604800, dsData: [{ keyTag: 12345, algorithm: 3, digestType: 1, digest: '49FD46E6C4B45C55D4AC' }] },
    entities: [
      { objectClassName: 'entity', handle: 'XXXX', roles: ['registrar'], publicIds: [{ type: 'IANA Registrar ID', identifier: '1' }],
        vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'Joe User'], ['org', { type: 'work' }, 'text', 'Example']]],
        entities: [{ objectClassName: 'entity', roles: ['abuse'], vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'Abuse'],
          ['email', { type: 'work' }, 'text', 'abuse@example.com'], ['tel', { type: ['work', 'voice'] }, 'uri', 'tel:+1-555-555-1234;ext=102']]] }] },
      { objectClassName: 'entity', roles: ['registrant'], vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', ''], ['org', {}, 'text', 'Societe'],
        ['adr', { cc: 'FR' }, 'text', ['', '', '', '', '', '', '']]]] }
    ],
    links: [{ value: 'https://example.net/domain/xn--fo-5ja.example', rel: 'self', href: 'https://example.net/domain/xn--fo-5ja.example', type: 'application/rdap+json' },
      { rel: 'related', href: 'https://rdap.registrar.example/domain/xn--fo-5ja.example', type: 'application/rdap+json' }],
    notices: [{ title: 'Terms of Use', description: ['…'] }]
  };
  const lu = R.lireRdap(domaine);
  egal('RFC 9083 : nom, nom unicode, identifiant', [lu.nom, lu.nomUnicode, lu.poignee].join(' '), 'xn--fo-5ja.example fóo.example XXXX');
  egal('RFC 9083 : les dates par evenement', [R.dateEvenement(lu, 'registration'), R.dateEvenement(lu, 'expiration')].join(' '), '1990-12-31T23:59:59Z 2099-01-01T00:00:00Z');
  egal('RFC 9083 : les statuts, en minuscules, « constructor » compris mais sans sens herite',
    lu.statuts.map(s => (R.STATUTS_RDAP.has(s) ? 'connu' : 'inconnu')).join(','), 'connu,connu,connu,inconnu');
  const registrar = R.entiteDeRole(lu, 'registrar');
  egal('RFC 7095 : le bureau d enregistrement lu dans sa jCard', registrar.nom + ' / ' + registrar.organisation + ' / ' + registrar.identifiants[0], 'Joe User / Example / IANA Registrar ID 1');
  const abus = R.entiteDeRole(lu, 'abuse');
  egal('RFC 7095 : le contact abus, entite imbriquee, courriel et telephone', abus.courriel + ' ' + abus.telephone, 'abuse@example.com +1-555-555-1234;ext=102');
  egal('RFC 7095 : le pays d une adresse (parametre cc)', R.entiteDeRole(lu, 'registrant').pays, 'FR');
  memeListe('serveurs de noms et leurs adresses', lu.serveursDeNoms, [{ nom: 'ns1.example.com', adresses: ['192.0.2.1', '2001:db8::123'] }, { nom: 'ns2.example.com', adresses: [] }]);
  memeListe('DNSSEC : delegation signee, un DS', lu.dnssec, { signe: true, ds: 1, cles: 0 });
  egal('le lien vers le bureau d enregistrement (registre mince)', R.liensRdapLies(lu).map(l => l.href).join(), 'https://rdap.registrar.example/domain/xn--fo-5ja.example');
  egal('les avis', lu.avis.join(), 'Terms of Use');
  /* RFC 9083 5.4 et 5.5 : un bloc d adresses, un systeme autonome. */
  const ip = R.lireRdap({ objectClassName: 'ip network', handle: 'XXXX-RIR', startAddress: '2001:db8::', endAddress: '2001:db8:0:ffff:ffff:ffff:ffff:ffff',
    ipVersion: 'v6', name: 'NET-RTR-1', type: 'DIRECT ALLOCATION', country: 'AU', parentHandle: 'YYYY-RIR', cidr0_cidrs: [{ v6prefix: '2001:db8::', length: 48 }] });
  egal('RFC 9083 5.4 : la plage, le type, le parent, le pays, le prefixe (cidr0)', [ip.plage.debut, ip.plage.type, ip.plage.parent, ip.pays, ip.plage.cidrs[0]].join(' | '),
    '2001:db8:: | DIRECT ALLOCATION | YYYY-RIR | AU | 2001:db8::/48');
  const as = R.lireRdap({ objectClassName: 'autnum', handle: 'XXXX-RIR', startAutnum: 65536, endAutnum: 65541, name: 'AS-RTR-1', type: 'DIRECT ALLOCATION', country: 'AU' });
  memeListe('RFC 9083 5.5 : la plage de numeros AS', as.asn, { debut: 65536, fin: 65541, type: 'DIRECT ALLOCATION' });
  egal('RFC 9083 6 : une reponse d erreur', R.lireRdap({ errorCode: 418, title: 'Your Beverage Choice is Not Available', description: ['I know coffee'] }).erreur.titre, 'Your Beverage Choice is Not Available');
  leve('une reponse qui n est pas un objet est refusee', () => R.lireRdap([1, 2]));
}

/* ======================= 4. Quel outil pour ce texte ====================== */
{
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const cas = [
    [jwt, 'jwt'], ['Bearer ' + jwt, 'jwt'], ['curl -X POST https://api.example.com/v1 -d a=1', 'requete'],
    ['GET /api HTTP/1.1\nHost: example.com', 'requete'], ['HTTP/1.1 301 Moved Permanently\nLocation: /x', 'reponse'],
    ['* Trying\n< HTTP/2 200\n< server: x', 'reponse'], ['wss://echo.example/socket', 'websocket'], ['https://api.example.com/graphql', 'graphql'],
    ['https://example.com/page', 'verifier'], ['example.com', 'verifier'], ['xn--bcher-kva.example', 'verifier'], ['8.8.8.8', 'adresse'],
    ['2001:db8::1', 'adresse'], ['AS15169', 'rdap'], ['otpauth://totp/x?secret=JBSWY3DPEHPK3PXP', 'otp'],
    ['-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----', 'binaire'], ['ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI x', 'cle'],
    ['{"kty":"EC","crv":"P-256","x":"a","y":"b"}', 'cle'], ['[{"op":"remove","path":"/a"}]', 'patch'], ['{"query":"{ me { id } }"}', 'graphql'],
    ['query Moi { me { id } }', 'graphql'], ['{"a":[1,2]}', 'analyse'], ['<?xml version="1.0"?><a/>', 'analyse'], ['a:1:{i:0;s:1:"x";}', 'analyse'],
    ['Content-Type: text/html\nCache-Control: no-store\nX-Frame-Options: DENY', 'entetes'], ['1700000000', 'temps'],
    ['01HN3V7Z8ZK0RX0DXKJ0N4V0YB', 'identifier'], ['d41d8cd98f00b204e9800998ecf8427e', 'identifier'], ['aGVsbG8gd29ybGQ=', 'transformer'],
    ['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk', 'metadonnees'], ['data:image/png;base64,iVBORw0KGgo', 'metadonnees'],
    ['caf%C3%A9%20cr%C3%A8me', 'transformer'], ['48 65 6c 6c 6f 20 77 6f', 'hex'], ['var _0x1a2b=["x"];(function(){eval("1")})()', 'code']
  ];
  let justes = 0;
  const erreurs = [];
  for (const [entree, attendu] of cas) {
    const s = suggererOutils(entree);
    if (s.length && s[0].outil === attendu) justes++;
    else erreurs.push(entree.substring(0, 30) + ' → ' + (s[0] ? s[0].outil : 'rien') + ' (attendu ' + attendu + ')');
  }
  egal('le premier outil propose pour ' + cas.length + ' textes colles', erreurs.join(' ; '), '');
  verifier('au plus quatre propositions, une par outil', cas.every(([e]) => {
    const s = suggererOutils(e);
    return s.length <= 4 && new Set(s.map(x => x.outil)).size === s.length;
  }));
  memeListe('rien pour un texte vide ou une phrase', [suggererOutils('').length, suggererOutils('   ').length, suggererOutils('bonjour tout le monde').length], [0, 0, 0]);
  egal('un jeton n est pas pris pour un nom de domaine', suggererOutils(jwt).some(x => x.outil === 'dns'), false);
  const enorme = 'curl https://a.example ' + 'x'.repeat(5000000);
  const debut = Date.now();
  egal('cinq megaoctets : seul le debut est regarde', suggererOutils(enorme)[0].outil, 'requete');
  verifier('…en moins de 300 ms', Date.now() - debut < 300, (Date.now() - debut) + ' ms');
  verifier('chaque raison possible est dans la liste traduite', cas.every(([e]) => suggererOutils(e).every(x => RAISONS_AIGUILLAGE.includes(x.raison))));
}

/* ======================= 5. Le schema GraphQL lu ========================== */
const ref = (kind, name, ofType) => ({ kind, name: name || null, ofType: ofType || null });
const nonNul = r => ref('NON_NULL', null, r);
const liste = r => ref('LIST', null, r);
const INTROSPECTION = { data: { __schema: {
  queryType: { name: 'Query' }, mutationType: { name: 'Mutation' }, subscriptionType: null,
  types: [
    { kind: 'OBJECT', name: 'Query', fields: [
      { name: 'user', description: 'Un utilisateur', args: [{ name: 'id', type: nonNul(ref('SCALAR', 'ID')), defaultValue: null }], type: ref('OBJECT', 'User') },
      { name: 'search', args: [{ name: 'q', type: nonNul(ref('SCALAR', 'String')) }, { name: 'first', type: ref('SCALAR', 'Int'), defaultValue: '10' }], type: nonNul(liste(nonNul(ref('UNION', 'Result')))) },
      { name: 'old', args: [], type: ref('SCALAR', 'String'), isDeprecated: true, deprecationReason: 'use user' }] },
    { kind: 'OBJECT', name: 'Mutation', fields: [{ name: 'rename', args: [{ name: 'id', type: nonNul(ref('SCALAR', 'ID')) }, { name: 'name', type: nonNul(ref('SCALAR', 'String')) }], type: ref('OBJECT', 'User') }] },
    { kind: 'OBJECT', name: 'User', fields: [
      { name: 'id', args: [], type: nonNul(ref('SCALAR', 'ID')) }, { name: 'name', args: [], type: ref('SCALAR', 'String') },
      { name: 'role', args: [], type: ref('ENUM', 'Role') }, { name: 'friends', args: [{ name: 'first', type: nonNul(ref('SCALAR', 'Int')) }], type: liste(ref('OBJECT', 'User')) },
      { name: 'team', args: [], type: ref('OBJECT', 'constructor') }] },
    { kind: 'OBJECT', name: 'constructor', fields: [{ name: 'label', args: [], type: ref('SCALAR', 'String') }] },
    { kind: 'UNION', name: 'Result', possibleTypes: [{ kind: 'OBJECT', name: 'User' }] },
    { kind: 'ENUM', name: 'Role', enumValues: [{ name: 'ADMIN' }, { name: 'USER' }] },
    { kind: 'SCALAR', name: 'ID' }, { kind: 'SCALAR', name: 'String' }, { kind: 'SCALAR', name: 'Int' },
    { kind: 'OBJECT', name: '__Schema', fields: [] }
  ], directives: [{ name: 'deprecated' }] } } };
{
  const s = G.lireSchemaIntrospection(INTROSPECTION);
  memeListe('les points d entree', s.racines, { query: 'Query', mutation: 'Mutation', subscription: null });
  egal('les types propres, sans ceux de l introspection', s.nombre, 9);
  egal('un type nomme « constructor » est un type comme un autre', s.types.get('constructor').champs[0].nom, 'label');
  egal('signature : arguments obligatoires, liste non nulle', G.signatureChamp(G.champsRacine(s, 'query')[1]), 'search(q: String!, first: Int): [Result!]!');
  egal('un argument avec une valeur par defaut n est pas obligatoire', G.champsRacine(s, 'query')[1].arguments[1].obligatoire, false);
  const sq = G.squeletteOperation(s, 'query', 'user', { profondeur: 2 });
  egal('le squelette : variables des arguments, champs simples, sous-objets sans argument obligatoire', sq.requete,
    'query User($id: ID!) {\n  user(id: $id) {\n    id\n    name\n    role\n    team {\n      label\n    }\n  }\n}\n');
  memeListe('…et ses variables a remplir', sq.variables, { id: null });
  memeListe('…qui se relit comme une operation nommee', operationsGraphql(sq.requete), [{ type: 'query', nom: 'User' }]);
  egal('une union : __typename', G.squeletteOperation(s, 'query', 'search').requete.includes('search(q: $q) {\n    __typename'), true);
  egal('une mutation', G.squeletteOperation(s, 'mutation', 'rename').requete.split('\n')[0], 'mutation Rename($id: ID!, $name: String!) {');
  egal('chercher dans le schema', G.chercherSchema(s, 'friend').map(x => x.type + '.' + x.champ.nom).join(), 'User.friends');
  egal('un champ deprecie le dit', G.champsRacine(s, 'query')[2].deprecie, true);
  leve('un champ inconnu est refuse', () => G.squeletteOperation(s, 'query', 'absent'));
  leve('une reponse sans schema est refusee', () => G.lireSchemaIntrospection({ data: { autre: 1 } }));
  verifier('la requete d introspection est un document lisible', operationsGraphql(G.REQUETE_INTROSPECTION)[0].nom === 'IntrospectionQuery');
}

/* ======================= 6. Variables et collections ====================== */
{
  const v = C.lireVariables('# un commentaire\nbase = https://api.example.com\njeton: abc def\n\nmauvaise ligne\n_x.y-z=1');
  memeListe('variables : « = » et « : », commentaires et lignes invalides ignores', [...v.entries()], [['base', 'https://api.example.com'], ['jeton', 'abc def'], ['_x.y-z', '1']]);
  const r = C.remplacerVariables('{{base}}/u?t={{ jeton }}&n={{inconnue}}', v);
  egal('remplacement, espaces dans les accolades tolerees', r.texte, 'https://api.example.com/u?t=abc def&n={{inconnue}}');
  memeListe('…la variable sans valeur est nommee', [...r.manquantes], ['inconnue']);
  const swift = C.ecrireCollection([{ nom: 'Liste', methode: 'get', url: '{{base}}/x', entetes: 'A: 1', corps: '' }, { nom: '', methode: 'P O', url: 'u' }], 'base = b');
  const relue = C.lireCollection(swift);
  memeListe('collection SWIFT : aller-retour, methode normalisee, nom par defaut', [relue.format, relue.requetes.map(x => x.nom + ' ' + x.methode).join(','), relue.variables],
    ['swift', 'Liste GET,sans nom GET', 'base = b']);
  const postman = {
    info: { name: 'API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [{ name: 'Comptes', item: [
      { name: 'Lister', request: { method: 'GET', url: { raw: '{{base}}/comptes?page=1', host: ['{{base}}'], path: ['comptes'] },
        header: [{ key: 'Authorization', value: 'Bearer {{jeton}}' }, { key: 'X-Off', value: '1', disabled: true }] } },
      { name: 'Creer', request: { method: 'POST', url: '{{base}}/comptes', body: { mode: 'raw', raw: '{"nom":"x"}' }, header: [] } },
      { name: 'Formulaire', request: { method: 'POST', url: { protocol: 'https', host: ['api', 'example', 'com'], path: ['f'] },
        body: { mode: 'urlencoded', urlencoded: [{ key: 'a', value: '1 2' }, { key: 'b', value: 'é', disabled: true }] } } },
      { name: 'GraphQL', request: { method: 'POST', url: '{{base}}/graphql', body: { mode: 'graphql', graphql: { query: '{ me { id } }', variables: '{"x":1}' } } } }
    ] }, { name: 'Texte seul', request: 'https://example.com/' }],
    variable: [{ key: 'base', value: 'https://api.example.com' }, { key: 'off', value: 'x', disabled: true }]
  };
  const p = C.lireCollection(JSON.stringify(postman));
  memeListe('Postman v2.1 : dossiers en chemin, ordre garde', p.requetes.map(x => x.nom), ['Comptes / Lister', 'Comptes / Creer', 'Comptes / Formulaire', 'Comptes / GraphQL', 'Texte seul']);
  egal('Postman : en-tete desactive ignore', p.requetes[0].entetes, 'Authorization: Bearer {{jeton}}');
  egal('Postman : adresse en objet sans raw, reconstruite', p.requetes[2].url, 'https://api.example.com/f');
  egal('Postman : corps urlencoded, encode, champ desactive ignore', p.requetes[2].corps + ' | ' + p.requetes[2].entetes, 'a=1%202 | Content-Type: application/x-www-form-urlencoded');
  egal('Postman : corps GraphQL en JSON', p.requetes[3].corps, '{"query":"{ me { id } }","variables":{"x":1}}');
  egal('Postman : les variables de la collection, sauf les desactivees', p.variables, 'base = https://api.example.com');
  leve('ni l un ni l autre : refuse', () => C.lireCollection('{"a":1}'));
  leve('pas du JSON : refuse', () => C.lireCollection('nope'));
}

/* ==================== 7. Le bilan d un site, ligne a ligne ================= */
const DER = /const DER_ESSAI = '([^']+)'/.exec(fs.readFileSync(path.join(racine, 'tests', 'rendu.test.mjs'), 'utf8'))[1];
const JOUR = 86400000;
const MAINTENANT = Date.UTC(2026, 10, 28, 12);
function enregistrement({ id = 0, url = 'https://x.cdn.example.org/', securite = true, entetes = [], redirects = [] } = {}) {
  return {
    id, url, finalUrl: url, type: 'xmlhttprequest', state: 'complete', redirects,
    responseHeaders: entetes,
    security: securite ? {
      state: 'secure', protocolVersion: 'TLSv1.3', cipherSuite: 'TLS_AES_128_GCM_SHA256', keaGroupName: 'X25519MLKEM768', usedEch: true,
      certificateTransparencyStatus: 'policy_compliant', isUntrusted: false, isDomainMismatch: false, isNotValidAtThisTime: false,
      certificates: [{ issuer: 'CN=R11,O=Let\'s Encrypt,C=US', validityEnd: MAINTENANT + 40 * JOUR, der: DER }]
    } : null,
    analysis: { findings: [{ severity: 'low', title: 'x' }] }
  };
}
{
  memeListe('hote a verifier : un nom, une adresse, un port, un nom international',
    ['example.com', 'https://Example.com/page', 'example.com:8443', 'bücher.example', 'deux mots', 'ftp://x.example', ''].map(x => { const h = V.hoteAVerifier(x); return h ? h.cible : null; }),
    ['example.com', 'example.com', 'example.com:8443', 'xn--bcher-kva.example', null, null, null]);
  memeListe('RFC 6125 6.4.3 : l etoile ne remplace que l etiquette la plus a gauche',
    [['*.example.com', 'a.example.com'], ['*.example.com', 'a.b.example.com'], ['*.example.com', 'example.com'], ['Example.COM', 'example.com.'], ['a.example.com', 'b.example.com']]
      .map(([n, h]) => V.nomCouvre(n, h)), [true, false, false, true, false]);

  const principal = enregistrement({ id: 1, entetes: [
    { name: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { name: 'Alt-Svc', value: 'h3=":443"; ma=86400' }, { name: 'Server', value: 'nginx' },
    { name: 'Set-Cookie', value: 'sid=1; Secure; HttpOnly; SameSite=Lax' }, { name: 'Set-Cookie', value: 'pref=2; Path=/' }
  ], redirects: [{ from: 'https://x.cdn.example.org/', to: 'https://x.cdn.example.org/accueil', statusCode: 301 }] });
  const sections = V.bilanSite({
    hote: 'x.cdn.example.org', maintenant: MAINTENANT,
    https: { sonde: { statut: 200, duree: 120, redirige: true, urlFinale: 'https://x.cdn.example.org/accueil' }, rec: principal },
    http: { sonde: { statut: 200, urlFinale: 'https://x.cdn.example.org/' }, rec: null },
    securityTxt: { sonde: { statut: 200, typeContenu: 'text/plain; charset=utf-8', urlFinale: 'https://x.cdn.example.org/.well-known/security.txt',
      corps: 'Contact: mailto:security@example.org\nExpires: 2027-01-01T00:00:00.000Z\n' } }
  });
  const ligne = (section, nom) => (sections.find(s => s.nom === section) || { lignes: [] }).lignes.find(l => l.nom === nom);
  memeListe('les sections du bilan', sections.map(s => s.nom), ['Connexion', 'Certificat', 'Redirections', 'Protections', 'Cookies', 'Annonces']);
  egal('TLS 1.3', ligne('Connexion', 'Version TLS').etat, 'present');
  egal('echange hybride post-quantique reconnu', ligne('Connexion', 'Echange de cles').texte, V.FAITS_VERIFICATION.echangePq);
  egal('la solidite de la suite, traduite a l affichage', JSON.stringify(ligne('Connexion', 'Chiffrement').aTraduire), '["solidite"]');
  egal('ECH utilise', ligne('Connexion', 'ECH').etat, 'present');
  egal('validite : quarante jours', ligne('Certificat', 'Validite').valeurs.n, 40);
  egal('emetteur lu dans le DN', ligne('Certificat', 'Emetteur').valeurs.emetteur, 'Let\'s Encrypt — R11');
  egal('les noms du certificat lus dans ses octets : *.cdn.example.org couvre l hote', ligne('Certificat', 'Noms couverts').etat, 'present');
  egal('transparence conforme', ligne('Certificat', 'Transparence').etat, 'present');
  egal('http mene a https', ligne('Redirections', 'http vers https').etat, 'present');
  egal('la chaine de redirections', ligne('Redirections', 'Chaine').valeurs.chaine, 'https://x.cdn.example.org/ → https://x.cdn.example.org/accueil');
  verifier('les protections lues comme celles d une page (HSTS present)', sections.find(s => s.nom === 'Protections').lignes.some(l => l.nom === 'HSTS' && l.etat === 'present'));
  egal('cookies : celui qui manque d attributs est nomme', ligne('Cookies', 'Cookies poses').valeurs.manques + ' | ' + ligne('Cookies', 'Secure').valeurs.noms, 'Secure, HttpOnly, SameSite | pref');
  egal('HTTP/3 annonce par Alt-Svc', ligne('Annonces', 'HTTP/3').valeurs.alpn, 'h3');
  egal('le logiciel du serveur', ligne('Annonces', 'Serveur').valeurs.valeur, 'nginx');
  egal('security.txt : le contact', ligne('Annonces', 'security.txt').valeurs.contact, 'mailto:security@example.org');
  egal('les constats de l analyseur comptes', ligne('Annonces', 'Analyseur').valeurs.n, 1);

  const autre = V.bilanSite({ hote: 'example.com', maintenant: MAINTENANT,
    https: { sonde: { statut: 200, duree: 5 }, rec: enregistrement({ url: 'https://example.com/' }) },
    http: { sonde: { statut: 200, urlFinale: 'http://example.com/' }, rec: null }, securityTxt: { sonde: { statut: 404 } } });
  const l2 = (section, nom) => autre.find(s => s.nom === section).lignes.find(l => l.nom === nom);
  egal('un certificat qui ne couvre pas l hote', l2('Certificat', 'Noms couverts').etat, 'inoperant');
  egal('un site qui reste en clair', l2('Redirections', 'http vers https').etat, 'absent');
  egal('security.txt absent', l2('Annonces', 'security.txt').etat, 'absent');
  const expire = enregistrement();
  expire.security.certificates[0].validityEnd = MAINTENANT - 3 * JOUR;
  expire.security.protocolVersion = 'TLSv1';
  const vieux = V.bilanSite({ hote: 'x.cdn.example.org', maintenant: MAINTENANT, https: { sonde: { statut: 200 }, rec: expire } });
  egal('un certificat expire', vieux.find(s => s.nom === 'Certificat').lignes[0].texte, V.FAITS_VERIFICATION.certExpire);
  egal('TLS 1.0 : version abandonnee', vieux.find(s => s.nom === 'Connexion').lignes.find(l => l.nom === 'Version TLS').etat, 'inoperant');
  /* Un certificat accepte par une exception : Firefox donne la session, pas la chaine. */
  const sansChaine = enregistrement();
  sansChaine.security = { ...sansChaine.security, certificates: [], isUntrusted: true, certificateTransparencyStatus: 'not_applicable' };
  const exception = V.bilanSite({ hote: 'localhost', maintenant: MAINTENANT, https: { sonde: { statut: 200 }, rec: sansChaine } }).find(s => s.nom === 'Certificat');
  memeListe('sans la chaine : le manque dit, la confiance et la transparence lues quand meme', exception.lignes.map(l => l.nom + ' ' + l.etat),
    ['Certificat info', 'Confiance inoperant', 'Transparence info']);
  const sansCapture = V.bilanSite({ hote: 'a.example', https: { sonde: { statut: 200, entetes: [{ name: 'alt-svc', value: 'h3=":443"' }] }, rec: null },
    http: { sonde: { statut: null, erreur: 'NetworkError' } } });
  egal('sans capture : TLS non lu, mais l annonce HTTP/3 de fetch est lue', sansCapture.find(s => s.nom === 'Connexion').lignes[1].texte + ' | '
    + sansCapture.find(s => s.nom === 'Annonces').lignes[0].etat, V.FAITS_VERIFICATION.tlsNonLu + ' | present');
  egal('le port 80 ferme n est pas une faute', sansCapture.find(s => s.nom === 'Redirections').lignes[0].etat, 'info');
  const interne = V.bilanSite({ hote: 'a.example', https: { sonde: { statut: 200 }, rec: null },
    http: { sonde: { statut: 200, urlFinale: 'https://a.example/' }, rec: { redirects: [{ statusCode: 307, statusLine: 'HTTP/1.1 307 Internal Redirect' }] } } });
  egal('une redirection interne de Firefox est dite comme telle', interne.find(s => s.nom === 'Redirections').lignes[0].texte, V.FAITS_VERIFICATION.firefoxHttps);
}

/* ================== 8. Les commandes du noyau, par le repartiteur ========== */
{
  const cmd = async (nom, args) => globalThis.browser.runtime.sendMessage({ t: 'cmd', cmd: nom, args });
  await config.set({ replayEnabled: false });
  for (const [nom, args] of [['verifierSite', { hote: 'example.com' }], ['dnsDoh', { nom: 'example.com' }], ['rdap', { requete: 'example.com' }]]) {
    const r = await cmd(nom, args);
    verifier(nom + ' : rien ne part sans l autorisation du rejeu', /Le rejeu est desactive/.test(r.error || '') && !appels.length, JSON.stringify(r));
  }
  await config.set({ replayEnabled: true });

  /* DNS sur HTTPS. */
  const reponseDns = Buffer.from(JSON.parse(fs.readFileSync(path.join(racine, 'tests', 'vecteurs-dns.json'), 'utf8')).reponse, 'base64url');
  repondre = () => new Response(reponseDns, { status: 200, headers: { 'Content-Type': 'application/dns-message' } });
  const d = await cmd('dnsDoh', { nom: 'WWW.Example.com.', type: 'https', resolveur: 'quad9', dnssec: true });
  const parti = appels[appels.length - 1];
  egal('DoH : le resolveur choisi, en POST', parti.url + ' ' + parti.init.method, 'https://dns.quad9.net/dns-query POST');
  egal('DoH : type de contenu, sans cookies, marque', [parti.init.headers['Content-Type'], parti.init.credentials, parti.init.headers['X-Swift-Replay']].join(' '),
    'application/dns-message omit 1');
  const question = lireMessageDns(parti.init.body);
  egal('DoH : la question envoyee, nom en minuscules, type HTTPS, bit DO', question.questions[0].nom + ' ' + question.questions[0].typeNom + ' ' + question.opt.dnssecOk,
    'www.example.com. HTTPS true');
  egal('DoH : la reponse rendue en base64, intacte', octetsVersBase64(base64VersOctets(d.resultat.octets)) === Buffer.from(reponseDns).toString('base64'), true);
  egal('DoH : un resolveur a vous, en https seulement', (await cmd('dnsDoh', { nom: 'a.example', resolveur: 'autre', adresse: 'http://dns.example/q' })).error,
    'resolveur DNS sur HTTPS invalide : une adresse https est attendue');
  egal('DoH : type inconnu', (await cmd('dnsDoh', { nom: 'a.example', type: 'XYZ' })).error, 'type DNS inconnu : XYZ');
  egal('DoH : nom invalide', (await cmd('dnsDoh', { nom: 'deux mots' })).error, 'nom d hote invalide : deux mots');
  repondre = () => new Response('panne', { status: 503 });
  egal('DoH : un resolveur en panne, dit', (await cmd('dnsDoh', { nom: 'a.example' })).error, 'le resolveur a repondu 503');

  /* RDAP : amorce IANA, puis le registre. */
  oublierAmorces();
  const amorces = [];
  repondre = adresse => {
    if (adresse.startsWith('https://data.iana.org/rdap/')) {
      amorces.push(adresse);
      return Response.json({ services: [[['example'], ['https://rdap.registre.example/']]] });
    }
    if (adresse === 'https://rdap.registre.example/domain/test.example') return Response.json({ objectClassName: 'domain', ldhName: 'test.example' });
    if (adresse.startsWith('https://rdap.org/')) return new Response('{"errorCode":404}', { status: 404 });
    return new Response('?', { status: 500 });
  };
  const r1 = await cmd('rdap', { requete: 'test.example' });
  egal('RDAP : le serveur de l amorce IANA', r1.resultat.url + ' ' + r1.resultat.json.ldhName, 'https://rdap.registre.example/domain/test.example test.example');
  egal('RDAP : Accept rdap+json, sans cookies', appels[appels.length - 1].init.headers.Accept + ' ' + appels[appels.length - 1].init.credentials,
    'application/rdap+json, application/json omit');
  await cmd('rdap', { requete: 'autre.test.example' });
  egal('RDAP : l amorce gardee, demandee une seule fois', amorces.length, 1);
  const r404 = await cmd('rdap', { requete: 'x.inconnu' });
  egal('RDAP : sans serveur dans l amorce, le redirecteur rdap.org, et son 404 rendu', r404.resultat.url + ' ' + r404.resultat.statut, 'https://rdap.org/domain/x.inconnu 404');
  egal('RDAP : un serveur donne', (await cmd('rdap', { requete: 'test.example', serveur: 'https://rdap.registre.example' })).resultat.url,
    'https://rdap.registre.example/domain/test.example');
  egal('RDAP : une adresse directe, en https seulement', (await cmd('rdap', { url: 'http://x.example/domain/a' })).error, 'adresse RDAP invalide : une adresse https est attendue');
  egal('RDAP : une requete illisible', (await cmd('rdap', { requete: 'deux mots' })).error, 'requete RDAP invalide : un domaine, une adresse IP ou un numero AS est attendu');

  /* Verifier un site : trois requetes, et les enregistrements que la
     capture en aurait faits — fabriques ici comme le ferait webRequest. */
  const avant = appels.length;
  repondre = (adresse, init) => {
    const marque = init.headers['X-Swift-Verification'];
    const rec = store.create({ requestId: null, sources: ['webRequest'], url: adresse, finalUrl: adresse, method: 'GET', type: 'xmlhttprequest',
      tabId: -1, frameId: 0, thirdParty: false, startTime: Date.now() });
    rec.requestHeaders = Object.entries(init.headers).map(([name, value]) => ({ name, value }));
    rec.state = 'complete';
    if (adresse.endsWith('security.txt')) return new Response('Contact: mailto:s@example.com\n', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    if (adresse.startsWith('http:')) throw new TypeError('NetworkError when attempting to fetch resource.');
    rec.security = enregistrement().security;
    rec.responseHeaders = [{ name: 'Strict-Transport-Security', value: 'max-age=31536000' }];
    verifier('la marque de la requete est unique', typeof marque === 'string' && marque.length > 8);
    return new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
  };
  const v = await cmd('verifierSite', { hote: 'https://X.cdn.example.org/page' });
  const parties = appels.slice(avant);
  memeListe('verifier : les trois adresses', parties.map(a => a.url).sort(),
    ['http://x.cdn.example.org/', 'https://x.cdn.example.org/', 'https://x.cdn.example.org/.well-known/security.txt']);
  verifier('verifier : sans cookies, sans cache, marquees', parties.every(a => a.init.credentials === 'omit' && a.init.cache === 'no-store' && a.init.headers['X-Swift-Replay'] === '1'));
  const parRole = Object.fromEntries(v.resultat.sondes.map(s => [s.role, s]));
  verifier('verifier : chaque requete retrouvee dans la capture', parRole.https.recordId != null && parRole['security.txt'].recordId != null);
  egal('verifier : l echec du port 80 rendu, pas leve', parRole.http.erreur, 'NetworkError when attempting to fetch resource.');
  egal('verifier : le corps de security.txt rendu', parRole['security.txt'].corps, 'Contact: mailto:s@example.com\n');
  egal('verifier : une adresse invalide', (await cmd('verifierSite', { hote: 'deux mots' })).error, 'adresse a verifier invalide : deux mots');
}

/* ===================== 9. Les panneaux, menes au clic ===================== */
{
  const { panneauVerifier } = await import('../ui/console/tools-verifier.js');
  const { panneauDns } = await import('../ui/console/tools-dns.js');
  const { panneauRdap } = await import('../ui/console/tools-rdap.js');
  const { panneauGraphql } = await import('../ui/console/tools-graphql.js');
  const { panneauSse, fluxSse } = await import('../ui/console/tools-sse.js');
  const { panneauRequete } = await import('../ui/console/tools-requete.js');
  state.config = { ...config.values, replayEnabled: false };

  /* Verifier un site. */
  const ev = {};
  let vue = rendre(() => panneauVerifier('https://x.cdn.example.org/page', ev, () => {}));
  egal('verifier : le nom repris du texte de travail', champ(vue, 'verif-hote').value, 'x.cdn.example.org');
  verifier('verifier : sans autorisation, le bouton qui la donne', !bouton(vue, 'Verifier') && !!bouton(vue, 'Autoriser le rejeu'));
  await cliquer(vue, 'Autoriser le rejeu');
  vue = rendre(() => panneauVerifier('', ev, () => {}));
  await cliquer(vue, 'Verifier');
  vue = rendre(() => panneauVerifier('', ev, () => {}));
  let lu = plat(vue);
  verifier('verifier : le bilan s affiche, section par section', ['Connexion', 'Certificat', 'Redirections', 'Protections', 'Annonces'].every(s => lu.includes(s)), lu.substring(0, 400));
  verifier('verifier : TLS 1.3 et le post-quantique, lus dans la capture', lu.includes('Version TLS ✓ TLS 1.3') && lu.includes('X25519MLKEM768 : echange hybride post-quantique'));
  const evenements = [];
  document.addEventListener = (type, fn) => {};
  const envoi = document.dispatchEvent;
  document.dispatchEvent = e => { evenements.push(e); return true; };
  cliquer(vue, 'Ouvrir la page dans le detail');
  document.dispatchEvent = envoi;
  egal('verifier : la page s ouvre dans le detail', evenements[0] && evenements[0].detail.view + ' ' + (evenements[0].detail.id === ev.verifResultat.parRole.https.sonde.recordId), 'requests true');
  await cliquer(vue, 'Copier le bilan');
  await attendre(10);
  egal('verifier : le bilan copie', dernierToast(), 'Bilan copie');

  /* DNS sur HTTPS, et le bilan du domaine. */
  const reponseDns = Buffer.from(JSON.parse(fs.readFileSync(path.join(racine, 'tests', 'vecteurs-dns.json'), 'utf8')).reponse, 'base64url');
  repondre = () => new Response(reponseDns, { status: 200, headers: { 'Content-Type': 'application/dns-message' } });
  const ed = { dnsMode: 'doh' };
  vue = rendre(() => panneauDns('www.example.com', ed, () => {}));
  changer(vue, 'dns-type', 'HTTPS');
  const avant = compter('dnsDoh');
  await Promise.all([cliquer(vue, 'Interroger'), cliquer(vue, 'Interroger')]);
  egal('DNS sur HTTPS : un double clic, une question', compter('dnsDoh') - avant, 1);
  vue = rendre(() => panneauDns('', ed, () => {}));
  lu = plat(vue);
  verifier('DNS sur HTTPS : la reponse lue, et en clair (h3, ECH, SPF, CAA)', lu.includes('HTTP/3 annonce (ALPN h3)') && lu.includes('Encrypted Client Hello publie')
    && lu.includes('letsencrypt.org peut emettre des certificats pour ce domaine'), lu.substring(0, 500));
  changer(vue, 'dns-nom', '192.0.2.1');
  await cliquer(vue, 'Interroger');
  egal('DNS sur HTTPS : une adresse IP devient une question PTR', lireMessageDns(appels[appels.length - 1].init.body).questions[0].nom, '1.2.0.192.in-addr.arpa.');
  vue = rendre(() => panneauDns('', ed, () => {}));
  changer(vue, 'dns-nom', 'example.com');
  const avantBilan = compter('dnsDoh');
  await cliquer(vue, 'Bilan du domaine');
  egal('bilan du domaine : douze questions', compter('dnsDoh') - avantBilan, 12);
  vue = rendre(() => panneauDns('', ed, () => {}));
  lu = plat(vue);
  verifier('bilan du domaine : les sections et les lectures', lu.includes('Bilan de example.com') && lu.includes('Courrier') && lu.includes('Securite'), lu.substring(0, 300));

  /* RDAP. */
  repondre = adresse => (adresse.includes('/domain/') ? Response.json({
    objectClassName: 'domain', ldhName: 'test.example', status: ['client transfer prohibited'],
    events: [{ eventAction: 'registration', eventDate: '2001-02-03T04:05:06Z' }, { eventAction: 'expiration', eventDate: '2000-01-01T00:00:00Z' }],
    entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', 'Registrar SA']]] }],
    links: [{ rel: 'related', href: 'https://rdap.bureau.example/domain/test.example', type: 'application/rdap+json' }]
  }) : Response.json({ services: [[['example'], ['https://rdap.registre.example/']]] }));
  const er = {};
  vue = rendre(() => panneauRdap('test.example', er, () => {}));
  await cliquer(vue, 'Interroger');
  vue = rendre(() => panneauRdap('', er, () => {}));
  lu = plat(vue);
  verifier('RDAP : bureau d enregistrement, date, statut explique', lu.includes('Bureau d enregistrement Registrar SA') && lu.includes('Enregistre le 2001-02-03 04:05:06 UTC')
    && lu.includes('transfert bloque par le bureau d enregistrement'), lu.substring(0, 400));
  verifier('RDAP : une expiration passee est dite', lu.includes('Expire depuis'));
  await cliquer(vue, 'Interroger aussi rdap.bureau.example');
  egal('RDAP : le bureau d enregistrement interroge a son tour', appels[appels.length - 1].url, 'https://rdap.bureau.example/domain/test.example');

  /* Client GraphQL. */
  let corpsRecu = null;
  repondre = (adresse, init) => {
    corpsRecu = JSON.parse(init.body);
    if (/__schema/.test(corpsRecu.query)) return Response.json(INTROSPECTION);
    return Response.json({ data: { me: null }, errors: [{ message: 'Non autorise', path: ['me'], locations: [{ line: 1, column: 3 }], extensions: { code: 'UNAUTHENTICATED' } }] });
  };
  const eg = {};
  vue = rendre(() => panneauGraphql('{"query":"query A { a } query B { b }","variables":{"x":1}}', eg, () => {}));
  egal('GraphQL : le corps JSON du texte de travail repris', eg.gqlRequete + ' | ' + JSON.parse(eg.gqlVariables).x, 'query A { a } query B { b } | 1');
  vue = rendre(() => panneauGraphql('', eg, () => {}));
  verifier('GraphQL : deux operations, il faut choisir', !!champ(vue, 'gql-operation'));
  changer(vue, 'gql-url', 'https://api.example.com/graphql');
  changer(vue, 'gql-operation', 'B');
  await cliquer(vue, 'Envoyer');
  egal('GraphQL : POST JSON, operationName et variables', corpsRecu.operationName + ' ' + corpsRecu.variables.x, 'B 1');
  egal('GraphQL : en-tetes JSON et marque, par le rejeu', appels[appels.length - 1].init.headers['Content-Type'] + ' ' + appels[appels.length - 1].init.headers['X-Swift-Replay'], 'application/json 1');
  vue = rendre(() => panneauGraphql('', eg, () => {}));
  lu = plat(vue);
  verifier('GraphQL : l erreur derriere le 200, son chemin et son code', lu.includes('Non autorise') && lu.includes('UNAUTHENTICATED') && lu.includes('le verdict est dans la reponse, pas dans le statut'), lu.substring(0, 500));
  await cliquer(vue, 'Lire le schema (introspection)');
  egal('GraphQL : le schema lu', eg.gqlSchema && eg.gqlSchema.nombre, 9);
  vue = rendre(() => panneauGraphql('', eg, () => {}));
  const preparer = tous(vue, n => n.nodeName === 'BUTTON' && plat(n) === 'Preparer la requete');
  verifier('GraphQL : un bouton par point d entree', preparer.length === 4, String(preparer.length));
  preparer[0]._ecouteurs.click();
  egal('GraphQL : la requete preparee pour user', eg.gqlRequete.split('\n')[0] + ' | ' + eg.gqlVariables.replace(/\s+/g, ''), 'query User($id: ID!) { | {"id":null}');
  eg.gqlVariables = '[1]';
  vue = rendre(() => panneauGraphql('', eg, () => {}));
  await cliquer(vue, 'Envoyer');
  egal('GraphQL : des variables qui ne sont pas un objet, refusees', eg.gqlErreur, 'variables illisibles : un objet JSON est attendu');

  /* Flux HTTP : un flux SSE coupe n importe ou, en direct. */
  const morceaux = ['retry: 2500\nid: 4', '2\nevent: tick\ndata: {"n":', '1}\n\n: ping\n\ndata: deux\r', '\n\ndata: inacheve'];
  repondre = () => new Response(new ReadableStream({
    async start(c) { for (const m of morceaux) { c.enqueue(new TextEncoder().encode(m)); await attendre(30); } c.close(); }
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  state.view = 'tools';
  const es = {};
  let redessins = 0;
  vue = rendre(() => panneauSse('https://api.example.com/events', es, () => { redessins++; }));
  egal('flux : l adresse reprise du texte de travail', champ(vue, 'sse-url').value, 'https://api.example.com/events');
  cliquer(vue, 'Ouvrir le flux');
  await attendre(400);
  const f = fluxSse();
  egal('flux : termine, lu comme des Server-Sent Events', f.etat + ' ' + f.forme, 'termine sse');
  memeListe('flux : les evenements, dans l ordre', f.elements.map(e => e.type + ':' + e.data), ['tick:{"n":1}', 'message:deux']);
  egal('flux : id, retry, commentaire', [f.dernierId, f.retry, f.commentaires].join(' '), '42 2500 1');
  egal('flux : l evenement inacheve est dit', f.inacheve, true);
  egal('flux : Accept text/event-stream et marque', appels[appels.length - 1].init.headers.Accept + ' ' + appels[appels.length - 1].init.headers['X-Swift-Replay'], 'text/event-stream 1');
  verifier('flux : le panneau redessine en direct, peu de fois', redessins >= 1 && redessins <= 6, String(redessins));
  vue = rendre(() => panneauSse('', es, () => {}));
  lu = plat(vue);
  verifier('flux : le journal, le plus recent en haut, JSON mis en forme', lu.indexOf('message') < lu.indexOf('tick') && lu.includes('"n": 1'), lu.substring(0, 600));
  verifier('flux : la fin inachevee expliquee', lu.includes('Le flux s est termine au milieu d un evenement'));
  /* Arreter un flux sans fin. */
  repondre = (adresse, init) => new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode('{"a":1}\n')); init.signal.addEventListener('abort', () => c.error(new DOMException('arrete', 'AbortError'))); }
  }), { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
  vue = rendre(() => panneauSse('', es, () => {}));
  cliquer(vue, 'Ouvrir le flux');
  await attendre(60);
  egal('flux NDJSON : ouvert, une ligne lue', f.etat + ' ' + f.forme + ' ' + f.elements.length, 'ouvert lignes 1');
  vue = rendre(() => panneauSse('', es, () => {}));
  cliquer(vue, 'Arreter le flux');
  await attendre(30);
  egal('flux : arrete sur demande', f.etat, 'arrete');
  state.view = 'requests';

  /* Envoyer une requete : variables, collection, Postman. */
  globalThis.localStorage.removeItem('swift-collection');
  repondre = () => new Response('ok', { status: 200 });
  const eq = {};
  vue = rendre(() => panneauRequete('', eq, () => {}));
  changer(vue, 'requete-url', '{{base}}/comptes');
  changer(vue, 'requete-entetes', 'Authorization: Bearer {{jeton}}');
  changer(vue, 'requete-variables', 'base = https://api.example.com');
  const avantEnvoi = appels.length;
  await cliquer(vue, 'Envoyer');
  egal('variables : une variable sans valeur arrete l envoi, et le dit', (appels.length - avantEnvoi) + ' | ' + dernierToast(), '0 | Variables sans valeur : jeton');
  vue = rendre(() => panneauRequete('', eq, () => {}));
  verifier('variables : le panneau nomme la variable manquante', plat(vue).includes('Variables sans valeur : jeton'));
  changer(vue, 'requete-variables', 'base = https://api.example.com\njeton = abc');
  await cliquer(vue, 'Envoyer');
  const envoi2 = appels[appels.length - 1];
  egal('variables : remplacees dans l adresse et les en-tetes', envoi2.url + ' ' + envoi2.init.headers.Authorization, 'https://api.example.com/comptes Bearer abc');
  vue = rendre(() => panneauRequete('', eq, () => {}));
  changer(vue, 'requete-nom', 'Lister les comptes');
  cliquer(vue, 'Enregistrer la requete');
  const garde = JSON.parse(globalThis.localStorage.getItem('swift-collection'));
  egal('collection : enregistree dans le stockage local, variables comprises', garde.requetes[0].nom + ' | ' + garde.requetes[0].url + ' | ' + garde.variables.split('\n').length,
    'Lister les comptes | {{base}}/comptes | 2');
  const nouvelEtat = {};
  vue = rendre(() => panneauRequete('', nouvelEtat, () => {}));
  verifier('collection : relue a l ouverture suivante', plat(vue).includes('Lister les comptes GET {{base}}/comptes'));
  cliquer(vue, 'Charger');
  egal('collection : chargee dans le formulaire', nouvelEtat.reqUrl, '{{base}}/comptes');
  vue = rendre(() => panneauRequete(JSON.stringify({ info: { name: 'P', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [{ name: 'Ping', request: { method: 'HEAD', url: 'https://api.example.com/ping' } }] }), nouvelEtat, () => {}));
  cliquer(vue, 'Importer depuis le texte de travail');
  egal('collection : une collection Postman importee', nouvelEtat.reqCollection.map(r => r.nom + ' ' + r.methode).join(', '), 'Lister les comptes GET, Ping HEAD');
  vue = rendre(() => panneauRequete('', nouvelEtat, () => {}));
  tous(vue, n => n.nodeName === 'BUTTON' && plat(n) === 'Supprimer')[0]._ecouteurs.click();
  egal('collection : supprimee, et le stockage suit', JSON.parse(globalThis.localStorage.getItem('swift-collection')).requetes.map(r => r.nom).join(), 'Ping');
  globalThis.localStorage.setItem('swift-collection', 'illisible');
  const etatCasse = {};
  vue = rendre(() => panneauRequete('', etatCasse, () => {}));
  verifier('collection : un stockage illisible n empeche rien', !!bouton(vue, 'Envoyer') && etatCasse.reqCollection.length === 0);

  /* Le texte de travail propose son outil, et un clic y mene. */
  const tools = await import('../ui/console/tools.js');
  state.view = 'tools';
  proto.addEventListener = function (type, rappel) { (this._ecouteurs ||= {})[type] = rappel; };
  try { tools.poser('example.com', { bascule: false }); } finally { proto.addEventListener = ecouteurDuHarnais; }
  await attendre(20);
  const vueOutils = document.getElementById('view-tools');
  const proposes = tous(vueOutils, n => n.nodeName === 'BUTTON' && n.dataset && n.dataset.outil);
  memeListe('le texte de travail propose ses outils', proposes.map(n => n.dataset.outil), ['verifier', 'dns', 'rdap']);
  verifier('…avec la raison', plat(proposes[0]) === 'un site a verifier → Verifier un site', plat(proposes[0]));
  proto.addEventListener = function (type, rappel) { (this._ecouteurs ||= {})[type] = rappel; };
  try { proposes[1]._ecouteurs.click(); await attendre(20); } finally { proto.addEventListener = ecouteurDuHarnais; }
  verifier('un clic mene a l outil propose', plat(document.getElementById('view-tools')).includes('Resolution DNS le resolveur de Firefox'));
  state.view = 'requests';
}

/* ================ 10 bis. Plus fluide, et toujours exact =================== */
/* La 6.2 allege l onglet Reponse d un grand corps : la lecture OAuth ne
   relit plus un corps qui ne peut pas en etre une, et la recherche des cles
   en double n alloue plus un Set par objet. Rien de ce qu elles trouvaient
   ne doit leur echapper. */
{
  const { lireOAuth } = await import('../ui/lib/oauth.js');
  const { constatsJson } = await import('../ui/lib/json-exact.js');
  const jeton = t => lireOAuth({ url: 'https://idp.example/token', responseBody: { text: t } });
  verifier('OAuth : une reponse de jeton reconnue', !!(jeton('{"access_token":"a","token_type":"Bearer"}') || {}).reponse);
  verifier('OAuth : la cle ecrite avec un echappement \\u est encore reconnue',
    !!(jeton('{"access\\u005ftoken":"a","token_type":"Bearer"}') || {}).reponse);
  egal('OAuth : un tableau n est pas une reponse de jeton', jeton('[{"access_token":"a","token_type":"Bearer"}]'), null);
  const cles = Array.from({ length: 20 }, (_, i) => '"k' + i + '":' + i).join(',');
  memeListe('cles en double : apres la seizieme cle aussi', constatsJson('{' + cles + ',"k3":1,"k19":2}').doubles.map(d => d.cle), ['k3', 'k19']);
  memeListe('cles en double : une cle echappee qui en double une autre', constatsJson('{"ab":1,"a\\u0062":2}').doubles.map(d => d.cle), ['ab']);
  memeListe('cles en double : seulement dans le meme objet', constatsJson('{"a":{"x":1},"b":{"x":2},"a":3}').doubles.map(d => d.chemin + ' ' + d.cle), ['$ a']);
}

/* ======================= 10. Tout cela, en anglais ======================== */
{
  const MOTS_FRANCAIS = /(^|[\s'(«])(de|du|des|la|le|les|un|une|et|est|pour|sans|avec|par|sur|dans|jamais|aucun|aucune|cette|depuis|apres|avant|entre|plus|moins|pas|qu|au|aux|leur|ou|ne|n|l|d)(\s|$)/i;
  const anglais = dejaAnglais(EN);
  /* Chaque texte que les modules rendent par table a sa traduction. */
  const { TEXTES_DNS_LECTURES } = L;
  const tables = [...TEXTES_DNS_LECTURES, ...R.TEXTES_RDAP, ...RAISONS_AIGUILLAGE, ...Object.values(V.FAITS_VERIFICATION),
    ...V.NOMS_VERIFICATION.filter(n => !['ECH', 'HTTP/3', 'X-Powered-By', 'security.txt', 'Cookies', 'Certificat'].includes(n))];
  /* Un gabarit sans mot a lui (« {version} ») ou un sigle (« TLS 1.3 ») n a rien a traduire. */
  const sansTraduction = tables.filter(x => /[a-z]{3}/.test(x.replace(/\{\w+\}/g, '')) && EN[x] === undefined);
  egal('chaque texte des tables a sa traduction', sansTraduction.slice(0, 8).join(' | '), '');

  const { panneauVerifier } = await import('../ui/console/tools-verifier.js');
  const { panneauDns } = await import('../ui/console/tools-dns.js');
  const { panneauRdap } = await import('../ui/console/tools-rdap.js');
  const { panneauGraphql } = await import('../ui/console/tools-graphql.js');
  const { panneauSse } = await import('../ui/console/tools-sse.js');
  const { panneauRequete } = await import('../ui/console/tools-requete.js');
  const reponseDns = octetsVersBase64(Uint8Array.from(Buffer.from(JSON.parse(fs.readFileSync(path.join(racine, 'tests', 'vecteurs-dns.json'), 'utf8')).reponse, 'base64url')));
  const bilanDns = L.bilanDomaine(new Map([['|A', { rcode: 0, drapeaux: {}, reponses: [{ typeNom: 'A', donnees: '192.0.2.1' }] }],
    ['|TXT', { rcode: 0, drapeaux: {}, reponses: [{ typeNom: 'TXT', donnees: '"v=spf1 ?all"' }] }]]));
  const principal = enregistrement({ id: 3, entetes: [{ name: 'Set-Cookie', value: 'a=1' }, { name: 'Server', value: 'x' }] });
  const verif = { verifHote: 'x.cdn.example.org', verifResultat: { hote: 'x.cdn.example.org', a: 0, parRole: { https: { sonde: { recordId: 3 }, rec: principal } },
    sections: V.bilanSite({ hote: 'x.cdn.example.org', https: { sonde: { statut: 200, duree: 3 }, rec: principal }, http: { sonde: { statut: 200, urlFinale: 'http://x.cdn.example.org/' } },
      securityTxt: { sonde: { statut: 404 } }, maintenant: MAINTENANT }) } };
  const rdap = { rdapRequete: 'test.example', rdapResultats: [{ url: 'https://r.example/domain/test.example', statut: 200, duree: 4, json: {
    objectClassName: 'domain', ldhName: 'test.example', status: ['server hold', 'redemption period'],
    events: [{ eventAction: 'registration', eventDate: '2001-02-03T04:05:06Z' }, { eventAction: 'expiration', eventDate: '2099-01-01T00:00:00Z' }],
    entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', 'R']]] }, { roles: ['technical'], vcardArray: ['vcard', [['org', {}, 'text', 'T']]] }],
    secureDNS: { delegationSigned: false } } }, { url: 'https://r.example/ip/192.0.2.1', statut: 404, duree: 1, json: null }] };
  const gql = { gqlUrl: 'https://a.example/graphql', gqlRequete: 'query A { a } query B { b }', gqlSchema: G.lireSchemaIntrospection(INTROSPECTION), gqlFiltre: 'user',
    gqlReponse: { status: 200, statusText: 'OK', duration: 3, bodySize: 50, url: 'https://a.example/graphql', corpsEnvoye: '{"query":"{ a }"}', truncated: true,
      headers: [{ name: 'content-type', value: 'application/json' }], body: '{"data":null,"errors":[{"message":"x","path":["a"]}]}' } };
  const manques = new Set();
  let vus = [];
  state.config = { ...config.values, replayEnabled: true };
  setLang('en');
  surManque(x => manques.add(String(x)));
  try {
    vus = [
      rendre(() => panneauVerifier('', verif, () => {})),
      rendre(() => panneauVerifier('', {}, () => {})),
      rendre(() => panneauDns('', { dnsMode: 'doh', dnsResolveur: 'autre', dohResultats: [{ nom: 'www.example.com', type: 'HTTPS', resolveur: 'https://d.example/q', duree: 2, octets: reponseDns }],
        dnsBilan: { nom: 'example.com', a: 0, echecs: 1, ...bilanDns }, dnsErreur: 'resolution impossible : pas de reponse en 15 s' }, () => {})),
      rendre(() => panneauRdap('', rdap, () => {})),
      rendre(() => panneauGraphql('', gql, () => {})),
      rendre(() => panneauSse('', {}, () => {})),
      rendre(() => panneauRequete('', { reqUrl: '{{x}}/a', reqVariables: 'y = 1', reqCollection: [{ nom: 'N', methode: 'GET', url: 'u', entetes: '', corps: '' }] }, () => {}))
    ].map(plat);
  } finally { surManque(null); setLang('fr'); }
  const phrases = [...manques].filter(s => !anglais(s) && /\s/.test(s) && /[a-z]{3}/i.test(s) && MOTS_FRANCAIS.test(s));
  egal('en anglais : aucune phrase francaise dans ces panneaux', phrases.slice(0, 10).join(' | '), '');
  const [v1, v2, d, r, g, s, q] = vus;
  verifier('en anglais : le bilan d un site', v1.includes('Connection') && v1.includes('TLS version ✓ TLS 1.3') && v1.includes('X25519MLKEM768: hybrid post-quantum exchange')
    && v1.includes('the site answers in the clear, without redirecting to https') && v1.includes('no security.txt (RFC 9116)'), v1.substring(0, 500));
  verifier('en anglais : le panneau vide de la verification', v2.includes('Give a domain name: the summary says what protects the connection'));
  verifier('en anglais : DNS sur HTTPS, son bilan et l erreur traduite', d.includes('HTTP/3 advertised (ALPN h3)') && d.includes('Summary of example.com')
    && d.includes('final policy ?all: no opinion on other senders (neutral): no protection') && d.includes('resolution failed: no response in 15 s'), d.substring(0, 600));
  verifier('en anglais : RDAP — statuts, roles, dates, 404', r.includes('suspended by the registry: the domain no longer resolves') && r.includes('Registered on')
    && r.includes('Technical contact') && r.includes('unsigned delegation') && r.includes('The registry does not know this object (404)'), r.substring(0, 600));
  verifier('en anglais : GraphQL — schema, operations, faits', g.includes('Queries (Query)') && g.includes('Operation to execute') && g.includes('Body cut:'), g.substring(0, 600));
  verifier('en anglais : le flux', s.includes('HTTP stream (SSE) stopped') && s.includes('Open the stream'), s.substring(0, 300));
  verifier('en anglais : variables et collection', q.includes('Variables without a value: x') && q.includes('Saved requests') && q.includes('Export the collection'), q.substring(0, 600));
}

bilan('Enqueter sur un site');
