/* Vue « Regles » — interception active — SWIFT (by D4RK)
 *
 * Editeur visuel : chaque regle se construit avec des champs et des boutons.
 * Le mode JSON reste disponible pour les cas avances et les copier-coller.
 */
import { $, el, clear, sec, button, boutonConfirme, vide } from '../lib/dom.js';
import { redessinerEnPlace } from '../lib/redessin.js';
import { t, tp, te } from '../lib/i18n.js';
import { RESOURCE_TYPES, DEBIT_PAR_DEFAUT_KO, debitKo } from '../lib/format.js';
import { state, toast, saveConfig, copy } from '../app.js';
import { octetsVersBase64 } from '../lib/bytes.js';

const ACTIONS = [
  ['block', 'Bloquer la requete'],
  ['redirect', 'Rediriger vers une autre URL'],
  ['upgrade', 'Forcer le HTTPS'],
  ['modifyHeaders', 'Modifier les entetes'],
  ['modifyQuery', 'Modifier les parametres d URL'],
  ['mock', 'Simuler la reponse'],
  ['delay', 'Retarder la requete'],
  ['throttle', 'Limiter le debit de la reponse'],
  ['replaceBody', 'Chercher-remplacer dans la reponse']
];

/* Une reponse simulee vit dans les reglages : un fichier plus gros les
   alourdirait a chaque enregistrement. */
const FICHIER_MAX_OCTETS = 5 * 1024 * 1024;

/* Le texte d un fichier, s il redonne exactement ses octets une fois reecrit
   en UTF-8 — UTF-8 valide, sans BOM ni octet nul —, sinon null : un fichier
   Latin-1, un document Office ou une image partent en base64, octet pour
   octet. Juger sur le type annonce corrompait un .xlsx (« xml » dans son
   type) ou un texte Latin-1 (« é » devenait U+FFFD). */
export function texteExact(octets) {
  if (octets.length >= 3 && octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf) return null;
  if (octets.includes(0)) return null;
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(octets); } catch { return null; }
}

/* Ce que la carte affiche par defaut, ecrit dans la regle des le choix de
   l action : le moteur fait ce que la carte montre. */
function defautsDeLAction(action, rule) {
  if (action === 'throttle' && !rule.throttle) return { throttle: { koParSeconde: DEBIT_PAR_DEFAUT_KO } };
  if (action === 'mock' && !rule.mock) return { mock: { contentType: 'text/plain; charset=utf-8', body: '' } };
  return {};
}

/** Le nombre d octets que la page recevra d une reponse simulee. */
function octetsDuMock(mock) {
  if (!mock) return 0;
  if (mock.base64) {
    const net = String(mock.base64).replace(/\s+/g, '');
    return Math.floor(net.length * 3 / 4) - (net.endsWith('==') ? 2 : net.endsWith('=') ? 1 : 0);
  }
  return new TextEncoder().encode(String(mock.body || '')).length;
}

const METHODS = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/* Les modeles proposes en un clic. Ceux qui reprennent un outil de Charles
   en reproduisent exactement la documentation officielle. */
