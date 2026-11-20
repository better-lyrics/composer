import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";
import { withAgent } from "@/domain/line/track-writes";

// -- Commands -----------------------------------------------------------------

// Lines that are gone are skipped; the command refuses only when none is left.
function assignSinger(lineIds: readonly string[], agentId: string): LyricCommand {
  return lineEditCommand({ command: "assign singer", args: [...lineIds, agentId] }, (root) => {
    const wanted = new Set(lineIds);
    const targets = root.lines.filter((line) => wanted.has(line.id));
    if (lineIds.length > 0 && targets.length === 0) return refused({ reason: "line-gone", lineId: lineIds[0] });
    return targets.map((line) => ({ id: line.id, updates: { tracks: withAgent(line, agentId).tracks } }));
  });
}

// -- Exports ------------------------------------------------------------------

export { assignSinger };
