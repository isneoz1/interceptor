/* Signaux HTTP — SWIFT (by D4RK)
 *
 *   node tests/signaux.test.mjs
 *
 * Ce que la 5.4 lit dans les en-tetes d une reponse, verifie contre les textes
 * qui les definissent — chaque exemple est recopie tel quel :
 *
 *   1. les dates HTTP (RFC 9110 §5.6.7), et une reference independante : la
 *      norme ECMA-262 garantit que Date.parse lit ce qu ecrit toUTCString,
 *      qui est exactement la forme IMF-fixdate ;
 *   2. Deprecation (RFC 9745) et Sunset (RFC 8594), et les formes des
 *      premiers brouillons de la specification ;
 *   3. Retry-After (RFC 9110 §10.2.3) et RateLimit, dans les trois
 *      generations du brouillon draft-ietf-httpapi-ratelimit-headers
 *      (-11, -07, -05), plus X-RateLimit-* ;
 *   4. Link (RFC 8288 §3.5) et le registre IANA des relations, compare a son
 *      instantane du 8 octobre 2026 ;
 *   5. Alt-Svc (RFC 7838) ;
 *   6. Cache-Status (RFC 9211 §3) et CDN-Cache-Control (RFC 9213) ;
 *   7. Priority (RFC 9218) ;
 *   8. le noyau (resume, marqueurs), le verdict, la Synthese et l onglet.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { installerTout, installerPage, enregistrementExemple, egal, verifier, bilan } from './harnais.mjs';

installerTout();
const ici = path.dirname(url.fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '..');
installerPage(racine);

const { config } = await import('../background/core/config.js');
await config.ready;
const { lireDateHttp, ecrireDateHttp, faitsDeDate } = await import('../ui/lib/date-http.js');
const { lireCycleDeVie } = await import('../ui/lib/cycle-vie.js');
const { lireLimitesDebit, lireRetryAfter } = await import('../ui/lib/limites-debit.js');
const { lireLiens, suiviAnticipations } = await import('../ui/lib/liens-http.js');
const { RELATIONS_LIENS, relationLien } = await import('../ui/lib/ref-liens.js');
const { EN_REF_LIENS } = await import('../ui/lib/dict-en-ref-liens.js');
const { lireAltSvc } = await import('../ui/lib/alt-svc.js');
const { lireCacheStatus, lireCdnCacheControl } = await import('../ui/lib/cache-status.js');
const { lirePriorite } = await import('../ui/lib/priorite-http.js');

const h = objet => Object.entries(objet).map(([name, value]) => ({ name, value }));
const cles = faits => faits.map(f => f.cle);
const T0 = Date.UTC(2026, 9, 8, 12, 0, 0);

/* ======================= 1. Les dates HTTP (RFC 9110) ===================== */
/* Section 5.6.7 : trois ecritures d un meme instant. */
const NOV_1994 = Date.UTC(1994, 10, 6, 8, 49, 37);
for (const [forme, texte] of [['imf', 'Sun, 06 Nov 1994 08:49:37 GMT'], ['rfc850', 'Sunday, 06-Nov-94 08:49:37 GMT'],
  ['asctime', 'Sun Nov  6 08:49:37 1994']]) {
  const lue = lireDateHttp(texte, T0);
  egal('date HTTP, forme ' + forme + ' : instant', lue && lue.ms, NOV_1994);
  egal('date HTTP, forme ' + forme + ' : reconnue', lue && lue.forme, forme);
}
egal('IMF-fixdate ecrite comme la RFC', ecrireDateHttp(NOV_1994), 'Sun, 06 Nov 1994 08:49:37 GMT');
/* « plus de cinquante ans dans le futur » : l annee recule d un siecle. */
egal('RFC 850 : annee a deux chiffres, a moins de cinquante ans devant', new Date(lireDateHttp('Wednesday, 01-Jan-70 00:00:00 GMT', T0).ms).getUTCFullYear(), 2070);
egal('RFC 850 : au-dela de cinquante ans, le siecle precedent', new Date(lireDateHttp('Thursday, 06-Nov-80 08:49:37 GMT', T0).ms).getUTCFullYear(), 1980);
egal('une date impossible dans une forme valide est refusee', lireDateHttp('Sat, 31 Feb 2025 00:00:00 GMT', T0), null);
egal('un nombre seul n est pas une date HTTP', lireDateHttp('120', T0), null);
verifier('seconde intercalaire acceptee (:60)', lireDateHttp('Wed, 31 Dec 1969 23:59:60 GMT', T0) !== null);
const utc = lireDateHttp('Sun, 30 Jun 2024 23:59:59 UTC', T0);
egal('« UTC » au lieu de « GMT » : lue, mais hors des trois formes', utc && utc.forme, 'autre');
verifier('... et le fait est dit', cles(faitsDeDate(utc)).includes('autre'));
verifier('jour de la semaine incoherent signale', cles(faitsDeDate(lireDateHttp('Mon, 06 Nov 1994 08:49:37 GMT', T0))).includes('jour'));
verifier('forme ancienne signalee', cles(faitsDeDate(lireDateHttp('Sun Nov  6 08:49:37 1994', T0))).includes('ancienne'));

/* Reference independante : ECMA-262 garantit que Date.parse relit toUTCString,
   qui est la forme IMF-fixdate. Cinq cents instants, de 1970 a 2100. */
