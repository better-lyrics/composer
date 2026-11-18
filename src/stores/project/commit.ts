import { partsAfterLineChange } from "insync/part-membership";
import type { LyricLine } from "insync/line";
import type { LyricCommand } from "insync/commands/command";
import { type Applied, applied, isRefused, type LyricRoot, type Outcome, refused } from "insync/commands/outcome";
import { foldLines } from "insync/group-fold";
import type { LyricDoc } from "insync/group";
import type { CarriedSplit } from "insync/group-template-edit";
import { withSettledReadings } from "insync/language-settled-readings";
import { isStructurallyEqual } from "insync/structural-equal";
import { commandContext } from "@/stores/project/command-context";
import { amendCurrentStep, commitHistory } from "@/stores/project/history-helpers";
import type { CommitMode } from "@/stores/project/history-types";
import type { ProjectState } from "@/stores/project/types";
import { projectDoc, withBody } from "@/stores/project/with-body";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface CommitResult {
  patch: Partial<ProjectState> | null;
  outcome: Outcome;
  copiedGroupIds: readonly string[];
  splits: readonly CarriedSplit[];
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

// Lines in place are compared by position; only a line that moved or changed looks the old lines up.
function withChangedLinesSettled(before: readonly LyricLine[], after: LyricLine[]): LyricLine[] {
  if (before === after) return after;
  let unchangedLines: Set<LyricLine> | undefined;
  let beforeById: Map<string, LyricLine> | undefined;
  let settled: LyricLine[] | undefined;
  for (let index = 0; index < after.length; index++) {
    const line = after[index];
    if (line === before[index]) continue;
    unchangedLines ??= new Set(before);
    if (unchangedLines.has(line)) continue;
    beforeById ??= new Map(before.map((beforeLine) => [beforeLine.id, beforeLine]));
    const settledLine = withSettledReadings(beforeById.get(line.id), line);
    if (settledLine === line) continue;
    settled ??= after.slice();
    settled[index] = settledLine;
  }
  return settled ?? after;
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

// A command that writes back the values already there is no step: undo would stop on it and change nothing. The fold
// builds a new doc for any rewritten line, so the doc is compared by value, and only once every line matched.
function changesNothing(before: LyricRoot, after: LyricRoot, beforeDoc: LyricDoc, afterDoc: LyricDoc): boolean {
  if (after.groups !== before.groups || after.agents !== before.agents || after.parts !== before.parts) return false;
  if (after.passthrough !== before.passthrough || after.lines.length !== before.lines.length) return false;
  const sameLines = after.lines.every(
    (line, index) => line === before.lines[index] || isStructurallyEqual(line, before.lines[index]),
  );
  return sameLines && isStructurallyEqual(afterDoc, beforeDoc);
}

interface Written {
  root: LyricRoot;
  doc: LyricDoc;
}

interface FoldOptions {
  copiesSharedTiming: boolean;
  carriesTemplateEdits: boolean;
  songEnd: number;
  splitChar: string;
}

type Folded = Written & { copiedGroupIds: readonly string[]; splits: readonly CarriedSplit[]; copyBlocked?: true };

// Command output goes back into the doc through the fold, which carries template edits and shared timing.
function folded(state: ProjectState, doc: LyricDoc, root: LyricRoot, ran: Applied, options: FoldOptions): Folded {
  const after = withChangedLinesSettled(state.lines, ran.root.lines);
  const fold = foldLines({
    doc,
    after,
    touched: ran.touched,
    groups: root.groups,
    ...options,
    splitChar: getSplitCharacter(),
  });
  const settled = withChangedLinesSettled(state.lines, fold.lines);
  const { copiedGroupIds, splits, copyBlocked } = fold;
  if (copyBlocked) return { root, doc, copiedGroupIds, splits, copyBlocked };
  if (settled === fold.lines)
    return { root: { ...ran.root, lines: fold.lines }, doc: fold.doc, copiedGroupIds, splits };
  const resettled = foldLines({
    doc: fold.doc,
    after: settled,
    touched: [],
    groups: root.groups,
    copiesSharedTiming: false,
    carriesTemplateEdits: false,
    songEnd: options.songEnd,
    splitChar: options.splitChar,
  });
  return { root: { ...ran.root, lines: resettled.lines }, doc: resettled.doc, copiedGroupIds, splits };
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
  const nothing = { patch: null, copiedGroupIds: [], splits: [] };
  if (isRefused(ran) || ran.root === before) return { ...nothing, outcome: ran };
  const carriesTemplateEdits = command.writesEveryLine !== true;
  const copied = folded(state, doc, before, ran, {
    copiesSharedTiming: command.copiesSharedTiming,
    carriesTemplateEdits,
    songEnd: ctx.songEnd,
    splitChar: ctx.splitChar,
  });
  if (copied.copyBlocked) return { ...nothing, outcome: refused({ reason: "placement-out-of-range" }) };
  const outcome = command.afterSharedCopy
    ? command.afterSharedCopy(copied.root, ctx)
    : applied(copied.root, ran.touched);
  if (isRefused(outcome)) return { ...nothing, outcome };
  const written =
    outcome.root === copied.root
      ? copied
      : folded(state, copied.doc, copied.root, outcome, {
          copiesSharedTiming: false,
          carriesTemplateEdits,
          songEnd: ctx.songEnd,
          splitChar: ctx.splitChar,
        });
  const parted = withPartsSettled(before, written.root);
  if (changesNothing(before, parted, doc, written.doc)) return { ...nothing, outcome };
  return {
    patch: writeRoot(state, { root: parted, doc: written.doc }, command, mode),
    outcome,
    copiedGroupIds: command.announcesSharedCopy === false ? [] : copied.copiedGroupIds,
    splits: [...copied.splits, ...(written === copied ? [] : written.splits)],
  };
}

// -- Exports ------------------------------------------------------------------

export { commitCommand };
