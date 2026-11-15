import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exportOfImport, missingUnmodelledNodes, readTtmlDocument, unmodelledNodes } from "@/test/ttml-unmodelled";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { parseXmlDocument } from "@/utils/xml-document";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Constants ----------------------------------------------------------------

// Newline-separated `.ttml` paths, given only on the maintainer's machine.
const REAL_TTML_FILES = process.env.INSYNC_REAL_TTML?.split("\n").filter(Boolean) ?? [];

// -- Helpers ------------------------------------------------------------------

// What one file lost or changed through an import and export, by the same three properties as the fixture test.
function problemsOf(source: string): string[] {
  const once = exportOfImport(source);
  const problems: string[] = [];
  const missing = missingUnmodelledNodes(source, once);
  if (missing.length > 0) problems.push(`lost ${JSON.stringify(missing)}`);
  if (!parseXmlDocument(once).ok) problems.push("export is not well formed");
  if (exportOfImport(once) !== once) problems.push("second round trip changed the export");
  return problems;
}

// -- Tests --------------------------------------------------------------------

describe("real ttml files", () => {
  it.runIf(REAL_TTML_FILES.length > 0)("keep their unmodelled data through an import and export", () => {
    const unreadable: string[] = [];
    const problems: Record<string, string[]> = {};
    let lines = 0;
    let keptNodes = 0;
    for (const path of REAL_TTML_FILES) {
      const source = readFileSync(path, "utf8");
      const parsed = parseTtml(source, DEFAULT_SPLIT_CHARACTER);
      if (parsed.issues.some((issue) => issue.reason === "empty-document")) {
        unreadable.push(path);
        continue;
      }
      lines += parsed.lines.length;
      keptNodes += unmodelledNodes(readTtmlDocument(source)).length;
      const found = problemsOf(source);
      if (found.length > 0) problems[path] = found;
    }
    console.info(
      `[ttml] ${REAL_TTML_FILES.length} files, ${lines} lines, ${keptNodes} kept nodes, ${unreadable.length} unreadable`,
    );
    if (unreadable.length > 0) console.info("[ttml] unreadable", unreadable);
    expect(problems).toEqual({});
  });
});
