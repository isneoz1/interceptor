/* Relations de liens, en anglais — SWIFT (by NeoZ)
 *
 * Chaque description est celle du registre IANA « Link Relations », mot pour
 * mot, l apostrophe droite mise a part : les dictionnaires emploient la
 * typographique (releve du 8 octobre 2026). Un test la compare a l instantane
 * du registre : tests/vecteurs-liens-iana.json.
 */
export const EN_REF_LIENS = {
  'Designe une ressource qui est le sujet du contexte du lien.':
    'Refers to a resource that is the subject of the link’s context.',
  'Indique que la cible fournit une ressource de controle d acces pour le contexte du lien.':
    'Asserts that the link target provides an access control resource for the link context.',
  'Designe un substitut de ce contexte.':
    'Refers to a substitute for this context',
  'Designe un contenu alternatif qui suit le profil AMP du format HTML.':
    'Used to reference alternative content that uses the AMP profile of the HTML format.',
  'Designe une liste des API mises a disposition par l editeur du contexte du lien.':
    'Refers to a list of APIs available from the Publisher of the link context.',
  'Designe une annexe.':
    'Refers to an appendix.',
  'Designe une icone pour le contexte. Synonyme de icon.':
    'Refers to an icon for the context. Synonym for icon.',
  'Designe un ecran de lancement pour le contexte.':
    'Refers to a launch screen for the context.',
  'Designe une collection de documents, d enregistrements ou d autres elements d interet historique.':
    'Refers to a collection of records, documents, or other materials of historical interest.',
  'Designe l auteur du contexte.':
    'Refers to the context’s author.',
  'Identifie l entite qui bloque l acces a une ressource apres une demande legale.':
    'Identifies the entity that blocks access to a resource following receipt of a legal demand.',
  'Donne un lien permanent a utiliser comme signet.':
    'Gives a permanent link to use for bookmarking purposes.',
  'Identifie le manifeste C2PA associe au contexte du lien.':
    'This link relation identifies the C2PA Manifest associated with the link context',
  'Designe la version preferee d une ressource (l IRI et son contenu).':
    'Designates the preferred version of a resource (the IRI and its contents).',
  'Designe un chapitre dans une collection de ressources.':
    'Refers to a chapter in a collection of resources.',
  'Indique que la cible est preferee au contexte du lien pour une citation permanente.':
    'Indicates that the link target is preferred over the link context for the purpose of permanent citation.',
  'L IRI cible designe la ressource qui represente la collection du contexte.':
    'The target IRI points to a resource which represents the collection resource for the context IRI.',
  'Designe un dictionnaire de compression employe pour le codage du contenu.':
    'Refers to a compression dictionary used for content encoding.',
  'Designe une table des matieres.':
    'Refers to a table of contents.',
  'Le document lie a ensuite ete converti en celui qui porte ce lien : une RFC peut ainsi pointer vers l Internet-Draft dont elle est issue.':
    'The document linked to was later converted to the document that contains this link relation. For example, an RFC can have a link to the Internet-Draft that became the RFC; in that case, the link relation would be "convertedFrom".',
  'Designe une mention de droit d auteur qui s applique au contexte du lien.':
    'Refers to a copyright statement that applies to the link’s context.',
  'L IRI cible designe une ressource ou obtenir un formulaire de creation.':
    'The target IRI points to a resource where a submission form can be obtained.',
  'Designe une ressource contenant les elements les plus recents d une collection.':
    'Refers to a resource containing the most recent item(s) in a collection of resources.',
  'Designe une documentation, destinee a des humains, sur la depreciation du contexte du lien.':
    'Refers to documentation (intended for human consumption) about the deprecation of the link’s context.',
  'Designe une ressource qui fournit des informations sur le contexte du lien.':
    'Refers to a resource providing information about the link’s context.',
  'A « describes » B affirme que la ressource A fournit une description de la ressource B, sans aucune contrainte de format ni de representation sur l une ou l autre.':
    'The relationship A ’describes’ B asserts that resource A provides a description of resource B. There are no constraints on the format or representation of either A or B, neither are there any further constraints on either resource.',
  'Designe une liste de declarations de brevets portant sur le contenu ou figure ce lien.':
    'Refers to a list of patent disclosures made with respect to material for which ’disclosure’ relation is specified.',
  'Indique une origine qui servira a charger des ressources necessaires au contexte, et dont le navigateur devrait resoudre le nom au plus tot.':
    'Used to indicate an origin that will be used to fetch required resources for the link context, and that the user agent ought to resolve as early as possible.',
  'Lien d une URI qui identifie un produit vers son passeport numerique de produit.':
    'A link from a context URI that identifies a product to its digital product passport',
  'Designe une ressource dont les representations sont identiques, octet pour octet, a celles du contexte.':
    'Refers to a resource whose available representations are byte-for-byte identical with the corresponding representations of the context IRI.',
  'Designe une ressource qui permet de modifier le contexte du lien.':
    'Refers to a resource that can be used to edit the link’s context.',
  'L IRI cible designe une ressource ou obtenir un formulaire de modification de la ressource associee.':
    'The target IRI points to a resource where a submission form for editing associated resource can be obtained.',
  'Designe une ressource qui permet de modifier le media associe au contexte du lien.':
    'Refers to a resource that can be used to edit media associated with the link’s context.',
  'Identifie une ressource liee, potentiellement volumineuse, qui peut demander un traitement particulier.':
    'Identifies a related resource that is potentially large and might require special handling.',
  'Designe une ressource qui ne fait pas partie du meme site que le contexte.':
    'Refers to a resource that is not part of the same site as the current context.',
  'IRI de la ressource la plus en amont d une serie.':
    'An IRI that refers to the furthest preceding resource in a series of resources.',
  'Designe une ressource de geolocalisation d adresses IP (geofeed) liee au contexte du lien.':
    'Refers to a resource with IP geofeed location information related to the link context.',
  'Designe un glossaire.':
    'Refers to a glossary of terms.',
  'Designe une aide propre au contexte.':
    'Refers to context-sensitive help.',
  'Designe une ressource hebergee par le serveur qu indique le contexte du lien.':
    'Refers to a resource hosted by the server indicated by the link context.',
  'Designe un hub aupres duquel s inscrire pour etre notifie des mises a jour du contexte.':
    'Refers to a hub that enables registration for notification of updates to the context.',
  'Transmet les serveurs STUN et TURN qu un agent ICE peut employer pour etablir une connexion avec un pair.':
    'Conveys the STUN and TURN servers that can be used by an ICE agent to establish a connection with a peer.',
  'Designe une icone qui represente le contexte du lien.':
    'Refers to an icon representing the link’s context.',
  'Designe un index.':
    'Refers to an index.',
  'Designe une ressource associee a un intervalle de temps qui finit avant le debut de l intervalle du contexte.':
    'refers to a resource associated with a time interval that ends before the beginning of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps qui commence apres la fin de l intervalle du contexte.':
    'refers to a resource associated with a time interval that begins after the end of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps qui commence apres le debut de l intervalle du contexte et finit avant sa fin.':
    'refers to a resource associated with a time interval that begins after the beginning of the time interval associated with the context resource, and ends before the end of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps qui commence apres la fin de l intervalle du contexte, ou finit avant son debut.':
    'refers to a resource associated with a time interval that begins after the end of the time interval associated with the context resource, or ends before the beginning of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps qui commence avant le debut de l intervalle du contexte et finit apres sa fin.':
    'refers to a resource associated with a time interval that begins before the beginning of the time interval associated with the context resource, and ends after the end of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps dont le debut et la fin coincident avec ceux de l intervalle du contexte.':
    'refers to a resource associated with a time interval whose beginning coincides with the beginning of the time interval associated with the context resource, and whose end coincides with the end of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps qui commence apres le debut de l intervalle du contexte, et dont la fin coincide avec la sienne.':
    'refers to a resource associated with a time interval that begins after the beginning of the time interval associated with the context resource, and whose end coincides with the end of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps qui commence avant le debut de l intervalle du contexte, et dont la fin coincide avec la sienne.':
    'refers to a resource associated with a time interval that begins before the beginning of the time interval associated with the context resource, and whose end coincides with the end of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps qui commence avant le debut de l intervalle du contexte ou en meme temps, et finit apres sa fin ou en meme temps.':
    'refers to a resource associated with a time interval that begins before or is coincident with the beginning of the time interval associated with the context resource, and ends after or is coincident with the end of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps dont le debut coincide avec la fin de l intervalle du contexte.':
    'refers to a resource associated with a time interval whose beginning coincides with the end of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps dont la fin coincide avec le debut de l intervalle du contexte.':
    'refers to a resource associated with a time interval whose end coincides with the beginning of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps qui commence avant le debut de l intervalle du contexte et finit apres ce debut.':
    'refers to a resource associated with a time interval that begins before the beginning of the time interval associated with the context resource, and ends after the beginning of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps qui commence avant la fin de l intervalle du contexte et finit apres cette fin.':
    'refers to a resource associated with a time interval that begins before the end of the time interval associated with the context resource, and ends after the end of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps dont le debut coincide avec celui de l intervalle du contexte, et qui finit avant sa fin.':
    'refers to a resource associated with a time interval whose beginning coincides with the beginning of the time interval associated with the context resource, and ends before the end of the time interval associated with the context resource',
  'Designe une ressource associee a un intervalle de temps dont le debut coincide avec celui de l intervalle du contexte, et qui finit apres sa fin.':
    'refers to a resource associated with a time interval whose beginning coincides with the beginning of the time interval associated with the context resource, and ends after the end of the time interval associated with the context resource',
  'L IRI cible designe une ressource membre de la collection que represente le contexte.':
    'The target IRI points to a resource that is a member of the collection represented by the context IRI.',
  'IRI de la ressource la plus en aval d une serie.':
    'An IRI that refers to the furthest following resource in a series of resources.',
  'Designe une ressource contenant la derniere version (la version courante) du contexte.':
    'Points to a resource containing the latest (e.g., current) version of the context.',
  'Designe une licence associee a ce contexte.':
    'Refers to a license associated with this context.',
  'La cible fournit un ensemble de liens, dont certains ont pour contexte celui de ce lien.':
    'The link target of a link with the "linkset" relation type provides a set of links, including links in which the link context of the link participates.',
  'Designe un document LRDD (Link-based Resource Descriptor Document) qui donne d autres liens et metadonnees sur le contexte ; plusieurs liens designent plusieurs documents. Un document LRDD doit exister en application/xrd+xml, et peut en avoir d autres formes.':
    'Refers to further information about the link’s context, expressed as a LRDD ("Link-based Resource Descriptor Document") resource. See [RFC6415] for information about processing this relation type in host-meta documents. When used elsewhere, it refers to additional links and other metadata. Multiple instances indicate additional LRDD resources. LRDD resources MUST have an "application/xrd+xml" representation, and MAY have others.',
  'Lien vers un fichier manifeste du contexte.':
    'Links to a manifest file for the context.',
  'Designe un masque applicable a l icone du contexte.':
    'Refers to a mask that can be applied to the icon for the context.',
  'Lien vers une ressource qui parle de l auteur du contexte.':
    'Links to a resource about the author of the link’s context.',
  'Designe un flux de recommandations de medias personnalisees, lie au contexte.':
    'Refers to a feed of personalised media recommendations relevant to the link context.',
  'L IRI cible designe un Memento : une ressource figee, dont l etat ne changera plus.':
    'The Target IRI points to a Memento, a fixed resource that will not change state anymore.',
  'Lien vers le point d acces Micropub du contexte.':
    'Links to the context’s Micropub endpoint.',
  'Designe un module que le navigateur doit charger et garder par avance pour le contexte.':
    'Refers to a module that the user agent is to preemptively fetch and store for use in the current context.',
  'Designe une ressource qui permet de surveiller les changements d une ressource HTTP.':
    'Refers to a resource that can be used to monitor changes in an HTTP resource.',
  'Designe une ressource qui permet de surveiller les changements d un groupe de ressources HTTP.':
    'Refers to a resource that can be used to monitor changes in a specified group of HTTP resources.',
  'Le contexte fait partie d une serie, et la cible en est l element suivant.':
    'Indicates that the link’s context is a part of a series, and that the next in the series is the link target.',
  'Designe la ressource d archive immediatement suivante.':
    'Refers to the immediately following archive resource.',
  'L auteur ou l editeur du contexte ne cautionne pas la cible du lien.':
    'Indicates that the context’s original author or publisher does not endorse the link target.',
  'Un contexte de navigation de premier niveau ouvert en suivant le lien ne sera pas un contexte auxiliaire.':
    'Indicates that any newly created top-level browsing context which results from following the link will not be an auxiliary browsing context.',
  'Aucune information de provenance (referrer) ne doit fuir en suivant le lien.':
    'Indicates that no referrer information is to be leaked when following the link.',
  'Un contexte de navigation de premier niveau ouvert en suivant le lien sera un contexte auxiliaire.':
    'Indicates that any newly created top-level browsing context which results from following the link will be an auxiliary browsing context.',
  'Designe un serveur d authentification OpenID sur lequel le contexte s appuie pour attester que l utilisateur controle un identifiant.':
    'Refers to an OpenID Authentication server on which the context relies for an assertion that the end user controls an Identifier.',
  'Designe une ressource qui accepte les messages du protocole d authentification OpenID pour le contexte.':
    'Refers to a resource which accepts OpenID Authentication protocol messages for the context.',
  'L IRI cible designe une ressource originale.':
    'The Target IRI points to an Original Resource.',
  'Designe une politique de confidentialite P3P pour le contexte.':
    'Refers to a P3P privacy policy for the context.',
  'Indique une ressource ou un paiement est accepte.':
    'Indicates a resource where payment is accepted.',
  'Donne l adresse de la ressource pingback du contexte du lien.':
    'Gives the address of the pingback resource for the link context.',
  'Indique une origine qui servira a charger des ressources du contexte. Ouvrir la connexion tot — resolution DNS, poignee de main TCP, negociation TLS eventuelle — masque au navigateur la latence de son etablissement.':
    'Used to indicate an origin that will be used to fetch required resources for the link context. Initiating an early connection, which includes the DNS lookup, TCP handshake, and optional TLS negotiation, allows the user agent to mask the high latency costs of establishing a connection.',
  'Designe une ressource contenant la version precedente dans l historique des versions.':
    'Points to a resource containing the predecessor version in the version history.',
  'Identifie une ressource dont la prochaine navigation pourrait avoir besoin, et que le navigateur devrait charger, pour repondre plus vite quand elle sera demandee.':
    'The prefetch link relation type is used to identify a resource that might be required by the next navigation from the link context, and that the user agent ought to fetch, such that the user agent can deliver a faster response once the resource is requested in the future.',
  'Designe une ressource a charger tot dans le traitement du contexte, sans bloquer l affichage.':
    'Refers to a resource that should be loaded early in the processing of the link’s context, without blocking rendering.',
  'Identifie une ressource dont la prochaine navigation pourrait avoir besoin, et que le navigateur devrait charger et executer, pour repondre plus vite quand elle sera demandee.':
    'Used to identify a resource that might be required by the next navigation from the link context, and that the user agent ought to fetch and execute, such that the user agent can deliver a faster response once the resource is requested in the future.',
  'Le contexte fait partie d une serie, et la cible en est l element precedent.':
    'Indicates that the link’s context is a part of a series, and that the previous in the series is the link target.',
  'Designe une ressource qui donne un apercu du contexte du lien.':
    'Refers to a resource that provides a preview of the link’s context.',
  'Designe la ressource precedente d une serie ordonnee. Synonyme de prev.':
    'Refers to the previous resource in an ordered series of resources. Synonym for "prev".',
  'Designe la ressource d archive immediatement precedente.':
    'Refers to the immediately preceding archive resource.',
  'Designe une politique de confidentialite associee au contexte du lien.':
    'Refers to a privacy policy associated with the link’s context.',
  'Indique qu une representation suit un profil donne, sans changer le reste de sa semantique.':
    'Identifying that a resource representation conforms to a certain profile, without affecting the non-profile semantics of the resource representation.',
  'Lien vers un manifeste de publication : des informations structurees sur une publication, comme ses metadonnees, la liste de ses ressources et un ordre de lecture par defaut.':
    'Links to a publication manifest. A manifest represents structured information about a publication, such as informative metadata, a list of resources, and a default reading order.',
  'La cible est une recherche RDAP aupres d un RIR, filtree sur le statut « active ».':
    'The target is for an RDAP RIR search that filters for the status "active".',
  'Designe les objets RDAP enfants qui n ont eux-memes aucun enfant, dans une hierarchie d objets.':
    'Refers to the set of child RDAP objects that do not themselves have child objects, in a hierarchy of objects.',
  'Designe un ensemble d objets RDAP enfants dans une hierarchie d objets.':
    'Refers to a set of RDAP child objects in a hierarchy of objects.',
  'Designe l objet RDAP parent le plus haut d une hierarchie d objets.':
    'Refers to the topmost RDAP parent object in a hierarchy of objects.',
  'Designe un objet RDAP parent dans une hierarchie d objets.':
    'Refers to an RDAP parent object in a hierarchy of objects.',
  'Identifie une ressource liee.':
    'Identifies a related resource.',
  'Identifie la racine de l API RESTCONF configuree sur ce serveur HTTP, celle definie par la RFC 8040 ; les revisions suivantes de RESTCONF emploieront d autres relations.':
    'Identifies the root of RESTCONF API as configured on this HTTP server. The "restconf" relation defines the root of the API defined in RFC8040. Subsequent revisions of RESTCONF will use alternate relation values to support protocol versioning.',
  'Identifie une ressource qui repond au contexte du lien.':
    'Identifies a resource that is a reply to the context of the link.',
  'La cible fournit une valeur d entree a une instance de regle, que represente le contexte du lien.':
    'The resource identified by the link target provides an input value to an instance of a rule, where the resource which represents the rule instance is identified by the link context.',
  'Designe une ressource qui permet de chercher dans le contexte du lien et dans les ressources liees.':
    'Refers to a resource that can be used to search through the link’s context and related resources.',
  'Designe une section dans une collection de ressources.':
    'Refers to a section in a collection of resources.',
  'Donne un identifiant du contexte du lien.':
    'Conveys an identifier for the link’s context.',
  'Indique une URI ou obtenir un document de service.':
    'Indicates a URI that can be used to retrieve a service document.',
  'Identifie une description du service destinee d abord aux machines.':
    'Identifies service description for the context that is primarily intended for consumption by machines.',
  'Identifie une documentation du service destinee d abord aux humains.':
    'Identifies service documentation for the context that is primarily intended for human consumption.',
  'Identifie des metadonnees generales du contexte, destinees d abord aux machines.':
    'Identifies general metadata for the context that is primarily intended for consumption by machines.',
  'Designe un document de capacites qui fixe les parametres ou les exigences de configuration pour l interconnexion automatique et la negociation des canaux de communication en SIP.':
    'Refers to a capability set document that defines parameters or configuration requirements for automated peering and communication-channel negotiation of the Session Initiation Protocol (SIP).',
  'Designe une ressource placee dans un contexte sponsorise (publicite ou autre contrepartie).':
    'Refers to a resource that is within a context that is sponsored (such as advertising or another compensation agreement).',
  'Designe la premiere ressource d une collection.':
    'Refers to the first resource in a collection of resources.',
  'Identifie une ressource qui represente l etat du contexte.':
    'Identifies a resource that represents the context’s status.',
  'Designe une feuille de style.':
    'Refers to a stylesheet.',
  'Designe une ressource qui sert de sous-section dans une collection.':
    'Refers to a resource serving as a subsection in a collection of resources.',
  'Designe une ressource contenant la version suivante dans l historique des versions.':
    'Points to a resource containing the successor version in the version history.',
  'Identifie une ressource qui informe sur la politique de retrait du contexte.':
    'Identifies a resource that provides information about the context’s retirement policy.',
  'Donne une etiquette (identifiee par son adresse) qui s applique au document courant.':
    'Gives a tag (identified by the given address) that applies to the current document.',
  'Designe les conditions d utilisation associees au contexte du lien.':
    'Refers to the terms of service associated with the link’s context.',
  'L IRI cible designe une TimeGate d une ressource originale.':
    'The Target IRI points to a TimeGate for an Original Resource.',
  'L IRI cible designe une TimeMap d une ressource originale.':
    'The Target IRI points to a TimeMap for an Original Resource.',
  'Designe une ressource qui identifie le type semantique abstrait dont le contexte est une instance.':
    'Refers to a resource identifying the abstract semantic type of which the link’s context is considered to be an instance.',
  'Designe une ressource placee dans un contexte de contenu genere par les utilisateurs.':
    'Refers to a resource that is within a context that is User Generated Content.',
  'Designe un document parent dans une hierarchie de documents.':
    'Refers to a parent document in a hierarchy of documents.',
  'Designe une ressource contenant l historique des versions du contexte.':
    'Points to a resource containing the version history for the context.',
  'Identifie une ressource qui est la source des informations du contexte du lien.':
    'Identifies a resource that is the source of the information in the link’s context.',
  'Identifie une URI qui accepte le protocole Webmention : qui mentionne une ressource en publiant peut ainsi prevenir ce point d acces qu elle a ete mentionnee.':
    'Identifies a target URI that supports the Webmention protocol. This allows clients that mention a resource in some form of publishing process to contact that endpoint and inform it that this resource has been mentioned.',
  'Designe une copie de travail de cette ressource.':
    'Points to a working copy for this resource.',
  'Designe la ressource versionnee dont cette copie de travail est issue.':
    'Points to the versioned resource from which this working copy was obtained.'
};
