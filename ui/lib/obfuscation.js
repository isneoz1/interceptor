/* Brouillage et lecture de code — INTERCEPTOR (by D4RK)
 *
 * Deux operations reciproques, toutes deux exactes :
 *   obfusquer   enveloppe un code dans une forme qui s auto-decode a
 *               l execution ; le code d origine s execute a l identique.
 *   deobfusquer deroule cette enveloppe, et decode les procedes courants
 *               (fromCharCode, echappements, base64) pour rendre le code
 *               a nouveau lisible.
 *
 * Ce que ces enveloppes font, et ne font pas — dit franchement :
 *   - Le code enveloppe donne EXACTEMENT le meme resultat qu a l origine :
 *     on remet la source telle quelle avant de l executer. Pas de casse.
 *   - « deobfusquer(obfusquer(x)) » redonne x, caractere pour caractere.
 *   - Ce n est PAS du chiffrement. La cle voyage avec le code, sinon il ne
 *     pourrait pas se decoder lui-meme. Cela ralentit une lecture pressee,
 *     cela ne protege pas un secret : qui execute le code le retrouve.
 *
 * Rien ici n execute le code manipule. Tout est du texte transforme en texte.
 */
import { base64Encoder } from './codecs.js';
import { base64VersOctets } from './bytes.js';

export const STYLES = [
  ['securise', 'Securise (ou-exclusif + tableau, universel)'],
  ['compact', 'Compact (base64)'],
  ['echappe', 'Chaine echappee (\\xNN)'],
  ['charcodes', 'Codes de caracteres'],
  ['double', 'Double couche (compact puis securise)']
];

/* --------------------------- Petites fabriques ---------------------------- */
function codesDe(texte) {
  const codes = new Array(texte.length);
  for (let i = 0; i < texte.length; i++) codes[i] = texte.charCodeAt(i);
  return codes;
}

function texteDeCodes(codes) {
  let out = '';
  for (let i = 0; i < codes.length; i += 8192) {
    out += String.fromCharCode.apply(null, codes.slice(i, i + 8192));
  }
  return out;
}

function cleAleatoire(longueur) {
  const cle = new Uint8Array(longueur);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) globalThis.crypto.getRandomValues(cle);
  else for (let i = 0; i < longueur; i++) cle[i] = Math.floor(Math.random() * 256);
  for (let i = 0; i < longueur; i++) cle[i] = cle[i] || 1; // jamais zero partout
  return Array.from(cle);
}

/* ------------------------------- Obfusquer -------------------------------- */
/** Forme la plus robuste : n emploie que String.fromCharCode, present partout. */
function styleCharcodes(source) {
  return 'eval(String.fromCharCode(' + codesDe(source).join(',') + '));';
}

/** Ou-exclusif avec une cle embarquee : le tableau ne se lit plus a l oeil. */
function styleSecurise(source) {
  const cle = cleAleatoire(8);
  const codes = codesDe(source);
  const brouilles = codes.map((c, i) => c ^ cle[i % cle.length]);
  return 'eval(function(c,k){for(var s="",i=0;i<c.length;i++)s+='
    + 'String.fromCharCode(c[i]^k[i%k.length]);return s}('
    + '[' + brouilles.join(',') + '],[' + cle.join(',') + ']));';
}

/** Base64 : compact, lisible seulement apres decodage. UTF-8 preserve par le
 *  passage escape/decodeURIComponent, present dans tous les navigateurs. */
function styleCompact(source) {
  return 'eval(decodeURIComponent(escape(atob("' + base64Encoder(source) + '"))));';
}

/** Chaine litterale entierement echappee, executee telle quelle. */
function styleEchappe(source) {
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    out += code < 256 ? '\\x' + code.toString(16).padStart(2, '0')
                      : '\\u' + code.toString(16).padStart(4, '0');
  }
  return 'eval("' + out + '");';
}

/** Enveloppe le code selon le style demande. Toujours du code executable. */
export function obfusquer(source, style = 'securise') {
  const texte = String(source == null ? '' : source);
  if (!texte) return '';
  switch (style) {
    case 'charcodes': return styleCharcodes(texte);
    case 'compact': return styleCompact(texte);
    case 'echappe': return styleEchappe(texte);
    case 'double': return styleSecurise(styleCompact(texte));
    default: return styleSecurise(texte);
  }
}

/* ------------------ Evaluation SURE d une expression texte ----------------
 * On ne touche jamais a eval(). On reconnait uniquement une poignee de formes
 * dont on sait extraire la valeur sans executer quoi que ce soit. Toute autre
 * forme renvoie null : on prefere ne rien affirmer plutot que deviner.
 */
function litChaine(expr) {
  const t = expr.trim();
  const g = t[0];
  if ((g === '"' || g === "'" || g === '`') && t[t.length - 1] === g) {
    return decoderEchappements(t.slice(1, -1));
  }
  return null;
}

