/* Lire une reponse HTTP collee — SWIFT (by D4RK)
 *
 * Ce que l on colle le plus souvent pour juger un site sans le capturer : la
 * sortie de `curl -I`, `curl -i` ou `curl -v`, les en-tetes copies depuis un
 * autre outil. On en tire la ligne de statut et les en-tetes, tels qu ils
 * sont ecrits.
 *
 * Regles suivies (RFC 9112) :
 *   - la ligne de statut s ecrit « HTTP/version code raison » (§4) ;
 *   - un en-tete s ecrit « nom: valeur », le nom sans espace (§5.1) ;
 *   - une ligne qui commence par un blanc prolonge la precedente : c est le
 *     repli obsolete (§5.2), qu on recolle par une espace ;
 *   - une ligne vide termine les en-tetes ; la suite est le corps (§2.1).
 *
 * Plusieurs reponses peuvent se suivre : `curl -iL` en ecrit une par
 * redirection, et une reponse provisoire (100 Continue, 103 Early Hints,
 * RFC 9110 §15.2) precede la vraie. C est la DERNIERE qui compte, celle que
 * le navigateur aurait gardee ; les precedentes sont comptees. Une reponse
 * suivante ne commence que juste apres les en-tetes de la precedente : une
 * ligne « HTTP/1.1 200 OK » ecrite dans un corps reste du corps.
 *
 * `curl -v` marque les lignes de la reponse par « < », celles de la requete
 * par « > » et ses remarques par « * » : on garde les premieres, sans leur
 * marque, et l on compte les autres.
 *
 * Rien n est devine : une ligne qui n est ni l un ni l autre est rendue a part.
 */

const STATUT = /^HTTP\/(\d(?:\.\d)?)\s+(\d{3})(?:\s+(.*))?$/;
const ENTETE = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+):[ \t]*(.*)$/;
const VERBEUX = /^< HTTP\/\d/;
const BRUIT_CURL = /^(\* |\*$|> |>$|\{ \[|\} \[)/;

const estStatut = ligne => STATUT.test(ligne.trim());

/* Les en-tetes a partir de la ligne `i`, jusqu a la ligne vide qui les
   termine : rend l indice de la ligne qui la suit. */
function lireEntetes(lignes, i, entetes, ignorees) {
  for (; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (!ligne.trim()) return i + 1;
    if (/^[ \t]/.test(ligne) && entetes.length) {
      const dernier = entetes[entetes.length - 1];
      dernier.value = (dernier.value + ' ' + ligne.trim()).trim();
      continue;
    }
    const m = ENTETE.exec(ligne);
    if (m) entetes.push({ name: m[1], value: m[2].trim() });
    else ignorees.push(ligne);
  }
  return i;
}

/**
 * @param texte  la reponse collee
 * @returns { statut, version, raison, entetes:[{name,value}], ignorees:[],
 *            reponses, curlVerbeux, corps } — `statut` vaut null sans ligne
 *            de statut ; `curlVerbeux` compte les lignes de `curl -v` qui ne
 *            sont pas la reponse.
 */
export function lireReponseBrute(texte) {
  let lignes = String(texte == null ? '' : texte).replace(/\r\n?/g, '\n').split('\n');
  const sortie = {
    statut: null, version: null, raison: '', entetes: [], ignorees: [],
    reponses: 0, curlVerbeux: 0, corps: ''
  };

  /* curl -v : la reponse dans les lignes « < », le corps sans marque. */
  let corpsVerbeux = null;
  if (lignes.some(l => VERBEUX.test(l))) {
    const reponse = [];
    corpsVerbeux = [];
    for (const l of lignes) {
      if (l === '<' || l.startsWith('< ')) reponse.push(l.substring(2));
      else if (BRUIT_CURL.test(l)) sortie.curlVerbeux++;
      else corpsVerbeux.push(l);
    }
    lignes = reponse;
  }

  let i = lignes.findIndex(estStatut);
  if (i >= 0) {
    /* Ce qui precede la premiere ligne de statut — une invite de commande
       collee avec la sortie — n est pas un en-tete : rendu a part. */
    const avant = lignes.slice(0, i).filter(l => l.trim());
    for (;;) {
      const m = STATUT.exec(lignes[i].trim());
      sortie.reponses++;
      sortie.version = m[1];
      sortie.statut = Number(m[2]);
      sortie.raison = (m[3] || '').trim();
      sortie.entetes = [];
      sortie.ignorees = [...avant];
      i = lireEntetes(lignes, i + 1, sortie.entetes, sortie.ignorees);
      let j = i;
      while (j < lignes.length && !lignes[j].trim()) j++;
      if (j < lignes.length && estStatut(lignes[j])) { i = j; continue; }
      break;
    }
  } else {
    /* Sans ligne de statut : un bloc d en-tetes seul, dont on saute les
       lignes vides du debut. */
    i = 0;
    while (i < lignes.length && !lignes[i].trim()) i++;
    i = lireEntetes(lignes, i, sortie.entetes, sortie.ignorees);
  }
  sortie.corps = corpsVerbeux ? corpsVerbeux.join('\n').trim() : lignes.slice(i).join('\n');
  return sortie;
}

/**
 * L adresse donnee pour la reponse, en http ou https : « site.example/page »
 * se lit https://site.example/page. Rend null si elle est vide ou illisible —
 * la reponse est alors lue comme venant de https://example.com/.
 */
export function adresseLue(adresse) {
  const brut = String(adresse == null ? '' : adresse).trim();
  if (!brut) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(brut) ? brut : 'https://' + brut);
    return /^https?:$/.test(url.protocol) && url.hostname ? url : null;
  } catch { return null; }
}