export const PRESETS = [
  {
    label: 'Bloquer la telemetrie courante',
    rule: () => ({
      id: uid('bloquer-telemetrie'), enabled: true, name: t('Bloquer la telemetrie'),
      match: { urlRegex: 'google-analytics\\.com|googletagmanager\\.com|doubleclick\\.net|facebook\\.net|hotjar\\.com' },
      action: 'block'
    })
  },
  {
    label: 'Bloquer les images d un domaine',
    rule: () => ({
      id: uid('bloquer-images'), enabled: false, name: t('Bloquer les images'),
      match: { host: 'example.com', type: 'image' }, action: 'block'
    })
  },
  {
    label: 'Rediriger un domaine vers un autre',
    rule: () => ({
      id: uid('redirection'), enabled: false, name: t('Redirection de test'),
      match: { urlRegex: '^https://api\\.example\\.com/(.*)$' },
      action: 'redirect', redirectUrl: 'https://api-staging.example.com/$1'
    })
  },
  {
    label: 'Imposer un User-Agent',
    rule: () => ({
      id: uid('user-agent'), enabled: false, name: t('User-Agent impose'),
      match: { host: 'example.com' }, action: 'modifyHeaders',
      requestHeaders: [{ name: 'User-Agent', value: 'SWIFT', op: 'set' }]
    })
  },
  {
    label: 'Forcer le HTTPS sur un domaine',
    rule: () => ({
      id: uid('https'), enabled: false, name: t('Forcer le HTTPS'),
      match: { host: 'example.com' }, action: 'upgrade'
    })
  },
  {
    label: 'Simuler une reponse JSON',
    rule: () => ({
      id: uid('simulation'), enabled: false, name: t('Reponse simulee'),
      match: { urlRegex: '/api/statut' }, action: 'mock',
      mock: { contentType: 'application/json; charset=utf-8', body: t('{"statut":"simule par SWIFT"}') }
    })
  },
  {
    label: 'Retirer une entete de reponse',
    rule: () => ({
      id: uid('retirer-entete'), enabled: false, name: t('Retirer Content-Security-Policy'),
      match: { host: 'example.com' }, action: 'modifyHeaders',
      responseHeaders: [{ name: 'Content-Security-Policy', value: '', op: 'remove' }]
    })
  },
  /* « The If-Modified-Since and If-None-Match headers are removed from
     requests, Pragma: no-cache and Cache-control: no-cache are added. The
     Expires, Last-Modified and ETag headers are removed from responses and
     Expires: 0 and Cache-Control: no-cache are added. » — Charles. */
  {
    label: 'Desactiver le cache (outil « No Caching » de Charles)',
    rule: () => ({
      id: uid('sans-cache'), enabled: false, name: t('Sans cache'), match: { host: 'example.com' },
      action: 'modifyHeaders',
      requestHeaders: [
        { name: 'If-Modified-Since', value: '', op: 'remove' }, { name: 'If-None-Match', value: '', op: 'remove' },
        { name: 'Pragma', value: 'no-cache', op: 'set' }, { name: 'Cache-Control', value: 'no-cache', op: 'set' }],
      responseHeaders: [
        { name: 'Expires', value: '', op: 'remove' }, { name: 'Last-Modified', value: '', op: 'remove' },
        { name: 'ETag', value: '', op: 'remove' },
        { name: 'Expires', value: '0', op: 'set' }, { name: 'Cache-Control', value: 'no-cache', op: 'set' }]
    })
  },
  /* « The Cookie header is removed from requests [...] The Set-Cookie header
     is removed from responses » — Charles. Un cookie ecrit en JavaScript
     (document.cookie) ne passe pas par Set-Cookie : il est stocke, mais le
     retrait de Cookie l empeche de partir. */
  {
    label: 'Bloquer les cookies (outil « Block Cookies » de Charles)',
    rule: () => ({
      id: uid('sans-cookies'), enabled: false, name: t('Sans cookies'), match: { host: 'example.com' },
      action: 'modifyHeaders',
      requestHeaders: [{ name: 'Cookie', value: '', op: 'remove' }],
      responseHeaders: [{ name: 'Set-Cookie', value: '', op: 'remove' }]
    })
  },
  {
    label: 'Limiter le debit d un domaine (outil « Throttle » de Charles)',
    rule: () => ({
      id: uid('debit'), enabled: false, name: t('Debit limite'), match: { host: 'example.com' },
      action: 'throttle', throttle: { koParSeconde: 50 }
    })
  },
  {
    label: 'Ajouter un parametre a l URL',
    rule: () => ({
      id: uid('parametre'), enabled: false, name: t('Parametre de debogage'), match: { host: 'example.com' },
      action: 'modifyQuery', query: [{ name: 'debug', value: '1', op: 'set' }]
    })
  },
  {
    label: 'Retirer les parametres de suivi (utm_*, fbclid, gclid)',
    rule: () => ({
      id: uid('sans-suivi'), enabled: false, name: t('Sans parametres de suivi'), match: {},
      action: 'modifyQuery',
      query: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
        .map(name => ({ name, value: '', op: 'remove' }))
    })
  }
];

