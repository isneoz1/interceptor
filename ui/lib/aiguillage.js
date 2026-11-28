/* Quel outil pour ce texte ? — SWIFT (by D4RK)
 *
 * Trente-quatre outils, c est beaucoup a parcourir quand on ne sait pas ce
 * qu on a colle. Ce module regarde la forme du texte de travail et propose
 * les outils qui sauront le lire, avec la raison : « un jeton JWT », « une
 * commande cURL a envoyer », « un domaine : qui l a enregistre ».
 *
 * Rien n est decode ni envoye ici : ce ne sont que des formes reconnues. Le
 * premier caractere significatif et quelques expressions suffisent ; un
 * long texte n est regarde qu au debut, pour que la saisie reste fluide.
 */
import { decoderJwt } from './inspect.js';
import { estIpv4, estIpv6 } from './net.js';
import { lireIdentifiant } from './identifiants.js';

const REGARDE = 20000;
const MAX = 4;

/* Un nom de domaine : des etiquettes, puis un domaine de premier niveau fait
   de lettres (ou xn-- pour un nom international). */
const domaine = /^(?=.{4,253}\.?$)(?:[a-z0-9_](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})\.?$/i;

function base64Octets(texte, limite = 64) {
  const propre = texte.replace(/\s+/g, '');
  if (propre.length < 8 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(propre)) return null;
  try {
    const norme = propre.replace(/-/g, '+').replace(/_/g, '/');
    const complet = norme + '='.repeat((4 - (norme.length % 4)) % 4);
    const binaire = atob(complet.substring(0, Math.min(complet.length, Math.ceil(limite / 3) * 4)));
    return Uint8Array.from(binaire, c => c.charCodeAt(0));
  } catch { return null; }
}

const commence = (octets, ...motif) => octets && motif.every((o, i) => octets[i] === o);
const estImage = o => commence(o, 0xff, 0xd8, 0xff) || commence(o, 0x89, 0x50, 0x4e, 0x47)
  || (commence(o, 0x52, 0x49, 0x46, 0x46) && o.length > 11 && o[8] === 0x57 && o[9] === 0x45 && o[10] === 0x42 && o[11] === 0x50);
const lisible = o => o && o.length && [...o].filter(c => c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)).length / o.length > 0.9;

/**
 * @returns [{ outil, raison }] — au plus quatre, du plus sur au moins sur.
 */
