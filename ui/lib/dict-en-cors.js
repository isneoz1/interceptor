/* Dictionnaire anglais — preflight CORS — INTERCEPTOR (by NeoZ)
 *
 * Les noms d entete ne se traduisent pas : « Access-Control-Allow-Origin »
 * est ce que porte le fil, et le chercher dans une documentation ou une
 * configuration de serveur suppose de le voir tel quel. Seules les phrases
 * qui l entourent changent de langue.
 */
export const EN_CORS = {
  'Preflight CORS': 'CORS preflight',
  'accepte': 'accepted',
  'refuse': 'refused',
  'Methode demandee': 'Method requested',
  'Origine demandee': 'Origin requested',
  'Entetes demandes': 'Headers requested',

  'Access-Control-Allow-Origin': 'Access-Control-Allow-Origin',
  'Access-Control-Allow-Methods': 'Access-Control-Allow-Methods',
  'Access-Control-Allow-Headers': 'Access-Control-Allow-Headers',
  'Access-Control-Allow-Credentials': 'Access-Control-Allow-Credentials',
  'Access-Control-Max-Age': 'Access-Control-Max-Age',
  '{n} s — passe ce delai, le navigateur refait un preflight':
    '{n} s — past that, the browser sends a new preflight',

  'Cette reponse autorise bien la requete annoncee.':
    'This response does authorise the request it announced.',
  'Requete autorisee par ce preflight': 'Request authorised by this preflight',
  'Aucune requete n a suivi ce preflight : le navigateur a renonce, ou la page a abandonne.':
    'No request followed this preflight: the browser gave up, or the page abandoned it.',
  'Un preflight OPTIONS a precede cette requete et l autorisait.':
    'An OPTIONS preflight preceded this request and authorised it.',
  'Un preflight OPTIONS a precede cette requete et ne l autorisait pas. C est la cause a chercher, pas cette ligne-ci.':
    'An OPTIONS preflight preceded this request and did not authorise it. That is the cause to look at, not this row.',
  'Voir le preflight': 'See the preflight',

  /* Les motifs de refus. Chacun cite l entete qui le fonde. */
  'Access-Control-Allow-Origin est absent de la reponse':
    'Access-Control-Allow-Origin is missing from the response',
  'Access-Control-Allow-Methods est absent de la reponse':
    'Access-Control-Allow-Methods is missing from the response',
  'la reponse au preflight vaut {statut} : le navigateur ne regarde meme pas les autorisations':
    'the preflight response is {statut}: the browser does not even look at the permissions',
  'Access-Control-Allow-Origin vaut « * » alors que les identifiants sont autorises : le navigateur refuse cette combinaison, l origine doit etre citee':
    'Access-Control-Allow-Origin is "*" while credentials are allowed: the browser refuses that combination, the origin must be named',
  'Access-Control-Allow-Origin repond « {permis} » alors que l origine demandee est « {demande} »':
    'Access-Control-Allow-Origin answers "{permis}" while the requested origin is "{demande}"',
  'la methode {methode} n est pas dans Access-Control-Allow-Methods (« {permises} »)':
    'method {methode} is not in Access-Control-Allow-Methods ("{permises}")',
  'l entete « {entete} » n est pas couvert par Access-Control-Allow-Headers':
    'header "{entete}" is not covered by Access-Control-Allow-Headers',
  'les entetes {liste} ne sont pas couverts par Access-Control-Allow-Headers':
    'headers {liste} are not covered by Access-Control-Allow-Headers'
};
