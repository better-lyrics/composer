/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { lcsPairs, wordKey } from "@/domain/word/alignment";

describe("wordKey", () => {
  it("strips trailing whitespace", () => {
    expect(wordKey("love ")).toBe("love");
  });
  it("returns the bare word when no surrounding chars", () => {
    expect(wordKey("you")).toBe("you");
  });
  it("treats split-character variants as the same key", () => {
    // stripSplitCharacter removes the syllable split marker
    expect(wordKey("li ght")).toBe(wordKey("li ght "));
  });
});

describe("lcsPairs", () => {
  it("returns matching index pairs in order", () => {
    expect(lcsPairs(["a", "b", "c"], ["a", "b", "c"])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });
  it("handles inserts", () => {
    expect(lcsPairs(["a", "c"], ["a", "b", "c"])).toEqual([
      [0, 0],
      [1, 2],
    ]);
  });
  it("handles deletions", () => {
    expect(lcsPairs(["a", "b", "c"], ["a", "c"])).toEqual([
      [0, 0],
      [2, 1],
    ]);
  });
  it("handles substitutions (no match)", () => {
    expect(lcsPairs(["a", "b"], ["x", "y"])).toEqual([]);
  });
  it("handles empty inputs", () => {
    expect(lcsPairs([], ["a"])).toEqual([]);
    expect(lcsPairs(["a"], [])).toEqual([]);
    expect(lcsPairs([], [])).toEqual([]);
  });
});
