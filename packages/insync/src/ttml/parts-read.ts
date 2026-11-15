import type { XmlReadDocument, XmlReadElement } from "./xml-read-tree";
import type { Part, PartSection } from "../part";
import type { Passthrough } from "../passthrough";
import type { LyricLine } from "../line";
import { sectionAnchors } from "./anchors";
import { ITUNES_NS } from "./modelled";
import { nodePassthrough } from "./passthrough-read";
import { capturedTimes, partEnvelope } from "./kept-times";
import { isExportedLine } from "./line-keys";

// -- Helpers ------------------------------------------------------------------

function songPartOf(div: XmlReadElement): string | null {
  return div.getAttribute("itunes:songPart") ?? div.getAttributeNS(ITUNES_NS, "songPart");
}

function divPassthrough(
  div: XmlReadElement,
  lines: readonly LyricLine[],
  lineByParagraph: ReadonlyMap<XmlReadElement, LyricLine>,
  splitChar: string,
): Passthrough | undefined {
  const times = capturedTimes(div, partEnvelope(lines.filter((value) => isExportedLine(value, splitChar))), false);
  return nodePassthrough("div", div, times ? { times } : {}, sectionAnchors(lineByParagraph));
}

const childSections = (div: XmlReadElement) => Array.from(div.children).filter((child) => child.tagName === "div");

// A `<div>` and the sections nested in it, with the lines each holds; a `<div>` without lines makes none.
function sectionFrom(
  div: XmlReadElement,
  lineByParagraph: ReadonlyMap<XmlReadElement, LyricLine>,
  splitChar: string,
): PartSection | undefined {
  const lines = Array.from(div.getElementsByTagName("p")).flatMap((p) => lineByParagraph.get(p) ?? []);
  if (lines.length === 0) return undefined;
  const kind = songPartOf(div);
  const passthrough = divPassthrough(div, lines, lineByParagraph, splitChar);
  const sections = childSections(div).flatMap((child) => sectionFrom(child, lineByParagraph, splitChar) ?? []);
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
function partsFromDivs(doc: XmlReadDocument, lineByParagraph: ReadonlyMap<XmlReadElement, LyricLine>, splitChar: string): Part[] {
  const body = Array.from(doc.documentElement.children).find((child) => child.tagName === "body");
  return (body ? childSections(body) : []).flatMap((div) => {
    const section = sectionFrom(div, lineByParagraph, splitChar);
    if (!section || (section.kind === undefined && !section.passthrough && !section.sections)) return [];
    return [{ id: crypto.randomUUID(), ...section }];
  });
}

// -- Exports ------------------------------------------------------------------

export { partsFromDivs };