let jsonMode = false;
let saveTimer = null;

function uid(base) { return base + '-' + Math.random().toString(36).slice(2, 7); }

function rules() { return [...((state.config && state.config.rules) || [])]; }

function commit(list, message) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const config = await saveConfig({ rules: list });
    if (config && message) toast(message);
    render();
  }, 120);
  if (state.config) state.config.rules = list;
}

/* Chaque regle enregistree redessine la vue, et la configuration diffusee en
   retour aussi : redessinerEnPlace garde le champ ou l on tape, ce qui y est
   tape, la position du lecteur, et le clic en cours. Chaque champ porte un
   nom stable (dataset.champ), lie a sa regle. */
export function render() { redessinerEnPlace($('#view-rules'), dessiner); }

function dessiner() {
  const pane = clear($('#view-rules'));
  const box = el('div', { class: 'pane narrow' });
  pane.appendChild(box);
  const config = state.config;
  if (!config) { box.appendChild(el('p', { class: 'note', text: t('Chargement…') })); return; }

  const list = rules();
  const stats = state.stats && state.stats.rules;

  box.appendChild(sec('Interception active', tp('{n} regle(s)', { n: list.length })));
  box.appendChild(el('p', { class: 'note warn', text: t(
    'Par defaut SWIFT observe sans jamais modifier le trafic. Activer le moteur autorise le blocage, la redirection, la reecriture d entetes et de parametres d URL, les reponses simulees et le debit limite. A n utiliser que sur des cibles dont vous avez la responsabilite.') }));

  /* Interrupteur principal */
  const master = el('div', { class: 'opt' }, [
    el('div', { class: 'lbl' }, [
      t('Moteur de regles actif'),
      el('i', { text: t('Desactive, aucune regle n est evaluee : les regles restent enregistrees.') })
    ]),
    el('div', { class: 'ctl' })
  ]);
  const masterInput = el('input', { type: 'checkbox', dataset: { champ: 'regles-moteur' } });
  masterInput.checked = !!config.rulesEnabled;
  masterInput.addEventListener('change', async () => {
    await saveConfig({ rulesEnabled: masterInput.checked });
    toast(t(masterInput.checked ? 'Moteur de regles ACTIF' : 'Moteur de regles arrete'));
    render();
  });
  master.querySelector('.ctl').appendChild(masterInput);
  box.appendChild(master);

  if (stats) {
    box.appendChild(el('p', { class: 'note', text:
      tp('Depuis le demarrage : {e} evaluations, {b} blocages, {r} redirections, {h} entetes modifies.', {
        e: stats.evaluated, b: stats.blocked, r: stats.redirected, h: stats.headersModified }) }));
  }

  /* Barre d actions */
  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Ajouter une regle', () => {
    commit([...rules(), { id: uid('regle'), enabled: false, name: t('Nouvelle regle'), match: {}, action: 'block' }], 'Regle ajoutee');
  }, { class: 'accent' }));
  for (const preset of PRESETS) {
    actions.appendChild(button(preset.label, () => commit([...rules(), preset.rule()], 'Modele ajoute'), { class: 'sm' }));
  }
  box.appendChild(actions);

  const actions2 = el('div', { class: 'actions' });
  actions2.appendChild(button(jsonMode ? 'Editeur visuel' : 'Mode JSON', () => { jsonMode = !jsonMode; render(); }));
  actions2.appendChild(button('Copier les regles', () => copy(JSON.stringify(list, null, 2), 'Regles copiees')));
  const wipe = boutonConfirme('regles-tout-supprimer', 'Tout supprimer', 'Confirmer ?',
    () => commit([], 'Toutes les regles supprimees'), { class: 'danger' });
  actions2.appendChild(wipe);
  box.appendChild(actions2);

  if (jsonMode) { box.appendChild(jsonEditor(list)); return; }

  if (!list.length) {
    box.appendChild(vide('Aucune regle',
      'Ajoutez une regle vierge, ou partez d un des modeles ci-dessus.'));
    return;
  }
  list.forEach((rule, index) => box.appendChild(ruleCard(rule, index, list)));
}

