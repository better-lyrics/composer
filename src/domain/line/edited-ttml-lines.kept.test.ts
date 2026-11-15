import { describe, expect, it } from "vitest";
import { mergedEditedKept } from "@/domain/line/edited-ttml-kept";
import { mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import type { LyricLine } from "insync/line";
import { importableMetadata } from "insync/project-imported-metadata";
import { normalizeLoadedMetadata } from "insync/project-normalize-metadata";
import edgeCasesTtml from "@/test/fixtures/ttml/edge-cases.ttml?raw";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { generateTTML } from "@/utils/ttml";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Helpers ------------------------------------------------------------------

function exportOf(opened: ParseResult, lines: LyricLine[], kept: Pick<ParseResult, "parts" | "passthrough">): string {
  return generateTTML({
    metadata: normalizeLoadedMetadata(importableMetadata(opened.metadata)),
    agents: opened.agents ?? [],
    lines,
    groups: opened.groups ?? [],
    parts: kept.parts,
    passthrough: kept.passthrough,
    splitChar: DEFAULT_SPLIT_CHARACTER,
  });
}

function doneWith(opened: ParseResult, edit: (ttml: string) => string): string {
  const edited = parseTtml(edit(exportOf(opened, opened.lines, opened)), DEFAULT_SPLIT_CHARACTER);
  const merged = mergeEditedTtmlLines(opened.lines, edited, DEFAULT_SPLIT_CHARACTER);
  return exportOf(opened, merged, mergedEditedKept(opened.lines, edited, merged, DEFAULT_SPLIT_CHARACTER));
}

// -- Tests --------------------------------------------------------------------

describe("mergeEditedTtmlLines · kept ttml data", () => {
  it("regression: nested song part sections keep their lines through Done", () => {
    const opened = parseTtml(edgeCasesTtml, DEFAULT_SPLIT_CHARACTER);
    const own = exportOf(opened, opened.lines, opened);

    expect(doneWith(opened, (ttml) => ttml)).toBe(own);
  });

  it("regression: a line-synced background keeps its kept span through Done when its line changes", () => {
    const opened = parseTtml(edgeCasesTtml, DEFAULT_SPLIT_CHARACTER);
    const exported = doneWith(opened, (ttml) => ttml.replace(">Far shore<", ">Far shores<"));

    expect(exported).toContain(">Far shores<");
    expect(exported).toContain('x-vendor:echo="2"');
  });

  it("regression: kept elements stay after the syllable and line they followed through Done after an edit", () => {
    const opened = parseTtml(
      `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:k="https://vendor.example/k"><body><div><p begin="0:01.000" end="0:04.000"><span begin="0:01.000" end="0:02.000">Tide </span><span begin="0:02.000" end="0:03.000">comes </span><k:mark/><span begin="0:03.000" end="0:04.000">in</span></p></div><k:break/><div><p begin="0:05.000" end="0:06.000">High tide</p></div></body></tt>`,
      DEFAULT_SPLIT_CHARACTER,
    );
    const exported = doneWith(opened, (ttml) => ttml.replace(">Tide<", ">Tides<"));

    expect(exported).toContain(">Tides<");
    expect(exported).toMatch(/>comes<\/span> <k:mark\/><span [^>]*>in<\/span><\/p>\s*<\/div>\s*<k:break\/>\s*<div>/);
  });
});
