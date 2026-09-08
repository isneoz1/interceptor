/* Corps multipart/form-data — INTERCEPTOR (by NeoZ)
 *
 * Decoupe un corps de formulaire (RFC 7578) en ses parties : nom du champ,
 * nom de fichier, type de contenu, contenu. La frontiere est lue dans
 * l en-tete Content-Type si on la fournit, sinon devinee sur la premiere ligne
 * qui commence par « -- ». Rien n est execute ni envoye.
 */

/** Frontiere d un Content-Type multipart, ou chaine vide. */
export function frontiereDe(contentType) {
  const m = /boundary\s*=\s*"?([^";,\s]+)"?/i.exec(String(contentType || ''));
  return m ? m[1] : '';
}

/** Devine la frontiere : premiere ligne commencant par deux tirets. */
export function devinerFrontiere(corps) {
  const m = /^--([^\r\n]+?)(?:--)?\r?$/m.exec(String(corps || ''));
  return m ? m[1] : '';
}

function lireEntetes(bloc) {
  const entetes = {};
  for (const ligne of bloc.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9-]+)\s*:\s*(.*)$/.exec(ligne);
    if (m) entetes[m[1].toLowerCase()] = m[2].trim();
  }
  return entetes;
}

function parametre(valeur, nom) {
  const m = new RegExp(nom + '\\s*=\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|([^;\\s]+))', 'i').exec(valeur || '');
  if (!m) return '';
  return (m[1] != null ? m[1].replace(/\\(.)/g, '$1') : m[2]) || '';
}

/**
 * @param corps      texte du corps
 * @param frontiere  facultatif ; sinon lue dans `contentType`, sinon devinee
 * @param contentType facultatif, valeur brute de l en-tete
 */
export function analyserMultipart(corps, frontiere = '', contentType = '') {
  const texte = String(corps == null ? '' : corps);
  const f = frontiere || frontiereDe(contentType) || devinerFrontiere(texte);
  if (!f) throw new Error('frontiere introuvable : donnez-la, ou collez un corps commencant par --frontiere');

  const delim = '--' + f;
  const morceaux = texte.split(delim);
  const parties = [];
  let termine = false;

  for (let i = 1; i < morceaux.length; i++) {
    let m = morceaux[i];
    if (m.startsWith('--')) { termine = true; break; }
    m = m.replace(/^\r?\n/, '');
    const coupe = m.search(/\r?\n\r?\n/);
    const blocEntetes = coupe >= 0 ? m.slice(0, coupe) : m;
    let contenu = coupe >= 0 ? m.slice(coupe).replace(/^\r?\n\r?\n/, '') : '';
    contenu = contenu.replace(/\r?\n$/, '');
    const entetes = lireEntetes(blocEntetes);
    const disposition = entetes['content-disposition'] || '';
    parties.push({
      nom: parametre(disposition, 'name'),
      fichier: parametre(disposition, 'filename'),
      type: entetes['content-type'] || '',
      encodage: entetes['content-transfer-encoding'] || '',
      entetes, contenu,
      taille: new TextEncoder().encode(contenu).length,
      estFichier: /filename\s*=/i.test(disposition)
    });
  }
  return { frontiere: f, parties, termine,
    remarques: remarques(parties, termine) };
}

function remarques(parties, termine) {
  const r = [];
  if (!parties.length) r.push('aucune partie trouvee entre les frontieres');
  if (!termine) r.push('frontiere de fin (--frontiere--) absente : corps tronque ou incomplet');
  const noms = parties.map(p => p.nom);
  const doublons = noms.filter((n, i) => n && noms.indexOf(n) !== i);
  if (doublons.length) r.push('champs repetes : ' + [...new Set(doublons)].join(', '));
  for (const p of parties) {
    if (!p.nom) r.push('une partie sans attribut name : elle sera ignoree par la plupart des serveurs');
    if (p.estFichier && !p.type) r.push('fichier « ' + p.fichier + ' » sans Content-Type : le serveur devinera le type');
  }
  return r;
}

/** Fabrique un corps multipart a partir de champs, pour tester un serveur. */
export function fabriquerMultipart(champs, frontiere = '') {
  const f = frontiere || ('INTERCEPTOR' + Math.random().toString(36).slice(2, 12));
  let out = '';
  for (const c of champs || []) {
    out += '--' + f + '\r\n';
    out += 'Content-Disposition: form-data; name="' + String(c.nom || '').replace(/"/g, '%22') + '"';
    if (c.fichier) out += '; filename="' + String(c.fichier).replace(/"/g, '%22') + '"';
    out += '\r\n';
    if (c.type) out += 'Content-Type: ' + c.type + '\r\n';
    out += '\r\n' + String(c.contenu == null ? '' : c.contenu) + '\r\n';
  }
  out += '--' + f + '--\r\n';
  return { corps: out, contentType: 'multipart/form-data; boundary=' + f };
}
