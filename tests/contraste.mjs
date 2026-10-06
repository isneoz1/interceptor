/* Mesure du contraste des jetons de couleur — SWIFT (cree par NeoZ)
 *
 * Une interface sombre a neons est vite jolie et illisible. Ce module lit les
 * couleurs declarees dans `ui/theme.css` et calcule le contraste reel de
 * chaque paire texte / fond, selon la formule du WCAG 2.1 (section 1.4.3).
 *
 * Les seuils retenus :
 *   4.5 : texte courant, celui qu on lit vraiment ;
 *   3.0 : texte secondaire et grands caracteres, ou la norme l autorise.
 *
 * Rien n est estime a l oeil : chaque valeur sort de la formule.
 */
import fs from 'fs';

/* ------------------------------ Lecture CSS ------------------------------- */
/** Les variables d un bloc de declaration, par exemple `:root { ... }`. */
export function jetonsDuBloc(css, selecteur) {
  const debut = css.indexOf(selecteur);
  if (debut < 0) throw new Error('bloc introuvable : ' + selecteur);
  const ouvre = css.indexOf('{', debut);
  let profondeur = 0;
  let fin = ouvre;
  for (let i = ouvre; i < css.length; i++) {
    if (css[i] === '{') profondeur++;
    else if (css[i] === '}' && --profondeur === 0) { fin = i; break; }
  }
  const corps = css.slice(ouvre + 1, fin);
  const jetons = {};
  for (const m of corps.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    jetons[m[1]] = m[2].trim();
  }
  return jetons;
}

/* ------------------------------- Couleurs --------------------------------- */
/** #rgb, #rrggbb, rgb() et rgba() -> { r, g, b, a }. */
export function lireCouleur(valeur) {
  const v = String(valeur).trim();
  let m = /^#([0-9a-f]{3})$/i.exec(v);
  if (m) {
    const [a, b, c] = m[1];
    return { r: parseInt(a + a, 16), g: parseInt(b + b, 16), b: parseInt(c + c, 16), a: 1 };
  }
  m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) {
    return {
      r: parseInt(m[1].slice(0, 2), 16),
      g: parseInt(m[1].slice(2, 4), 16),
      b: parseInt(m[1].slice(4, 6), 16),
      a: 1
    };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (m) {
    const p = m[1].split(/[,/]/).map(x => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  }
  throw new Error('couleur illisible : ' + valeur);
}

/** Une couleur translucide posee sur un fond opaque. */
export function aplatir(dessus, dessous) {
  const a = dessus.a;
  return {
    r: dessus.r * a + dessous.r * (1 - a),
    g: dessus.g * a + dessous.g * (1 - a),
    b: dessus.b * a + dessous.b * (1 - a),
    a: 1
  };
}

/** Luminance relative, WCAG 2.1 section 1.4.3. */
export function luminance(c) {
  const canal = v => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
}

/** Rapport de contraste entre deux couleurs, de 1 a 21. */
export function contraste(avant, arriere) {
  const a = luminance(typeof avant === 'string' ? lireCouleur(avant) : avant);
  const b = luminance(typeof arriere === 'string' ? lireCouleur(arriere) : arriere);
  const clair = Math.max(a, b);
  const sombre = Math.min(a, b);
  return (clair + 0.05) / (sombre + 0.05);
}

/**
 * Les paires reellement affichees, avec le seuil qui leur revient.
 * `--dim` et `--mute` habillent des libelles secondaires : le WCAG accepte 3
 * pour eux, on vise mieux quand c est possible.
 */
export function pairesAControler(jetons) {
  const c = nom => {
    const valeur = jetons[nom];
    if (!valeur) throw new Error('jeton absent : ' + nom);
    return lireCouleur(valeur);
  };
  const sur = (nom, fond) => {
    const couleur = c(nom);
    return couleur.a < 1 ? aplatir(couleur, c(fond)) : couleur;
  };

  const paires = [];
  const ajouter = (quoi, avant, arriere, seuil) =>
    paires.push({ quoi, ratio: contraste(avant, arriere), seuil });

  /* Le texte courant, sur chacune des surfaces ou il apparait. */
  for (const fond of ['--bg', '--elev', '--surface', '--surface-2', '--surface-3', '--code-bg', '--champ']) {
    ajouter('texte sur ' + fond, c('--text'), c(fond), 4.5);
  }
  /* Texte secondaire : libelles, unites, notes — et l invite grisee d un
     champ, ecrite en `--mute` sur `--champ`. */
  for (const fond of ['--bg', '--elev', '--surface', '--surface-2', '--champ']) {
    ajouter('texte attenue sur ' + fond, c('--dim'), c(fond), 4.5);
    ajouter('texte discret sur ' + fond, c('--mute'), c(fond), 3);
  }
  /* L accent ecrit du vrai texte, en petit : valeur mise en avant, touche
     d un raccourci, onglet actif. Il doit donc se lire comme du texte. */
  for (const fond of ['--bg', '--elev', '--surface', '--surface-2']) {
    ajouter('accent sur ' + fond, c('--accent'), c(fond), 4.5);
  }
  ajouter('accent sur sa teinte faible', c('--accent'), sur('--accent-weak', '--surface'), 4.5);
  /* Les aplats pleins portent un texte blanc ou presque : bouton principal,
     son survol, bouton de suppression arme. Mesures sur la couleur de l aplat,
     pas sur celle du texte d accent, qui est une autre couleur. */
  ajouter('texte du bouton principal', c('--on-accent'), c('--accent-fill'), 4.5);
  ajouter('texte du bouton principal survole', c('--on-accent'), c('--accent-fill-hover'), 4.5);
  ajouter('texte du bouton de suppression arme', c('--on-accent'), c('--red-fill'), 4.5);
  /* Les etats portent du sens : ils doivent se lire, pas seulement se voir. */
  for (const etat of ['--green', '--red', '--orange', '--amber', '--blue', '--violet']) {
    ajouter(etat + ' sur --surface', c(etat), c('--surface'), 4.5);
    ajouter(etat + ' sur --bg', c(etat), c('--bg'), 4.5);
    ajouter(etat + ' sur sa teinte faible',
      c(etat), sur(etat.replace('--', '--') + '-soft', '--surface'), 3);
  }
  /* Une ligne selectionnee du tableau garde ses couleurs de methode et de
     statut, posees sur la teinte d accent qui recouvre le fond. */
  ajouter('texte sur une ligne selectionnee', c('--text'), sur('--accent-weak', '--bg'), 4.5);
  ajouter('texte discret sur une ligne selectionnee', c('--mute'), sur('--accent-weak', '--bg'), 3);
  for (const etat of ['--green', '--red', '--amber', '--blue']) {
    ajouter(etat + ' sur une ligne selectionnee', c(etat), sur('--accent-weak', '--bg'), 4.5);
  }
  /* Les marquages manuels d une ligne. */
  for (const mk of ['--mk-rouge', '--mk-orange', '--mk-jaune', '--mk-vert', '--mk-bleu', '--mk-violet']) {
    ajouter(mk + ' sur --bg', c(mk), c('--bg'), 3);
  }
  return paires;
}

/** Les deux themes livres, mesures. */
export function mesurerTheme(chemin) {
  const css = fs.readFileSync(chemin, 'utf8');
  return {
    sombre: pairesAControler(jetonsDuBloc(css, ':root {')),
    clair: pairesAControler(jetonsDuBloc(css, ':root[data-theme="clair"]'))
  };
}
