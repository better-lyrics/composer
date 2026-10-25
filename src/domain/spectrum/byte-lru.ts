// -- Types --------------------------------------------------------------------

interface LruEntry<Value> {
  value: Value;
  bytes: number;
}

// -- Cache --------------------------------------------------------------------

// Recency is Map insertion order: a read re-inserts, eviction walks from the oldest.
class ByteLru<Value> {
  readonly #entries = new Map<string, LruEntry<Value>>();
  readonly #capacityBytes: number;
  readonly #onEvict: (value: Value) => void;
  #bytes = 0;

  constructor(capacityBytes: number, onEvict: (value: Value) => void = () => {}) {
    this.#capacityBytes = capacityBytes;
    this.#onEvict = onEvict;
  }

  get bytes(): number {
    return this.#bytes;
  }

  get(key: string): Value | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: Value, bytes: number): void {
    this.#remove(key);
    this.#entries.set(key, { value, bytes });
    this.#bytes += bytes;
    for (const [oldest, entry] of this.#entries) {
      if (this.#bytes <= this.#capacityBytes || oldest === key) break;
      this.#remove(oldest);
      this.#onEvict(entry.value);
    }
  }

  clear(): void {
    for (const entry of this.#entries.values()) this.#onEvict(entry.value);
    this.#entries.clear();
    this.#bytes = 0;
  }

  #remove(key: string): void {
    const entry = this.#entries.get(key);
    if (!entry) return;
    this.#entries.delete(key);
    this.#bytes -= entry.bytes;
  }
}

// -- Exports ------------------------------------------------------------------

export { ByteLru };
