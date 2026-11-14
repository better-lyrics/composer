import type { Part } from "insync/part";
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

// -- Functions ----------------------------------------------------------------

// Every `<div>` with a song part, its own times or unmodelled data becomes a part of the lines it holds. A plain
// `<div>`, the only kind Composer writes, makes none.
function partsFromDivs(doc: Document, lineByParagraph: ReadonlyMap<Element, LyricLine>): Part[] {
  return Array.from(doc.getElementsByTagName("div")).flatMap((div) => {
    const lines = Array.from(div.children).flatMap((child) => lineByParagraph.get(child) ?? []);
    if (lines.length === 0) return [];
    const kind = songPartOf(div);
    const passthrough = divPassthrough(div, lines);
    if (kind === null && !passthrough) return [];
    return [
      {
        id: crypto.randomUUID(),
        ...(kind !== null && { kind }),
        lineIds: lines.map((line) => line.id),
        ...(passthrough && { passthrough }),
      },
    ];
  });
}

// -- Exports ------------------------------------------------------------------

export { partsFromDivs };