/* ------------------------------- Une regle -------------------------------- */
function ruleCard(rule, index, list) {
  const card = el('div', { class: 'rule' + (rule.enabled ? ' on' : ' off') });
  /* L index et l identifiant : deux regles au meme identifiant (un JSON
     colle) gardent chacune leurs champs. */
  const nom = suffixe => 'regle-' + index + '-' + (rule.id || '') + '-' + suffixe;
  const update = (patch, message) => {
    const next = list.map((r, i) => (i === index ? { ...r, ...patch } : r));
    commit(next, message);
  };
  const updateMatch = patch => update({ match: { ...(rule.match || {}), ...patch } });

  /* En-tete : activation, nom, deplacement, suppression */
  const head = el('div', { class: 'rule-head' });
  const enabled = el('input', { type: 'checkbox', title: t('Activer cette regle'), dataset: { champ: nom('active') } });
  enabled.checked = !!rule.enabled;
  enabled.addEventListener('change', () => update({ enabled: enabled.checked }));
  head.appendChild(enabled);

  const name = el('input', { type: 'text', class: 'field name', value: rule.name || '', placeholder: t('Nom de la regle'),
    dataset: { champ: nom('nom') } });
  name.addEventListener('change', () => update({ name: name.value }));
  head.appendChild(name);

  head.appendChild(button('↑', () => {
    if (index === 0) return;
    const next = [...list];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    commit(next);
  }, { class: 'sm', title: 'Monter (les regles sont evaluees dans l ordre)' }));
  head.appendChild(button('↓', () => {
    if (index >= list.length - 1) return;
    const next = [...list];
    [next[index + 1], next[index]] = [next[index], next[index + 1]];
    commit(next);
  }, { class: 'sm', title: 'Descendre' }));
  head.appendChild(button('Dupliquer', () => {
    const copyRule = { ...rule, id: uid(rule.id.replace(/-[a-z0-9]{5}$/, '')), name: tp('{nom} (copie)', { nom: rule.name || t('Regle') }) };
    const next = [...list];
    next.splice(index + 1, 0, copyRule);
    commit(next, 'Regle dupliquee');
  }, { class: 'sm' }));
  head.appendChild(button('Supprimer', () => {
    commit(list.filter((_, i) => i !== index), 'Regle supprimee');
  }, { class: 'sm danger' }));
  card.appendChild(head);

  /* Conditions */
  const match = rule.match || {};
  const grid = el('div', { class: 'rule-grid' });
  grid.appendChild(labelled('Hote contient', textInput(match.host, v => updateMatch({ host: v || undefined }), 'example.com', nom('hote'))));
  grid.appendChild(labelled('URL (expression reguliere)', textInput(match.urlRegex, v => updateMatch({ urlRegex: v || undefined }), '^https://api\\.', nom('url'))));
  grid.appendChild(labelled('Methode', selectInput(METHODS.map(m => [m, m || 'toutes']), match.method || '', v => updateMatch({ method: v || undefined }), nom('methode'))));
  grid.appendChild(labelled('Type de ressource', selectInput([['', 'tous']].concat(RESOURCE_TYPES.map(t => [t, t])), match.type || '', v => updateMatch({ type: v || undefined }), nom('type'))));
  grid.appendChild(labelled('Action', selectInput(ACTIONS, rule.action || 'block', v => update({ action: v, ...defautsDeLAction(v, rule) }), nom('action'))));
  if (rule.action === 'redirect') {
    grid.appendChild(labelled('Rediriger vers ($1 = groupe capture)',
      textInput(rule.redirectUrl, v => update({ redirectUrl: v }), 'https://…', nom('redirection'))));
  }
  card.appendChild(grid);

  if (rule.action === 'mock') {
    const mock = rule.mock || {};
    const panel = el('div', { class: 'hops' });
    panel.appendChild(sec('Reponse simulee', 'le corps reel du serveur reste enregistre'));
    panel.appendChild(labelled('Type de contenu',
      textInput(mock.contentType, v => update({ mock: { ...mock, contentType: v } }), 'application/json; charset=utf-8', nom('mock-type'))));
    if (mock.base64) {
      panel.appendChild(el('p', { class: 'note', text: tp('Contenu binaire charge depuis « {fichier} » : la page recevra ces {n} octets.',
        { fichier: mock.fichier || '?', n: octetsDuMock(mock) }) }));
      panel.appendChild(button('Revenir a un texte', () => update({ mock: { ...mock, base64: undefined, fichier: undefined, body: '' } }), { class: 'sm' }));
    } else {
      const body = el('textarea', { class: 'field', spellcheck: 'false', rows: '5', dataset: { champ: nom('mock-corps') } });
      body.value = mock.body || '';
      body.addEventListener('change', () => update({ mock: { ...mock, body: body.value } }));
      panel.appendChild(el('label', {}, [t('Corps servi a la page'), body]));
    }
    /* « Map Local » : le corps vient d un fichier, et la page en recoit les
       octets exacts. Un texte UTF-8 reste modifiable ; tout le reste part en
       base64. Sans type connu, le fichier est servi en
       application/octet-stream, jamais avec le type du contenu precedent. */
    const fichier = el('input', { type: 'file', hidden: true });
    fichier.addEventListener('change', async () => {
      const choisi = fichier.files && fichier.files[0];
      if (!choisi) return;
      if (choisi.size > FICHIER_MAX_OCTETS) {
        toast(tp('Fichier trop gros : {n} octets, 5 Mo au plus', { n: choisi.size }), false);
        return;
      }
      const type = choisi.type || 'application/octet-stream';
      try {
        const octets = new Uint8Array(await choisi.arrayBuffer());
        const texte = texteExact(octets);
        update({ mock: { ...mock, contentType: type, fichier: choisi.name,
          ...(texte != null ? { body: texte, base64: undefined } : { body: '', base64: octetsVersBase64(octets) }) } }, 'Fichier charge');
      } catch (e) { toast(te(e), false); }
    });
    panel.appendChild(fichier);
    panel.appendChild(button('Charger depuis un fichier…', () => fichier.click(), { class: 'sm' }));
    panel.appendChild(el('p', { class: 'note', text:
      t('Le code de statut d origine est conserve : Firefox ne permet pas de le reecrire depuis une extension.') }));
    card.appendChild(panel);
  }

  if (rule.action === 'delay') {
    const panel = el('div', { class: 'hops' });
    panel.appendChild(sec('Latence injectee', 'plafonnee a 30 000 ms'));
    const champ = el('input', { type: 'number', class: 'field', min: '0', max: '30000',
      value: String(rule.delayMs || 0), dataset: { champ: nom('delai') } });
    champ.addEventListener('change', () => {
      const ms = Math.max(0, Math.min(30000, Number(champ.value) || 0));
      champ.value = String(ms);
      update({ delayMs: ms });
    });
    panel.appendChild(el('label', {}, [t('Attente avant emission (ms)'), champ]));
    panel.appendChild(el('p', { class: 'note', text:
      t('La requete part normalement, mais plus tard : de quoi reproduire un reseau lent sans rien changer d autre.') }));
    card.appendChild(panel);
  }

  if (rule.action === 'throttle') {
    const panel = el('div', { class: 'hops' });
    panel.appendChild(sec('Debit de la reponse', 'comme l outil « Throttle » de Charles'));
    const champ = el('input', { type: 'number', class: 'field', min: '1', max: '100000', step: '1',
      value: String(debitKo(rule)), dataset: { champ: nom('debit') } });
    champ.addEventListener('change', () => {
      const ko = Math.max(1, Math.min(100000, Number(champ.value) || DEBIT_PAR_DEFAUT_KO));
      champ.value = String(ko);
      update({ throttle: { koParSeconde: ko } });
    });
    panel.appendChild(el('label', {}, [t('Debit (ko/s, 1 ko = 1 000 octets)'), champ]));
    panel.appendChild(el('p', { class: 'note', text:
      t('La page recoit le corps de la reponse a ce debit, comme sur un reseau lent ; SWIFT, lui, l enregistre des son arrivee. Ne s ajoute pas a une simulation ni a un remplacement sur la meme requete.') }));
    card.appendChild(panel);
  }

  if (rule.action === 'replaceBody') {
    const repl = rule.replace || {};
    const panel = el('div', { class: 'hops' });
    panel.appendChild(sec('Chercher-remplacer', 'le corps reel du serveur reste enregistre'));
    panel.appendChild(labelled('Chercher (expression reguliere)',
      textInput(repl.find, v => update({ replace: { ...repl, find: v } }), 'ancien-texte', nom('cherche'))));
    panel.appendChild(labelled('Remplacer par ($1 = groupe capture)',
      textInput(repl.replace, v => update({ replace: { ...repl, replace: v } }), 'nouveau-texte', nom('remplace'))));
    panel.appendChild(labelled('Options',
      textInput(repl.flags || 'g', v => update({ replace: { ...repl, flags: v || 'g' } }), 'g, gi, gm…', nom('options'))));
    panel.appendChild(el('p', { class: 'note', text:
      t('Ne s applique qu aux reponses textuelles non compressees. Dans les autres cas le flux passe intact et la raison est inscrite sur la ligne.') }));
    card.appendChild(panel);
  }

  if (rule.action === 'modifyHeaders') {
    card.appendChild(headerOps('Entetes de requete', rule.requestHeaders || [], ops => update({ requestHeaders: ops }), nom('entetes-requete')));
    card.appendChild(headerOps('Entetes de reponse', rule.responseHeaders || [], ops => update({ responseHeaders: ops }), nom('entetes-reponse')));
  }

  if (rule.action === 'modifyQuery') {
    card.appendChild(headerOps('Parametres d URL', rule.query || [], ops => update({ query: ops }), nom('parametres')));
    card.appendChild(el('p', { class: 'note', text:
      t('La requete est redirigee vers la meme adresse, parametres reecrits ; les autres parametres gardent leur ecriture exacte.') }));
  }

  card.appendChild(el('p', { class: alerteDe(rule) ? 'note warn' : 'note', text: describe(rule) }));
  return card;
}

