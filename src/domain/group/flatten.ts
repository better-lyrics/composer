import { withLineIds } from "@/domain/group/line-ids";
import { type Instance, isInstanceSpan, type LyricDoc, type TemplateLine } from "@/domain/group/model";
import { ownTimedLine, retimedLine, templateContent, untimedLine } from "@/domain/group/template-line";
import type { LyricLine } from "@/domain/line/model";

// -- Caches -------------------------------------------------------------------

// Per instance and template line, so a template edit rebuilds only its group's lines and every other line keeps its
// object.
const linesByInstance = new WeakMap<Instance, WeakMap<TemplateLine, LyricLine>>();
const linesByDoc = new WeakMap<LyricDoc, LyricLine[]>();
const slotsByTemplate = new WeakMap<readonly TemplateLine[], Map<number, TemplateLine>>();

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

// A line read from flat lines is what its slot flattens to, so the flattened view keeps that object.
function primeSlotLine(template: TemplateLine, instance: Instance, line: LyricLine): void {
  let byTemplate = linesByInstance.get(instance);
  if (!byTemplate) {
    byTemplate = new WeakMap();
    linesByInstance.set(instance, byTemplate);
  }
  byTemplate.set(template, line);
}

function cachedSlotLine(template: TemplateLine, instance: Instance): LyricLine {
  const cached = linesByInstance.get(instance)?.get(template);
  if (cached) return cached;
  const line = templateSlotLine(template, instance);
  primeSlotLine(template, instance, line);
  return line;
}

function templateBySlot(template: readonly TemplateLine[]): Map<number, TemplateLine> {
  let bySlot = slotsByTemplate.get(template);
  if (!bySlot) {
    bySlot = new Map(template.map((line) => [line.slot, line]));
    slotsByTemplate.set(template, bySlot);
  }
  return bySlot;
}

// The line an instance has at `slot`: its own when it holds one, else its template line.
function instanceSlotLine(doc: LyricDoc, instance: Instance, slot: number): LyricLine | undefined {
  const replaced = instance.replaced?.[slot];
  if (replaced) return replaced;
  const templateLine = templateBySlot(doc.templates[instance.groupId] ?? []).get(slot);
  return templateLine && cachedSlotLine(templateLine, instance);
}

// -- Functions ----------------------------------------------------------------

function flattenBody(doc: LyricDoc): LyricLine[] {
  const cached = linesByDoc.get(doc);
  if (cached) return cached;
  const lines = doc.body.flatMap((item) => {
    if (!isInstanceSpan(item)) return [item];
    const instance = doc.instances[item.key];
    return item.slots.flatMap((slot) => instanceSlotLine(doc, instance, slot) ?? []);
  });
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

export {
  flattenBody,
  instanceSlotLine,
  knownFlatLines,
  primeSlotLine,
  templateBySlot,
  templateSlotLine,
  withFlatLines,
};
