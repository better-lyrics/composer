import { mainBounds } from "@/domain/line/bounds";
import { reconcileLine, type LooseLine, type LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import { hasAnyTiming, isLineSynced, isWordSynced } from "@/domain/line/predicates";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- isLineSynced -------------------------------------------------------------

describe("isLineSynced", () => {
  it("returns true when begin and end are set and no words", () => {
    expect(isLineSynced(line({ begin: 1, end: 2 }))).toBe(true);
  });

  it("returns false when words array has items, even if begin/end set", () => {
    expect(isLineSynced(line({ begin: 1, end: 2, words: [{ text: "Hi", begin: 1, end: 2 }] }))).toBe(false);
  });

  it("returns false for a word-synced line with an empty words array", () => {
    expect(isLineSynced(line({ words: [] }))).toBe(false);
  });

  it("returns false when no timing at all", () => {
    expect(isLineSynced(line())).toBe(false);
  });

  it("returns false when only begin is set", () => {
    expect(isLineSynced(line({ begin: 1 }))).toBe(false);
  });

  it("returns false when only end is set", () => {
    expect(isLineSynced(line({ end: 2 }))).toBe(false);
  });

  it("a line it reports true for carries readable begin and end bounds", () => {
    const l = line({ begin: 1, end: 2 });
    expect(isLineSynced(l)).toBe(true);
    const bounds = mainBounds(l);
    expect(bounds?.begin).toBe(1);
    expect(bounds?.end).toBe(2);
  });
});

// -- isWordSynced -------------------------------------------------------------

describe("isWordSynced", () => {
  it("returns true when words has items", () => {
    expect(isWordSynced(line({ words: [{ text: "Hi", begin: 1, end: 2 }] }))).toBe(true);
  });

  it("returns false when words is undefined", () => {
    expect(isWordSynced(line())).toBe(false);
  });

  it("returns false when words is empty array", () => {
    expect(isWordSynced(line({ words: [] }))).toBe(false);
  });

  it("returns true even if begin/end also set (words wins)", () => {
    expect(isWordSynced(line({ begin: 1, end: 2, words: [{ text: "Hi", begin: 1, end: 2 }] }))).toBe(true);
  });
});

// -- hasAnyTiming -------------------------------------------------------------

describe("hasAnyTiming", () => {
  it("returns false when no timing at all", () => {
    expect(hasAnyTiming(line())).toBe(false);
  });

  it("returns true when only line-synced", () => {
    expect(hasAnyTiming(line({ begin: 1, end: 2 }))).toBe(true);
  });

  it("returns true when only word-synced", () => {
    expect(hasAnyTiming(line({ words: [{ text: "Hi", begin: 1, end: 2 }] }))).toBe(true);
  });

  it("returns true when only background words", () => {
    expect(hasAnyTiming(line({ backgroundWords: [{ text: "ah", begin: 1, end: 2 }] }))).toBe(true);
  });

  it("returns false when background is text only with no words", () => {
    expect(hasAnyTiming(line({ backgroundText: "ah" }))).toBe(false);
  });

  it("returns false when only begin is set (incomplete line-sync)", () => {
    expect(hasAnyTiming(line({ begin: 1 }))).toBe(false);
  });

  it("returns false when only end is set", () => {
    expect(hasAnyTiming(line({ end: 2 }))).toBe(false);
  });

  it("returns false when only empty words and bgWords arrays", () => {
    expect(hasAnyTiming(line({ words: [], backgroundWords: [] }))).toBe(false);
  });
});
