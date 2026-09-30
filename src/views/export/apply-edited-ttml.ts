import { holdsEveryLine, mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import { isProjectFullySynced } from "@/domain/line/sync-progress";
import { type EditedLyrics, type ProjectPart, changedParts, editedLyricsWrite } from "@/domain/project/edited-lyrics";
import { useProjectStore } from "@/stores/project";
import type { ProjectStore } from "@/stores/project/types";
import { type ParseResult, skippedLineCount } from "@/utils/lyrics-parsers/shared";
import { generateProjectTtml } from "@/utils/ttml";
import { readTtmlLyrics } from "@/views/lyrics-import-modal/import-lyrics";

// -- Types --------------------------------------------------------------------

type EditedTtmlApply =
  | { status: "applied"; skipped: number; keptInExport: boolean }
  | { status: "export-only"; reason: "not-synced"; message?: string }
  | { status: "export-only"; reason: "not-held"; part: ProjectPart }
  | { status: "unreadable"; message: string };

// -- Constants ----------------------------------------------------------------

const EDITED_TTML = "the edited TTML";
const OWN_EXPORT = "the exported TTML";

// -- Helpers ------------------------------------------------------------------

function editedLyricsFrom(parsed: ParseResult, lines: EditedLyrics["lines"]): EditedLyrics {
  return { lines, groups: parsed.groups ?? [], agents: parsed.agents, metadata: parsed.metadata };
}

function partNotHeld(project: ProjectStore, audioDuration: number): ProjectPart | undefined {
  const own = readTtmlLyrics(generateProjectTtml(project, audioDuration), OWN_EXPORT, audioDuration);
  if (own.status === "unreadable" || !holdsEveryLine(project.lines, own.parsed.lines)) return "lines";
  const roundTrip = editedLyricsFrom(own.parsed, mergeEditedTtmlLines(project.lines, own.parsed));
  return changedParts(project, editedLyricsWrite(project, roundTrip))[0];
}

// -- Apply --------------------------------------------------------------------

function applyEditedTtml(content: string, audioDuration: number): EditedTtmlApply {
  const project = useProjectStore.getState();
  const read = readTtmlLyrics(content, EDITED_TTML, audioDuration);
  if (!isProjectFullySynced(project.lines)) {
    return read.status === "unreadable"
      ? { status: "export-only", reason: "not-synced", message: read.message }
      : { status: "export-only", reason: "not-synced" };
  }
  if (read.status === "unreadable") return read;
  const notHeld = partNotHeld(project, audioDuration);
  if (notHeld) return { status: "export-only", reason: "not-held", part: notHeld };
  project.applyEditedLyricsWithHistory(editedLyricsFrom(read.parsed, mergeEditedTtmlLines(project.lines, read.parsed)));
  const regenerated = generateProjectTtml(useProjectStore.getState(), audioDuration);
  const keptInExport = regenerated !== content;
  useProjectStore.getState().setTtmlEditState(keptInExport ? { source: regenerated, content } : null);
  return { status: "applied", skipped: skippedLineCount(read.parsed.issues), keptInExport };
}

// -- Exports ------------------------------------------------------------------

export { applyEditedTtml };