let ecartsDates = 0;
for (let i = 0; i < 500; i++) {
  const ms = Math.floor((i * 7919 % 500) / 500 * Date.UTC(2100, 0, 1) / 1000) * 1000;
  const texte = new Date(ms).toUTCString();
  const lue = lireDateHttp(texte, T0);
  if (!lue || lue.ms !== ms || lue.forme !== 'imf' || ecrireDateHttp(ms) !== texte) ecartsDates++;
}
egal('IMF-fixdate : cinq cents instants identiques a toUTCString (ECMA-262)', ecartsDates, 0);

/* ============ 2. Deprecation (RFC 9745) et Sunset (RFC 8594) ============== */
/* RFC 9745 §2.1 : « deprecated on Friday, June 30, 2023 at 23:59:59 UTC ». */
const d1 = lireCycleDeVie(h({ Deprecation: '@1688169599' }), { maintenant: T0 });
egal('Deprecation @1688169599 : 30 juin 2023 23:59:59 UTC', d1.deprecation.ms, Date.UTC(2023, 5, 30, 23, 59, 59));
verifier('... date passee : depreciee depuis', cles(d1.faits).includes('deprecieeDepuis') && d1.deprecation.passee);
verifier('... avec le rappel : un indice, pas une panne (§5)', cles(d1.faits).includes('indice'));
const d2 = lireCycleDeVie(h({ Deprecation: '@1688169599' }), { maintenant: Date.UTC(2023, 0, 1) });
verifier('date a venir : depreciee a partir du', cles(d2.faits).includes('depreciee') && !d2.deprecation.passee);

/* §3.1 : un lien de documentation seul, sans en-tete : pas (encore) depreciee. */
const lienSeul = lireCycleDeVie(h({ Link: '<https://developer.example.com/deprecation>; rel="deprecation"; type="text/html"' }),
  { maintenant: T0 });
egal('lien rel=deprecation seul : pas de depreciation', lienSeul.deprecation, null);
egal('... mais le lien est garde', lienSeul.liens.map(l => l.cible).join(), 'https://developer.example.com/deprecation');

/* §4 : l exemple Deprecation + Sunset, dont la date ecrit « UTC ». */
const d3 = lireCycleDeVie(h({ Deprecation: '@1688169599', Sunset: 'Sun, 30 Jun 2024 23:59:59 UTC' }), { maintenant: T0 });
egal('Sunset de l exemple de la RFC 9745 : 30 juin 2024 23:59:59', d3.fin.ms, Date.UTC(2024, 5, 30, 23, 59, 59));
verifier('... ecrite hors des trois formes : dit', cles(d3.faits).includes('autre'));
verifier('... date passee : peut cesser a tout moment (RFC 8594 §3)', cles(d3.faits).includes('finPassee'));
verifier('... fin apres la depreciation : rien a redire', !cles(d3.faits).includes('finAvant'));
const d4 = lireCycleDeVie(h({ Deprecation: '@1719791999', Sunset: 'Fri, 30 Jun 2023 23:59:59 GMT' }), { maintenant: T0 });
verifier('fin avant la depreciation : interdit par la RFC 9745 §4', cles(d4.faits).includes('finAvant'));

/* RFC 8594 §3 et §9. */
const s1 = lireCycleDeVie(h({ Sunset: 'Sat, 31 Dec 2018 23:59:59 GMT', Link: '<http://example.net/sunset>;rel="sunset";type="text/html"' }),
  { url: 'http://example.net/', maintenant: Date.UTC(2018, 0, 1) });
egal('Sunset : 31 decembre 2018', s1.fin.ms, Date.UTC(2018, 11, 31, 23, 59, 59));
verifier('... a venir : fin de service prevue', cles(s1.faits).includes('fin'));
egal('... lien rel=sunset', s1.liens.map(l => l.rel + ' ' + l.cible).join(), 'sunset http://example.net/sunset');
egal('Sunset sans Deprecation : pas de depreciation affirmee', s1.deprecation, null);

/* Les premiers brouillons (-00 a -02) : `IMF-fixdate / "true"`. */
const ancienneVraie = lireCycleDeVie(h({ Deprecation: 'true' }), { maintenant: T0 });
verifier('Deprecation: true — forme des premiers brouillons, signalee', cles(ancienneVraie.faits).includes('ancienneForme'));
const ancienneDate = lireCycleDeVie(h({ Deprecation: 'Sun, 11 Nov 2018 23:59:59 GMT' }), { maintenant: T0 });
egal('Deprecation en date HTTP — lue', ancienneDate.deprecation.ms, Date.UTC(2018, 10, 11, 23, 59, 59));
verifier('... et signalee comme forme ancienne', cles(ancienneDate.faits).includes('ancienneForme'));
verifier('valeur illisible signalee', cles(lireCycleDeVie(h({ Deprecation: 'bientot' }), { maintenant: T0 }).faits).includes('illisible'));
egal('ni l un ni l autre : rien', lireCycleDeVie(h({ 'Content-Type': 'text/html' })), null);

/* ============ 3. Retry-After (RFC 9110) et RateLimit (brouillon) ========== */
egal('Retry-After: 120 — deux minutes', lireRetryAfter('120', T0).secondes, 120);
egal('Retry-After en date HTTP — lue', lireRetryAfter('Fri, 31 Dec 1999 23:59:59 GMT', T0).ms, Date.UTC(1999, 11, 31, 23, 59, 59));
for (const faux of ['-5', '1.5', 'bientot']) {
  egal('Retry-After illisible : ' + faux, lireRetryAfter(faux, T0).forme, 'illisible');
}
const debit = (entetes, statut = 200, extra = {}) => lireLimitesDebit(h(entetes), { statut, instantReponse: T0, maintenant: T0, ...extra });
verifier('429 + Retry-After : reessayer dans', cles(debit({ 'Retry-After': '120' }, 429).faits).includes('reessayerDans'));
verifier('503 + Retry-After : service indisponible pendant', cles(debit({ 'Retry-After': '120' }, 503).faits).includes('reessayer503'));
verifier('3xx + Retry-After : attente minimale avant la redirection', cles(debit({ 'Retry-After': '120' }, 301).faits).includes('reessayer3xx'));

