import { describe, expect, it } from "vitest";
import { FOREIGN_TTML_FIXTURES } from "@/test/ttml-foreign-fixtures";
import { exportOfImport, missingUnmodelledNodes } from "@/test/ttml-unmodelled";
import { parseXmlDocument } from "@/utils/xml-document";

// -- Tests --------------------------------------------------------------------

describe("ttml lossless", () => {
  for (const [name, source] of FOREIGN_TTML_FIXTURES) {
    it(`${name}: every unmodelled node survives an import and export`, () => {
      expect(missingUnmodelledNodes(source, exportOfImport(source))).toEqual([]);
    });

    it(`${name}: the export is well formed as written`, () => {
      expect(parseXmlDocument(exportOfImport(source)).ok).toBe(true);
    });

    it(`${name}: a second round trip changes nothing`, () => {
      const once = exportOfImport(source);
      expect(exportOfImport(once)).toBe(once);
    });
  }
});
