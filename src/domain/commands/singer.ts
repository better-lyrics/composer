import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";

// -- Commands -----------------------------------------------------------------

function assignSinger(lineId: string, agentId: string): LyricCommand {
  return lineEditCommand({ command: "assign singer", args: [lineId, agentId] }, (root) =>
    root.lines.some((line) => line.id === lineId)
      ? [{ id: lineId, updates: { agentId } }]
      : refused({ reason: "line-gone", lineId }),
  );
}

// -- Exports ------------------------------------------------------------------

export { assignSinger };