/**
 * Un enregistrement minimal, de la forme que produit le noyau, pour que
 * l onglet En-tetes du detail lise une reponse collee comme une reponse
 * capturee. Les dates sont celles du moment : la fraicheur se calcule alors
 * comme si la reponse venait d arriver.
 *
 * @param lue     ce que rend lireReponseBrute
 * @param adresse l adresse de la reponse (https://example.com/ par defaut)
 * @param type    'main_frame' pour une page, 'xmlhttprequest' sinon
 */
export function enregistrementDepuisReponse(lue, adresse, type, maintenant = Date.now()) {
  const url = adresseLue(adresse) || new URL('https://example.com/');
  const corps = String(lue.corps || '');
  const octets = new TextEncoder().encode(corps).length;
  /* Le type du contenu, lu comme le noyau le lit (le premier Content-Type,
     sans ses parametres) : c est lui qui dit si le corps est un document. */
  const contenu = lue.entetes.find(h => h.name.toLowerCase() === 'content-type');
  const mime = contenu ? contenu.value.split(';')[0].trim().toLowerCase() : '';
  return {
    id: 0,
    url: url.href,
    finalUrl: url.href,
    method: 'GET',
    type: type === 'main_frame' ? 'main_frame' : 'xmlhttprequest',
    scheme: url.protocol.replace(':', ''),
    host: url.hostname,
    path: url.pathname + url.search,
    statusCode: lue.statut,
    mime,
    statusLine: lue.statut == null ? '' : ('HTTP/' + lue.version + ' ' + lue.statut + (lue.raison ? ' ' + lue.raison : '')),
    requestHeaders: [],
    responseHeaders: lue.entetes.map(h => ({ name: h.name, value: h.value })),
    /* Le corps colle avec la reponse (curl -i) : la CSP d une balise <meta>
       s y cherche comme dans un corps capture. */
    responseBody: corps ? { kind: 'text', text: corps, size: octets, stored: octets, truncated: false } : null,
    startTime: maintenant,
    endTime: maintenant,
    timeline: [],
    sources: [],
    state: 'complete'
  };
}
