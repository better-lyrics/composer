import { describe, expect, it } from "vitest";
import {
  duplicateKeyIds,
  isReservedExtraKey,
  pairsToRecord,
  reconcilePairs,
  sameRecord,
  seedPairs,
} from "@/views/export/extra-field-pairs";

describe("seedPairs", () => {
  it("maps each entry to a pair with a unique id", () => {
    const pairs = seedPairs({ a: "1", b: "2" });
    expect(pairs.map(({ key, value }) => ({ key, value }))).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ]);
    expect(new Set(pairs.map((p) => p.id)).size).toBe(2);
  });

  describe("edge cases", () => {
    it("returns an empty array for an empty record", () => {
      expect(seedPairs({})).toEqual([]);
    });
  });
});

describe("pairsToRecord", () => {
  it("drops pairs with blank keys", () => {
    expect(pairsToRecord([{ id: "1", key: "  ", value: "x" }])).toEqual({});
  });

  it("keeps the first of two rows sharing a key, so the visible order decides", () => {
    const record = pairsToRecord([
      { id: "1", key: "k", value: "first" },
      { id: "2", key: "k", value: "second" },
    ]);
    expect(record).toEqual({ k: "first" });
  });

  it("trims a key before storing it so padding cannot fork one field into two", () => {
    const record = pairsToRecord([{ id: "1", key: "  producer  ", value: "Rick" }]);
    expect(record).toEqual({ producer: "Rick" });
  });

  it("reports the losing row of a duplicate key", () => {
    const duplicates = duplicateKeyIds([
      { id: "1", key: "k", value: "first" },
      { id: "2", key: " k ", value: "second" },
      { id: "3", key: "other", value: "x" },
    ]);
    expect([...duplicates]).toEqual(["2"]);
  });

  it("reports no duplicates for blank or reserved keys", () => {
    const duplicates = duplicateKeyIds([
      { id: "1", key: "", value: "a" },
      { id: "2", key: "", value: "b" },
      { id: "3", key: "artists", value: "c" },
      { id: "4", key: "artists", value: "d" },
    ]);
    expect([...duplicates]).toEqual([]);
  });

  it("keeps a blank value under a real key", () => {
    expect(pairsToRecord([{ id: "1", key: "k", value: "" }])).toEqual({ k: "" });
  });
});

describe("sameRecord", () => {
  it("is true regardless of key order", () => {
    expect(sameRecord({ a: "1", b: "2" }, { b: "2", a: "1" })).toBe(true);
  });

  describe("edge cases", () => {
    it("is true for two empty records", () => {
      expect(sameRecord({}, {})).toBe(true);
    });

    it("is false when a key is missing", () => {
      expect(sameRecord({ a: "1" }, { a: "1", b: "2" })).toBe(false);
    });

    it("is false when a value differs", () => {
      expect(sameRecord({ a: "1" }, { a: "2" })).toBe(false);
    });
  });
});

describe("reconcilePairs", () => {
  it("preserves pair identity for unchanged positions", () => {
    const previous = seedPairs({ a: "1", b: "2" });
    const next = reconcilePairs(previous, { a: "1", b: "2" });
    expect(next[0]).toBe(previous[0]);
    expect(next[1]).toBe(previous[1]);
  });

  it("keeps the stable id when only the value changed at a position", () => {
    const previous = seedPairs({ a: "1" });
    const next = reconcilePairs(previous, { a: "2" });
    expect(next[0].id).toBe(previous[0].id);
    expect(next[0].value).toBe("2");
    expect(next[0]).not.toBe(previous[0]);
  });

  describe("edge cases", () => {
    it("mints ids for entries beyond the previous length", () => {
      const previous = seedPairs({ a: "1" });
      const next = reconcilePairs(previous, { a: "1", b: "2" });
      expect(next[0]).toBe(previous[0]);
      expect(next[1].key).toBe("b");
      expect(next[1].id).not.toBe(previous[0].id);
    });

    it("reseeds to empty when the record is cleared", () => {
      expect(reconcilePairs(seedPairs({ a: "1" }), {})).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("output length always matches the incoming entries", () => {
      const previous = seedPairs({ a: "1", b: "2" });
      expect(reconcilePairs(previous, { a: "1", b: "2", c: "3" })).toHaveLength(3);
      expect(reconcilePairs(previous, {})).toHaveLength(0);
    });

    it("does not mutate the previous pairs", () => {
      const previous = seedPairs({ a: "1", b: "2" });
      const snapshot = previous.map((p) => ({ ...p }));
      reconcilePairs(previous, { a: "1", b: "changed", c: "3" });
      expect(previous).toEqual(snapshot);
    });
  });
});

// -- Reserved keys ------------------------------------------------------------

describe("isReservedExtraKey", () => {
  it("flags a key that collides with a dedicated metadata field", () => {
    expect(isReservedExtraKey("songwriter")).toBe(true);
    expect(isReservedExtraKey("album")).toBe(true);
  });

  it("allows an ordinary key", () => {
    expect(isReservedExtraKey("spotifyId")).toBe(false);
  });

  describe("edge cases", () => {
    it("ignores surrounding whitespace", () => {
      expect(isReservedExtraKey("  album  ")).toBe(true);
    });

    it("treats a blank key as not reserved", () => {
      expect(isReservedExtraKey("   ")).toBe(false);
    });

    it("is case sensitive, matching the TTML key exactly", () => {
      expect(isReservedExtraKey("Album")).toBe(false);
    });
  });
});

describe("pairsToRecord reserved-key handling", () => {
  it("drops a reserved key so it can never reach metadata.extra", () => {
    const record = pairsToRecord([
      { id: "1", key: "songwriter", value: "Typed By User" },
      { id: "2", key: "spotifyId", value: "abc" },
    ]);
    expect(record).toEqual({ spotifyId: "abc" });
  });

  describe("invariants", () => {
    it("never emits a key that isReservedExtraKey rejects", () => {
      const record = pairsToRecord([
        { id: "1", key: "album", value: "Deluxe" },
        { id: "2", key: "artists", value: "Injected" },
        { id: "3", key: "musicName", value: "Hijacked" },
        { id: "4", key: "mood", value: "calm" },
      ]);
      for (const key of Object.keys(record)) {
        expect(isReservedExtraKey(key)).toBe(false);
      }
    });
  });
});
