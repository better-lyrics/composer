import type { LineUpdate, LyricLine } from "insync/line";

// -- Functions ----------------------------------------------------------------

function applyLineUpdates(lines: readonly LyricLine[], updates: readonly LineUpdate[]): LyricLine[] {
  const byId = new Map(updates.map((u) => [u.id, u.updates]));
  return lines.map((line) => {
    const update = byId.get(line.id);
    return update ? { ...line, ...update } : line;
  });
}

// -- Exports ------------------------------------------------------------------

export { applyLineUpdates };
