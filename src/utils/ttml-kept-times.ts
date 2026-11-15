import { type KeptTimes, keptTimes } from "insync/passthrough";
import { bgBounds, effectiveBounds } from "insync/line-bounds";
import type { LyricLine } from "insync/line";
import { formatTime } from "@/utils/format-time";

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
function capturedTimes(element: Element, envelope: Envelope | null, onlyIfDifferent: boolean): KeptTimes | undefined {
  const begin = element.getAttribute("begin");
  const end = element.getAttribute("end");
  if ((begin === null && end === null) || !envelope) return undefined;
  if (onlyIfDifferent && (begin ?? envelope[0]) === envelope[0] && (end ?? envelope[1]) === envelope[1])
    return undefined;
  return { ...(begin !== null && { begin }), ...(end !== null && { end }), envelope };
}

// The bounds the source wrote: kept while the content still spans the same envelope, else derived again.
function writtenTimes(kept: KeptTimes, envelope: Envelope): WrittenTimes {
  const [begin, end] = keptTimes(kept, envelope) ?? envelope;
  return [kept.begin === undefined ? undefined : begin, kept.end === undefined ? undefined : end];
}

// -- Exports ------------------------------------------------------------------

export type { Envelope };
export { backgroundEnvelope, capturedTimes, lineEnvelope, partEnvelope, writtenTimes };
