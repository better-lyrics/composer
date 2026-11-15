import { describe, expect, it } from "vitest";
import { importableMetadata } from "insync/project-imported-metadata";
import { normalizeLoadedMetadata } from "insync/project-normalize-metadata";
import { outgoingTtml } from "@/lib/outgoing-ttml";
import { useProjectStore } from "@/stores/project";
import { FOREIGN_TTML_FIXTURES } from "@/test/ttml-foreign-fixtures";
import { missingUnmodelledNodes } from "@/test/ttml-unmodelled";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Tests --------------------------------------------------------------------

describe("outgoingTtml", () => {
  it("sends a ttml file's unknown data and song parts back out", () => {
    for (const [, source] of FOREIGN_TTML_FIXTURES) {
      const parsed = parseTtml(source, DEFAULT_SPLIT_CHARACTER);
      useProjectStore.getState().reset();
      useProjectStore.setState({
        lines: parsed.lines,
        agents: parsed.agents ?? [],
        groups: parsed.groups ?? [],
        parts: parsed.parts ?? [],
        passthrough: parsed.passthrough ?? {},
        metadata: normalizeLoadedMetadata(importableMetadata(parsed.metadata)),
      });
      const sent = outgoingTtml({
        editedContent: null,
        generatedContent: "",
        duration: 0,
        exportTiming: "word",
        youtubeVideoId: undefined,
      });

      expect(missingUnmodelledNodes(source, sent)).toEqual([]);
    }
  });
});
