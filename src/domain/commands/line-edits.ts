import type { CommandContext, HistoryNote, LyricCommand } from "@/domain/commands/command";
import {
  type Applied,
  type LyricRoot,
  type Refusal,
  applied,
  changedLineIds,
  refused,
} from "@/domain/commands/outcome";
import { updatedLinkedSibling } from "@/domain/group/linked-sibling";
import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import type { LinkGroup } from "@/domain/group/template";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import { type LineUpdate, type RawLine, reconcileLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

interface EditLinesOptions {
  derivesText?: boolean;
  propagateToSiblings?: boolean;
  copiesSharedTiming?: boolean;
}

type PlannedEdit = readonly LineUpdate[] | { refused: Refusal };

// -- Functions ----------------------------------------------------------------

// The one way a command writes line patches: each patch lands on its line and, when asked, on its linked copies.
function withLineUpdates(root: LyricRoot, updates: readonly LineUpdate[], propagateToSiblings: boolean): Applied {
  const lines = [...root.lines];
  const indexById = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) indexById.set(lines[i].id, i);

  for (const { id, updates: lineUpdates } of updates) {
    const targetIdx = indexById.get(id);
    const target = targetIdx !== undefined ? lines[targetIdx] : undefined;
    if (targetIdx === undefined || !target) continue;
    lines[targetIdx] = reconcileLine({ ...target, ...lineUpdates });

    const linkScope = propagateToSiblings ? getLinkScope(target) : null;
    if (!linkScope) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.id === id || !isLinkedSibling(line, linkScope)) continue;
      lines[i] = updatedLinkedSibling(line, target, lineUpdates);
    }
  }
  return applied(
    { ...root, lines },
    updates.map((update) => update.id),
  );
}

// A command that plans line patches; an empty plan writes nothing.
function lineEditCommand(
  note: HistoryNote,
  plan: (root: LyricRoot, ctx: CommandContext) => PlannedEdit,
  options: EditLinesOptions = {},
): LyricCommand {
  const { derivesText = true, propagateToSiblings = true, copiesSharedTiming = true } = options;
  return {
    note,
    derivesText,
    copiesSharedTiming,
    run: (root, ctx) => {
      const planned = plan(root, ctx);
      if ("refused" in planned) return planned;
      return planned.length === 0 ? applied(root, []) : withLineUpdates(root, planned, propagateToSiblings);
    },
  };
}

// -- Commands -----------------------------------------------------------------

// Generic line patch for callers that still compute lines themselves; named commands replace it.
function editLines(updates: readonly LineUpdate[], options: EditLinesOptions = {}): LyricCommand {
  const { derivesText = true, propagateToSiblings = true, copiesSharedTiming = true } = options;
  return {
    note: { command: "edit lines", args: updates.map((update) => update.id) },
    derivesText,
    copiesSharedTiming,
    run: (root) => withLineUpdates(root, updates, propagateToSiblings),
  };
}

// Data that follows the lyrics (language refresh, alignment retime): no siblings, no shared copy, no text.
function patchLines(updates: readonly LineUpdate[]): LyricCommand {
  return {
    note: { command: "patch lines", args: updates.map((update) => update.id) },
    derivesText: false,
    copiesSharedTiming: false,
    run: (root) =>
      applied(
        { ...root, lines: applyLineUpdates(root.lines, updates) },
        updates.map((update) => update.id),
      ),
  };
}

function replaceLines(lines: RawLine[], groups?: LinkGroup[]): LyricCommand {
  return {
    note: { command: "replace lines", args: [lines.length] },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root) => applied({ ...root, lines, groups: groups ?? root.groups }, changedLineIds(root.lines, lines)),
  };
}

function insertEmptyLine({
  anchorLineId,
  position,
}: {
  anchorLineId: string;
  position: "above" | "below";
}): LyricCommand {
  return {
    note: { command: "insert line", args: [anchorLineId, position] },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root, ctx) => {
      const anchorIndex = root.lines.findIndex((line) => line.id === anchorLineId);
      if (anchorIndex === -1) return refused({ reason: "line-gone", lineId: anchorLineId });
      const newLine = { id: ctx.newId(), text: "", agentId: root.agents?.[0]?.id ?? "v1" };
      const lines = root.lines.toSpliced(position === "above" ? anchorIndex : anchorIndex + 1, 0, newLine);
      return applied({ ...root, lines }, [newLine.id]);
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { editLines, insertEmptyLine, lineEditCommand, patchLines, replaceLines, withLineUpdates };
