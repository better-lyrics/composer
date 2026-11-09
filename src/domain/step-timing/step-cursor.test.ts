import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { nextStepSlot } from "@/domain/step-timing/step-cursor";
import { createLine } from "@/test/factories";

const everyLine = () => true;
const lines: LyricLine[] = [
  createLine({
    id: "a",
    text: "Paper boats",
    words: [
      { text: "Paper ", begin: 14, end: 14.4 },
      { text: "boats", begin: 14.4, end: 14.8 },
    ],
  }),
  createLine({ id: "gap", text: "" }),
  createLine({ id: "b", text: "Counting rain", begin: 17.4, end: 20 }),
];

describe("nextStepSlot", () => {
  it("moves to the next word of the same track", () => {
    expect(nextStepSlot(lines, { lineId: "a", lineIndex: 0, wordIndex: 0, type: "word" }, everyLine)).toEqual({
      lineId: "a",
      lineIndex: 0,
      wordIndex: 1,
      type: "word",
    });
  });

  it("goes from the last word to the first main word of the next line with blocks, skipping lines without", () => {
    expect(nextStepSlot(lines, { lineId: "a", lineIndex: 0, wordIndex: 1, type: "word" }, everyLine)).toEqual({
      lineId: "b",
      lineIndex: 2,
      wordIndex: 0,
      type: "word",
    });
  });

  it("skips lines outside the filter, such as lines outside an open group", () => {
    expect(
      nextStepSlot(lines, { lineId: "a", lineIndex: 0, wordIndex: 1, type: "word" }, (line) => line.id !== "b"),
    ).toBeNull();
  });

  it("goes through the line's background words before the next line, like background lines in AMLL", () => {
    const withEcho = [
      createLine({
        id: "e",
        text: "Hold the light",
        words: [
          { text: "Hold ", begin: 30, end: 30.4 },
          { text: "light", begin: 30.4, end: 31 },
        ],
        backgroundText: "oh oh",
        backgroundWords: [
          { text: "oh ", begin: 31, end: 31.3 },
          { text: "oh", begin: 31.3, end: 31.8 },
        ],
      }),
      lines[2],
    ];
    expect(nextStepSlot(withEcho, { lineId: "e", lineIndex: 0, wordIndex: 1, type: "word" }, everyLine)).toEqual({
      lineId: "e",
      lineIndex: 0,
      wordIndex: 0,
      type: "bg",
    });
    expect(nextStepSlot(withEcho, { lineId: "e", lineIndex: 0, wordIndex: 1, type: "bg" }, everyLine)).toEqual({
      lineId: "b",
      lineIndex: 1,
      wordIndex: 0,
      type: "word",
    });
  });
});
