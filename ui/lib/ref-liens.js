/* Relations de liens — SWIFT (by D4RK)
 *
 * Le registre IANA « Link Relations » (RFC 8288, section 4.2), en entier :
 * cent trente-quatre types, chacun avec sa description et la specification
 * qui le definit. C est ce qui permet de dire ce que veut `rel="preload"`,
 * `rel="next"` ou `rel="deprecation"` dans un en-tete Link, sans rien inventer.
 *
 * Source : https://www.iana.org/assignments/link-relations/ , releve du
 * 8 octobre 2026. La description anglaise de chaque type est celle du
 * registre, mot pour mot (dict-en-ref-liens.js) ; un test la compare a un
 * instantane du registre (tests/vecteurs-liens-iana.json).
 */

const INTERVALLE = 'Designe une ressource associee a un intervalle de temps ';

const L = [
  ['about', 'Designe une ressource qui est le sujet du contexte du lien.', '[RFC6903], section 2'],
  ['acl', 'Indique que la cible fournit une ressource de controle d acces pour le contexte du lien.', '[https://solidproject.org/TR/wac#acl-link-relation]'],
  ['alternate', 'Designe un substitut de ce contexte.', '[HTML]'],
  ['amphtml', 'Designe un contenu alternatif qui suit le profil AMP du format HTML.', '[AMP HTML]'],
  ['api-catalog', 'Designe une liste des API mises a disposition par l editeur du contexte du lien.', '[RFC9727]'],
  ['appendix', 'Designe une annexe.', '[HTML 4.01 Specification]'],
  ['apple-touch-icon', 'Designe une icone pour le contexte. Synonyme de icon.', '[Configuring Web Applications]'],
  ['apple-touch-startup-image', 'Designe un ecran de lancement pour le contexte.', '[Configuring Web Applications]'],
  ['archives', 'Designe une collection de documents, d enregistrements ou d autres elements d interet historique.', '[HTML5]'],
  ['author', 'Designe l auteur du contexte.', '[HTML]'],
  ['blocked-by', 'Identifie l entite qui bloque l acces a une ressource apres une demande legale.', '[RFC7725]'],
  ['bookmark', 'Donne un lien permanent a utiliser comme signet.', '[HTML]'],
  ['c2pa-manifest', 'Identifie le manifeste C2PA associe au contexte du lien.', '[Content Credentials : C2PA Technical Specification]'],
  ['canonical', 'Designe la version preferee d une ressource (l IRI et son contenu).', '[RFC6596]'],
  ['chapter', 'Designe un chapitre dans une collection de ressources.', '[HTML 4.01 Specification]'],
  ['cite-as', 'Indique que la cible est preferee au contexte du lien pour une citation permanente.', '[RFC8574]'],
  ['collection', 'L IRI cible designe la ressource qui represente la collection du contexte.', '[RFC6573]'],
  ['compression-dictionary', 'Designe un dictionnaire de compression employe pour le codage du contenu.', '[RFC 9842, Section 3]'],
  ['contents', 'Designe une table des matieres.', '[HTML 4.01 Specification]'],
  ['convertedfrom', 'Le document lie a ensuite ete converti en celui qui porte ce lien : une RFC peut ainsi pointer vers l Internet-Draft dont elle est issue.', '[RFC7991]'],
  ['copyright', 'Designe une mention de droit d auteur qui s applique au contexte du lien.', '[HTML 4.01 Specification]'],
  ['create-form', 'L IRI cible designe une ressource ou obtenir un formulaire de creation.', '[RFC6861]'],
  ['current', 'Designe une ressource contenant les elements les plus recents d une collection.', '[RFC5005]'],
  ['deprecation', 'Designe une documentation, destinee a des humains, sur la depreciation du contexte du lien.', '[RFC9745], section 3'],
  ['describedby', 'Designe une ressource qui fournit des informations sur le contexte du lien.', '[Protocol for Web Description Resources (POWDER)]'],
  ['describes', 'A « describes » B affirme que la ressource A fournit une description de la ressource B, sans aucune contrainte de format ni de representation sur l une ou l autre.', '[RFC6892]'],
  ['disclosure', 'Designe une liste de declarations de brevets portant sur le contenu ou figure ce lien.', '[RFC6579]'],
  ['dns-prefetch', 'Indique une origine qui servira a charger des ressources necessaires au contexte, et dont le navigateur devrait resoudre le nom au plus tot.', '[HTML]'],
  ['dpp', 'Lien d une URI qui identifie un produit vers son passeport numerique de produit.', '[UN Transparency Protocol]'],
  ['duplicate', 'Designe une ressource dont les representations sont identiques, octet pour octet, a celles du contexte.', '[RFC6249]'],
  ['edit', 'Designe une ressource qui permet de modifier le contexte du lien.', '[RFC5023]'],
  ['edit-form', 'L IRI cible designe une ressource ou obtenir un formulaire de modification de la ressource associee.', '[RFC6861]'],
  ['edit-media', 'Designe une ressource qui permet de modifier le media associe au contexte du lien.', '[RFC5023]'],
  ['enclosure', 'Identifie une ressource liee, potentiellement volumineuse, qui peut demander un traitement particulier.', '[RFC4287]'],
  ['external', 'Designe une ressource qui ne fait pas partie du meme site que le contexte.', '[HTML]'],
  ['first', 'IRI de la ressource la plus en amont d une serie.', '[RFC8288]'],
  ['geofeed', 'Designe une ressource de geolocalisation d adresses IP (geofeed) liee au contexte du lien.', '[RFC9877]'],
  ['glossary', 'Designe un glossaire.', '[HTML 4.01 Specification]'],
  ['help', 'Designe une aide propre au contexte.', '[HTML]'],
  ['hosts', 'Designe une ressource hebergee par le serveur qu indique le contexte du lien.', '[RFC6690]'],
  ['hub', 'Designe un hub aupres duquel s inscrire pour etre notifie des mises a jour du contexte.', '[WebSub]'],
  ['ice-server', 'Transmet les serveurs STUN et TURN qu un agent ICE peut employer pour etablir une connexion avec un pair.', '[RFC9725]'],
  ['icon', 'Designe une icone qui represente le contexte du lien.', '[HTML]'],
  ['index', 'Designe un index.', '[HTML 4.01 Specification]'],
  ['intervalafter', INTERVALLE + 'qui finit avant le debut de l intervalle du contexte.', '[Time Ontology in OWL] section 4.2.21'],
  ['intervalbefore', INTERVALLE + 'qui commence apres la fin de l intervalle du contexte.', '[Time Ontology in OWL] section 4.2.22'],
  ['intervalcontains', INTERVALLE + 'qui commence apres le debut de l intervalle du contexte et finit avant sa fin.', '[Time Ontology in OWL] section 4.2.23'],
  ['intervaldisjoint', INTERVALLE + 'qui commence apres la fin de l intervalle du contexte, ou finit avant son debut.', '[Time Ontology in OWL] section 4.2.24'],
  ['intervalduring', INTERVALLE + 'qui commence avant le debut de l intervalle du contexte et finit apres sa fin.', '[Time Ontology in OWL] section 4.2.25'],
  ['intervalequals', INTERVALLE + 'dont le debut et la fin coincident avec ceux de l intervalle du contexte.', '[Time Ontology in OWL] section 4.2.26'],
  ['intervalfinishedby', INTERVALLE + 'qui commence apres le debut de l intervalle du contexte, et dont la fin coincide avec la sienne.', '[Time Ontology in OWL] section 4.2.27'],
  ['intervalfinishes', INTERVALLE + 'qui commence avant le debut de l intervalle du contexte, et dont la fin coincide avec la sienne.', '[Time Ontology in OWL] section 4.2.28'],
  ['intervalin', INTERVALLE + 'qui commence avant le debut de l intervalle du contexte ou en meme temps, et finit apres sa fin ou en meme temps.', '[Time Ontology in OWL] section 4.2.29'],
  ['intervalmeets', INTERVALLE + 'dont le debut coincide avec la fin de l intervalle du contexte.', '[Time Ontology in OWL] section 4.2.30'],
  ['intervalmetby', INTERVALLE + 'dont la fin coincide avec le debut de l intervalle du contexte.', '[Time Ontology in OWL] section 4.2.31'],
  ['intervaloverlappedby', INTERVALLE + 'qui commence avant le debut de l intervalle du contexte et finit apres ce debut.', '[Time Ontology in OWL] section 4.2.32'],
  ['intervaloverlaps', INTERVALLE + 'qui commence avant la fin de l intervalle du contexte et finit apres cette fin.', '[Time Ontology in OWL] section 4.2.33'],
  ['intervalstartedby', INTERVALLE + 'dont le debut coincide avec celui de l intervalle du contexte, et qui finit avant sa fin.', '[Time Ontology in OWL] section 4.2.34'],
  ['intervalstarts', INTERVALLE + 'dont le debut coincide avec celui de l intervalle du contexte, et qui finit apres sa fin.', '[Time Ontology in OWL] section 4.2.35'],
  ['item', 'L IRI cible designe une ressource membre de la collection que represente le contexte.', '[RFC6573]'],
  ['last', 'IRI de la ressource la plus en aval d une serie.', '[RFC8288]'],
  ['latest-version', 'Designe une ressource contenant la derniere version (la version courante) du contexte.', '[RFC5829]'],
  ['license', 'Designe une licence associee a ce contexte.', '[RFC4946]'],
  ['linkset', 'La cible fournit un ensemble de liens, dont certains ont pour contexte celui de ce lien.', '[RFC9264]'],
  ['lrdd', 'Designe un document LRDD (Link-based Resource Descriptor Document) qui donne d autres liens et metadonnees sur le contexte ; plusieurs liens designent plusieurs documents. Un document LRDD doit exister en application/xrd+xml, et peut en avoir d autres formes.', '[RFC6415]'],
  ['manifest', 'Lien vers un fichier manifeste du contexte.', '[Web App Manifest]'],
  ['mask-icon', 'Designe un masque applicable a l icone du contexte.', '[Creating Pinned Tab Icons]'],
  ['me', 'Lien vers une ressource qui parle de l auteur du contexte.', '[https://microformats.org/wiki/rel-me]'],
  ['media-feed', 'Designe un flux de recommandations de medias personnalisees, lie au contexte.', '[https://wicg.github.io/media-feeds/#discovery-of-media-feeds]'],
  ['memento', 'L IRI cible designe un Memento : une ressource figee, dont l etat ne changera plus.', '[RFC7089]'],
  ['micropub', 'Lien vers le point d acces Micropub du contexte.', '[Micropub]'],
  ['modulepreload', 'Designe un module que le navigateur doit charger et garder par avance pour le contexte.', '[HTML]'],
  ['monitor', 'Designe une ressource qui permet de surveiller les changements d une ressource HTTP.', '[RFC5989]'],
  ['monitor-group', 'Designe une ressource qui permet de surveiller les changements d un groupe de ressources HTTP.', '[RFC5989]'],
  ['next', 'Le contexte fait partie d une serie, et la cible en est l element suivant.', '[HTML]'],
  ['next-archive', 'Designe la ressource d archive immediatement suivante.', '[RFC5005]'],
  ['nofollow', 'L auteur ou l editeur du contexte ne cautionne pas la cible du lien.', '[HTML]'],
  ['noopener', 'Un contexte de navigation de premier niveau ouvert en suivant le lien ne sera pas un contexte auxiliaire.', '[HTML]'],
  ['noreferrer', 'Aucune information de provenance (referrer) ne doit fuir en suivant le lien.', '[HTML]'],
  ['opener', 'Un contexte de navigation de premier niveau ouvert en suivant le lien sera un contexte auxiliaire.', '[HTML]'],
  ['openid2.local_id', 'Designe un serveur d authentification OpenID sur lequel le contexte s appuie pour attester que l utilisateur controle un identifiant.', '[OpenID Authentication 2.0 - Final]'],
  ['openid2.provider', 'Designe une ressource qui accepte les messages du protocole d authentification OpenID pour le contexte.', '[OpenID Authentication 2.0 - Final]'],
  ['original', 'L IRI cible designe une ressource originale.', '[RFC7089]'],
  ['p3pv1', 'Designe une politique de confidentialite P3P pour le contexte.', '[The Platform for Privacy Preferences 1.0 (P3P1.0) Specification]'],
  ['payment', 'Indique une ressource ou un paiement est accepte.', '[RFC8288]'],
  ['pingback', 'Donne l adresse de la ressource pingback du contexte du lien.', '[Pingback 1.0]'],
  ['preconnect', 'Indique une origine qui servira a charger des ressources du contexte. Ouvrir la connexion tot — resolution DNS, poignee de main TCP, negociation TLS eventuelle — masque au navigateur la latence de son etablissement.', '[HTML]'],
  ['predecessor-version', 'Designe une ressource contenant la version precedente dans l historique des versions.', '[RFC5829]'],
  ['prefetch', 'Identifie une ressource dont la prochaine navigation pourrait avoir besoin, et que le navigateur devrait charger, pour repondre plus vite quand elle sera demandee.', '[HTML]'],
  ['preload', 'Designe une ressource a charger tot dans le traitement du contexte, sans bloquer l affichage.', '[Preload]'],
  ['prerender', 'Identifie une ressource dont la prochaine navigation pourrait avoir besoin, et que le navigateur devrait charger et executer, pour repondre plus vite quand elle sera demandee.', '[Resource Hints]'],
  ['prev', 'Le contexte fait partie d une serie, et la cible en est l element precedent.', '[HTML]'],
  ['preview', 'Designe une ressource qui donne un apercu du contexte du lien.', '[RFC6903], section 3'],
  ['previous', 'Designe la ressource precedente d une serie ordonnee. Synonyme de prev.', '[HTML 4.01 Specification]'],
  ['prev-archive', 'Designe la ressource d archive immediatement precedente.', '[RFC5005]'],
  ['privacy-policy', 'Designe une politique de confidentialite associee au contexte du lien.', '[RFC6903], section 4'],
  ['profile', 'Indique qu une representation suit un profil donne, sans changer le reste de sa semantique.', '[RFC6906]'],
  ['publication', 'Lien vers un manifeste de publication : des informations structurees sur une publication, comme ses metadonnees, la liste de ses ressources et un ordre de lecture par defaut.', '[Publication Manifest]'],
  ['rdap-active', 'La cible est une recherche RDAP aupres d un RIR, filtree sur le statut « active ».', '[RFC9910]'],
  ['rdap-bottom', 'Designe les objets RDAP enfants qui n ont eux-memes aucun enfant, dans une hierarchie d objets.', '[RFC9910]'],
  ['rdap-down', 'Designe un ensemble d objets RDAP enfants dans une hierarchie d objets.', '[RFC9910]'],
  ['rdap-top', 'Designe l objet RDAP parent le plus haut d une hierarchie d objets.', '[RFC9910]'],
  ['rdap-up', 'Designe un objet RDAP parent dans une hierarchie d objets.', '[RFC9910]'],
  ['related', 'Identifie une ressource liee.', '[RFC4287]'],
  ['restconf', 'Identifie la racine de l API RESTCONF configuree sur ce serveur HTTP, celle definie par la RFC 8040 ; les revisions suivantes de RESTCONF emploieront d autres relations.', '[RFC8040]'],
  ['replies', 'Identifie une ressource qui repond au contexte du lien.', '[RFC4685]'],
  ['ruleinput', 'La cible fournit une valeur d entree a une instance de regle, que represente le contexte du lien.', '[OCF Core Optional 2.2.0]'],
  ['search', 'Designe une ressource qui permet de chercher dans le contexte du lien et dans les ressources liees.', '[OpenSearch]'],
  ['section', 'Designe une section dans une collection de ressources.', '[HTML 4.01 Specification]'],
  ['self', 'Donne un identifiant du contexte du lien.', '[RFC4287]'],
  ['service', 'Indique une URI ou obtenir un document de service.', '[RFC5023]'],
  ['service-desc', 'Identifie une description du service destinee d abord aux machines.', '[RFC8631]'],
  ['service-doc', 'Identifie une documentation du service destinee d abord aux humains.', '[RFC8631]'],
  ['service-meta', 'Identifie des metadonnees generales du contexte, destinees d abord aux machines.', '[RFC8631]'],
  ['sip-trunking-capability', 'Designe un document de capacites qui fixe les parametres ou les exigences de configuration pour l interconnexion automatique et la negociation des canaux de communication en SIP.', '[RFC9409]'],
  ['sponsored', 'Designe une ressource placee dans un contexte sponsorise (publicite ou autre contrepartie).', '[Google Blog post 09-2019]'],
  ['start', 'Designe la premiere ressource d une collection.', '[HTML 4.01 Specification]'],
  ['status', 'Identifie une ressource qui represente l etat du contexte.', '[RFC8631]'],
  ['stylesheet', 'Designe une feuille de style.', '[HTML]'],
  ['subsection', 'Designe une ressource qui sert de sous-section dans une collection.', '[HTML 4.01 Specification]'],
  ['successor-version', 'Designe une ressource contenant la version suivante dans l historique des versions.', '[RFC5829]'],
  ['sunset', 'Identifie une ressource qui informe sur la politique de retrait du contexte.', '[RFC8594]'],
  ['tag', 'Donne une etiquette (identifiee par son adresse) qui s applique au document courant.', '[HTML]'],
  ['terms-of-service', 'Designe les conditions d utilisation associees au contexte du lien.', '[RFC6903], section 5'],
  ['timegate', 'L IRI cible designe une TimeGate d une ressource originale.', '[RFC7089]'],
  ['timemap', 'L IRI cible designe une TimeMap d une ressource originale.', '[RFC7089]'],
  ['type', 'Designe une ressource qui identifie le type semantique abstrait dont le contexte est une instance.', '[RFC6903], section 6'],
  ['ugc', 'Designe une ressource placee dans un contexte de contenu genere par les utilisateurs.', '[Google Blog post 09-2019]'],
  ['up', 'Designe un document parent dans une hierarchie de documents.', '[RFC8288]'],
  ['version-history', 'Designe une ressource contenant l historique des versions du contexte.', '[RFC5829]'],
  ['via', 'Identifie une ressource qui est la source des informations du contexte du lien.', '[RFC4287]'],
  ['webmention', 'Identifie une URI qui accepte le protocole Webmention : qui mentionne une ressource en publiant peut ainsi prevenir ce point d acces qu elle a ete mentionnee.', '[Webmention]'],
  ['working-copy', 'Designe une copie de travail de cette ressource.', '[RFC5829]'],
  ['working-copy-of', 'Designe la ressource versionnee dont cette copie de travail est issue.', '[RFC5829]']
];

export const RELATIONS_LIENS = L.map(([nom, sens, reference]) => ({ nom, sens, reference }));

const PAR_NOM = new Map(RELATIONS_LIENS.map(r => [r.nom, r]));

/** Le type de relation enregistre, ou null (les noms se comparent en minuscules). */
export function relationLien(nom) {
  return PAR_NOM.get(String(nom || '').toLowerCase()) || null;
}

/** Recherche pour la table de reference : nom, sens ou reference. */
export function chercherRelations(question) {
  const q = String(question || '').trim().toLowerCase();
  if (!q) return RELATIONS_LIENS;
  return RELATIONS_LIENS.filter(r => r.nom.includes(q) || r.sens.toLowerCase().includes(q)
    || r.reference.toLowerCase().includes(q));
}
