import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import type { LyricLine } from "@/domain/line/model";
import { PARSERS } from "@/utils/lyrics-parsers";
import { generateTTML } from "@/utils/ttml";

// -- Constants ----------------------------------------------------------------

const METADATA = { title: "Song", artists: [], album: "", duration: 0 };

// -- Helpers ------------------------------------------------------------------

function exportedTtml(lines: LyricLine[]): string {
  return generateTTML({ metadata: METADATA, agents: DEFAULT_AGENTS, lines });
}

function ownExportLines(lines: LyricLine[]): LyricLine[] {
  return PARSERS.ttml(exportedTtml(lines)).lines;
}

function mergeEditedExport(stored: LyricLine[], edit: (ttml: string) => string = (ttml) => ttml): LyricLine[] {
  return mergeEditedTtmlLines(stored, PARSERS.ttml(edit(exportedTtml(stored))).lines);
}

// -- Exports ------------------------------------------------------------------

export { mergeEditedExport, ownExportLines };
