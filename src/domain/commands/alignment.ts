import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { applied, refused } from "@/domain/commands/outcome";
import { sharedTimingFanOut } from "@/domain/group/shared-timing";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import type { LineUpdate } from "@/domain/line/model";

// -- Commands -----------------------------------------------------------------

// Timing only: deriving text would drop the untimed words of partly synced lines.
function applyAlignedTimings(updates: readonly LineUpdate[]): LyricCommand {
  return lineEditCommand({ command: "align lines", args: updates.map((update) => update.id) }, () => updates, {
    derivesText: false,
  });
}

// Joins the split's step (mode "amend"); the shared copy runs here so it is part of that step without a copy ping.
function retimeNewSyllables(updates: readonly LineUpdate[]): LyricCommand {
  const ids = updates.map((update) => update.id);
  return {
    note: { command: "retime new syllables", args: ids },
    derivesText: false,
    copiesSharedTiming: false,
    run: (root) => {
      const shared = sharedTimingFanOut(root.lines, applyLineUpdates(root.lines, updates), root.groups, ids);
      if (shared.rejected) return refused({ reason: "copy-below-zero" });
      return applied({ ...root, lines: shared.lines }, ids);
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { applyAlignedTimings, retimeNewSyllables };
