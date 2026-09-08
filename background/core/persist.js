/* Persistance IndexedDB — INTERCEPTOR (by NeoZ)
 *
 * Optionnelle (reglage `persist`). Ecrit les enregistrements termines par lots
 * pour ne jamais bloquer la capture, et les recharge au demarrage du navigateur.
 * Les donnees ne quittent jamais la machine : IndexedDB est local a Firefox.
 */
import { config } from './config.js';
import { store, detail, reserveIds } from './store.js';

const DB_NAME = 'interceptor';
const DB_VERSION = 1;
const STORE = 'records';

export const persistStats = { written: 0, restored: 0, failed: 0, enabled: false, pending: 0 };

let db = null;
let queue = [];
let timer = null;
let starting = false;
let subscribed = false;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        const os = d.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('startTime', 'startTime');
        os.createIndex('host', 'host');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function startPersistence() {
  if (!config.get('persist')) { persistStats.enabled = false; return; }
  if (db || starting) { persistStats.enabled = !!db; return; }
  starting = true;
  try {
    db = await open();
    persistStats.enabled = true;
    if (!subscribed) { store.on('finalize', rec => enqueue(rec)); subscribed = true; }
    await restore();
    console.info('[INTERCEPTOR] persistance active —', persistStats.restored, 'enregistrements restaures');
  } catch (e) {
    persistStats.failed++;
    console.warn('[INTERCEPTOR] persistance indisponible', e);
  } finally {
    starting = false;
  }
}

function enqueue(rec) {
  if (!db || !config.get('persist')) return;
  try { queue.push(detail(rec)); } catch { persistStats.failed++; return; }
  persistStats.pending = queue.length;
  if (queue.length >= 200) flush();
  else if (!timer) timer = setTimeout(flush, 1500);
}

function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!db || !queue.length) return;
  const batch = queue;
  queue = [];
  persistStats.pending = 0;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const os = tx.objectStore(STORE);
    for (const rec of batch) {
      try { os.put(rec); persistStats.written++; }
      catch { persistStats.failed++; }
    }
    tx.onerror = () => { persistStats.failed += batch.length; };
  } catch (e) {
    persistStats.failed += batch.length;
  }
}

/** Recharge les enregistrements les plus recents dans le magasin memoire. */
export function restore() {
  return new Promise(resolve => {
    if (!db) return resolve(0);
    const limit = config.get('persistMaxRecords');
    const max = (!limit || limit <= 0) ? Infinity : limit;
    const loaded = [];
    let maxId = 0;
    const finish = () => {
      // Insertion en une seule passe : unshift par element serait quadratique.
      loaded.reverse();
      for (const rec of loaded) store.records.set(rec.id, rec);
      store.order.unshift(...loaded.map(r => r.id));
      reserveIds(maxId);
      persistStats.restored = loaded.length;
      resolve(loaded.length);
    };
    try {
      const tx = db.transaction(STORE, 'readonly');
      const index = tx.objectStore(STORE).index('startTime');
      const cursorReq = index.openCursor(null, 'prev');
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || loaded.length >= max) return finish();
        const rec = cursor.value;
        rec.restored = true;
        rec._tlKeys = new Set((rec.timeline || []).map(t => t.event + '@' + (t.ts | 0)));
        if (rec.id > maxId) maxId = rec.id;
        loaded.push(rec);
        cursor.continue();
      };
      cursorReq.onerror = () => finish();
    } catch { resolve(0); }
  });
}

export async function purge() {
  flush();
  if (!db) return { ok: true, note: 'aucune base ouverte' };
  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => { persistStats.written = 0; persistStats.restored = 0; resolve({ ok: true }); };
    tx.onerror = () => resolve({ ok: false, error: String(tx.error) });
  });
}

export async function countStored() {
  if (!db) return 0;
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    } catch { resolve(0); }
  });
}
