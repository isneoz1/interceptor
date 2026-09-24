/* Dictionnaire anglais — outils de securite de la 4.5 — INTERCEPTOR (by NeoZ)
 *
 * Complete dict-en.js (`...EN_SECURITE`) : faits constates par l analyseur,
 * protections de la reponse, politique CSP observee, OAuth, SAML, SRI. Et les
 * phrases que la comparaison des onglets du detail dans les deux langues a
 * trouvees ecrites directement dans la page, sans passer par la traduction.
 */
export const EN_SECURITE = {
  /* ----------------- Ecrit directement dans la page, avant ----------------- */
  'Aucune alerte ne correspond aux filtres choisis.': 'No alert matches the chosen filters.',
  'Lecture des deux enregistrements…': 'Reading both records…',
  'Aucun entete capture des deux cotes.': 'No header captured on either side.',
  'Les deux corps sont rigoureusement identiques.': 'The two bodies are strictly identical.',
  'Cette reponse ne pose aucun cookie.': 'This response sets no cookie.',
  'SameSite absent': 'SameSite missing',
  '(hote courant)': '(current host)',
  'Aucun cookie enregistre pour cette URL.': 'No cookie stored for this URL.',
  'Aucune mutation de cookie rattachee a cette requete.': 'No cookie change linked to this request.',
  'Aucune information TLS : la couche est desactivee, ou la reponse vient du cache.':
    'No TLS information: the layer is disabled, or the response came from the cache.',
  'Requete non chiffree ({schema}) : il n y a pas de session TLS.':
    'Unencrypted request ({schema}): there is no TLS session.',
  'inconnu': 'unknown',
  'Autorite {n}': 'Authority {n}',
  'racine integree': 'built-in root',
  'Aucune alerte sur cette requete.': 'No alert on this request.',
  'propre': 'clean',
  'brutale': 'abrupt',
  'Cette requete ne transporte ni trame WebSocket ni message SSE.':
    'This request carries no WebSocket frame and no SSE message.',
  'Aucune pile : requete emise hors JavaScript (navigation, ressource HTML), depuis un Worker, ou capture des piles desactivee.':
    'No stack: the request was made outside JavaScript (navigation, HTML resource), from a Worker, or stack capture is disabled.',
  'Copier la pile': 'Copy the stack',
  'Pile copiee': 'Stack copied',
  'Chaque champ conserve par INTERCEPTOR figure ici, y compris ceux qui n ont pas de presentation dediee.':
    'Every field INTERCEPTOR keeps is here, including those without a dedicated presentation.',
  'Aucun entete capture pour cette phase.': 'No header captured for this phase.',
  'oui (cache, Service Worker ou requete bloquee)': 'yes (cache, Service Worker or blocked request)',
  'importee depuis un fichier HAR': 'imported from a HAR file',
  'Aucun corps pour cette requete.': 'No body for this request.',
  'Corps present mais non textuel, ou capture desactivee dans les reglages.':
    'A body exists but is not text, or its capture is disabled in the settings.',
  'Choisissez un flux pour voir ses messages.': 'Choose a stream to see its messages.',
  'Lecture du flux…': 'Reading the stream…',
  '{envoyes} envoyes / {recus} recus': '{envoyes} sent / {recus} received',
  'sans motif': 'no reason given',
  'Aucune': 'None',

  /* ------------------------ Faits constates, alertes ----------------------- */
  'Faits constates': 'Observed facts',
  'Ces faits ne sont pas des failles a eux seuls : ils disent ce qui a ete observe, pour qu on aille voir.':
    'These facts are not vulnerabilities by themselves: they state what was observed, so you can take a look.',
  'le parametre {nom} ({ou}) revient {n} fois dans la reponse, avec ses caracteres speciaux non echappes':
    'parameter {nom} ({ou}) comes back {n} times in the response, with its special characters unescaped',
  'le parametre {nom} ({ou}) revient {n} fois tel quel dans la reponse':
    'parameter {nom} ({ou}) comes back {n} times verbatim in the response',
  'la redirection {statut} mene exactement a la valeur du parametre {nom} : {cible}':
    'the {statut} redirect leads exactly to the value of parameter {nom}: {cible}',
  'corps de la requete': 'request body',
  'Nonce CSP reutilise': 'CSP nonce reused',

  /* ------------------------ Empreintes du corps ---------------------------- */
  'Non verifiable : ': 'Not verifiable: ',
  'le texte conserve ne redonne pas exactement les octets envoyes': 'the stored text does not reproduce the exact bytes sent',
  'corps non capture': 'body not captured',
  'la verification se fait a la capture, sur les octets recus ; ce corps n en a pas':
    'verification happens at capture time, on the bytes received; this body has none',
  'corps tronque a la capture : l empreinte porte sur le corps entier':
    'body truncated at capture: the digest covers the whole body',
  'le corps est arrive deja decode ({codage}) : l empreinte porte sur le flux code, qui n a pas ete vu':
    'the body arrived already decoded ({codage}): the digest covers the encoded stream, which was not seen',
  'reponse partielle (206) : Repr-Digest porte sur la representation entiere':
    'partial response (206): Repr-Digest covers the whole representation',
  'en-tete illisible : {erreur}': 'unreadable header: {erreur}',
  'l empreinte ne correspond pas aux octets recus, et rien ne prouve qu ils sont le flux code ({codage}) : pas de verdict':
    'the digest does not match the bytes received, and nothing proves they are the encoded stream ({codage}): no verdict',

  /* ------------------------------ Protections ------------------------------ */
  'Protections de la reponse': 'Response protections',
  'document': 'document',
  'ressource': 'resource',
  'Ce qui est en place, et ce qui s applique quand rien n est dit. Une protection absente n est pas une faille a elle seule.':
    'What is in place, and what applies when nothing is said. A missing protection is not a vulnerability by itself.',
  'aucun referent n est envoye': 'no referrer is sent',
  'URL complete, sauf vers http depuis https': 'full URL, except to http from https',
  'URL complete vers la meme origine, rien ailleurs': 'full URL to the same origin, nothing elsewhere',
  'seulement l origine, partout': 'only the origin, everywhere',
  'seulement l origine, et rien vers http depuis https': 'only the origin, and nothing to http from https',
  'URL complete vers la meme origine, l origine ailleurs': 'full URL to the same origin, the origin elsewhere',
  'URL complete vers la meme origine, l origine ailleurs, rien vers http depuis https':
    'full URL to the same origin, the origin elsewhere, nothing to http from https',
  'URL complete partout, y compris vers http': 'full URL everywhere, including to http',
  'absent de cette reponse, mais Firefox applique deja HSTS a cet hote (liste de prechargement ou visite anterieure)':
    'absent from this response, but Firefox already applies HSTS to this host (preload list or an earlier visit)',
  'absent : rien n oblige le navigateur a revenir en https si on lui donne une adresse http':
    'absent: nothing forces the browser back to https when given an http address',
  'ignore : recu sur une connexion non chiffree (RFC 6797, 8.1)': 'ignored: received over an unencrypted connection (RFC 6797, 8.1)',
  'inoperant : max-age absent ou invalide (RFC 6797, 6.1.1)': 'ineffective: max-age missing or invalid (RFC 6797, 6.1.1)',
  'max-age=0 : demande au navigateur d oublier HSTS pour cet hote': 'max-age=0: tells the browser to forget HSTS for this host',
  'impose https pendant {jours} jours, a cet hote et a ses sous-domaines':
    'enforces https for {jours} days, on this host and its subdomains',
  'impose https pendant {jours} jours, a cet hote seulement': 'enforces https for {jours} days, on this host only',
  'l en-tete remplit les conditions d en-tete de la liste de prechargement (max-age d un an, includeSubDomains, preload) ; la liste exige aussi que chaque sous-domaine serve https, ce qui ne se voit pas d ici':
    'the header meets the preload list header requirements (one-year max-age, includeSubDomains, preload); the list also requires every subdomain to serve https, which cannot be seen from here',
  'preload est demande, mais la liste de prechargement exige aussi max-age d au moins un an et includeSubDomains':
    'preload is requested, but the preload list also requires a max-age of at least one year and includeSubDomains',
  'appliquee par l en-tete ({n} directives) — detail plus haut': 'enforced by the header ({n} directives) — detail above',
  'declaree dans une balise <meta> du document (frame-ancestors et les rapports n y sont pas pris en compte)':
    'declared in a <meta> tag of the document (frame-ancestors and reporting are not honoured there)',
  'en observation seulement (Report-Only) : rien n est bloque': 'observation only (Report-Only): nothing is blocked',
  'absente des en-tetes ; une balise <meta> n a pas pu etre cherchee, le corps n ayant pas ete capture':
    'absent from the headers; a <meta> tag could not be looked for, as the body was not captured',
  'absente des en-tetes comme du document': 'absent from the headers and from the document',
  'CSP frame-ancestors {valeur} — X-Frame-Options est alors ignore': 'CSP frame-ancestors {valeur} — X-Frame-Options is then ignored',
  'CSP frame-ancestors {valeur}': 'CSP frame-ancestors {valeur}',
  'X-Frame-Options DENY : aucune page ne peut encadrer celle-ci': 'X-Frame-Options DENY: no page can frame this one',
  'X-Frame-Options SAMEORIGIN : seule la meme origine peut encadrer cette page': 'X-Frame-Options SAMEORIGIN: only the same origin can frame this page',
  'X-Frame-Options ALLOW-FROM n est plus reconnu par les navigateurs : la page peut etre encadree':
    'X-Frame-Options ALLOW-FROM is no longer recognised by browsers: the page can be framed',
  'X-Frame-Options {valeur} n est pas une valeur reconnue : elle est ignoree': 'X-Frame-Options {valeur} is not a recognised value: it is ignored',
  'aucune protection : n importe quel site peut encadrer cette page': 'no protection: any site can frame this page',
  'le navigateur refuse un script ou une feuille de style servis sous un autre type':
    'the browser refuses a script or stylesheet served under another type',
  'absent : le navigateur peut deviner le type d un contenu': 'absent: the browser may guess the type of a content',
  'valeur non reconnue ; Firefox applique strict-origin-when-cross-origin : {sens}':
    'unrecognised value; Firefox applies strict-origin-when-cross-origin: {sens}',
  'absente ; Firefox applique strict-origin-when-cross-origin : {sens}': 'absent; Firefox applies strict-origin-when-cross-origin: {sens}',
  '{politique} : {sens}': '{politique}: {sens}',
  'absente : aucune fonction du navigateur n est restreinte par la page': 'absent: no browser feature is restricted by the page',
  'coupees : {coupees} ; limitees : {limitees}': 'disabled: {coupees}; restricted: {limitees}',
  'absent : une fenetre ouverte depuis une autre origine garde une reference a celle-ci':
    'absent: a window opened from another origin keeps a reference to this one',
  'la page est isolee des autres origines (crossOriginIsolated)': 'the page is isolated from other origins (crossOriginIsolated)',
  'la page n est pas isolee : il faudrait COOP same-origin et COEP require-corp ou credentialless':
    'the page is not isolated: that takes COOP same-origin and COEP require-corp or credentialless',
  '{valeur} : qui peut charger cette ressource': '{valeur}: who may load this resource',
  'absent : toute origine peut charger cette ressource en no-cors': 'absent: any origin can load this resource in no-cors mode',
  'le serveur annonce une version : {valeur}': 'the server announces a version: {valeur}',
  'le serveur se nomme : {valeur}': 'the server names itself: {valeur}',

  /* ------------------------------ CSP deduite ------------------------------ */
  'Une CSP deduite de ce que la page a charge': 'A CSP derived from what the page loaded',
  '{n} chargements': '{n} loads',
  'Copier en Report-Only': 'Copy as Report-Only',
  'Politique copiee': 'Policy copied',
  'Copier la politique': 'Copy the policy',
  'les scripts et styles ecrits dans la page, les attributs onclick et eval() ne passent pas par le reseau : la politique ne les autorise pas':
    'scripts and styles written in the page, onclick attributes and eval() do not go through the network: the policy does not allow them',
  'base-uri, form-action et frame-ancestors ne se deduisent d aucun chargement : a decider soi-meme':
    'base-uri, form-action and frame-ancestors cannot be derived from any load: decide them yourself',
  'ce que la page n a pas charge pendant la capture n y figure pas : a essayer d abord en Report-Only':
    'what the page did not load during the capture is not in it: try it in Report-Only first',

  /* --------------------------------- OAuth --------------------------------- */
  'OAuth 2.0 — demande d autorisation': 'OAuth 2.0 — authorization request',
  'OpenID Connect — demande d autorisation': 'OpenID Connect — authorization request',
  'OAuth 2.0 — demande de jeton': 'OAuth 2.0 — token request',
  'OAuth 2.0 — reponse de jeton': 'OAuth 2.0 — token response',
  'Ouvrir l id_token dans la boite a outils': 'Open the id_token in the toolbox',
  'response_type={rt} delivre un jeton dans la reponse d autorisation : la RFC 9700 (2.1.2) recommande de ne plus employer ce flux':
    'response_type={rt} delivers a token in the authorization response: RFC 9700 (2.1.2) recommends no longer using this flow',
  'aucun code_challenge : PKCE n est pas employe, alors que la RFC 9700 (2.1.1) l impose aux clients publics et le recommande a tous':
    'no code_challenge: PKCE is not used, while RFC 9700 (2.1.1) requires it from public clients and recommends it for all',
  'code_challenge_method=plain : la RFC 7636 (4.2) impose S256 des que le client en est capable':
    'code_challenge_method=plain: RFC 7636 (4.2) requires S256 whenever the client is capable of it',
  'code_challenge sans code_challenge_method : la methode vaut alors plain (RFC 7636, 4.3)':
    'code_challenge without code_challenge_method: the method is then plain (RFC 7636, 4.3)',
  'ni state, ni PKCE, ni nonce : aucune protection contre la falsification de requete n est visible dans cette demande (RFC 9700, 2.1)':
    'no state, no PKCE, no nonce: no protection against request forgery is visible in this request (RFC 9700, 2.1)',
  'redirect_uri en http : ce qui revient au client transite en clair (RFC 6749, 3.1.2.1)':
    'redirect_uri over http: what comes back to the client travels in the clear (RFC 6749, 3.1.2.1)',
  'grant_type=password : la RFC 9700 (2.4) interdit ce flux, qui confie le mot de passe au client':
    'grant_type=password: RFC 9700 (2.4) forbids this flow, which hands the password to the client',
  'code_verifier present : la demande de jeton prouve la possession du code (PKCE)':
    'code_verifier present: the token request proves possession of the code (PKCE)',
  'client_secret envoye dans le corps : client confidentiel': 'client_secret sent in the body: confidential client',
  'un refresh_token est delivre : il permet d obtenir de nouveaux jetons sans l utilisateur':
    'a refresh_token is issued: it obtains new tokens without the user',
  'un id_token (JWT) est delivre : c est une reponse OpenID Connect': 'an id_token (JWT) is issued: this is an OpenID Connect response',

  /* ---------------------------------- SAML --------------------------------- */
  'SAML 2.0': 'SAML 2.0',
  'Decodage…': 'Decoding…',
  'Message': 'Message',
  'En reponse a': 'In response to',
  'Retour vers': 'Return to',
  'Sujet (NameID)': 'Subject (NameID)',
  'Format du sujet': 'Subject format',
  'Audience': 'Audience',
  'Valable a partir de': 'Valid from',
  'Valable jusqu au': 'Valid until',
  'Destinataire': 'Recipient',
  'Session': 'Session',
  'Attributs': 'Attributes',
  'RelayState': 'RelayState',
  'Copier le XML': 'Copy the XML',
  'XML copie': 'XML copied',
  'Ouvrir le XML dans la boite a outils': 'Open the XML in the toolbox',
  'Message SAML illisible : ': 'Unreadable SAML message: ',
  'SAML — decoder (liaison Redirect ou POST)': 'SAML — decode (Redirect or POST binding)',
  'la reponse elle-meme est signee (Signature dans Response)': 'the response itself is signed (Signature in Response)',
  'l assertion est signee (Signature dans Assertion)': 'the assertion is signed (Signature in Assertion)',
  'le message est signe par la liaison Redirect (parametre Signature, algorithme {alg})':
    'the message is signed by the Redirect binding (Signature parameter, algorithm {alg})',
  'aucune signature dans ce message': 'no signature in this message',
  'l assertion est chiffree (EncryptedAssertion) : son contenu ne se lit pas ici':
    'the assertion is encrypted (EncryptedAssertion): its content cannot be read here',
  'algorithme {alg} : SHA-1, que le NIST interdit pour produire des signatures (SP 800-131A)':
    'algorithm {alg}: SHA-1, which NIST disallows for generating signatures (SP 800-131A)',
  'deja expiree au moment de la capture (NotOnOrAfter {fin})': 'already expired at capture time (NotOnOrAfter {fin})',
  'pas encore valable au moment de la capture (NotBefore {debut})': 'not yet valid at capture time (NotBefore {debut})',
  'le message n est pas compresse, alors que la liaison Redirect exige DEFLATE (SAML 2.0 Bindings, 3.4.4.1)':
    'the message is not compressed, although the Redirect binding requires DEFLATE (SAML 2.0 Bindings, 3.4.4.1)',

  /* ---------------------------------- SRI ---------------------------------- */
  'Integrite de sous-ressource (SRI)': 'Subresource Integrity (SRI)',
  'L empreinte se calcule a la capture, sur les octets recus ; ce corps n en a pas.':
    'The digest is computed at capture time, on the bytes received; this body has none.',
  'Aucune empreinte : ': 'No digest: ',
  'Balise': 'Tag',
  'Cette ressource vient d une autre origine et sa reponse ne porte pas Access-Control-Allow-Origin : chargee avec crossorigin, elle serait refusee.':
    'This resource comes from another origin and its response carries no Access-Control-Allow-Origin: loaded with crossorigin, it would be refused.',
  'Copier la balise': 'Copy the tag',
  'Balise copiee': 'Tag copied',
  'Cliquer pour copier': 'Click to copy',
  'le nonce {nonce} figure deja dans la politique CSP de la reponse n° {id} ({url}) : un nonce n autorise un script que s il est imprevisible, donc different a chaque reponse — un script injecte peut reprendre celui-ci':
    'nonce {nonce} already appears in the CSP of response #{id} ({url}): a nonce only authorises a script if it is unpredictable, so different in every response — an injected script can reuse this one'
};
