/* Panneau « Resolution DNS » — SWIFT (by D4RK)
 *
 * Deux manieres de demander un nom, toutes deux sur un clic :
 *
 *   Resolveur de Firefox  dns.resolve, comme pour une page — DNS sur HTTPS
 *                         si le reglage TRR de Firefox est actif : les
 *                         adresses, le nom canonique ;
 *   DNS sur HTTPS         une question au format filaire (RFC 1035) posee a
 *                         un resolveur public ou au votre (RFC 8484), pour
 *                         tous les types — MX, TXT, CAA, HTTPS, SOA, DNSSEC —
 *                         et le « Bilan du domaine » : web, courrier (SPF,
 *                         DMARC, MTA-STS, TLS-RPT), securite (CAA, DNSSEC),
 *                         zone, lus en clair (lib/dns-lectures.js).
 *
 * Le second mode envoie le nom a un tiers, le resolveur choisi : comme toute
 * requete partie de SWIFT vers une destination choisie, il demande que le
 * rejeu ait ete autorise.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { cmd, toast, copy } from '../app.js';
import { ms, clock } from '../lib/format.js';
import { estIpv4, estIpv6, categorieIpv4, categorieIpv6 } from '../lib/net.js';
import { base64VersOctets } from '../lib/bytes.js';
import { lireMessageDns, ligneEnregistrement } from '../lib/dns-message.js';
import { TYPES_DNS, nomPourPtr } from '../lib/dns-requete.js';
import {
  texteTxt, classerTxt, lireSpf, lireDmarc, lireCaa, lireMx, lireSvcb, lireSoa, lireMtaSts, lireTlsRpt, lireDkim,
  bilanDomaine, QUESTIONS_BILAN
} from '../lib/dns-lectures.js';
import { envoiPermis, boutonAutoriser } from './tools-requete.js';

const SYMBOLE = { present: '✓', absent: '—', partiel: '◐', inoperant: '✗', info: '·' };
const RESOLVEURS = [['cloudflare', 'Cloudflare (1.1.1.1)'], ['google', 'Google (8.8.8.8)'], ['quad9', 'Quad9 (9.9.9.9)'],
  ['autre', 'Autre resolveur (adresse https)']];

/* Le nom a resoudre, lu dans le texte de travail : une adresse complete, ou
   un nom d hote seul. Un nom international passe en punycode, la forme que
   DNS connait. */
export function nomDepuisTexte(texte) {
  const brut = String(texte == null ? '' : texte).trim();
  if (!brut || /\s/.test(brut)) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(brut) ? brut : 'http://' + brut);
    const hote = u.hostname.replace(/^\[|\]$/g, '');
    return estIpv4(hote) || estIpv6(hote) ? '' : hote;
  } catch { return ''; }
}

function categorie(adresse) {
  try {
    if (estIpv4(adresse)) return t(categorieIpv4(adresse));
    if (estIpv6(adresse)) return t(categorieIpv6(adresse));
  } catch { /* adresse inattendue : on la montre sans categorie */ }
  return '';
}

const traduireValeurs = f => {
  const valeurs = { ...(f.valeurs || {}) };
  for (const cle of f.aTraduire || []) valeurs[cle] = t(valeurs[cle]);
  return valeurs;
};

/* Ce que dit un enregistrement, en clair, quand on sait le lire. */
function lectures(rr) {
  const sortie = [];
  if (rr.typeNom === 'TXT') {
    const texte = texteTxt(rr.donnees);
    const genre = classerTxt(texte);
    if (genre === 'spf') for (const f of lireSpf(texte).faits) sortie.push(tp(f.texte, traduireValeurs(f)));
    else if (genre === 'dmarc') for (const f of lireDmarc(texte).faits) sortie.push(tp(f.texte, traduireValeurs(f)));
    else if (genre === 'mta-sts') sortie.push(tp('MTA-STS : politique publiee (identifiant {id})', { id: lireMtaSts(texte).id || '?' }));
    else if (genre === 'tls-rpt') sortie.push(tp('TLS-RPT : rapports envoyes a {rua}', { rua: lireTlsRpt(texte).rua || '?' }));
    else if (genre === 'dkim') {
      const d = lireDkim(texte);
      sortie.push(d.revoquee ? t('DKIM : cle revoquee (p= vide)') : tp('DKIM : cle {k} de {n} octets', { k: d.k, n: d.octetsCle }));
    } else if (genre === 'bimi') sortie.push(t('BIMI : logo de marque pour les messageries'));
    else if (genre === 'verification') sortie.push(t('preuve de propriete du domaine pour un service tiers'));
  } else if (rr.typeNom === 'CAA') {
    const c = lireCaa(rr.donnees);
    if (c) sortie.push(tp(c.fait.texte, c.fait.valeurs));
  } else if (rr.typeNom === 'MX') {
    const m = lireMx(rr.donnees);
    if (m && m.nul) sortie.push(t('MX nul : ce domaine ne recoit aucun courrier (RFC 7505)'));
  } else if (rr.typeNom === 'HTTPS' || rr.typeNom === 'SVCB') {
    const s = lireSvcb(rr.donnees);
    if (s) for (const f of s.faits) sortie.push(tp(f.texte, f.valeurs));
  } else if (rr.typeNom === 'SOA') {
    const s = lireSoa(rr.donnees);
    if (s) sortie.push(tp('zone geree par {primaire}, contact {courriel}, serie {serie}', s));
  } else if (rr.typeNom === 'A' || rr.typeNom === 'AAAA') {
    const c = categorie(rr.donnees);
    if (c) sortie.push(c);
  }
  return sortie;
}

