/* GraphQL dans le panneau de detail — SWIFT (by NeoZ)
 *
 *   Requete  l operation executee, le document, les variables, et la requete
 *            persistee d Apollo, dont le hachage est recalcule ici
 *   Reponse  la nature du resultat (complet, partiel, erreur d execution ou
 *            de requete), chaque erreur avec son chemin, le schema livre a
 *            une introspection, et l accord du statut HTTP avec le corps
 *
 * Rien ne s affiche quand l echange n est pas du GraphQL. La lecture vit dans
 * ui/lib/graphql-http.js ; ce module ne fait que la montrer.
 */
import { el, frag, kv, sec, add, jsonTree } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { copy } from '../app.js';
import { poser } from './tools.js';
import {
  lireRequeteGraphql, lireReponseGraphql, faitsGraphql, verifierPersistee, texteGraphql, resumeGraphql,
  FORMES_GRAPHQL
} from '../lib/graphql-http.js';

/* Les faits qui parlent de la reponse : montres avec elle, pas avec la requete. */
const FAITS_REPONSE = new Set(['typeMediaNouveau', 'typeMediaAncien', 'statut200Erreurs', 'sansDataEn2xx',
  'dataEnErreur', 'persisteeInconnue', 'schemaLivre', 'complete', 'partielle', 'erreurExecution', 'erreurRequete']);
const TONS = {
  getMutationExecutee: 'warn', ambigu: 'ko', introuvable: 'ko', illisible: 'ko', statut200Erreurs: 'warn',
  sansDataEn2xx: 'warn', dataEnErreur: 'warn', partielle: 'warn', erreurExecution: 'ko', erreurRequete: 'ko',
  complete: 'ok', getMutationRefusee: 'ok', persisteeInconnue: 'warn'
};

const note = (texte, ton) => el('p', { class: 'note' + (ton ? ' ' + ton : ''), text: texte });

function montrerFaits(box, faits, garder) {
  for (const f of faits) {
    if (!garder(f.cle)) continue;
    box.appendChild(note('•  ' + tp(f.texte, f.valeurs), TONS[f.cle]));
  }
}

function requeteDe(rec) {
  try {
    return lireRequeteGraphql({ methode: rec.method, url: rec.url, corps: rec.requestBody || null });
  } catch { return null; }
}

/* Une requete persistee : le hachage annonce, puis son recalcul sur le texte
   envoye avec lui. Sans texte, il n y a rien a recalculer : on le dit. */
function blocPersistee(box, r) {
  add(box, kv('Requete persistee', tp('version {v} · SHA-256 {h}', { v: r.persistee.version ?? '—', h: r.persistee.hash }),
    { copy: true }));
  if (!r.persistee.formeValide) {
    box.appendChild(note(t('Le hachage annonce n a pas la forme d un SHA-256 : 64 chiffres hexadecimaux.'), 'ko'));
    return;
  }
  if (r.query === null) return;
  const verdict = note(t('Verification du hachage…'));
  box.appendChild(verdict);
  verifierPersistee(r.query, r.persistee.hash).then(v => {
    verdict.className = 'note ' + (v.egal ? 'ok' : 'ko');
    verdict.textContent = v.egal
      ? t('Le hachage correspond au texte envoye : SHA-256 recalcule a l identique.')
      : tp('Le hachage ne correspond pas au texte envoye : SHA-256 recalcule {h}.', { h: v.calcule });
  }, () => {
    verdict.className = 'note warn';
    verdict.textContent = t('Calcul SHA-256 indisponible dans ce contexte.');
  });
}

