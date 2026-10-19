/**
 * @vitest-environment node
 */
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { applyWordDeletion, type DeletionSelection } from "@/views/timeline/apply-word-deletion";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function chorusLine(
  instanceIdx: number,
  offset: number,
  opts: { templateLineIdx?: number; words?: WordTiming[]; detached?: boolean; id?: string } = {},
): LyricLine {
  const templateLineIdx = opts.templateLineIdx ?? 0;
  const words = opts.words ?? [
    { text: "hold ", begin: offset, end: offset + 0.5 },
    { text: "me ", begin: offset + 0.5, end: offset + 1 },
    { text: "now", begin: offset + 1, end: offset + 1.5 },
  ];
  return {
    id: opts.id ?? `c${instanceIdx}-${templateLineIdx}`,
    text: words.map((word) => word.text).join(""),
    agentId: "v1",
    groupId: "g1",
    instanceIdx,
    templateLineIdx,
    ...(opts.detached ? { detached: true } : {}),
    words,
  };
}

const del = (lineId: string, wordIndex: number, type: "word" | "bg" = "word"): DeletionSelection => ({
  lineId,
  type,
  wordIndex,
});

const texts = (line: LyricLine | undefined) => line?.words?.map((word) => word.text);
const byId = (lines: LyricLine[], id: string) => lines.find((line) => line.id === id);

// -- Tests --------------------------------------------------------------------

