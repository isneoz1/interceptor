/* Vue « Synthese » — agregats de la capture — SWIFT (by NeoZ)
 *
 * Tous les chiffres sont calcules a partir des enregistrements reels du
 * perimetre choisi. Aucune estimation, aucune extrapolation : si une donnee
 * n a pas ete capturee, elle n apparait pas.
 */
import { $, el, clear, sec, button, vide } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { bytes, ms, clock, middle, typeLabel } from '../lib/format.js';
import { state, inScope, copy, cmd } from '../app.js';

const TOP = 15;

/* La derniere mesure de compression, gardee tant que le perimetre ne change
   pas : la vue se redessine, la mesure n a pas a etre refaite. */
let mesure = null;

function scoped() {
  const out = [];
  for (const id of state.order) {
    const rec = state.records.get(id);
    if (rec && inScope(rec)) out.push(rec);
  }
  return out;
}

function tally(list, keyOf, valueOf) {
  const map = new Map();
  for (const rec of list) {
    const key = keyOf(rec);
    if (key == null || key === '') continue;
    map.set(key, (map.get(key) || 0) + (valueOf ? valueOf(rec) : 1));
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

/** Diagramme a barres horizontales : libelle, barre proportionnelle, valeur. */
function chart(rows, format, toneOf) {
  const max = rows.reduce((m, r) => Math.max(m, r[1]), 0) || 1;
  const box = el('div', { class: 'chart' });
  for (const [label, value] of rows) {
    box.appendChild(el('div', { class: 'lab', text: t(label), title: t(label) }));
    box.appendChild(el('div', { class: 'track' },
      el('div', {
        class: 'fill' + (toneOf ? ' ' + toneOf(label) : ''),
        style: 'width:' + Math.max(2, (value / max) * 100) + '%'
      })));
    box.appendChild(el('div', { class: 'val', text: format ? format(value) : String(value) }));
  }
  return box;
}

/* La couleur d une barre de statut. Un 1xx (101 : ouverture d un WebSocket)
   et une requete en cours ne sont pas des erreurs : ils gardent la couleur
   neutre au lieu du rouge. */
function statusClassOf(label) {
  if (label === 'en cours' || label.startsWith('1')) return '';
  if (label.startsWith('2')) return 's-2';
  if (label.startsWith('3')) return 's-3';
  if (label.startsWith('4')) return 's-4';
  if (label.startsWith('5')) return 's-5';
  return 's-err';
}

function openRecord(id) {
  document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests', id } }));
}

function rankList(title, rows, describe) {
  const box = el('div');
  box.appendChild(sec(title, rows.length ? tp('{n} lignes', { n: rows.length }) : ''));
  if (!rows.length) {
    box.appendChild(el('p', { class: 'note', text: t('Rien a signaler sur ce perimetre.') }));
    return box;
  }
  for (const rec of rows) {
    const line = el('div', { class: 'log', title: rec.url });
    line.appendChild(el('span', { class: 'ts', text: describe(rec) }));
    line.appendChild(el('b', { class: 'm-' + rec.method, text: rec.method }));
    line.appendChild(el('span', { text: middle(rec.host + rec.path, 110) }));
    line.addEventListener('click', () => openRecord(rec.id));
    box.appendChild(line);
  }
  return box;
}

export function render() {
  const pane = clear($('#view-summary'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  const list = scoped();
  box.appendChild(sec('Synthese du perimetre', tp('{n} requetes observees', { n: list.length })));

  if (!list.length) {
    box.appendChild(vide('Rien a resumer',
      'Naviguez sur un site, ou basculez le perimetre sur « Tout Firefox ».'));
    return;
  }

  /* ------------------------------ Chiffres cles --------------------------- */
  const down = list.reduce((n, r) => n + (r.size || 0), 0);
  const up = list.reduce((n, r) => n + (r.reqSize || 0), 0);
  const durations = list.map(r => r.duration).filter(d => d != null).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
  const errors = list.filter(r => r.error || r.statusCode >= 400).length;
  const third = list.filter(r => r.thirdParty).length;
  const hosts = new Set(list.map(r => r.host).filter(Boolean));
  const alerts = list.reduce((n, r) => n + (r.findings || 0), 0);
  const frames = list.reduce((n, r) => n + (r.wsFrames || 0) + (r.sseEvents || 0), 0);
  const cookies = list.reduce((n, r) => n + (r.setCookies || 0), 0);
  const cached = list.filter(r => r.fromCache).length;
  const secure = list.filter(r => r.scheme === 'https' || r.scheme === 'wss').length;

  const tiles = el('div', { class: 'tiles' });
  const tile = (value, label, cls) => tiles.appendChild(el('div', { class: 'tile' + (cls ? ' ' + cls : '') }, [
    el('b', { text: String(value) }), el('label', { text: t(label) })
  ]));
  tile(list.length, 'requetes');
  tile(hosts.size, 'domaines');
  tile(bytes(down), 'recu');
  tile(bytes(up), 'envoye');
  tile(median != null ? ms(median) : '—', 'duree mediane');
  tile(errors, 'en erreur', errors ? 'alert hot' : 'ok');
  tile(alerts, 'alertes', alerts ? 'alert' : 'ok');
  tile(Math.round((third / list.length) * 100) + ' %', 'tierces');
  tile(Math.round((secure / list.length) * 100) + ' %', 'chiffrees', secure === list.length ? 'ok' : 'alert');
  tile(cached, 'depuis le cache');
  tile(frames, 'trames et messages');
  tile(cookies, 'cookies poses');
  box.appendChild(tiles);

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Copier la synthese', () => copy(textSummary(list), 'Synthese copiee')));
  actions.appendChild(button('Voir les alertes', () =>
    document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'alerts' } }))));
  actions.appendChild(button('Voir le diagnostic', () =>
    document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'stats' } }))));
  box.appendChild(actions);

  /* -------------------------------- Diagrammes ---------------------------- */
  const cols = el('div', { class: 'cols2' });
  box.appendChild(cols);

  const left = el('div');
  cols.appendChild(left);

  left.appendChild(sec('Statuts'));
  left.appendChild(chart(
    tally(list, r => (r.error ? 'erreur reseau' : r.statusCode == null ? 'en cours' : String(r.statusCode))),
    null, statusClassOf));

  left.appendChild(sec('Types de ressource'));
  left.appendChild(chart(tally(list, r => typeLabel(r.type))));

  left.appendChild(sec('Protocoles observes'));
  left.appendChild(chart(tally(list, r => r.protocol
    || (r.scheme ? tp('{s} (protocole non mesure)', { s: r.scheme }) : null))));

  left.appendChild(sec('Couches de capture'));
  const layers = new Map();
  for (const rec of list) for (const s of rec.sources || []) layers.set(s, (layers.get(s) || 0) + 1);
  left.appendChild(chart([...layers.entries()].sort((a, b) => b[1] - a[1])));

  const right = el('div');
  cols.appendChild(right);

  right.appendChild(sec('Domaines par volume recu'));
  right.appendChild(chart(tally(list, r => r.host, r => r.size || 0).slice(0, TOP), bytes));

  right.appendChild(sec('Domaines par nombre de requetes'));
  right.appendChild(chart(tally(list, r => r.host).slice(0, TOP)));

  const enErreur = tally(list.filter(r => r.error || r.statusCode >= 400), r => r.host).slice(0, TOP);
  if (enErreur.length) {
    right.appendChild(sec('Domaines en erreur'));
    right.appendChild(chart(enErreur, null, () => 's-5'));
  }

  right.appendChild(sec('Types de contenu'));
  right.appendChild(chart(tally(list, r => r.mime).slice(0, TOP)));

  right.appendChild(sec('Marqueurs de l analyse'));
  const tags = new Map();
  for (const rec of list) for (const marqueur of rec.tags || []) tags.set(marqueur, (tags.get(marqueur) || 0) + 1);
  const tagRows = [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP);
  right.appendChild(tagRows.length ? chart(tagRows)
    : el('p', { class: 'note', text: t('Aucun marqueur pose sur ce perimetre.') }));

  /* ------------------------------- Debit ---------------------------------- */
  const first = Math.min(...list.map(r => r.startTime || Date.now()));
  const last = Math.max(...list.map(r => r.startTime || Date.now()));
  const span = Math.max(1000, last - first);
  const buckets = 40;
  const width = span / buckets;
  const counts = new Array(buckets).fill(0);
  for (const rec of list) {
    const i = Math.min(buckets - 1, Math.floor(((rec.startTime || first) - first) / width));
    counts[i]++;
  }
  box.appendChild(sec('Requetes dans le temps',
    tp('{debut}  →  {fin}  ·  {ms} ms par barre',
      { debut: clock(first), fin: clock(last), ms: Math.round(width) })));
  const spark = el('div', { class: 'spark', style: 'width:100%;height:64px' });
  const maxCount = Math.max(...counts, 1);
  for (const n of counts) {
    spark.appendChild(el('i', {
      class: n ? '' : 'zero',
      style: 'height:' + Math.max(2, (n / maxCount) * 100) + '%',
      title: tp('{n} requete(s)', { n })
    }));
  }
  box.appendChild(spark);

  /* ------------------------------ Classements ----------------------------- */
  const slow = list.filter(r => r.duration != null).sort((a, b) => b.duration - a.duration).slice(0, TOP);
  box.appendChild(rankList('Requetes les plus lentes', slow, r => ms(r.duration)));

  const heavy = list.filter(r => r.size).sort((a, b) => b.size - a.size).slice(0, TOP);
  box.appendChild(rankList('Reponses les plus lourdes', heavy, r => bytes(r.size)));

  const risky = list.filter(r => r.findings > 0)
    .sort((a, b) => b.findings - a.findings).slice(0, TOP);
  box.appendChild(rankList('Requetes les plus signalees', risky, r => tp('{n} alerte(s)', { n: r.findings })));

  /* La meme adresse telechargee plusieurs fois depuis le reseau, avec succes :
     un fait, qui peut etre voulu (un sondage) ou un cache qui manque. */
  const repetees = new Map();
  for (const rec of list) {
    if (rec.method !== 'GET' || rec.fromCache || rec.error || !(rec.statusCode >= 200 && rec.statusCode < 300)) continue;
    const deja = repetees.get(rec.url);
    if (deja) { deja.n++; deja.total += rec.size || 0; }
    else repetees.set(rec.url, { ...rec, n: 1, total: rec.size || 0 });
  }
  const doublons = [...repetees.values()].filter(x => x.n > 1).sort((a, b) => b.total - a.total || b.n - a.n).slice(0, TOP);
  box.appendChild(rankList('Memes adresses telechargees plusieurs fois', doublons,
    x => tp('{n} fois · {taille}', { n: x.n, taille: bytes(x.total) })));
  box.appendChild(blocCompression(list));
}

