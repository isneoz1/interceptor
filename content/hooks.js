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
  window.__INTERCEPTOR__ = true;

  var CFG = { wsFrames: true, maxFrameBytes: 0, maxBodyBytes: 0, perf: true,
                stacks: true, sse: true, rtc: true, workers: true,
                jsCookies: true, webTransport: true, vitals: true };
  try { if (script.dataset.icCfg) CFG = Object.assign(CFG, JSON.parse(script.dataset.icCfg)); } catch (e) {}

  try { document.documentElement.setAttribute('data-interceptor-ready', '1'); } catch (e) {}

  /* -------------------------- Transport -------------------------- */
  var queue = [];
  var flushTimer = null;
  var pid = 0;

  function post(ev) {
    ev.ts = Date.now();
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

  function frameData(data) {
    try {
      if (typeof data === 'string') {
        var c = clip(data, CFG.maxFrameBytes);
        return { opcode: 'text', data: c.text, size: c.size, truncated: c.truncated };
      }
      if (data instanceof ArrayBuffer) return { opcode: 'binary', data: null, size: data.byteLength, truncated: false };
      if (ArrayBuffer.isView(data)) return { opcode: 'binary', data: null, size: data.byteLength, truncated: false };
      if (typeof Blob !== 'undefined' && data instanceof Blob) return { opcode: 'blob', data: null, size: data.size, truncated: false };
      var s = String(data); var c2 = clip(s, CFG.maxFrameBytes);
      return { opcode: 'text', data: c2.text, size: c2.size, truncated: c2.truncated };
    } catch (e) { return { opcode: 'unknown', data: null, size: 0, truncated: false }; }
  }

  /* ============================ fetch ============================ */
  (function hookFetch() {
    if (typeof window.fetch !== 'function') return;
    var nativeFetch = window.fetch;

    window.fetch = function (input, init) {
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
    };
    try { window.fetch.toString = function () { return 'function fetch() { [native code] }'; }; } catch (e) {}
  })();

  /* ======================= XMLHttpRequest ======================== */
  (function hookXhr() {
    if (typeof XMLHttpRequest === 'undefined') return;
    var P = XMLHttpRequest.prototype;
    var open = P.open, send = P.send, setHeader = P.setRequestHeader;
    var store = new WeakMap();

    P.open = function (method, url, async) {
      try {
        store.set(this, {
          id: ++pid, method: String(method || 'GET').toUpperCase(), url: abs(url),
          async: async !== false, headers: [], stack: stack(), t0: 0
        });
      } catch (e) {}
      return open.apply(this, arguments);
    };

    P.setRequestHeader = function (name, value) {
      try { var m = store.get(this); if (m) m.headers.push({ name: String(name), value: String(value) }); } catch (e) {}
      return setHeader.apply(this, arguments);
    };

    P.send = function (body) {
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
    };

    function safeCall(fn) { try { return fn(); } catch (e) { return null; } }
    function safeJson(v) { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { return null; } }
  })();

  /* ========================== WebSocket ========================== */
  (function hookWebSocket() {
    if (typeof window.WebSocket === 'undefined') return;
    var Native = window.WebSocket;
    var ids = new WeakMap();

    var nativeSend = Native.prototype.send;
    Native.prototype.send = function (data) {
      try {
        var id = ids.get(this);
        if (id && CFG.wsFrames) {
          var f = frameData(data);
          post({ t: 'ws:frame', pid: id, dir: 'send', opcode: f.opcode, data: f.data, size: f.size, truncated: f.truncated });
        }
      } catch (e) {}
      return nativeSend.apply(this, arguments);
    };

    function track(ws, url, protocols) {
      var id = ++pid;
      ids.set(ws, id);
      post({ t: 'ws:open', pid: id, api: 'ws', url: abs(url), method: 'GET', protocols: protocols || null, stack: stack() });
      ws.addEventListener('message', function (ev) {
        if (!CFG.wsFrames) return;
        try {
          var f = frameData(ev.data);
          post({ t: 'ws:frame', pid: id, dir: 'recv', opcode: f.opcode, data: f.data, size: f.size, truncated: f.truncated });
        } catch (e) {}
      }, true);
      ws.addEventListener('close', function (ev) {
        post({ t: 'ws:close', pid: id, code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
      }, true);
      ws.addEventListener('error', function () {
        post({ t: 'ctx', kind: 'ws:error', url: abs(url) });
      }, true);
    }

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

  /* ========================== sendBeacon ========================= */
  (function hookBeacon() {
    if (!navigator || typeof navigator.sendBeacon !== 'function') return;
    var native = navigator.sendBeacon;
    var proto = Object.getPrototypeOf(navigator);
    var target = (proto && proto.sendBeacon === native) ? proto : navigator;

    target.sendBeacon = function (url, data) {
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
    };
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
        }, true);
        pc.addEventListener('connectionstatechange', function () {
          post({ t: 'ctx', kind: 'rtc:state', url: location.href, detail: { state: pc.connectionState } });
        }, true);
        var createDc = pc.createDataChannel;
        if (createDc) {
          pc.createDataChannel = function (label) {
            post({ t: 'ctx', kind: 'rtc:datachannel:open', url: location.href, detail: { label: String(label) } });
            return createDc.apply(this, arguments);
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

    window.WebTransport = new Proxy(Native, {
      construct: function (target, args, newTarget) {
        var wt = Reflect.construct(target, args, newTarget);
        try {
          if (CFG.webTransport) {
            var url = abs(args[0]);
            post({ t: 'ctx', kind: 'webtransport:open', url: url, stack: stack() });
            if (wt.closed && typeof wt.closed.then === 'function') {
              wt.closed.then(function (info) {
                post({ t: 'ctx', kind: 'webtransport:close', url: url, detail: info || null });
              }, function (err) {
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
