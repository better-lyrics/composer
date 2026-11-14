import { describe, expect, it } from "vitest";
import { EDITED_TTML_PROJECTS } from "@/test/edited-ttml-projects";
import {
  buildAlternateBackgroundLanguageTtml,
  buildAlternateLanguageTtml,
  buildBackgroundVocalTtml,
  buildMatchingAlternateLanguageTtml,
  buildSyncedTtml,
} from "@/test/ttml-fixtures";
import { readTtmlDocument, unmodelledNodes } from "@/test/ttml-unmodelled";
import { generateProjectTtml } from "@/utils/ttml";

describe("ttml modelled", () => {
  it("a Composer export has nothing to keep", () => {
    const exports = [
      buildSyncedTtml(30),
      buildBackgroundVocalTtml(),
      buildAlternateLanguageTtml(),
      buildAlternateBackgroundLanguageTtml(),
      buildMatchingAlternateLanguageTtml(),
      ...EDITED_TTML_PROJECTS.flatMap((build) => [
        generateProjectTtml(build(), 30, "word"),
        generateProjectTtml(build(), 30, "line"),
      ]),
    ];
    for (const ttml of exports) expect(unmodelledNodes(readTtmlDocument(ttml))).toEqual([]);
  });
});
