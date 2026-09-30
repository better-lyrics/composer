import { skippedSharedInstances } from "@/domain/sync/skipped-instances";
import { createGroup, createLine } from "@/test/factories";
import { sharedSyncTags } from "@/views/sync/shared-sync-tags";
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

function tagsAt(lines: ReturnType<typeof song>, lineIndex: number, wordIndex = 0) {
  const skipped = new Set(skippedSharedInstances(lines, groups).flatMap((instance) => instance.lineIds));
  return Object.fromEntries(sharedSyncTags(lines, groups, { lineIndex, wordIndex }, skipped));
}

describe("sharedSyncTags", () => {
  it("names the coming instance under the next line", () => {
    expect(tagsAt(song(), 2, 1)).toEqual({ "c1-0": { label: "Chorus 2", color: "#ff0000", placement: "below" } });
  });

  it("asks for the placing tap above the anchor line", () => {
    expect(tagsAt(song(), 3)).toEqual({ "c1-0": { label: "Tap to place", color: "#ff0000", placement: "above" } });
  });

  it("marks placed and skipped lines behind the cursor as shared", () => {
    expect(tagsAt(song(40), 5)).toEqual({
      "c1-0": { label: "Chorus 2 · shared", color: "#ff0000", placement: "below" },
      "c1-1": { label: "Chorus 2 · shared", color: "#ff0000", placement: "below" },
    });
  });

  describe("edge cases", () => {
    it("marks nothing ahead of the cursor as shared", () => {
      expect(tagsAt(song(40), 0, 1)).toEqual({});
    });

    it("gives no tags for an old group", () => {
      const lines = song(40);
      expect(
        Object.fromEntries(
          sharedSyncTags(lines, [createGroup({ id: "g1" })], { lineIndex: 3, wordIndex: 0 }, new Set()),
        ),
      ).toEqual({});
    });

    it("gives no placing tag past the first word", () => {
      expect(tagsAt(song(), 3, 1)).toEqual({});
    });

    it("looks past a blank line for the next line", () => {
      const lines = [...song().slice(0, 3), verse("blank", ""), ...song().slice(3)];
      expect(tagsAt(lines, 2, 1)["c1-0"]?.label).toBe("Chorus 2");
    });

    it("keeps only the shared tags once the cursor is past the end", () => {
      expect(tagsAt(song(40), 6)).toMatchObject({ "c1-0": { label: "Chorus 2 · shared" } });
    });
  });
});