/* Une reponse DNS sur HTTPS, lue et montree. */
function carteDoh(r) {
  const carte = el('div', { class: 'find info' }, [el('h4', { text: r.nom + '  ' + r.type })]);
  let m;
  try { m = lireMessageDns(base64VersOctets(r.octets)); }
  catch (e) {
    carte.appendChild(el('p', { class: 'note warn', text: t('Reponse illisible : ') + te(e) }));
    return carte;
  }
  add(carte, kv('Code de reponse', m.rcodeNom, { hl: m.rcode !== 0 }));
  add(carte, kv('Resolveur', r.resolveur, { copy: true }));
  add(carte, kv('Duree mesuree', ms(r.duree)));
  add(carte, kv('Validee par DNSSEC (AD)', m.drapeaux.AD ? t('oui') : t('non')));
  for (const f of m.faits) carte.appendChild(el('p', { class: 'note', text: tp(f.texte, f.valeurs) }));
  if (!m.reponses.length) {
    carte.appendChild(el('p', { class: 'note', text: m.rcode === 3
      ? t('Le nom n existe pas (NXDOMAIN).')
      : t('Aucun enregistrement de ce type pour ce nom.') }));
  }
  for (const rr of m.reponses) {
    add(carte, kv(rr.typeNom + '  ' + rr.ttl + ' s', rr.donnees, { copy: true }));
    for (const lu of lectures(rr)) carte.appendChild(el('p', { class: 'note', text: '→ ' + lu }));
  }
  for (const rr of m.autorite) add(carte, kv(t('Autorite') + '  ' + rr.typeNom, rr.donnees, { copy: true }));
  carte.appendChild(el('div', { class: 'actions' }, [
    button('Copier les enregistrements', () => copy(m.reponses.map(ligneEnregistrement).join('\n'), 'Enregistrements copies'))
  ]));
  return carte;
}

export function panneauDns(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Resolution DNS', 'le resolveur de Firefox, ou tous les enregistrements par DNS sur HTTPS'));

  if (etat.dnsNom == null) etat.dnsNom = nomDepuisTexte(entree);
  const mode = el('select', { dataset: { champ: 'dns-mode' } });
  for (const [valeur, libelle] of [['firefox', 'Resolveur de Firefox (adresses)'], ['doh', 'DNS sur HTTPS (tous les types)']]) {
    mode.appendChild(el('option', { value: valeur, text: t(libelle), selected: (etat.dnsMode || 'firefox') === valeur }));
  }
  mode.addEventListener('change', () => { etat.dnsMode = mode.value; redessiner(); });
  const nom = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.dnsNom || '',
    placeholder: t('nom d hote, par exemple example.com'), dataset: { champ: 'dns-nom' }
  });
  nom.addEventListener('change', () => { etat.dnsNom = nom.value; });
  box.appendChild(el('div', { class: 'actions' }, [mode, nom]));

  if ((etat.dnsMode || 'firefox') === 'doh') panneauDoh(box, etat, redessiner, nom);
  else panneauFirefox(box, etat, redessiner, nom);
  return box;
}

