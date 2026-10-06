/* Protections d une reponse — SWIFT (by NeoZ)
 *
 * Ce qu une reponse met en place pour se defendre, lu dans ses en-tetes : HSTS,
 * CSP, protection contre l encadrement, nosniff, politique de referent,
 * Permissions-Policy, isolation entre origines, et ce que le serveur dit de
 * lui-meme.
 *
 * Ce ne sont PAS des alertes. Une protection absente n est pas une faille —
 * c est la ligne de conduite de l analyseur, et elle vaut ici aussi. Chaque
 * ligne dit un fait : ce qui est la, ce que cela fait, ce qui s applique a la
 * place quand rien n est dit. Et quand une chose ne peut pas se voir depuis
 * les en-tetes, la ligne le dit.
 *
 * Chaque ligne est { nom, etat, texte, valeurs } : `texte` est un gabarit
 * traduit a l affichage. `etat` vaut present, absent, partiel ou inoperant.
 */

const DOCUMENTS = new Set(['main_frame', 'sub_frame']);

/* Les politiques de referent reconnues (Referrer Policy, W3C). */
const REFERENTS = {
  'no-referrer': 'aucun referent n est envoye',
  'no-referrer-when-downgrade': 'URL complete, sauf vers http depuis https',
  'same-origin': 'URL complete vers la meme origine, rien ailleurs',
  'origin': 'seulement l origine, partout',
  'strict-origin': 'seulement l origine, et rien vers http depuis https',
  'origin-when-cross-origin': 'URL complete vers la meme origine, l origine ailleurs',
  'strict-origin-when-cross-origin': 'URL complete vers la meme origine, l origine ailleurs, rien vers http depuis https',
  'unsafe-url': 'URL complete partout, y compris vers http'
};

/* Ce que le serveur peut dire de lui-meme. */
const ANNONCES = ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator'];

/** Les en-tetes en objet { nom-minuscule: valeur }, valeurs repetees jointes. */
export function entetesEnObjet(liste) {
  const out = {};
  for (const h of liste || []) {
    const k = String((h && h.name) || '').toLowerCase();
    if (!k) continue;
    out[k] = k in out ? out[k] + ', ' + h.value : String(h.value || '');
  }
  return out;
}

const ligne = (nom, etat, texte, valeurs = {}) => ({ nom, etat, texte, valeurs });

/* RFC 6797, 6.1 : directives separees par « ; », max-age obligatoire. */
function lireHsts(valeur) {
  const d = {};
  for (const morceau of String(valeur).split(';')) {
    const [nom, ...reste] = morceau.split('=');
    const cle = nom.trim().toLowerCase();
    if (!cle) continue;
    d[cle] = reste.length ? reste.join('=').trim().replace(/^"|"$/g, '') : true;
  }
  return d;
}

function hsts(h, rec) {
  const valeur = h['strict-transport-security'];
  const firefox = rec.security && rec.security.hsts === true;
  if (!valeur) {
    return firefox
      ? ligne('HSTS', 'present', 'absent de cette reponse, mais Firefox applique deja HSTS a cet hote (liste de prechargement ou visite anterieure)')
      : ligne('HSTS', 'absent', 'absent : rien n oblige le navigateur a revenir en https si on lui donne une adresse http');
  }
  if (rec.scheme !== 'https') {
    return ligne('HSTS', 'inoperant', 'ignore : recu sur une connexion non chiffree (RFC 6797, 8.1)');
  }
  const d = lireHsts(valeur);
  const age = /^\d+$/.test(String(d['max-age'] || '')) ? Number(d['max-age']) : null;
  if (age === null) return ligne('HSTS', 'inoperant', 'inoperant : max-age absent ou invalide (RFC 6797, 6.1.1)');
  if (age === 0) return ligne('HSTS', 'inoperant', 'max-age=0 : demande au navigateur d oublier HSTS pour cet hote');
  const sousDomaines = d.includesubdomains === true;
  const prechargement = d.preload === true;
  const jours = Math.floor(age / 86400);
  const texte = sousDomaines
    ? 'impose https pendant {jours} jours, a cet hote et a ses sous-domaines'
    : 'impose https pendant {jours} jours, a cet hote seulement';
  const lignes = [ligne('HSTS', 'present', texte, { jours })];
  if (age >= 31536000 && sousDomaines && prechargement) {
    lignes.push(ligne('HSTS', 'present',
      'l en-tete remplit les conditions d en-tete de la liste de prechargement (max-age d un an, includeSubDomains, preload) ; la liste exige aussi que chaque sous-domaine serve https, ce qui ne se voit pas d ici'));
  } else if (prechargement) {
    lignes.push(ligne('HSTS', 'partiel',
      'preload est demande, mais la liste de prechargement exige aussi max-age d au moins un an et includeSubDomains'));
  }
  return lignes;
}

