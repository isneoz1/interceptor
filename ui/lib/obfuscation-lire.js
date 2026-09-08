/* Rendre un code lisible — INTERCEPTOR (by NeoZ)
 *
 * Le versant lecture de obfuscation.js. Trois etapes, toutes statiques : rien
 * n execute le code.
 *   1. deballer  deroule les enveloppes « eval(...) » couche par couche, tant
 *                que l argument se decode sans ambiguite.
 *   2. reveler   remplace sur place les procedes courants : fromCharCode,
 *                echappements \xNN / \uNNNN, atob(...) et decodeURIComponent.
 *   3. embellir  reindente selon les accolades pour retrouver la structure.
 *
 * On ne pretend jamais avoir « casse » un obfuscateur : on montre ce qu on
 * sait decoder avec certitude, et on laisse le reste tel quel.
 */
import { evaluerSur, decoderEchappements } from './obfuscation.js';

const MAX_COUCHES = 40;

/* ------------------------------- Deballer --------------------------------- */
/** Extrait l argument d un « eval( … ) » qui enveloppe tout le code. */
function argumentEval(source) {
  const t = source.trim();
  const m = t.match(/^(?:;|\s)*eval\s*\(/);
  if (!m) return null;
  const debut = t.indexOf('(', m[0].length - 1);
  let profondeur = 0, guillemet = null;
  for (let i = debut; i < t.length; i++) {
    const c = t[i];
    if (guillemet) {
      if (c === '\\') { i++; continue; }
      if (c === guillemet) guillemet = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { guillemet = c; continue; }
    if (c === '(') profondeur++;
    else if (c === ')') {
      profondeur--;
      if (profondeur === 0) {
        const apres = t.slice(i + 1).replace(/[\s;]*$/, '');
        if (apres) return null;             // du code suit l eval : on n y touche pas
        return t.slice(debut + 1, i);
      }
    }
  }
  return null;
}

/** Deroule les enveloppes successives. Chaque couche doit se decoder seule. */
export function deballer(source) {
  let courant = String(source == null ? '' : source);
  let couches = 0;
  while (couches < MAX_COUCHES) {
    const arg = argumentEval(courant);
    if (arg == null) break;
    const decode = evaluerSur(arg);
    if (decode == null || decode === courant) break;
    courant = decode;
    couches++;
  }
  return { source: courant, couches };
}

/* ------------------------------- Reveler ---------------------------------- */
/** Remplace les groupes String.fromCharCode(...) par leur texte. */
function revelerFromCharCode(source) {
  return source.replace(/String\.fromCharCode\s*\(([^)]*)\)/g, (tout, args) => {
    const nombres = args.split(',').map(x => {
      const v = x.trim();
      if (/^0x[0-9a-f]+$/i.test(v)) return parseInt(v, 16);
      if (/^\d+$/.test(v)) return parseInt(v, 10);
      return NaN;
    });
    if (!nombres.length || nombres.some(n => !Number.isFinite(n))) return tout;
    const texte = nombres.map(n => String.fromCharCode(n)).join('');
    return JSON.stringify(texte);
  });
}

/** Decode atob("…") et decodeURIComponent("…") a arguments litteraux. */
function revelerAppels(source) {
  const motif = /(atob|decodeURIComponent|unescape)\s*\(\s*(["'`])((?:\\.|(?!\2).)*)\2\s*\)/g;
  return source.replace(motif, (tout, nom, g, contenu) => {
    const valeur = evaluerSur(nom + '(' + g + contenu + g + ')');
    return valeur == null ? tout : JSON.stringify(valeur);
  });
}

/** Decode les echappements presents dans les chaines litterales. */
function revelerEchappements(source) {
  return source.replace(/(["'`])((?:\\.|(?!\1).)*)\1/g, (tout, g, contenu) => {
    if (!/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]+\})/.test(contenu)) return tout;
    return JSON.stringify(decoderEchappements(contenu));
  });
}

/** Replie les concatenations de chaines litterales voisines : "a"+"b" -> "ab". */
function replierConcat(source) {
  let precedent;
  let out = source;
  do {
    precedent = out;
    out = out.replace(/(["'])((?:\\.|(?!\1).)*)\1\s*\+\s*(["'])((?:\\.|(?!\3).)*)\3/g,
      (tout, g1, a, g2, b) => JSON.stringify(decoderEchappements(a) + decoderEchappements(b)));
  } while (out !== precedent);
  return out;
}

/** Applique tous les reveleurs jusqu a stabilisation. */
export function reveler(source) {
  let courant = String(source == null ? '' : source);
  let precedent;
  let tours = 0;
  do {
    precedent = courant;
    courant = revelerFromCharCode(courant);
    courant = revelerAppels(courant);
    courant = replierConcat(courant);
    courant = revelerEchappements(courant);
    tours++;
  } while (courant !== precedent && tours < 20);
  return courant;
}

/* ------------------------------- Embellir --------------------------------- */
/** Reindente un code compact d apres ses accolades, crochets et points-virgules.
 *  Reste prudent : ne touche pas au contenu des chaines ni des commentaires. */
export function embellir(source) {
  const texte = String(source == null ? '' : source);
  let out = '';
  let niveau = 0, guillemet = null, i = 0;
  const INDENT = '  ';
  const retour = () => '\n' + INDENT.repeat(Math.max(0, niveau));

  while (i < texte.length) {
    const c = texte[i];
    if (guillemet) {
      out += c;
      if (c === '\\') { out += texte[++i] || ''; i++; continue; }
      if (c === guillemet) guillemet = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { guillemet = c; out += c; i++; continue; }
    // Commentaires : recopies sans modification.
    if (c === '/' && texte[i + 1] === '/') {
      const fin = texte.indexOf('\n', i);
      out += texte.slice(i, fin < 0 ? texte.length : fin);
      i = fin < 0 ? texte.length : fin;
      continue;
    }
    if (c === '/' && texte[i + 1] === '*') {
      const fin = texte.indexOf('*/', i + 2);
      out += texte.slice(i, fin < 0 ? texte.length : fin + 2);
      i = fin < 0 ? texte.length : fin + 2;
      continue;
    }
    if (c === '{' || c === '[') {
      niveau++;
      out += c + retour();
    } else if (c === '}' || c === ']') {
      niveau = Math.max(0, niveau - 1);
      out = out.replace(/[ \t]*\n?[ \t]*$/, '') + retour() + c;
    } else if (c === ';') {
      out += c + retour();
    } else if (c === '\n' || c === '\r' || (c === ' ' && out.endsWith('\n'))) {
      // on gere l espacement nous-memes
    } else {
      out += c;
    }
    i++;
  }
  return out.split('\n').map(l => l.replace(/\s+$/, '')).filter((l, idx, tab) =>
    !(l === '' && tab[idx - 1] === '')).join('\n').trim();
}

/* ------------------------------- Ensemble --------------------------------- */
/** Chaine complete : deballe, revele, embellit, et decrit ce qui a ete fait. */
export function deobfusquer(source, { embellir: mettreEnForme = true } = {}) {
  const brut = String(source == null ? '' : source);
  if (!brut.trim()) return { ok: false, erreur: 'code vide', source: '', etapes: [] };

  const etapes = [];
  const ball = deballer(brut);
  if (ball.couches) etapes.push(ball.couches + ' couche(s) « eval » deroulee(s)');

  let courant = ball.source;
  const avantRevel = courant;
  courant = reveler(courant);
  if (courant !== avantRevel) etapes.push('procedes decodes (fromCharCode, echappements, base64)');

  if (mettreEnForme) {
    const avant = courant;
    courant = embellir(courant);
    if (courant !== avant) etapes.push('code reindente');
  }

  if (!etapes.length) etapes.push('aucun procede reconnu — le code semble deja lisible');
  return { ok: true, source: courant, etapes, couches: ball.couches };
}
