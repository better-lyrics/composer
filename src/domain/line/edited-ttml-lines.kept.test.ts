import type { Part } from "insync/part";
import { describe, expect, it } from "vitest";
import { mergeEditedTtmlLines, mergedEditedParts } from "@/domain/line/edited-ttml-lines";
import type { LyricLine } from "@/domain/line/model";
import { importableMetadata } from "@/domain/project/imported-metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import edgeCasesTtml from "@/test/fixtures/ttml/edge-cases.ttml?raw";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { generateTTML } from "@/utils/ttml";

// -- Helpers ------------------------------------------------------------------

function exportOf(opened: ParseResult, lines: LyricLine[], parts: readonly Part[] | undefined): string {
  return generateTTML({
    metadata: normalizeLoadedMetadata(importableMetadata(opened.metadata)),
    agents: opened.agents ?? [],
    lines,
    groups: opened.groups ?? [],
    parts,
    passthrough: opened.passthrough,
  });
}

function doneWith(opened: ParseResult, edit: (ttml: string) => string): string {
  const edited = parseTtml(edit(exportOf(opened, opened.lines, opened.parts)));
  const merged = mergeEditedTtmlLines(opened.lines, edited);
  return exportOf(opened, merged, mergedEditedParts(opened.lines, edited, merged));
}

// -- Tests --------------------------------------------------------------------

describe("mergeEditedTtmlLines · kept ttml data", () => {
  it("regression: nested song part sections keep their lines through Done", () => {
    const opened = parseTtml(edgeCasesTtml);
    const own = exportOf(opened, opened.lines, opened.parts);

    expect(doneWith(opened, (ttml) => ttml)).toBe(own);
  });

  it("regression: a line-synced background keeps its kept span through Done when its line changes", () => {
    const opened = parseTtml(edgeCasesTtml);
    const exported = doneWith(opened, (ttml) => ttml.replace(">Far shore<", ">Far shores<"));

    expect(exported).toContain(">Far shores<");
    expect(exported).toContain('x-vendor:echo="2"');
  });
});
