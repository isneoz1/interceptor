/* Import d une commande cURL — INTERCEPTOR (by D4RK)
 *
 * Le pendant exact du generateur de code : ce que l on sait ecrire, on sait le
 * relire. Une commande copiee depuis les outils de developpement d un autre
 * navigateur, depuis un ticket ou depuis INTERCEPTOR lui-meme redevient une
 * requete exploitable (detail, rejeu, generation dans un autre langage).
 *
 * Les trois formes de continuation de ligne que le projet sait produire sont
 * acceptees : « \ » (shell), « ^ » (cmd.exe) et l accent grave (PowerShell).
 *
 * Rien n est execute et rien n est emis : on analyse du texte.
 */

/* ------------------------------ Decoupage --------------------------------- */
/**
 * Decoupe une ligne de commande en jetons, en respectant les guillemets.
 * Ecrit a la main plutot que par expression reguliere : les regles de
 * citation different entre les apostrophes et les guillemets, et une
 * expression unique deviendrait illisible et fausse sur les cas limites.
 */
export function decouper(commande) {
  const texte = String(commande || '')
    .replace(/\\\r?\n/g, ' ')      // continuation shell
    .replace(/\^\r?\n/g, ' ')      // continuation cmd.exe
    .replace(/`\r?\n/g, ' ')       // continuation PowerShell
    .replace(/\r?\n/g, ' ');

  const jetons = [];
  let courant = '';
  let dedans = false;              // un jeton est en cours de construction
  let quote = null;                // ' ou " quand on est dans une chaine

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];

    if (quote === "'") {
      // Entre apostrophes, rien ne s echappe : c est la regle du shell POSIX.
      if (c === "'") quote = null; else courant += c;
      continue;
    }
    if (quote === '"') {
      // Deux echappements coexistent dans les guillemets : la barre oblique
      // inverse du shell POSIX, et l accent grave de PowerShell. Il faut
      // comprendre les deux pour relire ce que nos propres generateurs
      // ecrivent (cURL bash, cURL PowerShell, cURL cmd.exe).
      const echappe = (c === '\\' || c === '`') &&
                      i + 1 < texte.length && '"\\$`'.includes(texte[i + 1]);
      if (echappe) {
        courant += texte[++i];
      } else if (c === '"') {
        quote = null;
      } else {
        courant += c;
      }
      continue;
    }

    if (c === "'" || c === '"') { quote = c; dedans = true; continue; }
    if (c === '\\' && i + 1 < texte.length) { courant += texte[++i]; dedans = true; continue; }
    if (/\s/.test(c)) {
      if (dedans) { jetons.push(courant); courant = ''; dedans = false; }
      continue;
    }
    courant += c;
    dedans = true;
  }
  if (dedans) jetons.push(courant);
  return jetons;
}

/* ------------------------------- Analyse ---------------------------------- */
const SANS_VALEUR = new Set([
  '-L', '--location', '-k', '--insecure', '--compressed', '-s', '--silent',
  '-v', '--verbose', '-i', '--include', '-S', '--show-error', '-f', '--fail',
  '-g', '--globoff', '--no-buffer', '-N', '--tlsv1.2', '--tlsv1.3', '-4', '-6',
  '--http1.1', '--http2', '--http3', '--path-as-is', '--raw'
]);

const AVEC_VALEUR = new Set([
  '-X', '--request', '-H', '--header', '-d', '--data', '--data-raw',
  '--data-binary', '--data-ascii', '--data-urlencode', '--json', '-F', '--form',
  '-u', '--user', '-b', '--cookie', '-A', '--user-agent', '-e', '--referer',
  '-o', '--output', '--url', '--connect-timeout', '-m', '--max-time',
  '-x', '--proxy', '--retry', '--resolve', '-T', '--upload-file'
]);

/**
 * Analyse une commande cURL.
 * @returns {{ method, url, headers, body, warnings }}
 */