/** Expression d URL ecrite mais illisible : la regle ne correspondra a rien. */
function motifIllisible(rule) {
  const src = rule.match && rule.match.urlRegex;
  if (!src) return false;
  try { new RegExp(src, 'i'); return false; } catch { return true; }
}

/** Vrai quand la ligne merite d etre lue avant d activer la regle. */
function alerteDe(rule) {
  if (motifIllisible(rule)) return true;
  const m = rule.match || {};
  const sansCondition = !m.host && !m.urlRegex && !m.method && !m.type;
  return sansCondition && (rule.action === 'block' || rule.action === 'redirect');
}

/* La phrase qui dit, en clair, ce que la regle fera.
 *
 * Chaque morceau est un gabarit traduit separement puis assemble : une phrase
 * collee bout a bout a l execution ne correspond a aucune cle, et resterait
 * donc en francais. Or c est precisement le texte sur lequel l operateur se
 * fie avant d activer une regle qui modifie du trafic. */
function describe(rule) {
  if (motifIllisible(rule)) {
    return t('L expression d URL de cette regle est illisible : elle ne correspondra a aucune requete tant qu elle n est pas corrigee.');
  }

  const m = rule.match || {};
  const conditions = [
    m.host ? tp('hote contient « {valeur} »', { valeur: m.host }) : null,
    m.urlRegex ? tp('URL correspond a /{motif}/', { motif: m.urlRegex }) : null,
    m.method ? tp('methode {valeur}', { valeur: m.method }) : null,
    m.type ? tp('type {valeur}', { valeur: m.type }) : null
  ].filter(Boolean);

  const quoi = {
    block: () => t('la requete est bloquee'),
    redirect: () => tp('la requete part vers {url}',
      { url: rule.redirectUrl || t('(URL manquante)') }),
    upgrade: () => t('la requete http est renvoyee en https'),
    mock: () => tp('la page recoit une reponse simulee ({n} octets), le corps reel restant enregistre',
      { n: octetsDuMock(rule.mock) }),
    modifyQuery: () => tp('la requete repart avec ses parametres d URL reecrits : {ops}', {
      ops: (rule.query || []).filter(o => o && o.name).map(o => (o.op === 'remove'
        ? tp('sans {nom}', { nom: o.name }) : o.name + '=' + (o.value ?? ''))).join(', ') || t('(aucun parametre)')
    }),
    delay: () => tp('la requete part avec {n} ms de retard', { n: rule.delayMs || 0 }),
    throttle: () => (debitKo(rule) > 0
      ? tp('la page recoit le corps de la reponse a {n} ko/s', { n: debitKo(rule) })
      : t('aucun debit valide : la regle n agit pas')),
    replaceBody: () => tp('la page recoit le corps du serveur avec « {cherche} » remplace par « {par} »', {
      cherche: (rule.replace && rule.replace.find) || t('(motif manquant)'),
      par: (rule.replace && rule.replace.replace) || ''
    })
  };
  const what = (quoi[rule.action] || (() => t('les entetes sont reecrits')))();

  return tp('Si {conditions}, alors {effet}.', {
    conditions: conditions.length
      ? conditions.join(t(' ET '))
      : t('AUCUNE condition (toutes les requetes)'),
    effet: what
  });
}

