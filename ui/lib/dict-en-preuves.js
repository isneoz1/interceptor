/* Dictionnaire anglais — signatures HTTP, WebAuthn, DNS (4.6) — INTERCEPTOR (by NeoZ)
 *
 * Complete dict-en.js (`...EN_PREUVES`) : signatures de messages HTTP
 * (RFC 9421), ceremonies WebAuthn et leurs options, messages DNS par HTTPS.
 */
export const EN_PREUVES = {
  /* ------------------------ Signatures de messages ------------------------- */
  'Signature de message HTTP (RFC 9421)': 'HTTP message signature (RFC 9421)',
  'Illisible : ': 'Unreadable: ',
  'Composants couverts': 'Covered components',
  '(aucun)': '(none)',
  'Creee le': 'Created at',
  'Cle (keyid)': 'Key (keyid)',
  'non annonce': 'not announced',
  'Nonce': 'Nonce',
  'Etiquette (tag)': 'Tag',
  'Autres parametres': 'Other parameters',
  'Base de signature non reconstruite : ': 'Signature base not rebuilt: ',
  'La base exacte que l emetteur a signee, reconstruite depuis ce que Firefox a rapporte :':
    'The exact base the signer signed, rebuilt from what Firefox reported:',
  'Copier la base': 'Copy the base',
  'Copier le base64': 'Copy the base64',
  'Base64 copie': 'Base64 copied',
  '(tronque a l affichage)': '(truncated for display)',
  'Base copiee': 'Base copied',
  'Cle publique (PEM, JWK ou certificat), ou secret partage pour hmac-sha256': 'Public key (PEM, JWK or certificate), or shared secret for hmac-sha256',
  'Forme du secret partage': 'Shared secret format',
  'secret en base64': 'secret in base64',
  'secret en hexadecimal': 'secret in hexadecimal',
  'secret en texte': 'secret as text',
  'Verification impossible : ': 'Verification impossible: ',
  'Signature valide ({alg})': 'Valid signature ({alg})',
  'Signature invalide ({alg})': 'Invalid signature ({alg})',
  'aucun composant couvert : cette signature ne lie rien du message (RFC 9421, 7.2.1)':
    'no covered component: this signature binds nothing of the message (RFC 9421, 7.2.1)',
  'le contenu n est pas couvert : aucun Content-Digest ni Repr-Digest parmi les composants (RFC 9421, 7.2.8)':
    'the content is not covered: no Content-Digest or Repr-Digest among the components (RFC 9421, 7.2.8)',
  'expiree au moment de la capture (expires {date})': 'expired at capture time (expires {date})',
  'creee {n} s apres la capture (created {date})': 'created {n} s after the capture (created {date})',
  'le libelle {libelle} figure dans Signature-Input mais pas dans Signature':
    'the label {libelle} is in Signature-Input but not in Signature',
  'le libelle {libelle} figure dans Signature mais pas dans Signature-Input':
    'the label {libelle} is in Signature but not in Signature-Input',
  'algorithme {alg} absent du registre IANA des signatures HTTP': 'algorithm {alg} is not in the IANA HTTP signature registry',
  'algorithme symetrique : quiconque peut verifier peut aussi signer (RFC 9421, 7.3.3)':
    'symmetric algorithm: anyone who can verify can also sign (RFC 9421, 7.3.3)',
  'requete redirigee : la base est construite sur le dernier saut ({url})':
    'redirected request: the base is built on the last hop ({url})',
  'le champ {nom} est absent des en-tetes rapportes par Firefox': 'the field {nom} is missing from the headers Firefox reported',
  'le composant {nom} est un trailer : Firefox ne les expose pas aux extensions':
    'the component {nom} is a trailer: Firefox does not expose trailers to extensions',
  'composant derive inconnu : {nom}': 'unknown derived component: {nom}',
  'parametre {param} inconnu sur le composant {nom}': 'unknown parameter {param} on the component {nom}',
  'parametres incompatibles sur le composant {nom}': 'incompatible parameters on the component {nom}',
  'le parametre req ne s applique qu a une reponse ({nom})': 'the req parameter only applies to a response ({nom})',
  'la requete de cette reponse n est pas connue ({nom})': 'the request of this response is not known ({nom})',
  '@status ne s applique qu a une reponse': '@status only applies to a response',
  'le composant {nom} figure deux fois': 'the component {nom} appears twice',
  'le parametre {param} manque ou figure plusieurs fois dans l URL': 'the parameter {param} is missing or repeated in the URL',
  'le composant {nom} ne dit pas quel parametre il couvre (name absent)': 'the component {nom} does not say which parameter it covers (no name)',
  'le composant {nom} n est pas une chaine : la RFC 9421 nomme chaque composant entre guillemets':
    'the component {nom} is not a string: RFC 9421 names every component in quotes',
  'liste interne attendue pour {libelle}': 'inner list expected for {libelle}',
  'la cle {cle} est absente du dictionnaire {nom}': 'the key {cle} is missing from the dictionary {nom}',
  'le type structure du champ {nom} n est pas connu : sf ne peut pas etre applique':
    'the structured type of the field {nom} is not known: sf cannot be applied',
  'la valeur de {nom} n est pas en ASCII : ses octets exacts ne sont pas connus':
    'the value of {nom} is not ASCII: its exact bytes are not known',

  /* -------------------------------- WebAuthn ------------------------------- */
  'WebAuthn': 'WebAuthn',
  'illisible': 'unreadable',
  'WebAuthn — inscription d une cle d acces': 'WebAuthn — passkey registration',
  'WebAuthn — connexion par cle d acces': 'WebAuthn — passkey sign-in',
  'WebAuthn — options d inscription': 'WebAuthn — registration options',
  'WebAuthn — options de connexion': 'WebAuthn — sign-in options',
  'envoyees par le serveur': 'sent by the server',
  'Origine signee': 'Signed origin',
  'Origine du cadre parent': 'Top-level origin',
  'Defi': 'Challenge',
  'Identifiant de la cle': 'Credential ID',
  'rpIdHash': 'rpIdHash',
  'Compteur de signatures': 'Signature counter',
  'AAGUID (modele)': 'AAGUID (model)',
  'Cle publique': 'Public key',
  'Attestation': 'Attestation',
  '{n} certificat(s)': '{n} certificate(s)',
  'Transports': 'Transports',
  'Utilisateur (userHandle)': 'User (userHandle)',
  'Copier la cle publique (JWK)': 'Copy the public key (JWK)',
  'Cle copiee': 'Key copied',
  'defi emis par la reponse n° {id}': 'challenge issued by response #{id}',
  'Cle publique prise dans l inscription capturee (ligne n° {id}).': 'Public key taken from the captured registration (row #{id}).',
  'L inscription de cette cle n a pas ete capturee : collez sa cle publique pour verifier la signature.':
    'The registration of this key was not captured: paste its public key to verify the signature.',
  'Cle publique (PEM, JWK ou certificat)': 'Public key (PEM, JWK or certificate)',
  'Domaine (rpId)': 'Domain (rpId)',
  'Utilisateur': 'User',
  'Algorithmes acceptes': 'Accepted algorithms',
  'Verification de l utilisateur': 'User verification',
  'Cle residente (passkey)': 'Resident key (passkey)',
  'Attestation demandee': 'Requested attestation',
  '{n} ms': '{n} ms',
  'Cles autorisees': 'Allowed keys',
  'Cles exclues': 'Excluded keys',
  'utilisateur present': 'user present',
  'utilisateur verifie': 'user verified',
  'cle sauvegardable': 'backup eligible',
  'cle sauvegardee': 'backed up',
  'cle publique jointe': 'public key included',
  'extensions jointes': 'extensions included',
  'rpIdHash = SHA-256 de « {rp} »': 'rpIdHash = SHA-256 of “{rp}”',
  'rpIdHash ne correspond ni a {hote} ni a un de ses domaines parents':
    'rpIdHash matches neither {hote} nor any of its parent domains',
  'presence de l utilisateur non attestee (drapeau UP absent)': 'user presence not attested (UP flag missing)',
  'utilisateur non verifie (drapeau UV absent) : seule sa presence est attestee':
    'user not verified (UV flag missing): only their presence is attested',
  'cle sauvegardee hors de l appareil (drapeaux BE et BS) : une cle synchronisee':
    'key backed up off the device (BE and BS flags): a synced passkey',
  'compteur de signatures a 0 : cet authentificateur n en tient pas': 'signature counter at 0: this authenticator keeps none',
  'type {type} dans clientDataJSON, alors que {attendu} est attendu': 'type {type} in clientDataJSON, while {attendu} is expected',
  'aucune attestation (format « none ») : le modele de l authentificateur n est pas prouve':
    'no attestation (“none” format): the authenticator model is not proven',
  'AAGUID nul : le modele de l authentificateur n est pas annonce': 'zero AAGUID: the authenticator model is not announced',
  'l identifiant annonce differe de celui que portent les donnees de l authentificateur':
    'the announced ID differs from the one in the authenticator data',
  'ceremonie lancee depuis un cadre d une autre origine (crossOrigin)': 'ceremony started from a frame of another origin (crossOrigin)',
  'defi de {n} octets : la specification en demande au moins 16 (WebAuthn, 13.4.3)':
    'challenge of {n} bytes: the specification asks for at least 16 (WebAuthn, 13.4.3)',
  'le serveur ne demande pas la verification de l utilisateur (userVerification « discouraged »)':
    'the server does not ask for user verification (userVerification “discouraged”)',
  'bits reserves des drapeaux mis a 1 : {bits}': 'reserved flag bits set: {bits}',
  'WebAuthn (cle d acces) — decoder': 'WebAuthn (passkey) — decode',

  /* ---------------------------------- DNS ---------------------------------- */
  'DNS par HTTPS — question': 'DNS over HTTPS — query',
  'DNS par HTTPS — reponse': 'DNS over HTTPS — response',
  'Message DNS illisible : ': 'Unreadable DNS message: ',
  'Identifiant du message': 'Message ID',
  'Question': 'Question',
  'EDNS': 'EDNS',
  'QUESTION': 'QUESTION',
  'REPONSE': 'ANSWER',
  'AUTORITE': 'AUTHORITY',
  'ADDITIONNEL': 'ADDITIONAL',
  '{sens}, opcode {opcode}, statut {statut}, id {id}': '{sens}, opcode {opcode}, status {statut}, id {id}',
  'drapeaux : {liste}': 'flags: {liste}',
  '{prefixe} (portee /{portee})': '{prefixe} (scope /{portee})',
  'client {client}': 'client {client}',
  'serveur {serveur}': 'server {serveur}',
  'octets du corps envoye non conserves': 'bytes of the sent body not kept',
  'corps binaire non conserve (reglage « corps binaires »)': 'binary body not kept (“binary bodies” setting)',
  'parametre dns= : base64url illisible': 'dns= parameter: unreadable base64url',
  'identifiant {id} : la RFC 8484 (4.1) demande 0, pour que les reponses se mettent en cache':
    'ID {id}: RFC 8484 (4.1) asks for 0, so that responses can be cached',
  'reponse tronquee (drapeau TC)': 'truncated response (TC flag)',
  'donnees validees par DNSSEC, selon le resolveur (drapeau AD)': 'data validated by DNSSEC, according to the resolver (AD flag)',
  'la requete demande les enregistrements DNSSEC (bit DO)': 'the query asks for DNSSEC records (DO bit)',
  'le sous-reseau du client est transmis aux serveurs (EDNS Client Subnet : {prefixe})':
    'the client subnet is passed to the servers (EDNS Client Subnet: {prefixe})',
  'message rembourre a une taille fixe (option Padding, RFC 7830)': 'message padded to a fixed size (Padding option, RFC 7830)',
  'erreur etendue {code} — {nom}{texte}': 'extended error {code} — {nom}{texte}',
  'Message DNS (DNS par HTTPS, RFC 8484) — decoder': 'DNS message (DNS over HTTPS, RFC 8484) — decode'
};
