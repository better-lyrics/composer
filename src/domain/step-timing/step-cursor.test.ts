import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { nextStepSlot, stepStartSlot } from "@/domain/step-timing/step-cursor";
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
});

describe("stepStartSlot", () => {
  it("starts at the first word of the line that has not ended at the time", () => {
    expect(stepStartSlot(lines, 15.2, everyLine)).toEqual({ lineId: "b", lineIndex: 2, wordIndex: 0, type: "word" });
  });
});
