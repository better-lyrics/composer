import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { applied } from "@/domain/commands/outcome";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import type { LineUpdate } from "insync/line";

// -- Commands -----------------------------------------------------------------

function applyAlignedTimings(updates: readonly LineUpdate[]): LyricCommand {
  return lineEditCommand({ command: "align lines", args: updates.map((update) => update.id) }, () => updates);
}

// Joins the split's step (mode "amend"), so its shared copy is part of that step without a copy ping.
function retimeNewSyllables(updates: readonly LineUpdate[]): LyricCommand {
  const ids = updates.map((update) => update.id);
  return {
    note: { command: "retime new syllables", args: ids },
    copiesSharedTiming: true,
    announcesSharedCopy: false,
    run: (root) => applied({ ...root, lines: applyLineUpdates(root.lines, updates) }, ids),
  };
}

// -- Exports ------------------------------------------------------------------

export { applyAlignedTimings, retimeNewSyllables };
