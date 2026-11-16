/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { extractBackgroundVocals } from "insync/background-vocal-extraction";
import type { LyricLine } from "insync/line";
import { reconcileMatchedTiming } from "insync/line-reconcile-text";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";
import { createLine } from "@/test/factories";
import { canExtractBackgroundVocals } from "./can-extract-background";

describe("canExtractBackgroundVocals", () => {
  it("regression: a template line one linked instance refuses to extract offers no extraction", () => {
    const options = { mergeStandaloneLines: true, preserveBrackets: true };
    const refusing = createLine({
      id: "a",
      text: "paper (oh)",
      groupId: "g",
      instanceIdx: 0,
      templateLineIdx: 0,
      words: [
        { text: "paper", sep: " ", begin: 1, end: 2 },
        { text: "(oh)", begin: 2, end: 3 },
      ],
      backgroundText: "ah",
      backgroundWords: [{ text: "ah", begin: 2, end: 2.5 }],
    });
    const between = createLine({ id: "x", text: "harbour lights" });
    const extractable = createLine({ id: "b", text: "paper (oh)", groupId: "g", instanceIdx: 1, templateLineIdx: 0 });
    const lines = [refusing, between, extractable];

    expect(extractBackgroundVocals(lines, options, DEFAULT_SPLIT_CHARACTER)).toEqual(lines);
    expect(canExtractBackgroundVocals(lines, options, DEFAULT_SPLIT_CHARACTER)).toBe(false);
  });

  it("regression: brackets typed after a word-synced line offer extraction only while it has no background", () => {
    const options = { mergeStandaloneLines: true, preserveBrackets: true };
    const words = [
      { text: "Silver", sep: " ", begin: 8, end: 8.5 },
      { text: "birds", begin: 8.5, end: 9 },
    ];
    const typedOn = (line: LyricLine) => reconcileMatchedTiming(line, "Silver birds (fly)", DEFAULT_SPLIT_CHARACTER);
    const bare = typedOn(createLine({ id: "a", words }));
    const withBackground = typedOn(
      createLine({ id: "b", words, backgroundText: "soar", backgroundWords: [{ text: "soar", begin: 8.6, end: 9 }] }),
    );

    expect(canExtractBackgroundVocals([bare], options, DEFAULT_SPLIT_CHARACTER)).toBe(true);
    expect(canExtractBackgroundVocals([withBackground], options, DEFAULT_SPLIT_CHARACTER)).toBe(false);
  });
});
