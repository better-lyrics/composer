import type { LyricLine } from "@/domain/line/model";
import type { CommandContext, LyricCommand } from "@/domain/commands/command";
import { type Applied, type LyricRoot, type Outcome, applied, isRefused, refused } from "@/domain/commands/outcome";
import { sharedTimingFanOut } from "@/domain/group/shared-timing";
import { withoutOrphanPieces } from "@/domain/language/pieces";
import { commandContext } from "@/stores/project/command-context";
import { amendCurrentStep, commitHistory } from "@/stores/project/history-helpers";
import type { CommitMode } from "@/stores/project/history-types";
import type { ProjectState } from "@/stores/project/types";

// -- Types --------------------------------------------------------------------

interface CommitResult {
  patch: Partial<ProjectState> | null;
  outcome: Outcome;
  copiedGroupIds: readonly string[];
}

// -- Helpers ------------------------------------------------------------------

function rootOf(state: ProjectState): LyricRoot {
  return { lines: state.lines, groups: state.groups, agents: state.agents };
}

function withChangedLinesSettled(before: readonly LyricLine[], after: LyricLine[]): LyricLine[] {
  if (before === after) return after;
  const unchangedLines = new Set<LyricLine>(before);
  const settled = after.map((line) => (unchangedLines.has(line) ? line : withoutOrphanPieces(line)));
  return settled.every((line, index) => line === after[index]) ? after : settled;
}

// A command that touched no line keeps the lines array, so line subscribers and history sharing see no change.
function sameLines(before: readonly LyricLine[], after: readonly LyricLine[]): boolean {
  return before === after || (before.length === after.length && after.every((line, index) => line === before[index]));
}

function withSharedCopy(
  before: LyricRoot,
  ran: Applied,
  command: LyricCommand,
  ctx: CommandContext,
): { outcome: Outcome; copiedGroupIds: readonly string[] } {
  const shared = sharedTimingFanOut(before.lines, ran.root.lines, before.groups, ran.touched);
  if (shared.rejected) return { outcome: refused({ reason: "copy-below-zero" }), copiedGroupIds: [] };
  const copied = applied({ ...ran.root, lines: shared.lines }, ran.touched);
  const outcome = command.afterSharedCopy ? command.afterSharedCopy(copied.root, ctx) : copied;
  return { outcome, copiedGroupIds: isRefused(outcome) ? [] : shared.touchedGroupIds };
}

function writeRoot(
  state: ProjectState,
  root: LyricRoot,
  command: LyricCommand,
  mode: CommitMode,
): Partial<ProjectState> {
  const written = withChangedLinesSettled(state.lines, root.lines);
  const lines = sameLines(state.lines, written) ? state.lines : written;
  if (mode === "amend") return amendCurrentStep(state, lines);
  if (mode === "pending") {
    return {
      lines,
      groups: root.groups,
      agents: root.agents,
      isDirty: true,
      isDirtySinceHistory: true,
      pendingNote: command.note,
    };
  }
  return commitHistory(state, { lines, groups: root.groups, agents: root.agents }, { note: command.note });
}

// -- Functions ----------------------------------------------------------------

function commitCommand(state: ProjectState, command: LyricCommand, mode: CommitMode): CommitResult {
  const ctx = commandContext();
  const before = rootOf(state);
  const ran = command.run(before, ctx);
  if (isRefused(ran) || ran.root === before) return { patch: null, outcome: ran, copiedGroupIds: [] };
  const { outcome, copiedGroupIds } = command.copiesSharedTiming
    ? withSharedCopy(before, ran, command, ctx)
    : { outcome: ran, copiedGroupIds: [] };
  if (isRefused(outcome)) return { patch: null, outcome, copiedGroupIds: [] };
  return { patch: writeRoot(state, outcome.root, command, mode), outcome, copiedGroupIds };
}

// -- Exports ------------------------------------------------------------------

export { commitCommand };
