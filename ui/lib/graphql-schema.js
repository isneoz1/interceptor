/* Le schema d une API GraphQL, lu par introspection — SWIFT (by D4RK)
 *
 * La specification GraphQL (§4, « Introspection ») permet de demander a un
 * serveur son propre schema : les types, leurs champs, les arguments. Le
 * client GraphQL de la boite a outils envoie la requete d introspection
 * habituelle — celle de graphql-js, getIntrospectionQuery() —, lit la
 * reponse, liste les points d entree (Query, Mutation, Subscription) et
 * ecrit pour l un d eux une requete prete a envoyer : les variables de ses
 * arguments obligatoires, et les champs simples de ce qu il rend.
 *
 * Les tables sont des Map : un type nomme « constructor » par un serveur ne
 * doit rien trouver d herite.
 */

const REF_TYPE = 'fragment TypeRef on __Type { kind name ofType { kind name ofType { kind name ofType { kind name ' +
  'ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } } } }';

export const REQUETE_INTROSPECTION = 'query IntrospectionQuery { __schema { queryType { name } mutationType { name } ' +
  'subscriptionType { name } types { ...FullType } directives { name description locations args { ...InputValue } } } } ' +
  'fragment FullType on __Type { kind name description fields(includeDeprecated: true) { name description ' +
  'args { ...InputValue } type { ...TypeRef } isDeprecated deprecationReason } inputFields { ...InputValue } ' +
  'interfaces { ...TypeRef } enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason } ' +
  'possibleTypes { ...TypeRef } } fragment InputValue on __InputValue { name description type { ...TypeRef } ' +
  'defaultValue } ' + REF_TYPE;

/** La signature d une reference de type : « String! », « [User!]! ». */
export function ecrireType(ref) {
  if (!ref || typeof ref !== 'object') return '?';
  if (ref.kind === 'NON_NULL') return ecrireType(ref.ofType) + '!';
  if (ref.kind === 'LIST') return '[' + ecrireType(ref.ofType) + ']';
  return ref.name ? String(ref.name) : '?';
}

/** Le type nomme au fond d une reference (sans liste ni non-nul). */
export function typeNomme(ref) {
  let r = ref;
  for (let k = 0; r && k < 10; k++) {
    if (r.kind !== 'NON_NULL' && r.kind !== 'LIST') return r;
    r = r.ofType;
  }
  return null;
}

const champ = f => ({
  nom: String(f.name),
  description: f.description ? String(f.description) : '',
  arguments: (Array.isArray(f.args) ? f.args : []).filter(a => a && a.name).map(a => ({
    nom: String(a.name), type: ecrireType(a.type), obligatoire: !!(a.type && a.type.kind === 'NON_NULL') && a.defaultValue == null,
    defaut: a.defaultValue == null ? null : String(a.defaultValue)
  })),
  type: ecrireType(f.type),
  ref: f.type || null,
  deprecie: !!f.isDeprecated,
  raison: f.deprecationReason ? String(f.deprecationReason) : ''
});

/**
 * @param json  la reponse a la requete d introspection (avec ou sans « data »)
 * @returns { racines: { query, mutation, subscription }, types: Map, nombre, directives }
 */
export function lireSchemaIntrospection(json) {
  const schema = json && json.data && json.data.__schema ? json.data.__schema : (json && json.__schema ? json.__schema : null);
  if (!schema || !Array.isArray(schema.types)) throw new Error('pas de schema dans la reponse : __schema.types est attendu');
  const types = new Map();
  for (const t of schema.types) {
    if (!t || !t.name) continue;
    types.set(String(t.name), {
      nom: String(t.name), genre: String(t.kind || ''), description: t.description ? String(t.description) : '',
      champs: (Array.isArray(t.fields) ? t.fields : []).filter(f => f && f.name).map(champ),
      entrees: (Array.isArray(t.inputFields) ? t.inputFields : []).filter(f => f && f.name).map(champ),
      valeurs: (Array.isArray(t.enumValues) ? t.enumValues : []).filter(v => v && v.name).map(v => String(v.name)),
      possibles: (Array.isArray(t.possibleTypes) ? t.possibleTypes : []).filter(p => p && p.name).map(p => String(p.name))
    });
  }
  const nom = r => (r && r.name ? String(r.name) : null);
  return {
    racines: { query: nom(schema.queryType), mutation: nom(schema.mutationType), subscription: nom(schema.subscriptionType) },
    types,
    nombre: [...types.keys()].filter(n => !n.startsWith('__')).length,
    directives: (Array.isArray(schema.directives) ? schema.directives : []).filter(d => d && d.name).map(d => String(d.name))
  };
}

