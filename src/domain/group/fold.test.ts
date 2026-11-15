import { describe, expect, it } from "vitest";
import { docFromFlatLines } from "@/domain/group/doc-from-flat-lines";
import { flattenBody } from "@/domain/group/flatten";
import { foldLines } from "@/domain/group/fold";
import type { Instance, LyricDoc } from "insync/group";
import type { LyricLine } from "insync/line";
import { mainTrack, timedSyllables } from "insync/line-track";
import { withMainTrack, withTrackWords } from "@/domain/line/track-writes";
import { EDITED_TTML_PROJECTS } from "@/test/edited-ttml-projects";
import { createGroup, createLine } from "@/test/factories";
import { song } from "@/test/shared-timing-sync";

const chorus = createGroup({ id: "chorus", sharesTiming: true });

const glowLine = (instanceIdx: number, begin: number, words = ["We", "glow", "tonight"]) =>
  createLine({
    id: `glow-${instanceIdx}`,
    groupId: "chorus",
    instanceIdx,
    templateLineIdx: 0,
    words: words.map((text, index) => ({
      text,
      sep: index < words.length - 1 ? " " : "",
      begin: begin + index * 0.5,
      end: begin + index * 0.5 + 0.5,
    })),
  });

const FOLD_DEFAULTS = { carriesTemplateEdits: true, songEnd: Number.POSITIVE_INFINITY } as const;

const instances = (doc: LyricDoc) => Object.values(doc.instances);

function nudged(line: LyricLine, wordIndex: number, delta: number): LyricLine {
  const words = timedSyllables(mainTrack(line)).map((word, index) =>
    index === wordIndex ? { ...word, begin: word.begin + delta, end: word.end + delta } : word,
  );
  return withMainTrack(line, withTrackWords(mainTrack(line), words));
}

const glowBegin = (line: LyricLine) => timedSyllables(mainTrack(line))[1].begin;