function blocRequete(box, r, index, total) {
  const carte = total > 1 ? el('div', { class: 'find info' }, [
    el('h4', { text: tp('Operation {n} sur {total}', { n: index + 1, total }) })
  ]) : box;
  add(carte, kv('Operation executee', r.operation ? r.operation.type + (r.operation.nom ? ' ' + r.operation.nom : '') : null,
    { hl: true }));
  if (r.operations.length > 1) {
    add(carte, kv('Operations du document', r.operations.map(o => o.type + (o.nom ? ' ' + o.nom : '')).join(', ')));
  }
  add(carte, kv('operationName', r.operationName, { copy: true }));
  if (r.persistee) blocPersistee(carte, r);
  if (r.variables != null) {
    carte.appendChild(el('div', { class: 'tree' }, jsonTree(r.variables, 'variables')));
  }
  if (r.extensions != null) {
    carte.appendChild(el('div', { class: 'tree' }, jsonTree(r.extensions, 'extensions')));
  }
  if (r.query) {
    carte.appendChild(el('pre', { class: 'pre', text: r.query }));
    carte.appendChild(el('div', { class: 'actions' }, [
      el('button', { class: 'btn sm', type: 'button', on: { click: () => copy(r.query, 'Document copie') } }, t('Copier le document')),
      el('button', { class: 'btn sm', type: 'button', title: t('Hacher, mesurer ou comparer ce document'),
        on: { click: () => poser(r.query) } }, t('Boite a outils'))
    ]));
  }
  if (carte !== box) box.appendChild(carte);
}

/** Le bloc GraphQL de l onglet Requete. */
export function graphqlRequete(rec) {
  const box = frag();
  const requete = requeteDe(rec);
  if (!requete) return box;
  const resume = texteGraphql(resumeGraphql(requete), t('requete persistee'));
  box.appendChild(sec('GraphQL', resume));
  add(box, kv('Transport', t(FORMES_GRAPHQL[requete.forme] || requete.forme)));
  montrerFaits(box, faitsGraphql(requete, null, { statut: rec.statusCode }), cle => !FAITS_REPONSE.has(cle));
  requete.requetes.forEach((r, i) => blocRequete(box, r, i, requete.requetes.length));
  return box;
}

function blocErreurs(box, erreurs) {
  for (const e of erreurs) {
    const details = [
      e.chemin ? tp('chemin {c}', { c: e.chemin }) : null,
      e.lieux ? tp('ligne:colonne {l}', { l: e.lieux }) : null,
      e.code ? tp('code {c}', { c: e.code }) : null
    ].filter(Boolean).join('  ·  ');
    box.appendChild(el('div', { class: 'find medium' }, [
      el('h4', { text: e.message || t('(erreur sans message)') }),
      details ? el('p', { text: details }) : null
    ]));
  }
}

/** Le bloc GraphQL de l onglet Reponse. */
export function graphqlReponse(rec) {
  const box = frag();
  const requete = requeteDe(rec);
  const corps = rec.responseBody;
  if (!requete || !corps || typeof corps.text !== 'string' || !corps.text) return box;
  const reponse = lireReponseGraphql(corps.text);
  if (!reponse) return box;
  const erreurs = reponse.resultats.reduce((n, r) => n + r.erreurs.length, 0);
  box.appendChild(sec('GraphQL', erreurs ? tp('{n} erreur(s)', { n: erreurs }) : t('sans erreur')));
  montrerFaits(box, faitsGraphql(requete, reponse, { statut: rec.statusCode, typeMedia: rec.mime }),
    cle => FAITS_REPONSE.has(cle));
  reponse.resultats.forEach((r, i) => {
    if (reponse.resultats.length > 1) box.appendChild(sec(tp('Resultat {n}', { n: i + 1 })));
    blocErreurs(box, r.erreurs);
    if (r.schema) {
      add(box, kv('Types du schema', tp('{n}, dont {p} propres a l API', { n: r.schema.types, p: r.schema.propres })));
      add(box, kv('Type des requetes', r.schema.requete));
      add(box, kv('Type des mutations', r.schema.mutation));
      add(box, kv('Type des abonnements', r.schema.abonnement));
      add(box, kv('Directives', r.schema.directives || null));
    }
    if (r.extensions) box.appendChild(el('div', { class: 'tree' }, jsonTree(r.extensions, 'extensions')));
  });
  return box;
}