function labelled(text, control) { return el('label', {}, [t(text), control]); }

function textInput(value, onChange, placeholder, champ) {
  const input = el('input', { type: 'text', class: 'field', value: value || '', placeholder: placeholder || '',
    dataset: { champ } });
  input.addEventListener('change', () => onChange(input.value.trim()));
  return input;
}

function selectInput(options, value, onChange, champ) {
  const select = el('select', { class: 'field', dataset: { champ } });
  for (const [v, label] of options) {
    select.appendChild(el('option', { value: v, text: t(label), selected: v === value }));
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function headerOps(title, ops, onChange, champ) {
  const box = el('div', { class: 'hops' });
  box.appendChild(sec(title, tp('{n} operation(s)', { n: ops.length })));
  ops.forEach((op, i) => {
    const row = el('div', { class: 'hop' });
    row.appendChild(selectInput([['set', 'Definir'], ['remove', 'Retirer']], op.op || 'set',
      v => onChange(ops.map((o, j) => (j === i ? { ...o, op: v } : o))), champ + '-' + i + '-op'));
    row.appendChild(textInput(op.name, v => onChange(ops.map((o, j) => (j === i ? { ...o, name: v } : o))), 'Nom', champ + '-' + i + '-nom'));
    if ((op.op || 'set') === 'set') {
      row.appendChild(textInput(op.value, v => onChange(ops.map((o, j) => (j === i ? { ...o, value: v } : o))), 'Valeur', champ + '-' + i + '-valeur'));
    }
    row.appendChild(button('✕', () => onChange(ops.filter((_, j) => j !== i)), { class: 'sm danger' }));
    box.appendChild(row);
  });
  box.appendChild(button('Ajouter une operation', () => onChange([...ops, { name: '', value: '', op: 'set' }]), { class: 'sm' }));
  return box;
}

/* ------------------------------- Mode JSON -------------------------------- */
function jsonEditor(list) {
  const box = el('div');
  box.appendChild(sec('Regles au format JSON', 'tableau'));
  const area = el('textarea', { class: 'field', spellcheck: 'false', rows: '20', dataset: { champ: 'regles-json' } });
  area.value = JSON.stringify(list, null, 2);
  const status = el('p', { class: 'note', text: tp('{n} regle(s) enregistree(s).', { n: list.length }) });

  area.addEventListener('change', () => {
    let parsed;
    try {
      parsed = JSON.parse(area.value || '[]');
      if (!Array.isArray(parsed)) throw new Error('un tableau est attendu');
    } catch (e) {
      status.className = 'note ko';
      status.textContent = tp('JSON invalide : {raison}', { raison: te(e) });
      return;
    }
    status.className = 'note ok';
    status.textContent = tp('{n} regle(s) enregistree(s).', { n: parsed.length });
    commit(parsed, 'Regles enregistrees');
  });

  box.appendChild(area);
  box.appendChild(status);
  return box;
}
