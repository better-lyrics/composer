import { describe, expect, it } from "vitest";
import { docFromFlatLines } from "@/domain/group/doc-from-flat-lines";
import { flattenBody } from "@/domain/group/flatten";
import { foldLines } from "@/domain/group/fold";
import { type Instance, isInstance, type LyricDoc } from "@/domain/group/model";
import type { LyricLine } from "@/domain/line/model";
import { mainTrack, timedSyllables } from "@/domain/line/track";
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

const instances = (doc: LyricDoc) => doc.body.filter(isInstance);

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
    const folded = foldLines({ doc, after, touched: ["glow-1"], groups: [chorus], copiesSharedTiming: true });
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
    });
    expect(folded.lines[1]).toBe(lines[1]);
  });

  it("a structure that the template cannot hold falls back to a replaced line", () => {
    const lines = [glowLine(0, 10), glowLine(1, 40, ["We", "glow"])];
    const second = instances(docFromFlatLines(lines))[1] as Instance;
    expect(second.replaced?.[0]).toBe(lines[1]);
  });

  it("a copy that would go below zero refuses the whole edit", () => {
    const lines = [glowLine(0, 10), glowLine(1, 0.25)];
    const after = lines.with(0, nudged(lines[0], 0, -0.5));
    const folded = foldLines({
      doc: docFromFlatLines(lines),
      after,
      touched: ["glow-0"],
      groups: [chorus],
      copiesSharedTiming: true,
    });
    expect(folded.rejected).toBe(true);
  });
});