/* Ce que gzip ferait des textes servis sans compression : mesure a la demande,
   parce qu elle compresse reellement chaque corps dans le noyau. */
function blocCompression(list) {
  const box = el('div');
  box.appendChild(sec('Compression possible', t('mesuree sur les octets recus')));
  const cle = list.length + ':' + (list.length ? list[list.length - 1].id : '');
  const zone = el('div');
  const montrer = res => {
    clear(zone);
    if (!res || res.error) {
      zone.appendChild(el('p', { class: 'note ko', text: res && res.error ? te(res.error) : t('mesure impossible') }));
      return;
    }
    if (!res.mesurees) {
      zone.appendChild(el('p', { class: 'note ok', text: t('Aucune reponse texte d au moins un kilo-octet servie sans compression.') }));
      return;
    }
    zone.appendChild(el('p', { class: 'note', text: tp('{n} reponse(s) texte servies sans compression : {avant} ; en gzip, {apres} — {gain} % de moins.', {
      n: res.mesurees, avant: bytes(res.avant), apres: bytes(res.apres),
      gain: Math.round((1 - res.apres / res.avant) * 100)
    }) }));
    zone.appendChild(rankList('Les plus grosses economies', res.lignes,
      l => tp('{avant} → {apres}', { avant: bytes(l.avant), apres: bytes(l.apres) })));
  };
  if (mesure && mesure.cle === cle) montrer(mesure.resultat);
  else {
    zone.appendChild(el('p', { class: 'note', text: t('Compresse en gzip chaque reponse texte servie sans compression, pour dire ce qu elle aurait pese.') }));
    zone.appendChild(el('div', { class: 'actions' }, button('Mesurer', async () => {
      clear(zone);
      zone.appendChild(el('p', { class: 'note', text: t('Mesure en cours…') }));
      const res = await cmd('mesurerCompressions', { ids: list.map(r => r.id) });
      mesure = { cle, resultat: res };
      montrer(res);
    })));
  }
  box.appendChild(zone);
  return box;
}

function textSummary(list) {
  const down = list.reduce((n, r) => n + (r.size || 0), 0);
  const hosts = new Set(list.map(r => r.host).filter(Boolean));
  const errors = list.filter(r => r.error || r.statusCode >= 400).length;
  const alerts = list.reduce((n, r) => n + (r.findings || 0), 0);
  const lines = [
    t('SWIFT — synthese'),
    tp('Requetes : {n}', { n: list.length }),
    tp('Domaines : {n}', { n: hosts.size }),
    tp('Recu : {n}', { n: bytes(down) }),
    tp('En erreur : {n}', { n: errors }),
    tp('Alertes : {n}', { n: alerts }),
    '',
    t('Domaines par volume :')
  ];
  for (const [host, value] of tally(list, r => r.host, r => r.size || 0).slice(0, TOP)) {
    lines.push('  ' + host + '  ' + bytes(value));
  }
  return lines.join('\n');
}