describe("foldLines", () => {
  it("flat lines survive a fold and a flatten", () => {
    const projects = [
      ...EDITED_TTML_PROJECTS.map((project) => project().lines),
      song({ first: "word", second: "word", secondBegin: 40 }),
      song({ first: "word", second: "line", secondBegin: 40 }),
      song({ first: "word" }),
    ];
    for (const lines of projects) {
      expect(flattenBody(structuredClone(docFromFlatLines(lines)))).toEqual(lines);
    }
  });

  it("a timing edit in one shared instance moves the same syllable in every shared instance", () => {
    const lines = [glowLine(0, 10), glowLine(1, 40), glowLine(2, 70)];
    const doc = docFromFlatLines(lines);
    const after = lines.with(1, nudged(lines[1], 1, 0.125));
    const folded = foldLines({
      doc,
      after,
      touched: ["glow-1"],
      groups: [chorus],
      copiesSharedTiming: true,
      ...FOLD_DEFAULTS,
    });
    expect(folded.lines.map(glowBegin)).toEqual([10.625, 40.625, 70.625]);
    expect(folded.copiedGroupIds).toEqual(["chorus"]);
    expect(instances(folded.doc).map((instance) => instance.at)).toEqual([10, 40, 70]);
    expect(instances(folded.doc).some((instance) => instance.ownTiming || instance.replaced)).toBe(false);
  });

  it("an instance that keeps its own timing does not follow the template", () => {
    const lines = [glowLine(0, 10), glowLine(1, 40)];
    const group = createGroup({ id: "chorus", sharesTiming: true, ownTimingInstances: [1] });
    const after = lines.with(0, nudged(lines[0], 1, 0.25));
    const folded = foldLines({
      doc: docFromFlatLines(lines),
      after,
      touched: ["glow-0"],
      groups: [group],
      copiesSharedTiming: true,
      ...FOLD_DEFAULTS,
    });
    expect(folded.lines[1]).toBe(lines[1]);
  });

  it("a structure that the template cannot hold falls back to a replaced line", () => {
    const lines = [glowLine(0, 10), glowLine(1, 40, ["We", "glow"])];
    const second = instances(docFromFlatLines(lines))[1] as Instance;
    expect(second.replaced?.[0]).toBe(lines[1]);
  });

  it("a shared edit that would take a copy below zero keeps the edit and moves that copy alone", () => {
    const lines = [glowLine(0, 10), glowLine(1, 0.25)];
    const after = lines.with(0, nudged(lines[0], 0, -0.5));
    const folded = foldLines({
      doc: docFromFlatLines(lines),
      after,
      touched: ["glow-0"],
      groups: [chorus],
      copiesSharedTiming: true,
      ...FOLD_DEFAULTS,
    });
    expect(folded.lines.map((line) => timedSyllables(mainTrack(line))[0].begin)).toEqual([9.5, 0]);
  });

  it("a nudge that would put a copy past the song end keeps the nudge and moves that copy alone, whole", () => {
    const lines = [glowLine(0, 10), glowLine(1, 40), glowLine(2, 70)];
    const after = lines.with(0, nudged(lines[0], 2, 0.25));
    const folded = foldLines({
      doc: docFromFlatLines(lines),
      after,
      touched: ["glow-0"],
      groups: [chorus],
      copiesSharedTiming: true,
      carriesTemplateEdits: true,
      songEnd: 71.6,
    });
    const begins = (index: number) => folded.lines.map((line) => timedSyllables(mainTrack(line))[index].begin);
    begins(2).forEach((begin, index) => expect(begin).toBeCloseTo([11.25, 41.25, 71.1][index], 9));
    begins(0).forEach((begin, index) => expect(begin).toBeCloseTo([10, 40, 69.85][index], 9));
  });

  it("regression: two shared instances edited differently in one command each keep their own edit", () => {
    const lines = [glowLine(0, 10), glowLine(1, 40), glowLine(2, 70)];
    const renamed = (line: LyricLine, text: string) => {
      const words = timedSyllables(mainTrack(line)).map((word, index) => (index === 1 ? { ...word, text } : word));
      return withMainTrack(line, withTrackWords(mainTrack(line), words));
    };
    const after = lines.with(0, renamed(lines[0], "shine")).with(2, renamed(lines[2], "burn"));
    const folded = foldLines({
      doc: docFromFlatLines(lines),
      after,
      touched: ["glow-0", "glow-2"],
      groups: [chorus],
      copiesSharedTiming: true,
      ...FOLD_DEFAULTS,
    });
    expect(folded.lines.map((line) => timedSyllables(mainTrack(line))[1].text)).toEqual(["shine", "shine", "burn"]);
    expect(flattenBody(structuredClone(folded.doc))).toEqual(folded.lines);
  });

  it("regression: a line inserted inside an instance keeps its later lines in the group copy", () => {
    const member = (instanceIdx: number, slot: number, begin: number) =>
      createLine({
        id: `a${instanceIdx}-${slot}`,
        groupId: "chorus",
        instanceIdx,
        templateLineIdx: slot,
        words: [
          { text: "Paper", sep: " ", begin, end: begin + 0.5 },
          { text: "lanterns", begin: begin + 0.5, end: begin + 1 },
        ],
      });
    const lines = [
      member(0, 0, 10),
      member(0, 1, 12),
      member(0, 2, 14),
      member(1, 0, 40),
      member(1, 1, 42),
      member(1, 2, 44),
    ];
    const inserted = lines.toSpliced(4, 0, createLine({ id: "between", text: "Drifting slow" }));
    const afterInsert = foldLines({
      doc: docFromFlatLines(lines),
      after: inserted,
      touched: ["between"],
      groups: [chorus],
      copiesSharedTiming: false,
      ...FOLD_DEFAULTS,
    });
    const nudgedLines = afterInsert.lines.with(1, nudged(afterInsert.lines[1], 1, 0.25));
    const folded = foldLines({
      doc: afterInsert.doc,
      after: nudgedLines,
      touched: ["a0-1"],
      groups: [chorus],
      copiesSharedTiming: true,
      ...FOLD_DEFAULTS,
    });
    expect(glowBegin(folded.lines[5])).toBe(42.75);
    expect(flattenBody(structuredClone(folded.doc))).toEqual(folded.lines);
  });

  it("an instance within a millisecond of its template at its anchor reads as placed", () => {
    const oneMsLate = nudged(glowLine(1, 40), 1, 0.001);
    const tooLate = nudged(glowLine(2, 70), 1, 0.002);
    expect(instances(docFromFlatLines([glowLine(0, 10), oneMsLate, tooLate])).map((instance) => instance.at)).toEqual([
      10,
      40,
      undefined,
    ]);
  });

  it("a shared copy writes timing and readings only, keeping the copy's own syllables", () => {
    const lines = [glowLine(0, 10), glowLine(1, 40)];
    const doc = docFromFlatLines(lines);
    const split = (line: LyricLine, begin: number) =>
      createLine({
        id: line.id,
        groupId: "chorus",
        instanceIdx: line.instanceIdx,
        templateLineIdx: 0,
        words: [
          { text: "We", sep: " ", begin, end: begin + 0.5 },
          { text: "glow", sep: " ", begin: begin + 0.75, end: begin + 1 },
          { text: "to", begin: begin + 1, end: begin + 1.5, joinsNext: true },
          { text: "night", begin: begin + 1.5, end: begin + 2 },
        ],
      });
    const after = [split(lines[0], 10), split(lines[1], 40)];
    const ownIds = mainTrack(after[1]).syllables.map((syllable) => syllable.id);
    const folded = foldLines({
      doc,
      after,
      touched: ["glow-0", "glow-1"],
      groups: [chorus],
      copiesSharedTiming: true,
      ...FOLD_DEFAULTS,
    });
    expect(mainTrack(folded.lines[1]).syllables.map((syllable) => syllable.id)).toEqual(ownIds);
  });

  it("a line edit outside a group keeps that group's instances and template", () => {
    const lines = [glowLine(0, 10), createLine({ id: "verse", text: "Lanterns over water" }), glowLine(1, 40)];
    const doc = docFromFlatLines(lines);
    const edited = createLine({ id: "verse", text: "Lanterns over the water" });
    for (const after of [lines.with(1, edited), lines.toSpliced(1, 0, createLine({ id: "new", text: "Ash" }))]) {
      const folded = foldLines({
        doc,
        after,
        touched: [],
        groups: [chorus],
        copiesSharedTiming: false,
        ...FOLD_DEFAULTS,
      });
      expect(folded.doc.templates.chorus).toBe(doc.templates.chorus);
      expect(instances(folded.doc)).toEqual(instances(doc));
      instances(folded.doc).forEach((instance, index) => expect(instance).toBe(instances(doc)[index]));
    }
  });
});
