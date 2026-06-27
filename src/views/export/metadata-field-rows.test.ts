import { describe, expect, it } from "vitest";
import { reconcileRows, sameStrings, seedRows } from "@/views/export/metadata-field-rows";

describe("seedRows", () => {
  it("maps each value to a row with a unique id", () => {
    const rows = seedRows(["a", "b", "c"]);
    expect(rows.map((r) => r.value)).toEqual(["a", "b", "c"]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
  });

  describe("edge cases", () => {
    it("returns an empty array for no values", () => {
      expect(seedRows([])).toEqual([]);
    });

    it("preserves empty strings and gives duplicate values distinct ids", () => {
      const rows = seedRows(["", "x", "x"]);
      expect(rows.map((r) => r.value)).toEqual(["", "x", "x"]);
      expect(new Set(rows.map((r) => r.id)).size).toBe(3);
    });
  });
});

describe("sameStrings", () => {
  it("is true for equal contents in the same order", () => {
    expect(sameStrings(["a", "b"], ["a", "b"])).toBe(true);
  });

  describe("edge cases", () => {
    it("is true for two empty arrays", () => {
      expect(sameStrings([], [])).toBe(true);
    });

    it("is false on length mismatch", () => {
      expect(sameStrings(["a"], ["a", "b"])).toBe(false);
    });

    it("is order-sensitive", () => {
      expect(sameStrings(["a", "b"], ["b", "a"])).toBe(false);
    });

    it("distinguishes empty string from missing element", () => {
      expect(sameStrings([""], [])).toBe(false);
    });
  });
});

describe("reconcileRows", () => {
  it("preserves row identity for unchanged positions", () => {
    const previous = seedRows(["a", "b"]);
    const next = reconcileRows(previous, ["a", "b"]);
    expect(next[0]).toBe(previous[0]);
    expect(next[1]).toBe(previous[1]);
  });

  it("keeps the stable id at a position whose value changed", () => {
    const previous = seedRows(["a", "b"]);
    const next = reconcileRows(previous, ["a", "B"]);
    expect(next[1].id).toBe(previous[1].id);
    expect(next[1].value).toBe("B");
    expect(next[1]).not.toBe(previous[1]);
  });

  describe("edge cases", () => {
    it("mints ids for values beyond the previous length", () => {
      const previous = seedRows(["a"]);
      const next = reconcileRows(previous, ["a", "b"]);
      expect(next[0]).toBe(previous[0]);
      expect(next[1].value).toBe("b");
      expect(next[1].id).not.toBe(previous[0].id);
    });

    it("truncates when fewer values than before", () => {
      const previous = seedRows(["a", "b", "c"]);
      const next = reconcileRows(previous, ["a"]);
      expect(next).toHaveLength(1);
      expect(next[0]).toBe(previous[0]);
    });

    it("reseeds to empty when all values are gone", () => {
      expect(reconcileRows(seedRows(["a", "b"]), [])).toEqual([]);
    });

    it("reseeds from empty previous rows", () => {
      const next = reconcileRows([], ["a", "b"]);
      expect(next.map((r) => r.value)).toEqual(["a", "b"]);
      expect(new Set(next.map((r) => r.id)).size).toBe(2);
    });
  });

  describe("invariants", () => {
    it("output length always matches the incoming values", () => {
      const previous = seedRows(["a", "b", "c"]);
      for (const values of [[], ["a"], ["a", "b", "c", "d"], ["x", "y"]]) {
        expect(reconcileRows(previous, values)).toHaveLength(values.length);
      }
    });

    it("does not mutate the previous rows", () => {
      const previous = seedRows(["a", "b"]);
      const snapshot = previous.map((r) => ({ ...r }));
      reconcileRows(previous, ["a", "B", "c"]);
      expect(previous).toEqual(snapshot);
    });
  });
});
