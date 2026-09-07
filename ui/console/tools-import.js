/* Panneau « Importer une requete » — INTERCEPTOR (by D4RK)
 *
 * Deux entrees possibles, un seul resultat : une ligne dans le tableau, a
 * l etat « pending », que l on peut ensuite rejouer, comparer ou regenerer
 * dans n importe quel langage.
 *
 *   - une commande cURL, d ou qu elle vienne ;
 *   - une requete HTTP brute, telle qu on la lit dans un journal ou un ticket.
 *
 * L apercu est calcule ici meme : on voit ce qui sera cree avant de le creer.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { toast, cmd, copy } from '../app.js';
import { analyserCurl } from '../../background/ingest/curl.js';
import { echapperShell } from '../lib/codecs-format.js';

export function panneauImport(entree, etat, redessiner) {
  const box = frag();
  const brut = String(entree || '').trim();
  const modeBrut = etat.importBrut === true;

  box.appendChild(sec('Importer une requete', modeBrut ? 'requete HTTP brute' : 'commande cURL'));

  const choix = el('div', { class: 'actions' });
  choix.appendChild(button('Commande cURL', () => { etat.importBrut = false; redessiner(); },
    { class: modeBrut ? 'ghost' : 'on' }));
  choix.appendChild(button('Requete HTTP brute', () => { etat.importBrut = true; redessiner(); },
    { class: modeBrut ? 'on' : 'ghost' }));
  box.appendChild(choix);

  if (!brut) {
    box.appendChild(el('p', { class: 'note', text: modeBrut
      ? t('Collez une requete complete dans le texte de travail : ligne de commande, entetes, ligne vide, corps.')
      : t('Collez une commande cURL dans le texte de travail. Celles que produit INTERCEPTOR sont relues telles quelles, tout comme celles copiees depuis un autre navigateur.') }));
    return box;
  }

  let lu, commande;
  try {
    commande = modeBrut ? brutVersCurl(brut) : brut;
    lu = analyserCurl(commande);
  } catch (e) {
    box.appendChild(el('p', { class: 'note warn', text: t('Requete illisible : ') + String(e.message || e) }));
    return box;
  }

  box.appendChild(sec('Apercu', lu.method + ' ' + lu.url));
  add(box, kv('Methode', lu.method, { hl: true }));
  add(box, kv('URL', lu.url, { copy: true }));
  add(box, kv('Entetes', lu.headers.length, { always: true }));
  for (const h of lu.headers) add(box, kv('  ' + h.name, h.value, { copy: true }));
  if (lu.body != null) {
    box.appendChild(sec('Corps', lu.body.length + ' caracteres'));
    box.appendChild(el('pre', { class: 'pre', text: lu.body }));
  }
  if (lu.warnings.length) {
    box.appendChild(sec('Avertissements', lu.warnings.length));
    for (const w of lu.warnings) box.appendChild(el('p', { class: 'note warn', text: w }));
  }

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Creer la requete', async () => {
    const res = await cmd('importCurl', { commande });
    if (res.error) return toast(res.error, false);
    toast('Requete #' + res.id + ' creee — visible dans le tableau');
    document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests', id: res.id } }));
  }));
  if (modeBrut) {
    actions.appendChild(button('Copier la commande cURL equivalente',
      () => copy(commande, 'Commande copiee')));
  }
  box.appendChild(actions);
  box.appendChild(el('p', { class: 'note', text:
    t('La requete creee n a pas ete emise : elle apparait dans le tableau avec l etat « pending ». Utilisez l onglet « Rejouer » de son detail pour l envoyer reellement.') }));
  return box;
}

/**
 * Requete HTTP brute vers commande cURL. On ne reimplemente pas un second
 * analyseur de requete : on ecrit la commande que l analyseur cURL sait deja
 * relire, ce qui garantit que les deux chemins d import donnent le meme
 * resultat.
 */
export function brutVersCurl(texte) {
  const lignes = String(texte).replace(/\r\n/g, '\n').split('\n');
  const premiere = (lignes.shift() || '').trim();
  const m = premiere.match(/^([A-Za-z]+)\s+(\S+)(?:\s+HTTP\/[\d.]+)?$/);
  if (!m) throw new Error('premiere ligne attendue : METHODE chemin HTTP/1.1');
  const methode = m[1].toUpperCase();
  const cible = m[2];

  const entetes = [];
  let i = 0;
  for (; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (!ligne.trim()) { i++; break; }
    const coupe = ligne.indexOf(':');
    if (coupe < 0) throw new Error('entete sans deux-points : ' + ligne.trim());
    entetes.push([ligne.slice(0, coupe).trim(), ligne.slice(coupe + 1).trim()]);
  }
  const corps = lignes.slice(i).join('\n').replace(/\n+$/, '');

  const hote = (entetes.find(([nom]) => nom.toLowerCase() === 'host') || [])[1];
  let url;
  if (/^https?:\/\//i.test(cible)) url = cible;
  else if (hote) url = (hote.endsWith(':80') ? 'http://' : 'https://') + hote + cible;
  else throw new Error('ni URL absolue ni entete Host : la cible est inconnue');

  const parties = ['curl -i -X ' + methode + ' ' + echapperShell(url)];
  for (const [nom, valeur] of entetes) parties.push('-H ' + echapperShell(nom + ': ' + valeur));
  if (corps) parties.push('--data-raw ' + echapperShell(corps));
  return parties.join(' \\\n  ');
}
