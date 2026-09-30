import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { LinkGroup } from "@/domain/group/template";
import { mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import type { LyricLine } from "@/domain/line/model";
import { PARSERS } from "@/utils/lyrics-parsers";
import { generateTTML } from "@/utils/ttml";

// -- Constants ----------------------------------------------------------------

const METADATA = { title: "Song", artists: [], album: "", duration: 0 };

// -- Helpers ------------------------------------------------------------------

function groupsReferencedBy(lines: readonly LyricLine[]): LinkGroup[] {
  const ids = [...new Set(lines.flatMap((line) => (line.groupId ? [line.groupId] : [])))];
  return ids.map((id) => ({ id, label: id, color: "#a3c9ff", templateVersion: 1 }));
}

function exportedTtml(lines: LyricLine[]): string {
  return generateTTML({ metadata: METADATA, agents: DEFAULT_AGENTS, lines, groups: groupsReferencedBy(lines) });
}

function ownExportLines(lines: LyricLine[]): LyricLine[] {
  return PARSERS.ttml(exportedTtml(lines)).lines;
}

function mergeEditedExport(stored: LyricLine[], edit: (ttml: string) => string = (ttml) => ttml): LyricLine[] {
  return mergeEditedTtmlLines(stored, PARSERS.ttml(edit(exportedTtml(stored))));
}

// -- Exports ------------------------------------------------------------------

export { exportedTtml, mergeEditedExport, ownExportLines };