/* Brouillon -11, exemples des sections 3.2, 4.2 et 6. */
const p11 = debit({ 'RateLimit-Policy': '"burst";q=100;w=60,"daily";q=1000;w=86400' });
egal('-11 : deux politiques', p11.politiques.map(p => p.nom + ' ' + p.quota + '/' + p.fenetre).join(', '), 'burst 100/60, daily 1000/86400');
egal('-11 : forme reconnue', p11.forme, '11');
const pk = debit({ 'RateLimit-Policy': '"peruser";q=65535;qu="content-bytes";w=10;pk=:sdfjLJUOUH==:' });
egal('-11 : unite de quota', pk.politiques[0].unite, 'content-bytes');
const l11 = debit({ RateLimit: '"default";r=50;t=30' });
egal('-11 : RateLimit "default";r=50;t=30', JSON.stringify(l11.limites), JSON.stringify([{ nom: 'default', restant: 50, fenetre: 30 }]));
const sansFenetre = debit({ RateLimit: '"default";r=999;pk=:dHJpYWwxMjEzMjM=:' });
egal('-11 : sans fenetre', sansFenetre.limites[0].fenetre, null);
const redir = debit({ RateLimit: '"problemPolicy";r=0;t=10', Location: '/foo/123' }, 301);
verifier('-11, §6 : quota epuise sur une redirection', cles(redir.faits).includes('epuise'));
const conflit = debit({ 'Retry-After': '5', RateLimit: '"default";r=0;t=300' }, 429);
verifier('-11, §6 : Retry-After avant la fin de la fenetre, signale', cles(conflit.faits).includes('retryAvantFenetre'));
verifier('-11, §7.3 : valeurs servies par un cache, a ignorer', cles(debit({ RateLimit: '"d";r=5' }, 200, { depuisCache: true }).faits).includes('cache'));
verifier('-11, §7 : mal forme, a ignorer', cles(debit({ RateLimit: 'n importe quoi' }).faits).includes('malForme'));

/* Brouillon -07, section 3.5. */
const f07 = debit({ 'RateLimit-Policy': '100;w=10', RateLimit: 'limit=100, remaining=50, reset=5' });
egal('-07 : forme reconnue', f07.forme, '07');
egal('-07 : limite, restant, remise a zero', [f07.ancien.limite, f07.ancien.restant, f07.ancien.reinit].join(), '100,50,5');
egal('-07 : la politique et sa fenetre', f07.politiques[0].quota + '/' + f07.politiques[0].fenetre, '100/10');
/* Brouillon -05 : trois champs separes. */
const f05 = debit({ 'RateLimit-Limit': '10', 'RateLimit-Remaining': '1', 'RateLimit-Reset': '7' });
egal('-00 a -06 : forme reconnue', f05.forme, '06');
egal('-00 a -06 : valeurs', [f05.ancien.limite, f05.ancien.restant, f05.ancien.reinit].join(), '10,1,7');
/* Brouillons -00 a -03 : RateLimit-Limit est une liste, la limite puis les politiques (exemple de -02). */
const f02 = debit({ 'RateLimit-Limit': '10, 10;w=1, 50;w=60, 1000;w=3600, 5000;w=86400', 'RateLimit-Remaining': '9', 'RateLimit-Reset': '1' });
egal('-00 a -03 : la limite en tete de liste', f02.ancien && f02.ancien.limite, 10);
egal('-00 a -03 : les politiques qui suivent', f02.politiques.map(p => p.quota + '/' + p.fenetre).join(' '), '10/1 50/60 1000/3600 5000/86400');
verifier('-00 a -03 : pas pris pour un en-tete mal forme', !cles(f02.faits).includes('malForme'));
/* X-RateLimit-* : aucune specification, la lecture dit sa regle. */
const xu = debit({ 'X-RateLimit-Limit': '5000', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '1791460860' });
egal('X- : Reset au-dela d un milliard, une heure Unix', xu.ancien.reinitForme, 'unix');
verifier('X- : quota epuise', cles(xu.faits).includes('epuiseSimple'));
egal('X- : Reset en deca, des secondes', debit({ 'X-RateLimit-Reset': '60' }).ancien.reinitForme, 'secondes');

/* =========== 4. Link (RFC 8288) et le registre IANA des relations ========== */
const base = 'https://example.com/TheBook/chapter3';
const e1 = lireLiens('<http://example.com/TheBook/chapter2>; rel="previous"; title="previous chapter"', base);
egal('§3.5 exemple 1 : relation et cible', e1.liens.map(l => l.rel + ' ' + l.cible).join(), 'previous http://example.com/TheBook/chapter2');
egal('§3.5 exemple 1 : titre', e1.liens[0].attributs.map(([n, v]) => n + '=' + v).join(), 'title=previous chapter');
egal('§3.5 exemple 2 : relation d extension, cible relative resolue',
  lireLiens('</>; rel="http://example.net/foo"', base).liens.map(l => l.rel + ' ' + l.cible).join(), 'http://example.net/foo https://example.com/');
