import type { Part, PartSection } from "insync/part";
import type { Passthrough } from "insync/passthrough";
import type { LyricLine } from "@/domain/line/model";
import { ITUNES_NS } from "@/utils/lyrics-parsers/ttml-modelled";
import { nodePassthrough } from "@/utils/lyrics-parsers/ttml-passthrough-read";
import { capturedTimes, partEnvelope } from "@/utils/ttml-kept-times";
import { isExportedLine } from "@/utils/ttml-line-keys";

// -- Helpers ------------------------------------------------------------------

function songPartOf(div: Element): string | null {
  return div.getAttribute("itunes:songPart") ?? div.getAttributeNS(ITUNES_NS, "songPart");
}

function divPassthrough(div: Element, lines: readonly LyricLine[]): Passthrough | undefined {
  const times = capturedTimes(div, partEnvelope(lines.filter(isExportedLine)), false);
  return nodePassthrough("div", div, times ? { times } : {});
}

const childSections = (div: Element) => Array.from(div.children).filter((child) => child.tagName === "div");

// A `<div>` and the sections nested in it, with the lines each holds; a `<div>` without lines makes none.
function sectionFrom(div: Element, lineByParagraph: ReadonlyMap<Element, LyricLine>): PartSection | undefined {
  const lines = Array.from(div.getElementsByTagName("p")).flatMap((p) => lineByParagraph.get(p) ?? []);
  if (lines.length === 0) return undefined;
  const kind = songPartOf(div);
  const passthrough = divPassthrough(div, lines);
  const sections = childSections(div).flatMap((child) => sectionFrom(child, lineByParagraph) ?? []);
  return {
    ...(kind !== null && { kind }),
    lineIds: lines.map((line) => line.id),
    ...(passthrough && { passthrough }),
    ...(sections.length > 0 && { sections }),
  };
}

// -- Functions ----------------------------------------------------------------

// Every section of the body with a song part, its own times, unmodelled data or nested sections becomes a part of
// the lines it holds. A plain `<div>`, the only kind Composer writes, makes none.
function partsFromDivs(doc: Document, lineByParagraph: ReadonlyMap<Element, LyricLine>): Part[] {
  const body = Array.from(doc.documentElement.children).find((child) => child.tagName === "body");
  return (body ? childSections(body) : []).flatMap((div) => {
    const section = sectionFrom(div, lineByParagraph);
    if (!section || (section.kind === undefined && !section.passthrough && !section.sections)) return [];
    return [{ id: crypto.randomUUID(), ...section }];
  });
}

// -- Exports ------------------------------------------------------------------

export { partsFromDivs };
