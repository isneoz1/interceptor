/* Parametres d en-tete HTTP : valeurs etendues et mots codes
 * INTERCEPTOR (by D4RK)
 *
 * Un `Content-Disposition` reel ne dit pas « filename=rapport.pdf ». Il dit
 * souvent `filename*=UTF-8''%e2%82%ac%20rates`, parfois decoupe en plusieurs
 * morceaux, parfois avec un `=?UTF-8?B?...?=` herite du courriel. Sans ces
 * trois mecanismes, le nom de fichier reel reste illisible.
 *
 *   - RFC 8187 (qui remplace la RFC 5987) : valeur etendue
 *     `charset'langue'texte-pourcent-encode`, reconnaissable au `*` final du
 *     nom de parametre ;
 *   - RFC 2231 section 3 : un parametre trop long se decoupe en `nom*0`,
 *     `nom*1`… chaque morceau pouvant etre etendu ou non ;
 *   - RFC 2047 : mot code `=?jeu?B|Q?texte?=`, du courriel mais qu on croise
 *     encore dans des en-tetes HTTP.
 *
 * Verifie contre les exemples publies dans ces RFC.
 */
import { decoderAvec } from './charsets.js';

/* --------------------------- Decoupage en parametres ---------------------- */
/**
 * Decoupe « valeur; cle=x; cle2="y; z" » en respectant les guillemets et les
 * antislashs. Rend la valeur de tete puis la liste des parametres bruts.
 */
export function decouperParametres(entree) {
  const texte = String(entree == null ? '' : entree);
  const morceaux = [];
  let courant = '';
  let dansGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansGuillemets && c === '\\' && i + 1 < texte.length) { courant += c + texte[++i]; continue; }
    if (c === '"') { dansGuillemets = !dansGuillemets; courant += c; continue; }
    if (c === ';' && !dansGuillemets) { morceaux.push(courant); courant = ''; continue; }
    courant += c;
  }
  morceaux.push(courant);

  const tete = morceaux.shift().trim();
  const parametres = [];
  for (const morceau of morceaux) {
    const brut = morceau.trim();
    if (!brut) continue;
    const coupe = brut.indexOf('=');
    if (coupe < 0) { parametres.push({ nom: brut.toLowerCase(), valeur: '', sansValeur: true }); continue; }
    const nom = brut.slice(0, coupe).trim().toLowerCase();
    let valeur = brut.slice(coupe + 1).trim();
    if (valeur.startsWith('"') && valeur.endsWith('"') && valeur.length >= 2) {
      valeur = valeur.slice(1, -1).replace(/\\(.)/g, '$1');
      parametres.push({ nom, valeur, entreGuillemets: true });
    } else {
      parametres.push({ nom, valeur, entreGuillemets: false });
    }
  }
  return { tete, parametres };
}

/* ------------------------- Valeur etendue (RFC 8187) ---------------------- */
const HEX = /%([0-9a-fA-F]{2})/g;

/**
 * Lit `charset'langue'texte-pourcent-encode`.
 * @returns { texte, jeu, langue } ; leve si la forme n est pas respectee.
 */
export function decoderValeurEtendue(entree) {
  const brut = String(entree == null ? '' : entree).trim();
  const parts = brut.split("'");
  if (parts.length < 3) {
    throw new Error("valeur etendue attendue sous la forme jeu'langue'texte");
  }
  const jeu = (parts[0] || 'utf-8').toLowerCase();
  const langue = parts[1] || '';
  const corps = parts.slice(2).join("'");

  /* Le texte est pourcent-encode sur des OCTETS : on les rassemble d abord,
     puis on les lit dans le jeu annonce. Passer par decodeURIComponent
     supposerait de l UTF-8, ce que la RFC n impose pas. */
  const octets = [];
  let i = 0;
  while (i < corps.length) {
    if (corps[i] === '%' && /^[0-9a-fA-F]{2}$/.test(corps.substr(i + 1, 2))) {
      octets.push(parseInt(corps.substr(i + 1, 2), 16));
      i += 3;
    } else {
      const code = corps.charCodeAt(i);
      if (code > 0xff) throw new Error('caractere hors ASCII dans une valeur etendue : ' + corps[i]);
      octets.push(code);
      i += 1;
    }
  }
  const texte = decoderAvec(new Uint8Array(octets), jeu === 'us-ascii' ? 'utf-8' : jeu);
  return { texte, jeu, langue };
}

