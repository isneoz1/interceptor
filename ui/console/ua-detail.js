/* Onglet En-tetes : ce que le navigateur annonce — SWIFT (by D4RK)
 *
 * Le User-Agent et les indices clients d une requete, lus ensemble. Les
 * indices disent ce que la chaine tait desormais : Windows 11 (Sec-CH-UA-
 * Platform-Version 13 et plus, selon Microsoft), le modele, l architecture.
 * La lecture vit dans ui/lib/user-agent.js.
 */
import { el, frag, kv, sec, add } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { lireUserAgent, lireIndicesClients } from '../lib/user-agent.js';

const nomme = x => (x ? x.nom + (x.version ? ' ' + x.version : '') : null);

/** La section, ou null quand la requete ne porte ni User-Agent ni indices. */
export function blocNavigateurAnnonce(rec) {
  const entetes = (rec && rec.requestHeaders) || [];
  const ua = entetes.find(h => String(h.name || '').toLowerCase() === 'user-agent');
  const indices = lireIndicesClients(entetes);
  if (!ua && !indices) return null;
  const lu = lireUserAgent(ua ? ua.value : '');
  const box = frag();
  box.appendChild(sec('Ce que le navigateur annonce', indices ? t('User-Agent et indices clients') : 'User-Agent'));
  if (lu.navigateur) add(box, kv('Navigateur', nomme(lu.navigateur), { hl: true }));
  else if (lu.derive) {
    add(box, kv('Navigateur', lu.derive.jeton
      ? tp('derive de {famille}, jeton {jeton}', { famille: lu.derive.famille || '?', jeton: lu.derive.jeton })
      : tp('derive de {famille}', { famille: lu.derive.famille || '?' })));
  }
  else if (ua && !lu.robot) add(box, kv('Navigateur', t('non reconnu')));
  if (lu.moteur) add(box, kv('Moteur', nomme(lu.moteur)));
  if (indices && indices.windows) {
    add(box, kv('Systeme', tp('Windows {n} (indices clients, Sec-CH-UA-Platform-Version {v})', { n: indices.windows, v: indices.versionPlateforme }), { hl: true }));
  } else if (lu.systeme) add(box, kv('Systeme', nomme(lu.systeme)));
  else if (indices && indices.plateforme) add(box, kv('Systeme', indices.plateforme));
  if (lu.robot) add(box, kv('Client automatique', lu.robot, { hl: true }));
  const mobile = indices && indices.mobile != null ? indices.mobile : lu.mobile;
  add(box, kv('Se declare mobile', t(mobile ? 'oui' : 'non')));
  if (indices) {
    for (const m of indices.marques) {
      add(box, kv(m.leurre ? t('Marque leurre (voulue par la specification)') : t('Marque'), m.nom + (m.version ? ' ' + m.version : '')));
    }
    if (indices.modele) add(box, kv('Modele', indices.modele));
    if (indices.architecture) add(box, kv('Architecture', indices.architecture + (indices.bits ? ', ' + indices.bits + ' bits' : '')));
  }
  for (const r of lu.remarques) {
    /* Windows 11 : la remarque ne sert plus quand les indices l ont dit. */
    if (indices && indices.windows && /Windows 11/.test(r)) continue;
    box.appendChild(el('p', { class: 'note', text: t(r) }));
  }
  return box;
}