egal('§3.5 exemple 3 : anchor', lireLiens('</terms>; rel="copyright"; anchor="#foo"', base).liens[0].contexte, base + '#foo');
const e4 = lireLiens('</TheBook/chapter2>; rel="previous"; title*=UTF-8\'de\'letztes%20Kapitel, </TheBook/chapter4>; rel="next"; title*=UTF-8\'de\'n%c3%a4chstes%20Kapitel', base);
egal('§3.5 exemple 4 : deux liens separes par une virgule', e4.liens.map(l => l.rel).join(), 'previous,next');
egal('§3.5 exemple 4 : title* decode en UTF-8 (RFC 8187)', e4.liens[1].attributs.find(([n]) => n === 'title')[1], 'nächstes Kapitel');
egal('§3.5 exemple 5 : deux relations, un lien chacune',
  lireLiens('<http://example.org/>; rel="start http://example.net/relation/other"', base).liens.map(l => l.rel).join(), 'start,http://example.net/relation/other');
egal('§3.5 exemple 6 : equivalent a deux en-tetes',
  lireLiens('<https://example.org/>; rel="start", <https://example.org/index>; rel="index"', base).liens.length, 2);
verifier('sans rel : ignore et signale (§3.3)', cles(lireLiens('</x>; title="t"', base).faits).includes('sansRel'));
verifier('rev : deprecie, signale', cles(lireLiens('</x>; rel="next"; rev="prev"', base).faits).includes('rev'));
verifier('relation inconnue qui n est pas une URI : signalee', cles(lireLiens('</x>; rel="pas-une-relation"', base).faits).includes('relNonEnregistre'));
verifier('texte illisible : la lecture s arrete', cles(lireLiens('</x>; rel="next", ???', base).faits).includes('illisible'));
egal('type de relation compare sans casse', lireLiens('</x>; rel="NEXT"', base).liens[0].rel, 'next');

const suivi = suiviAnticipations(lireLiens('</app.css>; rel=preload; as=style, </absente.js>; rel=preload; as=script', 'https://exemple.test/').liens,
  ['https://exemple.test/app.css', 'https://exemple.test/app.css']);
egal('preload : requetes vues dans la capture', suivi.map(s => s.requetes).join(), '2,0');

