import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { LinkGroup } from "insync/group";
import { mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import type { LyricLine } from "insync/line";
import { PARSERS } from "@/utils/lyrics-parsers";
import { generateTTML } from "@/utils/ttml";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Constants ----------------------------------------------------------------

const METADATA = { title: "Song", artists: [], album: "", duration: 0 };

// -- Helpers ------------------------------------------------------------------

function groupsReferencedBy(lines: readonly LyricLine[]): LinkGroup[] {
  const ids = [...new Set(lines.flatMap((line) => (line.groupId ? [line.groupId] : [])))];
  return ids.map((id) => ({ id, label: id, color: "#a3c9ff", templateVersion: 1 }));
}

function exportedTtml(lines: LyricLine[]): string {
  return generateTTML({
    metadata: METADATA,
    agents: DEFAULT_AGENTS,
    lines,
    groups: groupsReferencedBy(lines),
    splitChar: DEFAULT_SPLIT_CHARACTER,
  });
}

function ownExportLines(lines: LyricLine[]): LyricLine[] {
  return PARSERS.ttml(exportedTtml(lines)).lines;
}

function mergeEditedExport(stored: LyricLine[], edit: (ttml: string) => string = (ttml) => ttml): LyricLine[] {
  return mergeEditedTtmlLines(stored, PARSERS.ttml(edit(exportedTtml(stored))), DEFAULT_SPLIT_CHARACTER);
}

// -- Exports ------------------------------------------------------------------

export { exportedTtml, mergeEditedExport, ownExportLines };
