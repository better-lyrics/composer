import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { createGroup, createLine } from "@/test/factories";
import { laneGroupTags, placingInstanceName } from "@/views/sync/shared-sync-tags";
import { describe, expect, it } from "vitest";

const chorus = (instanceIdx: number, templateLineIdx: number, begin?: number) =>
  createLine({
    id: `c${instanceIdx}-${templateLineIdx}`,
    text: "I want",
    groupId: "g1",
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

const verse = (id: string, text = "Walking home") => createLine({ id, text });
const groups = [createGroup({ id: "g1", label: "Chorus", color: "#ff0000", sharesTiming: true })];
const song = (secondBegin?: number) => [
  chorus(0, 0, 10),
  chorus(0, 1, 11),
  verse("v1"),
  chorus(1, 0, secondBegin),
  chorus(1, 1, secondBegin === undefined ? undefined : secondBegin + 1),
  verse("v2"),
];

const tagsAt = (lines: LyricLine[], lineIndex: number, wordIndex = 0, gs: LinkGroup[] = groups) =>
  Object.fromEntries(laneGroupTags(lines, gs, { lineIndex, wordIndex }));

describe("laneGroupTags", () => {
  it("names each instance on its first line", () => {
    expect(tagsAt(song(), 0, 1)).toEqual({
      "c0-0": { label: "Chorus 1", color: "#ff0000" },
      "c1-0": { label: "Chorus 2 · shared", color: "#ff0000" },
    });
  });

  it("asks for the placing tap while the cursor waits on the anchor", () => {
    expect(tagsAt(song(), 3)["c1-0"].label).toBe("Chorus 2 · tap to place");
  });

  it("marks a placed instance", () => {
    expect(tagsAt(song(40), 5)["c1-0"].label).toBe("Chorus 2 · placed");
  });

  it("marks an instance with its own timing", () => {
    const own = [
      createGroup({ id: "g1", label: "Chorus", color: "#ff0000", sharesTiming: true, ownTimingInstances: [1] }),
    ];
    expect(tagsAt(song(), 0, 1, own)["c1-0"].label).toBe("Chorus 2 · own timing");
  });

  describe("edge cases", () => {
    it("names instances of a group that does not share timing, without a suffix", () => {
      const plain = [createGroup({ id: "g1", label: "Chorus", color: "#ff0000" })];
      expect(tagsAt(song(), 0, 1, plain)["c1-0"].label).toBe("Chorus 2");
    });

    it("tags nothing for a line outside every group", () => {
      expect(tagsAt(song(), 0, 1).v1).toBeUndefined();
    });

    it("asks for the placing tap only on the first word", () => {
      expect(tagsAt(song(), 3, 1)["c1-0"].label).toBe("Chorus 2 · shared");
    });
  });
});

describe("placingInstanceName", () => {
  it("names the instance the tap on its first word places", () => {
    expect(placingInstanceName(song(), groups, { lineIndex: 3, wordIndex: 0 })).toBe("Chorus 2");
  });

  describe("edge cases", () => {
    it("is null on a line that places nothing", () => {
      expect(placingInstanceName(song(), groups, { lineIndex: 2, wordIndex: 0 })).toBeNull();
    });

    it("is null past the first word of the anchor line", () => {
      expect(placingInstanceName(song(), groups, { lineIndex: 3, wordIndex: 1 })).toBeNull();
    });
  });
});
