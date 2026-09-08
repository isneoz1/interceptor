/* ============================================================
 * INTERCEPTOR — pont content script  (cree par NeoZ)
 *
 * Monde isole. Role :
 *   1. injecter les sondes dans le monde de la page, des document_start ;
 *   2. si la CSP de la page bloque l'injection, basculer sur un jeu de
 *      sondes pose par vision Xray (insensible a la CSP) ;
 *   3. relayer les observations vers le coeur, par lots.
 *
 * Securite : un jeton aleatoire par document authentifie les messages ;
 * tout message venant d'une autre fenetre ou sans jeton valide est ignore.
 * ============================================================ */
(function () {
  'use strict';

  var B = typeof browser !== 'undefined' ? browser : chrome;
  if (!B || !B.runtime || !B.runtime.id) return;
  if (window.__INTERCEPTOR_BRIDGE__) return;
  window.__INTERCEPTOR_BRIDGE__ = true;

  var TOKEN = makeToken();
  var CFG = { wsFrames: true, maxFrameBytes: 0, maxBodyBytes: 0, perf: true,
                stacks: true, sse: true, rtc: true, workers: true };
  var alive = true;
  var mode = 'pending';

  function makeToken() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
      var a = new Uint8Array(24); crypto.getRandomValues(a);
      return Array.from(a, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) { return String(Math.random()).slice(2) + String(Date.now()); }
  }

  /* ------------------------ Relais vers le coeur ------------------------ */
  var outbox = [];
  var timer = null;

  function send() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!outbox.length || !alive) return;
    var batch = outbox;
    outbox = [];
    try {
      var p = B.runtime.sendMessage({ t: 'batch', batch: batch });
      if (p && typeof p.catch === 'function') {
        p.catch(function () { alive = !!(B.runtime && B.runtime.id); });
      }
    } catch (e) { alive = false; }
  }

  function enqueue(events) {
    if (!alive) return;
    for (var i = 0; i < events.length; i++) outbox.push(events[i]);
    if (outbox.length >= 120) send();
    else if (!timer) timer = setTimeout(send, 150);
  }

  window.addEventListener('pagehide', send, true);
  window.addEventListener('beforeunload', send, true);

  /* ------------------ Reception depuis le monde page ------------------- */
  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.__ic !== TOKEN || !Array.isArray(d.batch)) return;
    enqueue(d.batch);
  }, true);

  /* -------------------------- Injection page --------------------------- */
  function cleanup(el) {
    try {
      delete el.dataset.icToken;
      delete el.dataset.icCfg;
      el.remove();
    } catch (e) {}
  }

  function inject() {
    var root = document.documentElement || document.head || document.body;
    if (!root) { setTimeout(inject, 0); return; }

    var el = document.createElement('script');
    el.async = false;
    el.dataset.icToken = TOKEN;
    el.dataset.icCfg = JSON.stringify(CFG);
    el.src = B.runtime.getURL('content/hooks.js');

    el.addEventListener('load', function () { mode = 'page'; cleanup(el); });
    el.addEventListener('error', function () { cleanup(el); installXrayProbes('csp'); });

    try { root.insertBefore(el, root.firstChild); }
    catch (e) { installXrayProbes('dom'); return; }

    setTimeout(function () {
      var ready = false;
      try { ready = document.documentElement.hasAttribute('data-interceptor-ready'); } catch (e) {}
      if (ready) mode = 'page';
      else if (mode !== 'page') installXrayProbes('timeout');
    }, 1200);
  }

  /* ------------- Repli Xray : insensible a la CSP de la page ------------ */
  function installXrayProbes(reason) {
    if (mode === 'page' || mode === 'xray' || mode === 'none') return;
    if (typeof window.wrappedJSObject === 'undefined' || typeof exportFunction !== 'function') {
      mode = 'none';
      enqueue([{ t: 'ctx', kind: 'probe:unavailable', url: location.href,
                 detail: { reason: reason }, ts: Date.now() }]);
      return;
    }
    mode = 'xray';

    var win = window.wrappedJSObject;
    var pid = 0;
    var meta = new WeakMap();

    function emit(ev) { ev.ts = Date.now(); enqueue([ev]); }
    function abs(u) { try { return new URL(String(u), document.baseURI).href; } catch (e) { return String(u); } }

    /* --- fetch --- */
    try {
      var nativeFetch = win.fetch;
      win.fetch = exportFunction(function (input, init) {
        var id = ++pid;
        try {
          var url = abs(typeof input === 'string' ? input : (input && input.url) || input);
          var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
          emit({ t: 'req:start', pid: id, api: 'fetch', url: url, method: method,
                 headers: [], body: null, probe: 'xray' });
        } catch (e) {}
        var p = nativeFetch.call(win, input, init);
        try {
          p.then(exportFunction(function (res) {
            emit({ t: 'req:end', pid: id, status: res.status, statusText: res.statusText });
            return res;
          }, win));
        } catch (e) {}
        return p;
      }, win);
    } catch (e) {}

    /* --- XMLHttpRequest --- */
    try {
      var xp = win.XMLHttpRequest.prototype;
      var nOpen = xp.open, nSend = xp.send;
      xp.open = exportFunction(function (method, url) {
        try { meta.set(this, { id: ++pid, method: String(method || 'GET').toUpperCase(), url: abs(url), t0: 0 }); } catch (e) {}
        return nOpen.apply(this, arguments);
      }, win);
      xp.send = exportFunction(function () {
        var m = meta.get(this);
        if (m) {
          m.t0 = Date.now();
          emit({ t: 'req:start', pid: m.id, api: 'xhr', url: m.url, method: m.method,
                 headers: [], body: null, probe: 'xray' });
          var self = this;
          this.addEventListener('loadend', exportFunction(function () {
            emit({ t: 'req:end', pid: m.id, status: self.status || null,
                   statusText: self.statusText || '', duration: Date.now() - m.t0 });
          }, win), { once: true });
        }
        return nSend.apply(this, arguments);
      }, win);
    } catch (e) {}

    /* --- sendBeacon --- */
    try {
      var nav = win.navigator;
      var nBeacon = nav.sendBeacon;
      nav.sendBeacon = exportFunction(function (url, data) {
        var id = ++pid;
        emit({ t: 'req:start', pid: id, api: 'beacon', url: abs(url), method: 'POST',
               headers: [], body: null, probe: 'xray' });
        var ok = nBeacon.call(nav, url, data);
        emit({ t: 'req:end', pid: id, status: ok ? 202 : 0, statusText: ok ? 'queued' : 'refused' });
        return ok;
      }, win);
    } catch (e) {}

    emit({
      t: 'ctx', kind: 'probe:xray', url: location.href,
      detail: {
        reason: reason,
        couverture: 'fetch, XHR, sendBeacon — trames WebSocket indisponibles sur ce document'
      }
    });
  }

  /* ------------------------------ Demarrage ---------------------------- */
  try {
    var hello = B.runtime.sendMessage({ t: 'hello' });
    if (hello && typeof hello.then === 'function') {
      hello.then(function (res) {
        if (res && res.options) {
          CFG = Object.assign(CFG, res.options);
          try { window.postMessage({ __icCmd: TOKEN, cmd: 'config', cfg: CFG }, '*'); } catch (e) {}
        }
      }).catch(function () {});
    }
  } catch (e) {}

  inject();
})();
