/**
 * @vitest-environment node
 */

import type { LyricLine } from "@/domain/line/model";
import type { SyllableAddress } from "@/domain/selection/model";
import { describe, expect, it } from "vitest";
import { buildCandidateLines } from "./build-candidate-lines";
import { lineWordSelections } from "@/domain/selection/line-selections";

const lineA: LyricLine = {
  id: "a",
  text: "I love you",
  agentId: "v1",
  words: [
    { id: "w1", text: "I", sep: " ", begin: 0, end: 1 },
    { id: "w2", text: "love", sep: " ", begin: 1, end: 2 },
    { id: "w3", text: "you", sep: "", begin: 2, end: 3 },
  ],
};

const lineB: LyricLine = {
  id: "b",
  text: "and so do I",
  agentId: "v1",
  words: [
    { id: "w4", text: "and", sep: " ", begin: 3, end: 4 },
    { id: "w5", text: "so", sep: " ", begin: 4, end: 5 },
    { id: "w6", text: "do", sep: " ", begin: 5, end: 6 },
    { id: "w7", text: "I", sep: "", begin: 6, end: 7 },
  ],
};

const lineWithBg: LyricLine = {
  id: "c",
  text: "main",
  agentId: "v1",
  words: [{ id: "w8", text: "main", sep: "", begin: 0, end: 1 }],
  backgroundText: "bg",
  backgroundWords: [{ id: "w9", text: "bg", sep: "", begin: 0.5, end: 1 }],
};

function selectAll(line: LyricLine): SyllableAddress[] {
  return lineWordSelections(line);
}

describe("buildCandidateLines", () => {
  it("returns the lines in order when every word is selected", () => {
    const lines = [lineA, lineB];
    const sel = [...selectAll(lineA), ...selectAll(lineB)];
    const result = buildCandidateLines(lines, sel);
    expect(result?.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("preserves lineIndex order when selection is built out of order", () => {
    const lines = [lineA, lineB];
    const sel = [...selectAll(lineB), ...selectAll(lineA)];
    const result = buildCandidateLines(lines, sel);
    expect(result?.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("returns undefined when only some words of a line are selected", () => {
    const lines = [lineA];
    const sel: SyllableAddress[] = [{ lineId: "a", type: "word", syllableId: "w1" }];
    expect(buildCandidateLines(lines, sel)).toBeUndefined();
  });

  it("requires every bg word to be selected when bg track has words", () => {
    const lines = [lineWithBg];
    const sel: SyllableAddress[] = [{ lineId: "c", type: "word", syllableId: "w8" }];
    expect(buildCandidateLines(lines, sel)).toBeUndefined();
  });

  it("returns the line when both main and bg words are fully selected", () => {
    const lines = [lineWithBg];
    const sel: SyllableAddress[] = [
      { lineId: "c", type: "word", syllableId: "w8" },
      { lineId: "c", type: "bg", syllableId: "w9" },
    ];
    expect(buildCandidateLines(lines, sel)?.map((l) => l.id)).toEqual(["c"]);
  });

  it("returns undefined for an empty selection", () => {
    expect(buildCandidateLines([lineA], [])).toBeUndefined();
  });

  it("returns undefined when a selected line is missing from project", () => {
    const sel: SyllableAddress[] = [{ lineId: "ghost", type: "word", syllableId: "w1" }];
    expect(buildCandidateLines([lineA], sel)).toBeUndefined();
  });
});