/* Caracteres a laisser tels quels : `attr-char` de la RFC 8187 section 3.2.1. */
const ATTR_CHAR = /[A-Za-z0-9!#$&+\-.^_`|~]/;

/** Ecrit une valeur etendue UTF-8, telle qu un serveur devrait l emettre. */
export function encoderValeurEtendue(texte, langue = '') {
  const octets = new TextEncoder().encode(String(texte == null ? '' : texte));
  let sortie = '';
  for (const octet of octets) {
    const c = String.fromCharCode(octet);
    sortie += (octet < 0x80 && ATTR_CHAR.test(c))
      ? c
      : '%' + octet.toString(16).toUpperCase().padStart(2, '0');
  }
  return "UTF-8'" + langue + "'" + sortie;
}

/* ---------------------- Continuations (RFC 2231 section 3) ---------------- */
/**
 * Rassemble `nom*0`, `nom*1`… en une seule valeur. Un morceau dont le nom se
 * termine par `*` est une valeur etendue ; seul le premier porte le jeu.
 */
export function recomposerContinuations(parametres) {
  const simples = new Map();
  const suites = new Map();

  for (const p of parametres) {
    const m = /^(.*?)\*(\d+)(\*?)$/.exec(p.nom);
    if (m) {
      const [, base, index, etendu] = m;
      if (!suites.has(base)) suites.set(base, []);
      suites.get(base).push({ index: Number(index), valeur: p.valeur, etendu: !!etendu });
    } else {
      simples.set(p.nom, p);
    }
  }

  const sortie = [];
  for (const [nom, p] of simples) {
    sortie.push({ nom, valeur: p.valeur, etendu: nom.endsWith('*'), morceaux: 1 });
  }
  for (const [base, liste] of suites) {
    liste.sort((a, b) => a.index - b.index);
    const premierEtendu = liste[0] && liste[0].etendu;
    // Seul le premier morceau porte `jeu'langue'` ; les suivants sont la
    // suite du texte pourcent-encode.
    const assemble = liste.map(x => x.valeur).join('');
    sortie.push({ nom: base + (premierEtendu ? '*' : ''), valeur: assemble,
      etendu: premierEtendu, morceaux: liste.length });
  }
  return sortie;
}

/* ------------------------- Mots codes (RFC 2047) -------------------------- */
const MOT_CODE = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

/** Decode un `=?jeu?B|Q?texte?=`. Rend la chaine inchangee si aucun n y est. */
export function decoderMotsCodes(entree) {
  const texte = String(entree == null ? '' : entree);
  MOT_CODE.lastIndex = 0;
  return texte.replace(MOT_CODE, (tout, jeu, forme, corps) => {
    try {
      let octets;
      if (forme.toUpperCase() === 'B') {
        const binaire = atob(corps.replace(/\s+/g, ''));
        octets = Uint8Array.from(binaire, c => c.charCodeAt(0));
      } else {
        // Forme « Q » : proche du quoted-printable, mais `_` vaut l espace.
        const out = [];
        for (let i = 0; i < corps.length; i++) {
          if (corps[i] === '_') { out.push(0x20); continue; }
          if (corps[i] === '=' && /^[0-9a-fA-F]{2}$/.test(corps.substr(i + 1, 2))) {
            out.push(parseInt(corps.substr(i + 1, 2), 16));
            i += 2;
            continue;
          }
          out.push(corps.charCodeAt(i) & 0xff);
        }
        octets = new Uint8Array(out);
      }
      const nom = jeu.split('*')[0].toLowerCase();      // le `*langue` est optionnel
      return decoderAvec(octets, nom === 'us-ascii' ? 'utf-8' : nom);
    } catch {
      return tout;   // illisible : on rend le mot code tel quel, jamais du vide
    }
  });
}

/** Vrai si la chaine contient au moins un mot code. */
export function contientMotCode(texte) {
  MOT_CODE.lastIndex = 0;
  return MOT_CODE.test(String(texte == null ? '' : texte));
}

/* ------------------- Analyse complete d une valeur parametree ------------- */
/**
 * Lit une valeur du type `Content-Disposition` ou `Content-Type` et rend, pour
 * chaque parametre, sa valeur reellement transportee.
 *
 * Regle de la RFC 6266 section 4.3 : quand `nom` et `nom*` sont tous deux
 * presents, la forme etendue l emporte.
 */
export function analyserValeurParametree(entree) {
  const { tete, parametres } = decouperParametres(entree);
  const rassembles = recomposerContinuations(parametres);

  const lus = [];
  for (const p of rassembles) {
    const base = p.nom.replace(/\*$/, '');
    const ligne = { nom: base, brut: p.valeur, etendu: p.etendu, morceaux: p.morceaux,
      jeu: '', langue: '', remarques: [] };
    if (p.etendu) {
      try {
        const v = decoderValeurEtendue(p.valeur);
        ligne.valeur = v.texte;
        ligne.jeu = v.jeu;
        ligne.langue = v.langue;
      } catch (e) {
        ligne.valeur = p.valeur;
        ligne.remarques.push('valeur etendue illisible : ' + String(e.message || e));
      }
    } else {
      ligne.valeur = p.valeur;
    }
    if (contientMotCode(ligne.valeur)) {
      ligne.motCode = true;
      ligne.valeurDecodee = decoderMotsCodes(ligne.valeur);
      ligne.remarques.push('mot code RFC 2047 : forme heritee du courriel, non prevue par HTTP');
    }
    if (p.morceaux > 1) ligne.remarques.push('valeur rassemblee depuis ' + p.morceaux + ' morceaux');
    lus.push(ligne);
  }

  /* La forme etendue prime sur la forme simple du meme nom. */
  const retenus = [];
  const vus = new Set();
  for (const l of lus.filter(x => x.etendu).concat(lus.filter(x => !x.etendu))) {
    if (vus.has(l.nom)) {
      retenus.find(r => r.nom === l.nom).remarques
        .push('une forme simple « ' + l.nom + ' » existe aussi : la forme etendue l emporte (RFC 6266)');
      continue;
    }
    vus.add(l.nom);
    retenus.push(l);
  }

  return { tete, parametres: retenus };
}

/**
 * Nom de fichier reellement propose par un `Content-Disposition`, et ce qui
 * merite d etre regarde. On ne nettoie pas le nom : on dit ce qu il contient.
 */
export function analyserContentDisposition(entree) {
  const lu = analyserValeurParametree(entree);
  const nomFichier = lu.parametres.find(p => p.nom === 'filename');
  const nom = nomFichier ? (nomFichier.valeurDecodee || nomFichier.valeur) : '';
  const risques = [];

  if (nom) {
    if (/[\\/]/.test(nom)) risques.push('le nom propose contient un separateur de chemin');
    if (/^\.\.|[\\/]\.\./.test(nom)) risques.push('le nom propose remonte dans l arborescence (..)');
    if (/[ -]/.test(nom)) risques.push('le nom propose contient un caractere de controle');
    if (/[‪-‮⁦-⁩]/.test(nom)) {
      risques.push('le nom propose contient une marque de sens d ecriture : l extension affichee peut differer de la reelle');
    }
    const points = nom.split('.').length - 1;
    if (points > 1) risques.push('le nom propose porte plusieurs extensions');
  }

  return { disposition: lu.tete.toLowerCase(), nomFichier: nom, parametres: lu.parametres, risques };
}
