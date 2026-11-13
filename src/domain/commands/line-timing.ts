import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { refused } from "@/domain/commands/outcome";
import type { LineUpdate } from "@/domain/line/model";

// -- Commands -----------------------------------------------------------------

// Times an untimed line as one block, sized to its words.
function placeLineAt(lineId: string, begin: number, end: number): LyricCommand {
  return lineEditCommand({ command: "place line", args: [lineId, begin, end] }, (root) =>
    root.lines.some((line) => line.id === lineId)
      ? [{ id: lineId, updates: { begin, end } }]
      : refused({ reason: "line-gone", lineId }),
  );
}

// The converter mints the new word ids, so the caller passes the words it made and can select them.
function convertToWordTiming(converted: readonly LineUpdate[]): LyricCommand {
  return lineEditCommand(
    { command: "convert to word timing", args: converted.map((update) => update.id) },
    () => converted,
  );
}

// -- Exports ------------------------------------------------------------------

export { convertToWordTiming, placeLineAt };
