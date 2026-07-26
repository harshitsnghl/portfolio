import { beforeEach } from 'vitest';

/**
 * Node 25 ships its own Web Storage global. Under vitest it wins over the one
 * jsdom would install, and because it is started without a `--localstorage-file`
 * it arrives as an inert plain object: no `clear`, no `Storage` prototype, and
 * nothing resembling browser behaviour.
 *
 * Rather than depend on which implementation happens to win on a given Node
 * version, install a small spec-shaped Storage of our own. `localStorage` in
 * src/ then resolves to something that behaves the way it does in a browser.
 */
class MemoryStorage {
  #entries = new Map();

  get length() {
    return this.#entries.size;
  }

  key(index) {
    return [...this.#entries.keys()][index] ?? null;
  }

  getItem(key) {
    const k = String(key);
    return this.#entries.has(k) ? this.#entries.get(k) : null;
  }

  setItem(key, value) {
    this.#entries.set(String(key), String(value));
  }

  removeItem(key) {
    this.#entries.delete(String(key));
  }

  clear() {
    this.#entries.clear();
  }
}

const storage = new MemoryStorage();

for (const target of [globalThis, globalThis.window].filter(Boolean)) {
  Object.defineProperty(target, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

// Exposed so tests can spy on the prototype the way they would in a browser.
globalThis.Storage = MemoryStorage;

beforeEach(() => {
  storage.clear();
});
