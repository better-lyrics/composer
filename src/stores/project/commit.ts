import { partsAfterLineChange } from "insync/part-membership";
import type { LyricLine } from "@/domain/line/model";
import type { LyricCommand } from "@/domain/commands/command";
import { type Applied, type LyricRoot, type Outcome, applied, isRefused, refused } from "@/domain/commands/outcome";
import { foldLines } from "@/domain/group/fold";
import type { LyricDoc } from "@/domain/group/model";
import { withoutOrphanPieces } from "@/domain/language/pieces";
import { commandContext } from "@/stores/project/command-context";
import { amendCurrentStep, commitHistory } from "@/stores/project/history-helpers";
import type { CommitMode } from "@/stores/project/history-types";
import type { ProjectState } from "@/stores/project/types";
import { projectDoc, withBody } from "@/stores/project/with-body";

// -- Types --------------------------------------------------------------------

interface CommitResult {
  patch: Partial<ProjectState> | null;
  outcome: Outcome;
  copiedGroupIds: readonly string[];
}

// -- Helpers ------------------------------------------------------------------

function rootOf(state: ProjectState): LyricRoot {
  return {
    lines: state.lines,
    groups: state.groups,
    agents: state.agents,
    parts: state.parts,
    passthrough: state.passthrough,
  };
}

function withChangedLinesSettled(before: readonly LyricLine[], after: LyricLine[]): LyricLine[] {
  if (before === after) return after;
  const unchangedLines = new Set<LyricLine>(before);
  const settled = after.map((line) => (unchangedLines.has(line) ? line : withoutOrphanPieces(line)));
  return settled.every((line, index) => line === after[index]) ? after : settled;
}

function sameLineIds(before: readonly LyricLine[], after: readonly LyricLine[]): boolean {
  if (before === after) return true;
  if (before.length !== after.length) return false;
  for (let index = 0; index < after.length; index++) if (after[index].id !== before[index].id) return false;
  return true;
}

// Parts a command left alone follow its lines: a line that went leaves its part, a line inserted inside one joins it.
function withPartsSettled(before: LyricRoot, after: LyricRoot): LyricRoot {
  if (after.parts !== before.parts || after.parts.length === 0 || sameLineIds(before.lines, after.lines)) return after;
  const lineId = (line: LyricLine) => line.id;
  const parts = partsAfterLineChange(after.parts, before.lines.map(lineId), after.lines.map(lineId));
  return parts === after.parts ? after : { ...after, parts };
}

interface Written {
  root: LyricRoot;
  doc: LyricDoc;
}

// Command output goes back into the doc through the fold; a copy that would go below zero refuses the command.
function folded(
  state: ProjectState,
  doc: LyricDoc,
  root: LyricRoot,
  ran: Applied,
  copiesSharedTiming: boolean,
): (Written & { copiedGroupIds: readonly string[] }) | null {
  const after = withChangedLinesSettled(state.lines, ran.root.lines);
  const fold = foldLines({ doc, after, touched: ran.touched, groups: root.groups, copiesSharedTiming });
  if (fold.rejected) return null;
  const settled = withChangedLinesSettled(state.lines, fold.lines);
  if (settled === fold.lines)
    return { root: { ...ran.root, lines: fold.lines }, doc: fold.doc, copiedGroupIds: fold.copiedGroupIds };
  const resettled = foldLines({
    doc: fold.doc,
    after: settled,
    touched: [],
    groups: root.groups,
    copiesSharedTiming: false,
  });
  return { root: { ...ran.root, lines: resettled.lines }, doc: resettled.doc, copiedGroupIds: fold.copiedGroupIds };
}

function writeRoot(
  state: ProjectState,
  written: Written,
  command: LyricCommand,
  mode: CommitMode,
): Partial<ProjectState> {
  const { root } = written;
  const body = withBody(written.doc);
  if (mode === "amend") return amendCurrentStep(state, body);
  if (mode === "pending") {
    return {
      ...body,
      groups: root.groups,
      agents: root.agents,
      parts: root.parts,
      passthrough: root.passthrough,
      isDirty: true,
      isDirtySinceHistory: true,
      pendingNote: command.note,
    };
  }
  return commitHistory(
    state,
    { body, groups: root.groups, agents: root.agents, parts: root.parts, passthrough: root.passthrough },
    { note: command.note },
  );
}

// -- Functions ----------------------------------------------------------------

function commitCommand(state: ProjectState, command: LyricCommand, mode: CommitMode): CommitResult {
  const ctx = commandContext();
  const before = rootOf(state);
  const doc = projectDoc(state);
  const ran = command.run(before, ctx);
  if (isRefused(ran) || ran.root === before) return { patch: null, outcome: ran, copiedGroupIds: [] };
  const copied = folded(state, doc, before, ran, command.copiesSharedTiming);
  if (!copied) return { patch: null, outcome: refused({ reason: "copy-below-zero" }), copiedGroupIds: [] };
  const outcome = command.afterSharedCopy
    ? command.afterSharedCopy(copied.root, ctx)
    : applied(copied.root, ran.touched);
  if (isRefused(outcome)) return { patch: null, outcome, copiedGroupIds: [] };
  const written = outcome.root === copied.root ? copied : folded(state, copied.doc, copied.root, outcome, false);
  if (!written) return { patch: null, outcome: refused({ reason: "copy-below-zero" }), copiedGroupIds: [] };
  const parted = withPartsSettled(before, written.root);
  return {
    patch: writeRoot(state, { root: parted, doc: written.doc }, command, mode),
    outcome,
    copiedGroupIds: command.announcesSharedCopy === false ? [] : copied.copiedGroupIds,
  };
}

// -- Exports ------------------------------------------------------------------

export { commitCommand };
