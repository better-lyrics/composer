import type { LyricCommand } from "@/domain/commands/command";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { applied, changedLineIds, refused, withLines } from "@/domain/commands/outcome";
import { withNewInstance } from "@/domain/group/own-timing";
import type { LineUpdate, RawLine } from "@/domain/line/model";

// -- Helpers ------------------------------------------------------------------

// The placement planners lay the instance into existing rows and hand back the whole lines array.
function adoptInstance(command: string, groupId: string, instanceIdx: number, lines: RawLine[]): LyricCommand {
  return {
    note: { command, args: [groupId, instanceIdx] },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root) =>
      applied(
        { ...root, lines, groups: withNewInstance(root.groups, groupId, instanceIdx) },
        changedLineIds(root.lines, lines),
      ),
  };
}

// -- Commands -----------------------------------------------------------------

function fillInstanceRows(groupId: string, instanceIdx: number, lines: RawLine[]): LyricCommand {
  return adoptInstance("fill instance rows", groupId, instanceIdx, lines);
}

function conformToInstance(groupId: string, instanceIdx: number, lines: RawLine[]): LyricCommand {
  return adoptInstance("conform to instance", groupId, instanceIdx, lines);
}

// Pasted words carry ids minted for the paste, so the caller passes the planned lines.
function pasteLines(updates: readonly LineUpdate[]): LyricCommand {
  return lineEditCommand({ command: "paste lines", args: updates.map((update) => update.id) }, () => updates);
}

function deleteLine(lineId: string): LyricCommand {
  return {
    note: { command: "delete line", args: [lineId] },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root) =>
      root.lines.some((line) => line.id === lineId)
        ? withLines(
            root,
            root.lines.filter((line) => line.id !== lineId),
          )
        : refused({ reason: "line-gone", lineId }),
  };
}

// -- Exports ------------------------------------------------------------------

export { conformToInstance, deleteLine, fillInstanceRows, pasteLines };
