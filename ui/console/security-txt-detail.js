/* security.txt dans le panneau de detail — SWIFT (by NeoZ)
 *
 * Quand la ligne est un fichier security.txt, l onglet Reponse le montre
 * champ par champ et le confronte a la RFC 9116, au moment de la capture.
 * La lecture vit dans ui/lib/security-txt.js.
 */
import { el, frag, kv, sec, add } from '../lib/dom.js';
import { tp } from '../lib/i18n.js';
import { lireSecurityTxt, faitsSecurityTxt, emplacementSecurityTxt } from '../lib/security-txt.js';

const TONS = {
  sansContact: 'ko', sansExpires: 'ko', expiresMultiple: 'ko', expiresIllisible: 'ko', perime: 'warn',
  plusDunAn: 'warn', langueMultiple: 'warn', contactHttp: 'warn', canonicalHttp: 'warn',
  horsCanonical: 'warn', nonHttps: 'ko', typeContenu: 'warn', horsWellKnown: 'warn', signe: 'ok'
};

/** Le bloc security.txt de l onglet Reponse. */
export function securityTxtReponse(rec) {
  const box = frag();
  const url = rec.finalUrl || rec.url;
  if (!emplacementSecurityTxt(url) || !(rec.statusCode >= 200 && rec.statusCode < 300)) return box;
  const corps = rec.responseBody;
  const lu = lireSecurityTxt(corps && typeof corps.text === 'string' ? corps.text : '');
  if (!lu) return box;
  box.appendChild(sec('security.txt (RFC 9116)', tp('{n} champ(s)', { n: lu.champs.length })));
  for (const f of faitsSecurityTxt(lu, { url, typeMedia: rec.mime, maintenant: rec.startTime || Date.now() })) {
    box.appendChild(el('p', { class: 'note ' + (TONS[f.cle] || ''), text: '•  ' + tp(f.texte, f.valeurs) }));
  }
  for (const c of lu.champs) add(box, kv(c.nom, c.valeur, { copy: true }));
  return box;
}