/* --------------------------- Resolveur de Firefox ------------------------- */
function panneauFirefox(box, etat, redessiner, nom) {
  const famille = el('select', { dataset: { champ: 'dns-famille' } });
  for (const [valeur, libelle] of [['', 'IPv4 et IPv6'], ['ipv4', 'IPv4 seulement'], ['ipv6', 'IPv6 seulement']]) {
    famille.appendChild(el('option', { value: valeur, text: t(libelle), selected: (etat.dnsFamille || '') === valeur }));
  }
  famille.addEventListener('change', () => { etat.dnsFamille = famille.value; });
  const sansCache = el('input', { type: 'checkbox', checked: !!etat.dnsSansCache, dataset: { champ: 'dns-sans-cache' } });
  sansCache.addEventListener('change', () => { etat.dnsSansCache = sansCache.checked; });

  const resoudre = button(etat.dnsEnCours ? 'Resolution…' : 'Resoudre', async () => {
    if (etat.dnsEnCours) return;
    etat.dnsNom = nom.value;
    etat.dnsFamille = famille.value;
    etat.dnsSansCache = sansCache.checked;
    const cible = nomDepuisTexte(etat.dnsNom);
    if (!cible) return toast('Nom d hote attendu, par exemple example.com', false);
    etat.dnsEnCours = true;
    redessiner();
    const res = await cmd('dnsResolve', { nom: cible, sansCache: etat.dnsSansCache, famille: etat.dnsFamille });
    etat.dnsEnCours = false;
    if (res.error) { etat.dnsErreur = res.error; toast(te(res.error), false); }
    else { etat.dnsErreur = null; etat.dnsResultats = [res.resultat, ...(etat.dnsResultats || [])]; }
    redessiner();
  }, { class: 'accent' });
  box.appendChild(el('div', { class: 'actions' }, [famille, resoudre]));
  box.appendChild(el('div', { class: 'actions' }, [
    el('label', { class: 'inline' }, [sansCache, el('span', { text: t('Ignorer le cache de Firefox') })])
  ]));

  if (etat.dnsErreur) box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + te(etat.dnsErreur) }));
  const resultats = etat.dnsResultats || [];
  if (!resultats.length) {
    box.appendChild(el('p', { class: 'note', text:
      t('Firefox resout le nom comme pour une page : par DNS sur HTTPS si son reglage TRR est actif, sinon par le systeme. Rien ne part sans un clic sur « Resoudre ».') }));
  }
  for (const r of resultats) {
    const carte = el('div', { class: 'find info' }, [el('h4', { text: r.nom })]);
    add(carte, kv('Adresses', r.adresses.length, { always: true }));
    for (const a of r.adresses) add(carte, kv(a, categorie(a) || '—', { copy: true }));
    add(carte, kv('Nom canonique', r.canonique && r.canonique !== r.nom ? r.canonique : null, { copy: true }));
    add(carte, kv('DNS sur HTTPS (TRR)', r.trr ? t('oui') : t('non')));
    add(carte, kv('Duree mesuree', ms(r.duree)));
    add(carte, kv('Resolu a', clock(r.a)));
    if (r.adresses.length) {
      carte.appendChild(el('div', { class: 'actions' }, [
        button('Copier les adresses', () => copy(r.adresses.join('\n'), 'Adresses copiees'))
      ]));
    }
    box.appendChild(carte);
  }
}

