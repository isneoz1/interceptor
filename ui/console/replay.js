/* Onglet « Rejouer » — INTERCEPTOR (by D4RK)
 *
 * Seule fonction de l extension qui emet volontairement une requete. Elle est
 * desactivee par defaut, s active ici en un clic, et n envoie jamais rien sans
 * un appui explicite sur « Envoyer ».
 */
import { el, clear, frag, kv, sec, add } from '../lib/dom.js';
import { bytes, ms, clock, pretty } from '../lib/format.js';
import { state, cmd, toast, copy, saveConfig } from '../app.js';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function headersToText(list) {
  return (list || []).map(h => h.name + ': ' + h.value).join('\n');
}

function textToHeaders(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const name = line.slice(0, i).trim();
    if (name) out.push({ name, value: line.slice(i + 1).trim() });
  }
  return out;
}

export function replayPanel(rec, onDone) {
  const box = frag();
  const enabled = !!(state.config && state.config.replayEnabled);

  box.appendChild(sec('Rejouer la requete', enabled ? 'active' : 'desactive'));
  box.appendChild(el('p', { class: 'note warn', text:
    'Le rejeu envoie une vraie requete depuis le navigateur, avec vos cookies pour ce site. ' +
    'Elle porte l entete X-Interceptor-Replay et reapparait dans la liste comme une ligne normale. ' +
    'A n utiliser que sur des cibles dont vous avez la responsabilite.' }));

  if (!enabled) {
    const enable = el('button', { class: 'btn accent', type: 'button' }, 'Autoriser le rejeu');
    enable.addEventListener('click', async () => {
      const config = await saveConfig({ replayEnabled: true });
      if (config) { toast('Rejeu autorise'); onDone && onDone(); }
    });
    box.appendChild(el('div', { class: 'actions' }, enable));
    return box;
  }

  const method = el('select', { class: 'field' });
  for (const m of METHODS) method.appendChild(el('option', { value: m, text: m, selected: m === rec.method }));
  if (!METHODS.includes(rec.method)) {
    method.appendChild(el('option', { value: rec.method, text: rec.method, selected: true }));
  }

  const url = el('input', { type: 'text', class: 'field', value: rec.finalUrl || rec.url });
  const headers = el('textarea', { class: 'field', spellcheck: 'false', rows: '7' });
  headers.value = headersToText(rec.requestHeaders);
  const body = el('textarea', { class: 'field', spellcheck: 'false', rows: '5' });
  body.value = (rec.requestBody && rec.requestBody.text) || '';

  const form = el('div', { class: 'rule-grid' }, [
    el('label', {}, ['Methode', method]),
    el('label', { style: 'grid-column: span 2' }, ['URL', url])
  ]);
  box.appendChild(form);
  box.appendChild(sec('Entetes envoyees', 'un entete par ligne, format « Nom: valeur »'));
  box.appendChild(headers);
  box.appendChild(sec('Corps'));
  box.appendChild(body);

  const result = el('div');
  const send = el('button', { class: 'btn accent', type: 'button' }, 'Envoyer');
  const reset = el('button', { class: 'btn', type: 'button' }, 'Restaurer l original');

  reset.addEventListener('click', () => {
    method.value = rec.method;
    url.value = rec.finalUrl || rec.url;
    headers.value = headersToText(rec.requestHeaders);
    body.value = (rec.requestBody && rec.requestBody.text) || '';
    toast('Valeurs d origine restaurees');
  });

  send.addEventListener('click', async () => {
    send.disabled = true;
    send.textContent = 'Envoi…';
    const res = await cmd('replay', {
      id: rec.id,
      overrides: {
        method: method.value,
        url: url.value,
        headers: textToHeaders(headers.value),
        body: body.value || null
      }
    });
    send.disabled = false;
    send.textContent = 'Envoyer';
    if (res.error) { toast(res.error, false); return; }
    toast('Rejeu effectue — statut ' + res.result.status);
    renderResult(result, res.result);
    onDone && onDone();
  });

  box.appendChild(el('div', { class: 'actions' }, [send, reset]));
  box.appendChild(result);

  const runs = (rec.replay && rec.replay.runs) || [];
  if (runs.length) {
    const history = el('div');
    history.appendChild(sec('Rejeux precedents', runs.length));
    for (const run of runs.slice().reverse()) {
      add(history, kv(clock(run.at),
        run.method + ' -> ' + run.status + ' ' + run.statusText + ' · ' + ms(run.duration) + ' · ' + bytes(run.bodySize)));
    }
    box.appendChild(history);
  }
  return box;
}

function renderResult(host, run) {
  clear(host);
  host.appendChild(sec('Resultat du rejeu', run.status + ' ' + run.statusText));
  add(host, kv('Duree', ms(run.duration)));
  add(host, kv('Taille recue', bytes(run.bodySize)));
  if (run.refusedHeaders && run.refusedHeaders.length) {
    add(host, kv('Entetes refuses par le navigateur', run.refusedHeaders.join(', ')));
  }
  host.appendChild(sec('Entetes recues', run.headers.length));
  for (const h of run.headers) add(host, kv(h.name, h.value));

  if (run.body) {
    host.appendChild(sec('Corps recu', run.truncated ? 'tronque' : ''));
    host.appendChild(el('pre', { class: 'pre', text: pretty(run.body, '') }));
    host.appendChild(el('div', { class: 'actions' },
      el('button', { class: 'btn sm', type: 'button', on: { click: () => copy(run.body, 'Reponse copiee') } }, 'Copier la reponse')));
  }
}