function litTableauNombres(texte) {
  const m = texte.match(/\[\s*(-?(?:0x[0-9a-f]+|\d+)\s*(?:,\s*-?(?:0x[0-9a-f]+|\d+)\s*)*)?\]/i);
  if (!m) return null;
  if (!m[1]) return { nombres: [], reste: texte.slice(m.index + m[0].length) };
  const nombres = m[1].split(',').map(x => {
    const v = x.trim();
    return /^-?0x/i.test(v) ? parseInt(v, 16) : parseInt(v, 10);
  });
  return { nombres, reste: texte.slice(m.index + m[0].length), debut: m.index };
}

/** Reconnait fromCharCode, atob, decodeURIComponent/escape/unescape et le
 *  decodeur ou-exclusif produit ci-dessus, seuls ou concatenes par « + ». */
export function evaluerSur(expr) {
  if (expr == null) return null;
  let t = String(expr).trim();

  const litt = litChaine(t);
  if (litt != null) return litt;

  // Decodeur ou-exclusif : function(c,k){...}([...],[...])
  const xor = t.match(/function\s*\([^)]*\)\s*\{[^}]*\^[^}]*\}\s*\(([\s\S]*)\)\s*$/);
  if (xor) {
    const a = litTableauNombres(xor[1]);
    if (a) {
      const b = litTableauNombres(a.reste);
      if (b && b.nombres.length) {
        const cle = b.nombres;
        return texteDeCodes(a.nombres.map((c, i) => (c ^ cle[i % cle.length]) & 0xffff));
      }
    }
  }

  const fccTest = t.match(/^String\.fromCharCode\s*\(/);
  const appel = !fccTest && t.match(/^([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)$/);
  if (appel) {
    const nom = appel[1];
    const arg = appel[2].trim();
    const interne = evaluerSur(arg);
    if (nom === 'atob') { const s = interne != null ? interne : depouiller(arg); return s != null ? atobBrut(s) : null; }
    if (nom === 'decodeURIComponent') { const v = interne != null ? interne : depouiller(arg); try { return v != null ? decodeURIComponent(v) : null; } catch { return null; } }
    if (nom === 'unescape') { const v = interne != null ? interne : depouiller(arg); try { return v != null ? unescape(v) : null; } catch { return null; } }
    if (nom === 'escape') { const v = interne != null ? interne : depouiller(arg); try { return v != null ? escape(v) : null; } catch { return null; } }
  }

  const fcc = t.match(/^String\.fromCharCode\s*\(([\s\S]*)\)$/);
  if (fcc) {
    const nombres = fcc[1].split(',').map(x => {
      const v = x.trim();
      return /^0x/i.test(v) ? parseInt(v, 16) : parseInt(v, 10);
    });
    if (nombres.every(n => Number.isFinite(n))) return texteDeCodes(nombres);
  }

  // Concatenation « A + B » de morceaux surs.
  if (t.includes('+')) {
    const morceaux = decouperConcat(t);
    if (morceaux) {
      let out = '';
      for (const m of morceaux) {
        const v = evaluerSur(m);
        if (v == null) return null;
        out += v;
      }
      return out;
    }
  }
  return null;
}

/** Decodage base64 « brut » : rend la suite d octets, un caractere par octet,
 *  exactement comme atob() du navigateur — sans interpretation UTF-8. */
function atobBrut(s) {
  if (typeof atob === 'function') { try { return atob(s); } catch { /* suite */ } }
  try {
    const octets = base64VersOctets(s);
    let out = '';
    for (let i = 0; i < octets.length; i += 8192) {
      out += String.fromCharCode.apply(null, octets.subarray(i, i + 8192));
    }
    return out;
  } catch { return null; }
}

function depouiller(expr) {
  const v = litChaine(expr);
  return v != null ? v : null;
}

/** Coupe « a + b + c » au niveau superieur, en respectant chaines et parentheses. */
function decouperConcat(t) {
  const parts = [];
  let profondeur = 0, guillemet = null, courant = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemet) {
      courant += c;
      if (c === '\\') { courant += t[++i] || ''; continue; }
      if (c === guillemet) guillemet = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { guillemet = c; courant += c; continue; }
    if (c === '(' || c === '[' || c === '{') profondeur++;
    if (c === ')' || c === ']' || c === '}') profondeur--;
    if (c === '+' && profondeur === 0) { parts.push(courant); courant = ''; continue; }
    courant += c;
  }
  parts.push(courant);
  return parts.length > 1 ? parts : null;
}

/* ---------------------- Decodage des echappements ------------------------- */
export function decoderEchappements(texte) {
  return String(texte)
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => sur(() => String.fromCodePoint(parseInt(h, 16))))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\([0-3]?[0-7]{1,2})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b').replace(/\\f/g, '\f').replace(/\\v/g, '\v')
    .replace(/\\0(?![0-9])/g, '\0')
    .replace(/\\(['"`\\/])/g, '$1');
}

function sur(fn) { try { return fn(); } catch { return ''; } }
