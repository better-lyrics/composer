import type { KeptTimes, Passthrough } from "../passthrough";
import { escapeXmlAttribute, writeXmlAttrs, writeXmlElement, type XmlElement } from "../xml-node";
import { type Envelope, writtenTimes } from "./kept-times";

// -- Functions ----------------------------------------------------------------

// Kept attributes go after the ones Composer writes.
function keptAttributes(kept: Passthrough | undefined): string {
  return kept?.attrs ? writeXmlAttrs(kept.attrs) : "";
}

// Kept children each on their own line, as in the head and between sections.
function keptElementLines(kept: Passthrough | undefined, indent: string): string[] {
  return kept?.elements ? kept.elements.map((element) => `${indent}${writeXmlElement(element)}`) : [];
}

// What the writer writes for one modelled child, and the anchors of kept elements that go right after it.
interface Placed<T> {
  out: T;
  anchors: readonly string[];
}

// Each id resolved to itself when `holds` it, else to the nearest earlier id in `order` it holds; ids not in `order`
// and with nothing held before them resolve to none.
function anchorResolver(order: readonly string[], holds: (id: string) => boolean): (id: string) => string | undefined {
  const nearest = new Map<string, string>();
  let held: string | undefined;
  for (const id of order) {
    if (holds(id)) held = id;
    if (held !== undefined) nearest.set(id, held);
  }
  return (id) => (holds(id) ? id : nearest.get(id));
}

// Written children with each kept element put back after the one holding its anchor (or the nearest earlier one in
// `order` still written), before them all when it came first, and after them all when its anchor is gone.
function withKeptElements<T>(
  units: readonly Placed<T>[],
  kept: Passthrough | undefined,
  write: (element: XmlElement) => T,
  order: readonly string[],
): T[] {
  const elements = kept?.elements;
  if (!elements?.length) return units.map((unit) => unit.out);
  const unitOf = new Map(units.flatMap((unit, index) => unit.anchors.map((anchor) => [anchor, index] as const)));
  const resolve = anchorResolver(order, (id) => unitOf.has(id));
  const slots: T[][] = Array.from({ length: units.length + 1 }, () => []);
  elements.forEach((element, index) => {
    const after = kept?.elementsAfter?.[index];
    const unit = typeof after === "string" ? unitOf.get(resolve(after) ?? "") : undefined;
    slots[after === null ? 0 : unit === undefined ? units.length : unit + 1].push(write(element));
  });
  return slots.flatMap((placed, slot) => (slot < units.length ? [...placed, units[slot].out] : placed));
}

// Kept children among written ones with nothing between them, as inside a `<p>`.
function keptAmongInline(units: readonly Placed<string>[], kept: Passthrough | undefined, order: readonly string[]) {
  return withKeptElements(units, kept, writeXmlElement, order).join("");
}

// Kept children among written ones, each on its own line, as between sections.
function keptAmongLines(
  units: readonly Placed<string[]>[],
  kept: Passthrough | undefined,
  indent: string,
  order: readonly string[],
): string[] {
  return withKeptElements(units, kept, (element) => [`${indent}${writeXmlElement(element)}`], order).flat();
}

const timeAttribute = (name: string, value: string | undefined) =>
  value === undefined ? "" : ` ${name}="${escapeXmlAttribute(value)}"`;

// Times for a node Composer writes without them: only those the source wrote, kept or derived again.
function keptTimesAttributes(kept: KeptTimes | undefined, envelopeOf: () => Envelope | null): string {
  const envelope = kept ? envelopeOf() : null;
  if (!kept || !envelope) return "";
  const [begin, end] = writtenTimes(kept, envelope);
  return `${timeAttribute("begin", begin)}${timeAttribute("end", end)}`;
}

// -- Exports ------------------------------------------------------------------

export type { Placed };
export { anchorResolver, keptAmongInline, keptAmongLines, keptAttributes, keptElementLines, keptTimesAttributes };
