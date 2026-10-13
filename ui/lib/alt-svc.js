/* Services alternatifs (Alt-Svc) — SWIFT (by NeoZ)
 *
 * RFC 7838 : un serveur annonce qu il est aussi joignable autrement — le plus
 * souvent en HTTP/3 sur le meme port :
 *
 *   Alt-Svc: h3=":443"; ma=86400, h2=":443"
 *
 *   Alt-Svc = clear / 1#alt-value
 *   alt-value = protocol-id "=" alt-authority *( ";" parameter )
 *   protocol-id   identifiant ALPN, pourcent-encode (section 3)
 *   alt-authority chaine entre guillemets : [hote] ":" port
 *   ma            duree de validite en secondes, 24 h par defaut (3.1),
 *                 comptee depuis la creation de la reponse : l Age s en deduit
 *   persist=1     garder l annonce apres un changement de reseau (3.1)
 *   clear         oublier toutes les annonces de cette origine
 * L ordre dit la preference du serveur, la premiere d abord.
 */

export const FAITS_ALTSVC = {
  clear: 'clear : le serveur demande d oublier tous les services alternatifs connus pour cette origine',
  valide: 'valable encore {duree}',
  expire: 'deja perimee a la reception',
  persiste: 'a garder meme apres un changement de reseau (persist=1)',
  age: 'la validite se compte depuis la creation de la reponse : l Age de {age} s s en deduit (RFC 7838 §3.1)',
  deja: 'cette reponse est arrivee en {proto} : l alternative preferee est deja employee',
  autre: 'cette reponse est arrivee en {proto} ; le serveur prefere {alpn} pour les suivantes',
  illisible: 'texte illisible a partir de « {reste} » : la lecture s arrete la (RFC 7838 §3)',
  clearEtValeurs: 'clear accompagne d autres valeurs : tout est a oublier, y compris ces valeurs (RFC 7838 §3)'
};

/* Les identifiants ALPN enregistres que l on rencontre ici. */
export const ALPN_CONNUS = Object.assign(Object.create(null), {
  'h3': 'HTTP/3 (RFC 9114)',
  'h2': 'HTTP/2 (RFC 9113)',
  'http/1.1': 'HTTP/1.1 (RFC 9112)'
});

const UNE_JOURNEE = 86400;

function decoderAlpn(id) {
  try { return decodeURIComponent(id); } catch { return id; }
}

function chaine(s, i) {
  let sortie = '';
  i++;
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length) { sortie += s[i + 1]; i += 2; continue; }
    if (s[i] === '"') return [sortie, i + 1];
    sortie += s[i++];
  }
  return [null, i];
}

/**
 * @param options.age         valeur de l en-tete Age, en secondes
 * @param options.protocole   protocole de la reponse, en identifiant ALPN (nextHopProtocol)
 * @returns null sans en-tete, sinon { clear, services, faits }
 *   services : [{ alpn, hote, port, ma, maExplicite, reste, persist, parametres }]
 *   `reste` : secondes de validite a la reception, Age deduit.
 */
export function lireAltSvc(entetes, options = {}) {
  const valeurs = (entetes || []).filter(h => h && String(h.name || '').toLowerCase() === 'alt-svc')
    .map(h => String(h.value ?? ''));
  if (!valeurs.length) return null;
  const faits = [];
  const dire = (cle, v = {}) => faits.push({ cle, texte: FAITS_ALTSVC[cle], valeurs: v });
  const services = [];
  let clear = false;

  for (const s of valeurs) {
    let i = 0;
    while (i < s.length) {
      while (i < s.length && /[ \t,]/.test(s[i])) i++;
      if (i >= s.length) break;
      const debut = i;
      let id = '';
      while (i < s.length && !/[=,; \t]/.test(s[i])) id += s[i++];
      if (id === 'clear' && (i >= s.length || /[ \t,]/.test(s[i]))) { clear = true; continue; }
      if (!id || s[i] !== '=' || s[i + 1] !== '"') { dire('illisible', { reste: s.slice(debut, debut + 24) }); break; }
      let autorite;
      [autorite, i] = chaine(s, i + 1);
      const m = autorite == null ? null : /^(.*):(\d{1,5})$/.exec(autorite);
      /* Un port TCP ou UDP tient sur seize bits. */
      if (!m || Number(m[2]) > 65535) { dire('illisible', { reste: s.slice(debut, debut + 24) }); break; }
      const parametres = [];
      for (;;) {
        while (i < s.length && /[ \t]/.test(s[i])) i++;
        if (s[i] !== ';') break;
        i++;
        while (i < s.length && /[ \t]/.test(s[i])) i++;
        let nom = '';
        while (i < s.length && !/[=;, \t]/.test(s[i])) nom += s[i++];
        let valeur = '';
        if (s[i] === '=') {
          i++;
          if (s[i] === '"') { let v; [v, i] = chaine(s, i); valeur = v == null ? '' : v; }
          else while (i < s.length && !/[;, \t]/.test(s[i])) valeur += s[i++];
        }
        parametres.push([nom.toLowerCase(), valeur]);
      }
      const ma = parametres.filter(([n]) => n === 'ma').map(([, v]) => v).pop();
      services.push({
        alpn: decoderAlpn(id),
        hote: m[1] || null,
        port: Number(m[2]),
        /* Un ma illisible ne vaut rien : les 24 h par defaut s appliquent. */
        ma: ma != null && /^\d+$/.test(ma) ? Number(ma) : UNE_JOURNEE,
        maExplicite: ma != null && /^\d+$/.test(ma),
        persist: parametres.some(([n, v]) => n === 'persist' && v === '1'),
        parametres
      });
    }
  }

  if (clear && services.length) dire('clearEtValeurs');
  else if (clear) dire('clear');

  const age = Number(options.age) > 0 ? Number(options.age) : 0;
  for (const service of services) service.reste = service.ma - age;
  if (age && services.length) dire('age', { age });
  const premier = services[0];
  if (premier) {
    const proto = String(options.protocole || '').toLowerCase();
    if (proto && !clear) {
      /* L ordre dit la preference : c est la premiere qui compte. */
      if (premier.alpn === proto) dire('deja', { proto });
      else dire('autre', { proto, alpn: premier.alpn });
    }
  }
  return { clear, services, faits };
}
