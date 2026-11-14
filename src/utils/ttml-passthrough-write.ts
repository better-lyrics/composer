import type { KeptTimes, Passthrough } from "insync/passthrough";
import { escapeXmlAttribute, writeXmlAttrs, writeXmlElement } from "insync/xml-node";
import { type Envelope, writtenTimes } from "@/utils/ttml-kept-times";

// -- Functions ----------------------------------------------------------------

// Kept attributes go after the ones Composer writes.
function keptAttributes(kept: Passthrough | undefined): string {
  return kept?.attrs ? writeXmlAttrs(kept.attrs) : "";
}

// Kept children written with nothing between them, as inside a `<p>`.
function keptInline(kept: Passthrough | undefined): string {
  return kept?.elements ? kept.elements.map(writeXmlElement).join("") : "";
}

// Kept children each on their own line, as in the head and between sections.
function keptElementLines(kept: Passthrough | undefined, indent: string): string[] {
  return kept?.elements ? kept.elements.map((element) => `${indent}${writeXmlElement(element)}`) : [];
}

// Times for a node Composer writes without them: only those the source wrote, kept or derived again.
function keptTimesAttributes(kept: KeptTimes | undefined, envelope: Envelope | null): string {
  if (!kept || !envelope) return "";
  const [begin, end] = writtenTimes(kept, envelope);
  return ` begin="${escapeXmlAttribute(begin)}" end="${escapeXmlAttribute(end)}"`;
}

// -- Exports ------------------------------------------------------------------

export { keptAttributes, keptElementLines, keptInline, keptTimesAttributes };
