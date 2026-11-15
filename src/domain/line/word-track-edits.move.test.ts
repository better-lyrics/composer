import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { backgroundText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { applyMoveFromBg, applyMoveToBg } from "@/domain/line/word-track-edits";
import { newWordId } from "@/domain/word/id";
/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

// -- Helpers -------------------------------------------------------------------

const DURATION = 30;

function mainLine(overrides: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({
    id: "line-1",
    text: "hello world goodbye",
    agentId: "v1",
    words: [
      { id: newWordId(), text: "hello", sep: " ", begin: 0, end: 1 },
      { id: newWordId(), text: "world", sep: " ", begin: 1, end: 2 },
      { id: newWordId(), text: "goodbye", sep: "", begin: 2, end: 3 },
    ],
    ...overrides,
  });
}

// -- applyMoveToBg -------------------------------------------------------------

describe("applyMoveToBg", () => {
  it("stamps a manual provenance when creating a fresh background", () => {
    const result = applyMoveToBg(mainLine(), [2], 0, DURATION);
    expect(backgroundTrack(result!)?.source).toBe("manual");
    expect(timedSyllables(backgroundTrack(result!)).map((w) => w.text)).toEqual(["goodbye"]);
    expect(backgroundText(result!)).toBe("goodbye");
  });

  it("flips an extraction-sourced background to manual when merging words in", () => {
    const line = mainLine({
      backgroundWords: [{ id: "w1", text: "yeah", sep: "", begin: 5, end: 6 }],
      backgroundText: "yeah",
      backgroundTextSource: "extraction",
    });
    const result = applyMoveToBg(line, [2], 0, DURATION);
    expect(backgroundTrack(result!)?.source).toBe("manual");
  });

  it("moves words into an existing background, keeping main timing intact", () => {
    const line = mainLine({
      backgroundWords: [{ id: "w2", text: "ah", sep: "", begin: 8, end: 9 }],
      backgroundText: "ah",
      backgroundTextSource: "manual",
    });
    const result = applyMoveToBg(line, [2], 0, DURATION);
    expect(timedSyllables(mainTrack(result!)).map((w) => w.text + w.sep)).toEqual(["hello ", "world"]);
    expect(result?.backgroundWords?.length).toBe(2);
  });

  it("returns null when no indices match", () => {
    expect(applyMoveToBg(mainLine(), [], 0, DURATION)).toBeNull();
  });

  it("does not mutate the input line", () => {
    const line = mainLine();
    const snapshot = structuredClone(line);
    applyMoveToBg(line, [2], 5, DURATION);
    expect(line).toEqual(snapshot);
  });

  it("does not mutate the input line's existing background array", () => {
    const line = mainLine({
      backgroundWords: [{ id: "w3", text: "ah", sep: "", begin: 8, end: 9 }],
      backgroundText: "ah",
      backgroundTextSource: "manual",
    });
    const snapshot = structuredClone(line);
    applyMoveToBg(line, [2], 0, DURATION);
    expect(line).toEqual(snapshot);
  });
});

// -- applyMoveFromBg -----------------------------------------------------------

describe("applyMoveFromBg", () => {
  it("clears all three background fields when no background words remain", () => {
    const line = mainLine({
      backgroundWords: [{ id: "w4", text: "ooh", sep: "", begin: 10, end: 11 }],
      backgroundText: "ooh",
      backgroundTextSource: "extraction",
    });
    const result = applyMoveFromBg(line, [0], 0, DURATION);
    expect(result?.backgroundWords).toBeUndefined();
    expect(result?.backgroundText).toBeUndefined();
    expect(result?.backgroundTextSource).toBeUndefined();
  });

  it("stamps a manual provenance on the surviving background", () => {
    const line = mainLine({
      backgroundWords: [
        { id: "w5", text: "ah", sep: " ", begin: 5, end: 6 },
        { id: "w6", text: "ooh", sep: "", begin: 6, end: 7 },
      ],
      backgroundText: "ahooh",
      backgroundTextSource: "extraction",
    });
    const result = applyMoveFromBg(line, [1], 0, DURATION);
    expect(timedSyllables(backgroundTrack(result!)).map((w) => w.text)).toEqual(["ah"]);
    expect(backgroundText(result!)).toBe("ah");
    expect(backgroundTrack(result!)?.source).toBe("manual");
  });

  it("returns null when no indices match", () => {
    const line = mainLine({
      backgroundWords: [{ id: "w7", text: "ooh", sep: "", begin: 10, end: 11 }],
      backgroundText: "ooh",
    });
    expect(applyMoveFromBg(line, [], 0, DURATION)).toBeNull();
  });

  it("returns null when the line has no background words", () => {
    expect(applyMoveFromBg(mainLine(), [0], 0, DURATION)).toBeNull();
  });

  it("does not mutate the input line", () => {
    const line = mainLine({
      backgroundWords: [
        { id: "w8", text: "ah", sep: " ", begin: 5, end: 6 },
        { id: "w9", text: "ooh", sep: "", begin: 6, end: 7 },
      ],
      backgroundText: "ahooh",
      backgroundTextSource: "extraction",
    });
    const snapshot = structuredClone(line);
    applyMoveFromBg(line, [1], 3, DURATION);
    expect(line).toEqual(snapshot);
  });

  it("keeps the line word-synced after moving a word back to main", () => {
    const line = mainLine({
      begin: 5,
      end: 10,
      words: [],
      backgroundWords: [{ id: "w10", text: "ooh", sep: "", begin: 6, end: 7 }],
      backgroundText: "ooh",
    });
    const result = applyMoveFromBg(line, [0], 0, DURATION);
    expect(result?.words?.length).toBe(1);
    expect(result?.begin).toBeUndefined();
    expect(result?.end).toBeUndefined();
  });
});
