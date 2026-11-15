import { fieldsOfLine } from "insync/line-from-fields";
import { mainTrack } from "insync/line-track";
import { replacedInstances } from "@/domain/group/replaced-instances";
import type { LyricLine } from "insync/line";
import { newBackgroundTrack, withBackgroundTrack, withTrackSpan } from "insync/line-track-writes";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Fixtures -----------------------------------------------------------------

const wordLine = (id: string, instanceIdx: number, begins: number[]) =>
  createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: begins.map((begin, index) => ({ text: index === 0 ? "go " : "now", begin, end: begin + 0.4 })),
  });

const lineSynced = (id: string, instanceIdx: number, begin?: number) =>
  createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    ...(begin === undefined ? {} : { begin, end: begin + 1 }),
  });

const replace = (lines: LyricLine[], id: string, next: LyricLine) =>
  lines.map((line) => (line.id === id ? next : line));

// -- Tests --------------------------------------------------------------------

describe("replacedInstances", () => {
  it("reports an instance whose timed words move", () => {
    const before = [wordLine("a", 0, [10, 10.5]), wordLine("b", 1, [40, 40.8])];
    const after = replace(before, "b", wordLine("b", 1, [40, 40.5]));
    expect(replacedInstances(before, after, DEFAULT_SPLIT_CHARACTER)).toEqual([{ groupId: "g1", instanceIdx: 1 }]);
  });

  it("regression: reports an instance whose line-synced background moves", () => {
    const withSpan = (begin: number) =>
      withBackgroundTrack(lineSynced("b", 1, 40), withTrackSpan(newBackgroundTrack("b"), begin, begin + 0.5));
    const before = [lineSynced("a", 0, 10), withSpan(40.2)];
    const after = replace(before, "b", withSpan(40.4));
    expect(replacedInstances(before, after, DEFAULT_SPLIT_CHARACTER)).toEqual([{ groupId: "g1", instanceIdx: 1 }]);
  });

  it("does not report an instance whose untimed lines are only filled", () => {
    const before = [lineSynced("a", 1, 40), lineSynced("b", 1)];
    const after = replace(before, "b", lineSynced("b", 1, 43));
    expect(replacedInstances(before, after, DEFAULT_SPLIT_CHARACTER)).toEqual([]);
  });

  it("reports a partly synced instance whose synced line moves", () => {
    const before = [lineSynced("a", 1, 40), lineSynced("b", 1)];
    const after = [lineSynced("a", 1, 41), lineSynced("b", 1, 44)];
    expect(replacedInstances(before, after, DEFAULT_SPLIT_CHARACTER)).toEqual([{ groupId: "g1", instanceIdx: 1 }]);
  });

  describe("edge cases", () => {
    it("ignores a change within the 10 ms tolerance", () => {
      const before = [wordLine("b", 1, [40, 40.8])];
      expect(replacedInstances(before, [wordLine("b", 1, [40, 40.805])], DEFAULT_SPLIT_CHARACTER)).toEqual([]);
    });

    it("reports a word-synced line that loses a timed word", () => {
      const before = [wordLine("b", 1, [40, 40.8])];
      expect(replacedInstances(before, [wordLine("b", 1, [40])], DEFAULT_SPLIT_CHARACTER)).toEqual([
        { groupId: "g1", instanceIdx: 1 },
      ]);
    });

    it("does not report the rest of a partly word-synced line being filled", () => {
      const before = [wordLine("b", 1, [40])];
      expect(replacedInstances(before, [wordLine("b", 1, [40, 40.5])], DEFAULT_SPLIT_CHARACTER)).toEqual([]);
    });

    it("reports timed background words that move", () => {
      const background = (begin: number) =>
        createLine({
          ...fieldsOfLine(lineSynced("b", 1, 40), DEFAULT_SPLIT_CHARACTER),
          backgroundWords: [{ text: "oh", begin, end: begin + 0.4 }],
        });
      expect(replacedInstances([background(40.2)], [background(40.6)], DEFAULT_SPLIT_CHARACTER)).toEqual([
        { groupId: "g1", instanceIdx: 1 },
      ]);
    });

    it("ignores lines outside every group and lines that are gone", () => {
      const loose = createLine({ id: "v", text: "walk", begin: 1, end: 2 });
      expect(
        replacedInstances(
          [loose, lineSynced("b", 1, 40)],
          [createLine({ ...fieldsOfLine(loose, DEFAULT_SPLIT_CHARACTER), begin: 5, end: 6 })],
          DEFAULT_SPLIT_CHARACTER,
        ),
      ).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("lists each instance once", () => {
      const before = [
        createLine({ ...fieldsOfLine(lineSynced("a", 1, 40), DEFAULT_SPLIT_CHARACTER), templateLineIdx: 0 }),
        createLine({ ...fieldsOfLine(lineSynced("b", 1, 43), DEFAULT_SPLIT_CHARACTER), templateLineIdx: 1 }),
      ];
      const after = before.map((line) =>
        createLine({
          ...fieldsOfLine(line, DEFAULT_SPLIT_CHARACTER),
          begin: (mainTrack(line).begin ?? 0) + 1,
          end: (mainTrack(line).end ?? 0) + 1,
        }),
      );
      expect(replacedInstances(before, after, DEFAULT_SPLIT_CHARACTER)).toEqual([{ groupId: "g1", instanceIdx: 1 }]);
    });

    it("reports nothing when the lines are the same", () => {
      const lines = [wordLine("a", 0, [10, 10.5])];
      expect(replacedInstances(lines, lines, DEFAULT_SPLIT_CHARACTER)).toEqual([]);
    });
  });
});
