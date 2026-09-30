import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { createLine } from "@/test/factories";
import { generateProjectTtml } from "@/utils/ttml";
import { crossedProjectChange, keptTtmlEdit, typedTtmlEdit } from "@/views/export/ttml-edit-state";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function exportOf(texts: string[], duration: number): string {
  return generateProjectTtml(
    {
      metadata: normalizeLoadedMetadata(null),
      agents: [],
      groups: [],
      lines: texts.map((text, index) => createLine({ id: `l${index}`, text, begin: index, end: index + 1 })),
    },
    duration,
  );
}

const SOURCE = exportOf(["Hello", "World"], 0);
const CHANGED = exportOf(["Hello", "Earth"], 0);

// -- Tests --------------------------------------------------------------------

describe("ttml edit state", () => {
  describe("typedTtmlEdit", () => {
    it("starts an unmarked edit on the current export", () => {
      expect(typedTtmlEdit(null, SOURCE, "typed", false)).toEqual({ source: SOURCE, content: "typed" });
    });

    it("keeps an edit on the same export unmarked", () => {
      expect(typedTtmlEdit({ source: SOURCE, content: "a" }, SOURCE, "b", false)).toEqual({
        source: SOURCE,
        content: "b",
      });
    });

    it("marks an edit typed after the project changed and rebases it", () => {
      expect(typedTtmlEdit({ source: SOURCE, content: "a" }, CHANGED, "b", false)).toEqual({
        source: CHANGED,
        content: "b",
        lyricsChanged: true,
      });
    });

    it("keeps the old source while a conflict is open", () => {
      const prev = { source: SOURCE, content: "a" };
      expect(typedTtmlEdit(prev, CHANGED, "b", true)).toEqual({ source: SOURCE, content: "b" });
    });

    it("keeps the mark once it is set", () => {
      expect(typedTtmlEdit({ source: SOURCE, content: "a", lyricsChanged: true }, SOURCE, "b", false)).toEqual({
        source: SOURCE,
        content: "b",
        lyricsChanged: true,
      });
    });
  });

  describe("keptTtmlEdit", () => {
    it("rebases a kept edit onto the current export and marks it", () => {
      expect(keptTtmlEdit({ source: SOURCE, content: "a" }, CHANGED)).toEqual({
        source: CHANGED,
        content: "a",
        lyricsChanged: true,
      });
    });

    it("keeps no edit when there is none", () => {
      expect(keptTtmlEdit(null, CHANGED)).toBeNull();
    });
  });

  describe("crossedProjectChange", () => {
    it("is false for an edit on the current export", () => {
      expect(crossedProjectChange({ source: SOURCE, content: "a" }, SOURCE)).toBe(false);
    });

    it("is true for an edit on an older export", () => {
      expect(crossedProjectChange({ source: SOURCE, content: "a" }, CHANGED)).toBe(true);
    });

    it("is true for a marked edit", () => {
      expect(crossedProjectChange({ source: SOURCE, content: "a", lyricsChanged: true }, SOURCE)).toBe(true);
    });
  });
});
