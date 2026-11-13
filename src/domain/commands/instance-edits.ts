import type { LyricCommand } from "@/domain/commands/command";
import { applied, changedLineIds, refused, withLines } from "@/domain/commands/outcome";
import { unlinkLines } from "@/domain/group/linking";
import { withNewInstance, withOwnTiming } from "@/domain/group/own-timing";
import { placeSharedInstance, realignSharedInstance } from "@/domain/group/shared-placement";
import { wholeSongRange } from "@/domain/group/shared-timing";
import { type LineTemplate, offsetTemplateWords } from "@/domain/group/template";
import { nextInstanceIdx } from "@/domain/instance/enumerate";
import { belongsToInstance, isAttachedToInstance } from "@/domain/instance/predicates";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import { type LineUpdate, type LyricLine, reconcileLine } from "@/domain/line/model";
import { clampShiftDelta, shiftLineTiming } from "@/domain/line/shift";
import { songEndOrUnbounded } from "@/utils/timing/song-end";

// -- Constants ----------------------------------------------------------------

const MIN_SHIFT_SECONDS = 0.001;

// -- Helpers ------------------------------------------------------------------

function instanceLine(
  template: LineTemplate,
  id: string,
  groupId: string,
  instanceIdx: number,
  templateLineIdx: number,
  instanceStart: number,
): LyricLine {
  return reconcileLine({
    id,
    text: template.text,
    agentId: template.agentId,
    groupId,
    instanceIdx,
    templateLineIdx,
    ...(template.relativeBegin !== undefined ? { begin: template.relativeBegin + instanceStart } : {}),
    ...(template.relativeEnd !== undefined ? { end: template.relativeEnd + instanceStart } : {}),
    ...(template.words ? { words: offsetTemplateWords(template.words, instanceStart) } : {}),
    ...(template.backgroundText !== undefined ? { backgroundText: template.backgroundText } : {}),
    ...(template.backgroundWords
      ? { backgroundWords: offsetTemplateWords(template.backgroundWords, instanceStart) }
      : {}),
    ...(template.backgroundTextSource !== undefined ? { backgroundTextSource: template.backgroundTextSource } : {}),
    ...(template.translations ? { translations: structuredClone(template.translations) } : {}),
    ...(template.transliteration ? { transliteration: structuredClone(template.transliteration) } : {}),
  });
}

// -- Commands -----------------------------------------------------------------

function addInstance(
  groupId: string,
  structure: readonly LineTemplate[],
  instanceStart: number,
  insertAtIndex?: number,
): LyricCommand {
  return {
    note: { command: "add instance", args: [groupId, instanceStart] },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root, ctx) => {
      const instanceIdx = nextInstanceIdx(root.lines, groupId);
      const newLines = structure.map((template, templateLineIdx) =>
        instanceLine(template, ctx.newId(), groupId, instanceIdx, templateLineIdx, instanceStart),
      );
      const lines =
        insertAtIndex === undefined || insertAtIndex >= root.lines.length || insertAtIndex < 0
          ? [...root.lines, ...newLines]
          : [...root.lines.slice(0, insertAtIndex), ...newLines, ...root.lines.slice(insertAtIndex)];
      return applied(
        { ...root, lines, groups: withNewInstance(root.groups, groupId, instanceIdx) },
        newLines.map((line) => line.id),
      );
    },
  };
}

function removeInstance(groupId: string, instanceIdx: number): LyricCommand {
  return {
    note: { command: "remove instance", args: [groupId, instanceIdx] },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root) => {
      const lines = unlinkLines(root.lines, (line) => belongsToInstance(line, groupId, instanceIdx));
      const remainingInGroup = lines.some((line) => line.groupId === groupId);
      const groups = remainingInGroup ? root.groups : root.groups.filter((group) => group.id !== groupId);
      return applied({ ...root, lines, groups }, changedLineIds(root.lines, lines));
    },
  };
}

function detachLine(lineId: string): LyricCommand {
  return {
    note: { command: "detach line", args: [lineId] },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root) => {
      const lines = unlinkLines(root.lines, (line) => line.id === lineId);
      return applied({ ...root, lines }, changedLineIds(root.lines, lines));
    },
  };
}

function shiftInstance(groupId: string, instanceIdx: number, deltaSeconds: number, duration: number): LyricCommand {
  return {
    note: { command: "shift instance", args: [groupId, instanceIdx, deltaSeconds] },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root) => {
      const isMember = (line: LyricLine) => isAttachedToInstance(line, groupId, instanceIdx);
      const delta = clampShiftDelta(root.lines.filter(isMember), deltaSeconds, wholeSongRange(duration));
      if (Math.abs(delta) < MIN_SHIFT_SECONDS) return applied(root, []);
      return withLines(
        root,
        root.lines.map((line) => (isMember(line) ? reconcileLine({ ...line, ...shiftLineTiming(line, delta) }) : line)),
      );
    },
  };
}

function setInstanceOwnTiming(groupId: string, instanceIdx: number, own: boolean, duration: number): LyricCommand {
  return {
    note: { command: own ? "own timing" : "share timing", args: [groupId, instanceIdx] },
    derivesText: false,
    copiesSharedTiming: false,
    run: (root) => {
      const groups = root.groups.map((group) =>
        group.id === groupId ? withOwnTiming(group, instanceIdx, own) : group,
      );
      const realignment = own
        ? { updates: [] }
        : realignSharedInstance(root.lines, groups, groupId, instanceIdx, songEndOrUnbounded(duration));
      if ("refusal" in realignment) return refused({ reason: "realign", refusal: realignment.refusal });
      const lines = applyLineUpdates(root.lines, realignment.updates);
      return applied({ ...root, groups, lines }, changedLineIds(root.lines, lines));
    },
  };
}

// The tap's own updates go through the shared copy first; the instance is placed on the copied lines.
function placeInstance(
  groupId: string,
  instanceIdx: number,
  start: number,
  duration: number,
  precedingUpdates: readonly LineUpdate[] = [],
): LyricCommand {
  return {
    note: { command: "place instance", args: [groupId, instanceIdx, start] },
    derivesText: false,
    copiesSharedTiming: true,
    run: (root) =>
      applied(
        { ...root, lines: applyLineUpdates(root.lines, precedingUpdates) },
        precedingUpdates.map((update) => update.id),
      ),
    afterSharedCopy: (root) => {
      const placed = placeSharedInstance(
        root.lines,
        root.groups,
        groupId,
        instanceIdx,
        start,
        songEndOrUnbounded(duration),
      );
      if (!placed.length) return refused({ reason: "placement-out-of-range" });
      return applied(
        { ...root, lines: applyLineUpdates(root.lines, placed) },
        placed.map((update) => update.id),
      );
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { addInstance, detachLine, placeInstance, removeInstance, setInstanceOwnTiming, shiftInstance };
