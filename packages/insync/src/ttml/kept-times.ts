import type { XmlReadElement } from "./xml-read-tree";
import { type KeptTimes, keptTimes } from "../passthrough";
import { bgBounds, effectiveBounds } from "../line-bounds";
import type { LyricLine } from "../line";
import { formatTime } from "../format-time";
import { parseTtmlTimestamp } from "./timestamp";

// -- Types --------------------------------------------------------------------

type Envelope = readonly [begin: string, end: string];

interface Bounds {
  begin: number;
  end: number;
}

// -- Envelopes ----------------------------------------------------------------

// The times the writer derives for a node, as it writes them.
const envelopeOf = ({ begin, end }: Bounds): Envelope => [formatTime(begin), formatTime(end)];

function lineEnvelope(line: LyricLine): Envelope | null {
  const bounds = effectiveBounds(line);
  return bounds && envelopeOf(bounds);
}

function backgroundEnvelope(line: LyricLine): Envelope | null {
  const bounds = bgBounds(line) ?? effectiveBounds(line);
  return bounds && envelopeOf(bounds);
}

// The envelope of the written lines of a song part.
function partEnvelope(lines: readonly LyricLine[]): Envelope | null {
  let begin = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    const bounds = effectiveBounds(line);
    if (!bounds) continue;
    begin = Math.min(begin, bounds.begin);
    end = Math.max(end, bounds.end);
  }
  return Number.isFinite(begin) ? envelopeOf({ begin, end }) : null;
}

// -- Times --------------------------------------------------------------------

type WrittenTimes = readonly [begin: string | undefined, end: string | undefined];

// A node's own times, either or both, kept when the source wrote them; `onlyIfDifferent` skips times the writer
// derives anyway.
function capturedTimes(
  element: XmlReadElement,
  envelope: Envelope | null,
  onlyIfDifferent: boolean,
): KeptTimes | undefined {
  const begin = element.getAttribute("begin");
  const end = element.getAttribute("end");
  if ((begin === null && end === null) || !envelope) return undefined;
  if (onlyIfDifferent && (begin ?? envelope[0]) === envelope[0] && (end ?? envelope[1]) === envelope[1])
    return undefined;
  return { ...(begin !== null && { begin }), ...(end !== null && { end }), envelope };
}

const milliseconds = (time: string) => Math.round(parseTtmlTimestamp(time) * 1000);

// The bounds the source wrote: each kept while the content still spans the same envelope and the bound still holds
// all of it, else derived again.
function writtenTimes(kept: KeptTimes, envelope: Envelope): WrittenTimes {
  const [keptBegin, keptEnd] = keptTimes(kept, envelope) ?? envelope;
  const begin =
    keptBegin !== undefined && milliseconds(keptBegin) <= milliseconds(envelope[0]) ? keptBegin : envelope[0];
  const end = keptEnd !== undefined && milliseconds(keptEnd) >= milliseconds(envelope[1]) ? keptEnd : envelope[1];
  return [kept.begin === undefined ? undefined : begin, kept.end === undefined ? undefined : end];
}

// -- Exports ------------------------------------------------------------------

export type { Envelope };
export { backgroundEnvelope, capturedTimes, lineEnvelope, partEnvelope, writtenTimes };
