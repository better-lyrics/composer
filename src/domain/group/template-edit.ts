import { carriedLine, sameSharedContent } from "@/domain/group/carried-line";
import { sharesTiming } from "@/domain/group/shared-timing";
import type { LineageCounterpart, LineagePair } from "@/domain/group/syllable-lineage";
import type { LinkGroup } from "insync/group";
import type { InstanceAnchors } from "@/domain/group/template-copy";
import { instanceBounds } from "@/domain/instance/bounds";
import { instanceKey } from "insync/instance-key";
import { isLinked, type LinkedLine } from "insync/instance-predicates";
import { effectiveBounds } from "insync/line-bounds";
import type { LyricLine } from "insync/line";

// -- Types --------------------------------------------------------------------

type SlotLine = LinkedLine & { templateLineIdx: number };

interface TemplateEditInput {
  before: readonly LyricLine[];
  after: LyricLine[];
  groups: readonly LinkGroup[];
  // Where each instance sits, from the doc; read from the lines when left out.
  anchors?: InstanceAnchors;
  splitChar: string;
}

// A split that reached other instances, with how many instances have it now.
interface CarriedSplit {
  groupId: string;
  instances: number;
}

interface TemplateEdits {
  lines: LyricLine[];
  splits: CarriedSplit[];
}

interface Edit {
  before: SlotLine;
  after: SlotLine;
}

// -- Helpers ------------------------------------------------------------------

function isSlotLine(line: LyricLine | undefined): line is SlotLine {
  return !!line && isLinked(line) && line.templateLineIdx !== undefined && !line.detached;
}

const slotKey = (groupId: string, slot: number) => `${groupId}\u0000${slot}`;

// Group lines whose shared content changed, first of each template line in song order.
function templateLineEdits(
  before: readonly LyricLine[],
  after: readonly LyricLine[],
): { edits: Edit[]; edited: Set<string> } {
  let beforeById: Map<string, LyricLine> | undefined;
  const previousOf = (line: LyricLine, index: number) => {
    if (before[index]?.id === line.id) return before[index];
    beforeById ??= new Map(before.map((old) => [old.id, old]));
    return beforeById.get(line.id);
  };
  const claimed = new Set<string>();
  const edited = new Set<string>();
  const edits: Edit[] = [];
  for (let index = 0; index < after.length; index++) {
    const line = after[index];
    if (!isSlotLine(line)) continue;
    if (before[index] === line) continue;
    const previous = previousOf(line, index);
    if (!isSlotLine(previous) || previous === line) continue;
    if (previous.groupId !== line.groupId || previous.templateLineIdx !== line.templateLineIdx) continue;
    if (sameSharedContent(previous, line)) continue;
    edited.add(line.id);
    const key = slotKey(line.groupId, line.templateLineIdx);
    if (claimed.has(key)) continue;
    claimed.add(key);
    edits.push({ before: previous, after: line });
  }
  return { edits, edited };
}

// The lines of every instance of the edited groups by template line, read in one pass.
function linesByInstance(
  lines: readonly LyricLine[],
  groupIds: ReadonlySet<string>,
): Map<string, Map<number, SlotLine>> {
  const byInstance = new Map<string, Map<number, SlotLine>>();
  for (const line of lines) {
    if (!isSlotLine(line) || !groupIds.has(line.groupId)) continue;
    const key = instanceKey(line.groupId, line.instanceIdx);
    const bySlot = byInstance.get(key) ?? new Map<number, SlotLine>();
    bySlot.set(line.templateLineIdx, line);
    byInstance.set(key, bySlot);
  }
  return byInstance;
}

// Without the doc's anchors, an instance anchors at its first time.
function firstTimes(byInstance: ReadonlyMap<string, ReadonlyMap<number, SlotLine>>): InstanceAnchors {
  const byGroup = new Map<string, Map<number, number>>();
  for (const bySlot of byInstance.values()) {
    const [first] = bySlot.values();
    const begin = instanceBounds([...bySlot.values()])?.begin;
    if (!first || begin === undefined) continue;
    const anchors = byGroup.get(first.groupId) ?? new Map<number, number>();
    anchors.set(first.instanceIdx, begin);
    byGroup.set(first.groupId, anchors);
  }
  return (groupId) => byGroup.get(groupId) ?? new Map();
}

