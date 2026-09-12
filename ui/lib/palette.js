/* Palette de commandes — INTERCEPTOR (by NeoZ)
 *
 * Dix-sept vues, vingt-trois outils, une trentaine d actions d en-tete et les
 * sept cents lignes des tables de reference : tout cela s atteint a la souris,
 * mais il faut savoir ou regarder. La palette repond a l autre question —
 * « je sais ce que je cherche, ou est-ce ? » — en laissant taper le nom au
 * lieu de le chercher.
 *
 * Le filtrage est du sous-sequencage : « ctp » trouve « Comparer », « chemin »
 * trouve « Sites et chemins ». Les lettres doivent apparaitre dans l ordre,
 * mais pas cote a cote. C est ce qui permet de taper trois lettres au lieu du
 * libelle entier.
 *
 * Le classement se veut previsible plutot que malin : un debut de mot vaut
 * mieux qu une lettre au milieu, un libelle court mieux qu un long, et a
 * egalite l ordre reste celui de la declaration. Taper les memes lettres
 * ramene donc toujours le meme premier resultat.
 */

/* ---------------------------- Le filtrage --------------------------------- */
/**
 * Cherche `requete` comme sous-sequence de `texte`, sans tenir compte de la
 * casse ni des accents.
 *
 * @returns { score, positions } ou null si les lettres n y sont pas toutes.
 *          Le score monte avec la qualite de la correspondance.
 */
export function apparier(texte, requete) {
  const sujet = normaliser(texte);
  const cherche = normaliser(requete);
  if (!cherche) return { score: 0, positions: [] };
  if (cherche.length > sujet.length) return null;

  const positions = [];
  let i = 0;
  let score = 0;
  let precedente = -2;

  for (const lettre of cherche) {
    const trouve = sujet.indexOf(lettre, i);
    if (trouve < 0) return null;
    positions.push(trouve);

    /* Un debut de mot compte davantage : c est ce que l on tape d instinct. */
    const debutDeMot = trouve === 0 || /[\s\-_/·.]/.test(sujet[trouve - 1]);
    if (debutDeMot) score += 8;
    /* Des lettres qui se suivent valent mieux que des lettres eparpillees. */
    if (trouve === precedente + 1) score += 5;
    else score += 1;

    precedente = trouve;
    i = trouve + 1;
  }

  /* A qualite egale, le libelle le plus court gagne : « Tri » avant
     « Trames et messages » quand on tape « tri ». */
  score += Math.max(0, 20 - sujet.length);
  return { score, positions };
}

/* Les accents ne doivent pas empecher de trouver : « regles » trouve
   « Règles », et l inverse. */
function normaliser(texte) {
  return String(texte == null ? '' : texte)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Trie les commandes selon ce qui est tape.
 *
 * Chaque commande est appariee sur son libelle ET sur son groupe : taper
 * « outil » ramene tous les outils, meme ceux dont le nom ne contient pas le
 * mot. Le meilleur des deux scores l emporte, celui du groupe minore pour que
 * le libelle reste prioritaire.
 *
 * Une commande peut porter un `poids` : il se retranche du score, ce qui la
 * recule a correspondance egale sans jamais la cacher. Les sept cents lignes
 * de reference s en servent pour laisser passer les vues et les outils —
 * « cookies » propose la vue Cookies avant l en-tete Cookie.
 *
 * @param commandes [{ id, libelle, groupe, poids, ... }]
 * @param requete   ce qui est tape
 * @param limite    nombre maximal de resultats
 */
export function filtrer(commandes, requete, limite = 40) {
  const cherche = String(requete == null ? '' : requete).trim();
  if (!cherche) return commandes.slice(0, limite).map(c => ({ commande: c, positions: [] }));

  const trouves = [];
  for (let rang = 0; rang < commandes.length; rang++) {
    const commande = commandes[rang];
    const surLibelle = apparier(commande.libelle, cherche);
    const surGroupe = commande.groupe ? apparier(commande.groupe, cherche) : null;
    if (!surLibelle && !surGroupe) continue;

    const parLibelle = surLibelle ? surLibelle.score : -1;
    /* Le groupe compte moins que le libelle : « Outils » ne doit pas passer
       devant un outil qui porte reellement le mot cherche. */
    const parGroupe = surGroupe ? surGroupe.score - 12 : -1;

    trouves.push({
      commande,
      rang,
      score: Math.max(parLibelle, parGroupe) - (commande.poids || 0),
      positions: parLibelle >= parGroupe && surLibelle ? surLibelle.positions : []
    });
  }

  /* A score egal, l ordre de declaration tranche : le meme texte tape deux
     fois doit ramener le meme premier resultat. */
  trouves.sort((a, b) => b.score - a.score || a.rang - b.rang);
  return trouves.slice(0, limite).map(({ commande, positions }) => ({ commande, positions }));
}

/**
 * Decoupe un libelle en morceaux, en marquant les lettres appariees, pour que
 * l interface puisse les mettre en evidence sans recalculer l appariement.
 *
 * @returns [{ texte, marque }]
 */
export function morceaux(libelle, positions) {
  const texte = String(libelle == null ? '' : libelle);
  if (!positions || !positions.length) return [{ texte, marque: false }];

  const marquees = new Set(positions);
  const sortie = [];
  let courant = '';
  let marqueCourante = marquees.has(0);

  for (let i = 0; i < texte.length; i++) {
    const marque = marquees.has(i);
    if (marque !== marqueCourante) {
      if (courant) sortie.push({ texte: courant, marque: marqueCourante });
      courant = '';
      marqueCourante = marque;
    }
    courant += texte[i];
  }
  if (courant) sortie.push({ texte: courant, marque: marqueCourante });
  return sortie;
}

/**
 * Deplace la selection dans une liste, en bouclant aux extremites : depuis le
 * dernier resultat, la fleche bas revient au premier. Sans cela il faut
 * remonter toute la liste pour atteindre ce qui est juste en dessous.
 */
export function deplacer(indice, pas, total) {
  if (total <= 0) return 0;
  return ((indice + pas) % total + total) % total;
}
