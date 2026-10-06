/* Probleme HTTP (RFC 9457) dans le panneau de detail — SWIFT (by NeoZ)
 *
 * Une reponse application/problem+json, lue membre par membre, et confrontee
 * au statut HTTP reellement servi. Rien ne s affiche pour une autre reponse.
 * La lecture vit dans ui/lib/probleme-http.js.
 */
import { el, frag, kv, sec, add, jsonTree } from '../lib/dom.js';
import { tp } from '../lib/i18n.js';
import { lireProbleme, faitsProbleme } from '../lib/probleme-http.js';

const TONS = { statutDifferent: 'warn', membreIgnore: 'warn' };

/** Le bloc « Probleme HTTP » de l onglet Reponse. */
export function problemeReponse(rec) {
  const box = frag();
  const corps = rec.responseBody;
  if (!corps || typeof corps.text !== 'string' || !corps.text) return box;
  const p = lireProbleme(corps.text, rec.mime);
  if (!p) return box;
  box.appendChild(sec('Probleme HTTP (RFC 9457)', p.status != null ? String(p.status) : null));
  for (const f of faitsProbleme(p, { statut: rec.statusCode, url: rec.finalUrl || rec.url })) {
    box.appendChild(el('p', { class: 'note ' + (TONS[f.cle] || ''), text: '•  ' + tp(f.texte, f.valeurs) }));
  }
  add(box, kv('Type', p.type || 'about:blank', { copy: true }));
  add(box, kv('Titre', p.title));
  add(box, kv('Statut annonce', p.status));
  add(box, kv('Detail', p.detail));
  add(box, kv('Occurrence', p.instance, { copy: true }));
  if (Object.keys(p.extensions).length) {
    box.appendChild(el('div', { class: 'tree' }, jsonTree(p.extensions, 'extensions')));
  }
  return box;
}
