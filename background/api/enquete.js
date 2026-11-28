/* Enqueter sur un site — commandes du noyau — SWIFT (by D4RK)
 *
 * Trois outils de la famille « Interroger le reseau » qui partent du noyau :
 *
 *   verifierSite  la page d accueil en https, la meme en http, et
 *                 /.well-known/security.txt ; rend ce que fetch a vu et
 *                 l identifiant de chaque requete capturee, pour que
 *                 l interface lise TLS, certificat, redirections et cookies
 *                 dans la capture elle-meme ;
 *   dnsDoh        une question DNS posee a un resolveur DNS sur HTTPS
 *                 (RFC 8484), tous types d enregistrements ;
 *   rdap          qui a enregistre un domaine, a qui appartient une adresse
 *                 ou un numero AS (RDAP, RFC 9082 et 9083), le serveur etant
 *                 trouve dans les fichiers d amorce de l IANA (RFC 9224).
 *
 * Toutes ne partent que sur un clic, et seulement quand le rejeu a ete
 * autorise : c est la meme permission que toute requete envoyee depuis
 * SWIFT vers une destination choisie. Aucune n emporte les cookies de
 * l utilisateur. Chacune porte X-Swift-Replay, et apparait dans le tableau.
 */
import { config } from '../core/config.js';
import { store } from '../core/store.js';
import { construireRequeteDns, codeTypeDns } from '../../ui/lib/dns-requete.js';
import { requeteRdap, choisirServeurRdap, AMORCES_RDAP } from '../../ui/lib/rdap.js';
import { octetsVersBase64 } from '../../ui/lib/bytes.js';
import { hoteAVerifier, NOM_HOTE } from '../../ui/lib/verification-site.js';

/* Le meme texte que le rejeu : l interface sait deja le traduire. */
const DESACTIVE = 'Le rejeu est desactive. Reglages -> Interception active -> Autoriser le rejeu.';
const DELAI = 15000;

export const RESOLVEURS_DOH = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google: 'https://dns.google/dns-query',
  quad9: 'https://dns.quad9.net/dns-query'
};

/** fetch, abandonne au bout de quinze secondes. */
async function avecDelai(url, init, delai = DELAI) {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), delai);
  try { return await fetch(url, { ...init, signal: controle.signal }); }
  catch (e) {
    if (e && e.name === 'AbortError') throw new Error('pas de reponse en ' + Math.round(delai / 1000) + ' s');
    throw e;
  } finally { clearTimeout(minuteur); }
}

const message = e => String((e && e.message) || e);

function adresseHttps(texte) {
  try {
    const u = new URL(String(texte || '').trim());
    return u.protocol === 'https:' && u.hostname ? u.href : null;
  } catch { return null; }
}

/* ------------------------------ Verifier un site -------------------------- */
/* L enregistrement que la capture a fait d une requete marquee. Il peut
   arriver un peu apres la reponse : on l attend deux secondes au plus. */
async function enregistrementMarque(marque, attente = 2000) {
  const fin = Date.now() + attente;
  let trouve = null;
  for (;;) {
    for (let i = store.order.length - 1, vus = 0; i >= 0 && vus < 2000; i--, vus++) {
      const rec = store.records.get(store.order[i]);
      if (rec && Array.isArray(rec.requestHeaders)
        && rec.requestHeaders.some(h => String(h.name || '').toLowerCase() === 'x-swift-verification' && h.value === marque)) {
        trouve = rec;
        break;
      }
    }
    if (trouve && trouve.state !== 'pending') return trouve.id;
    if (Date.now() >= fin) return trouve ? trouve.id : null;
    await new Promise(r => setTimeout(r, 100));
  }
}

async function sonder(url, marque, lireCorps) {
  const debut = Date.now();
  try {
    const res = await avecDelai(url, {
      method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'follow',
      headers: { 'X-Swift-Replay': '1', 'X-Swift-Verification': marque }
    });
    const entetes = [];
    res.headers.forEach((value, name) => entetes.push({ name, value }));
    const texte = await res.text().catch(() => '');
    return {
      url, statut: res.status, texteStatut: res.statusText, urlFinale: res.url, redirige: res.redirected,
      duree: Date.now() - debut, typeContenu: res.headers.get('content-type') || '', entetes,
      corps: lireCorps ? (texte.length > 65536 ? texte.substring(0, 65536) : texte) : null, erreur: null
    };
  } catch (e) {
    return { url, statut: null, urlFinale: null, redirige: false, duree: Date.now() - debut, entetes: [], corps: null, erreur: message(e) };
  }
}

