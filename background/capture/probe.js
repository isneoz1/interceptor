/* Verification de couverture — INTERCEPTOR (by NeoZ)
 *
 * Declenche de vraies requetes depuis l onglet actif, uniquement vers l origine
 * de cet onglet (chemins relatifs). Aucun service externe n est contacte.
 * Utilise pour prouver, chiffres a l appui, que la capture ne rate rien.
 */
import { B } from '../lib/util.js';

export const probeStats = { runs: 0, lastUrl: null, lastFired: 0 };

const SOURCE = `(function () {
  var base = location.origin + location.pathname;
  var tag = '?__interceptor_probe=' + Date.now();
  var fired = [];

  try { fetch(base + tag + '&k=fetch-get', { cache: 'no-store' }).catch(function(){}); fired.push('fetch GET'); } catch (e) {}
  try {
    fetch(base + tag + '&k=fetch-post', {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Interceptor-Probe': '1' },
      body: JSON.stringify({ sonde: 'interceptor' })
    }).catch(function(){});
    fired.push('fetch POST + corps');
  } catch (e) {}
  try {
    var x = new XMLHttpRequest();
    x.open('GET', base + tag + '&k=xhr');
    x.setRequestHeader('X-Interceptor-Probe', 'xhr');
    x.send();
    fired.push('XMLHttpRequest');
  } catch (e) {}
  try { var img = new Image(); img.src = base + tag + '&k=image'; fired.push('image'); } catch (e) {}
  try { if (navigator.sendBeacon(base + tag + '&k=beacon', 'ping')) fired.push('sendBeacon'); } catch (e) {}
  try {
    var es = new EventSource(base + tag + '&k=sse');
    setTimeout(function () { try { es.close(); } catch (e) {} }, 3000);
    fired.push('EventSource');
  } catch (e) {}
  try {
    var ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/__interceptor_probe');
    ws.onopen = function () { try { ws.send('sonde interceptor'); } catch (e) {} };
    setTimeout(function () { try { ws.close(); } catch (e) {} }, 3000);
    fired.push('WebSocket');
  } catch (e) {}
  try {
    var s = document.createElement('script');
    s.src = base + tag + '&k=script';
    s.onerror = function () { s.remove(); };
    document.documentElement.appendChild(s);
    fired.push('balise script');
  } catch (e) {}

  return fired;
})();`;

/** Injecte les sondes dans le premier onglet web disponible. */
export async function runProbe() {
  let target = null;
  try {
    const active = await B.tabs.query({ active: true, currentWindow: true });
    if (active && active[0] && /^https?:/.test(active[0].url || '')) target = active[0];
    if (!target) {
      const all = await B.tabs.query({});
      target = all.find(t => /^https?:/.test(t.url || '')) || null;
    }
  } catch (e) {
    return { error: 'impossible de lister les onglets : ' + (e && e.message || e) };
  }

  if (!target) {
    return { error: 'aucun onglet http ou https ouvert — ouvrez un site puis relancez' };
  }

  try {
    const result = await B.tabs.executeScript(target.id, { code: SOURCE, runAt: 'document_idle' });
    const fired = (result && result[0]) || [];
    probeStats.runs++;
    probeStats.lastUrl = target.url;
    probeStats.lastFired = fired.length;
    return { ok: true, url: target.url, fired };
  } catch (e) {
    return { error: 'injection refusee sur ' + target.url + ' : ' + (e && e.message || e) };
  }
}
