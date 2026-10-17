import { describe, expect, it } from "vitest";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LyricLine } from "@/domain/line/model";
import { applyWordMoveAcrossLines } from "@/domain/word/move-across-lines";
import { createGroup, createLine, createWord } from "@/test/factories";

const DURATION = 20;

function chorus(id: string, instanceIdx: number, begin: number): LyricLine {
  return createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });
}

function moveIntoChorus(sharesTiming: boolean) {
  const target = {
    ...chorus("c1", 1, 10),
    backgroundText: "hey",
    backgroundWords: [createWord({ text: "hey", begin: 13, end: 14.5 })],
  };
  const lines = [chorus("c0", 0, 3), target, chorus("c2", 2, 16)];
  const groups = [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })];
  return applyWordMoveAcrossLines(
    lines,
    [
      {
        sourceLineId: "c1",
        sourceWordIndex: 0,
        sourceTrack: "bg",
        targetLineId: "c1",
        targetTrack: "word",
        word: createWord({ text: "hey", begin: 13, end: 14.5 }),
      },
    ],
    timeRangeResolver(lines, groups, DURATION),
  );
}

function targetWords(result: ReturnType<typeof applyWordMoveAcrossLines>) {
  if (!result.ok) throw new Error(`move rejected: ${result.reject}`);
  return result.updates.find((update) => update.id === "c1")?.updates.words ?? [];
}

describe("applyWordMoveAcrossLines with a shared time range", () => {
  it("pulls an overflowing word back inside the target line's range", () => {
    expect(targetWords(moveIntoChorus(true)).at(-1)).toMatchObject({ begin: 12.5, end: 14 });
  });

  describe("regressions", () => {
    it("regression: a target outside a sharing group keeps the song end", () => {
      expect(targetWords(moveIntoChorus(false)).at(-1)).toMatchObject({ begin: 13, end: 14.5 });
    });
  });
});