export function analyserCurl(commande) {
  const jetons = decouper(commande);
  if (!jetons.length) throw new Error('commande vide');

  const debut = jetons.findIndex(j => /^curl$/i.test(j) || /curl(\.exe)?$/i.test(j));
  const args = debut >= 0 ? jetons.slice(debut + 1) : jetons;

  const resultat = {
    method: null,
    url: '',
    headers: [],
    body: null,
    warnings: []
  };
  const morceauxCorps = [];
  let forcerGet = false;
  let teteSeule = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    if (a === '-G' || a === '--get') { forcerGet = true; continue; }
    if (a === '-I' || a === '--head') { teteSeule = true; continue; }
    if (SANS_VALEUR.has(a)) continue;

    // Forme collee : -XPOST, -H'Nom: valeur'
    if (/^-X./.test(a) && !a.startsWith('--')) { resultat.method = a.slice(2).toUpperCase(); continue; }
    if (/^-H./.test(a) && !a.startsWith('--')) { ajouterEntete(resultat, a.slice(2)); continue; }
    if (/^-d./.test(a) && !a.startsWith('--')) { morceauxCorps.push(a.slice(2)); continue; }

    if (AVEC_VALEUR.has(a)) {
      const v = args[++i];
      if (v === undefined) { resultat.warnings.push('option sans valeur : ' + a); continue; }
      appliquer(resultat, morceauxCorps, a, v);
      continue;
    }

    if (a.startsWith('--') && a.includes('=')) {
      const coupe = a.indexOf('=');
      const nom = a.slice(0, coupe);
      if (AVEC_VALEUR.has(nom)) { appliquer(resultat, morceauxCorps, nom, a.slice(coupe + 1)); continue; }
    }

    if (a.startsWith('-')) { resultat.warnings.push('option ignoree : ' + a); continue; }

    // Tout ce qui reste et ressemble a une adresse est l URL.
    if (!resultat.url) resultat.url = a;
    else resultat.warnings.push('argument ignore : ' + a);
  }

  if (!resultat.url) throw new Error('aucune URL trouvee dans la commande');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(resultat.url)) resultat.url = 'https://' + resultat.url;
  try { new URL(resultat.url); }
  catch { throw new Error('URL invalide : ' + resultat.url); }

  if (morceauxCorps.length) resultat.body = morceauxCorps.join('&');

  // La methode suit les regles de cURL : -d implique POST, -I implique HEAD,
  // -G renvoie le corps dans la chaine de requete.
  if (forcerGet && resultat.body) {
    const u = new URL(resultat.url);
    for (const paire of resultat.body.split('&')) {
      const coupe = paire.indexOf('=');
      if (coupe < 0) u.searchParams.append(paire, '');
      else u.searchParams.append(paire.slice(0, coupe), paire.slice(coupe + 1));
    }
    resultat.url = u.href;
    resultat.body = null;
  }
  if (!resultat.method) {
    if (teteSeule) resultat.method = 'HEAD';
    else if (resultat.body != null) resultat.method = 'POST';
    else resultat.method = 'GET';
  }
  return resultat;
}

function ajouterEntete(resultat, brut) {
  const texte = String(brut);
  const coupe = texte.indexOf(':');
  if (coupe < 0) { resultat.warnings.push('entete sans deux-points : ' + texte); return; }
  const name = texte.slice(0, coupe).trim();
  const value = texte.slice(coupe + 1).trim();
  if (!name) { resultat.warnings.push('entete sans nom : ' + texte); return; }
  resultat.headers.push({ name, value });
}

function appliquer(resultat, morceauxCorps, option, valeur) {
  switch (option) {
    case '-X': case '--request':
      resultat.method = String(valeur).toUpperCase(); break;
    case '-H': case '--header':
      ajouterEntete(resultat, valeur); break;
    case '-d': case '--data': case '--data-raw': case '--data-binary':
    case '--data-ascii': case '--data-urlencode':
      morceauxCorps.push(String(valeur)); break;
    case '--json':
      morceauxCorps.push(String(valeur));
      if (!resultat.headers.some(h => h.name.toLowerCase() === 'content-type')) {
        resultat.headers.push({ name: 'Content-Type', value: 'application/json' });
      }
      break;
    case '-F': case '--form':
      // Un envoi multipart ne se reconstitue pas fidelement en texte : on le
      // dit plutot que de fabriquer un corps qui ne correspondrait a rien.
      morceauxCorps.push(String(valeur));
      resultat.warnings.push('formulaire multipart approxime : ' + valeur);
      break;
    case '-u': case '--user': {
      const encode = typeof btoa === 'function' ? btoa(String(valeur)) : null;
      if (encode) resultat.headers.push({ name: 'Authorization', value: 'Basic ' + encode });
      else resultat.warnings.push('identifiants non convertis : ' + valeur);
      break;
    }
    case '-b': case '--cookie':
      resultat.headers.push({ name: 'Cookie', value: String(valeur) }); break;
    case '-A': case '--user-agent':
      resultat.headers.push({ name: 'User-Agent', value: String(valeur) }); break;
    case '-e': case '--referer':
      resultat.headers.push({ name: 'Referer', value: String(valeur) }); break;
    case '--url':
      resultat.url = String(valeur); break;
    default:
      // Options connues mais sans effet sur la requete reconstituee.
      resultat.warnings.push('option sans effet ici : ' + option);
  }
}
