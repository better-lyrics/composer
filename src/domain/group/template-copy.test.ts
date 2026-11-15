import { describe, expect, it } from "vitest";
import { docFromFlatLines } from "@/domain/group/doc-from-flat-lines";
import type { LinkGroup } from "insync/group";
import { copyThroughTemplate, instanceAnchors } from "@/domain/group/template-copy";
import { instanceBounds } from "@/domain/instance/bounds";
import { withManualBackgroundWords, withSeededBackground } from "@/domain/line/background";
import { bgBounds, mainBounds } from "insync/line-bounds";
import { drawnSyllables } from "@/domain/line/drawn-track";
import type { LyricLine } from "insync/line";
import { isLineSynced } from "@/domain/line/predicates";
import { lineText } from "@/domain/line/text";
import { mainTrack, roleWords } from "insync/line-track";
import { withAgent } from "@/domain/line/track-writes";
import { chorus } from "@/test/chorus-lines";
import { createGroup, createLine } from "@/test/factories";
import { type FieldPatch, withFields } from "@/test/field-updates";
import { DEFAULT_SPLIT_CHARACTER } from "@/utils/split-character-text";

// The copy as a commit runs it: the doc read from the lines before the edit, each instance at its anchor.
function copiedThroughTemplate(before: LyricLine[], after: LyricLine[], groups: LinkGroup[], touched: string[]) {
  const doc = docFromFlatLines(before, DEFAULT_SPLIT_CHARACTER);
  const anchors = instanceAnchors(doc);
  const copy = copyThroughTemplate({ doc, before, after, groups, touched, anchors, songEnd: Number.POSITIVE_INFINITY });
  return { lines: copy.lines, touchedGroupIds: copy.copiedGroupIds };
}

