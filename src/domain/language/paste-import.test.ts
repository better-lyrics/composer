import { alignPastedLanguageLines } from "@/domain/language/paste-import";
import { describe, expect, it } from "vitest";

describe("pasted language line alignment", () => {
  it("preserves blank rows when all line positions match", () => {
    expect(alignPastedLanguageLines("one\n\nthree", ["a", "", "c"])).toMatchObject({
      strategy: "preserve",
      mappedLines: ["one", "", "three"],
    });
  });

  it("ignores pasted blank rows when compact content matches nonempty lyrics", () => {
    expect(alignPastedLanguageLines("one\n\nthree\n", ["a", "b"])).toMatchObject({
      strategy: "compact",
      mappedLines: ["one", "three"],
    });
  });

  it("returns an editable best-effort mapping on mismatched counts", () => {
    expect(alignPastedLanguageLines("one\ntwo\nthree", ["a", "b"])).toMatchObject({
      strategy: "manual",
      mappedLines: ["one", "two"],
      pastedLineCount: 3,
    });
  });

  it("warns with each count in the singular or plural it needs", () => {
    expect(alignPastedLanguageLines("one", ["a", "b"]).warning).toBe(
      "You pasted 1 line for 2 lyric lines. Fix the matches below before importing.",
    );
    expect(alignPastedLanguageLines("one\ntwo", ["a"]).warning).toBe(
      "You pasted 2 lines for 1 lyric line. Fix the matches below before importing.",
    );
  });
});
