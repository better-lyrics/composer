import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";

// -- Commands -----------------------------------------------------------------

// Lines that are gone are skipped; the command refuses only when none is left.
function assignSinger(lineIds: readonly string[], agentId: string): LyricCommand {
  return lineEditCommand({ command: "assign singer", args: [...lineIds, agentId] }, (root) => {
    const present = new Set(root.lines.map((line) => line.id));
    const targets = lineIds.filter((id) => present.has(id));
    if (lineIds.length > 0 && targets.length === 0) return refused({ reason: "line-gone", lineId: lineIds[0] });
    return targets.map((id) => ({ id, updates: { agentId } }));
  });
}

// -- Exports ------------------------------------------------------------------

export { assignSinger };