/** Les champs d un point d entree : « query », « mutation » ou « subscription ». */
export function champsRacine(schema, operation) {
  const nom = schema && schema.racines ? schema.racines[operation] : null;
  const type = nom ? schema.types.get(nom) : null;
  return type ? type.champs : [];
}

/** La signature lisible d un champ : « user(id: ID!): User ». */
export function signatureChamp(c) {
  return c.nom + (c.arguments.length ? '(' + c.arguments.map(a => a.nom + ': ' + a.type).join(', ') + ')' : '') + ': ' + c.type;
}

const SIMPLES = new Set(['SCALAR', 'ENUM']);

function selection(schema, ref, profondeur, marge) {
  const t = typeNomme(ref);
  const type = t && t.name ? schema.types.get(String(t.name)) : null;
  if (!type || SIMPLES.has(type.genre)) return '';
  if (type.genre === 'UNION' || type.genre === 'INTERFACE' && !type.champs.length) return ' {\n' + marge + '  __typename\n' + marge + '}';
  const simples = type.champs.filter(c => {
    const n = typeNomme(c.ref);
    const cible = n && n.name ? schema.types.get(String(n.name)) : null;
    return !c.arguments.some(a => a.obligatoire) && (!cible || SIMPLES.has(cible.genre));
  });
  const lignes = simples.map(c => marge + '  ' + c.nom);
  if (profondeur > 1) {
    for (const c of type.champs) {
      if (simples.includes(c) || c.arguments.some(a => a.obligatoire)) continue;
      const sous = selection(schema, c.ref, profondeur - 1, marge + '  ');
      if (sous) lignes.push(marge + '  ' + c.nom + sous);
    }
  }
  if (!lignes.length) lignes.push(marge + '  __typename');
  return ' {\n' + lignes.join('\n') + '\n' + marge + '}';
}

/**
 * Une requete prete a envoyer pour un champ racine, et ses variables.
 * @returns { requete, variables } — variables : un objet dont chaque valeur
 *          est null, a remplir.
 */
export function squeletteOperation(schema, operation, nomChamp, { profondeur = 1 } = {}) {
  const c = champsRacine(schema, operation).find(x => x.nom === nomChamp);
  if (!c) throw new Error('champ inconnu : ' + nomChamp);
  const args = c.arguments.filter(a => a.obligatoire);
  const nomOperation = nomChamp.charAt(0).toUpperCase() + nomChamp.substring(1);
  const entete = operation + ' ' + nomOperation + (args.length ? '(' + args.map(a => '$' + a.nom + ': ' + a.type).join(', ') + ')' : '');
  const appel = c.nom + (args.length ? '(' + args.map(a => a.nom + ': $' + a.nom).join(', ') + ')' : '');
  const requete = entete + ' {\n  ' + appel + selection(schema, c.ref, profondeur, '  ') + '\n}\n';
  const variables = {};
  for (const a of args) variables[a.nom] = null;
  return { requete, variables };
}

/** Les types et champs dont le nom contient un mot. */
export function chercherSchema(schema, mot) {
  const m = String(mot || '').trim().toLowerCase();
  if (!m) return [];
  const sortie = [];
  for (const type of schema.types.values()) {
    if (type.nom.startsWith('__')) continue;
    if (type.nom.toLowerCase().includes(m)) sortie.push({ type: type.nom, genre: type.genre, champ: null });
    for (const c of type.champs) if (c.nom.toLowerCase().includes(m)) sortie.push({ type: type.nom, genre: type.genre, champ: c });
  }
  return sortie;
}
