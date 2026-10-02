import { sharedTimingSuggestions } from "@/domain/group/shared-timing-suggestions";
import type { LyricLine } from "@/domain/line/model";
import { createGroup, createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const member = (instanceIdx: number, templateLineIdx: number, begin?: number, groupId = "g1"): LyricLine =>
  createLine({
    id: `${groupId}-c${instanceIdx}-${templateLineIdx}`,
    text: "I want",
    groupId,
    instanceIdx,
    templateLineIdx,
    ...(begin === undefined
      ? {}
      : {
          words: [
            { text: "I ", begin, end: begin + 0.4 },
            { text: "want", begin: begin + 0.5, end: begin + 1 },
          ],
        }),
  });

const oldChorus = createGroup({ id: "g1", label: "Chorus" });

// -- Tests --------------------------------------------------------------------

describe("sharedTimingSuggestions", () => {
  it("suggests an old group with a synced instance and instances with no timing", () => {
    const lines = [member(0, 0, 10), member(0, 1, 12), member(1, 0), member(1, 1), member(2, 0), member(2, 1)];

    expect(sharedTimingSuggestions(lines, [oldChorus])).toEqual([
      {
        fingerprint: "shared-timing:g1",
        groupId: "g1",
        label: "Chorus",
        sourceName: "Chorus 1",
        changingCount: 2,
        replacedCount: 0,
      },
    ]);
  });

  it("names the first fully synced instance in line order as the source", () => {
    const lines = [member(1, 0, 10), member(1, 1, 12), member(0, 0, 50), member(0, 1, 52), member(2, 0), member(2, 1)];

    expect(sharedTimingSuggestions(lines, [oldChorus])[0].sourceName).toBe("Chorus 2");
  });

  it("does not suggest a group that already shares timing", () => {
    const lines = [member(0, 0, 10), member(1, 0)];
    const sharing = createGroup({ id: "g1", label: "Chorus", sharesTiming: true });

    expect(sharedTimingSuggestions(lines, [sharing])).toEqual([]);
  });

  describe("edge cases", () => {
    it("does not suggest a group where no instance is fully synced", () => {
      const lines = [member(0, 0, 10), member(0, 1), member(1, 0), member(1, 1)];

      expect(sharedTimingSuggestions(lines, [oldChorus])).toEqual([]);
    });

    it("does not suggest a group where every instance has timing", () => {
      const lines = [member(0, 0, 10), member(1, 0, 20)];

      expect(sharedTimingSuggestions(lines, [oldChorus])).toEqual([]);
    });

    it("counts a partly synced instance as one whose own timing is replaced", () => {
      const lines = [member(0, 0, 10), member(0, 1, 12), member(1, 0, 20), member(1, 1), member(2, 0), member(2, 1)];

      expect(sharedTimingSuggestions(lines, [oldChorus])[0]).toMatchObject({ changingCount: 2, replacedCount: 1 });
    });

    it("does not count an instance that sharing would refuse at the song end", () => {
      const lines = [member(0, 0, 10), member(0, 1, 12), member(1, 0, 118), member(1, 1), member(2, 0), member(2, 1)];

      expect(sharedTimingSuggestions(lines, [oldChorus], 120)[0]).toMatchObject({ changingCount: 1, replacedCount: 0 });
      expect(sharedTimingSuggestions(lines, [oldChorus])[0]).toMatchObject({ changingCount: 2, replacedCount: 1 });
    });

    it("does not count a timed instance that already has the same relative timing", () => {
      const lines = [
        member(0, 0, 10),
        member(0, 1, 12),
        member(1, 0, 40),
        member(1, 1, 42),
        member(2, 0),
        member(2, 1),
      ];

      expect(sharedTimingSuggestions(lines, [oldChorus])[0]).toMatchObject({ changingCount: 1, replacedCount: 0 });
    });

    it("ignores detached lines", () => {
      const lines = [member(0, 0, 10), { ...member(1, 0), detached: true }];

      expect(sharedTimingSuggestions(lines, [oldChorus])).toEqual([]);
    });

    it("returns nothing without groups or lines", () => {
      expect(sharedTimingSuggestions([], [])).toEqual([]);
      expect(sharedTimingSuggestions([], [oldChorus])).toEqual([]);
    });

    it("suggests each qualifying group on its own", () => {
      const verse = createGroup({ id: "g2", label: "Verse" });
      const lines = [member(0, 0, 10), member(1, 0), member(0, 0, 30, "g2"), member(1, 0, undefined, "g2")];

      expect(sharedTimingSuggestions(lines, [oldChorus, verse]).map((s) => s.fingerprint)).toEqual([
        "shared-timing:g1",
        "shared-timing:g2",
      ]);
    });
  });

  describe("invariants", () => {
    it("does not mutate its input", () => {
      const lines = [member(0, 0, 10), member(1, 0)];
      const groups = [oldChorus];
      const snapshot = structuredClone({ lines, groups });

      sharedTimingSuggestions(lines, groups);

      expect({ lines, groups }).toEqual(snapshot);
    });

    it("gives the same result when run twice", () => {
      const lines = [member(0, 0, 10), member(1, 0)];

      expect(sharedTimingSuggestions(lines, [oldChorus])).toEqual(sharedTimingSuggestions(lines, [oldChorus]));
    });
  });
});
