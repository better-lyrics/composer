import type { CommandContext, LyricCommand } from "@/domain/commands/command";
import { type Applied, type LyricRoot, type Outcome, applied, isRefused, refused } from "@/domain/commands/outcome";
import { sharedTimingFanOut } from "@/domain/group/shared-timing";
import type { RawLine } from "@/domain/line/model";
import { withDerivedText } from "@/domain/line/reconstruct-text";
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

function withChangedTextDerived(before: readonly RawLine[], after: RawLine[], splitChar: string): RawLine[] {
  const unchangedLines = new Set<RawLine>(before);
  const previousById = new Map(before.map((line) => [line.id, line]));
  return after.map((line) =>
    unchangedLines.has(line) ? line : withDerivedText(line, splitChar, previousById.get(line.id)),
  );
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
  ctx: CommandContext,
): Partial<ProjectState> {
  const lines = command.derivesText ? withChangedTextDerived(state.lines, root.lines, ctx.splitChar) : root.lines;
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
  return { patch: writeRoot(state, outcome.root, command, mode, ctx), outcome, copiedGroupIds };
}

// -- Exports ------------------------------------------------------------------

export { commitCommand };
