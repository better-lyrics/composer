import { withLineIds } from "@/domain/group/line-ids";
import {
  type BodyItem,
  type Instance,
  instanceSlots,
  isInstance,
  type LyricDoc,
  type TemplateLine,
} from "@/domain/group/model";
import { ownTimedLine, retimedLine, templateContent, untimedLine } from "@/domain/group/template-line";
import type { LyricLine } from "@/domain/line/model";

// -- Caches -------------------------------------------------------------------

// Per instance item and template line, so a template edit rebuilds only its group's lines and every other line keeps
// its object.
const linesByInstance = new WeakMap<Instance, WeakMap<TemplateLine, LyricLine>>();
const linesByDoc = new WeakMap<LyricDoc, LyricLine[]>();

// -- Lines --------------------------------------------------------------------

function templateSlotLine(template: TemplateLine, instance: Instance): LyricLine {
  const content = templateContent(template);
  const timed = instance.ownTiming
    ? ownTimedLine(content, instance.ownTiming)
    : instance.at === undefined
      ? untimedLine(content)
      : retimedLine(content, instance.at);
  const line = withLineIds(timed, instance.lineIds[template.slot], instance.ids?.[template.slot] ?? {});
  return { ...line, groupId: instance.groupId, instanceIdx: instance.idx, templateLineIdx: template.slot };
}

function cachedSlotLine(template: TemplateLine, instance: Instance): LyricLine {
  const cached = linesByInstance.get(instance)?.get(template);
  if (cached) return cached;
  const line = templateSlotLine(template, instance);
  primeSlotLine(template, instance, line);
  return line;
}

// A line read from flat lines is what its slot flattens to, so the flattened view keeps that object.
function primeSlotLine(template: TemplateLine, instance: Instance, line: LyricLine): void {
  let byTemplate = linesByInstance.get(instance);
  if (!byTemplate) {
    byTemplate = new WeakMap();
    linesByInstance.set(instance, byTemplate);
  }
  byTemplate.set(template, line);
}

// The instance's lines in slot order.
function instanceLines(instance: Instance, template: readonly TemplateLine[]): LyricLine[] {
  const bySlot = new Map(template.map((line) => [line.slot, line]));
  return instanceSlots(instance).flatMap((slot) => {
    const replaced = instance.replaced?.[slot];
    if (replaced) return [replaced];
    const templateLine = bySlot.get(slot);
    return templateLine ? [cachedSlotLine(templateLine, instance)] : [];
  });
}

function itemLines(item: BodyItem, doc: LyricDoc): LyricLine[] {
  return isInstance(item) ? instanceLines(item, doc.templates[item.groupId] ?? []) : [item];
}

// -- Functions ----------------------------------------------------------------

function flattenBody(doc: LyricDoc): LyricLine[] {
  const cached = linesByDoc.get(doc);
  if (cached) return cached;
  const lines = doc.body.flatMap((item) => itemLines(item, doc));
  linesByDoc.set(doc, lines);
  return lines;
}

// A doc built from known lines flattens to exactly those lines, objects included.
function withFlatLines(doc: LyricDoc, lines: LyricLine[]): LyricDoc {
  linesByDoc.set(doc, lines);
  return doc;
}

function knownFlatLines(doc: LyricDoc): LyricLine[] | undefined {
  return linesByDoc.get(doc);
}

// -- Exports ------------------------------------------------------------------

export { flattenBody, instanceLines, knownFlatLines, primeSlotLine, templateSlotLine, withFlatLines };
