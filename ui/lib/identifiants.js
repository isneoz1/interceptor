/* Identifiants : ce qu ils contiennent vraiment — INTERCEPTOR (by NeoZ)
 *
 * Une URL d API est pleine d identifiants, et la plupart ne sont pas
 * aleatoires : ils portent un horodatage, parfois une machine, parfois un
 * compteur. Les lire dit quand une ressource a ete creee, dans quel ordre, et
 * combien en ont ete emises dans la meme milliseconde.
 *
 *   UUID (RFC 9562)   version, variante, et l horodatage des versions 1, 6 et 7
 *   ULID              48 bits de temps en millisecondes, puis 80 bits de hasard
 *   Snowflake         41 bits de temps, machine et sequence — Twitter, Discord
 *   ObjectId (MongoDB) 4 octets de secondes, 5 de hasard, 3 de compteur
 *   KSUID             4 octets de secondes depuis 2014, puis 16 de hasard
 *
 * Rien n est devine : chaque champ est un decoupage binaire defini par la
 * specification de l identifiant. Quand la forme ne correspond pas, on le dit
 * plutot que de rendre une date inventee.
 */

const MS_PAR_JOUR = 86400000;

/* ---------------------------------- UUID ---------------------------------- */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* 1582-10-15 est l origine des UUID de version 1 : l ecart avec 1970 vaut
   12 219 292 800 secondes, soit autant de fois 10 000 000 pas de 100 ns. */
const ECART_1582 = 122192928000000000n;

const VERSIONS = {
  1: 'v1 — horodatage et adresse de machine',
  2: 'v2 — variante DCE, rare',
  3: 'v3 — empreinte MD5 d un nom',
  4: 'v4 — aleatoire',
  5: 'v5 — empreinte SHA-1 d un nom',
  6: 'v6 — comme v1, champs reordonnes pour trier',
  7: 'v7 — horodatage en millisecondes puis hasard',
  8: 'v8 — libre, defini par l application'
};

function variante(octet) {
  if ((octet & 0x80) === 0x00) return 'reservee NCS (heritee)';
  if ((octet & 0xc0) === 0x80) return 'RFC 9562 (anciennement 4122)';
  if ((octet & 0xe0) === 0xc0) return 'reservee Microsoft';
  return 'reservee pour l avenir';
}

/** Decoupe un UUID. Leve si la forme n est pas celle d un UUID. */
export function lireUuid(entree) {
  const texte = String(entree == null ? '' : entree).trim().replace(/^urn:uuid:/i, '');
  if (!UUID.test(texte)) throw new Error('forme d UUID attendue : 8-4-4-4-12 chiffres hexadecimaux');
  const hex = texte.replace(/-/g, '').toLowerCase();
  const octets = hex.match(/../g).map(x => parseInt(x, 16));

  const version = octets[6] >> 4;
  const out = {
    texte: texte.toLowerCase(),
    version,
    versionSens: VERSIONS[version] || 'version inconnue',
    variante: variante(octets[8]),
    hex
  };

  if (/^0+$/.test(hex)) { out.particulier = 'UUID nul (nil)'; return out; }
  if (/^f+$/i.test(hex)) { out.particulier = 'UUID maximal (max)'; return out; }

  if (version === 1 || version === 6) {
    /* v1 : temps bas, temps moyen, temps haut. v6 : le meme compte, mais ecrit
       du poids fort au poids faible pour que l ordre alphabetique suive le temps. */
    const cent = version === 1
      ? (BigInt('0x' + hex.slice(12, 16).slice(1)) << 48n)      // 12 bits de poids fort
        | (BigInt('0x' + hex.slice(8, 12)) << 32n)
        | BigInt('0x' + hex.slice(0, 8))
      : (BigInt('0x' + hex.slice(0, 8)) << 28n)
        | (BigInt('0x' + hex.slice(8, 12)) << 12n)
        | BigInt('0x' + hex.slice(13, 16));
    out.pas100ns = cent;
    out.instant = Number((cent - ECART_1582) / 10000n);
    out.horloge = ((octets[8] & 0x3f) << 8) | octets[9];
    out.noeud = hex.slice(20).match(/../g).join(':');
    /* Le bit de poids faible du premier octet du noeud distingue une adresse
       de machine reelle d une valeur tiree au hasard (RFC 9562 section 5.1). */
    out.noeudAleatoire = !!(octets[10] & 0x01);
  } else if (version === 7) {
    out.instant = Number(BigInt('0x' + hex.slice(0, 12)));
  }

  if (out.instant != null) out.iso = new Date(out.instant).toISOString();
  return out;
}

/* ---------------------------------- ULID ---------------------------------- */
/* Base32 de Crockford, sans I, L, O ni U. Dix caracteres de temps, seize de
   hasard : deux ULID de la meme milliseconde se trient quand meme. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function lireUlid(entree) {
  const texte = String(entree == null ? '' : entree).trim().toUpperCase();
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(texte)) {
    throw new Error('ULID attendu : 26 caracteres en base32 de Crockford');
  }
  let temps = 0n;
  for (const c of texte.slice(0, 10)) {
    const chiffre = CROCKFORD.indexOf(c);
    if (chiffre < 0) throw new Error('caractere hors alphabet Crockford : ' + c);
    temps = temps * 32n + BigInt(chiffre);
  }
  if (temps > 281474976710655n) throw new Error('horodatage ULID hors des 48 bits');
  const instant = Number(temps);
  return {
    texte,
    instant,
    iso: new Date(instant).toISOString(),
    tempsBase32: texte.slice(0, 10),
    hasardBase32: texte.slice(10)
  };
}

/* -------------------------------- Snowflake ------------------------------- */
/* Entier de 64 bits : 41 bits de millisecondes depuis une origine propre au
   service, 10 bits de machine, 12 bits de sequence. Les origines ci-dessous
   sont celles publiees par chaque service. */
