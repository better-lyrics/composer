import type { LyricRoot, Refusal } from "@/domain/commands/outcome";
import { initialGroupSharing } from "@/domain/group/initial-sharing";
import type { SharingOutcome } from "@/domain/group/shared-placement";
import { withEvenSyllableSplits } from "@/domain/group/syllable-splits";
import { GROUP_COLORS, pickNextGroupColor } from "@/utils/group-colors";
import { isStructurallyEqual } from "@/utils/structural-equal";
import { songEndOrUnbounded } from "@/utils/timing/song-end";

// -- Types --------------------------------------------------------------------

// `next` is null when nothing changes; the sharing result is what the caller reports either way.
interface GroupPlan {
  sharing: SharingOutcome;
  next: LyricRoot | null;
  refusal?: Refusal;
}

interface RepeatingSections {
  starts: readonly number[];
  length: number;
  label?: string;
  color?: string;
  duration?: number;
}

// -- Constants ----------------------------------------------------------------

const NOTHING_SHARED: SharingOutcome = { keptOwnTiming: [], replaced: [] };
const UNCHANGED: GroupPlan = { sharing: NOTHING_SHARED, next: null };

// -- Helpers ------------------------------------------------------------------

function coversFreeLines(root: LyricRoot, starts: readonly number[], length: number): boolean {
  const covered = new Set<number>();
  for (const start of starts) {
    for (let p = start; p < start + length; p++) {
      if (p < 0 || p >= root.lines.length) return false;
      if (root.lines[p].groupId !== undefined) return false;
      if (covered.has(p)) return false;
      covered.add(p);
    }
  }
  return true;
}

function nextGroupId(root: LyricRoot): string {
  const usedGroupIds = new Set(root.groups.map((g) => g.id));
  let n = 1;
  while (usedGroupIds.has(`g${n}`)) n++;
  return `g${n}`;
}

// -- Functions ----------------------------------------------------------------

function planRepeatingSections(
  root: LyricRoot,
  { starts, length, label, color, duration }: RepeatingSections,
  splitChar: string,
  shareTimingInNewGroups: boolean,
): GroupPlan {
  if (starts.length < 2 || length < 1 || !coversFreeLines(root, starts, length)) return UNCHANGED;

  const groupId = nextGroupId(root);
  const usedColors = root.groups.map((g) => g.color);
  const groupColor = color ?? pickNextGroupColor(usedColors.length > 0 ? usedColors : GROUP_COLORS.slice(0, 0));
  const groupLabel = label ?? `Group ${root.groups.length + 1}`;

  const sortedStarts = starts.toSorted((a, b) => a - b);
  const startToInstanceIdx = new Map(sortedStarts.map((start, index) => [start, index]));

  const evenedLines = withEvenSyllableSplits(root.lines, sortedStarts, length, splitChar);
  if (!evenedLines) return { ...UNCHANGED, refusal: { reason: "uneven-syllable-splits" } };
  const updatedLines = evenedLines.map((line, idx) => {
    for (const start of sortedStarts) {
      if (idx >= start && idx < start + length) {
        return {
          ...line,
          groupId,
          instanceIdx: startToInstanceIdx.get(start) ?? 0,
          templateLineIdx: idx - start,
        };
      }
    }
    return line;
  });

  const { group, lines, keptOwnTiming, replaced } = initialGroupSharing(
    updatedLines,
    { id: groupId, label: groupLabel, color: groupColor, templateVersion: 1 },
    shareTimingInNewGroups,
    songEndOrUnbounded(duration ?? 0),
  );
  return { sharing: { keptOwnTiming, replaced }, next: { ...root, groups: [...root.groups, group], lines } };
}

function planGroupSharing(root: LyricRoot, groupId: string, duration: number): GroupPlan {
  const group = root.groups.find((candidate) => candidate.id === groupId);
  if (!group) return UNCHANGED;
  const shared = initialGroupSharing(root.lines, group, true, songEndOrUnbounded(duration));
  if (shared.lines === root.lines && isStructurallyEqual(shared.group, group)) {
    return { sharing: { keptOwnTiming: shared.keptOwnTiming, replaced: [] }, next: null };
  }
  const groups = root.groups.map((candidate) => (candidate.id === groupId ? shared.group : candidate));
  return {
    sharing: { keptOwnTiming: shared.keptOwnTiming, replaced: shared.replaced },
    next: { ...root, groups, lines: shared.lines },
  };
}

// -- Exports ------------------------------------------------------------------

export type { GroupPlan, RepeatingSections };
export { NOTHING_SHARED, planGroupSharing, planRepeatingSections };
