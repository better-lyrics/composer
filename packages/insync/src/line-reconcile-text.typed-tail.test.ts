import { describe, expect, it } from "vitest";
import type { LyricLine } from "./line";
import { lineFromFields } from "./line-from-fields";
import { reconcileMatchedTiming } from "./line-reconcile-text";
import { lineText } from "./line-text";
import { backgroundTrack, mainTrack, timedSyllables } from "./line-track";
import { withTrackText } from "./line-track-writes";
import { DEFAULT_SPLIT_CHARACTER } from "./split-character-text";

const timedSpans = (line: LyricLine) =>
  timedSyllables(mainTrack(line)).map((word) => [word.text, +word.begin.toFixed(3), +word.end.toFixed(3)]);

describe("reconcileMatchedTiming · words typed after the timed ones", () => {
  describe("regression: a repeated word typed at the end stays an untimed tail", () => {
    const spans = (words: readonly { text: string; begin: number; end: number }[]) =>
      words.map((word) => [word.text, word.begin, word.end]);
    const cases = [
      {
        text: "la la",
        typed: "la la la",
        words: [
          { id: "w1", text: "la", sep: " ", begin: 1, end: 2, joinsNext: false },
          { id: "w2", text: "la", sep: "", begin: 2, end: 3, joinsNext: false },
        ],
        timed: [
          ["la", 1, 2],
          ["la", 2, 3],
        ],
      },
      {
        text: "morning light",
        typed: "morning light light",
        words: [
          { id: "w1", text: "morning", sep: " ", begin: 5, end: 6, joinsNext: false },
          { id: "w2", text: "light", sep: "", begin: 6, end: 7, joinsNext: false },
        ],
        timed: [
          ["morning", 5, 6],
          ["light", 6, 7],
        ],
      },
      {
        text: "la la far",
        typed: "la la la far",
        words: [
          { id: "w1", text: "la", sep: " ", begin: 1, end: 2, joinsNext: false },
          { id: "w2", text: "la", sep: " ", begin: 2, end: 3, joinsNext: false },
        ],
        timed: [
          ["la", 1, 2],
          ["la", 2, 3],
        ],
      },
    ];

    it.each(cases)("on the main track: $text to $typed", ({ text, typed, words, timed }) => {
      const line = lineFromFields({ id: "r", text, agentId: "v1", words }, DEFAULT_SPLIT_CHARACTER);
      const result = reconcileMatchedTiming(line, typed, DEFAULT_SPLIT_CHARACTER);
      expect(timedSpans(result)).toEqual(timed);
      expect(lineText(result, DEFAULT_SPLIT_CHARACTER)).toBe(typed);
    });

    it.each(cases)("on the background track: $text to $typed", ({ text, typed, words, timed }) => {
      const line = lineFromFields(
        { id: "r", text: "steady rain", agentId: "v1", backgroundText: text, backgroundWords: words },
        DEFAULT_SPLIT_CHARACTER,
      );
      const before = backgroundTrack(line);
      if (!before) throw new Error("no background");
      expect(spans(timedSyllables(withTrackText(before, typed, DEFAULT_SPLIT_CHARACTER)))).toEqual(timed);
    });
  });

  it("regression: words typed after the last word of a fully timed line stay untimed, never zero length", () => {
    const line = lineFromFields(
      {
        id: "L2",
        text: "morning light",
        agentId: "v1",
        words: [
          { id: "w1", text: "morning", sep: " ", begin: 5, end: 6, joinsNext: false },
          { id: "w2", text: "light", sep: "", begin: 6, end: 7, joinsNext: false },
        ],
      },
      DEFAULT_SPLIT_CHARACTER,
    );
    const result = reconcileMatchedTiming(line, "morning light (glo|wing sky)", DEFAULT_SPLIT_CHARACTER);
    expect(timedSpans(result)).toEqual([
      ["morning", 5, 6],
      ["light", 6, 7],
    ]);
    expect(lineText(result, DEFAULT_SPLIT_CHARACTER)).toBe("morning light (glo|wing sky)");
  });
});
