import { mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import { isProjectFullySynced } from "@/domain/line/sync-progress";
import { useProjectStore } from "@/stores/project";
import { skippedLineCount } from "@/utils/lyrics-parsers/shared";
import { generateProjectTtml } from "@/utils/ttml";
import { readTtmlLyrics } from "@/views/lyrics-import-modal/import-lyrics";

// -- Types --------------------------------------------------------------------

type EditedTtmlApply =
  | { status: "applied"; skipped: number; keptInExport: boolean }
  | { status: "export-only" }
  | { status: "unreadable"; message: string };

// -- Constants ----------------------------------------------------------------

const EDITED_TTML = "the edited TTML";

// -- Apply --------------------------------------------------------------------

function applyEditedTtml(content: string, audioDuration: number): EditedTtmlApply {
  const project = useProjectStore.getState();
  if (!isProjectFullySynced(project.lines)) return { status: "export-only" };
  const read = readTtmlLyrics(content, EDITED_TTML, audioDuration);
  if (read.status === "unreadable") return read;
  project.applyEditedLyricsWithHistory({
    lines: mergeEditedTtmlLines(project.lines, read.parsed.lines),
    groups: read.parsed.groups ?? [],
    agents: read.parsed.agents,
    metadata: read.parsed.metadata,
  });
  const regenerated = generateProjectTtml(useProjectStore.getState(), audioDuration);
  const keptInExport = regenerated !== content;
  useProjectStore.getState().setTtmlEditState(keptInExport ? { source: regenerated, content } : null);
  return { status: "applied", skipped: skippedLineCount(read.parsed.issues), keptInExport };
}

// -- Exports ------------------------------------------------------------------

export { applyEditedTtml };
