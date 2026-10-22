import type { ProjectPart } from "@/domain/project/edited-lyrics";
import { skippedLinesMessage } from "@/utils/lyrics-parsers/shared";
import { applyEditedTtml } from "@/views/export/apply-edited-ttml";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const APPLIED_MESSAGE = "Updated the lyrics from the TTML";
const KEPT_IN_EXPORT_MESSAGE = "Updated the lyrics from the TTML. Some edits only change the exported file.";
const EXPORT_ONLY_MESSAGE = "The lyrics stay as they were, so your edits only change the exported file.";
const NOT_HELD_MESSAGES: Record<ProjectPart, string> = {
  lines: "Your edits only change the exported file because the TTML cannot hold some line details.",
  metadata: "Your edits only change the exported file because the TTML cannot hold some song details.",
  agents: "Your edits only change the exported file because the TTML cannot hold some singer details.",
  groups: "Your edits only change the exported file because the TTML cannot hold some line group details.",
};
const LYRICS_CHANGED_MESSAGE =
  "The project changed since you started editing, so your edits only change the exported file. Regenerate and edit again to apply them.";
const NOT_SYNCED_MESSAGE =
  "Your edits only change the exported file. To apply edits to the lyrics, sync every line, then Regenerate and edit again.";

// -- Functions ----------------------------------------------------------------

// Done in the TTML editor: apply the edits to the lyrics when the project can hold them, and say what happened.
function applyEditsToProject(content: string, duration: number): void {
  const result = applyEditedTtml(content, duration);
  if (result.status === "export-only") {
    if (result.reason === "not-held") {
      toast(NOT_HELD_MESSAGES[result.part]);
      return;
    }
    if (result.reason === "lyrics-changed") {
      toast(LYRICS_CHANGED_MESSAGE);
      return;
    }
    toast(NOT_SYNCED_MESSAGE);
    if (result.message) toast.error(result.message);
    return;
  }
  if (result.status === "unreadable") {
    toast.error(`${result.message} ${EXPORT_ONLY_MESSAGE}`);
    return;
  }
  toast(result.keptInExport ? KEPT_IN_EXPORT_MESSAGE : APPLIED_MESSAGE);
  if (result.skipped > 0) toast.warning(skippedLinesMessage(result.skipped));
}

// -- Exports ------------------------------------------------------------------

export { applyEditsToProject };
