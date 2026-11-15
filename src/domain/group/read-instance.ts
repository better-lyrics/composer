import { primeSlotLine, templateSlotLine } from "@/domain/group/flatten";
import { invertedIds, pairedIds, withLineIds } from "@/domain/group/line-ids";
import type { Instance, TemplateLine } from "insync/group";
import {
  fittedAnchor,
  type LineContent,
  lineContent,
  ownTimingOf,
  retimedLine,
  templateContent,
  untimedLine,
} from "@/domain/group/template-line";
import type { LyricLine } from "insync/line";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

interface HeldSlot {
  template: TemplateLine;
  line: LyricLine;
  content: LineContent;
}

// -- Helpers ------------------------------------------------------------------

// Times compare as whole milliseconds, a millisecond apart at most: what a save keeps and an export writes.
const withinOneMs = (a: number, b: number) => Math.abs(Math.round(a * 1000) - Math.round(b * 1000)) <= 1;

function sameToTheMs(a: unknown, b: unknown): boolean {
  return isStructurallyEqual(a, b, withinOneMs);
}

// The line under its template's ids, when the template holds the same content apart from timing.
function heldContent(line: LyricLine, template: TemplateLine | undefined) {
  if (!template || line.detached) return null;
  const templateLine = templateContent(template);
  const renames = pairedIds(templateLine, lineContent(line));
  if (!renames) return null;
  const content = withLineIds(lineContent(line), template.id, invertedIds(renames));
  return isStructurallyEqual(untimedLine(content), untimedLine(templateLine)) ? { content, renames } : null;
}

// Untimed, placed at the first anchor that gives every held line back, or on its own timing.
function placement(
  held: readonly HeldSlot[],
  anchors: readonly (number | undefined)[],
): Pick<Instance, "at" | "ownTiming"> {
  if (held.every(({ content }) => isStructurallyEqual(content, untimedLine(content)))) return {};
  const placedAt = (at: number) => (slot: HeldSlot) =>
    sameToTheMs(slot.content, retimedLine(templateContent(slot.template), at));
  const at = anchors.find((anchor) => anchor !== undefined && held.every(placedAt(anchor)));
  if (at !== undefined) return { at };
  return { ownTiming: ownTimingOf(held.map(({ content }) => content)) };
}

function withSlots(
  draft: Instance,
  ids: Record<number, Record<string, string>>,
  replaced: Record<number, LyricLine>,
): Instance {
  const { ids: _ids, replaced: _replaced, ...rest } = draft;
  return {
    ...rest,
    ...(Object.keys(ids).length && { ids }),
    ...(Object.keys(replaced).length && { replaced }),
  };
}

// -- Functions ----------------------------------------------------------------

// An instance read from its flat lines against its group's template, at `anchor` when it fits, else where its first
// timed line meets the template. Whatever the template cannot give to the millisecond stays on the instance.
function readInstance(
  groupId: string,
  idx: number,
  lines: readonly LyricLine[],
  template: readonly TemplateLine[],
  anchor?: number,
): Instance {
  const bySlot = new Map(template.map((line) => [line.slot, line]));
  const lineIds: Record<number, string> = {};
  const ids: Record<number, Record<string, string>> = {};
  const replaced: Record<number, LyricLine> = {};
  const held: HeldSlot[] = [];
  for (const line of lines) {
    const slot = line.templateLineIdx ?? 0;
    lineIds[slot] = line.id;
    const templateLine = bySlot.get(slot);
    const read = heldContent(line, templateLine);
    if (!read || !templateLine) {
      replaced[slot] = line;
      continue;
    }
    if (Object.keys(read.renames).length) ids[slot] = read.renames;
    held.push({ template: templateLine, line, content: read.content });
  }
  const draft = withSlots({ groupId, idx, ...placement(held, [anchor, fittedAnchor(held)]), lineIds }, ids, replaced);
  const unheld = held.filter(({ template, line }) => !sameToTheMs(templateSlotLine(template, draft), line));
  for (const { template, line } of unheld) {
    replaced[template.slot] = line;
    delete ids[template.slot];
  }
  const instance = unheld.length ? withSlots(draft, ids, replaced) : draft;
  const unheldSlots = new Set(unheld);
  for (const slot of held) if (!unheldSlots.has(slot)) primeSlotLine(slot.template, instance, slot.line);
  return instance;
}

// -- Exports ------------------------------------------------------------------

export { readInstance, sameToTheMs };
