/* Calculs de prefixes — INTERCEPTOR (by D4RK)
 *
 * Decouper un reseau en sous-reseaux, resumer une liste de prefixes, passer
 * d une plage d adresses a la liste de prefixes qui la couvre exactement,
 * enumerer les adresses d un bloc. Arithmetique IPv4, ou chaque resultat se
 * verifie a la main.
 *
 * Complement de net.js, qui decrit un prefixe ; ici on en fabrique d autres.
 */
import { estIpv4, ipv4VersEntier, entierVersIpv4, analyserCidrV4 } from './net.js';

const masqueDe = bits => (bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0);

/** Nombre d adresses d un prefixe, sans passer par les flottants. */
function tailleDuPrefixe(bits) { return Math.pow(2, 32 - Number(bits)); }

/**
 * Decoupe un prefixe en sous-reseaux d une taille donnee. La liste est bornee :
 * un /8 decoupe en /30 ferait quatre millions de lignes, personne ne les lit.
 */
export function decouperPrefixe(cidr, nouveauPrefixe, limite = 1024) {
  const bloc = analyserCidrV4(cidr);
  const cible = Number(nouveauPrefixe);
  if (!Number.isInteger(cible) || cible < 0 || cible > 32) throw new Error('prefixe hors de 0 a 32');
  if (cible < bloc.prefixe) {
    throw new Error('un /' + cible + ' est plus grand que le /' + bloc.prefixe + ' de depart');
  }
  const nombre = Math.pow(2, cible - bloc.prefixe);
  const pas = tailleDuPrefixe(cible);
  const debut = ipv4VersEntier(bloc.reseau);
  const sorties = [];
  for (let i = 0; i < Math.min(nombre, limite); i++) {
    const base = debut + i * pas;
    sorties.push({
      cidr: entierVersIpv4(base) + '/' + cible,
      premiere: entierVersIpv4(cible >= 31 ? base : base + 1),
      derniere: entierVersIpv4(cible >= 31 ? base + pas - 1 : base + pas - 2),
      diffusion: entierVersIpv4(base + pas - 1)
    });
  }
  return { total: nombre, affiches: sorties.length, sousReseaux: sorties };
}

/** Premiere et derniere adresse d un prefixe, en entiers. */
function bornes(cidr) {
  const bloc = analyserCidrV4(cidr);
  const debut = ipv4VersEntier(bloc.reseau);
  return [debut, debut + tailleDuPrefixe(bloc.prefixe) - 1];
}

/**
 * Le plus petit prefixe qui contient tous ceux de la liste. Utile pour repondre
 * a « quelle plage dois-je autoriser ? » sans ouvrir plus que necessaire.
 */
export function resumerPrefixes(liste) {
  const entrees = (Array.isArray(liste) ? liste : String(liste).split(/[\s,;]+/))
    .map(x => String(x).trim()).filter(Boolean);
  if (!entrees.length) throw new Error('aucun prefixe fourni');
  let bas = Infinity, haut = -Infinity;
  for (const entree of entrees) {
    const [debut, fin] = bornes(entree.includes('/') ? entree : entree + '/32');
    if (debut < bas) bas = debut;
    if (fin > haut) haut = fin;
  }
  let bits = 32;
  while (bits > 0) {
    const masque = masqueDe(bits);
    if (((bas & masque) >>> 0) === ((haut & masque) >>> 0)) break;
    bits--;
  }
  const masque = masqueDe(bits);
  const reseau = (bas & masque) >>> 0;
  return {
    prefixes: entrees.length,
    resume: entierVersIpv4(reseau) + '/' + bits,
    premiere: entierVersIpv4(reseau),
    derniere: entierVersIpv4(reseau + tailleDuPrefixe(bits) - 1),
    adresses: tailleDuPrefixe(bits),
    couvertureExacte: reseau === bas && reseau + tailleDuPrefixe(bits) - 1 === haut
  };
}

/**
 * Plage d adresses -> liste minimale de prefixes qui la couvre exactement.
 * C est l ecriture qu attendent les regles de pare-feu et les listes d acces.
 */
export function plageVersPrefixes(debut, fin) {
  if (!estIpv4(debut) || !estIpv4(fin)) throw new Error('deux adresses IPv4 attendues');
  let bas = ipv4VersEntier(debut);
  const haut = ipv4VersEntier(fin);
  if (bas > haut) throw new Error('la premiere adresse est superieure a la derniere');
  const sorties = [];
  while (bas <= haut) {
    // Le plus grand bloc aligne sur « bas » qui ne depasse pas « haut ».
    let taille = 32;
    while (taille > 0) {
      const essai = taille - 1;
      const pas = tailleDuPrefixe(essai);
      if ((bas % pas) !== 0 || bas + pas - 1 > haut) break;
      taille = essai;
    }
    sorties.push(entierVersIpv4(bas) + '/' + taille);
    bas += tailleDuPrefixe(taille);
    if (sorties.length > 512) throw new Error('plage trop fragmentee : plus de 512 prefixes');
  }
  return sorties;
}

/** Prefixe -> plage lisible, l operation inverse. */
export function prefixeVersPlage(cidr) {
  const [debut, fin] = bornes(cidr);
  return { debut: entierVersIpv4(debut), fin: entierVersIpv4(fin), adresses: fin - debut + 1 };
}

/** Enumere les adresses d un prefixe, borne pour rester affichable. */
export function listerAdresses(cidr, limite = 256) {
  const bloc = analyserCidrV4(cidr);
  const debut = ipv4VersEntier(bloc.reseau);
  const total = tailleDuPrefixe(bloc.prefixe);
  const sorties = [];
  for (let i = 0; i < Math.min(total, limite); i++) sorties.push(entierVersIpv4(debut + i));
  return { total, affichees: sorties.length, adresses: sorties };
}

/** Deux prefixes se recouvrent-ils, et lequel contient l autre ? */
export function comparerPrefixes(a, b) {
  const [debutA, finA] = bornes(a);
  const [debutB, finB] = bornes(b);
  const recouvrement = debutA <= finB && debutB <= finA;
  return {
    recouvrement,
    aContientB: debutA <= debutB && finA >= finB,
    bContientA: debutB <= debutA && finB >= finA,
    disjoints: !recouvrement
  };
}
