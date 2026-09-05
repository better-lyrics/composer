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
});
