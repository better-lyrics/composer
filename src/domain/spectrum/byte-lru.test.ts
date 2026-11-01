import { ByteLru } from "@/domain/spectrum/byte-lru";
import { describe, expect, it } from "vitest";

function cacheWithLog(capacity: number): { cache: ByteLru<string>; evicted: string[] } {
  const evicted: string[] = [];
  return { cache: new ByteLru<string>(capacity, (value) => evicted.push(value)), evicted };
}

describe("ByteLru", () => {
  it("evicts the oldest entries once over capacity", () => {
    const { cache, evicted } = cacheWithLog(30);
    cache.set("a", "A", 10);
    cache.set("b", "B", 10);
    cache.set("c", "C", 10);
    cache.set("d", "D", 10);
    expect(evicted).toEqual(["A"]);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.bytes).toBe(30);
  });

  describe("edge cases", () => {
    it("does not double count a key set twice", () => {
      const { cache } = cacheWithLog(100);
      cache.set("a", "A", 10);
      cache.set("a", "A2", 15);
      expect(cache.bytes).toBe(15);
      expect(cache.get("a")).toBe("A2");
    });

    it("keeps a single entry bigger than the capacity on its own", () => {
      const { cache, evicted } = cacheWithLog(20);
      cache.set("a", "A", 10);
      cache.set("big", "BIG", 50);
      expect(evicted).toEqual(["A"]);
      expect(cache.get("big")).toBe("BIG");
      expect(cache.bytes).toBe(50);
    });

    it("evicts several entries in one set while iterating", () => {
      const { cache, evicted } = cacheWithLog(30);
      cache.set("a", "A", 10);
      cache.set("b", "B", 10);
      cache.set("c", "C", 10);
      cache.set("d", "D", 25);
      expect(evicted).toEqual(["A", "B", "C"]);
      expect(cache.bytes).toBe(25);
    });
  });

  describe("invariants", () => {
    it("never holds more than its capacity unless one entry alone is bigger", () => {
      const { cache } = cacheWithLog(64);
      const sizes = [7, 30, 12, 64, 5, 9, 40, 3, 18, 22, 1, 33];
      sizes.forEach((bytes, i) => {
        cache.set(`k${i % 5}`, `v${i}`, bytes);
        expect(cache.bytes <= 64 || cache.bytes === bytes).toBe(true);
      });
    });

    it("refreshes recency on get", () => {
      const { cache, evicted } = cacheWithLog(30);
      cache.set("a", "A", 10);
      cache.set("b", "B", 10);
      cache.set("c", "C", 10);
      cache.get("a");
      cache.set("d", "D", 10);
      expect(evicted).toEqual(["B"]);
      expect(cache.get("a")).toBe("A");
    });

    it("evicts each value once and clears to zero", () => {
      const { cache, evicted } = cacheWithLog(30);
      cache.set("a", "A", 10);
      cache.set("b", "B", 10);
      cache.set("c", "C", 20);
      cache.clear();
      expect(evicted.toSorted()).toEqual(["A", "B", "C"]);
      expect(cache.bytes).toBe(0);
    });
  });
});
