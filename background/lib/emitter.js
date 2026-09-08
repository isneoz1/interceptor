/* Bus d'evenements minimal, sans dependance. */
export class Emitter {
  constructor() { this._handlers = new Map(); }
  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) { this._handlers.get(event)?.delete(fn); }
  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (e) { console.error('[NeoZ] handler', event, e); }
    }
  }
}