describe("applyWordDeletion · linked instances", () => {
  it("removes the word from every linked instance", () => {
    const lines = [chorusLine(0, 10), chorusLine(1, 40), chorusLine(2, 70)];

    const result = applyWordDeletion(lines, [del("c1-0", 1)]);

    for (const id of ["c0-0", "c1-0", "c2-0"]) {
      expect(texts(byId(result, id))).toEqual(["hold ", "now"]);
      expect(byId(result, id)?.text).toBe("hold now");
    }
  });

  it("keeps each instance's own timing for the words that remain", () => {
    const lines = [chorusLine(0, 10), chorusLine(1, 40)];

    const result = applyWordDeletion(lines, [del("c0-0", 0)]);

    expect(byId(result, "c1-0")?.words).toEqual([
      { text: "me ", begin: 40.5, end: 41 },
      { text: "now", begin: 41, end: 41.5 },
    ]);
  });

  it("removes background words from every linked instance", () => {
    const withBg = (instanceIdx: number, offset: number): LyricLine => ({
      ...chorusLine(instanceIdx, offset),
      backgroundText: "oh yeah",
      backgroundWords: [
        { text: "oh ", begin: offset, end: offset + 0.5 },
        { text: "yeah", begin: offset + 0.5, end: offset + 1 },
      ],
    });
    const lines = [withBg(0, 10), withBg(1, 40)];

    const result = applyWordDeletion(lines, [del("c0-0", 0, "bg")]);

    expect(byId(result, "c1-0")?.backgroundWords?.map((word) => word.text)).toEqual(["yeah"]);
    expect(texts(byId(result, "c1-0"))).toHaveLength(3);
  });

  it("absorbs a deleted syllable into its neighbor inside each instance", () => {
    const syllables = (offset: number): WordTiming[] => [
      { text: "hel", begin: offset, end: offset + 0.5, syllableGroupId: "s" },
      { text: "lo", begin: offset + 0.5, end: offset + 1, syllableGroupId: "s" },
    ];
    const lines = [chorusLine(0, 10, { words: syllables(10) }), chorusLine(1, 40, { words: syllables(40) })];

    const result = applyWordDeletion(lines, [del("c0-0", 1)]);

    expect(byId(result, "c1-0")?.words).toHaveLength(1);
    expect(byId(result, "c1-0")?.words?.[0]).toMatchObject({ begin: 40, end: 41 });
  });

  describe("an instance the delete empties", () => {
    it("clears and unlinks only that instance", () => {
      const lines = [chorusLine(0, 10), chorusLine(1, 40)];

      const result = applyWordDeletion(lines, [del("c1-0", 0), del("c1-0", 1), del("c1-0", 2)]);

      expect(byId(result, "c1-0")?.words).toBeUndefined();
      expect(byId(result, "c1-0")?.groupId).toBeUndefined();
      expect(byId(result, "c0-0")).toBe(lines[0]);
    });

    it("still spreads a partial delete from another instance in the same pass", () => {
      const lines = [chorusLine(0, 10), chorusLine(1, 40), chorusLine(2, 70)];

      const result = applyWordDeletion(lines, [del("c1-0", 0), del("c1-0", 1), del("c1-0", 2), del("c0-0", 2)]);

      expect(byId(result, "c1-0")?.groupId).toBeUndefined();
      expect(texts(byId(result, "c0-0"))).toEqual(["hold ", "me "]);
      expect(texts(byId(result, "c2-0"))).toEqual(["hold ", "me "]);
    });

    it("spreads a delete on one line of a multi-line instance when the instance keeps other words", () => {
      const lines = [
        chorusLine(0, 10, { templateLineIdx: 0, words: [{ text: "hey", begin: 10, end: 11 }] }),
        chorusLine(0, 12, { templateLineIdx: 1 }),
        chorusLine(1, 40, { templateLineIdx: 0, words: [{ text: "hey", begin: 40, end: 41 }] }),
        chorusLine(1, 42, { templateLineIdx: 1 }),
      ];

      const result = applyWordDeletion(lines, [del("c0-0", 0)]);

      expect(byId(result, "c0-0")?.words).toBeUndefined();
      expect(byId(result, "c1-0")?.words).toBeUndefined();
      expect(byId(result, "c0-0")?.groupId).toBe("g1");
      expect(byId(result, "c1-1")).toBe(lines[3]);
    });
  });

  describe("regressions", () => {
    it("regression: keeps an instance the delete only reached through its link", () => {
      const secondLine = { text: "la", agentId: "v1", groupId: "g1", templateLineIdx: 1 };
      const timedSecond: LyricLine = { ...secondLine, id: "b0", instanceIdx: 0, begin: 12, end: 13 };
      const untimedSecond: LyricLine = { ...secondLine, id: "b1", instanceIdx: 1 };
      const lines = [chorusLine(0, 10), timedSecond, chorusLine(1, 40), untimedSecond];

      const result = applyWordDeletion(lines, [del("c0-0", 0), del("c0-0", 1), del("c0-0", 2)]);

      expect(byId(result, "c1-0")?.words).toBeUndefined();
      expect(byId(result, "c1-0")?.groupId).toBe("g1");
      expect(byId(result, "b1")?.groupId).toBe("g1");
    });
  });

  describe("edge cases", () => {
    it("keeps every instance linked when partial deletes in two instances add up to all the words", () => {
      const lines = [chorusLine(0, 10), chorusLine(1, 40), chorusLine(2, 70)];

      const result = applyWordDeletion(lines, [del("c0-0", 0), del("c0-0", 1), del("c1-0", 2)]);

      for (const id of ["c0-0", "c1-0", "c2-0"]) {
        expect(byId(result, id)?.words).toBeUndefined();
        expect(byId(result, id)?.groupId).toBe("g1");
      }
    });

    it("deletes a word once when the same word is selected in two instances", () => {
      const lines = [chorusLine(0, 10), chorusLine(1, 40), chorusLine(2, 70)];

      const result = applyWordDeletion(lines, [del("c0-0", 1), del("c1-0", 1)]);

      for (const id of ["c0-0", "c1-0", "c2-0"]) expect(texts(byId(result, id))).toEqual(["hold ", "now"]);
    });

    it("applies the words selected across instances to every instance", () => {
      const lines = [chorusLine(0, 10), chorusLine(1, 40), chorusLine(2, 70)];

      const result = applyWordDeletion(lines, [del("c0-0", 0), del("c1-0", 2)]);

      for (const id of ["c0-0", "c1-0", "c2-0"]) expect(texts(byId(result, id))).toEqual(["me "]);
    });

    it("clears a linked line-synced line in every instance", () => {
      const synced = (instanceIdx: number, offset: number): LyricLine => ({
        id: `s${instanceIdx}`,
        text: "la la",
        agentId: "v1",
        groupId: "g1",
        instanceIdx,
        templateLineIdx: 1,
        begin: offset,
        end: offset + 2,
      });
      const lines = [chorusLine(0, 10), synced(0, 12), chorusLine(1, 40), synced(1, 42)];

      const result = applyWordDeletion(lines, [del("s0", 0)]);

      expect(byId(result, "s1")?.begin).toBeUndefined();
      expect(byId(result, "s1")?.groupId).toBe("g1");
      expect(byId(result, "c1-0")).toBe(lines[2]);
    });

    it("leaves a detached instance alone", () => {
      const lines = [chorusLine(0, 10), chorusLine(1, 40, { detached: true })];

      const result = applyWordDeletion(lines, [del("c0-0", 1)]);

      expect(byId(result, "c1-0")).toBe(lines[1]);
    });

    it("leaves other template lines and other groups alone", () => {
      const otherGroup: LyricLine = { ...chorusLine(1, 40), id: "other", groupId: "g2" };
      const lines = [chorusLine(0, 10), chorusLine(0, 12, { templateLineIdx: 1 }), otherGroup];

      const result = applyWordDeletion(lines, [del("c0-0", 1)]);

      expect(byId(result, "c0-1")).toBe(lines[1]);
      expect(byId(result, "other")).toBe(lines[2]);
    });

    it("leaves an instance whose words no longer line up with the source", () => {
      const lines = [chorusLine(0, 10), chorusLine(1, 40, { words: [{ text: "hold me now", begin: 40, end: 41 }] })];

      const result = applyWordDeletion(lines, [del("c0-0", 1)]);

      expect(byId(result, "c1-0")).toBe(lines[1]);
    });
  });

  describe("invariants", () => {
    it("does not mutate the input lines", () => {
      const lines = [chorusLine(0, 10), chorusLine(1, 40)];
      const snapshot = structuredClone(lines);

      applyWordDeletion(lines, [del("c0-0", 1)]);

      expect(lines).toEqual(snapshot);
    });

    it("keeps every linked instance's words identical in text after a delete", () => {
      const lines = [chorusLine(0, 10), chorusLine(1, 40), chorusLine(2, 70)];

      const result = applyWordDeletion(lines, [del("c2-0", 0), del("c0-0", 2)]);

      const shapes = new Set(result.map((line) => JSON.stringify(texts(line))));
      expect(shapes.size).toBe(1);
    });
  });
});
