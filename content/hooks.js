/* ============================================================
 * INTERCEPTOR — sondes du contexte page  (cree par NeoZ)
 *
 * Execute dans le monde de la page pour observer ce que webRequest
 * ne peut pas voir : trames WebSocket, messages SSE, piles d'appel,
 * reponses servies par un Service Worker, sendBeacon, WebRTC, Workers.
 *
 * Contrat : PUREMENT passif. Chaque sonde delegue a l'implementation
 * native d'origine et renvoie sa valeur telle quelle. Toute erreur
 * interne est avalee pour ne jamais perturber la page hote.
 * ============================================================ */
(function () {
  'use strict';

  var script = document.currentScript;
  var TOKEN = script && script.dataset ? script.dataset.icToken : null;
  if (!TOKEN || window.__INTERCEPTOR__) return;
  /* Le drapeau qui evite une double installation. Non enumerable : du code de
     page qui parcourt `window` — certains le font — ne doit pas tomber sur
     une propriete qui n etait pas la sans nous. */
  try {
    Object.defineProperty(window, '__INTERCEPTOR__',
      { value: true, enumerable: false, configurable: true, writable: false });
  } catch (e) { window.__INTERCEPTOR__ = true; }

  var CFG = { wsFrames: true, maxFrameBytes: 0, maxBodyBytes: 0, perf: true,
                stacks: true, sse: true, rtc: true, workers: true,
                jsCookies: true, webTransport: true, vitals: true,
                workerFrames: false };
  try { if (script.dataset.icCfg) CFG = Object.assign(CFG, JSON.parse(script.dataset.icCfg)); } catch (e) {}

  try { document.documentElement.setAttribute('data-interceptor-ready', '1'); } catch (e) {}

  /* -------------------------- Transport -------------------------- */
  var queue = [];
  var flushTimer = null;
  var pid = 0;

  function post(ev) {
    /* Un evenement lu en differe — les octets d un Blob, par exemple — porte
       deja l instant ou il s est produit. L ecraser fausserait l ordre des
       trames. */
    if (ev.ts == null) ev.ts = Date.now();
    queue.push(ev);
    if (queue.length >= 40) flush();
    else if (!flushTimer) flushTimer = setTimeout(flush, 100);
  }

  function flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!queue.length) return;
    var batch = queue;
    queue = [];
    try { window.postMessage({ __ic: TOKEN, batch: batch }, '*'); } catch (e) {}
  }

  window.addEventListener('pagehide', flush, true);
  window.addEventListener('beforeunload', flush, true);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  }, true);

  /* ------------------- Rendre une sonde indiscernable -------------- */
  /* Ce fichier promet d etre PUREMENT passif. Une page qui s apercoit qu on a
     remplace `fetch` n est plus observee : elle est modifiee. Beaucoup de
     sites verifient exactement cela et changent alors de comportement. Une
     sonde visible est donc un defaut, pas un detail d elegance. */
  var originales = new WeakMap();

  /* Une methode courte n a pas de `prototype` ; une fonction ordinaire si.
     C est la difference la plus facile a reperer entre une sonde et une
     methode native — et `delete f.prototype` echoue, la propriete n etant pas
     configurable. On fabrique donc la sonde sous une forme qui n en a jamais. */
  function commeMethode(fn) {
    var porteur = {
      sonde() { return fn.apply(this, arguments); }
    };
    return porteur.sonde;
  }

  /**
   * Donne a une sonde le nom, la longueur et le texte de ce qu elle remplace.
   *
   * @param sonde      la fonction posee a la place
   * @param originale  celle qui etait la
   */
  function deguiser(sonde, originale) {
    try {
      originales.set(sonde, originale);
      Object.defineProperty(sonde, 'name', { value: originale.name, configurable: true });
      Object.defineProperty(sonde, 'length', { value: originale.length, configurable: true });
    } catch (e) {}
    return sonde;
  }

  /* `toString` doit rendre le texte de l original, sinon « [native code] »
     disparait — c est precisement ce que lisent les scripts qui cherchent une
     fonction alteree. La sonde de `toString` se deguise elle-meme. */
  (function masquerToString() {
    try {
      var natif = Function.prototype.toString;
      var sonde = commeMethode(function () {
        var vraie = originales.get(this);
        return natif.call(vraie || this);
      });
      deguiser(sonde, natif);
      Function.prototype.toString = sonde;
    } catch (e) {}
  })();

  /* ---------------------------- Outils ---------------------------- */
  function cap(n) { return (!n || n <= 0) ? Infinity : n; }

  function abs(u) {
    try { return new URL(String(u), document.baseURI).href; } catch (e) { return String(u); }
  }

  function stack() {
    if (!CFG.stacks) return null;
    try {
      var s = new Error().stack || '';
      return s.split('\n').slice(2, 14).join('\n');
    } catch (e) { return null; }
  }

  function clip(text, limit) {
    var max = cap(limit);
    var s = String(text == null ? '' : text);
    if (s.length <= max) return { text: s, size: s.length, truncated: false };
    return { text: s.slice(0, max), size: s.length, truncated: true };
  }

  function headerPairs(h) {
    var out = [];
    try {
      if (!h) return out;
      if (typeof Headers !== 'undefined' && h instanceof Headers) {
        h.forEach(function (v, k) { out.push({ name: k, value: String(v) }); });
      } else if (Array.isArray(h)) {
        h.forEach(function (p) { if (p && p.length >= 2) out.push({ name: String(p[0]), value: String(p[1]) }); });
      } else if (typeof h === 'object') {
        Object.keys(h).forEach(function (k) { out.push({ name: k, value: String(h[k]) }); });
      }
    } catch (e) {}
    return out;
  }

  function parseRawHeaders(raw) {
    var out = [];
    String(raw || '').split(/\r?\n/).forEach(function (line) {
      var i = line.indexOf(':');
      if (i > 0) out.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
    });
    return out;
  }

  function describeBody(body) {
    try {
      if (body == null) return null;
      if (typeof body === 'string') {
        var c = clip(body, CFG.maxBodyBytes);
        return { kind: 'text', text: c.text, size: c.size, truncated: c.truncated };
      }
      if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
        var s = body.toString(); var c2 = clip(s, CFG.maxBodyBytes);
        return { kind: 'urlencoded', text: c2.text, size: c2.size, truncated: c2.truncated };
      }
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        var parts = [];
        body.forEach(function (v, k) {
          parts.push(k + '=' + (typeof v === 'string' ? v : '[fichier ' + (v && v.name) + ' ' + (v && v.size) + ' o]'));
        });
        var t = parts.join('\n'); var c3 = clip(t, CFG.maxBodyBytes);
        return { kind: 'formData', text: c3.text, size: c3.size, truncated: c3.truncated };
      }
      if (typeof Blob !== 'undefined' && body instanceof Blob) {
        return { kind: 'blob', text: '', size: body.size, truncated: false, note: 'Blob ' + (body.type || 'binaire') };
      }
      if (body instanceof ArrayBuffer) return { kind: 'binary', text: '', size: body.byteLength, truncated: false, note: 'ArrayBuffer' };
      if (ArrayBuffer.isView(body)) return { kind: 'binary', text: '', size: body.byteLength, truncated: false, note: body.constructor.name };
      var j = String(body); var c4 = clip(j, CFG.maxBodyBytes);
      return { kind: 'other', text: c4.text, size: c4.size, truncated: c4.truncated };
    } catch (e) { return null; }
  }

  /* Les octets d une trame binaire, en base64, bornes par le meme reglage que
     le texte. Par morceaux de huit mille : `String.fromCharCode.apply` sur un
     tableau de plusieurs megaoctets depasse la pile des arguments. */
  function base64Octets(octets, limite) {
    var max = cap(limite);
    var n = octets.length > max ? max : octets.length;
    var s = '';
    for (var i = 0; i < n; i += 8192) {
      var fin = i + 8192 > n ? n : i + 8192;
      s += String.fromCharCode.apply(null, octets.subarray(i, fin));
    }
    return { base64: btoa(s), truncated: octets.length > n };
  }

  function frameData(data) {
    try {
      if (typeof data === 'string') {
        var c = clip(data, CFG.maxFrameBytes);
        return { opcode: 'text', data: c.text, size: c.size, truncated: c.truncated };
      }
      /* Les octets sont gardes, pas seulement comptes : sans eux, un protocole
         binaire — protobuf, MessagePack, CBOR — ne laissait qu une taille,
         alors que la boite a outils sait lire les trois. */
      if (data instanceof ArrayBuffer) {
        var ab = base64Octets(new Uint8Array(data), CFG.maxFrameBytes);
        return { opcode: 'binary', data: null, base64: ab.base64,
                 size: data.byteLength, truncated: ab.truncated };
      }
      if (ArrayBuffer.isView(data)) {
        var vue = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        var av = base64Octets(vue, CFG.maxFrameBytes);
        return { opcode: 'binary', data: null, base64: av.base64,
                 size: data.byteLength, truncated: av.truncated };
      }
      /* Un Blob ne se lit pas sur-le-champ : `posterTrame` s en charge. */
      if (typeof Blob !== 'undefined' && data instanceof Blob) {
        return { opcode: 'blob', data: null, size: data.size, truncated: false, blob: data };
      }
      var s = String(data); var c2 = clip(s, CFG.maxFrameBytes);
      return { opcode: 'text', data: c2.text, size: c2.size, truncated: c2.truncated };
    } catch (e) { return { opcode: 'unknown', data: null, size: 0, truncated: false }; }
  }

  /**
   * Emet une trame, en lisant les octets d un Blob si besoin.
   *
   * @param id   identifiant de la connexion
   * @param dir  « send » ou « recv »
   * @param data ce que la page a envoye ou recu, tel quel
   */
  function posterTrame(id, dir, data) {
    var ts = Date.now();
    var f = frameData(data);
    if (f.blob && typeof f.blob.arrayBuffer === 'function') {
      var blob = f.blob;
      blob.arrayBuffer().then(function (tampon) {
        var b = base64Octets(new Uint8Array(tampon), CFG.maxFrameBytes);
        post({ t: 'ws:frame', ts: ts, pid: id, dir: dir, opcode: 'binary',
               data: null, base64: b.base64, size: blob.size, truncated: b.truncated });
      }, function () {
        /* Blob illisible — revoque, ou venu d un autre contexte : on garde au
           moins la trace de la trame et sa taille. */
        post({ t: 'ws:frame', ts: ts, pid: id, dir: dir, opcode: 'blob',
               data: null, size: blob.size, truncated: false });
      });
      return;
    }
    post({ t: 'ws:frame', ts: ts, pid: id, dir: dir, opcode: f.opcode,
           data: f.data, base64: f.base64 || null, size: f.size, truncated: f.truncated });
  }

  /* ============================ fetch ============================ */
  (function hookFetch() {
    if (typeof window.fetch !== 'function') return;
    var nativeFetch = window.fetch;

    window.fetch = deguiser(commeMethode(function (input, init) {
      var id = ++pid;
      var url, method = 'GET', headers = [], body = null, meta = {};
      try {
        if (input && typeof input === 'object' && 'url' in input) {
          url = abs(input.url);
          method = (input.method || 'GET').toUpperCase();
          headers = headerPairs(input.headers);
          meta = {
            credentials: input.credentials, mode: input.mode, cache: input.cache,
            redirect: input.redirect, referrer: input.referrer,
            referrerPolicy: input.referrerPolicy, integrity: input.integrity,
            keepalive: input.keepalive, destination: input.destination
          };
          if (input.body) {
            // Lecture non destructive du corps : complete l enregistrement
            // deja cree, sans jamais reemettre un second 'req:start'.
            try {
              input.clone().text().then(function (t) {
                if (t) post({ t: 'req:body', pid: id, body: describeBody(t) });
              }, function () {});
            } catch (e) {}
          }
        } else {
          url = abs(input);
        }
        if (init) {
          if (init.method) method = String(init.method).toUpperCase();
          if (init.headers) headers = headers.concat(headerPairs(init.headers));
          if (init.body != null) body = describeBody(init.body);
          ['credentials', 'mode', 'cache', 'redirect', 'referrer', 'referrerPolicy', 'integrity', 'keepalive'].forEach(function (k) {
            if (init[k] != null) meta[k] = init[k];
          });
        }
        post({
          t: 'req:start', pid: id, api: 'fetch', url: url, method: method,
          headers: headers, body: body, stack: stack(),
          credentials: meta.credentials, mode: meta.mode, cache: meta.cache,
          redirect: meta.redirect, referrer: meta.referrer,
          referrerPolicy: meta.referrerPolicy, integrity: meta.integrity,
          keepalive: !!meta.keepalive, destination: meta.destination
        });
      } catch (e) {}

      var t0 = Date.now();
      var p;
      try { p = nativeFetch.apply(this, arguments); }
      catch (e) {
        post({ t: 'req:end', pid: id, error: String(e && e.message || e), duration: Date.now() - t0 });
        throw e;
      }

      return p.then(function (res) {
        try {
          var end = {
            t: 'req:end', pid: id, status: res.status, statusText: res.statusText,
            headers: headerPairs(res.headers), responseType: res.type,
            responseUrl: res.url, redirected: res.redirected,
            fromServiceWorker: res.type === 'basic' && !!res.url && res.url !== url,
            duration: Date.now() - t0, mime: res.headers.get('content-type') || ''
          };
          // Lecture non destructive : le clone laisse le corps intact pour la page.
          try {
            res.clone().text().then(function (text) {
              var c = clip(text, CFG.maxBodyBytes);
              end.bodyText = c.text; end.bodySize = c.size; end.bodyTruncated = c.truncated;
              post(end);
            }, function () { post(end); });
          } catch (e) { post(end); }
        } catch (e) {}
        return res;
      }, function (err) {
        post({ t: 'req:end', pid: id, error: String(err && err.message || err), duration: Date.now() - t0 });
        throw err;
      });
    }), nativeFetch);
    try { window.fetch.toString = function () { return 'function fetch() { [native code] }'; }; } catch (e) {}
  })();

  /* ======================= XMLHttpRequest ======================== */
  (function hookXhr() {
    if (typeof XMLHttpRequest === 'undefined') return;
    var P = XMLHttpRequest.prototype;
    var open = P.open, send = P.send, setHeader = P.setRequestHeader;
    var store = new WeakMap();

    P.open = deguiser(commeMethode(function (method, url, async) {
      try {
        store.set(this, {
          id: ++pid, method: String(method || 'GET').toUpperCase(), url: abs(url),
          async: async !== false, headers: [], stack: stack(), t0: 0
        });
      } catch (e) {}
      return open.apply(this, arguments);
    }), open);

    P.setRequestHeader = function (name, value) {
      try { var m = store.get(this); if (m) m.headers.push({ name: String(name), value: String(value) }); } catch (e) {}
      return setHeader.apply(this, arguments);
    };

    P.send = deguiser(commeMethode(function (body) {
      var m = store.get(this);
      if (m) {
        m.t0 = Date.now();
        try {
          post({
            t: 'req:start', pid: m.id, api: 'xhr', url: m.url, method: m.method,
            headers: m.headers, body: describeBody(body), stack: m.stack,
            async: m.async, credentials: this.withCredentials ? 'include' : 'same-origin'
          });
        } catch (e) {}

        var self = this;
        var finished = false;
        var finish = function (error) {
          if (finished) return; finished = true;
          try {
            var end = {
              t: 'req:end', pid: m.id, duration: Date.now() - m.t0,
              status: self.status || null, statusText: self.statusText || '',
              headers: parseRawHeaders(safeCall(function () { return self.getAllResponseHeaders(); })),
              responseType: self.responseType || 'text',
              responseUrl: self.responseURL || null,
              mime: safeCall(function () { return self.getResponseHeader('content-type'); }) || ''
            };
            if (error) end.error = error;
            var rt = self.responseType;
            if (!rt || rt === 'text' || rt === 'json') {
              var raw = rt === 'json' ? safeJson(self.response) : safeCall(function () { return self.responseText; });
              if (raw != null) {
                var c = clip(raw, CFG.maxBodyBytes);
                end.bodyText = c.text; end.bodySize = c.size; end.bodyTruncated = c.truncated;
              }
            } else if (rt === 'arraybuffer' && self.response) {
              end.bodySize = self.response.byteLength;
            } else if (rt === 'blob' && self.response) {
              end.bodySize = self.response.size;
            }
            post(end);
          } catch (e) {}
        };

        this.addEventListener('loadend', function () { finish(null); }, { once: true });
        this.addEventListener('error', function () { finish('network error'); }, { once: true });
        this.addEventListener('timeout', function () { finish('timeout'); }, { once: true });
        this.addEventListener('abort', function () { finish('abort'); }, { once: true });
      }
      return send.apply(this, arguments);
    }), send);

    function safeCall(fn) { try { return fn(); } catch (e) { return null; } }
    function safeJson(v) { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { return null; } }
  })();

  /* ========================== WebSocket ========================== */
  (function hookWebSocket() {
    if (typeof window.WebSocket === 'undefined') return;
    var Native = window.WebSocket;
    var ids = new WeakMap();

    var nativeSend = Native.prototype.send;
    Native.prototype.send = deguiser(commeMethode(function (data) {
      try {
        var id = adopter(this);
        if (id && CFG.wsFrames) posterTrame(id, 'send', data);
      } catch (e) {}
      return nativeSend.apply(this, arguments);
    }), nativeSend);

    function track(ws, url, protocols) {
      var id = ++pid;
      ids.set(ws, id);
      post({ t: 'ws:open', pid: id, api: 'ws', url: abs(url), method: 'GET', protocols: protocols || null, stack: stack() });
      /* Deja ouverte quand on l adopte : l evenement `open` ne reviendra pas,
         et c est lui qui porte d ordinaire le sous-protocole negocie. */
      try {
        if (ws.readyState >= 1 && ws.protocol) post({ t: 'ws:protocol', pid: id, protocol: ws.protocol });
      } catch (e) {}
      ws.addEventListener('message', function (ev) {
        if (!CFG.wsFrames) return;
        try { posterTrame(id, 'recv', ev.data); } catch (e) {}
      }, true);
      /* Le serveur choisit le sous-protocole parmi ceux proposes, et son
         choix n est lisible qu une fois la connexion ouverte. C est lui qui
         dit comment lire les trames qui vont suivre. */
      ws.addEventListener('open', function () {
        try {
          if (ws.protocol) post({ t: 'ws:protocol', pid: id, protocol: ws.protocol });
        } catch (e) {}
      }, true);
      ws.addEventListener('close', function (ev) {
        post({ t: 'ws:close', pid: id, code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
      }, true);
      ws.addEventListener('error', function () {
        post({ t: 'ctx', kind: 'ws:error', url: abs(url) });
      }, true);
    }

    /**
     * Adopte une connexion, qu on l ait vue naitre ou non.
     *
     * @returns son identifiant de ligne
     */
    function adopter(ws) {
      if (!ws) return null;
      var id = ids.get(ws);
      if (id) return id;
      try { track(ws, ws.url, null); } catch (e) { return null; }
      return ids.get(ws) || null;
    }

    /* Les deux seules portes par lesquelles une page peut recevoir : on les
       garde toutes les deux, pour que l age de la connexion n y change rien. */
    var natifAjout = Native.prototype.addEventListener;
    if (typeof natifAjout === 'function') {
      Native.prototype.addEventListener = deguiser(commeMethode(function (type) {
        try { if (type === 'message' && CFG.wsFrames) adopter(this); } catch (e) {}
        return natifAjout.apply(this, arguments);
      }), natifAjout);
    }

    try {
      var desc = Object.getOwnPropertyDescriptor(Native.prototype, 'onmessage');
      if (desc && typeof desc.set === 'function') {
        var poseur = desc.set;
        Object.defineProperty(Native.prototype, 'onmessage', {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get,
          set: deguiser(commeMethode(function (gestionnaire) {
            try { if (CFG.wsFrames) adopter(this); } catch (e) {}
            return poseur.call(this, gestionnaire);
          }), poseur)
        });
      }
    } catch (e) {}

    window.WebSocket = new Proxy(Native, {
      construct: function (target, args, newTarget) {
        var ws = Reflect.construct(target, args, newTarget);
        try { track(ws, args[0], args[1]); } catch (e) {}
        return ws;
      }
    });
  })();

  /* ========================= EventSource ========================= */
  (function hookEventSource() {
    if (typeof window.EventSource === 'undefined') return;
    var Native = window.EventSource;

    window.EventSource = new Proxy(Native, {
      construct: function (target, args, newTarget) {
        var es = Reflect.construct(target, args, newTarget);
        if (!CFG.sse) return es;
        try {
          var id = ++pid;
          var url = abs(args[0]);
          var opts = args[1] || {};
          post({ t: 'sse:open', pid: id, api: 'sse', url: url, method: 'GET', withCredentials: !!opts.withCredentials, stack: stack() });

          var onMsg = function (ev) {
            try {
              var c = clip(ev.data, CFG.maxBodyBytes);
              post({ t: 'sse:msg', pid: id, event: ev.type, data: c.text, size: c.size, truncated: c.truncated, lastEventId: ev.lastEventId || null });
            } catch (e) {}
          };
          es.addEventListener('message', onMsg, true);

          // Les evenements nommes passent par addEventListener : on l'instrumente.
          var addEL = es.addEventListener;
          es.addEventListener = function (type, listener, options) {
            if (type !== 'message' && type !== 'error' && type !== 'open') {
              try { addEL.call(es, type, onMsg, true); } catch (e) {}
            }
            return addEL.apply(es, arguments);
          };

          es.addEventListener('error', function () { post({ t: 'sse:close', pid: id, error: 'error' }); }, true);
          var nativeClose = es.close;
          es.close = function () { post({ t: 'sse:close', pid: id }); return nativeClose.apply(this, arguments); };
        } catch (e) {}
        return es;
      }
    });
  })();

  /* ===================== WebSocket dans un worker ================ *
   * `webRequest` voit deja la poignee de main de toute WebSocket, d ou
   * qu elle vienne. Ce qui manque hors du contexte de la page, ce sont les
   * TRAMES : la sonde remplace `window.WebSocket`, et un worker a son propre
   * `self.WebSocket`.
   *
   * Pour y entrer, on charge le script du worker depuis un Blob qui installe
   * d abord la sonde, puis importe l original. Une chose change et se voit :
   * `self.location` devient l URL du Blob. Les resolutions relatives sont
   * rattrapees ci-dessous ; un worker qui lit `self.location` lui-meme, non.
   * D ou un reglage eteint par defaut.                                      */
  var noWorker = 0;

  /** Le prelude pose dans le worker : sonde WebSocket, puis le vrai script. */
  function preludeWorker(origine, estModule) {
    var chargement = estModule
      ? 'import(' + JSON.stringify(origine) + ');'
      : 'self.importScripts(' + JSON.stringify(origine) + ');';
    return [
      '(function () {',
      '  var BASE = ' + JSON.stringify(origine) + ';',
      '  var JETON = ' + JSON.stringify(TOKEN) + ';',
      '  var n = 0;',
      '  var lot = [];',
      '  var minuteur = null;',
      /* Un SharedWorker n a pas de `self.postMessage` : chaque page qui s y
         connecte recoit un port, et c est par la que tout passe. On garde
         ceux qu on voit, sans jamais appeler `start()` — demarrer un port
         avant que la page n y attache son gestionnaire lui ferait perdre ses
         propres messages. */
      '  var ports = [];',
      '  if (typeof self.postMessage !== "function") {',
      '    self.addEventListener("connect", function (e) {',
      '      try { var p = e.ports && e.ports[0]; if (p) ports.push(p); } catch (x) {}',
      '    }, true);',
      '  }',
      '  function vider() {',
      '    if (minuteur) { clearTimeout(minuteur); minuteur = null; }',
      '    if (!lot.length) return;',
      '    var envoi = lot; lot = [];',
      '    var message = { __ic: JETON, batch: envoi };',
      '    if (typeof self.postMessage === "function") {',
      '      try { self.postMessage(message); } catch (e) {}',
      '      return;',
      '    }',
      '    for (var i = 0; i < ports.length; i++) {',
      '      try { ports[i].postMessage(message); } catch (e) {}',
      '    }',
      '  }',
      '  function poser(ev) {',
      '    ev.ts = ev.ts || Date.now();',
      '    lot.push(ev);',
      '    if (lot.length >= 40) vider(); else if (!minuteur) minuteur = setTimeout(vider, 100);',
      '  }',
      /* Le worker est charge depuis un Blob : ses URL relatives resolvaient
         contre celle du Blob, et echouaient. On les ramene sur l original. */
      '  try {',
      '    var natifImport = self.importScripts;',
      '    if (typeof natifImport === "function") {',
      '      self.importScripts = function () {',
      '        var a = [];',
      '        for (var i = 0; i < arguments.length; i++) {',
      '          try { a.push(new URL(arguments[i], BASE).href); } catch (e) { a.push(arguments[i]); }',
      '        }',
      '        return natifImport.apply(self, a);',
      '      };',
      '    }',
      '    var natifFetch = self.fetch;',
      '    if (typeof natifFetch === "function") {',
      '      self.fetch = function (e, i) {',
      '        try { if (typeof e === "string") e = new URL(e, BASE).href; } catch (x) {}',
      '        return natifFetch.call(self, e, i);',
      '      };',
      '    }',
      '    if (self.XMLHttpRequest && self.XMLHttpRequest.prototype) {',
      '      var pxhr = self.XMLHttpRequest.prototype, ouvrir = pxhr.open;',
      '      pxhr.open = function (m, u) {',
      '        try { arguments[1] = new URL(u, BASE).href; } catch (x) {}',
      '        return ouvrir.apply(this, arguments);',
      '      };',
      '    }',
      '  } catch (e) {}',
      /* La sonde elle-meme : meme forme que celle de la page. */
      '  try {',
      '    var Natif = self.WebSocket;',
      '    if (Natif) {',
      '      var ids = new WeakMap();',
      '      function b64(o) {',
      '        var s = "";',
      '        for (var i = 0; i < o.length; i += 8192) {',
      '          s += String.fromCharCode.apply(null, o.subarray(i, Math.min(i + 8192, o.length)));',
      '        }',
      '        try { return self.btoa(s); } catch (e) { return null; }',
      '      }',
      '      function trame(id, dir, d) {',
      '        var ts = Date.now();',
      '        try {',
      '          if (typeof d === "string") {',
      '            poser({ t: "ws:frame", ts: ts, pid: id, dir: dir, opcode: "text", data: d, size: d.length, truncated: false });',
      '          } else if (d instanceof ArrayBuffer) {',
      '            poser({ t: "ws:frame", ts: ts, pid: id, dir: dir, opcode: "binary", data: null, base64: b64(new Uint8Array(d)), size: d.byteLength, truncated: false });',
      '          } else if (ArrayBuffer.isView(d)) {',
      '            poser({ t: "ws:frame", ts: ts, pid: id, dir: dir, opcode: "binary", data: null, base64: b64(new Uint8Array(d.buffer, d.byteOffset, d.byteLength)), size: d.byteLength, truncated: false });',
      '          } else if (typeof Blob !== "undefined" && d instanceof Blob && d.arrayBuffer) {',
      '            d.arrayBuffer().then(function (t) {',
      '              poser({ t: "ws:frame", ts: ts, pid: id, dir: dir, opcode: "binary", data: null, base64: b64(new Uint8Array(t)), size: d.size, truncated: false });',
      '            }, function () {});',
      '          } else {',
      '            var s2 = String(d);',
      '            poser({ t: "ws:frame", ts: ts, pid: id, dir: dir, opcode: "text", data: s2, size: s2.length, truncated: false });',
      '          }',
      '        } catch (e) {}',
      '      }',
      '      var envoyer = Natif.prototype.send;',
      '      Natif.prototype.send = function (d) {',
      '        try { var id = ids.get(this); if (id) trame(id, "send", d); } catch (e) {}',
      '        return envoyer.apply(this, arguments);',
      '      };',
      '      self.WebSocket = new Proxy(Natif, {',
      '        construct: function (cible, args, neuf) {',
      '          var ws = Reflect.construct(cible, args, neuf);',
      '          try {',
      '            var id = ++n;',
      '            ids.set(ws, id);',
      '            var url = String(args[0]);',
      '            try { url = new URL(args[0], BASE).href; } catch (e) {}',
      '            poser({ t: "ws:open", pid: id, api: "ws", url: url, method: "GET", protocols: args[1] || null });',
      '            ws.addEventListener("message", function (ev) { trame(id, "recv", ev.data); }, true);',
      '            ws.addEventListener("open", function () { if (ws.protocol) poser({ t: "ws:protocol", pid: id, protocol: ws.protocol }); }, true);',
      '            ws.addEventListener("close", function (ev) { poser({ t: "ws:close", pid: id, code: ev.code, reason: ev.reason, wasClean: ev.wasClean }); }, true);',
      '          } catch (e) {}',
      '          return ws;',
      '        }',
      '      });',
      '    }',
      '  } catch (e) {}',
      '  self.addEventListener("close", vider);',
      '  ' + chargement,
      '})();'
    ].join('\n');
  }

  /**
   * Remplace l URL d un worker par un Blob qui pose la sonde avant le script.
   *
   * @returns l URL a utiliser, ou null si rien ne doit changer.
   */
  function urlSondee(url, options) {
    try {
      var origine = abs(url);
      /* Un worker deja construit depuis un Blob ou une data: URL garde son
         propre contexte : on n y touche pas, on ne saurait pas le recomposer. */
      if (/^(blob|data):/i.test(origine)) return null;
      var estModule = !!(options && options.type === 'module');
      var lame = new Blob([preludeWorker(origine, estModule)],
        { type: 'text/javascript' });
      return URL.createObjectURL(lame);
    } catch (e) { return null; }
  }

  /** Relaie les observations d un worker, sans que la page les voie. */
  function ecouterWorker(cible, numero) {
    cible.addEventListener('message', function (ev) {
      var d = ev && ev.data;
      if (!d || d.__ic !== TOKEN || !d.batch) return;
      /* Les identifiants du worker partent de un, comme ceux de la page :
         on les prefixe pour qu ils ne se confondent pas. */
      for (var i = 0; i < d.batch.length; i++) {
        var e = d.batch[i];
        if (e && e.pid != null) e.pid = 'w' + numero + ':' + e.pid;
        post(e);
      }
      /* La page n a rien a faire de nos messages : on les arrete ici. */
      ev.stopImmediatePropagation();
    }, true);
  }

  /* ========================== sendBeacon ========================= */
  (function hookBeacon() {
    if (!navigator || typeof navigator.sendBeacon !== 'function') return;
    var native = navigator.sendBeacon;
    var proto = Object.getPrototypeOf(navigator);
    var target = (proto && proto.sendBeacon === native) ? proto : navigator;

    target.sendBeacon = deguiser(commeMethode(function (url, data) {
      var id = ++pid;
      try {
        post({
          t: 'req:start', pid: id, api: 'beacon', url: abs(url), method: 'POST',
          headers: [], body: describeBody(data), stack: stack(), keepalive: true
        });
      } catch (e) {}
      var ok = native.apply(this, arguments);
      try { post({ t: 'req:end', pid: id, status: ok ? 202 : 0, statusText: ok ? 'queued' : 'refused', error: ok ? null : 'sendBeacon refuse' }); } catch (e) {}
      return ok;
    }), native);
  })();

  /* ================= Workers / Service Workers ================== */
  (function hookWorkers() {
    ['Worker', 'SharedWorker'].forEach(function (name) {
      if (typeof window[name] === 'undefined') return;
      var Native = window[name];
      window[name] = new Proxy(Native, {
        construct: function (target, args, newTarget) {
          try {
            if (CFG.workers) post({ t: 'ctx', kind: name.toLowerCase() + ':create', url: abs(args[0]), stack: stack() });
          } catch (e) {}

          /* Sonder l interieur du worker, si c est demande. Le reglage est
             eteint par defaut : voir le prelude plus haut pour ce que cela
             change. */
          if (CFG.workerFrames && CFG.wsFrames) {
            var sondee = urlSondee(args[0], args[1]);
            if (sondee) {
              var numero = ++noWorker;
              try {
                var avecSonde = Reflect.construct(
                  target, [sondee].concat(Array.prototype.slice.call(args, 1)), newTarget);
                /* Un SharedWorker ne parle que par son port : c est lui qu il
                   faut ecouter, et demarrer. */
                var canal = name === 'SharedWorker' ? avecSonde.port : avecSonde;
                /* On ecoute, mais on ne DEMARRE pas le port : c est a la page
                   de le faire, et le demarrer avant elle lui ferait perdre les
                   messages arrives entre-temps. Tant qu elle ne l a pas
                   demarre, rien ne circule — exactement comme sans nous. */
                ecouterWorker(canal, numero);
                return avecSonde;
              } catch (e) {
                /* Blob refuse — une politique `worker-src` stricte, le plus
                   souvent. On repart sur l original : mieux vaut une
                   observation incomplete qu un site casse. */
                post({ t: 'ctx', kind: name.toLowerCase() + ':sonde-refusee',
                       url: abs(args[0]),
                       detail: { raison: String((e && e.message) || e) } });
              } finally {
                /* L URL du Blob a fait son office des la construction. */
                try { URL.revokeObjectURL(sondee); } catch (e) {}
              }
            }
          }
          return Reflect.construct(target, args, newTarget);
        }
      });
    });

    try {
      if (navigator.serviceWorker && navigator.serviceWorker.register) {
        var reg = navigator.serviceWorker.register;
        navigator.serviceWorker.register = function (url, opts) {
          try {
            if (CFG.workers) post({ t: 'ctx', kind: 'serviceWorker:register', url: abs(url), detail: opts || null, stack: stack() });
          } catch (e) {}
          return reg.apply(this, arguments);
        };
        navigator.serviceWorker.addEventListener('message', function (ev) {
          try {
            var c = clip(typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data), 4096);
            post({ t: 'ctx', kind: 'serviceWorker:message', url: location.href, detail: { data: c.text, truncated: c.truncated } });
          } catch (e) {}
        }, true);
      }
    } catch (e) {}
  })();

  /* =========================== WebRTC ============================ */
  (function hookWebRtc() {
    var Native = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (!Native) return;

    /* Les canaux suivis, et l identifiant de leur ligne. */
    var idsCanal = new WeakMap();
    var envoiPatche = false;

    /* `send` vit sur le prototype : on ne le remplace qu une fois, et le
       WeakMap dit lesquels nous interessent. */
    function patcherEnvoi(canal) {
      if (envoiPatche) return;
      var proto = Object.getPrototypeOf(canal);
      if (!proto || typeof proto.send !== 'function') return;
      envoiPatche = true;
      var natif = proto.send;
      proto.send = deguiser(commeMethode(function (donnees) {
        try {
          var id = idsCanal.get(this);
          if (id && CFG.wsFrames) posterTrame(id, 'send', donnees);
        } catch (e) {}
        return natif.apply(this, arguments);
      }), natif);
    }

    /**
     * Suit un canal de donnees : ouverture, trames des deux sens, fermeture.
     *
     * Les deux bouts comptent — celui qu on cree et celui que le pair ouvre —
     * donc cette fonction est appelee des deux cotes.
     */
    function suivreCanal(canal) {
      if (!canal || idsCanal.has(canal)) return;
      var id = ++pid;
      idsCanal.set(canal, id);
      patcherEnvoi(canal);
      try {
        post({ t: 'ws:open', pid: id, api: 'rtc', transport: 'rtc',
               url: 'webrtc:' + (canal.label || ''), method: 'GET',
               protocols: canal.protocol ? [canal.protocol] : null, stack: stack() });
        canal.addEventListener('message', function (ev) {
          if (!CFG.wsFrames) return;
          try { posterTrame(id, 'recv', ev.data); } catch (e) {}
        }, true);
        canal.addEventListener('close', function () {
          post({ t: 'ws:close', pid: id, code: 0, reason: 'canal ferme', wasClean: true });
        }, true);
        canal.addEventListener('error', function (ev) {
          post({ t: 'ctx', kind: 'rtc:datachannel:error', url: location.href,
                 detail: { label: canal.label,
                           erreur: String((ev && ev.error && ev.error.message) || '') } });
        }, true);
      } catch (e) {}
    }

    function instrument(pc, cfg) {
      if (!CFG.rtc) return;
      try {
        post({ t: 'ctx', kind: 'rtc:create', url: location.href, detail: { iceServers: (cfg && cfg.iceServers) || null }, stack: stack() });
        pc.addEventListener('icecandidate', function (ev) {
          if (!ev.candidate) return;
          post({ t: 'ctx', kind: 'rtc:candidate', url: location.href, detail: { candidate: String(ev.candidate.candidate).slice(0, 300) } });
        }, true);
        pc.addEventListener('datachannel', function (ev) {
          post({ t: 'ctx', kind: 'rtc:datachannel', url: location.href, detail: { label: ev.channel && ev.channel.label } });
          /* Le canal ouvert par le PAIR compte autant que le notre. */
          suivreCanal(ev.channel);
        }, true);
        pc.addEventListener('connectionstatechange', function () {
          post({ t: 'ctx', kind: 'rtc:state', url: location.href, detail: { state: pc.connectionState } });
        }, true);
        var createDc = pc.createDataChannel;
        if (createDc) {
          pc.createDataChannel = function (label) {
            post({ t: 'ctx', kind: 'rtc:datachannel:open', url: location.href, detail: { label: String(label) } });
            var canal = createDc.apply(this, arguments);
            suivreCanal(canal);
            return canal;
          };
        }
      } catch (e) {}
    }

    var Wrapped = new Proxy(Native, {
      construct: function (target, args, newTarget) {
        var pc = Reflect.construct(target, args, newTarget);
        instrument(pc, args[0]);
        return pc;
      }
    });
    window.RTCPeerConnection = Wrapped;
    if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = Wrapped;
  })();

  /* ============ PerformanceObserver : filet de securite ========== */
  (function hookPerformance() {
    if (!CFG.perf || typeof PerformanceObserver === 'undefined') return;

    function serialize(e) {
      return {
        name: e.name,
        initiatorType: e.initiatorType || null,
        nextHopProtocol: e.nextHopProtocol || null,
        transferSize: e.transferSize,
        encodedBodySize: e.encodedBodySize,
        decodedBodySize: e.decodedBodySize,
        duration: Math.round(e.duration),
        startTime: Math.round(e.startTime),
        redirectCount: e.redirectCount,
        renderBlockingStatus: e.renderBlockingStatus || null,
        deliveryType: e.deliveryType || null,
        workerStart: e.workerStart || 0,
        serverTiming: (e.serverTiming || []).map(function (s) {
          return { name: s.name, duration: s.duration, description: s.description };
        }),
        timings: {
          blocked: Math.max(-1, Math.round(e.domainLookupStart - e.startTime)),
          dns: Math.max(-1, Math.round(e.domainLookupEnd - e.domainLookupStart)),
          connect: Math.max(-1, Math.round(e.connectEnd - e.connectStart)),
          ssl: e.secureConnectionStart ? Math.max(-1, Math.round(e.connectEnd - e.secureConnectionStart)) : -1,
          send: Math.max(0, Math.round(e.responseStart - e.requestStart)),
          wait: Math.max(0, Math.round(e.responseStart - e.requestStart)),
          receive: Math.max(0, Math.round(e.responseEnd - e.responseStart))
        }
      };
    }

    try {
      var obs = new PerformanceObserver(function (list) {
        try {
          var entries = list.getEntries().map(serialize);
          if (entries.length) post({ t: 'perf', entries: entries });
        } catch (e) {}
      });
      obs.observe({ type: 'resource', buffered: true });
      try { obs.observe({ type: 'navigation', buffered: true }); } catch (e) {}
    } catch (e) {}
  })();

  /* ================== Cookies poses en JavaScript ================ *
   * cookies.onChanged voit la mutation, mais pas QUI l a provoquee.
   * Cette sonde ajoute la pile d appel : c'est la seule facon de relier
   * un cookie a la ligne de code qui l ecrit.                        */
  (function hookDocumentCookie() {
    try {
      var proto = Document.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'cookie') ||
                 Object.getOwnPropertyDescriptor(document, 'cookie');
      if (!desc || !desc.set || !desc.configurable) return;

      Object.defineProperty(document, 'cookie', {
        configurable: true,
        enumerable: desc.enumerable,
        get: function () { return desc.get.call(document); },
        set: function (value) {
          try {
            if (CFG.jsCookies) {
              var raw = String(value);
              post({
                t: 'ctx', kind: 'cookie:js', url: location.href,
                detail: { cookie: raw.slice(0, 400), name: raw.split('=')[0].trim() },
                stack: stack()
              });
            }
          } catch (e) {}
          return desc.set.call(document, value);
        }
      });
    } catch (e) {}
  })();

  /* ========================= WebTransport ======================== *
   * API HTTP/3. Absente ou desactivee sur la plupart des Firefox : la
   * sonde ne s installe que si l objet existe reellement.            */
  (function hookWebTransport() {
    if (typeof window.WebTransport === 'undefined') return;
    var Native = window.WebTransport;

    /* Les datagrammes SORTANTS : on enveloppe l ecrivain rendu par
       `datagrams.writable.getWriter()`. La page ecrit comme d habitude. */
    function suivreEnvois(wt, id) {
      try {
        var writable = wt.datagrams && wt.datagrams.writable;
        if (!writable || typeof writable.getWriter !== 'function') return;
        var natif = writable.getWriter;
        writable.getWriter = function () {
          var ecrivain = natif.apply(this, arguments);
          var ecrire = ecrivain.write;
          if (typeof ecrire === 'function') {
            ecrivain.write = function (donnees) {
              try { if (CFG.wsFrames) posterTrame(id, 'send', donnees); } catch (e) {}
              return ecrire.apply(this, arguments);
            };
          }
          return ecrivain;
        };
      } catch (e) {}
    }

    /* Les datagrammes ENTRANTS : `tee()` dedouble le flux, la page recoit
       exactement ce qu elle aurait recu sans nous. Lire directement le
       `readable` le consommerait et casserait l application. */
    function suivreReceptions(wt, id) {
      try {
        var readable = wt.datagrams && wt.datagrams.readable;
        if (!readable || typeof readable.tee !== 'function') return;
        var deux = readable.tee();
        try { Object.defineProperty(wt.datagrams, 'readable', { value: deux[0], configurable: true }); }
        catch (e) { return; }
        var lecteur = deux[1].getReader();
        (function lire() {
          lecteur.read().then(function (r) {
            if (r.done) return;
            try { if (CFG.wsFrames) posterTrame(id, 'recv', r.value); } catch (e) {}
            lire();
          }, function () { /* flux ferme : rien de plus a lire */ });
        })();
      } catch (e) {}
    }

    /* Les flux ouverts : leur nombre et leur sens. Leur CONTENU n est pas lu —
       ce sont des flux que la page consomme elle-meme, et les dedoubler tous
       couterait plus que cela n apprend. */
    function suivreFlux(wt, url) {
      for (var i = 0; i < 2; i++) {
        (function (nom) {
          try {
            var natif = wt[nom];
            if (typeof natif !== 'function') return;
            wt[nom] = function () {
              post({ t: 'ctx', kind: 'webtransport:stream', url: url,
                     detail: { sens: nom === 'createBidirectionalStream' ? 'bidirectionnel' : 'sortant' } });
              return natif.apply(this, arguments);
            };
          } catch (e) {}
        })(i === 0 ? 'createBidirectionalStream' : 'createUnidirectionalStream');
      }
    }

    window.WebTransport = new Proxy(Native, {
      construct: function (target, args, newTarget) {
        var wt = Reflect.construct(target, args, newTarget);
        try {
          if (CFG.webTransport) {
            var url = abs(args[0]);
            var id = ++pid;
            post({ t: 'ws:open', pid: id, api: 'webtransport', transport: 'webtransport',
                   url: url, method: 'CONNECT', protocols: null, stack: stack() });
            post({ t: 'ctx', kind: 'webtransport:open', url: url, stack: stack() });
            suivreEnvois(wt, id);
            suivreReceptions(wt, id);
            suivreFlux(wt, url);
            if (wt.closed && typeof wt.closed.then === 'function') {
              wt.closed.then(function (info) {
                post({ t: 'ws:close', pid: id, code: (info && info.closeCode) || 0,
                       reason: (info && info.reason) || '', wasClean: true });
                post({ t: 'ctx', kind: 'webtransport:close', url: url, detail: info || null });
              }, function (err) {
                post({ t: 'ws:close', pid: id, code: 0,
                       reason: String((err && err.message) || err), wasClean: false });
                post({ t: 'ctx', kind: 'webtransport:error', url: url, detail: { erreur: String(err && err.message || err) } });
              });
            }
          }
        } catch (e) {}
        return wt;
      }
    });
  })();

  /* ============ Mesures de perception de la page (vitals) ========= *
   * Chiffres bruts fournis par le navigateur : premier affichage,
   * plus grand element affiche, decalages de mise en page, taches
   * longues. Rien n est estime, tout vient de PerformanceObserver.   */
  (function hookVitals() {
    if (!CFG.vitals || typeof PerformanceObserver === 'undefined') return;
    var cls = 0;

    function watch(type, handler) {
      try {
        var obs = new PerformanceObserver(function (list) {
          try { list.getEntries().forEach(handler); } catch (e) {}
        });
        obs.observe({ type: type, buffered: true });
      } catch (e) {}
    }

    watch('paint', function (e) {
      post({ t: 'ctx', kind: 'vitals:' + e.name, url: location.href,
             detail: { ms: Math.round(e.startTime) } });
    });
    watch('largest-contentful-paint', function (e) {
      post({ t: 'ctx', kind: 'vitals:lcp', url: location.href,
             detail: { ms: Math.round(e.startTime), taille: e.size || 0,
                       element: e.element && e.element.tagName ? e.element.tagName.toLowerCase() : null } });
    });
    watch('layout-shift', function (e) {
      if (e.hadRecentInput) return;
      cls += e.value;
      post({ t: 'ctx', kind: 'vitals:cls', url: location.href,
             detail: { decalage: Number(e.value.toFixed(4)), cumul: Number(cls.toFixed(4)) } });
    });
    watch('longtask', function (e) {
      post({ t: 'ctx', kind: 'vitals:tache-longue', url: location.href,
             detail: { ms: Math.round(e.duration), debut: Math.round(e.startTime) } });
    });
    watch('first-input', function (e) {
      post({ t: 'ctx', kind: 'vitals:premiere-interaction', url: location.href,
             detail: { delai: Math.round(e.processingStart - e.startTime), type: e.name } });
    });
  })();

  /* ================== Contexte de document ====================== */
  try {
    post({ t: 'ctx', kind: 'document:start', url: location.href, detail: { referrer: document.referrer || null } });
    window.addEventListener('DOMContentLoaded', function () { post({ t: 'ctx', kind: 'document:dom', url: location.href }); }, true);
    window.addEventListener('load', function () { post({ t: 'ctx', kind: 'document:load', url: location.href }); flush(); }, true);
  } catch (e) {}

  /* ========== Commandes venant du pont (activation / arret) ====== */
  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.__icCmd !== TOKEN) return;
    if (d.cmd === 'config' && d.cfg) { try { Object.assign(CFG, d.cfg); } catch (e) {} }
    if (d.cmd === 'flush') flush();
  }, true);
})();
