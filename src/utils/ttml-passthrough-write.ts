import type { KeptTimes, Passthrough } from "insync/passthrough";
import { escapeXmlAttribute, writeXmlAttrs, writeXmlElement, type XmlElement } from "insync/xml-node";
import { type Envelope, writtenTimes } from "@/utils/ttml-kept-times";

// -- Functions ----------------------------------------------------------------

// Kept attributes go after the ones Composer writes.
function keptAttributes(kept: Passthrough | undefined): string {
  return kept?.attrs ? writeXmlAttrs(kept.attrs) : "";
}

// Kept children each on their own line, as in the head and between sections.
function keptElementLines(kept: Passthrough | undefined, indent: string): string[] {
  return kept?.elements ? kept.elements.map((element) => `${indent}${writeXmlElement(element)}`) : [];
}

// Modelled children with each kept element put back before the child it came before; the rest go after them all.
function withKeptElements<T>(
  children: readonly T[],
  kept: Passthrough | undefined,
  write: (element: XmlElement) => T,
): readonly T[] {
  const elements = kept?.elements;
  if (!elements?.length) return children;
  const elementsAt = kept?.elementsAt;
  const result: T[] = [];
  let next = 0;
  children.forEach((child, index) => {
    while (next < elements.length && (elementsAt?.[next] ?? children.length) <= index) {
      result.push(write(elements[next++]));
    }
    result.push(child);
  });
  for (; next < elements.length; next++) result.push(write(elements[next]));
  return result;
}

// Kept children among written ones with nothing between them, as inside a `<p>`.
function keptAmongInline(pieces: readonly string[], kept: Passthrough | undefined): string {
  return withKeptElements(pieces, kept, writeXmlElement).join("");
}

// Kept children among written ones, each on its own line, as between sections.
function keptAmongLines(groups: readonly string[][], kept: Passthrough | undefined, indent: string): string[] {
  return withKeptElements(groups, kept, (element) => [`${indent}${writeXmlElement(element)}`]).flat();
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

export { keptAmongInline, keptAmongLines, keptAttributes, keptElementLines, keptTimesAttributes };