export const ORIGINES_SNOWFLAKE = [
  ['Twitter / X', 1288834974657],
  ['Discord', 1420070400000],
  ['Instagram', 1314220021721],
  ['Unix (origine nulle)', 0]
];

export function lireSnowflake(entree, origine = 1420070400000) {
  const brut = String(entree == null ? '' : entree).trim();
  if (!/^\d{1,20}$/.test(brut)) throw new Error('Snowflake attendu : un entier decimal');
  const valeur = BigInt(brut);
  if (valeur >> 64n) throw new Error('valeur au-dela de 64 bits');
  const instant = Number((valeur >> 22n) + BigInt(origine));
  return {
    texte: brut,
    instant,
    iso: new Date(instant).toISOString(),
    machine: Number((valeur >> 17n) & 0x1fn),
    processus: Number((valeur >> 12n) & 0x1fn),
    sequence: Number(valeur & 0xfffn),
    origine
  };
}

/** Toutes les lectures plausibles, une par origine connue. */
export function snowflakeToutesOrigines(entree) {
  const sortie = [];
  for (const [nom, origine] of ORIGINES_SNOWFLAKE) {
    try {
      const lu = lireSnowflake(entree, origine);
      /* Une date hors de 2010-2100 n a aucune chance d etre la bonne lecture. */
      lu.service = nom;
      lu.plausible = lu.instant > Date.UTC(2010, 0, 1) && lu.instant < Date.UTC(2100, 0, 1);
      sortie.push(lu);
    } catch { /* origine ecartee */ }
  }
  return sortie;
}

/* -------------------------------- ObjectId -------------------------------- */
/* MongoDB : douze octets — quatre de secondes, cinq de hasard propre au
   processus, trois de compteur. */
export function lireObjectId(entree) {
  const texte = String(entree == null ? '' : entree).trim().toLowerCase();
  if (!/^[0-9a-f]{24}$/.test(texte)) {
    throw new Error('ObjectId attendu : 24 chiffres hexadecimaux');
  }
  const secondes = parseInt(texte.slice(0, 8), 16);
  const instant = secondes * 1000;
  return {
    texte,
    instant,
    iso: new Date(instant).toISOString(),
    secondes,
    hasard: texte.slice(8, 18),
    compteur: parseInt(texte.slice(18), 16)
  };
}

/* ---------------------------------- KSUID --------------------------------- */
/* Vingt octets ecrits en base62 sur 27 caracteres : quatre octets de secondes
   depuis le 13 mai 2014, puis seize octets de hasard. */
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ORIGINE_KSUID = 1400000000;

export function lireKsuid(entree) {
  const texte = String(entree == null ? '' : entree).trim();
  if (!/^[0-9A-Za-z]{27}$/.test(texte)) {
    throw new Error('KSUID attendu : 27 caracteres en base62');
  }
  let valeur = 0n;
  for (const c of texte) {
    const chiffre = BASE62.indexOf(c);
    if (chiffre < 0) throw new Error('caractere hors alphabet base62 : ' + c);
    valeur = valeur * 62n + BigInt(chiffre);
  }
  /* Vingt octets : on isole les quatre de poids fort, qui portent le temps. */
  const secondes = Number(valeur >> 128n);
  if (secondes > 0xffffffff) throw new Error('KSUID au-dela de vingt octets');
  const instant = (secondes + ORIGINE_KSUID) * 1000;
  let hasard = (valeur & ((1n << 128n) - 1n)).toString(16).padStart(32, '0');
  return {
    texte,
    instant,
    iso: new Date(instant).toISOString(),
    secondes,
    hasard
  };
}

/* ------------------------- Reconnaissance d ensemble ---------------------- */
/**
 * Toutes les lectures possibles d une valeur, sans en choisir aucune : une
 * chaine de 26 caracteres peut etre un ULID, un entier peut etre plusieurs
 * Snowflake. C est a l operateur de trancher, avec les dates sous les yeux.
 */
export function lireIdentifiant(entree) {
  const brut = String(entree == null ? '' : entree).trim();
  const lectures = [];
  const essayer = (nom, fn) => {
    try { lectures.push({ nom, ...fn() }); } catch { /* forme non reconnue */ }
  };

  essayer('UUID', () => lireUuid(brut));
  essayer('ULID', () => lireUlid(brut));
  essayer('ObjectId MongoDB', () => lireObjectId(brut));
  essayer('KSUID', () => lireKsuid(brut));
  for (const lu of snowflakeToutesOrigines(brut)) {
    if (lu.plausible) lectures.push({ nom: 'Snowflake ' + lu.service, ...lu });
  }
  return lectures;
}

/** Une date lisible, ou une remarque quand elle sort du plausible. */
export function remarqueDate(instant) {
  if (!Number.isFinite(instant)) return 'horodatage illisible';
  const maintenant = Date.now();
  if (instant < Date.UTC(1970, 0, 1)) return 'anterieure a 1970 : lecture probablement fausse';
  if (instant > maintenant + 365 * MS_PAR_JOUR) return 'plus d un an dans le futur : lecture probablement fausse';
  const jours = Math.round((maintenant - instant) / MS_PAR_JOUR);
  if (jours <= 0) return 'aujourd hui';
  if (jours === 1) return 'hier';
  return 'il y a ' + jours + ' jours';
}
