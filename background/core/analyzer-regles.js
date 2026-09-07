/* Regles d analyse — INTERCEPTOR (by D4RK)
 *
 * Une seule ligne de conduite : une alerte ne sort que si elle est
 * DEMONTRABLE a partir de ce qui a ete capture, et si elle correspond a une
 * faille reellement exploitable. Chaque alerte porte sa preuve : le fait
 * observe qui la justifie, en clair.
 *
 * Suite de analyzer.js, qui orchestre ; ici vit la matiere.
 */
import { config } from './config.js';
import { SECRET_PATTERNS, TRACKERS } from './secrets.js';

export function redact(value) {
  const s = String(value);
  if (!config.get('maskSecrets')) return s.length > 300 ? s.slice(0, 300) + '…' : s;
  if (s.length <= 12) return s.slice(0, 3) + '***';
  return s.slice(0, 6) + '…' + s.slice(-4) + ' (' + s.length + ' car.)';
}

export function addFinding(list, seen, f) {
  const key = f.rule + '|' + f.where + '|' + (f.sample || '');
  if (seen.has(key)) return;      // anti-doublon interne aux findings
  seen.add(key);
  list.push(f);
}

function runPatterns(patterns, text, where, list, seen, rule, guardMax) {
  for (const [re, label, severity] of patterns) {
    re.lastIndex = 0;
    let m, guard = 0;
    while ((m = re.exec(text)) !== null && guard++ < guardMax) {
      addFinding(list, seen, {
        rule, severity, title: label, where, sample: redact(m[1] || m[0]),
        preuve: 'une valeur au format propre a ce fournisseur a ete trouvee dans « {ou} » : '
          + 'ce format ne designe qu un identifiant secret, il ne se confond avec rien',
        preuveValeurs: { ou: where }
      });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
}

export function scanText(text, where, list, seen, customSecrets = []) {
  if (!text) return;
  if (config.get('analyzeSecrets')) {
    runPatterns(SECRET_PATTERNS, text, where, list, seen, 'secret', 50);
    if (customSecrets.length) runPatterns(customSecrets, text, where, list, seen, 'secret', 50);
  }
}

/**
 * Applique toutes les regles a un enregistrement. Le contexte porte ce que
 * l orchestrateur a deja prepare : entetes indexees, listes a remplir, et
 * les motifs personnels compiles depuis les reglages.
 */
export function appliquerRegles(contexte) {
  const { rec, reqH, resH, findings, seen, tags, customSecrets, customTrackers } = contexte;

  /* ==================================================================
     Regles d analyse — une seule ligne de conduite : une alerte ne sort
     que si elle est DEMONTRABLE a partir de ce qui a ete capture, et si
     elle correspond a une faille reellement exploitable.

     Ce qui a ete volontairement retire, et pourquoi :
       - « entetes de securite absents » : un durcissement manquant n est
         pas une faille, c est une occasion manquee. Rien n est exploitable
         du seul fait qu un entete n est pas la.
       - « donnees personnelles » (courriel, carte, IBAN par expression
         reguliere) : trop de fausses pistes, et trouver une adresse dans
         une page n est pas une vulnerabilite.
       - « pisteur » et « classement Firefox » : ce sont des faits de vie
         privee, exacts mais sans rapport avec une faille. Ils restent en
         etiquette, plus en alerte.
       - « entete d authentification » repere au nom : deviner qu un entete
         appele « x-token » contient un secret est une supposition.
       - « redirection inter-origines » : comportement normal du web.

     Chaque alerte porte desormais une `preuve` : le fait observe qui la
     justifie, en clair. Aucune n est deduite d une probabilite.
     ================================================================== */

  const url = rec.finalUrl || rec.url;

  /* --- 1. Secrets de fournisseur reellement exposes ---
     Seuls les formats proprietaires sont retenus (AKIA…, ghp_…, sk_live_…,
     bloc PEM). Ils ne se confondent avec rien : un tel motif dans le trafic
     est une fuite, pas une hypothese. */
  scanText(url, 'url', findings, seen, customSecrets);
  for (const h of rec.requestHeaders || []) {
    scanText(h.value, 'requestHeaders.' + String(h.name).toLowerCase(), findings, seen, customSecrets);
  }
  for (const h of rec.responseHeaders || []) {
    scanText(h.value, 'responseHeaders.' + String(h.name).toLowerCase(), findings, seen, customSecrets);
  }
  if (rec.requestBody && rec.requestBody.text) scanText(rec.requestBody.text, 'requestBody', findings, seen, customSecrets);
  if (rec.responseBody && rec.responseBody.text) scanText(rec.responseBody.text, 'responseBody', findings, seen, customSecrets);
  for (const f of (rec.ws && rec.ws.frames) || []) {
    if (f.data) scanText(f.data, 'websocket.' + f.dir, findings, seen, customSecrets);
  }
  for (const m of (rec.sse && rec.sse.messages) || []) {
    if (m.data) scanText(m.data, 'sse.' + (m.event || 'message'), findings, seen, customSecrets);
  }

  /* --- 2. Identifiants ecrits dans l URL ---
     `https://utilisateur:motdepasse@hote/` : la valeur est dans l URL, donc
     dans l historique, les journaux du serveur et l entete Referer. */
  if (config.get('analyzeSecrets')) {
    const identifiants = /^[a-z][a-z0-9+.-]*:\/\/([^/@\s:]+):([^/@\s]+)@/i.exec(url);
    if (identifiants) {
      addFinding(findings, seen, {
        rule: 'exposure', severity: 'critical', title: 'Identifiants ecrits dans l URL',
        where: 'url', sample: redact(identifiants[2]),
        preuve: 'l URL contient « {utilisateur}:***@ » : le mot de passe voyage dans l adresse, '
          + 'donc dans l historique, les journaux et l entete Referer',
        preuveValeurs: { utilisateur: identifiants[1] }
      });
      tags.add('secret-in-url');
    }

    /* Jeton porteur dans la query string. On exige un nom de parametre sans
       ambiguite ET une valeur assez longue pour etre un jeton : un « key=3 »
       de tri ne declenche rien. */
    const PLACEHOLDERS = /^(redacted|null|undefined|none|test|xxx+|\*+|changeme|todo|example)$/i;
    let parametres = [];
    try { parametres = [...new URL(url).searchParams.entries()]; } catch { parametres = []; }
    for (const [nom, valeur] of parametres) {
      if (!/^(access_token|id_token|refresh_token|api_key|apikey|auth_token|session_?id|password|passwd|pwd|secret)$/i.test(nom)) continue;
      if (!valeur || valeur.length < 16 || PLACEHOLDERS.test(valeur)) continue;
      addFinding(findings, seen, {
        rule: 'exposure', severity: 'high', title: 'Jeton passe en query string',
        where: 'url', sample: nom + ' = ' + redact(valeur),
        preuve: 'le parametre « {nom} » porte une valeur de {taille} caracteres ; une URL est '
          + 'journalisee par le serveur, les mandataires et le cache du navigateur',
        preuveValeurs: { nom, taille: valeur.length }
      });
      tags.add('secret-in-url');
    }
  }

  /* --- 3. Jeton JWT signe avec « alg: none » ---
     Un jeton non signe circule : si le serveur l accepte, n importe qui
     fabrique une identite. Le fait est lisible dans le jeton lui-meme. */
  if (config.get('analyzeSecrets')) {
    const jwts = String(url + ' ' + (reqH.authorization || '') + ' ' + (reqH.cookie || '') +
      ' ' + ((rec.requestBody && rec.requestBody.text) || ''))
      .match(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g) || [];
    for (const jeton of jwts.slice(0, 4)) {
      let entete = null;
      try {
        const brut = jeton.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
        entete = JSON.parse(atob(brut + '='.repeat((4 - brut.length % 4) % 4)));
      } catch { entete = null; }
      if (entete && String(entete.alg || '').toLowerCase() === 'none') {
        addFinding(findings, seen, {
          rule: 'jwt', severity: 'critical', title: 'Jeton JWT non signe (alg: none)',
          where: 'requete', sample: redact(jeton),
          preuve: 'l entete du jeton declare « alg: none » : sa charge utile se modifie sans cle'
        });
        tags.add('jwt-none');
      }
    }
  }

  /* --- 4. Transport : ce qui est reellement interceptable ou casse --- */
  if (config.get('analyzeTransport')) {
    const local = /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/i.test(rec.host) || /\.local$/i.test(rec.host);
    if (rec.scheme === 'http' && !local) {
      tags.add('cleartext');
      /* Une page HTTP est modifiable en chemin, mais ne rien avoir a voler ne
         fait pas une faille exploitable. On n alerte que si quelque chose
         circule vraiment : identifiants, cookie de session, ou corps envoye. */
      const raisons = [];
      if (reqH.authorization) raisons.push('entete Authorization');
      if (reqH.cookie) raisons.push('cookie envoye');
      if (rec.requestBody && rec.requestBody.size) raisons.push('corps de requete');
      if (raisons.length) {
        addFinding(findings, seen, {
          rule: 'transport', severity: 'critical', title: 'Donnees envoyees en clair (HTTP)',
          where: 'transport', sample: rec.host,
          preuve: 'schema http vers {hote}, avec {raisons} : tout intermediaire du chemin '
            + 'lit et modifie ce contenu',
          preuveValeurs: { hote: rec.host, raisons: raisons.join(' + ') }
        });
      }
    }
    if (rec.documentUrl && rec.documentUrl.startsWith('https://') && rec.scheme === 'http' && !local) {
      addFinding(findings, seen, {
        rule: 'transport', severity: 'high', title: 'Contenu mixte sur page HTTPS',
        where: 'transport', sample: rec.host,
        preuve: 'la page est en https, cette ressource en http : elle est modifiable en chemin'
      });
      tags.add('mixed-content');
    }
    if (rec.security) {
      const s = rec.security;
      if (s.isUntrusted) {
        addFinding(findings, seen, {
          rule: 'tls', severity: 'critical', title: 'Certificat non fiable', where: 'tls', sample: rec.host,
          preuve: 'Firefox rejette la chaine de certification de {hote}',
          preuveValeurs: { hote: rec.host }
        });
      }
      if (s.isDomainMismatch) {
        addFinding(findings, seen, {
          rule: 'tls', severity: 'critical', title: 'Certificat : domaine non concordant',
          where: 'tls', sample: rec.host,
          preuve: 'le certificat presente ne couvre pas {hote}',
          preuveValeurs: { hote: rec.host }
        });
      }
      if (s.isNotValidAtThisTime) {
        addFinding(findings, seen, {
          rule: 'tls', severity: 'high', title: 'Certificat expire ou pas encore valide',
          where: 'tls', sample: rec.host,
          preuve: 'la periode de validite du certificat ne couvre pas la date du jour'
        });
      }
      if (s.protocolVersion && /^TLSv1(\.[01])?$/.test(s.protocolVersion)) {
        addFinding(findings, seen, {
          rule: 'tls', severity: 'high', title: 'Version TLS obsolete',
          where: 'tls', sample: rec.host,
          preuve: '{version} est retire depuis 2020 : ses modes de chiffrement sont attaquables',
          preuveValeurs: { version: s.protocolVersion }
        });
      }
      /* Suite de chiffrement cassee : le nom de la suite suffit a le dire. */
      const suite = String(s.cipherSuite || '');
      const casse = /_RC4_|_3DES_|_DES_|_NULL_|_EXPORT|_MD5$/.test(suite);
      if (casse) {
        addFinding(findings, seen, {
          rule: 'tls', severity: 'high', title: 'Suite de chiffrement cassee',
          where: 'tls', sample: suite,
          preuve: '{suite} emploie un algorithme casse (RC4, 3DES, DES, NULL, export ou MD5)',
          preuveValeurs: { suite }
        });
      }
      if (s.usedEch) tags.add('ech');
    }
  }

  /* --- 5. CORS reellement exploitable ---
     « * » avec credentials n est pas une faille : le navigateur refuse la
     combinaison, la requete echoue. Ce qui est exploitable, c est une origine
     RENVOYEE EN MIROIR avec credentials — n importe quel site lit alors la
     reponse authentifiee — ou l origine « null », que fabrique un cadre
     sandbox. Les deux se constatent en comparant la requete et la reponse. */
  if (config.get('analyzeHeaders')) {
    const acao = String(resH['access-control-allow-origin'] || '').trim();
    const avecCredentials = String(resH['access-control-allow-credentials'] || '').toLowerCase() === 'true';
    const origine = String(reqH.origin || '').trim();
    if (avecCredentials && acao && origine && acao === origine) {
      addFinding(findings, seen, {
        rule: 'cors', severity: 'critical', title: 'CORS : origine renvoyee en miroir avec credentials',
        where: 'responseHeaders', sample: acao,
        preuve: 'la requete annonce Origin: {origine} et la reponse renvoie exactement '
          + 'Access-Control-Allow-Origin: {acao} avec Allow-Credentials: true — n importe '
          + 'quel site peut donc lire cette reponse authentifiee',
        preuveValeurs: { origine, acao }
      });
      tags.add('cors-risk');
    }
    if (avecCredentials && acao.toLowerCase() === 'null') {
      addFinding(findings, seen, {
        rule: 'cors', severity: 'high', title: 'CORS : origine « null » avec credentials',
        where: 'responseHeaders', sample: acao,
        preuve: 'un document sandbox ou une page locale presente Origin: null : '
          + 'la reponse authentifiee lui est ouverte'
      });
      tags.add('cors-risk');
    }
    if (acao === '*') tags.add('cors-open');
  }

  /* --- 6. Cookies : uniquement ce qui casse une protection --- */
  for (const c of rec.cookies.set) {
    tags.add('sets-cookie');
    if (!config.get('analyzeCookies')) continue;
    const nom = String(c.name || '');

    /* Un cookie pose sans Secure sur une connexion en clair est expose : il
       part ensuite sur chaque requete http, lisible par le chemin. */
    if (rec.scheme === 'http' && !c.secure) {
      addFinding(findings, seen, {
        rule: 'cookie', severity: 'high', title: 'Cookie pose en clair',
        where: 'set-cookie', sample: nom,
        preuve: 'pose par une reponse http sans attribut Secure : il repartira en clair'
      });
    }
    /* Les prefixes __Host- et __Secure- ont des regles imposees. Quand elles
       ne sont pas tenues, le navigateur REFUSE le cookie : la protection
       attendue n existe pas. C est verifiable, pas suppose. */
    if (nom.startsWith('__Host-') && (!c.secure || c.path !== '/' || c.domain)) {
      addFinding(findings, seen, {
        rule: 'cookie', severity: 'medium', title: 'Prefixe __Host- non respecte',
        where: 'set-cookie', sample: nom,
        preuve: '__Host- exige Secure, Path=/ et aucun Domain : le navigateur rejette ce cookie'
      });
    }
    if (nom.startsWith('__Secure-') && !c.secure) {
      addFinding(findings, seen, {
        rule: 'cookie', severity: 'medium', title: 'Prefixe __Secure- non respecte',
        where: 'set-cookie', sample: nom,
        preuve: '__Secure- exige l attribut Secure : le navigateur rejette ce cookie'
      });
    }
    if (String(c.sameSite || '').toLowerCase() === 'none' && !c.secure) {
      addFinding(findings, seen, {
        rule: 'cookie', severity: 'medium', title: 'SameSite=None sans Secure',
        where: 'set-cookie', sample: nom,
        preuve: 'SameSite=None impose Secure : le navigateur rejette ce cookie'
      });
    }
  }

  /* --- 7. Etiquettes de contexte ---
     Faits exacts, mais qui ne sont pas des failles : ils restent en etiquette,
     visibles dans le tableau et filtrables, jamais comptes comme alertes. */
  if (reqH.authorization) tags.add('authenticated');
  if (reqH.cookie) tags.add('cookies-sent');
  if (config.get('analyzeTrackers')) {
    const minuscule = url.toLowerCase();
    if (TRACKERS.find(t => minuscule.includes(t)) || customTrackers.find(t => minuscule.includes(t))) {
      tags.add('tracker');
    }
    if (rec.urlClassification) {
      const cats = [
        ...(rec.urlClassification.firstParty || []),
        ...(rec.urlClassification.thirdParty || [])
      ];
      if (cats.length) tags.add('classe-firefox');
      if (cats.includes('fingerprinting')) tags.add('fingerprinting');
      if (cats.includes('cryptomining')) tags.add('cryptomining');
    }
  }
  if (rec.thirdParty) tags.add('third-party');
  if (['beacon', 'ping', 'csp_report'].includes(rec.type)) tags.add('beacon');
  if (rec.fromCache) tags.add('cache');
  if (rec.redirects.length) {
    tags.add('redirect');
    const croisee = rec.redirects.some(r => {
      try { return new URL(r.from).origin !== new URL(r.to).origin; } catch { return false; }
    });
    if (croisee) tags.add('cross-origin-redirect');
  }
}
