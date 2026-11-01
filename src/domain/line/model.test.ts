import { reconcileLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

const base = { id: "line", text: "hold me close", agentId: "v1" };
const word = { text: "hold ", begin: 1, end: 1.4 };

describe("reconcileLine", () => {
  describe("happy paths", () => {
    it("keeps words and drops begin/end when words has entries", () => {
      expect(reconcileLine({ ...base, words: [word], begin: 0, end: 3 })).toEqual({ ...base, words: [word] });
    });

    it("keeps begin/end on a line without words", () => {
      expect(reconcileLine({ ...base, begin: 0, end: 3 })).toEqual({ ...base, begin: 0, end: 3 });
    });
  });

  describe("edge cases", () => {
    it("treats an empty words array as no words when begin/end are set", () => {
      expect(reconcileLine({ ...base, words: [], begin: 2, end: 4 })).toEqual({ ...base, begin: 2, end: 4 });
    });

    it("turns an empty words array alone into an untimed line", () => {
      expect(reconcileLine({ ...base, words: [] })).toEqual(base);
    });

    it("drops a lone begin without an end", () => {
      expect(reconcileLine({ ...base, begin: 2 })).toEqual(base);
    });
  });

  describe("invariants", () => {
    it("never returns both words and begin/end", () => {
      const result = reconcileLine({ ...base, words: [word], begin: 0, end: 1 });
      expect("begin" in result).toBe(false);
      expect("end" in result).toBe(false);
    });

    it("does not mutate the input line", () => {
      const input = { ...base, words: [], begin: 2, end: 4 };
      const snapshot = structuredClone(input);
      reconcileLine(input);
      expect(input).toEqual(snapshot);
    });
  });
});
