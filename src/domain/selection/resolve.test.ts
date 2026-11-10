import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { resolveSelections } from "@/domain/selection/resolve";
import { createLine } from "@/test/factories";

const line = (id: string, words: string[]): LyricLine =>
  createLine({ id, text: words.join(" "), words: words.map((text, i) => ({ text, begin: i, end: i + 0.5 })) });

describe("resolveSelections", () => {
  it("follows a line that moved and drops words that no longer exist", () => {
    const lines = [line("new", ["fresh"]), line("a", ["one", "two"])];
    const stale = [
      { lineId: "a", lineIndex: 0, wordIndex: 1, type: "word" as const },
      { lineId: "a", lineIndex: 0, wordIndex: 2, type: "word" as const },
      { lineId: "gone", lineIndex: 3, wordIndex: 0, type: "word" as const },
    ];
    expect(resolveSelections(lines, stale)).toEqual([{ lineId: "a", lineIndex: 1, wordIndex: 1, type: "word" }]);
  });
});