/* Une balise <meta http-equiv="Content-Security-Policy"> dans le document. */
function cspMeta(rec) {
  const corps = rec.responseBody;
  if (!corps || typeof corps.text !== 'string' || !/html/i.test(String(rec.mime || ''))) return null;
  return /<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["'\s>]/i.test(corps.text);
}

function csp(h, rec) {
  const appliquee = h['content-security-policy'];
  const observee = h['content-security-policy-report-only'];
  const meta = cspMeta(rec);
  if (appliquee) {
    const n = appliquee.split(';').filter(x => x.trim()).length;
    return ligne('CSP', 'present', 'appliquee par l en-tete ({n} directives) — detail plus haut', { n });
  }
  if (meta) return ligne('CSP', 'present', 'declaree dans une balise <meta> du document (frame-ancestors et les rapports n y sont pas pris en compte)');
  if (observee) return ligne('CSP', 'partiel', 'en observation seulement (Report-Only) : rien n est bloque');
  if (meta === null) {
    return ligne('CSP', 'absent', 'absente des en-tetes ; une balise <meta> n a pas pu etre cherchee, le corps n ayant pas ete capture');
  }
  return ligne('CSP', 'absent', 'absente des en-tetes comme du document');
}

function frameAncestors(politique) {
  if (!politique) return null;
  for (const morceau of politique.split(';')) {
    const parts = morceau.trim().split(/\s+/);
    if (parts[0] && parts[0].toLowerCase() === 'frame-ancestors') return parts.slice(1).join(' ') || "'none'";
  }
  return null;
}

function encadrement(h) {
  const fa = frameAncestors(h['content-security-policy']);
  const xfo = String(h['x-frame-options'] || '').trim().toUpperCase();
  if (fa) {
    return xfo
      ? ligne('Encadrement', 'present', 'CSP frame-ancestors {valeur} — X-Frame-Options est alors ignore', { valeur: fa })
      : ligne('Encadrement', 'present', 'CSP frame-ancestors {valeur}', { valeur: fa });
  }
  if (xfo === 'DENY') return ligne('Encadrement', 'present', 'X-Frame-Options DENY : aucune page ne peut encadrer celle-ci');
  if (xfo === 'SAMEORIGIN') return ligne('Encadrement', 'present', 'X-Frame-Options SAMEORIGIN : seule la meme origine peut encadrer cette page');
  if (xfo.startsWith('ALLOW-FROM')) {
    return ligne('Encadrement', 'inoperant', 'X-Frame-Options ALLOW-FROM n est plus reconnu par les navigateurs : la page peut etre encadree');
  }
  if (xfo) return ligne('Encadrement', 'inoperant', 'X-Frame-Options {valeur} n est pas une valeur reconnue : elle est ignoree', { valeur: xfo });
  return ligne('Encadrement', 'absent', 'aucune protection : n importe quel site peut encadrer cette page');
}

function nosniff(h) {
  const v = String(h['x-content-type-options'] || '').split(',')[0].trim().toLowerCase();
  return v === 'nosniff'
    ? ligne('nosniff', 'present', 'le navigateur refuse un script ou une feuille de style servis sous un autre type')
    : ligne('nosniff', 'absent', 'absent : le navigateur peut deviner le type d un contenu');
}

function referent(h) {
  const brut = h['referrer-policy'];
  /* Plusieurs valeurs : la derniere que le navigateur reconnait s applique. */
  const reconnue = String(brut || '').split(',').map(x => x.trim().toLowerCase()).filter(x => REFERENTS[x]).pop();
  if (!reconnue) {
    /* Sans politique reconnue, celle par defaut de Firefox s applique. */
    return {
      ...ligne('Referrer-Policy', brut ? 'inoperant' : 'absent',
        brut ? 'valeur non reconnue ; Firefox applique strict-origin-when-cross-origin : {sens}'
          : 'absente ; Firefox applique strict-origin-when-cross-origin : {sens}',
        { sens: REFERENTS['strict-origin-when-cross-origin'] }),
      aTraduire: ['sens']
    };
  }
  return { ...ligne('Referrer-Policy', 'present', '{politique} : {sens}', { politique: reconnue, sens: REFERENTS[reconnue] }), aTraduire: ['sens'] };
}

function permissions(h) {
  const brut = h['permissions-policy'];
  if (!brut) return ligne('Permissions-Policy', 'absent', 'absente : aucune fonction du navigateur n est restreinte par la page');
  const coupees = [];
  const limitees = [];
  for (const morceau of brut.split(/,(?![^(]*\))/)) {
    const m = /^\s*([a-z0-9-]+)\s*=\s*(.*)$/i.exec(morceau);
    if (!m) continue;
    (/^\(\s*\)$/.test(m[2].trim()) ? coupees : limitees).push(m[1]);
  }
  return ligne('Permissions-Policy', 'present', 'coupees : {coupees} ; limitees : {limitees}',
    { coupees: coupees.join(', ') || '—', limitees: limitees.join(', ') || '—' });
}

function isolation(h) {
  const coop = String(h['cross-origin-opener-policy'] || '').split(';')[0].trim().toLowerCase();
  const coep = String(h['cross-origin-embedder-policy'] || '').split(';')[0].trim().toLowerCase();
  const out = [
    coop ? ligne('COOP', 'present', '{valeur}', { valeur: coop })
      : ligne('COOP', 'absent', 'absent : une fenetre ouverte depuis une autre origine garde une reference a celle-ci'),
    coep ? ligne('COEP', 'present', '{valeur}', { valeur: coep })
      : ligne('COEP', 'absent', 'absent')
  ];
  const isolee = coop === 'same-origin' && (coep === 'require-corp' || coep === 'credentialless');
  out.push(isolee
    ? ligne('Isolation', 'present', 'la page est isolee des autres origines (crossOriginIsolated)')
    : ligne('Isolation', 'absent', 'la page n est pas isolee : il faudrait COOP same-origin et COEP require-corp ou credentialless'));
  return out;
}

function ressource(h) {
  const corp = String(h['cross-origin-resource-policy'] || '').trim().toLowerCase();
  return corp
    ? ligne('CORP', 'present', '{valeur} : qui peut charger cette ressource', { valeur: corp })
    : ligne('CORP', 'absent', 'absent : toute origine peut charger cette ressource en no-cors');
}

function annonces(h) {
  const out = [];
  for (const nom of ANNONCES) {
    const valeur = h[nom];
    if (!valeur) continue;
    out.push(ligne(nom, 'present', /\d+\.\d+/.test(valeur)
      ? 'le serveur annonce une version : {valeur}' : 'le serveur se nomme : {valeur}', { valeur }));
  }
  return out;
}

/**
 * Les protections d une reponse, ligne par ligne.
 * Pour un document, tout ; pour une autre ressource, ce qui la concerne.
 */
export function lireProtections(rec) {
  if (!rec || !Array.isArray(rec.responseHeaders) || !rec.responseHeaders.length) return [];
  const h = entetesEnObjet(rec.responseHeaders);
  const lignes = [];
  if (DOCUMENTS.has(rec.type)) {
    lignes.push(...[].concat(hsts(h, rec)), csp(h, rec), encadrement(h), nosniff(h), referent(h),
      permissions(h), ...isolation(h));
  } else {
    lignes.push(nosniff(h), ressource(h));
  }
  lignes.push(...annonces(h));
  return lignes;
}

/* Tous les gabarits et sens que ce module peut produire : le controle de
   traduction les verifie un a un. */
export const TEXTES_PROTECTIONS = [...Object.values(REFERENTS)];