export const ENQUETE_COMMANDS = {
  verifierSite: async ({ hote }) => {
    if (!config.get('replayEnabled')) return { error: DESACTIVE };
    const h = hoteAVerifier(hote);
    if (!h) return { error: 'adresse a verifier invalide : ' + String(hote == null ? '' : hote) };
    const marque = globalThis.crypto && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
    const plan = [['https', 'https://' + h.cible + '/', false], ['http', 'http://' + h.cible + '/', false],
      ['security.txt', 'https://' + h.cible + '/.well-known/security.txt', true]];
    const sondes = await Promise.all(plan.map(async ([role, url, corps]) => {
      const id = marque + '-' + role;
      const sonde = await sonder(url, id, corps);
      sonde.role = role;
      sonde.recordId = await enregistrementMarque(id);
      return sonde;
    }));
    return { ok: true, resultat: { hote: h.nom, cible: h.cible, a: Date.now(), sondes } };
  },

  /* ---------------------------- DNS sur HTTPS ---------------------------- */
  dnsDoh: async ({ nom, type = 'A', resolveur = 'cloudflare', adresse = '', dnssec = false }) => {
    if (!config.get('replayEnabled')) return { error: DESACTIVE };
    const hote = String(nom == null ? '' : nom).trim().replace(/\.$/, '').toLowerCase();
    if (!hote) return { error: 'nom vide' };
    if (!NOM_HOTE.test(hote)) return { error: 'nom d hote invalide : ' + hote };
    const code = codeTypeDns(type);
    if (!code) return { error: 'type DNS inconnu : ' + String(type) };
    const url = resolveur === 'autre' ? adresseHttps(adresse) : RESOLVEURS_DOH[resolveur] || null;
    if (!url) return { error: 'resolveur DNS sur HTTPS invalide : une adresse https est attendue' };
    const debut = Date.now();
    try {
      const res = await avecDelai(url, {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/dns-message', Accept: 'application/dns-message', 'X-Swift-Replay': '1' },
        body: construireRequeteDns(hote, code, { dnssec: !!dnssec })
      });
      if (!res.ok) return { error: 'le resolveur a repondu ' + res.status };
      const octets = new Uint8Array(await res.arrayBuffer());
      return { ok: true, resultat: { nom: hote, type: String(type).toUpperCase(), code, resolveur: url, a: debut,
        duree: Date.now() - debut, taille: octets.length, octets: octetsVersBase64(octets), dnssec: !!dnssec } };
    } catch (e) {
      return { error: 'resolution impossible : ' + message(e) };
    }
  },

  /* --------------------------------- RDAP -------------------------------- */
  rdap: async ({ requete, serveur = '', url = '' }) => {
    if (!config.get('replayEnabled')) return { error: DESACTIVE };
    let cible = null;
    let lu = null;
    if (url) {
      cible = adresseHttps(url);
      if (!cible) return { error: 'adresse RDAP invalide : une adresse https est attendue' };
    } else {
      lu = requeteRdap(requete);
      if (!lu) return { error: 'requete RDAP invalide : un domaine, une adresse IP ou un numero AS est attendu' };
      let base = serveur ? adresseHttps(serveur) : null;
      if (serveur && !base) return { error: 'adresse RDAP invalide : une adresse https est attendue' };
      if (!base) {
        try { base = choisirServeurRdap(await amorce(lu.amorce), lu); }
        catch { base = null; }
      }
      /* Sans amorce lisible, le redirecteur public rdap.org connait les
         memes serveurs. */
      if (!base) base = 'https://rdap.org/';
      cible = base + (base.endsWith('/') ? '' : '/') + lu.chemin;
    }
    const debut = Date.now();
    try {
      const res = await avecDelai(cible, {
        method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'follow',
        headers: { Accept: 'application/rdap+json, application/json', 'X-Swift-Replay': '1' }
      });
      const texte = await res.text();
      let json = null;
      try { json = JSON.parse(texte); } catch { json = null; }
      if (!json && res.ok) return { error: 'reponse RDAP illisible : un objet JSON est attendu' };
      return { ok: true, resultat: { requete: lu, url: res.url || cible, statut: res.status, duree: Date.now() - debut, json } };
    } catch (e) {
      return { error: 'requete RDAP impossible : ' + message(e) };
    }
  }
};

/* Les fichiers d amorce de l IANA, gardes une journee. */
const amorces = new Map();
async function amorce(cle) {
  const garde = amorces.get(cle);
  if (garde && Date.now() - garde.a < 86400000) return garde.json;
  const res = await avecDelai(AMORCES_RDAP[cle], {
    method: 'GET', credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json', 'X-Swift-Replay': '1' }
  });
  if (!res.ok) throw new Error('amorce IANA : ' + res.status);
  const json = await res.json();
  amorces.set(cle, { a: Date.now(), json });
  return json;
}

/** Pour les tests : oublier les amorces gardees. */
export function oublierAmorces() { amorces.clear(); }