describe("copyThroughTemplate", () => {
  const sharing = [createGroup({ id: "g1", sharesTiming: true })];

  function edit(lines: LyricLine[], id: string, change: (line: LyricLine) => FieldPatch): LyricLine[] {
    return lines.map((line) => (line.id === id ? withFields(line, change(line)) : line));
  }

  function nudgeWord(wordIdx: number, delta: number) {
    return (line: LyricLine): FieldPatch => ({
      words: roleWords(line, "main")?.map((word, i) =>
        i === wordIdx ? { ...word, begin: word.begin + delta, end: word.end + delta } : word,
      ),
    });
  }

  function relativeTiming(lines: readonly LyricLine[], groupId: string, instanceIdx: number) {
    const members = lines.filter((line) => line.groupId === groupId && line.instanceIdx === instanceIdx);
    const start = instanceBounds(members)?.begin ?? 0;
    const round = (time: number) => Math.round((time - start) * 1e6) / 1e6;
    return members.map((line) => ({
      templateLineIdx: line.templateLineIdx,
      words: roleWords(line, "main")?.map((word) => [round(word.begin), round(word.end)]),
      backgroundWords: roleWords(line, "bg")?.map((word) => [round(word.begin), round(word.end)]),
      begin: isLineSynced(line) ? round(mainBounds(line)!.begin) : undefined,
      end: isLineSynced(line) ? round(mainBounds(line)!.end) : undefined,
    }));
  }

  const byId = (lines: readonly LyricLine[], id: string) => lines.find((line) => line.id === id);
  const times = (line: LyricLine | undefined) =>
    (line && roleWords(line, "main"))?.map((word) => [word.begin, word.end]);
  const expectTimes = (actual: number[][] | undefined, expected: number[][]) => {
    expect(actual).toHaveLength(expected.length);
    expected.forEach(([begin, end], i) => {
      expect(actual?.[i]?.[0]).toBeCloseTo(begin, 6);
      expect(actual?.[i]?.[1]).toBeCloseTo(end, 6);
    });
  };

  it("copies a nudge to every placed shared instance", () => {
    const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
    const after = edit(before, "c0-0", nudgeWord(1, 0.15));
    const result = copiedThroughTemplate(before, after, sharing, ["c0-0"]);
    expect(result.touchedGroupIds).toEqual(["g1"]);
    expectTimes(times(byId(result.lines, "c1-0")), [
      [40, 40.4],
      [40.65, 41.15],
    ]);
  });

  it("copies background words and line-synced lines", () => {
    const lineSynced = (instanceIdx: number, begin: number) =>
      createLine({
        id: `o${instanceIdx}`,
        text: "Oh",
        begin,
        end: begin + 2,
        backgroundText: "ah",
        backgroundWords: [{ text: "ah", begin: begin + 0.5, end: begin + 1 }],
        groupId: "g1",
        instanceIdx,
        templateLineIdx: 1,
      });
    const before = [chorus(0, 0, 10), lineSynced(0, 11), chorus(1, 0, 40), lineSynced(1, 41)];
    const after = edit(before, "o0", (line) => ({
      begin: 11.2,
      end: 13.5,
      backgroundWords: roleWords(line, "bg")?.map((word) => ({ ...word, begin: 12, end: 12.6 })),
    }));
    const copied = byId(copiedThroughTemplate(before, after, sharing, ["o0"]).lines, "o1");
    expect(copied && mainTrack(copied).begin).toBeCloseTo(41.2, 6);
    expect(copied && mainTrack(copied).end).toBeCloseTo(43.5, 6);
    expectTimes(
      (copied && roleWords(copied, "bg"))?.map((word) => [word.begin, word.end]),
      [[42, 42.6]],
    );
  });

  it("copies a moved line-synced background span", () => {
    const lineSynced = (instanceIdx: number, begin: number) =>
      withSeededBackground(
        createLine({
          id: `o${instanceIdx}`,
          text: "Oh",
          begin,
          end: begin + 2,
          backgroundText: "ah",
          groupId: "g1",
          instanceIdx,
          templateLineIdx: 1,
        }),
        DEFAULT_SPLIT_CHARACTER,
      );
    const before = [chorus(0, 0, 10), lineSynced(0, 11), chorus(1, 0, 40), lineSynced(1, 41)];
    const moved = withManualBackgroundWords(
      before[1],
      [{ ...drawnSyllables(before[1], "bg", DEFAULT_SPLIT_CHARACTER)[0], begin: 11.5, end: 12.5 }],
      DEFAULT_SPLIT_CHARACTER,
    );
    const after = before.with(1, moved);
    const copied = byId(copiedThroughTemplate(before, after, sharing, ["o0"]).lines, "o1");
    expect(copied && bgBounds(copied)?.begin).toBeCloseTo(41.5, 6);
    expect(copied && bgBounds(copied)?.end).toBeCloseTo(42.5, 6);
  });

  it("copies only timing fields", () => {
    const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
    const after = edit(before, "c0-0", (line) => ({ ...nudgeWord(1, 0.1)(line), agentId: "v2" }));
    const copied = byId(copiedThroughTemplate(before, after, sharing, ["c0-0"]).lines, "c1-0");
    expect(copied && mainTrack(copied).agentId).toBe(mainTrack(before[1]).agentId);
    expect(lineText(copied!, DEFAULT_SPLIT_CHARACTER)).toBe("I want");
  });

  describe("edge cases", () => {
    it("never copies a line outside the group", () => {
      const outside = createLine({ id: "x", text: "Hey", words: [{ text: "Hey", begin: 5, end: 6 }] });
      const before = [outside, chorus(0, 0, 10), chorus(1, 0, 40)];
      const after = edit(before, "x", () => ({
        words: [{ id: "w1", text: "Hey", sep: "", begin: 5, end: 6.5, joinsNext: false }],
      }));
      const result = copiedThroughTemplate(before, after, sharing, ["x"]);
      expect(result.lines).toBe(after);
      expect(result.touchedGroupIds).toEqual([]);
    });

    it("leaves old groups untouched", () => {
      const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
      const after = edit(before, "c0-0", nudgeWord(1, 0.1));
      expect(copiedThroughTemplate(before, after, [createGroup({ id: "g1" })], ["c0-0"]).lines).toBe(after);
    });

    it("leaves own-timing, detached and unplaced targets untouched", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })];
      const before = [chorus(0, 0, 10), chorus(1, 0, 40), { ...chorus(2, 0, 60), detached: true }, chorus(3, 0)];
      const after = edit(before, "c0-0", nudgeWord(1, 0.1));
      expect(copiedThroughTemplate(before, after, groups, ["c0-0"]).lines).toBe(after);
    });

    it("skips a source whose instance had no start before the edit", () => {
      const before = [chorus(0, 0), chorus(1, 0, 40)];
      const after = edit(before, "c0-0", () => ({
        words: [{ id: "w2", text: "I", sep: " ", begin: 10, end: 10.4, joinsNext: false }],
      }));
      expect(copiedThroughTemplate(before, after, sharing, ["c0-0"]).lines).toBe(after);
    });

    it("copies a clear to placed targets", () => {
      const before = [chorus(0, 0, 10), chorus(0, 1, 12), chorus(1, 0, 40), chorus(1, 1, 42)];
      const after = edit(before, "c0-1", () => ({ words: undefined }));
      const copied = byId(copiedThroughTemplate(before, after, sharing, ["c0-1"]).lines, "c1-1");
      expect(copied && roleWords(copied, "main")).toBeUndefined();
      expect(copied && mainTrack(copied).begin).toBeUndefined();
    });

    it("returns the same array when timing did not change", () => {
      const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
      const after = edit(before, "c0-0", () => ({ agentId: "v2" }));
      expect(copiedThroughTemplate(before, after, sharing, ["c0-0"]).lines).toBe(after);
    });
  });

  describe("regressions", () => {
    it("regression: offsets come from instance starts before the edit", () => {
      const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
      const after = edit(before, "c0-0", nudgeWord(0, 0.05));
      expectTimes(times(byId(copiedThroughTemplate(before, after, sharing, ["c0-0"]).lines, "c1-0")), [
        [40.05, 40.45],
        [40.5, 41],
      ]);
    });

    it("regression: a batch that nudges two instances moves each by the delta once", () => {
      const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
      const after = edit(edit(before, "c0-0", nudgeWord(1, 0.1)), "c1-0", nudgeWord(1, 0.1));
      const lines = copiedThroughTemplate(before, after, sharing, ["c0-0", "c1-0"]).lines;
      expectTimes(times(byId(lines, "c0-0")), [
        [10, 10.4],
        [10.6, 11.1],
      ]);
      expectTimes(times(byId(lines, "c1-0")), [
        [40, 40.4],
        [40.6, 41.1],
      ]);
    });

    it("regression: the first changed instance in line order wins", () => {
      const before = [chorus(1, 0, 10), chorus(0, 0, 40)];
      const after = edit(edit(before, "c1-0", nudgeWord(1, 0.1)), "c0-0", nudgeWord(1, 0.3));
      const lines = copiedThroughTemplate(before, after, sharing, ["c0-0", "c1-0"]).lines;
      expectTimes(times(byId(lines, "c0-0")), [
        [40, 40.4],
        [40.6, 41.1],
      ]);
    });
  });

  describe("instances with different lines", () => {
    it("regression: an instance holding its own line anchors where that line meets the template", () => {
      const otherSinger = withAgent(chorus(1, 1, 54), "v2");
      const before = [chorus(0, 0, 10), chorus(0, 1, 14), otherSinger];
      const after = edit(before, "c0-1", nudgeWord(0, 0.5));
      expectTimes(times(byId(copiedThroughTemplate(before, after, sharing, ["c0-1"]).lines, "c1-1")), [
        [54.5, 54.9],
        [54.5, 55],
      ]);
    });

    it("regression: anchors on lines both instances have when one instance lost a line", () => {
      const before = [chorus(0, 0, 10), chorus(0, 1, 14), chorus(1, 1, 54)];
      const after = edit(before, "c0-1", nudgeWord(0, 0.5));
      expectTimes(times(byId(copiedThroughTemplate(before, after, sharing, ["c0-1"]).lines, "c1-1")), [
        [54.5, 54.9],
        [54.5, 55],
      ]);
    });

    it("regression: an edit from the shorter instance lands on the matching line", () => {
      const before = [chorus(0, 0, 10), chorus(0, 1, 14), chorus(1, 1, 54)];
      const after = edit(before, "c1-1", nudgeWord(0, 0.5));
      expectTimes(times(byId(copiedThroughTemplate(before, after, sharing, ["c1-1"]).lines, "c0-1")), [
        [14.5, 14.9],
        [14.5, 15],
      ]);
      expect(byId(copiedThroughTemplate(before, after, sharing, ["c1-1"]).lines, "c0-0")).toBe(before[0]);
    });
  });

  describe("song start guard", () => {
    it("keeps a batch that would move a copy below zero and moves that copy alone", () => {
      const before = [chorus(0, 0, 10), chorus(1, 0, 0.05)];
      const after = edit(before, "c0-0", nudgeWord(0, -0.2));
      const result = copiedThroughTemplate(before, after, sharing, ["c0-0"]);
      const firstBegins = result.lines.map((line) => roleWords(line, "main")?.[0].begin ?? Number.NaN);
      expect(firstBegins[0]).toBeCloseTo(9.8, 9);
      expect(firstBegins[1]).toBeCloseTo(0, 9);
      expect(result.touchedGroupIds).toEqual(["g1"]);
    });
  });

  describe("invariants", () => {
    const before = [
      chorus(0, 0, 10),
      chorus(0, 1, 11.5),
      createLine({ id: "gap", text: "Between" }),
      chorus(1, 0, 40),
      chorus(1, 1, 41.5),
      chorus(2, 0, 70),
      chorus(2, 1, 71.5),
    ];
    const after = edit(edit(before, "c1-1", nudgeWord(1, 0.2)), "c1-0", nudgeWord(0, -0.1));

    it("keeps every placed shared instance at the same relative timing", () => {
      const lines = copiedThroughTemplate(before, after, sharing, ["c1-1", "c1-0"]).lines;
      expect(relativeTiming(lines, "g1", 0)).toEqual(relativeTiming(lines, "g1", 1));
      expect(relativeTiming(lines, "g1", 2)).toEqual(relativeTiming(lines, "g1", 1));
    });

    it("does not mutate its inputs", () => {
      const beforeSnapshot = structuredClone(before);
      const afterSnapshot = structuredClone(after);
      copiedThroughTemplate(before, after, sharing, ["c1-1", "c1-0"]);
      expect(before).toEqual(beforeSnapshot);
      expect(after).toEqual(afterSnapshot);
    });

    it("changes nothing when run again on its own output", () => {
      const once = copiedThroughTemplate(before, after, sharing, ["c1-1", "c1-0"]).lines;
      const twice = copiedThroughTemplate(before, once, sharing, ["c1-1", "c1-0"]).lines;
      expect(twice).toEqual(once);
    });

    it("keeps lines outside the group by reference", () => {
      const lines = copiedThroughTemplate(before, after, sharing, ["c1-1", "c1-0"]).lines;
      expect(byId(lines, "gap")).toBe(byId(after, "gap"));
    });
  });
});