// The other instance's syllable where each syllable of the edited instance stood, on any of its lines, so a word
// moved from one line to another keeps that instance's timing.
function counterpartOf(source: Map<number, SlotLine>, target: Map<number, SlotLine>): LineageCounterpart {
  const pairs = new Map<string, LineagePair>();
  for (const [slot, line] of source) {
    const other = target.get(slot);
    if (!other) continue;
    line.tracks.forEach((track, index) => {
      const otherTrack = other.tracks[index];
      if (!otherTrack || otherTrack.role !== track.role || otherTrack.syllables.length !== track.syllables.length)
        return;
      track.syllables.forEach((syllable, position) => {
        pairs.set(syllable.id, { source: syllable, target: otherTrack.syllables[position] });
      });
    });
  }
  return (id) => pairs.get(id);
}

function nextLineStart(lines: readonly LyricLine[], index: number): number {
  for (let next = index + 1; next < lines.length; next++) {
    const bounds = effectiveBounds(lines[next]);
    if (bounds) return bounds.begin;
  }
  return Number.POSITIVE_INFINITY;
}

function previousLineEnd(lines: readonly LyricLine[], index: number): number {
  for (let previous = index - 1; previous >= 0; previous--) {
    const bounds = effectiveBounds(lines[previous]);
    if (bounds) return bounds.end;
  }
  return 0;
}

function isSplit(edit: Edit): boolean {
  return edit.after.tracks.some((track, index) => {
    const previous = edit.before.tracks[index];
    if (!previous || track.syllables.length <= previous.syllables.length) return false;
    const text = (syllables: typeof track.syllables) => syllables.map((syllable) => syllable.text).join("");
    return text(track.syllables) === text(previous.syllables);
  });
}

// -- Functions ----------------------------------------------------------------

// An edit to a group line's content is an edit to its template line, so every other instance that follows the
// template and was not edited itself gets it: on the shared timing where both instances share it, else on its own
// timing. Detached lines, and instances the same command edited differently, keep their own content. Work grows with
// the lines and the edited template lines.
function carryTemplateEdits({ before, after, groups, anchors, splitChar }: TemplateEditInput): TemplateEdits {
  const { edits, edited } = templateLineEdits(before, after);
  if (edits.length === 0) return { lines: after, splits: [] };
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const byInstance = linesByInstance(before, new Set(edits.map((edit) => edit.after.groupId)));
  const anchorsOf = anchors ?? firstTimes(byInstance);
  const offsetOf = (groupId: string, from: number, to: number) => {
    const groupAnchors = anchorsOf(groupId);
    const fromAt = groupAnchors.get(from);
    const toAt = groupAnchors.get(to);
    return fromAt === undefined || toAt === undefined ? null : toAt - fromAt;
  };
  const counterparts = new Map<string, LineageCounterpart>();
  const counterpartFor = (groupId: string, from: number, to: number) => {
    const key = `${instanceKey(groupId, from)}\u0000${to}`;
    let counterpart = counterparts.get(key);
    if (!counterpart) {
      const none = new Map<number, SlotLine>();
      counterpart = counterpartOf(
        byInstance.get(instanceKey(groupId, from)) ?? none,
        byInstance.get(instanceKey(groupId, to)) ?? none,
      );
      counterparts.set(key, counterpart);
    }
    return counterpart;
  };
  const bySlot = new Map(edits.map((edit) => [slotKey(edit.after.groupId, edit.after.templateLineIdx), edit]));
  const splits = new Map<string, Set<number>>();
  let lines = after;
  after.forEach((line, index) => {
    if (!isSlotLine(line)) return;
    const edit = bySlot.get(slotKey(line.groupId, line.templateLineIdx));
    if (!edit || edited.has(line.id) || sameSharedContent(line, edit.after)) return;
    const { groupId, instanceIdx: from } = edit.after;
    const group = groupsById.get(groupId);
    const shared = sharesTiming(group, from) && sharesTiming(group, line.instanceIdx);
    const offset = shared ? offsetOf(groupId, from, line.instanceIdx) : null;
    const carried = carriedLine({
      before: edit.before,
      after: edit.after,
      own: line,
      offset,
      counterpart: counterpartFor(groupId, from, line.instanceIdx),
      room: { floor: previousLineEnd(after, index), limit: nextLineStart(after, index) },
      splitChar,
    });
    if (lines === after) lines = [...after];
    lines[index] = carried;
    if (isSplit(edit)) splits.set(groupId, (splits.get(groupId) ?? new Set([from])).add(line.instanceIdx));
  });
  return { lines, splits: [...splits].map(([groupId, instances]) => ({ groupId, instances: instances.size })) };
}

// -- Exports ------------------------------------------------------------------

export type { CarriedSplit };
export { carryTemplateEdits };
