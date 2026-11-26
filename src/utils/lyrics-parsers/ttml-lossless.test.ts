import { describe, expect, it } from "vitest";
import { importableMetadata } from "@/domain/project/imported-metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { FOREIGN_TTML_FIXTURES } from "@/test/ttml-foreign-fixtures";
import { missingUnmodelledNodes } from "@/test/ttml-unmodelled";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { generateTTML } from "@/utils/ttml";
import { parseXmlDocument } from "@/utils/xml-document";

// -- Helpers ------------------------------------------------------------------

// The export of a file opened as a new project.
function exportOf(parsed: ParseResult): string {
  return generateTTML({
    metadata: normalizeLoadedMetadata(importableMetadata(parsed.metadata)),
    agents: parsed.agents ?? [],
    lines: parsed.lines,
    groups: parsed.groups ?? [],
    parts: parsed.parts,
    passthrough: parsed.passthrough,
  });
}

// -- Tests --------------------------------------------------------------------

describe("ttml lossless", () => {
  for (const [name, source] of FOREIGN_TTML_FIXTURES) {
    it(`${name}: every unmodelled node survives an import and export`, () => {
      expect(missingUnmodelledNodes(source, exportOf(parseTtml(source)))).toEqual([]);
    });

    it(`${name}: the export is well formed as written`, () => {
      expect(parseXmlDocument(exportOf(parseTtml(source))).ok).toBe(true);
    });

    it(`${name}: a second round trip changes nothing`, () => {
      const once = exportOf(parseTtml(source));
      expect(exportOf(parseTtml(once))).toBe(once);
    });
  }
});
