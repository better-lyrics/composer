import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/tracks";
import { type ResolvedAddress, resolvedAt } from "@/domain/selection/resolve";
import { nextCursorSlot, nextStepSlot } from "@/domain/step-timing/step-cursor";
import { createLine } from "@/test/factories";

const everyLine = () => true;

function slot(from: LyricLine[], lineIndex: number, type: WordTrack, wordIndex: number): ResolvedAddress {
  const resolved = resolvedAt(from, lineIndex, type, wordIndex);
  if (!resolved) throw new Error("no word there");
  return resolved;
}
const lines: LyricLine[] = [
  createLine({
    id: "a",
    text: "Paper boats",
    words: [
      { text: "Paper", sep: " ", begin: 14, end: 14.4 },
      { text: "boats", begin: 14.4, end: 14.8 },
    ],
  }),
  createLine({ id: "gap", text: "" }),
  createLine({ id: "b", text: "Counting rain", begin: 17.4, end: 20 }),
];

describe("nextStepSlot", () => {
  it("moves to the next word of the same track", () => {
    expect(nextStepSlot(lines, slot(lines, 0, "word", 0), everyLine)).toEqual(slot(lines, 0, "word", 1));
  });

  it("goes from the last word to the first main word of the next line with blocks, skipping lines without", () => {
    expect(nextStepSlot(lines, slot(lines, 0, "word", 1), everyLine)).toEqual(slot(lines, 2, "word", 0));
  });

  it("skips lines outside the filter, such as lines outside an open group", () => {
    expect(nextStepSlot(lines, slot(lines, 0, "word", 1), (line) => line.id !== "b")).toBeNull();
  });
});

describe("nextCursorSlot with background vocals included", () => {
  const sung: LyricLine[] = [
    createLine({
      id: "lead",
      text: "Hold on",
      words: [
        { text: "Hold", sep: " ", begin: 2, end: 2.4 },
        { text: "on", begin: 2.4, end: 3 },
      ],
      backgroundText: "hold on",
      backgroundWords: [
        { text: "hold", sep: " ", begin: 2.6, end: 3 },
        { text: "on", begin: 3, end: 3.4 },
      ],
    }),
    createLine({ id: "next", text: "Let go", words: [{ text: "Let go", begin: 4, end: 5 }] }),
  ];
  const walk = (from: ResolvedAddress) => nextCursorSlot(sung, from, null, everyLine, true);

  it("goes from the last lead word into the line's background vocals, then on to the next line", () => {
    expect(walk(slot(sung, 0, "word", 1))).toEqual(slot(sung, 0, "bg", 0));
    expect(walk(slot(sung, 0, "bg", 1))).toEqual(slot(sung, 1, "word", 0));
  });
});