/* ------------------------------ DNS sur HTTPS ----------------------------- */
function panneauDoh(box, etat, redessiner, nom) {
  const type = el('select', { dataset: { champ: 'dns-type' } });
  for (const [n] of TYPES_DNS) type.appendChild(el('option', { value: n, text: n, selected: (etat.dnsType || 'A') === n }));
  type.addEventListener('change', () => { etat.dnsType = type.value; });
  const resolveur = el('select', { dataset: { champ: 'dns-resolveur' } });
  for (const [valeur, libelle] of RESOLVEURS) {
    resolveur.appendChild(el('option', { value: valeur, text: t(libelle), selected: (etat.dnsResolveur || 'cloudflare') === valeur }));
  }
  resolveur.addEventListener('change', () => { etat.dnsResolveur = resolveur.value; redessiner(); });
  const dnssec = el('input', { type: 'checkbox', checked: !!etat.dnsDnssec, dataset: { champ: 'dns-dnssec' } });
  dnssec.addEventListener('change', () => { etat.dnsDnssec = dnssec.checked; });
  box.appendChild(el('div', { class: 'actions' }, [type, resolveur]));
  let adresse = null;
  if ((etat.dnsResolveur || 'cloudflare') === 'autre') {
    adresse = el('input', {
      type: 'text', class: 'field', spellcheck: 'false', value: etat.dnsAdresse || '',
      placeholder: t('adresse du resolveur, par exemple https://dns.example/dns-query'), dataset: { champ: 'dns-adresse' }
    });
    adresse.addEventListener('change', () => { etat.dnsAdresse = adresse.value; });
    box.appendChild(adresse);
  }
  box.appendChild(el('p', { class: 'note warn', text:
    t('Le nom part vers le resolveur choisi, un tiers, par une requete https qui porte l en-tete X-Swift-Replay et apparait dans le tableau. Rien ne part sans un clic.') }));

  const lire = () => {
    etat.dnsNom = nom.value;
    etat.dnsType = type.value;
    etat.dnsResolveur = resolveur.value;
    etat.dnsDnssec = dnssec.checked;
    if (adresse) etat.dnsAdresse = adresse.value;
  };
  /* Une adresse IP se demande en PTR, sous in-addr.arpa ou ip6.arpa. */
  const cibleDe = () => {
    const brut = String(etat.dnsNom || '').trim().replace(/^\[|\]$/g, '');
    const ptr = nomPourPtr(brut);
    if (ptr) return { nom: ptr, type: 'PTR' };
    const n = nomDepuisTexte(brut) || (/^[a-z0-9_.-]+$/i.test(brut) ? brut : '');
    return n ? { nom: n, type: etat.dnsType || 'A' } : null;
  };
  const demander = (nomDemande, typeDemande) => cmd('dnsDoh', {
    nom: nomDemande, type: typeDemande, resolveur: etat.dnsResolveur || 'cloudflare',
    adresse: etat.dnsAdresse || '', dnssec: !!etat.dnsDnssec
  });

  const actions = el('div', { class: 'actions' });
  if (!envoiPermis()) actions.appendChild(boutonAutoriser(redessiner));
  else {
    actions.appendChild(button(etat.dnsEnCours ? 'Resolution…' : 'Interroger', async () => {
      if (etat.dnsEnCours) return;
      lire();
      const cible = cibleDe();
      if (!cible) return toast('Nom d hote attendu, par exemple example.com', false);
      etat.dnsEnCours = true;
      redessiner();
      const res = await demander(cible.nom, cible.type);
      etat.dnsEnCours = false;
      if (res.error) { etat.dnsErreur = res.error; toast(te(res.error), false); }
      else { etat.dnsErreur = null; etat.dohResultats = [res.resultat, ...(etat.dohResultats || [])]; }
      redessiner();
    }, { class: 'accent' }));
    actions.appendChild(button(etat.dnsBilanEnCours ? 'Bilan en cours…' : 'Bilan du domaine', async () => {
      if (etat.dnsBilanEnCours) return;
      lire();
      const cible = cibleDe();
      if (!cible || cible.type === 'PTR') return toast('Nom de domaine attendu, par exemple example.com', false);
      etat.dnsBilanEnCours = true;
      redessiner();
      const reponses = new Map();
      const erreurs = [];
      await Promise.all(QUESTIONS_BILAN.map(async ([prefixe, t2]) => {
        const res = await demander(prefixe + cible.nom, t2);
        if (res.error) { erreurs.push(res.error); reponses.set(prefixe + '|' + t2, null); return; }
        try { reponses.set(prefixe + '|' + t2, lireMessageDns(base64VersOctets(res.resultat.octets))); }
        catch { reponses.set(prefixe + '|' + t2, null); }
      }));
      etat.dnsBilanEnCours = false;
      if (erreurs.length === QUESTIONS_BILAN.length) {
        etat.dnsErreur = erreurs[0];
        toast(te(erreurs[0]), false);
      } else {
        etat.dnsErreur = null;
        etat.dnsBilan = { nom: cible.nom, a: Date.now(), echecs: erreurs.length, ...bilanDomaine(reponses) };
      }
      redessiner();
    }));
  }
  actions.appendChild(el('label', { class: 'inline' }, [dnssec, el('span', { text: t('Demander les signatures DNSSEC (bit DO)') })]));
  box.appendChild(actions);

  if (etat.dnsErreur) box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + te(etat.dnsErreur) }));
  const b = etat.dnsBilan;
  if (b) {
    box.appendChild(sec(tp('Bilan de {nom}', { nom: b.nom }), clock(b.a)));
    if (b.echecs) box.appendChild(el('p', { class: 'note warn', text: tp('{n} question(s) sans reponse : le bilan est partiel.', { n: b.echecs }) }));
    for (const s of b.sections) {
      box.appendChild(sec(s.nom, s.lignes.length));
      for (const l of s.lignes) add(box, kv(SYMBOLE[l.etat], tp(l.texte, traduireValeurs(l)), { hl: l.etat === 'inoperant' }));
    }
  }
  const resultats = etat.dohResultats || [];
  if (!resultats.length && !b) {
    box.appendChild(el('p', { class: 'note', text:
      t('Choisissez un type — MX pour le courrier, TXT pour SPF et les preuves de propriete, CAA, HTTPS — ou demandez le bilan du domaine : douze questions, lues en clair.') }));
  }
  for (const r of resultats) box.appendChild(carteDoh(r));
}
