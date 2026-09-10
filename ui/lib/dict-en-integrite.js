/* Dictionnaire anglais — integrite du corps et Server-Timing
 * INTERCEPTOR (by NeoZ)
 *
 * Les noms d en-tete et d algorithme ne se traduisent pas : « Content-Digest »
 * et « sha-256 » sont ce que porte le fil, et les chercher dans une
 * documentation suppose de les voir tels quels. Seules les phrases qui les
 * entourent changent de langue.
 */
export const EN_INTEGRITE = {
  /* ----------------------------- L integrite ------------------------------ */
  /* « Server-Timing », « reponse » et « requete » vivent deja ailleurs :
     une cle ne se definit qu a un seul endroit. */
  'les octets transmis': 'the bytes transmitted',
  'la representation, avant encodage de transfert':
    'the representation, before transfer encoding',
  'la representation (RFC 3230, forme heritee)':
    'the representation (RFC 3230, legacy form)',
  'les octets transmis (RFC 1864, obsolete)': 'the bytes transmitted (RFC 1864, obsolete)',

  '{entete} illisible : {raison}': '{entete} unreadable: {raison}',
  'Verification en cours…': 'Verifying…',
  'Corps non capture : l empreinte ne peut pas etre verifiee.':
    'Body not captured: the digest cannot be verified.',
  'Verification impossible dans ce contexte.': 'Verification not possible in this context.',
  'Empreinte calculee': 'Digest computed',

  /* Les verdicts. Ils disent ce qui a ete demontre, jamais ce qui est suppose. */
  'corps conforme a l empreinte annoncee ({liste})':
    'body matches the announced digest ({liste})',
  'empreinte annoncee non conforme au corps recu ({liste})':
    'announced digest does not match the received body ({liste})',
  'empreinte annoncee, non verifiable dans ce contexte':
    'digest announced, not verifiable in this context',

  /* Ce que vaut chaque algorithme. */
  'SHA-256, recommande': 'SHA-256, recommended',
  'SHA-512, recommande': 'SHA-512, recommended',
  'SHA-1, deconseille : collisions demontrees': 'SHA-1, discouraged: collisions demonstrated',
  'MD5, deconseille : collisions triviales': 'MD5, discouraged: collisions are trivial',
  'somme de controle Unix, sans valeur cryptographique':
    'Unix checksum, no cryptographic value',
  'cksum Unix, sans valeur cryptographique': 'Unix cksum, no cryptographic value',
  'CRC32C, detecte une corruption, pas une alteration':
    'CRC32C, detects corruption, not tampering',
  'Adler-32, detecte une corruption, pas une alteration':
    'Adler-32, detects corruption, not tampering',
  'algorithme hors du registre IANA': 'algorithm outside the IANA registry',

  /* ---------------------------- Server-Timing ----------------------------- */
  'Server-Timing illisible : {raison}': 'Server-Timing unreadable: {raison}',
  '(aucune duree annoncee)': '(no duration announced)',
  '{n} ms ne sont revendiquees par personne : reseau, mise en file, ou temps que le serveur ne compte pas.':
    '{n} ms are claimed by nobody: network, queueing, or time the server does not count.',

  /* Les morceaux du resume, traduits un a un puis assembles. */
  '{n} mesure(s), {ms} ms revendiques': '{n} measurement(s), {ms} ms claimed',
  '{n} sans duree': '{n} with no duration',
  'plus que la duree mesuree : mesures qui se chevauchent, ou travail asynchrone compte a part':
    'more than the measured duration: overlapping measurements, or asynchronous work counted separately',
  '{ms} ms ailleurs — reseau, file d attente, ou temps que le serveur ne compte pas':
    '{ms} ms elsewhere — network, queueing, or time the server does not count'
};