const instantane = JSON.parse(fs.readFileSync(path.join(ici, 'vecteurs-liens-iana.json'), 'utf8'));
egal('registre IANA : autant de relations que l instantane', RELATIONS_LIENS.length, instantane.relations.length);
let ecartsRegistre = 0;
const typo = s => s.replace(/'/g, '’');
for (const r of instantane.relations) {
  const notre = relationLien(r.nom);
  if (!notre || notre.reference !== r.reference || EN_REF_LIENS[notre.sens] !== typo(r.description)) ecartsRegistre++;
}
egal('registre IANA : chaque nom, reference et description anglaise identiques', ecartsRegistre, 0);

/* ========================== 5. Alt-Svc (RFC 7838) ========================= */
const alt = (v, o = {}) => lireAltSvc(h({ 'Alt-Svc': v }), o);
const a1 = alt('h2=":8000"');
egal('h2=":8000" : meme hote, port 8000', [a1.services[0].alpn, a1.services[0].hote, a1.services[0].port].join(), 'h2,,8000');
egal('ma par defaut : 24 heures (§3.1)', a1.services[0].ma, 86400);
egal('changement d hote', alt('h2="new.example.org:80"').services[0].hote, 'new.example.org');
egal('deux valeurs, dans l ordre de preference', alt('h2="alt.example.com:8000", h2=":443"').services.map(s => s.port).join(), '8000,443');
egal('ma=3600', alt('h2=":443"; ma=3600').services[0].ma, 3600);
egal('§3.1 : ma=60 avec Age 30 — reste 30 s', alt('h2=":8000"; ma=60', { age: 30 }).services[0].reste, 30);
verifier('persist=1', alt('h2=":443"; ma=2592000; persist=1').services[0].persist);
egal('identifiants ALPN pourcent-encodes (§3)', alt('w%3Dx%3Ay#z=":443", x%25y=":443"').services.map(s => s.alpn).join(' '), 'w=x:y#z x%y');
verifier('clear', alt('clear').clear && cles(alt('clear').faits).includes('clear'));
verifier('reponse deja en h3, alternative preferee', cles(alt('h3=":443"; ma=86400', { protocole: 'h3' }).faits).includes('deja'));
verifier('reponse en h2, le serveur prefere h3', cles(alt('h3=":443", h2=":443"', { protocole: 'h2' }).faits).includes('autre'));
verifier('autorite sans guillemets : illisible', cles(alt('h3=443').faits).includes('illisible'));
verifier('port au-dela de 65535 : illisible', cles(alt('h3=":99999"').faits).includes('illisible'));
egal('IPv6 litterale : hote et port', alt('h2="[2001:db8::1]:443"').services.map(x => x.hote + ' ' + x.port).join(), '[2001:db8::1] 443');

/* ================ 6. Cache-Status (RFC 9211) et CDN (RFC 9213) ============= */
const cs = v => lireCacheStatus(h({ 'Cache-Status': v }), { statut: 200 });
const notes = c => c.notes.map(n => n.cle + (n.valeurs.duree != null ? '(' + n.valeurs.duree + ')' : '') + (n.valeurs.statut ? '(' + n.valeurs.statut + ')' : '')).join(' ');
egal('§3 : hit', notes(cs('ExampleCache; hit').caches[0]), 'servie');
egal('§3 : hit; ttl=376', notes(cs('ExampleCache; hit; ttl=376').caches[0]), 'servie ttlFraiche(376)');
egal('§3 : hit perime, ttl=-412', notes(cs('ExampleCache; hit; ttl=-412').caches[0]), 'servie ttlPerimee(412)');
egal('§3 : fwd=uri-miss (fwd-status vaut le statut de la reponse)', notes(cs('ExampleCache; fwd=uri-miss').caches[0]), 'transmise statutSuivant(200)');
egal('§3 : fwd=stale; fwd-status=304', notes(cs('ExampleCache; fwd=stale; fwd-status=304').caches[0]), 'transmise statutSuivant(304)');
egal('§3 : collapsed', notes(cs('ExampleCache; fwd=uri-miss; collapsed').caches[0]), 'transmise statutSuivant(200) fusionnee');
egal('§3 : collapsed=?0', notes(cs('ExampleCache; fwd=uri-miss; collapsed=?0').caches[0]), 'transmise statutSuivant(200) fusionRatee');
egal('§3 : deux caches, du plus proche de l origine au plus proche de l utilisateur',
  cs('OriginCache; hit; ttl=1100, "CDN Company Here"; hit; ttl=545').caches.map(c => c.nom).join(), 'OriginCache,CDN Company Here');
const trois = lireCacheStatus(h({}).concat([{ name: 'Cache-Status', value: 'ReverseProxyCache; hit' },
  { name: 'Cache-Status', value: 'ForwardProxyCache; fwd=uri-miss; collapsed; stored' },
  { name: 'Cache-Status', value: 'BrowserCache; fwd=uri-miss' }]), { statut: 200 });
egal('§3 : trois en-tetes, une seule liste', trois.caches.map(c => c.nom).join(), 'ReverseProxyCache,ForwardProxyCache,BrowserCache');
verifier('§3 : stored', notes(trois.caches[1]).includes('gardee'));
egal('§2.8 : detail', cs('ExampleCache; hit; detail=MEMORY').caches[0].detail, 'MEMORY');
verifier('§2.1 : hit et fwd ensemble, signale', notes(cs('X; hit; fwd=miss').caches[0]).includes('exclusifs'));
verifier('§2 : liste illisible, signalee', cles(cs('X; hit,,').faits).includes('illisible'));
const fwdChaine = cs('X; fwd="uri-miss"').caches[0];
verifier('§2.2 : fwd entre guillemets — lu, et signale', notes(fwdChaine).includes('transmise') && notes(fwdChaine).includes('fwdType'));
egal('§2 : un membre liste interne se decrit', cs('(a b); hit').caches[0].nom, '(a b)');

const cdn = v => lireCdnCacheControl(h({ 'CDN-Cache-Control': v }));
egal('RFC 9213 §3.1 : max-age=600', cdn('max-age=600').directives.map(d => d.cle + '=' + d.valeur).join(), 'max-age=600');
verifier('RFC 9213 §2.2 : remplace Cache-Control et Expires pour un CDN', cles(cdn('max-age=600').faits).includes('cdnPrime'));
egal('RFC 9213 §3.1 : « none » — une directive booleenne', cdn('none').directives[0].valeur, null);
verifier('RFC 9213 §2.1 : max-age decimal, signale', cles(cdn('max-age=60.5').faits).includes('cdnDecimal'));
verifier('RFC 9213 §2.1 : illisible — ignore en entier', cdn('max-age=600,,').ignore);

/* =========================== 7. Priority (RFC 9218) ======================== */
egal('§4.1 : u=0', lirePriorite('u=0', 'requete').u, 0);
const p5 = lirePriorite('u=5, i', 'requete');
egal('§4.2 : u=5, i', [p5.u, p5.i].join(), '5,true');
const absente = lirePriorite('i', 'requete');
egal('§4 : urgence absente d une requete — 3 par defaut', absente.u, 3);
const rep = lirePriorite('u=1', 'reponse');
egal('§8 : reponse u=1 — urgence du serveur', rep.u, 1);
egal('§8 : i absent d une reponse — rien d impose', rep.i, null);
verifier('§8 : et la valeur du client reste', cles(rep.faits).includes('reponseInchangee'));
verifier('§4 : u=8 hors bornes, ignore', cles(lirePriorite('u=8', 'requete').faits).includes('ignore') && lirePriorite('u=8', 'requete').u === 3);
verifier('§4 : u="3" mauvais type, ignore', cles(lirePriorite('u="3"', 'requete').faits).includes('ignore'));
verifier('§4.1 : u=7, taches de fond', cles(lirePriorite('u=7', 'requete').faits).includes('fond'));
verifier('§5 : dictionnaire illisible', cles(lirePriorite('u=1,,', 'requete').faits).includes('illisible'));

/* ============== 7 ter. Proxy-Status (RFC 9209) et ses alias (RFC 9532) ============ */
const { lireProxyStatus } = await import('../ui/lib/proxy-status.js');
const { ERREURS_PROXY, PARAMETRES_PROXY } = await import('../ui/lib/ref-proxy-status.js');
const { EN_REF_PROXY } = await import('../ui/lib/dict-en-ref-proxy.js');
{
  const ps = (v, statut) => lireProxyStatus(h({ 'Proxy-Status': v }), { statut });
  const cles2 = i => i.notes.map(n => n.cle);
  /* §2 : l ordre, du plus proche de l origine au plus proche de vous. */
  const chaine2 = ps('revproxy1.example.net, ExampleCDN');
  egal('§2 : deux intermediaires, dans l ordre', chaine2.intermediaires.map(i => i.nom).join(' > '), 'revproxy1.example.net > ExampleCDN');
  /* §2.1.1 : un 504 produit par le CDN lui-meme. */
  const delai = ps('ExampleCDN; error=connection_timeout', 504);
  egal('§2.1.1 : connection_timeout, produite par ExampleCDN', JSON.stringify(delai.produitePar), '{"nom":"ExampleCDN","erreur":"connection_timeout"}');
  verifier('§2.1.1 : 504 est le statut recommande, rien a redire', !cles2(delai.intermediaires[0]).includes('statutRecommande'));
  const refus = ps('r34.example.net; error=http_request_error, ExampleCDN', 429);
  egal('§2.1.1 : le 429 vient de r34.example.net, pas du CDN ni de l origine', refus.produitePar.nom, 'r34.example.net');
  verifier('§2.1.1 : un 429 est bien un 4xx', !cles2(refus.intermediaires[0]).includes('statutNon4xx'));
  verifier('§2.3.16 : http_request_error sur un 200 est signale', cles2(ps('p; error=http_request_error', 200).intermediaires[0]).includes('statutNon4xx'));
  verifier('§2.1.1 : un statut autre que celui recommande est dit', ps('p; error=dns_timeout', 502).intermediaires[0].notes.some(n => n.cle === 'statutRecommande' && n.valeurs.attendu === 504));
  /* §2.1.2 a 2.1.5. */
  egal('§2.1.2 : next-hop', ps('cdn.example.org; next-hop=backend.example.org:8001').intermediaires[0].notes[0].valeurs.hote, 'backend.example.org:8001');
  egal('§2.1.3 : next-protocol en jeton', ps('"proxy.example.org"; next-protocol=h2').intermediaires[0].notes[0].valeurs.protocole, 'h2 — HTTP/2 (RFC 9113)');
  egal('§2.1.3 : next-protocol en suite d octets', ps('p; next-protocol=:aDI=:').intermediaires[0].notes[0].valeurs.protocole, 'h2 — HTTP/2 (RFC 9113)');
  egal('§2.1.4 : received-status', ps('ExampleCDN; received-status=200').intermediaires[0].notes[0].valeurs.statut, 200);
  const exemple215 = ps('proxy.example.net; error="http_protocol_error"; details="Malformed response header: space before colon"').intermediaires[0];
  verifier('§2.1.5 : l exemple ecrit error en chaine — lu, et signale (§2.1.1, erratum 9168)',
    cles2(exemple215).includes('erreurType') && exemple215.erreur.nom === 'http_protocol_error');
  verifier('§2.1.5 : details', exemple215.notes.some(n => n.cle === 'details' && n.valeurs.details === 'Malformed response header: space before colon'));
  verifier('§2.3.8 : une erreur qui peut venir de plus loin ne dit pas « produite par »', cles2(exemple215).includes('peutEtreAmont') && !cles2(exemple215).includes('produite'));
  /* L exemple de remontee en trailer emploie read_timeout, que le registre ne
     connait pas (il a connection_read_timeout) : dit tel quel. */
  egal('§2 : read_timeout, absent du registre', cles2(ps('ThisProxy; error=read_timeout').intermediaires[0]).join(), 'erreurInconnue');
  egal('§2 : un intermediaire sans parametre', cles2(ps('SomeOtherProxy').intermediaires[0]).join(), 'rien');
  const alerte = ps('p; error=tls_alert_received; alert-id=42; alert-message=bad_certificate; rcode="X"; zz=1', 502).intermediaires[0];
  verifier('§2.3.15 : alert-id nomme l alerte TLS', alerte.notes.some(n => n.cle === 'extra' && n.valeurs.valeur === '42 (bad_certificate)'));
  verifier('§2.1.1 : un parametre d un autre type est ignore, et dit', alerte.notes.some(n => n.cle === 'extraIgnore' && n.valeurs.cle === 'rcode'));
  verifier('§2.1 : un parametre inconnu est ignore, et dit', alerte.notes.some(n => n.cle === 'inconnu' && n.valeurs.cle === 'zz'));
  egal('§2 : liste illisible', ps('1, p,,').faits[0].cle, 'illisible');
  egal('§2 : un membre entier n est pas un nom', ps('42').faits[0].cle, 'identifiant');
  /* RFC 9532 §2 et §2.1. */
  const alias = v => ps('proxy.example.net; next-hop="2001:db8::1"; next-hop-aliases="' + v + '"').intermediaires[0].notes[1];
  egal('RFC 9532 §2 : les alias, dans l ordre', alias('tracker.example.com,service1.example.com').valeurs.noms, 'tracker.example.com, service1.example.com');
  egal('RFC 9532 §2.1 : une virgule encodee reste dans le nom', alias('comma%2Cname.example.com,service1.example.com').valeurs.noms, 'comma,name.example.com, service1.example.com');
  egal('RFC 9532 §2.1 : « \\. » reste une seule etiquette', alias('dot%5C.label.example.com,service1.example.com').valeurs.noms, 'dot\\.label.example.com, service1.example.com');
  egal('RFC 9532 §2.1 : « \\\\ » se decode', alias('backslash%5C%5Cname.example.com,s1.example.com').valeurs.noms, 'backslash\\\\name.example.com, s1.example.com');
  egal('RFC 9532 §2 : la chaine vide dit « aucun CNAME »', alias('').cle, 'aliasVide');

  /* Les registres IANA, compares a leur instantane du 13 octobre 2026. */
  const iana = JSON.parse(fs.readFileSync(path.join(ici, 'vecteurs-proxy-status-iana.json'), 'utf8'));
  egal('registre des types d erreur : les memes noms, dans le meme ordre', ERREURS_PROXY.map(e => e.nom).join(), iana.erreurs.map(e => e.nom).join());
  let justes = 0;
  for (const e of ERREURS_PROXY) {
    const r = iana.erreurs.find(x => x.nom === e.nom);
    const statutOk = /^\d+$/.test(r.statut) ? e.statut === Number(r.statut) : e.statut === null && !!e.statutRegle;
    if (statutOk && e.intermediaire === r.intermediaire && e.reference === r.reference
      && e.extras.map(x => x.cle).join() === r.extras.join()
      && EN_REF_PROXY[e.sens] === (r.description + (r.notes ? ' ' + r.notes : '')).replace(/'/g, '’')) justes++;
    else verifier('type d erreur conforme au registre : ' + e.nom, false);
  }
  egal('registre : statut recommande, origine de la reponse, parametres et description anglaise, pour chacun des ' + ERREURS_PROXY.length, justes, iana.erreurs.length);
  egal('registre des parametres : les memes', PARAMETRES_PROXY.map(p => p.cle + ' ' + p.reference).join(), iana.parametres.map(p => p.nom + ' ' + p.reference).join());
  verifier('registre des parametres : description anglaise mot pour mot',
    PARAMETRES_PROXY.every(p => EN_REF_PROXY[p.sens] === iana.parametres.find(x => x.nom === p.cle).description.replace(/'/g, '’')));
  verifier('trente-trois types d erreur, dont incremental_refused (RFC 10036)', ERREURS_PROXY.length === 33 && ERREURS_PROXY.some(e => e.nom === 'incremental_refused' && e.reference === 'RFC 10036'));
}

/* ================== 7 bis. Des valeurs hostiles, par milliers ============== */
/* Ces lecteurs recoivent ce qu un serveur quelconque envoie. Aucune valeur ne
   doit les faire lever, ni les ralentir : un generateur deterministe compose
   des valeurs avec les caracteres qui comptent dans leurs grammaires. */
{
  let graine = 20261008;
  const hasard = n => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine % n; };
  const MORCEAUX = ['"', ';', ',', '=', ':', '@', '<', '>', '\\', '*', ' ', '\t', 'h3', '1688169599', '-', '?1', '?0',
    'u', 'i', 'r', 't', 'q', 'w', 'ma', 'rel', 'next', 'GMT', 'Sun', 'Nov', '06', '1994', '%', 'é', '\u0000', '(', ')',
    'hit', 'fwd', 'stale', 'clear', 'error', 'next-hop', 'next-hop-aliases', 'received-status', 'dns_error', ':aDI=:', 'title*', "UTF-8'de'", 'limit', 'reset', '9'.repeat(30), '.'];
  const valeur = () => { let s = ''; const n = 1 + hasard(14); for (let k = 0; k < n; k++) s += MORCEAUX[hasard(MORCEAUX.length)]; return s; };
  const lecteurs = [
    ['date HTTP', v => lireDateHttp(v, T0)],
    ['Deprecation / Sunset', v => lireCycleDeVie(h({ Deprecation: v, Sunset: v, Link: v }), { maintenant: T0 })],
    ['RateLimit', v => lireLimitesDebit(h({ RateLimit: v, 'RateLimit-Policy': v, 'Retry-After': v, 'X-RateLimit-Reset': v }), { statut: 429, instantReponse: T0, maintenant: T0 })],
    ['Link', v => lireLiens(v, 'https://exemple.test/')],
    ['Alt-Svc', v => lireAltSvc(h({ 'Alt-Svc': v }), { age: 10, protocole: 'h2' })],
    ['Cache-Status', v => lireCacheStatus(h({ 'Cache-Status': v }), { statut: 200 })],
    ['CDN-Cache-Control', v => lireCdnCacheControl(h({ 'CDN-Cache-Control': v }))],
    ['Priority', v => lirePriorite(v, 'requete')],
    ['Proxy-Status', v => lireProxyStatus(h({ 'Proxy-Status': v }), { statut: 502 })]
  ];
  const debut = Date.now();
  for (const [nom, lire] of lecteurs) {
    let levees = 0;
    let exemple = '';
    for (let n = 0; n < 3000; n++) {
      const v = valeur();
      try { lire(v); } catch { levees++; exemple = exemple || v; }
    }
    egal('valeurs hostiles : ' + nom + ' ne leve jamais (3000 essais)', levees, 0);
    if (levees) verifier('premiere valeur qui fait lever', false, JSON.stringify(exemple));
  }
  const longue = '<' + 'a'.repeat(200000) + '>; rel=next, '.repeat(2) + '"'.repeat(50000);
  for (const [nom, lire] of lecteurs) { try { lire(longue); } catch { verifier('valeur geante : ' + nom + ' ne leve pas', false); } }
  verifier('valeurs hostiles : vingt-sept mille lectures en moins de dix secondes', Date.now() - debut < 10000, (Date.now() - debut) + ' ms');
}

/* ============= 8. Le noyau, le verdict, la Synthese et l onglet =========== */
const { retraitDe, summarize } = await import('../background/core/store.js');
const { analyze } = await import('../background/core/analyzer.js');
const rec = enregistrementExemple({ id: 9301, url: 'https://api.exemple.test/v1/commandes', statusCode: 429 });
rec.responseHeaders = h({ Deprecation: '@1688169599', Sunset: 'Sun, 30 Jun 2030 23:59:59 GMT',
  'Retry-After': '120', RateLimit: '"default";r=0;t=120', Link: '<https://doc.exemple.test/depreciation>; rel="deprecation"' });
egal('noyau : dates de retrait dans le resume', JSON.stringify(summarize(rec).retrait),
  JSON.stringify({ depreciee: true, deprecation: 1688169599000, fin: Date.UTC(2030, 5, 30, 23, 59, 59) }));
egal('noyau : rien sans Deprecation ni Sunset', retraitDe(enregistrementExemple({ id: 9302 })), null);
await config.set({ analyzerEnabled: true });
analyze(rec, { force: true });
for (const tag of ['deprecie', 'quota', 'retry-after']) {
  verifier('marqueur ' + tag, rec.analysis && rec.analysis.tags.includes(tag), JSON.stringify(rec.analysis && rec.analysis.tags));
}

const { signauxDe } = await import('../ui/lib/verdict.js');
const { setLang } = await import('../ui/lib/i18n.js');
setLang('fr');
const lignes = signauxDe(rec, T0);
{
  const passerelle = enregistrementExemple({ id: 9307, url: 'https://exemple.test/', statusCode: 504 });
  passerelle.responseHeaders = h({ 'Proxy-Status': 'revproxy1.example.net, ExampleCDN; error=connection_timeout' });
  const l = signauxDe(passerelle, T0).find(x => x.cle === 'intermediaire');
  verifier('verdict : un 504 produit par le CDN lui-meme le dit', !!l && l.valeurs.nom === 'ExampleCDN' && l.valeurs.erreur === 'connection_timeout');
  passerelle.responseHeaders = h({ 'Proxy-Status': 'ExampleCDN; received-status=504' });
  verifier('verdict : un intermediaire qui ne fait que relayer ne dit rien', !signauxDe(passerelle, T0).some(x => x.cle === 'intermediaire'));
}
egal('verdict : quand reessayer, puis l avenir annonce', lignes.map(l => l.cle).join(), 'attendre,depreciee,finPrevue');
egal('verdict : attente lisible', lignes[0].valeurs.attente, '2 min 0 s');
egal('verdict : jour de fin', lignes[2].valeurs.jour, '2030-06-30');

const { state } = await import('../ui/app.js');
const { signaux } = await import('../ui/console/signaux-detail.js');
const texte = noeud => {
  const morceaux = [];
  const parcourir = n => { if (n && n.textContent) morceaux.push(n.textContent); for (const e of (n && n.children) || []) parcourir(e); };
  parcourir(noeud);
  return morceaux.join(' | ');
};
state.records = new Map();
const complet = enregistrementExemple({ id: 9303, url: 'https://exemple.test/page', statusCode: 200 });
complet.requestHeaders = h({ Priority: 'u=0, i' });
complet.responseHeaders = h({
  Deprecation: '@1688169599', 'Retry-After': '30', 'RateLimit-Policy': '"burst";q=100;w=60', RateLimit: '"burst";r=40;t=20',
  Link: '</style.css>; rel=preload; as=style, <https://exemple.test/page?p=2>; rel="next"',
  'Alt-Svc': 'h3=":443"; ma=86400', 'Cache-Status': 'ExampleCache; hit; ttl=376', 'CDN-Cache-Control': 'max-age=600',
  'Cache-Control': 'max-age=60', Priority: 'u=1', 'Proxy-Status': 'ExampleCDN; error=connection_timeout'
});
for (const langue of ['fr', 'en']) {
  setLang(langue);
  const conteneur = document.createElement('div');
  conteneur.appendChild(signaux(complet));
  const vu = texte(conteneur);
  verifier('onglet [' + langue + '] : sept blocs', ['RFC 9745', 'Retry-After', 'RFC 8288', 'RFC 7838', 'CDN-Cache-Control', 'RFC 9209', 'RFC 9218'].every(m => vu.includes(m)), vu.slice(0, 160));
  verifier('onglet [' + langue + '] : aucune lecture en echec', !/Lecture impossible|Reading failed/.test(vu));
}
/* Un delai absurde : sa date sort de ce que JavaScript represente. */
{
  const absurde = enregistrementExemple({ id: 9305, url: 'https://exemple.test/', statusCode: 429 });
  absurde.responseHeaders = h({ 'Retry-After': '9'.repeat(30), 'X-RateLimit-Reset': '9'.repeat(30) });
  const c = document.createElement('div');
  c.appendChild(signaux(absurde));
  verifier('Retry-After de trente chiffres : le bloc se dessine', !/Lecture impossible|Reading failed/.test(texte(c)), texte(c).slice(0, 120));
}

/* Dix mille politiques epuisees : faits et lignes passent par les lots. */
{
  const quotas = enregistrementExemple({ id: 9306, url: 'https://exemple.test/', statusCode: 429 });
  quotas.responseHeaders = h({ RateLimit: Array.from({ length: 10000 }, (_, k) => '"p' + k + '";r=0;t=60').join(', ') });
  const debut = Date.now();
  const c = document.createElement('div');
  c.appendChild(signaux(quotas));
  verifier('dix mille quotas epuises : l onglet se dessine en moins d une seconde', Date.now() - debut < 1000, (Date.now() - debut) + ' ms');
}

/* Cinq mille liens dans une reponse : rendus par lots, l onglet ne fige pas. */
{
  const enorme = enregistrementExemple({ id: 9304, url: 'https://exemple.test/', statusCode: 200 });
  enorme.responseHeaders = h({ Link: Array.from({ length: 5000 }, (_, k) => '</p' + k + '>; rel="next"').join(', ') });
  const debut = Date.now();
  const c = document.createElement('div');
  c.appendChild(signaux(enorme));
  const duree = Date.now() - debut;
  verifier('cinq mille liens : l onglet se dessine en moins d une seconde', duree < 1000, duree + ' ms');
  verifier('cinq mille liens : tous comptes dans le titre', texte(c).includes('5000'));
}

setLang('en');
const anglais = (() => { const c = document.createElement('div'); c.appendChild(signaux(complet)); return texte(c); })();
verifier('onglet en anglais : les phrases sont traduites', anglais.includes('Future of the address') && anglais.includes('Caches crossed')
  && !anglais.includes('Avenir de l adresse'));
setLang('fr');

bilan('Signaux HTTP');
