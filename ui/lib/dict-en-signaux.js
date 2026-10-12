/* Signaux HTTP, en anglais — SWIFT (by NeoZ)
 *
 * Avenir de l adresse (Deprecation, Sunset), limites de debit (Retry-After,
 * RateLimit), liens (Link), services alternatifs (Alt-Svc), caches traverses
 * (Cache-Status, CDN-Cache-Control) et priorite (Priority) : ce que montre
 * ui/console/signaux-detail.js.
 */
export const EN_SIGNAUX = {
  /* ------------------------------ Dates HTTP -------------------------------- */
  'forme ancienne ({forme}) : acceptee, mais un emetteur doit ecrire IMF-fixdate (RFC 9110 §5.6.7)':
    'obsolete form ({forme}): accepted, but a sender must write IMF-fixdate (RFC 9110 §5.6.7)',
  'date ecrite hors des trois formes HTTP (RFC 9110 §5.6.7) : lue tout de meme':
    'date written outside the three HTTP forms (RFC 9110 §5.6.7): read anyway',
  'le jour de la semaine ne correspond pas a la date': 'the day of the week does not match the date',
  'dans {d}': 'in {d}',
  'il y a {d}': '{d} ago',

  /* ------------------------- Avenir de l adresse ---------------------------- */
  'Avenir de l adresse': 'Future of the address',
  'depreciee depuis le {date} : l adresse fonctionne toujours, mais son auteur en a annonce l abandon (RFC 9745)':
    'deprecated since {date}: the address still works, but its author has announced it will be abandoned (RFC 9745)',
  'depreciee a partir du {date} : l adresse fonctionne toujours, mais son auteur en annonce l abandon (RFC 9745)':
    'deprecated from {date}: the address still works, but its author announces it will be abandoned (RFC 9745)',
  'forme des premiers brouillons de la specification ({forme}) : la RFC 9745 exige une date de champ structure, comme @1688169599':
    'form of the first drafts of the specification ({forme}): RFC 9745 requires a structured-field date, such as @1688169599',
  'valeur illisible : la RFC 9745 exige une date de champ structure, comme @1688169599':
    'unreadable value: RFC 9745 requires a structured-field date, such as @1688169599',
  'fin de service prevue le {date} : l adresse devrait cesser de repondre a partir de la (Sunset, RFC 8594)':
    'end of service planned for {date}: the address should stop responding from then on (Sunset, RFC 8594)',
  'date de fin depassee ({date}) : l adresse peut cesser de repondre a tout moment (RFC 8594 §3)':
    'end date passed ({date}): the address may stop responding at any time (RFC 8594 §3)',
  'date de fin illisible : Sunset attend une date HTTP (RFC 8594 §3)':
    'unreadable end date: Sunset expects an HTTP date (RFC 8594 §3)',
  'la fin de service precede la depreciation : la RFC 9745 l interdit (§4) et conseille d en demander la raison a l auteur de l API':
    'the end of service comes before the deprecation: RFC 9745 forbids it (§4) and advises asking the API’s author why',
  'un indice, pas une panne : la depreciation ne change rien au fonctionnement (RFC 9745 §5)':
    'a hint, not an outage: deprecation changes nothing in how the address works (RFC 9745 §5)',
  'Documentation de la depreciation': 'Deprecation documentation',
  'Adresses qui annoncent leur retrait': 'Addresses announcing their retirement',
  'fin : {date}': 'end: {date}',
  'depreciee : {date}': 'deprecated: {date}',
  'depreciee': 'deprecated',
  'Politique de fin de service': 'End-of-service policy',

  /* --------------------------- Limites de debit ----------------------------- */
  'Limites de debit': 'Rate limits',
  'reessayer dans {duree} ({date})': 'retry in {duree} ({date})',
  'service indisponible pour ce client pendant {duree} encore, d apres le serveur (RFC 9110 §10.2.3)':
    'service unavailable to this client for {duree} more, according to the server (RFC 9110 §10.2.3)',
  'attendre au moins {duree} avant de suivre la redirection (RFC 9110 §10.2.3)':
    'wait at least {duree} before following the redirect (RFC 9110 §10.2.3)',
  'la date de nouvel essai ({date}) est deja passee': 'the retry date ({date}) has already passed',
  'Retry-After illisible : un nombre entier de secondes ou une date HTTP est attendu (RFC 9110 §10.2.3)':
    'unreadable Retry-After: a whole number of seconds or an HTTP date is expected (RFC 9110 §10.2.3)',
  'quota epuise : plus rien de disponible sous la politique {nom}': 'quota exhausted: nothing left under the {nom} policy',
  'quota epuise : plus rien de disponible jusqu a la remise a zero': 'quota exhausted: nothing left until the reset',
  '{entete} mal forme : un client doit l ignorer (brouillon IETF ratelimit-headers)':
    '{entete} malformed: a client must ignore it (IETF ratelimit-headers draft)',
  'reponse servie par un cache : ces valeurs peuvent dater, le brouillon demande de les ignorer (§7.3)':
    'response served by a cache: these values may be out of date, and the draft asks to ignore them (§7.3)',
  'Retry-After tombe avant la fin de la fenetre annoncee : le brouillon le deconseille (§6), et Retry-After l emporte (§7)':
    'Retry-After falls before the end of the announced window: the draft advises against it (§6), and Retry-After takes precedence (§7)',
  'forme du brouillon IETF -08 et suivants (draft-ietf-httpapi-ratelimit-headers, pas encore une RFC)':
    'form of IETF draft -08 and later (draft-ietf-httpapi-ratelimit-headers, not yet an RFC)',
  'forme du brouillon IETF -07 (decembre 2023), remplacee depuis': 'form of IETF draft -07 (December 2023), since replaced',
  'forme des brouillons IETF -00 a -06 (2021 a 2023), remplacee depuis': 'form of IETF drafts -00 to -06 (2021 to 2023), since replaced',
  'X-RateLimit-* : aucune specification ; Reset est lu {lecture}': 'X-RateLimit-*: no specification; Reset is read {lecture}',
  'comme une heure Unix (valeur superieure a un milliard)': 'as a Unix time (value above one billion)',
  'comme un nombre de secondes': 'as a number of seconds',
  'remise a zero du quota dans {duree} ({date})': 'quota reset in {duree} ({date})',
  'requete(s)': 'request(s)',
  'octet(s) de contenu': 'content byte(s)',
  'requete(s) simultanee(s)': 'concurrent request(s)',
  '{q} {unite} par {w}': '{q} {unite} per {w}',
  '{q} {unite}': '{q} {unite}',
  'il reste {r} sur une fenetre de {t}': '{r} left within a window of {t}',
  'il reste {r}': '{r} left',
  'Disponible': 'Available',
  'Limite': 'Limit',
  'Restant': 'Remaining',
  /* Les raisons internes d un RateLimit mal forme. */
  'liste vide': 'empty list',
  'le nom d une politique est une chaine': 'a policy name is a string',
  'q, entier non negatif, est obligatoire': 'q, a non-negative integer, is required',
  'r, entier non negatif, est obligatoire': 'r, a non-negative integer, is required',
  'limit et reset sont obligatoires': 'limit and reset are required',
  'quota entier attendu': 'integer quota expected',

  /* ---------------------------- Liens annonces ------------------------------ */
  'Liens annonces': 'Announced links',
  'Relations de liens': 'Link relations',
  'Relations de liens (registre IANA)': 'Link relations (IANA registry)',
  '{n} lien(s) · RFC 8288': '{n} link(s) · RFC 8288',
  'lien vers {cible} sans parametre rel : la RFC 8288 l exige (§3.3), le lien est ignore':
    'link to {cible} without a rel parameter: RFC 8288 requires one (§3.3), the link is ignored',
  'parametre rev : la RFC 8288 le deprecie (§3.3) ; une relation inverse s ecrit avec un type de relation propre':
    'rev parameter: RFC 8288 deprecates it (§3.3); a reverse relation is written with a relation type of its own',
  'texte illisible a partir de « {reste} » : la lecture s arrete la (RFC 8288, annexe B.2)':
    'unreadable text from “{reste}”: reading stops there (RFC 8288, appendix B.2)',
  'valeur etendue {nom} illisible (RFC 8187) : la forme simple est gardee':
    'unreadable extended value {nom} (RFC 8187): the plain form is kept',
  'type de relation {rel} absent du registre IANA (releve du 8 octobre 2026), et qui n est pas une URI : une relation d extension doit etre une URI absolue (RFC 8288 §2.1.2 et §3.3)':
    'relation type {rel} is not in the IANA registry (as of 8 October 2026) and is not a URI: an extension relation must be an absolute URI (RFC 8288 §2.1.2 and §3.3)',
  '{n} requete(s) vers cette adresse dans la capture': '{n} request(s) to this address in the capture',
  'aucune requete vers cette adresse dans la capture': 'no request to this address in the capture',

  /* ------------------------- Services alternatifs --------------------------- */
  'Services alternatifs': 'Alternative services',
  'clear : le serveur demande d oublier tous les services alternatifs connus pour cette origine':
    'clear: the server asks to forget every alternative service known for this origin',
  'valable encore {duree}': 'still valid for {duree}',
  'deja perimee a la reception': 'already expired on receipt',
  'a garder meme apres un changement de reseau (persist=1)': 'to be kept even after a network change (persist=1)',
  'la validite se compte depuis la creation de la reponse : l Age de {age} s s en deduit (RFC 7838 §3.1)':
    'validity counts from when the response was created: the Age of {age} s is deducted (RFC 7838 §3.1)',
  'cette reponse est arrivee en {proto} : l alternative preferee est deja employee':
    'this response arrived over {proto}: the preferred alternative is already in use',
  'cette reponse est arrivee en {proto} ; le serveur prefere {alpn} pour les suivantes':
    'this response arrived over {proto}; the server prefers {alpn} for the next ones',
  'texte illisible a partir de « {reste} » : la lecture s arrete la (RFC 7838 §3)':
    'unreadable text from “{reste}”: reading stops there (RFC 7838 §3)',
  'clear accompagne d autres valeurs : tout est a oublier, y compris ces valeurs (RFC 7838 §3)':
    'clear alongside other values: everything is to be forgotten, these values included (RFC 7838 §3)',
  'meme hote': 'same host',
  'Prefere': 'Preferred',
  'Choix {n}': 'Choice {n}',

  /* --------------------------- Caches traverses ----------------------------- */
  'Caches traverses': 'Caches crossed',
  'servie par ce cache': 'served by this cache',
  'transmise vers l origine : {raison}': 'forwarded towards the origin: {raison}',
  'transmise vers l origine (raison {raison}, inconnue de la RFC 9211)':
    'forwarded towards the origin (reason {raison}, unknown to RFC 9211)',
  'fraiche encore {duree} selon ce cache': 'still fresh for {duree} according to this cache',
  'perimee depuis {duree} selon ce cache': 'stale for {duree} according to this cache',
  'le saut suivant a repondu {statut}': 'the next hop answered {statut}',
  'gardee par ce cache': 'stored by this cache',
  'non gardee par ce cache': 'not stored by this cache',
  'fusionnee avec d autres requetes en route': 'collapsed with other requests on the way',
  'fusion avec d autres requetes tentee, sans succes': 'collapsing with other requests attempted, without success',
  'ni hit ni fwd : ce cache n en dit pas plus': 'neither hit nor fwd: this cache says no more',
  'hit et fwd ensemble : la RFC 9211 les veut exclusifs (§2.1)': 'hit and fwd together: RFC 9211 wants them exclusive (§2.1)',
  '{param} sans fwd : sans objet (RFC 9211 §2.3 a 2.6)': '{param} without fwd: meaningless (RFC 9211 §2.3 to 2.6)',
  'identifiant de cache d un type {type} : une chaine ou un jeton est exige (RFC 9211 §2)':
    'cache identifier of type {type}: a string or a token is required (RFC 9211 §2)',
  'fwd d un type {type} : un jeton est attendu (RFC 9211 §2.2)': 'fwd of type {type}: a token is expected (RFC 9211 §2.2)',
  'Cache-Status illisible : une liste de champ structure est attendue (RFC 9211 §2)':
    'unreadable Cache-Status: a structured-field list is expected (RFC 9211 §2)',
  'CDN-Cache-Control illisible : un CDN l ignore en entier et revient a Cache-Control (RFC 9213 §2.1)':
    'unreadable CDN-Cache-Control: a CDN ignores it entirely and falls back to Cache-Control (RFC 9213 §2.1)',
  'pour un CDN qui le suit, il remplace Cache-Control et Expires sur cette reponse (RFC 9213 §2.2)':
    'for a CDN that follows it, it replaces Cache-Control and Expires on this response (RFC 9213 §2.2)',
  '{directive} a une valeur decimale : un cache ne devrait pas la consommer (RFC 9213 §2.1)':
    '{directive} has a decimal value: a cache should not consume it (RFC 9213 §2.1)',
  'le cache est configure pour ne pas traiter cette requete': 'the cache is configured not to handle this request',
  'la methode de la requete impose de la transmettre': 'the request method requires forwarding it',
  'aucune reponse en cache pour cette adresse': 'no cached response for this address',
  'une reponse en cache pour cette adresse, mais aucune ne convient aux en-tetes de la requete (Vary)':
    'a cached response for this address, but none matches the request headers (Vary)',
  'aucune reponse en cache utilisable': 'no usable cached response',
  'une reponse fraiche existait, mais la requete en interdisait l emploi': 'a fresh response existed, but the request did not allow its use',
  'une reponse existait, mais perimee': 'a response existed, but stale',
  'une reponse partielle existait, sans toutes les plages demandees': 'a partial response existed, without all the requested ranges',
  'du plus proche de l origine au plus proche de vous (RFC 9211 §2)': 'from closest to the origin to closest to you (RFC 9211 §2)',
  'Cache-Control pour les autres caches': 'Cache-Control for the other caches',
  'absent': 'absent',

  /* -------------------------------- Priorite -------------------------------- */
  'Priorite': 'Priority',
  'urgence {u} sur une echelle de 0 (la plus pressee) a 7': 'urgency {u} on a scale from 0 (most urgent) to 7',
  'urgence 3, la valeur par defaut': 'urgency 3, the default value',
  'urgence 7 : reservee aux taches de fond, a ne pas employer pour une reponse dont l interaction depend (RFC 9218 §4.1)':
    'urgency 7: reserved for background tasks, not to be used for a response that user interaction depends on (RFC 9218 §4.1)',
  'incrementale : la reponse sert deja par morceaux, a mesure qu elle arrive':
    'incremental: the response is useful in pieces, as it arrives',
  'non incrementale : la reponse ne sert qu entiere': 'not incremental: the response is only useful whole',
  'parametre {cle}={valeur} ignore : {raison} (RFC 9218 §4)': 'parameter {cle}={valeur} ignored: {raison} (RFC 9218 §4)',
  'hors des bornes 0 a 7': 'outside the bounds 0 to 7',
  'type inattendu': 'unexpected type',
  'Priority illisible : un dictionnaire de champ structure est attendu (RFC 9218 §5)':
    'unreadable Priority: a structured-field dictionary is expected (RFC 9218 §5)',
  'le serveur ne dit rien de {param} : la valeur du client reste (RFC 9218 §8)':
    'the server says nothing about {param}: the client’s value stands (RFC 9218 §8)',
  'une priorite dans la reponse n est pas l accuse d une priorisation (RFC 9218 §5)':
    'a priority in the response does not acknowledge that any prioritisation took place (RFC 9218 §5)',
  'Demandee par le navigateur': 'Requested by the browser',
  'Avis du serveur': 'Server’s view',

  'Lecture impossible : {raison}': 'Reading failed: {raison}',

  /* ----------------------- Sous le verdict, onglet Resume -------------------- */
  'Le serveur a demande d attendre {attente} avant de reessayer': 'The server asked to wait {attente} before retrying',
  'Adresse depreciee par son auteur : elle fonctionne encore (RFC 9745)': 'Address deprecated by its author: it still works (RFC 9745)',
  'Fin de service annoncee pour le {jour} (Sunset, RFC 8594)': 'End of service announced for {jour} (Sunset, RFC 8594)',
  'Fin de service depassee depuis le {jour} : l adresse peut cesser de repondre a tout moment':
    'End of service passed since {jour}: the address may stop responding at any time'
};