export function suggererOutils(entree) {
  const complet = String(entree == null ? '' : entree);
  const texte = (complet.length > REGARDE ? complet.substring(0, REGARDE) : complet).trim();
  const sortie = [];
  const proposer = (outil, raison) => { if (!sortie.some(s => s.outil === outil)) sortie.push({ outil, raison }); };
  if (!texte) return sortie;
  const premiereLigne = texte.split(/\r?\n/)[0].trim();
  const unMot = !/\s/.test(texte);

  /* Jeton JWT, avec ou sans « Bearer ». */
  const jeton = texte.replace(/^Bearer\s+/i, '');
  if (/^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(jeton)) {
    try { decoderJwt(jeton); proposer('jwt', 'un jeton JWT'); } catch { /* trois parties, mais pas un JWT */ }
  }

  /* Commandes et messages HTTP. */
  if (/^curl(\.exe)?\s/i.test(texte)) {
    proposer('requete', 'une commande cURL a envoyer');
    proposer('code', 'une commande cURL a traduire en code');
  }
  if (/^[A-Z]+\s+\S+\s+HTTP\/[0-9.]+$/.test(premiereLigne)) {
    proposer('requete', 'une requete HTTP brute a envoyer');
    proposer('code', 'une requete HTTP a traduire en code');
  }
  if (/^HTTP\/[0-9.]+\s+[0-9]{3}/.test(premiereLigne) || /^< HTTP\/[0-9.]+\s+[0-9]{3}/m.test(texte)) {
    proposer('reponse', 'une reponse HTTP a juger');
  }

  /* Adresses. */
  if (unMot && /^wss?:\/\/\S+$/i.test(texte)) proposer('websocket', 'une adresse WebSocket');
  if (unMot && /^https?:\/\/\S+$/i.test(texte)) {
    if (/\/graphql(\/|\?|$)/i.test(texte)) proposer('graphql', 'un point d acces GraphQL');
    proposer('verifier', 'un site a verifier');
    proposer('url', 'une adresse a decouper');
    proposer('requete', 'une adresse a interroger');
  }
  if (unMot && /^otpauth:\/\//i.test(texte)) proposer('otp', 'un lien otpauth');
  const ip = texte.replace(/^\[|\]$/g, '').split('/')[0];
  if (unMot && (estIpv4(ip) || estIpv6(ip))) {
    proposer('adresse', 'une adresse IP');
    proposer('rdap', 'a qui appartient cette adresse');
    proposer('dns', 'son nom inverse (PTR)');
  }
  if (unMot && /^AS[0-9]{1,10}$/i.test(texte)) proposer('rdap', 'un systeme autonome');
  if (unMot && domaine.test(texte) && !estIpv4(texte) && !sortie.some(x => x.outil === 'jwt')) {
    proposer('verifier', 'un site a verifier');
    proposer('dns', 'un nom a resoudre');
    proposer('rdap', 'un domaine : qui l a enregistre');
  }

  /* Cles et certificats. */
  if (/-----BEGIN CERTIFICATE-----/.test(texte)) {
    proposer('binaire', 'un certificat X.509');
    proposer('cle', 'la cle publique d un certificat');
  }
  if (/-----BEGIN (RSA |EC )?PUBLIC KEY-----/.test(texte) || /^(ssh-(rsa|ed25519|ed448|dss)|ecdsa-sha2-nistp[0-9]+)\s+AAAA/m.test(texte)) {
    proposer('cle', 'une cle publique');
  }

  /* Documents structures. */
  if (/^[[{]/.test(texte)) {
    let json;
    try { json = JSON.parse(complet); } catch { json = undefined; }
    if (json !== undefined) {
      if (json && typeof json === 'object' && !Array.isArray(json) && typeof json.kty === 'string') proposer('cle', 'une cle JWK');
      else if (json && typeof json === 'object' && Array.isArray(json.keys)) proposer('cle', 'un jeu de cles JWKS');
      if (Array.isArray(json) && json.length && json.every(o => o && typeof o === 'object' && typeof o.op === 'string' && typeof o.path === 'string')) {
        proposer('patch', 'un JSON Patch');
      }
      if (json && typeof json === 'object' && typeof json.query === 'string') proposer('graphql', 'une requete GraphQL en JSON');
      proposer('analyse', 'du JSON a parcourir');
    }
  }
  if (/^(query|mutation|subscription|fragment)\b[^{]*\{/.test(texte) || /^\{\s*[A-Za-z_][A-Za-z0-9_]*\s*[({]/.test(texte)) {
    proposer('graphql', 'une requete GraphQL');
  }
  if (/^<\?xml|^<[A-Za-z][\w:.-]*[\s/>]/.test(texte)) proposer('analyse', 'du XML a parcourir');
  if (/^(a:[0-9]+:\{|O:[0-9]+:"|s:[0-9]+:"|i:-?[0-9]+;|b:[01];)/.test(texte)) proposer('analyse', 'une valeur PHP serialisee');

  /* En-tetes : plusieurs lignes « Nom: valeur ». */
  const lignes = texte.split(/\r?\n/).filter(l => l.trim());
  if (lignes.length >= 2 && lignes.filter(l => /^[A-Za-z0-9-]+:\s?\S/.test(l)).length >= Math.max(2, lignes.length * 0.6)) {
    proposer('entetes', 'des en-tetes a decouper');
    proposer('reponse', 'des en-tetes de reponse a juger');
  }
  if (/^(Set-)?Cookie:\s/i.test(texte)) proposer('entetes', 'un en-tete de cookie');

  /* Valeurs isolees. */
  if (unMot) {
    if (/^[0-9]{9,19}(\.[0-9]+)?$/.test(texte)) proposer('temps', 'un horodatage');
    if (lireIdentifiant(texte).length) proposer('identifier', 'un identifiant qui porte une date');
    if (/^[0-9a-f]+$/i.test(texte) && [32, 40, 56, 64, 96, 128].includes(texte.length)) proposer('identifier', 'une empreinte probable');
    if (/^data:image\//i.test(texte)) proposer('metadonnees', 'une image a lire');
    const octets = base64Octets(texte);
    if (octets && estImage(octets)) proposer('metadonnees', 'une image en base64');
    else if (octets && !/^[0-9]+$/.test(texte) && !/^[0-9a-f]+$/i.test(texte) && (lisible(octets) || texte.length % 4 === 0 && /[+/=]/.test(texte))) {
      proposer('transformer', 'du base64 a decoder');
    }
    if (/%[0-9A-F]{2}/i.test(texte)) proposer('transformer', 'du texte encode pour URL');
  }
  if (/^([0-9a-f]{2}[\s:-]?){4,}$/i.test(texte) && !unMot || /^(0x)?([0-9a-f]{2}){8,}$/i.test(texte) && texte.length % 2 === 0 && ![32, 40, 56, 64, 96, 128].includes(texte.length)) {
    proposer('hex', 'des octets en hexadecimal');
  }
  if (/\beval\s*\(|\bfunction\s*\(|=>\s*\{|\bvar\s+_0x/.test(texte) && !sortie.length) proposer('code', 'du code JavaScript a rendre lisible');

  return sortie.length > MAX ? sortie.filter((_, i) => i < MAX) : sortie;
}

/* Toutes les raisons que ce module peut donner : le controle de traduction
   les verifie une a une. */
export const RAISONS_AIGUILLAGE = [
  'un jeton JWT', 'une commande cURL a envoyer', 'une commande cURL a traduire en code',
  'une requete HTTP brute a envoyer', 'une requete HTTP a traduire en code', 'une reponse HTTP a juger',
  'une adresse WebSocket', 'un point d acces GraphQL', 'un site a verifier', 'une adresse a decouper',
  'une adresse a interroger', 'un lien otpauth', 'une adresse IP', 'a qui appartient cette adresse',
  'son nom inverse (PTR)', 'un systeme autonome', 'un nom a resoudre', 'un domaine : qui l a enregistre',
  'un certificat X.509', 'la cle publique d un certificat', 'une cle publique', 'une cle JWK',
  'un jeu de cles JWKS', 'un JSON Patch', 'une requete GraphQL en JSON', 'du JSON a parcourir',
  'une requete GraphQL', 'du XML a parcourir', 'une valeur PHP serialisee', 'des en-tetes a decouper',
  'des en-tetes de reponse a juger', 'un en-tete de cookie', 'un identifiant qui porte une date',
  'un horodatage', 'une empreinte probable', 'une image a lire', 'une image en base64',
  'du base64 a decoder', 'du texte encode pour URL', 'des octets en hexadecimal',
  'du code JavaScript a rendre lisible'
];
